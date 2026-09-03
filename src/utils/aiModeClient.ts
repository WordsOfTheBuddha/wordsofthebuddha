import { isAskSearchMode } from "./aiAskHref";
import { ASK_FEEDBACK_MIN_CHARS, isValidAskUserReview } from "./aiAskQuota";
import {
	askSharePath,
	sanitizeAskShareSnapshot,
	type AiAskShareSnapshot,
} from "./aiAskShare";
import {
	clearActiveAskThread,
	findAiAskSessionEntry,
	formatAskRelativeTime,
	mergeAskHistoryEntries,
	readActiveAskThread,
	readAiAskSession,
	removeAskHistoryEntriesByQuestions,
	upsertAiAskSessionEntry,
	writeActiveAskThread,
	writeAiAskSession,
	type AiAskSessionEntry,
} from "./aiAskSession";
import {
	assembleSpeechTranscript,
	type SpeechTranscriptResult,
} from "./aiSpeechTranscript";
import { transformId } from "./transformId";

export interface AiDiscourseHit {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
	referenceOnly: boolean;
	volpage?: string;
	href: string;
}

export interface AiAskTurn {
	/** Display wording (updated to typo-corrected text when the plan arrives). */
	question: string;
	/** Exact text the user submitted. */
	originalQuestion?: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	results: AiDiscourseHit[];
	model: string;
	reasoning: string;
	/** How the chosen discourses align with the question. */
	summary?: string;
	/** Preferred public /ask/{shareSlug} theme from the model. */
	shareSlug?: string;
	/** Resolved public path after Copy link (e.g. /ask/mindfulness-of-the-body). */
	sharePath?: string;
	/** Seeded from a public /ask/:slug snapshot (read-only turn). */
	fromShare?: boolean;
	pending: boolean;
	phase: "rewrite" | "search" | "rerank" | "done";
	error?: string;
	fromCache?: boolean;
	requestId?: string;
	feedback?: "up" | "down" | "sending";
	/** Model plan was unusable; we synthesized shorter searches. */
	degraded?: boolean;
	/** Signed-in favorite for referring to later. */
	saved?: boolean;
}

interface AiModelsResponse {
	success: boolean;
	configured: boolean;
	defaultModel: string;
	showModelPicker: boolean;
	models: { id: string; name: string; contextLength: number }[];
}

interface AiAskQuotaView {
	signedIn: boolean;
	used: number;
	limit: number;
	remaining: number;
	allowed: boolean;
	offerFeedback: boolean;
	feedbackClaimed: boolean;
	day: string;
	needsEmailVerification?: boolean;
}

interface AiAskEvent {
	type?: string;
	phase?: string;
	delta?: string;
	lookingFor?: string;
	queries?: string[];
	fallbackQueries?: string[];
	offTopic?: boolean;
	results?: AiDiscourseHit[];
	model?: string;
	error?: string;
	requestId?: string;
	correctedQuestion?: string;
	question?: string;
	degraded?: boolean;
	summary?: string;
	shareSlug?: string;
	reranked?: boolean;
	quota?: AiAskQuotaView;
}

const MODEL_STORAGE_KEY = "ai-mode-model";
const ASK_HOME_HREF = "/search?mode=ai";

/** Filled thumbtack — reads clearly at small sizes. */
const PIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>`;

/** Provider status notes — not model reasoning. Hidden from “How it searched”. */
const ASK_REASONING_STATUS_LINE =
	/^\s*\((?:OpenRouter was busy|Rewritten with Gemini\.?|Results re-ranked with Gemini\.?)[^)]*\)\s*$/i;

/**
 * Strip fallback/status lines. Gemini rewrite has no reasoning stream, so those
 * notes used to be the only body of “How it searched”.
 */
export function displayAskReasoning(
	raw: string | undefined,
	pending = false,
): string {
	const text = (raw || "").replace(/\r\n/g, "\n");
	if (!text.trim()) return "";
	const kept = text
		.split("\n")
		.filter((line) => line.trim() && !ASK_REASONING_STATUS_LINE.test(line))
		.join("\n")
		.trim();
	// While streaming, keep raw text so partial reasoning isn’t dropped mid-line.
	if (pending && !kept && text.trim()) return text.trim();
	return kept;
}

function isClientFreeModelId(id: string): boolean {
	const trimmed = id.trim();
	if (!trimmed || trimmed.length > 200 || /\s/.test(trimmed)) return false;
	return trimmed === "openrouter/free" || trimmed.endsWith(":free");
}

/** Enter and Shift+Enter stay newlines. ⌘Enter (Mac) / Ctrl+Enter (elsewhere) sends. */
export function isAskSendShortcut(
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing"
	>,
): boolean {
	if (event.isComposing) return false;
	if (event.key !== "Enter") return false;
	if (event.altKey) return false;
	return event.metaKey === true || event.ctrlKey === true;
}

export function askSendShortcutLabel(
	platform = typeof navigator !== "undefined" ? navigator.platform : "",
): string {
	return /Mac|iPhone|iPad|iPod/i.test(platform || "")
		? "Send (⌘Enter)"
		: "Send (Ctrl+Enter)";
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function stripHtml(value: string): string {
	return value.replace(/<[^>]*>/g, "");
}

interface BrowserSpeechRecognition {
	lang: string;
	interimResults: boolean;
	continuous: boolean;
	onresult: ((event: { results: ArrayLike<SpeechTranscriptResult> }) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

function speechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
	const w = window as Window & {
		SpeechRecognition?: new () => BrowserSpeechRecognition;
		webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
	};
	return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function fitTextarea(el: HTMLTextAreaElement): void {
	el.style.height = "auto";
	el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), 160)}px`;
}

function skeletonHtml(): string {
	return `<div class="ai-skel" aria-hidden="true">
		<div class="ai-skel-card"></div>
		<div class="ai-skel-card"></div>
		<div class="ai-skel-card"></div>
	</div>`;
}

function turnToSessionEntry(turn: AiAskTurn): AiAskSessionEntry {
	return {
		question: turn.question,
		...(turn.originalQuestion && turn.originalQuestion !== turn.question
			? { originalQuestion: turn.originalQuestion }
			: {}),
		lookingFor: turn.lookingFor,
		queries: turn.queries,
		fallbackQueries: turn.fallbackQueries,
		offTopic: turn.offTopic,
		results: turn.results,
		model: turn.model,
		reasoning: turn.reasoning,
		...(turn.summary ? { summary: turn.summary } : {}),
		...(turn.shareSlug ? { shareSlug: turn.shareSlug } : {}),
		at: Date.now(),
		...(turn.requestId ? { requestId: turn.requestId } : {}),
		...(turn.feedback === "up" || turn.feedback === "down"
			? { feedback: turn.feedback }
			: {}),
		saved: turn.saved === true,
	};
}

function sessionEntryToTurn(entry: AiAskSessionEntry): AiAskTurn {
	return {
		question: entry.question,
		originalQuestion: entry.originalQuestion || entry.question,
		lookingFor: entry.lookingFor,
		queries: entry.queries || [],
		fallbackQueries: entry.fallbackQueries || [],
		offTopic: entry.offTopic === true,
		results: entry.results || [],
		model: entry.model || "",
		reasoning: entry.reasoning || "",
		summary: entry.summary || "",
		shareSlug: entry.shareSlug,
		sharePath: entry.shareSlug ? askSharePath(entry.shareSlug) : undefined,
		pending: false,
		phase: "done",
		fromCache: true,
		requestId: entry.requestId,
		feedback: entry.feedback === "up" || entry.feedback === "down"
			? entry.feedback
			: undefined,
		saved: entry.saved === true,
	};
}

