/**
 * Inline discourse-page Ask client (lightweight alternative to aiModeClient).
 * Auto-attaches current sutta EN + Pali, reuses /api/ai/ask quota/history
 * so limits, auth prompts, and the Asks tab stay identical.
 */
import { buildAskFollowUpHistory } from "./aiAskHistory";
import {
	askInlineAnswerHtml,
	askInlineChipsHtml,
	askInlineEmptyHtml,
	askInlineProcessHtml,
	askInlineSourcesHtml,
	formatAskAnswerCopyMarkdown,
	type AskInlinePhase,
} from "./aiAskCards";
import {
	ASK_CLIPBOARD_COPIED_LABEL,
	ASK_CLIPBOARD_FAILED_LABEL,
	copyTextWithClipboardFallback,
} from "./aiAskResearchUi";
import { installDiscourseCitationPopovers } from "./discourseCitationPopover";
import {
	readAiAskSession,
	normalizeAskQuestionKey,
	slimAskHistoryEntryForSync,
	upsertAiAskSessionEntry,
	writeAiAskSession,
	type AiAskSessionEntry,
} from "./aiAskSession";
import {
	clipAiQuestion,
	maxAskQuestionChars,
} from "./aiAskQuestionText";
import type { AiDiscourseHit } from "./aiDiscourseHits";

export interface DiscourseAskQuotaView {
	signedIn: boolean;
	used: number;
	limit: number;
	remaining: number;
	allowed: boolean;
	needsEmailVerification?: boolean;
}

interface DiscourseTurn {
	question: string;
	originalQuestion: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	results: AiDiscourseHit[];
	model: string;
	reasoning: string;
	summary: string;
	requestId?: string;
	candidateCount?: number;
	showCount?: number;
	pending: boolean;
	/** Machine phase for the process strip (display text derives from it). */
	phase: AskInlinePhase;
	error?: string;
}

const PAGE_EN_MAX = 6000;
const PAGE_PALI_MAX = 4000;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function extractText(selector: string, max: number): string {
	try {
		const nodes = [...document.querySelectorAll(selector)];
		// Prefer the visible interleaved article; split panels clone it.
		const inArticle = nodes.filter((el) =>
			Boolean(el.closest(".interleaved-article")),
		);
		const list = (inArticle.length > 0 ? inArticle : nodes)
			.map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
			.filter(Boolean);
		return list.join("\n\n").slice(0, max);
	} catch {
		return "";
	}
}

function extractPageContext(slug: string, title: string): {
	slug: string;
	title?: string;
	english?: string;
	pali?: string;
} {
	const english = extractText(".english-paragraph", PAGE_EN_MAX);
	const pali = extractText(".pali-paragraph", PAGE_PALI_MAX);
	return {
		slug,
		...(title ? { title } : {}),
		...(english ? { english } : {}),
		...(pali ? { pali } : {}),
	};
}

/** Manual retries per question, then point at rephrasing instead. */
export const DASK_MANUAL_RETRIES = 2;

/** Prior consecutive error turns asking the same question (resets on success). */
export function daskPriorErrorCount(
	turns: readonly { question: string; error?: string }[],
	index: number,
): number {
	const key = normalizeAskQuestionKey(turns[index]?.question || "");
	if (!key) return 0;
	let count = 0;
	for (let i = index - 1; i >= 0; i--) {
		const prior = turns[i];
		if (!prior?.error || normalizeAskQuestionKey(prior.question) !== key) break;
		count += 1;
	}
	return count;
}

function turnHtml(
	turn: DiscourseTurn,
	index: number,
	turns: readonly DiscourseTurn[],
): string {
	const head = `<p class="dask-q">${escapeHtml(turn.question)}</p>`;
	const process = askInlineProcessHtml(turn);
	if (turn.pending) {
		return `<div class="dask-turn" data-turn="${index}">
			${head}
			${process}
			<div class="ai-loading" role="status"><span class="ai-spinner"></span><span>Working on your Ask</span></div>
		</div>`;
	}
	if (turn.error) {
		const retry =
			daskPriorErrorCount(turns, index) < DASK_MANUAL_RETRIES
				? `<button type="button" class="dask-retry" data-dask-retry data-turn-index="${index}">Try again</button>`
				: `<p class="dask-retry-note">Try a different question.</p>`;
		return `<div class="dask-turn" data-turn="${index}">
			${head}
			${process}
			<p class="ai-error">${escapeHtml(turn.error)}</p>
			<div class="dask-error-actions">
				${retry}
			</div>
		</div>`;
	}
	const answer = askInlineAnswerHtml(turn, index);
	const chips = askInlineChipsHtml(turn);
	const sources = askInlineSourcesHtml(turn);
	const empty =
		!answer && turn.results.length === 0 ? askInlineEmptyHtml(turn) : "";
	return `<div class="dask-turn" data-turn="${index}">
		${head}
		${process}${answer}${chips}${sources}${empty}
	</div>`;
}