function shareSnapshotToTurn(share: AiAskShareSnapshot): AiAskTurn {
	return {
		question: share.question,
		originalQuestion: share.question,
		lookingFor: share.lookingFor,
		queries: share.queries,
		fallbackQueries: share.fallbackQueries,
		offTopic: false,
		results: share.results,
		model: share.model,
		reasoning: "",
		summary: share.summary,
		shareSlug: share.slug,
		sharePath: askSharePath(share.slug),
		fromShare: true,
		pending: false,
		phase: "done",
		requestId: share.requestId,
	};
}

function applyCorrectedQuestion(turn: AiAskTurn, event: AiAskEvent): void {
	const corrected = (event.correctedQuestion || event.question || "")
		.replace(/\s+/g, " ")
		.trim();
	if (!corrected) return;
	if (!turn.originalQuestion) turn.originalQuestion = turn.question;
	turn.question = corrected;
}

async function readSseEvents(
	response: Response,
	onEvent: (event: AiAskEvent) => void,
): Promise<void> {
	if (!response.body) {
		throw new Error("No response body");
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const parts = buffer.split("\n\n");
		buffer = parts.pop() || "";
		for (const part of parts) {
			const data = part
				.split("\n")
				.filter((line) => line.startsWith("data:"))
				.map((line) => line.slice(5).trim())
				.join("");
			if (!data) continue;
			try {
				onEvent(JSON.parse(data) as AiAskEvent);
			} catch {
				/* skip malformed */
			}
		}
	}
}

export function attachAiMode(options: {
	root: HTMLElement;
	showModelPicker: boolean;
	defaultModel: string;
	shareMode?: boolean;
	shareSnapshot?: string;
}): void {
	const {
		root,
		showModelPicker,
		defaultModel,
		shareMode = false,
		shareSnapshot = "",
	} = options;
	const form = root.querySelector<HTMLFormElement>("[data-ai-form]");
	const followForm = root.querySelector<HTMLFormElement>("[data-ai-follow-form]");
	const input = root.querySelector<HTMLTextAreaElement>("[data-ai-input]");
	const followInput = root.querySelector<HTMLTextAreaElement>("[data-ai-follow-input]");
	const modelSelect = root.querySelector<HTMLSelectElement | HTMLInputElement>(
		"[data-ai-model]",
	);
	const thread = root.querySelector<HTMLElement>("[data-ai-thread]");
	const empty = root.querySelector<HTMLElement>("[data-ai-empty]");
	const historyEl = root.querySelector<HTMLElement>("[data-ai-history]");
	const composer = root.querySelector<HTMLElement>("[data-ai-composer]");
	const statuses = [...root.querySelectorAll<HTMLElement>("[data-ai-status]")];
	const meterEls = [...root.querySelectorAll<HTMLElement>("[data-ai-meter]")];
	const quotaDialog = root.querySelector<HTMLElement>("[data-ai-quota-dialog]");
	const feedbackDialog = root.querySelector<HTMLElement>("[data-ai-feedback-dialog]");
	const feedbackText = root.querySelector<HTMLTextAreaElement>("[data-ai-feedback-text]");
	const feedbackError = root.querySelector<HTMLElement>("[data-ai-feedback-error]");
	const micButtons = [
		...root.querySelectorAll<HTMLButtonElement>("[data-ai-mic]"),
	];
	if (!form || !input || !thread || !empty || !composer) return;

	let turns: AiAskTurn[] = [];
	let sessionEntries = readAiAskSession();
	let quota: AiAskQuotaView | null = null;
	let signedInForHistory = false;
	let pendingReplaceQuestions: string[] | null = null;
	let busy = false;
	let feedbackPromptShown = false;
	let feedbackHintTimer = 0;
	let listening = false;
	let listenTarget: HTMLTextAreaElement | null = null;
	let voiceBase = "";
	let recognition: BrowserSpeechRecognition | null = null;
	let selectedModel = defaultModel;
	if (showModelPicker) {
		try {
			const stored = localStorage.getItem(MODEL_STORAGE_KEY);
			if (stored && isClientFreeModelId(stored)) selectedModel = stored;
		} catch {
			/* ignore */
		}
	}

	function setStatus(text: string): void {
		statuses.forEach((el) => {
			el.textContent = text;
			el.hidden = !text;
		});
	}

	function currentReturnTo(): string {
		return `${window.location.pathname}${window.location.search}`;
	}

	function signInHref(): string {
		return `/signin?returnTo=${encodeURIComponent(currentReturnTo())}`;
	}

	function registerHref(): string {
		return `/register?returnTo=${encodeURIComponent(currentReturnTo())}`;
	}

	function applyQuota(next: AiAskQuotaView | null | undefined): void {
		if (!next) return;
		quota = next;
		const unit = next.remaining === 1 ? "Ask" : "Asks";
		let label = next.signedIn
			? `${next.remaining} ${unit} left today`
			: `${next.remaining} free ${unit} left today`;
		if (next.needsEmailVerification) {
			label = `${label} · verify email for more`;
		}
		meterEls.forEach((el) => {
			el.textContent = label;
			el.hidden = false;
		});
	}

	function optimisticConsumeQuota(): void {
		if (!quota || !quota.allowed) return;
		const used = quota.used + 1;
		applyQuota({
			...quota,
			used,
			remaining: Math.max(0, quota.limit - used),
			allowed: used < quota.limit,
		});
	}

	function closeQuotaDialog(): void {
		if (quotaDialog) quotaDialog.hidden = true;
	}

	function openQuotaDialog(
		kind: "signin" | "tomorrow" | "save" | "verify",
	): void {
		if (!quotaDialog) return;
		const signin = quotaDialog.querySelector<HTMLElement>(
			'[data-ai-quota-panel="signin"]',
		);
		const tomorrow = quotaDialog.querySelector<HTMLElement>(
			'[data-ai-quota-panel="tomorrow"]',
		);
		const verify = quotaDialog.querySelector<HTMLElement>(
			'[data-ai-quota-panel="verify"]',
		);
		const showSignin = kind === "signin" || kind === "save";
		if (signin) signin.hidden = !showSignin;
		if (tomorrow) tomorrow.hidden = kind !== "tomorrow";
		if (verify) verify.hidden = kind !== "verify";
		const title = quotaDialog.querySelector<HTMLElement>(
			"[data-ai-quota-signin-title]",
		);
		const body = quotaDialog.querySelector<HTMLElement>(
			"[data-ai-quota-signin-body]",
		);
		if (title && body) {
			if (kind === "save") {
				title.textContent = "Create an account to pin Asks";
				body.textContent =
					"Recent Asks are temporary. Pinning keeps a question at hand when older ones drop off — and an account syncs your history across devices.";
			} else {
				title.textContent = "You’ve used today’s free Asks";
				body.textContent =
					"Create a free account for more Asks today. You’ll also keep recent questions across devices, and can pin ones to refer to later.";
			}
		}
		const register = quotaDialog.querySelector<HTMLAnchorElement>(
			"[data-ai-quota-register]",
		);
		const link = quotaDialog.querySelector<HTMLAnchorElement>("[data-ai-quota-signin]");
		if (register) register.href = registerHref();
		if (link) link.href = signInHref();
		const verifyStatus = quotaDialog.querySelector<HTMLElement>(
			"[data-ai-quota-verify-status]",
		);
		if (verifyStatus) {
			verifyStatus.hidden = true;
			verifyStatus.textContent = "";
		}
		quotaDialog.hidden = false;
	}

	async function resendAskVerification(): Promise<void> {
		const status = quotaDialog?.querySelector<HTMLElement>(
			"[data-ai-quota-verify-status]",
		);
		const button = quotaDialog?.querySelector<HTMLButtonElement>(
			"[data-ai-quota-resend-verify]",
		);
		if (button) button.disabled = true;
		if (status) {
			status.hidden = false;
			status.textContent = "Sending…";
		}
		try {
			const { resendVerificationEmail } = await import(
				"./emailVerificationClient"
			);
			const result = await resendVerificationEmail();
			if (result.alreadyVerified) {
				if (status) status.textContent = "Email already verified — refreshing…";
				await refreshQuota();
				closeQuotaDialog();
				return;
			}
			if (status) {
				if (result.ok) {
					const { verificationSentStatus } = await import(
						"./emailVerificationCopy"
					);
					status.textContent = verificationSentStatus(result.email);
				} else {
					status.textContent = result.error || "Could not resend.";
				}
			}
		} finally {
			if (button) button.disabled = false;
		}
	}

	async function refreshAskVerification(): Promise<void> {
		const status = quotaDialog?.querySelector<HTMLElement>(
			"[data-ai-quota-verify-status]",
		);
		const button = quotaDialog?.querySelector<HTMLButtonElement>(
			"[data-ai-quota-refresh-verify]",
		);
		if (button) button.disabled = true;
		if (status) {
			status.hidden = false;
			status.textContent = "Checking…";
		}
		try {
			await refreshQuota();
			if (quota?.signedIn && !quota.needsEmailVerification) {
				closeQuotaDialog();
				return;
			}
			if (status) {
				status.textContent =
					"Not verified yet — open the link in your email, then try again.";
			}
		} finally {
			if (button) button.disabled = false;
		}
	}

	function closeFeedbackDialog(): void {
		if (feedbackDialog) feedbackDialog.hidden = true;
		if (feedbackError) {
			feedbackError.hidden = true;
			feedbackError.textContent = "";
		}
	}

	function openFeedbackDialog(): void {
		if (!feedbackDialog) return;
		if (feedbackText) feedbackText.value = "";
		if (feedbackError) {
			feedbackError.hidden = true;
			feedbackError.textContent = "";
		}
		feedbackDialog.hidden = false;
		feedbackText?.focus();
	}

	async function refreshQuota(): Promise<void> {
		try {
			const response = await fetch("/api/ai/quota", {
				credentials: "same-origin",
			});
			const data = (await response.json()) as {
				success?: boolean;
				quota?: AiAskQuotaView;
			};
			if (data.success && data.quota) applyQuota(data.quota);
		} catch {
			/* ignore */
		}
	}

	function maybeOfferFeedback(view: AiAskQuotaView | null | undefined): void {
		if (!view?.offerFeedback || view.feedbackClaimed) return;
		if (feedbackPromptShown) return;
		feedbackPromptShown = true;
		window.clearTimeout(feedbackHintTimer);
		feedbackHintTimer = window.setTimeout(() => openFeedbackDialog(), 450);
	}

	async function dismissFeedbackOffer(): Promise<void> {
		closeFeedbackDialog();
		try {
			const response = await fetch("/api/ai/quota", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "dismissFeedback" }),
			});
			const data = (await response.json()) as {
				success?: boolean;
				quota?: AiAskQuotaView;
			};
			if (data.success && data.quota) applyQuota(data.quota);
		} catch {
			/* ignore */
		}
	}

	function setFeedbackError(message: string): void {
		if (!feedbackError) return;
		feedbackError.textContent = message;
		feedbackError.hidden = !message;
	}

	async function submitUserReview(): Promise<void> {
		const text = (feedbackText?.value || "").replace(/\s+/g, " ").trim();
		if (!isValidAskUserReview(text)) {
			setFeedbackError(
				`Please write at least ${ASK_FEEDBACK_MIN_CHARS} characters.`,
			);
			return;
		}
		const submit = root.querySelector<HTMLButtonElement>("[data-ai-feedback-submit]");
		if (submit) submit.disabled = true;
		setFeedbackError("");
		try {
			const response = await fetch("/api/ai/user-review", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text }),
			});
			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
				quota?: AiAskQuotaView;
			};
			if (data.quota) applyQuota(data.quota);
			if (!response.ok || !data.success) {
				setFeedbackError(data.error || "Could not save feedback.");
				return;
			}
			closeFeedbackDialog();
			setStatus("Thanks — 5 more Asks today.");
		} catch {
			setFeedbackError("Network error. Try again.");
		} finally {
			if (submit) submit.disabled = false;
		}
	}

	function currentModel(): string {
		if (selectedModel && isClientFreeModelId(selectedModel)) return selectedModel;
		return defaultModel;
	}

	function persistActiveThread(): void {
		if (shareMode) return;
		const entries = turns
			.filter(
				(turn) =>
					!turn.pending &&
					!turn.error &&
					!turn.offTopic &&
					turn.results.length > 0,
			)
			.map((turn) => turnToSessionEntry(turn));
		writeActiveAskThread(entries);
	}

	function persistSessionFromTurn(turn: AiAskTurn): void {
		if (turn.pending || turn.error || turn.offTopic) return;
		// Empty answers are not worth replaying — they hide real retries.
		if (turn.results.length === 0) return;
		// Re-asking the same topic shouldn’t clear a favorite.
		if (!turn.saved) {
			const prior =
				findAiAskSessionEntry(sessionEntries, turn.question) ||
				findAiAskSessionEntry(
					sessionEntries,
					turn.originalQuestion || "",
				);
			if (prior?.saved) turn.saved = true;
		}
		const entry = turnToSessionEntry(turn);
		const replaceQuestions = pendingReplaceQuestions;
		pendingReplaceQuestions = null;
		if (replaceQuestions?.length) {
			sessionEntries = removeAskHistoryEntriesByQuestions(
				sessionEntries,
				replaceQuestions,
			);
		}
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, entry);
		writeAiAskSession(sessionEntries);
		persistActiveThread();
		renderHistory();
		// Always attempt server write — signedInForHistory can lag the first Ask.
		void fetch("/api/ai/history", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entry,
				...(replaceQuestions?.length ? { replaceQuestions } : {}),
			}),
		})
			.then(async (response) => {
				if (response.status === 401) {
					signedInForHistory = false;
					return;
				}
				if (response.ok) signedInForHistory = true;
			})
			.catch(() => {
				/* history sync is best-effort */
			});
	}

	function persistSaveState(turn: AiAskTurn): void {
		if (turn.pending || turn.error || turn.results.length === 0) return;
		const entry = turnToSessionEntry(turn);
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, entry);
		writeAiAskSession(sessionEntries);
		persistActiveThread();
		renderHistory();
		void fetch("/api/ai/history", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ entry }),
		})
			.then(async (response) => {
				if (response.status === 401) {
					signedInForHistory = false;
					return;
				}
				if (response.ok) signedInForHistory = true;
			})
			.catch(() => {
				/* history sync is best-effort */
			});
	}

	function toggleSaveTurn(turn: AiAskTurn): void {
		if (turn.pending || turn.error || turn.results.length === 0) return;
		if (!signedInForHistory) {
			openQuotaDialog("save");
			return;
		}
		turn.saved = !turn.saved;
		persistSaveState(turn);
		syncLayout();
	}

	async function syncHistoryFromServer(): Promise<void> {
		try {
			const probe = await fetch("/api/ai/history", {
				credentials: "same-origin",
			});
			const probeData = (await probe.json()) as {
				success?: boolean;
				signedIn?: boolean;
				entries?: AiAskSessionEntry[];
			};
			if (!probeData.success || !probeData.signedIn) {
				signedInForHistory = false;
				return;
			}
			signedInForHistory = true;
			const response = await fetch("/api/ai/history", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "sync",
					entries: sessionEntries,
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				entries?: AiAskSessionEntry[];
			};
			if (!response.ok || !data.success) {
				sessionEntries = mergeAskHistoryEntries(
					sessionEntries,
					Array.isArray(probeData.entries) ? probeData.entries : [],
				);
			} else {
				sessionEntries = Array.isArray(data.entries)
					? data.entries
					: sessionEntries;
			}
			writeAiAskSession(sessionEntries);
			// Asks that finished during the first sync stay local-only unless we merge again.
			const latestLocal = readAiAskSession();
			if (latestLocal.length !== sessionEntries.length) {
				const catchUp = await fetch("/api/ai/history", {
					method: "POST",
					credentials: "same-origin",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "sync",
						entries: latestLocal,
					}),
				});
				const catchUpData = (await catchUp.json()) as {
					success?: boolean;
					entries?: AiAskSessionEntry[];
				};
				if (catchUp.ok && catchUpData.success && Array.isArray(catchUpData.entries)) {
					sessionEntries = catchUpData.entries;
					writeAiAskSession(sessionEntries);
				} else {
					sessionEntries = mergeAskHistoryEntries(
						latestLocal,
						sessionEntries,
					);
					writeAiAskSession(sessionEntries);
				}
			}
			for (const turn of turns) {
				const match =
					findAiAskSessionEntry(sessionEntries, turn.question) ||
					findAiAskSessionEntry(
						sessionEntries,
						turn.originalQuestion || "",
					);
				if (match) turn.saved = match.saved === true;
			}
			renderHistory();
			if (turns.length > 0) syncLayout();
		} catch {
			/* keep local history */
		}
	}

	function renderHit(hit: AiDiscourseHit): string {
		const id = escapeHtml(transformId(hit.slug));
		const title = escapeHtml(hit.title);
		const description = hit.description
			? `<p class="mt-2 text-text line-clamp-4 text-sm sm:text-base">${escapeHtml(stripHtml(hit.description))}</p>`
			: "";
		const snippet = hit.contentSnippet
			? `<p class="mt-2 text-gray-500 dark:text-gray-300 text-sm">${escapeHtml(stripHtml(hit.contentSnippet))}</p>`
			: "";
		const badge = hit.referenceOnly
			? `<span class="inline-block ml-1.5 px-1 py-0 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] align-middle">Reference</span>`
			: "";
		// Ask readers aren’t PTS/verse users — omit those labels here (Search still shows them).
		return `<div data-result-type="discourse">
			<a href="${escapeHtml(hit.href)}" class="search-discourse-card block no-underline text-inherit" data-search-result>
				<div class="flex items-start">
					<div class="min-w-0 pr-4">
						<h2 class="text-base sm:text-lg font-semibold text-text leading-snug">
							<span class="id font-normal text-[var(--link-color)]">
								${id}&nbsp; <span style="color:var(--text-color)">${title}</span>
							</span>
							${badge}
						</h2>
					</div>
				</div>
				${description}
				${snippet}
			</a>
		</div>`;
	}

	function queryChipsHtml(queries: readonly string[], className: string): string {
		if (queries.length === 0) return "";
		return `<div class="${className}">${queries
			.map((query) => {
				const href = `/search?q=${encodeURIComponent(query)}`;
				return `<a class="ai-query-chip" href="${href}">${escapeHtml(query)}</a>`;
			})
			.join("")}</div>`;
	}

	function emptyHitsHtml(turn: AiAskTurn): string {
		const searchTerm =
			turn.queries[0] ||
			turn.lookingFor.replace(/^looking for:\s*/i, "").trim() ||
			turn.question;
		const searchHref = `/search?q=${encodeURIComponent(searchTerm)}`;
		const tried =
			turn.queries.length > 0
				? `<p class="ai-empty-tried">Tried: ${turn.queries
						.map((query) => escapeHtml(query))
						.join(" · ")}</p>`
				: "";
		if (turn.degraded) {
			return `<div class="ai-empty-hits">
				<p>Couldn’t form a clear library search from that wording.</p>
				${tried}
				<p><a href="${searchHref}">Open Search</a> with a shorter phrase, or rephrase (Pāli stems like satipaṭṭhāna often help).</p>
			</div>`;
		}
		return `<div class="ai-empty-hits">
			<p>No discourses matched those searches.</p>
			${tried}
			<p><a href="${searchHref}">Open Search</a>, or ask again with different terms.</p>
		</div>`;
	}

	function latestRateableTurnIndex(): number {
		for (let i = turns.length - 1; i >= 0; i--) {
			const turn = turns[i];
			if (
				turn &&
				!turn.pending &&
				!turn.error &&
				!turn.offTopic &&
				turn.requestId &&
				turn.results.length > 0
			) {
				return i;
			}
		}
		return -1;
	}

	function shareActionsHtml(turn: AiAskTurn, turnIndex: number): string {
		if (turn.pending || turn.error || turn.results.length === 0) {
			return "";
		}
		const pinned = turn.saved === true;
		const pinTitle = pinned
			? "Unpin — allow this Ask to drop off with older ones"
			: signedInForHistory
				? "Pin so it stays when older Asks drop off"
				: "Create an account to pin Asks";
		const pinLabel = pinned ? "Pinned" : "Pin this Ask";
		return `<div class="ai-share-actions">
			<button type="button" class="ai-share-btn ai-pin-btn${pinned ? " is-pinned" : ""}" data-ai-pin data-turn-index="${turnIndex}" aria-pressed="${pinned ? "true" : "false"}" title="${pinTitle}" aria-label="${pinTitle}">
				${PIN_ICON_SVG}<span>${pinLabel}</span>
			</button>
			<button type="button" class="ai-share-btn ai-share-btn-end" data-ai-share data-turn-index="${turnIndex}">Share link</button>
		</div>`;
	}

	function feedbackHtml(turn: AiAskTurn, turnIndex: number): string {
		// One feedback row per thread — only on the latest rateable turn.
		if (turn.fromShare) return "";
		if (turnIndex !== latestRateableTurnIndex()) return "";
		if (
			turn.pending ||
			turn.error ||
			turn.offTopic ||
			!turn.requestId ||
			turn.results.length === 0
		) {
			return "";
		}
		if (turn.feedback === "up" || turn.feedback === "down") {
			return `<p class="ai-feedback-thanks">Thanks for the feedback.</p>`;
		}
		const busy = turn.feedback === "sending";
		return `<div class="ai-feedback" data-ai-feedback-turn="${turnIndex}">
			<span class="ai-feedback-label">Were these results helpful?</span>
			<button type="button" class="ai-feedback-btn" data-ai-feedback="up" ${busy ? "disabled" : ""} aria-label="Helpful">👍</button>
			<button type="button" class="ai-feedback-btn" data-ai-feedback="down" ${busy ? "disabled" : ""} aria-label="Not helpful">👎</button>
		</div>`;
	}

	async function copyShareLink(
		turn: AiAskTurn,
		button: HTMLButtonElement,
	): Promise<void> {
		if (turn.results.length === 0) return;
		const previous = button.textContent || "Share link";
		button.disabled = true;
		// Already published (e.g. viewing a share page): no need to re-publish.
		if (turn.sharePath && turn.fromShare) {
			try {
				await navigator.clipboard.writeText(
					new URL(turn.sharePath, window.location.origin).toString(),
				);
				button.textContent = "Link copied";
			} catch {
				button.textContent = "Could not copy";
			}
			window.setTimeout(() => {
				button.disabled = false;
				button.textContent = previous;
			}, 1600);
			return;
		}
		button.textContent = "Sharing…";
		try {
			const response = await fetch("/api/ai/share", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: turn.question,
					lookingFor: turn.lookingFor,
					queries: turn.queries,
					fallbackQueries: turn.fallbackQueries,
					summary: turn.summary || "",
					results: turn.results,
					model: turn.model,
					requestId: turn.requestId,
					shareSlug: turn.shareSlug,
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				path?: string;
				slug?: string;
				error?: string;
			};
			if (!response.ok || !data.success || !data.path) {
				button.textContent = data.error || "Could not share";
				window.setTimeout(() => {
					button.disabled = false;
					button.textContent = previous;
				}, 1800);
				return;
			}
			turn.shareSlug = data.slug || turn.shareSlug;
			turn.sharePath = data.path;
			const url = new URL(data.path, window.location.origin).toString();
			await navigator.clipboard.writeText(url);
			button.textContent = "Link copied";
			persistSessionFromTurn(turn);
			window.setTimeout(() => {
				button.disabled = false;
				button.textContent = "Share link";
			}, 1600);
		} catch {
			button.textContent = "Could not share";
			window.setTimeout(() => {
				button.disabled = false;
				button.textContent = previous;
			}, 1800);
		}
	}

	async function sendFeedback(
		turn: AiAskTurn,
		rating: "up" | "down",
	): Promise<void> {
		if (!turn.requestId || turn.feedback === "up" || turn.feedback === "down") {
			return;
		}
		turn.feedback = "sending";
		syncLayout();
		try {
			const response = await fetch("/api/ai/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					requestId: turn.requestId,
					rating,
					question: turn.question,
					queries: turn.queries,
					resultSlugs: turn.results.map((hit) => hit.slug),
				}),
			});
			if (!response.ok) {
				turn.feedback = undefined;
				syncLayout();
				return;
			}
			turn.feedback = rating;
			persistSessionFromTurn(turn);
			try {
				const { track } = await import("@vercel/analytics");
				track("ask_feedback", { rating });
			} catch {
				/* analytics optional */
			}
			syncLayout();
		} catch {
			turn.feedback = undefined;
			syncLayout();
		}
	}

	function renderTurn(turn: AiAskTurn, turnIndex: number): string {
		const primaryQueries = queryChipsHtml(turn.queries, "ai-queries");
		const fallbackQueries =
			turn.fallbackQueries.length > 0
				? `<div class="ai-fallbacks"><span class="ai-fallbacks-label">Also tried</span>${queryChipsHtml(turn.fallbackQueries, "ai-queries ai-queries-fallback")}</div>`
				: "";
		const lookingLabel = turn.lookingFor
			.replace(/^looking for:\s*/i, "")
			.replace(/\s+/g, " ")
			.trim();
		const lookingSameAsQuestion =
			lookingLabel.toLowerCase() ===
			turn.question.replace(/\s+/g, " ").trim().toLowerCase();
		// Off-topic / distress: prefer the model’s lookingFor framing when present.
		const looking = turn.offTopic
			? `<p class="ai-looking">${escapeHtml(
					lookingLabel ||
						"This Ask looks only in the early discourses of the Buddha.",
				)}</p>`
			: lookingLabel &&
				  !lookingSameAsQuestion &&
				  lookingLabel.length <= 80 &&
				  turn.results.length > 0
				? `<p class="ai-looking">${escapeHtml(lookingLabel)}</p>`
				: "";
		const cacheNote = turn.fromCache
			? `<p class="ai-cache-note" title="You asked this before, so the saved answer is shown again. No new Ask was used.">Saved answer from an earlier Ask · no Ask used</p>`
			: "";
		const reasoningText = displayAskReasoning(turn.reasoning, turn.pending);
		const reasoning = reasoningText
			? `<details class="ai-reasoning" ${turn.pending ? "open" : ""}>
				<summary>${turn.pending ? "Thinking" : "How it searched"}</summary>
				<p>${escapeHtml(reasoningText)}</p>
			</details>`
			: !turn.pending && turn.degraded
				? `<details class="ai-reasoning">
					<summary>How it searched</summary>
					<p>Used a simplified plan — the model didn’t return a usable rewrite.</p>
				</details>`
				: "";
		const summaryText = (turn.summary || "").replace(/\s+/g, " ").trim();
		const summary =
			!turn.pending && summaryText && turn.results.length > 0
				? `<p class="ai-summary">${escapeHtml(summaryText)}</p>`
				: "";
		const hideQueryChips = turn.results.length === 0;
		const queryBlock = hideQueryChips ? "" : primaryQueries;
		const fallbackBlock = hideQueryChips ? "" : fallbackQueries;
		let body = "";
		if (turn.error) {
			body = `<p class="ai-error">${escapeHtml(turn.error)}</p>`;
		} else if (turn.pending) {
			const label =
				turn.phase === "rerank"
					? "Ranking the best discourses…"
					: turn.phase === "search"
						? "Searching the discourses…"
						: "Understanding the question…";
			body = `${reasoning}
				<div class="ai-loading" role="status">
					<span class="ai-spinner"></span>
					${escapeHtml(label)}
				</div>
				${primaryQueries}
				${turn.phase === "search" || turn.phase === "rerank" || !reasoningText ? skeletonHtml() : ""}`;
		} else {
			const hits =
				turn.results.length > 0
					? `<div class="ai-hits">${turn.results.map(renderHit).join("")}</div>`
					: emptyHitsHtml(turn);
			body = `${cacheNote}${reasoning}${looking}${summary}${queryBlock}${fallbackBlock}${hits}${shareActionsHtml(turn, turnIndex)}${feedbackHtml(turn, turnIndex)}`;
		}
		const backLabel = shareMode ? "Ask your own question" : "Back to earlier questions";
		const backBtn =
			turnIndex === 0
				? `<button type="button" class="ai-back" data-ai-back aria-label="${backLabel}" title="${backLabel}">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
					</svg>
				</button>`
				: "";
		// The shared snapshot itself is fixed; follow-ups on a share page stay editable.
		const canEdit =
			!turn.fromShare &&
			!turn.pending &&
			!turn.error &&
			turnIndex === turns.length - 1;
		const questionEl = canEdit
			? `<button type="button" class="ai-question ai-question-btn" data-ai-edit-question data-turn-index="${turnIndex}" title="Edit and ask again">${escapeHtml(turn.question)}</button>
				<button type="button" class="ai-edit-btn" data-ai-edit-question data-turn-index="${turnIndex}" aria-label="Edit question" title="Edit and ask again">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="14" height="14" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
					</svg>
				</button>`
			: `<p class="ai-question">${escapeHtml(turn.question)}</p>`;
		return `<section class="ai-turn" data-pending="${turn.pending ? "1" : "0"}">
			<div class="ai-question-row">
				${backBtn}
				${questionEl}
			</div>
			${body}
		</section>`;
	}

	function renderHistory(): void {
		if (!historyEl) return;
		if (turns.length > 0 || sessionEntries.length === 0) {
			historyEl.hidden = true;
			historyEl.innerHTML = "";
			return;
		}
		const ordered = [...sessionEntries].sort((a, b) => {
			if (a.saved && !b.saved) return -1;
			if (!a.saved && b.saved) return 1;
			return b.at - a.at;
		});
		const items = ordered
			.map((entry) => {
				const when = formatAskRelativeTime(entry.at);
				const pinned = entry.saved
					? `<span class="ai-history-pin" title="Pinned" aria-label="Pinned">${PIN_ICON_SVG}</span>`
					: "";
				const resultIds = entry.results
					.slice(0, 6)
					.map((hit) => transformId(hit.slug))
					.filter(Boolean)
					.join(" · ");
				const resultsRow = resultIds
					? `<span class="ai-history-results">${escapeHtml(resultIds)}</span>`
					: "";
				return `<button type="button" class="ai-history-item${entry.saved ? " is-pinned" : ""}" data-ai-history-q="${escapeHtml(entry.question)}">
						<span class="ai-history-top">
							<span class="ai-history-q">${escapeHtml(entry.question)}</span>
							<span class="ai-history-meta">${pinned}${when ? `<span class="ai-history-when">${escapeHtml(when)}</span>` : ""}</span>
						</span>
						${resultsRow}
					</button>`;
			})
			.join("");
		historyEl.innerHTML = `<div class="ai-history-heading">
			<p class="ai-history-label">Recent Asks</p>
			<p class="ai-history-hint">Older ones drop off · pin to keep</p>
		</div><div class="ai-history-list">${items}</div>`;
		historyEl.hidden = false;
		historyEl.querySelectorAll<HTMLButtonElement>("[data-ai-history-q]").forEach((button) => {
			button.addEventListener("click", () => {
				const question = button.getAttribute("data-ai-history-q") || "";
				const entry = findAiAskSessionEntry(sessionEntries, question);
				if (!entry) return;
				turns = [sessionEntryToTurn(entry)];
				persistActiveThread();
				syncLayout();
			});
		});
	}

	function syncLayout(): void {
		const hasThread = turns.length > 0;
		root.classList.toggle("has-thread", hasThread);
		empty.hidden = hasThread || shareMode;
		composer.hidden = hasThread || shareMode;
		if (followForm) followForm.hidden = !hasThread;
		if (historyEl && shareMode) historyEl.hidden = true;
		thread.innerHTML = turns.map((turn, index) => renderTurn(turn, index)).join("");
		thread.querySelectorAll<HTMLElement>("[data-ai-feedback-turn]").forEach((row) => {
			const index = Number(row.getAttribute("data-ai-feedback-turn"));
			const turn = turns[index];
			if (!turn) return;
			row.querySelectorAll<HTMLButtonElement>("[data-ai-feedback]").forEach((button) => {
				button.addEventListener("click", () => {
					const rating = button.getAttribute("data-ai-feedback");
					if (rating === "up" || rating === "down") {
						void sendFeedback(turn, rating);
					}
				});
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-back]").forEach((button) => {
			button.addEventListener("click", () => {
				if (shareMode) {
					window.location.assign(ASK_HOME_HREF);
					return;
				}
				turns = [];
				clearActiveAskThread();
				setStatus("");
				syncLayout();
				input.focus();
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-share]").forEach((button) => {
			button.addEventListener("click", () => {
				const index = Number(button.getAttribute("data-turn-index"));
				const turn = turns[index];
				if (turn) void copyShareLink(turn, button);
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-pin]").forEach((button) => {
			button.addEventListener("click", () => {
				const index = Number(button.getAttribute("data-turn-index"));
				const turn = turns[index];
				if (turn) toggleSaveTurn(turn);
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-edit-question]").forEach(
			(button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					beginEditQuestion(index);
				});
			},
		);
		if (!shareMode) renderHistory();
	}

	function beginEditQuestion(turnIndex: number): void {
		if (busy) return;
		const turn = turns[turnIndex];
		if (!turn || turn.pending || turnIndex !== turns.length - 1) return;
		const row = thread.querySelectorAll(".ai-question-row")[turnIndex];
		if (!row) return;
		const existing = row.querySelector(".ai-question-edit");
		if (existing) return;
		row.querySelector(".ai-question-btn")?.remove();
		const wrap = document.createElement("div");
		wrap.className = "ai-question-edit";
		wrap.innerHTML = `
			<label class="sr-only" for="ai-edit-question">Edit question</label>
			<textarea id="ai-edit-question" data-ai-edit-input rows="2"></textarea>
			<div class="ai-question-edit-actions">
				<button type="button" data-ai-edit-submit>Ask again</button>
				<button type="button" data-ai-edit-cancel>Cancel</button>
			</div>
		`;
		row.append(wrap);
		const editInput = wrap.querySelector<HTMLTextAreaElement>("[data-ai-edit-input]");
		if (!editInput) return;
		editInput.value = turn.question;
		fitTextarea(editInput);
		editInput.focus();
		editInput.setSelectionRange(editInput.value.length, editInput.value.length);

		const cancel = (): void => {
			syncLayout();
		};
		const submit = (): void => {
			const next = editInput.value.replace(/\s+/g, " ").trim();
			if (!next || busy) return;
			// Allow asking the same wording again (e.g. refresh results).
			void ask(next, null, { replaceTurnIndex: turnIndex });
		};
		wrap.querySelector("[data-ai-edit-cancel]")?.addEventListener("click", cancel);
		wrap.querySelector("[data-ai-edit-submit]")?.addEventListener("click", submit);
		editInput.addEventListener("input", () => fitTextarea(editInput));
		editInput.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				cancel();
				return;
			}
			if (isAskSendShortcut(event)) {
				event.preventDefault();
				submit();
			}
		});
	}

	let syncTimer = 0;
	function scheduleSync(): void {
		if (syncTimer) return;
		syncTimer = window.setTimeout(() => {
			syncTimer = 0;
			syncLayout();
		}, 80);
	}

	function syncLayoutAndReveal(): void {
		syncLayout();
		if (turns.length > 0) {
			thread.lastElementChild?.scrollIntoView({ block: "start" });
		}
	}

	async function loadModels(): Promise<void> {
		if (!showModelPicker || !(modelSelect instanceof HTMLSelectElement)) return;
		try {
			const response = await fetch("/api/ai/models");
			const data = (await response.json()) as AiModelsResponse;
			if (!data.success || data.models.length === 0) return;
			const preferred =
				(isClientFreeModelId(selectedModel) && selectedModel) ||
				data.defaultModel;
			modelSelect.replaceChildren();
			for (const model of data.models) {
				const option = document.createElement("option");
				option.value = model.id;
				option.textContent = model.name;
				if (model.id === preferred) option.selected = true;
				modelSelect.append(option);
			}
			const offered = data.models.map((model) => model.id);
			// A stored or configured model outside the curated shortlist would leave
			// the <select> blank — pick the server default, else the first option.
			const chosen = offered.includes(preferred)
				? preferred
				: offered.includes(data.defaultModel)
					? data.defaultModel
					: offered[0];
			modelSelect.value = chosen;
			selectedModel = chosen;
			syncModelIdCaption();
		} catch {
			/* picker still has the server-rendered default */
		}
	}

	function syncModelIdCaption(): void {
		root.querySelectorAll<HTMLElement>("[data-ai-model-id]").forEach((el) => {
			el.textContent = currentModel();
		});
	}

	async function ask(
		question: string,
		target: HTMLTextAreaElement | null,
		options?: { replaceTurnIndex?: number },
	): Promise<void> {
		const q = question.replace(/\s+/g, " ").trim();
		if (!q || busy) return;
		stopListening();

		const replaceTurnIndex = options?.replaceTurnIndex;
		const replacing =
			typeof replaceTurnIndex === "number" &&
			replaceTurnIndex >= 0 &&
			replaceTurnIndex < turns.length;

		// Follow-ups must always hit the model (diversity / refinement).
		// Only the first turn of a thread may restore a prior session answer.
		// Edits always re-ask so the stored answer matches the new wording.
		const cached =
			!replacing && turns.length === 0
				? findAiAskSessionEntry(sessionEntries, q)
				: undefined;
		if (cached && cached.results.length > 0) {
			turns.push(sessionEntryToTurn(cached));
			if (target) {
				target.value = "";
				fitTextarea(target);
			}
			syncLayoutAndReveal();
			followInput?.focus();
			return;
		}

		// Local gate so the sign-in / tomorrow modal appears even if the meter
		// was already at zero before this attempt (server still enforces).
		if (quota && !quota.allowed) {
			openQuotaDialog(
				quota.signedIn
					? "tomorrow"
					: quota.needsEmailVerification
						? "verify"
						: "signin",
			);
			return;
		}

		busy = true;
		if (target) {
			target.value = "";
			fitTextarea(target);
		}
		setStatus("");
		root.classList.add("is-busy");
		optimisticConsumeQuota();
		const restoreOnFail = replacing ? turns.slice() : null;
		if (replacing) {
			const previous = turns[replaceTurnIndex];
			pendingReplaceQuestions = previous
				? [previous.question, previous.originalQuestion || ""].filter(Boolean)
				: null;
			turns = turns.slice(0, replaceTurnIndex);
		} else {
			pendingReplaceQuestions = null;
		}
		const turn: AiAskTurn = {
			question: q,
			originalQuestion: q,
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: currentModel(),
			reasoning: "",
			summary: "",
			pending: true,
			phase: "rewrite",
		};
		turns.push(turn);
		syncLayoutAndReveal();
		const abortReplace = (): void => {
			if (restoreOnFail) {
				turns = restoreOnFail;
				pendingReplaceQuestions = null;
			} else {
				turns = turns.filter((item) => item !== turn);
			}
		};
		try {
			const response = await fetch("/api/ai/ask", {
				method: "POST",
				credentials: "same-origin",
				headers: {
					"Content-Type": "application/json",
					Accept: "text/event-stream",
				},
				body: JSON.stringify({
					question: q,
					model: currentModel(),
					history: turns.slice(0, -1).map((item) => ({
						question: item.question,
						lookingFor: item.lookingFor,
						queries: item.queries,
						resultSlugs: item.results.map((hit) => hit.slug).filter(Boolean),
					})),
				}),
			});
			const ctype = response.headers.get("content-type") || "";
			if (!response.ok || ctype.includes("application/json")) {
				let data: {
					error?: string;
					code?: string;
					quota?: AiAskQuotaView;
				} = {};
				try {
					data = (await response.json()) as typeof data;
				} catch {
					data = {};
				}
				turn.pending = false;
				turn.phase = "done";
				if (data.quota) applyQuota(data.quota);
				if (data.code === "ask_quota") {
					abortReplace();
					const view = data.quota ?? quota;
					openQuotaDialog(
						view?.signedIn
							? "tomorrow"
							: view?.needsEmailVerification
								? "verify"
								: "signin",
					);
					syncLayout();
					return;
				}
				if (restoreOnFail) {
					abortReplace();
					void refreshQuota();
					syncLayout();
					setStatus(data.error || "Ask could not complete.");
					return;
				}
				turn.error = data.error || "Ask could not complete.";
				void refreshQuota();
				syncLayout();
				return;
			}
			await readSseEvents(response, (event) => {
				if (event.requestId) turn.requestId = event.requestId;
				if (event.type === "quota" && event.quota) {
					applyQuota(event.quota);
				} else if (event.type === "reasoning" && event.delta) {
					turn.reasoning += event.delta;
					scheduleSync();
				} else if (event.type === "status" && event.phase === "search") {
					turn.phase = "search";
					syncLayoutAndReveal();
				} else if (event.type === "status" && event.phase === "rerank") {
					turn.phase = "rerank";
					syncLayoutAndReveal();
				} else if (event.type === "plan") {
					applyCorrectedQuestion(turn, event);
					turn.lookingFor = event.lookingFor || "";
					turn.queries = event.queries || [];
					turn.fallbackQueries = event.fallbackQueries || [];
					turn.offTopic = event.offTopic === true;
					turn.degraded = event.degraded === true;
					if (typeof event.shareSlug === "string" && event.shareSlug.trim()) {
						turn.shareSlug = event.shareSlug.trim();
					}
					turn.phase = turn.offTopic ? "done" : "search";
					syncLayoutAndReveal();
				} else if (event.type === "results") {
					applyCorrectedQuestion(turn, event);
					turn.lookingFor = event.lookingFor || turn.lookingFor;
					turn.queries = event.queries || turn.queries;
					turn.fallbackQueries = event.fallbackQueries || turn.fallbackQueries;
					turn.offTopic = event.offTopic === true;
					turn.degraded = event.degraded === true || turn.degraded;
					turn.summary =
						typeof event.summary === "string" ? event.summary.trim() : "";
					if (typeof event.shareSlug === "string" && event.shareSlug.trim()) {
						turn.shareSlug = event.shareSlug.trim();
					}
					turn.results = event.results || [];
					turn.model = event.model || turn.model;
					turn.pending = false;
					turn.phase = "done";
					if (event.quota) {
						applyQuota(event.quota);
						maybeOfferFeedback(event.quota);
					}
					persistSessionFromTurn(turn);
					try {
						void import("@vercel/analytics").then(({ track }) => {
							track("ask_complete", {
								resultCount: turn.results.length,
								offTopic: turn.offTopic ? 1 : 0,
							});
						});
					} catch {
						/* analytics optional */
					}
					syncLayoutAndReveal();
				} else if (event.type === "error") {
					turn.pending = false;
					turn.phase = "done";
					turn.error = event.error || "Ask could not complete.";
					syncLayoutAndReveal();
				}
			});
			if (turn.pending) {
				turn.pending = false;
				turn.phase = "done";
				if (!turn.error && turn.results.length === 0 && !turn.offTopic) {
					turn.error = "Ask could not complete.";
				}
				if (!turn.error) persistSessionFromTurn(turn);
				syncLayoutAndReveal();
			}
			followInput?.focus();
		} catch {
			turn.pending = false;
			turn.phase = "done";
			if (restoreOnFail) {
				abortReplace();
				setStatus("Network error. Try again.");
			} else {
				turn.error = "Network error. Try again.";
			}
			void refreshQuota();
			syncLayout();
		} finally {
			busy = false;
			root.classList.remove("is-busy");
			// Refresh edit affordance now that the request is no longer in flight.
			syncLayout();
		}
	}

	function stopListening(): void {
		listening = false;
		listenTarget = null;
		root.classList.remove("is-listening");
		micButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
		setStatus("");
		try {
			recognition?.stop();
		} catch {
			/* ignore */
		}
	}

	function startListening(target: HTMLTextAreaElement): void {
		const Ctor = speechRecognitionCtor();
		if (!Ctor) {
			setStatus("Voice input needs Chrome or Safari.");
			return;
		}
		if (listening) {
			stopListening();
			return;
		}
		voiceBase = target.value.replace(/\s+/g, " ").trim();
		listenTarget = target;
		recognition = new Ctor() as BrowserSpeechRecognition;
		recognition.lang = "en-US";
		recognition.interimResults = true;
		recognition.continuous = true;
		recognition.onresult = (event) => {
			const spoken = assembleSpeechTranscript(event.results);
			target.value = [voiceBase, spoken].filter(Boolean).join(" ");
			fitTextarea(target);
			target.scrollTop = target.scrollHeight;
		};
		recognition.onerror = () => {
			listening = false;
			listenTarget = null;
			root.classList.remove("is-listening");
			micButtons.forEach((button) =>
				button.setAttribute("aria-pressed", "false"),
			);
			setStatus("");
		};
		recognition.onend = () => {
			if (!listening) return;
			listening = false;
			listenTarget = null;
			root.classList.remove("is-listening");
			micButtons.forEach((button) =>
				button.setAttribute("aria-pressed", "false"),
			);
			setStatus("");
		};
		listening = true;
		root.classList.add("is-listening");
		micButtons.forEach((button) => button.setAttribute("aria-pressed", "true"));
		setStatus("Listening… tap the mic when you're done, then press Send.");
		recognition.start();
	}

	if (shareMode) {
		const share = sanitizeAskShareSnapshot(
			(() => {
				try {
					return JSON.parse(shareSnapshot || "null");
				} catch {
					return null;
				}
			})(),
		);
		if (!share) return;
		// Seed the thread with the shared snapshot; follow-ups below use it as context.
		turns = [shareSnapshotToTurn(share)];
		if (historyEl) historyEl.hidden = true;
		root.classList.add("has-thread", "ai-mode-share");
		syncLayout();
	}

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		void ask(input.value, input);
	});
	followForm?.addEventListener("submit", (event) => {
		event.preventDefault();
		if (followInput) void ask(followInput.value, followInput);
	});

	input.addEventListener("input", () => fitTextarea(input));
	followInput?.addEventListener("input", () => fitTextarea(followInput));

	const sendHint = askSendShortcutLabel();
	root.querySelectorAll<HTMLButtonElement>(".ai-send").forEach((button) => {
		button.title = sendHint;
		button.setAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
	});

	// Enter and Shift+Enter insert a newline. ⌘Enter / Ctrl+Enter sends.
	function bindModEnterSend(
		textarea: HTMLTextAreaElement,
		submit: () => void,
	): void {
		textarea.addEventListener("keydown", (event) => {
			if (!isAskSendShortcut(event)) return;
			event.preventDefault();
			submit();
		});
	}
	bindModEnterSend(input, () => {
		void ask(input.value, input);
	});
	if (followInput) {
		bindModEnterSend(followInput, () => {
			void ask(followInput.value, followInput);
		});
	}

	modelSelect?.addEventListener("change", () => {
		const next = modelSelect.value;
		if (!isClientFreeModelId(next)) return;
		selectedModel = next;
		syncModelIdCaption();
		try {
			localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
		} catch {
			/* ignore */
		}
	});

	root.querySelectorAll<HTMLButtonElement>("[data-ai-example]").forEach((button) => {
		button.addEventListener("click", () => {
			const text = button.getAttribute("data-ai-example") || "";
			input.value = text;
			void ask(text, input);
		});
	});

	root.querySelectorAll<HTMLButtonElement>("[data-ai-new]").forEach((button) => {
		button.addEventListener("click", () => {
			if (shareMode) {
				window.location.assign(ASK_HOME_HREF);
				return;
			}
			turns = [];
			pendingReplaceQuestions = null;
			clearActiveAskThread();
			setStatus("");
			syncLayout();
			input.focus();
		});
	});

	quotaDialog?.querySelectorAll("[data-ai-quota-close]").forEach((el) => {
		el.addEventListener("click", () => closeQuotaDialog());
	});
	quotaDialog
		?.querySelector("[data-ai-quota-resend-verify]")
		?.addEventListener("click", () => {
			void resendAskVerification();
		});
	quotaDialog
		?.querySelector("[data-ai-quota-refresh-verify]")
		?.addEventListener("click", () => {
			void refreshAskVerification();
		});
	quotaDialog?.addEventListener("click", (event) => {
		if (event.target === quotaDialog) closeQuotaDialog();
	});
	quotaDialog?.querySelector(".ai-dialog-sheet")?.addEventListener("click", (event) => {
		event.stopPropagation();
	});

	feedbackDialog?.querySelectorAll("[data-ai-feedback-close]").forEach((el) => {
		el.addEventListener("click", () => {
			void dismissFeedbackOffer();
		});
	});
	feedbackDialog
		?.querySelector("[data-ai-feedback-dismiss]")
		?.addEventListener("click", () => {
			void dismissFeedbackOffer();
		});
	feedbackDialog
		?.querySelector("[data-ai-feedback-submit]")
		?.addEventListener("click", () => {
			void submitUserReview();
		});
	feedbackDialog?.addEventListener("click", (event) => {
		if (event.target === feedbackDialog) void dismissFeedbackOffer();
	});
	feedbackDialog?.querySelector(".ai-dialog-sheet")?.addEventListener("click", (event) => {
		event.stopPropagation();
	});
	feedbackText?.addEventListener("input", () => {
		const hint = root.querySelector<HTMLElement>("[data-ai-feedback-hint]");
		if (!hint) return;
		const len = (feedbackText.value || "").replace(/\s+/g, " ").trim().length;
		hint.textContent =
			len >= ASK_FEEDBACK_MIN_CHARS
				? "Looks good."
				: `At least ${ASK_FEEDBACK_MIN_CHARS} characters.`;
	});
	window.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		if (feedbackDialog && !feedbackDialog.hidden) {
			event.preventDefault();
			void dismissFeedbackOffer();
			return;
		}
		if (quotaDialog && !quotaDialog.hidden) {
			event.preventDefault();
			closeQuotaDialog();
		}
	});

	micButtons.forEach((button) => {
		button.addEventListener("click", () => {
			const target = button.closest("form")?.querySelector("textarea");
			if (target) startListening(target);
		});
		if (!speechRecognitionCtor()) {
			button.hidden = true;
		}
	});

	// Prefill only — never auto-submit. Mode switches must not spend credits.
	const params = new URLSearchParams(window.location.search);
	const onSearchPage = window.location.pathname.replace(/\/$/, "") === "/search";
	const initial = params.get("q");
	if (initial?.trim() && (!onSearchPage || isAskSearchMode(params))) {
		input.value = initial;
		fitTextarea(input);
	}

	// `open` reopens a stored ask (e.g. from the Review Room) without a credit.
	const openQuestion = shareMode
		? ""
		: params.get("open")?.replace(/\s+/g, " ").trim() || "";
	function openFromHistory(question: string): boolean {
		const entry = findAiAskSessionEntry(sessionEntries, question);
		if (!entry) return false;
		turns = [sessionEntryToTurn(entry)];
		persistActiveThread();
		syncLayout();
		return true;
	}

	if (openQuestion) {
		if (!openFromHistory(openQuestion)) {
			// Not on this device yet — prefill while the server copy loads.
			input.value = openQuestion;
			fitTextarea(input);
		}
	} else if (!shareMode && turns.length === 0) {
		// Restore the open thread after Back from a discourse (sessionStorage).
		// Prefer this over auto-publishing every Ask to /ask/:slug.
		const active = readActiveAskThread();
		if (active.length > 0) {
			turns = active.map((entry) => {
				const turn = sessionEntryToTurn(entry);
				// Resume — not a silent cache hit from the history list.
				turn.fromCache = false;
				return turn;
			});
			syncLayout();
		}
	}

	renderHistory();
	void loadModels();
	void refreshQuota();
	const historySync = syncHistoryFromServer();
	if (openQuestion && turns.length === 0) {
		void historySync.then(() => {
			if (turns.length === 0 && openFromHistory(openQuestion)) {
				input.value = "";
				fitTextarea(input);
			}
		});
	}
}