export function attachDiscourseAsk(root: HTMLElement): { open: () => void } {
	const slug = (root.dataset.slug || window.location.pathname.replace(/^\/+/, "").split("?")[0] || "").toLowerCase();
	const title = root.dataset.title || "";
	const toggle = root.querySelector<HTMLButtonElement>("[data-ask-toggle]");
	const panel = root.querySelector<HTMLElement>("[data-ask-panel]");
	const form = root.querySelector<HTMLFormElement>("[data-ask-form]");
	const input = root.querySelector<HTMLTextAreaElement>("[data-ask-input]");
	const thread = root.querySelector<HTMLElement>("[data-ask-thread]");
	const meterEl = root.querySelector<HTMLElement>("[data-ask-meter]");
	const dialog = root.querySelector<HTMLElement>("[data-ask-dialog]");
	const newAskBtn = root.querySelector<HTMLButtonElement>("[data-ask-new]");

	let turns: DiscourseTurn[] = [];
	let quota: DiscourseAskQuotaView | null = null;
	let busy = false;
	let aborter: AbortController | null = null;

	function renderMeter(): void {
		if (!meterEl) return;
		if (!quota?.signedIn) {
			meterEl.textContent = "";
			meterEl.hidden = true;
			return;
		}
		const label = `${Math.max(0, quota.remaining)} Asks left today`;
		meterEl.textContent = label;
		meterEl.hidden = false;
	}

	function renderThread(): void {
		if (!thread) return;
		thread.innerHTML = turns.map((t, i) => turnHtml(t, i, turns)).join("");
		const last = thread.lastElementChild;
		if (last && turns.length > 0) {
			last.scrollIntoView({ block: "nearest" });
		}
		if (input && turns.length > 0) {
			input.placeholder = "Ask a follow-up…";
		}
		if (newAskBtn) newAskBtn.hidden = turns.length === 0;
	}

	function openDialog(kind: "signin" | "tomorrow" | "verify"): void {
		if (!dialog) return;
		dialog.hidden = false;
		dialog.querySelectorAll("[data-panel]").forEach((el) => {
			const panelEl = el as HTMLElement;
			panelEl.hidden = panelEl.getAttribute("data-panel") !== kind;
		});
	}

	function closeDialog(): void {
		if (dialog) dialog.hidden = true;
	}

	async function refreshQuota(): Promise<void> {
		try {
			const res = await fetch("/api/ai/quota", { credentials: "same-origin" });
			if (!res.ok) return;
			const data = (await res.json()) as { quota?: DiscourseAskQuotaView };
			if (data.quota) {
				quota = data.quota;
				renderMeter();
				syncMaxLength();
			}
		} catch {
			/* quota is best-effort */
		}
	}

	function syncMaxLength(): void {
		if (input) input.maxLength = maxAskQuestionChars(Boolean(quota?.signedIn));
	}

	function persistTurn(turn: DiscourseTurn): void {
		if (turn.pending || turn.error || turn.offTopic) return;
		if (turn.results.length === 0) return;
		try {
			const entry: AiAskSessionEntry = {
				question: turn.question,
				originalQuestion: turn.originalQuestion,
				lookingFor: turn.lookingFor,
				queries: turn.queries.slice(0, 6),
				fallbackQueries: turn.fallbackQueries.slice(0, 6),
				offTopic: false,
				results: turn.results.slice(0, 50),
				model: turn.model,
				reasoning: turn.reasoning.slice(0, 4000),
				summary: turn.summary.slice(0, 4800),
				at: Date.now(),
				...(turn.requestId ? { requestId: turn.requestId } : {}),
			};
			const existing = readAiAskSession();
			writeAiAskSession(upsertAiAskSessionEntry(existing, entry));
			void fetch("/api/ai/history", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ entry: slimAskHistoryEntryForSync(entry) || entry }),
			}).catch(() => {});
		} catch {
			/* history sync is best-effort */
		}
	}

	async function copyInlineAnswer(
		turn: DiscourseTurn,
		button: HTMLButtonElement,
	): Promise<void> {
		if (button.disabled) return;
		const body = formatAskAnswerCopyMarkdown({
			question: turn.question,
			summary: turn.summary,
			results: turn.results,
			origin: typeof window !== "undefined" ? window.location.origin : "",
		});
		if (!body) return;
		button.disabled = true;
		const label = button.querySelector(".ai-answer-copy-label");
		const idle = label?.textContent || "Copy";
		try {
			const copied = await copyTextWithClipboardFallback(body);
			if (label) label.textContent = copied
				? ASK_CLIPBOARD_COPIED_LABEL
				: ASK_CLIPBOARD_FAILED_LABEL;
			button.classList.toggle("is-copied", copied);
			button.classList.toggle("is-copy-error", !copied);
		} catch {
			if (label) label.textContent = ASK_CLIPBOARD_FAILED_LABEL;
			button.classList.add("is-copy-error");
		} finally {
			window.setTimeout(() => {
				if (label) label.textContent = idle;
				button.classList.remove("is-copied", "is-copy-error");
				button.disabled = false;
			}, 1600);
		}
	}

	async function submit(
		questionRaw: string,
		opts?: { lowEffort?: boolean },
	): Promise<void> {
		const question = clipAiQuestion(questionRaw, maxAskQuestionChars(Boolean(quota?.signedIn)));
		if (!question || busy) return;
		aborter?.abort();
		aborter = new AbortController();
		const signal = aborter.signal;
		closeDialog();
		busy = true;
		root.classList.add("is-busy");

		const turn: DiscourseTurn = {
			question,
			originalQuestion: questionRaw.slice(0, maxAskQuestionChars(Boolean(quota?.signedIn))),
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			summary: "",
			pending: true,
			phase: "rewrite",
		};
		turns.push(turn);
		renderThread();
		if (input) input.value = "";

		const history = buildAskFollowUpHistory(
			turns.slice(0, -1).map((t) => ({
				question: t.question,
				lookingFor: t.lookingFor,
				queries: t.queries,
				results: t.results,
				summary: t.summary,
			})),
		);
		const pageContext = extractPageContext(slug, title);

		try {
			const response = await fetch("/api/ai/ask", {
				method: "POST",
				credentials: "same-origin",
				cache: "no-store",
				headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
				body: JSON.stringify({
					question,
					history,
					pageContext,
					...(opts?.lowEffort ? { effort: "low" } : {}),
				}),
				signal,
			});
			const ctype = response.headers.get("content-type") || "";
			if (!response.ok || ctype.includes("application/json")) {
				let data: { error?: string; code?: string; quota?: DiscourseAskQuotaView } = {};
				try {
					data = (await response.json()) as typeof data;
				} catch {
					data = {};
				}
				if (data.quota) {
					quota = data.quota;
					renderMeter();
				}
				turns.pop();
				renderThread();
				if (data.code === "ask_quota") {
					openDialog(
						data.quota?.signedIn
							? "tomorrow"
							: data.quota?.needsEmailVerification
								? "verify"
								: "signin",
					);
				} else {
					// Surface non-quota failures in-thread so there is exactly
					// one status location (the turn card).
					turns.push({
						question,
						originalQuestion: question,
						lookingFor: "",
						queries: [],
						fallbackQueries: [],
						offTopic: false,
						results: [],
						model: "",
						reasoning: "",
						summary: "",
						pending: false,
						phase: "rewrite",
						error:
							data.error || "Could not reach the model. Try again shortly.",
					});
					renderThread();
				}
				return;
			}
			if (!response.body) throw new Error("no stream");
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buf = "";
			const onEvent = (event: Record<string, unknown>): void => {
				const type = event.type;
				if (type === "quota" && event.quota && typeof event.quota === "object") {
					quota = event.quota as DiscourseAskQuotaView;
					renderMeter();
				} else if (type === "status") {
					const phase = typeof event.phase === "string" ? event.phase : "";
					if (
						phase === "rewrite" ||
						phase === "search" ||
						phase === "rerank" ||
						phase === "answer"
					) {
						turn.phase = phase;
						renderThread();
					}
				} else if (type === "plan") {
					if (typeof event.lookingFor === "string") turn.lookingFor = event.lookingFor;
					if (typeof event.offTopic === "boolean") turn.offTopic = event.offTopic;
					if (Array.isArray(event.queries)) turn.queries = event.queries.filter((q): q is string => typeof q === "string");
					if (Array.isArray(event.fallbackQueries)) turn.fallbackQueries = event.fallbackQueries.filter((q): q is string => typeof q === "string");
					renderThread();
				} else if (type === "results") {
					if (typeof event.lookingFor === "string") turn.lookingFor = event.lookingFor;
					if (typeof event.summary === "string") turn.summary = event.summary;
					if (typeof event.candidateCount === "number") {
						turn.candidateCount = Math.max(0, Math.floor(event.candidateCount));
					}
					if (typeof event.showCount === "number") {
						turn.showCount = Math.max(0, Math.floor(event.showCount));
					}
					if (Array.isArray(event.results)) {
						turn.results = (event.results as Record<string, unknown>[])
							.map((hit) => ({
								slug: typeof hit.slug === "string" ? hit.slug : "",
								title: typeof hit.title === "string" ? hit.title : "",
								description: typeof hit.description === "string" ? hit.description : "",
								contentSnippet: typeof hit.contentSnippet === "string" ? hit.contentSnippet : null,
								referenceOnly: hit.referenceOnly === true,
								href: typeof hit.href === "string" ? hit.href : `/${typeof hit.slug === "string" ? hit.slug : ""}`,
							}))
							.filter((hit) => Boolean(hit.slug)) as AiDiscourseHit[];
					}
					if (typeof event.model === "string") turn.model = event.model;
					if (typeof event.requestId === "string") turn.requestId = event.requestId;
					renderThread();
				} else if (type === "error") {
					turn.error = typeof event.error === "string" ? event.error : "Could not complete.";
					if (event.quota && typeof event.quota === "object") {
						quota = event.quota as DiscourseAskQuotaView;
						renderMeter();
					}
					renderThread();
				}
			};
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buf += decoder.decode(value, { stream: true });
				let idx: number;
				while ((idx = buf.indexOf("\n\n")) >= 0) {
					const chunk = buf.slice(0, idx);
					buf = buf.slice(idx + 2);
					for (const line of chunk.split("\n")) {
						const trimmed = line.trim();
						if (!trimmed.startsWith("data:")) continue;
						try {
							onEvent(JSON.parse(trimmed.slice(5)) as Record<string, unknown>);
						} catch {
							/* ignore partial */
						}
					}
				}
				if (signal.aborted) {
					void reader.cancel().catch(() => {});
					break;
				}
			}
			turn.pending = false;
			// On error keep the death phase so the process strip shows where
			// it stopped instead of an all-done strip (see aiAskCards).
			if (!turn.error) turn.phase = "done";
			if (!turn.error && turn.results.length === 0 && !turn.summary) {
				turn.error = "No passages found. Try rephrasing.";
			}
			renderThread();
			if (!turn.error) persistTurn(turn);
		} catch (error) {
			if ((error as Error)?.name === "AbortError") return;
			turn.pending = false;
			turn.error = "Network error. Try again.";
			renderThread();
		} finally {
			busy = false;
			root.classList.remove("is-busy");
		}
	}

	toggle?.addEventListener("click", () => {
		if (!panel) return;
		const willOpen = panel.hidden;
		panel.hidden = !panel.hidden;
		toggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
		if (willOpen) {
			void refreshQuota();
			window.setTimeout(() => input?.focus(), 30);
		} else {
			aborter?.abort();
		}
	});
	function open(): void {
		if (panel?.hidden) toggle?.click();
		else input?.focus();
	}
	form?.addEventListener("submit", (e) => {
		e.preventDefault();
		if (input) void submit(input.value);
	});
	input?.addEventListener("keydown", (e) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && input) {
			e.preventDefault();
			void submit(input.value);
		} else if (e.key === "Escape" && input) {
			input.blur();
		}
	});
	// Single delegated handler set (copy + retry) — survives re-renders.
	thread?.addEventListener("click", (e) => {
		const target = e.target as HTMLElement | null;
		const copyBtn = target?.closest?.(
			"[data-ai-copy-answer]",
		) as HTMLButtonElement | null;
		if (copyBtn && thread.contains(copyBtn)) {
			const index = Number(copyBtn.getAttribute("data-turn-index"));
			const turn = turns[Number.isFinite(index) ? index : -1];
			if (!turn || turn.pending) return;
			void copyInlineAnswer(turn, copyBtn);
			return;
		}
		const retryBtn = target?.closest?.(
			"[data-dask-retry]",
		) as HTMLButtonElement | null;
		if (retryBtn && thread.contains(retryBtn)) {
			if (busy) return;
			const index = Number(retryBtn.getAttribute("data-turn-index"));
			const turn = turns[Number.isFinite(index) ? index : -1];
			if (!turn || !turn.error) return;
			// Resubmit fresh at low effort: drop the failed turn so history
			// stays clean and the planner starts fast.
			turns.splice(turns.indexOf(turn), 1);
			void submit(turn.question, { lowEffort: true });
		}
	});
	newAskBtn?.addEventListener("click", () => {
		aborter?.abort();
		turns = [];
		renderThread();
		input?.focus();
	});
	dialog?.querySelectorAll("[data-close]").forEach((btn) => {
		btn.addEventListener("click", closeDialog);
	});
	// Citation popovers for answer + source links (shared panel; delegation
	// survives thread re-renders, one install per thread root).
	if (thread) installDiscourseCitationPopovers(thread);
	syncMaxLength();
	renderThread();
	return { open };
}
