import { isAskSearchMode } from "./aiAskHref";
import type { AiAskPersonHit } from "./aiAskPersons";
import { sanitizeAskPersonHits } from "./aiAskPersons";
import { ASK_FEEDBACK_MIN_CHARS, isValidAskUserReview } from "./aiAskQuota";
import {
	askSharePath,
	askShareTurnsForRestore,
	sanitizeAskShareSnapshot,
	type AiAskShareSnapshot,
	type AiAskShareTurn,
} from "./aiAskShare";
import {
	askHistoryEntriesForRestore,
	clearActiveAskThread,
	findAiAskSessionEntry,
	formatAskRelativeTime,
	mergeAskHistoryEntries,
	normalizeAskQuestionKey,
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
import { linkifyAskSummaryHtml } from "./linkifyAskSummary";
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
	persons?: AiAskPersonHit[];
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
	/** Candidate pool size while rescoring (status event). */
	rerankCandidateCount?: number;
	/** Target display count while rescoring (status event). */
	rerankShowCount?: number;
	error?: string;
	fromCache?: boolean;
	requestId?: string;
	feedback?: "up" | "down" | "sending";
	/** Model plan was unusable; we synthesized shorter searches. */
	degraded?: boolean;
	/** Signed-in favorite for referring to later. */
	saved?: boolean;
	/** Reader expanded the (clamped) reasoning after the Ask finished. */
	reasoningExpanded?: boolean;
	/** Server note when the plan came from a fallback model (e.g. Gemini). */
	plannerNote?: string;
	/** DEV-only planner routing trace (attempts / failures / used model). */
	routing?: AskPlannerRoutingView;
	/** Rescorer was unavailable — results are in search order without a briefing. */
	rankedBySearchOnly?: boolean;
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
	candidateCount?: number;
	showCount?: number;
	persons?: AiAskPersonHit[];
	quota?: AiAskQuotaView;
	plannerNote?: string;
	routing?: AskPlannerRoutingView;
}

/** Mirrors server AiAskPlannerRouting — only present in `astro dev`. */
export interface AskPlannerRoutingView {
	requested: string;
	/** Planned OpenRouter queue (may include models never called). */
	queue?: string[];
	/** Models actually invoked, in order. */
	attempts: string[];
	skippedCooldown: string[];
	failed: Array<{ model: string; status?: number; message: string }>;
	used: string;
	provider: "openrouter" | "gemini";
	degraded: boolean;
	degradedReason?: string;
	reranker?: string;
}

const MODEL_STORAGE_KEY = "ai-mode-model";
const ASK_HOME_HREF = "/search?mode=ai";

/** Filled thumbtack — reads clearly at small sizes. */
const PIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>`;
const MORE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;

/** Provider status notes — not model reasoning. Hidden from “How it searched”. */
const ASK_REASONING_STATUS_LINE =
	/^\s*\((?:OpenRouter was busy|Rewritten with Gemini\.?|Results re-ranked with Gemini\.?)[^)]*\)\s*$/i;
/**
 * Schema field drafting (`queries: …`, `"lookingFor": …`) — instructions to
 * itself about the JSON shape, not reasoning for the reader. Prose that merely
 * starts with one of these words (“Queries should target…”) is kept.
 */
const ASK_REASONING_META_LINE =
	/^\s*[-*]?\s*"?(?:queries|fallbackQueries|correctedQuestion|displayQuestion|lookingFor|shareSlug|offTopic|personSlugs|rankingGuidance|usefulFallbackQueries|count|slugs|summary)"?\s*[:=]/i;
const ASK_REASONING_FORMAT_LINE =
	/^\s*(?:```|JSON\s*:?\s*$|Return JSON\b|Output JSON\b|\{|\}|\[|\])/i;

/**
 * Strip provider status and JSON/schema drafting. Keep the model’s actual
 * reasoning — readers found that the most useful part of the process.
 */
export function displayAskReasoning(
	raw: string | undefined,
	pending = false,
): string {
	const text = (raw || "").replace(/\r\n/g, "\n");
	if (!text.trim()) return "";
	const kept = text
		.split("\n")
		.filter((line) => {
			const trimmed = line.trim();
			if (!trimmed) return true;
			if (ASK_REASONING_STATUS_LINE.test(trimmed)) return false;
			if (ASK_REASONING_META_LINE.test(trimmed)) return false;
			if (ASK_REASONING_FORMAT_LINE.test(trimmed)) return false;
			return true;
		})
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	// While streaming, keep raw text so partial reasoning isn’t dropped mid-line.
	if (pending && !kept && text.trim()) return text.trim();
	return kept;
}

export type AskProcessStepState = "todo" | "active" | "done";

export interface AskProcessStep {
	state: AskProcessStepState;
	text: string;
}

/** Compact process steps for the Ask UI (pending + finished). */
export function buildAskProcessSteps(input: {
	pending: boolean;
	phase: "rewrite" | "search" | "rerank" | "done";
	question: string;
	lookingFor?: string;
	offTopic?: boolean;
	candidateCount?: number;
	showCount?: number;
	resultCount?: number;
}): AskProcessStep[] {
	const question = (input.question || "").replace(/\s+/g, " ").trim();
	const looking = (input.lookingFor || "")
		.replace(/^looking for:\s*/i, "")
		.replace(/\s+/g, " ")
		.trim();
	const lookingSame =
		looking.toLowerCase() === question.toLowerCase() || looking.length > 80;
	const theme = looking && !lookingSame ? looking : "";
	const pool = Math.max(0, Math.floor(input.candidateCount || 0));
	const shown = Math.max(
		0,
		Math.floor(
			input.pending
				? input.showCount || 0
				: input.resultCount || input.showCount || 0,
		),
	);
	const phase = input.pending ? input.phase : "done";

	if (input.offTopic && phase === "done") {
		return [
			{
				state: "done",
				text: theme
					? theme
					: "Outside the early discourses — no library search",
			},
		];
	}

	const understood: AskProcessStep =
		phase === "rewrite"
			? { state: "active", text: "Understanding the question…" }
			: {
					state: "done",
					text: theme ? `Understood · ${theme}` : "Understood the question",
				};

	const searched: AskProcessStep =
		phase === "rewrite"
			? { state: "todo", text: "Search the library" }
			: phase === "search"
				? { state: "active", text: "Searching the library…" }
				: {
						state: "done",
						text:
							pool > 0
								? `Searched the library · ${pool.toLocaleString()} discourses`
								: "Searched the library",
					};

	// Crunching (rescoring the pool) and showing (the final picks) are two
	// distinct moments. The strip carries the crunch; the “Showing N” caption
	// sits with the answer (see askResultsCaption).
	let crunched: AskProcessStep;
	if (phase === "rewrite" || phase === "search") {
		crunched = { state: "todo", text: "Crunch the candidates" };
	} else if (phase === "rerank") {
		crunched = {
			state: "active",
			text:
				pool > 0
					? `Crunching ${pool.toLocaleString()} discourses…`
					: "Crunching discourses…",
		};
	} else if (shown > 0) {
		crunched = {
			state: "done",
			text:
				pool > 0
					? `Crunched ${pool.toLocaleString()} discourses`
					: "Crunched the candidates",
		};
	} else {
		crunched = { state: "done", text: "No matching discourses" };
	}

	if (phase === "done") return [understood, searched, crunched];
	return [
		understood,
		searched,
		crunched,
		{ state: "todo", text: "Show the best matches" },
	];
}

/** Caption shown with the answer once results are in (“Showing 12 discourses”). */
export function askResultsCaption(input: {
	resultCount: number;
	candidateCount?: number;
}): string {
	const shown = Math.max(0, Math.floor(input.resultCount || 0));
	if (shown === 0) return "";
	const pool = Math.max(0, Math.floor(input.candidateCount || 0));
	const noun = `discourse${shown === 1 ? "" : "s"}`;
	return pool > shown
		? `Showing ${shown} ${noun} · picked from ${pool.toLocaleString()}`
		: `Showing ${shown} ${noun}`;
}

/** Compact DEV line: which planner models were actually called and which answered. */
export function formatAskRoutingDevHtml(
	routing: AskPlannerRoutingView | undefined,
): string {
	if (!routing) return "";
	const called = routing.attempts.length
		? routing.attempts.map(shortModelId).join(" → ")
		: "(none)";
	const skipped =
		routing.skippedCooldown.length > 0
			? ` · skipped ${routing.skippedCooldown.map(shortModelId).join(", ")}`
			: "";
	const failed =
		routing.failed.length > 0
			? ` · failed ${routing.failed
					.map((item) => {
						const id = shortModelId(item.model);
						if (item.status) return `${id} ${item.status}`;
						if (/unusable/i.test(item.message)) return `${id} unusable`;
						return id;
					})
					.join(", ")}`
			: "";
	const degraded = routing.degraded
		? ` · simplified${routing.degradedReason ? ` (${routing.degradedReason})` : ""}`
		: "";
	const rerank = routing.reranker
		? ` · rerank ${shortModelId(routing.reranker)}`
		: "";
	const text = `DEV · called ${called}${skipped}${failed} → planner ${shortModelId(routing.used)} (${routing.provider})${rerank}${degraded}`;
	return `<p class="ai-dev-routing" title="Planner routing (astro dev only)">${escapeHtml(text)}</p>`;
}

function shortModelId(id: string): string {
	const trimmed = (id || "").trim();
	if (!trimmed) return "?";
	// "nvidia/nemotron-3-ultra…:free + gemini-rerank" → keep readable tail
	return trimmed
		.split(" + ")
		.map((part) => {
			const bare = part.replace(/:free$/i, "");
			const slash = bare.lastIndexOf("/");
			return slash >= 0 ? bare.slice(slash + 1) : bare;
		})
		.join(" + ");
}

function processStepsHtml(
	steps: readonly AskProcessStep[],
	options: { afterFirst?: string; footer?: string } = {},
): string {
	if (steps.length === 0) return "";
	const items = steps
		.map((step, index) => {
			const mark =
				step.state === "done" ? "✓" : step.state === "active" ? "●" : "○";
			const row = `<li class="is-${step.state}"><span class="ai-process-mark" aria-hidden="true">${mark}</span><span>${escapeHtml(step.text)}</span></li>`;
			return index === 0 && options.afterFirst
				? `${row}${options.afterFirst}`
				: row;
		})
		.join("");
	const footer = options.footer
		? `<li class="ai-process-dev">${options.footer}</li>`
		: "";
	return `<ol class="ai-process" aria-label="How this Ask worked">${items}${footer}</ol>`;
}

/** Approximate count of visual lines a reasoning block would need. */
export function askReasoningIsLong(text: string, lineLimit = 6): boolean {
	const lines = text.split("\n");
	if (lines.length > lineLimit) return true;
	return text.length > lineLimit * 110;
}

function inlineThinkingHtml(escaped: string): string {
	return escaped
		.replace(/`([^`\n]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
		.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
}

/**
 * Light, safe renderer for model thinking: paragraphs, bullet / numbered
 * lists, `code`, **bold**, *italic*, and `### headings` as bold lines. Text is
 * escaped first; no raw HTML from the model ever reaches the page.
 */
export function renderAskThinkingHtml(text: string): string {
	const normalized = text.replace(/\r\n/g, "\n").trim();
	if (!normalized) return "";
	const blocks = normalized.split(/\n{2,}/);
	const out: string[] = [];
	for (const block of blocks) {
		const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
		if (lines.length === 0) continue;
		const bullet = lines.every((line) => /^[-*•]\s+/.test(line));
		const numbered = lines.every((line) => /^\d+[.)]\s+/.test(line));
		if (bullet || numbered) {
			const items = lines
				.map((line) => line.replace(bullet ? /^[-*•]\s+/ : /^\d+[.)]\s+/, ""))
				.map((line) => `<li>${inlineThinkingHtml(escapeHtml(line))}</li>`)
				.join("");
			out.push(bullet ? `<ul>${items}</ul>` : `<ol>${items}</ol>`);
			continue;
		}
		const rendered = lines
			.map((line) => {
				const heading = line.match(/^#{1,6}\s+(.*)$/);
				if (heading) {
					return `<strong>${inlineThinkingHtml(escapeHtml(heading[1] || ""))}</strong>`;
				}
				return inlineThinkingHtml(escapeHtml(line));
			})
			.join("<br>");
		out.push(`<p>${rendered}</p>`);
	}
	return out.join("");
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

function normalizeAskRouting(raw: unknown): AskPlannerRoutingView | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const requested =
		typeof record.requested === "string" ? record.requested.trim() : "";
	const used = typeof record.used === "string" ? record.used.trim() : "";
	if (!requested && !used) return undefined;
	const attempts = Array.isArray(record.attempts)
		? record.attempts.filter((item): item is string => typeof item === "string")
		: [];
	const skippedCooldown = Array.isArray(record.skippedCooldown)
		? record.skippedCooldown.filter(
				(item): item is string => typeof item === "string",
			)
		: [];
	const failed = Array.isArray(record.failed)
		? record.failed
				.map((item) => {
					if (!item || typeof item !== "object") return null;
					const row = item as Record<string, unknown>;
					if (typeof row.model !== "string" || !row.model.trim()) return null;
					return {
						model: row.model.trim(),
						...(typeof row.status === "number" ? { status: row.status } : {}),
						message:
							typeof row.message === "string" ? row.message : "error",
					};
				})
				.filter(
					(item): item is AskPlannerRoutingView["failed"][number] =>
						Boolean(item),
				)
		: [];
	const queue = Array.isArray(record.queue)
		? record.queue.filter((item): item is string => typeof item === "string")
		: undefined;
	const reranker =
		typeof record.reranker === "string" && record.reranker.trim()
			? record.reranker.trim()
			: undefined;
	const degradedReason =
		typeof record.degradedReason === "string" && record.degradedReason.trim()
			? record.degradedReason.trim()
			: undefined;
	return {
		requested,
		...(queue ? { queue } : {}),
		attempts,
		skippedCooldown,
		failed,
		used,
		provider: record.provider === "gemini" ? "gemini" : "openrouter",
		degraded: record.degraded === true,
		...(degradedReason ? { degradedReason } : {}),
		...(reranker ? { reranker } : {}),
	};
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

function turnToSessionEntry(
	turn: AiAskTurn,
	options?: { thread?: AiAskSessionEntry[] },
): AiAskSessionEntry {
	const thread =
		options?.thread && options.thread.length > 1
			? options.thread
			: undefined;
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
		...(turn.persons && turn.persons.length > 0
			? { persons: turn.persons }
			: {}),
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
		...(typeof turn.rerankCandidateCount === "number" &&
		turn.rerankCandidateCount > 0
			? { candidateCount: turn.rerankCandidateCount }
			: {}),
		...(thread ? { thread } : {}),
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
		persons: sanitizeAskPersonHits(entry.persons),
		model: entry.model || "",
		reasoning: entry.reasoning || "",
		summary: entry.summary || "",
		shareSlug: entry.shareSlug,
		sharePath: entry.shareSlug ? askSharePath(entry.shareSlug) : undefined,
		pending: false,
		phase: "done",
		...(typeof entry.candidateCount === "number" && entry.candidateCount > 0
			? {
					rerankCandidateCount: entry.candidateCount,
					rerankShowCount: entry.results?.length || undefined,
				}
			: {}),
		fromCache: true,
		requestId: entry.requestId,
		feedback: entry.feedback === "up" || entry.feedback === "down"
			? entry.feedback
			: undefined,
		saved: entry.saved === true,
	};
}

function shareTurnToAiAskTurn(
	turn: AiAskShareTurn,
	share: AiAskShareSnapshot,
): AiAskTurn {
	return {
		question: turn.question,
		originalQuestion: turn.question,
		lookingFor: turn.lookingFor,
		queries: turn.queries,
		fallbackQueries: turn.fallbackQueries,
		offTopic: false,
		results: turn.results,
		model: turn.model,
		reasoning: "",
		summary: turn.summary,
		shareSlug: share.slug,
		sharePath: askSharePath(share.slug),
		fromShare: true,
		pending: false,
		phase: "done",
		requestId: turn.requestId,
		...(typeof turn.candidateCount === "number" && turn.candidateCount > 0
			? {
					rerankCandidateCount: turn.candidateCount,
					rerankShowCount: turn.results.length,
				}
			: {}),
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

	/** Conversation snapshot up to this turn (for pin/history restore). */
	function threadSnapshotForTurn(turn: AiAskTurn): AiAskSessionEntry[] {
		const index = turns.indexOf(turn);
		const slice = index >= 0 ? turns.slice(0, index + 1) : [turn];
		return slice
			.filter(
				(item) =>
					!item.pending &&
					!item.error &&
					!item.offTopic &&
					item.results.length > 0,
			)
			.map((item) => turnToSessionEntry(item));
	}

	function openHistoryEntry(entry: AiAskSessionEntry): void {
		const restored = askHistoryEntriesForRestore(entry);
		if (restored.length === 0) return;
		turns = restored.map((item, index) => {
			const turn = sessionEntryToTurn(item);
			// Multi-turn restore is a conversation resume, not a silent cache hit.
			turn.fromCache = restored.length === 1;
			// Keep the pin state from the history row that was opened.
			if (index === restored.length - 1 && entry.saved) {
				turn.saved = true;
			}
			return turn;
		});
		persistActiveThread();
		syncLayout();
	}

	function persistSessionFromTurn(turn: AiAskTurn): void {
		if (turn.pending || turn.error || turn.offTopic) return;
		// Empty answers are not worth replaying — they hide real retries.
		if (turn.results.length === 0) return;

		const completedBefore = turns.filter(
			(item) =>
				item !== turn &&
				!item.pending &&
				!item.error &&
				!item.offTopic &&
				item.results.length > 0,
		);
		// If this conversation was already pinned, extend the pin onto the new
		// tip so follow-ups stay restorable as one thread.
		const extendPin = completedBefore.some((item) => item.saved === true);
		if (extendPin) {
			for (const item of turns) item.saved = false;
			turn.saved = true;
		} else if (!turn.saved && completedBefore.length === 0) {
			// Re-asking the same solo topic shouldn’t clear a favorite.
			const prior =
				findAiAskSessionEntry(sessionEntries, turn.question) ||
				findAiAskSessionEntry(
					sessionEntries,
					turn.originalQuestion || "",
				);
			if (prior?.saved) turn.saved = true;
		}

		const thread = threadSnapshotForTurn(turn);
		const entry = turnToSessionEntry(turn, { thread });
		const replaceQuestions = [
			...(pendingReplaceQuestions || []),
			...(extendPin
				? completedBefore.flatMap((item) =>
						[item.question, item.originalQuestion || ""].filter(Boolean),
					)
				: []),
		];
		pendingReplaceQuestions = null;
		if (replaceQuestions.length > 0) {
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
				...(replaceQuestions.length > 0 ? { replaceQuestions } : {}),
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
		// Pin keeps the whole open conversation, not only the turn whose pin was clicked.
		const completed = turns.filter(
			(item) =>
				!item.pending &&
				!item.error &&
				!item.offTopic &&
				item.results.length > 0,
		);
		const thread =
			completed.length > 1
				? completed.map((item) => turnToSessionEntry(item))
				: threadSnapshotForTurn(turn);
		const entry = turnToSessionEntry(turn, { thread });
		// Drop shorter/stale rows for earlier turns in this conversation.
		const replaceQuestions = completed
			.filter((item) => item !== turn)
			.flatMap((item) =>
				[item.question, item.originalQuestion || ""].filter(Boolean),
			);
		if (replaceQuestions.length > 0) {
			sessionEntries = removeAskHistoryEntriesByQuestions(
				sessionEntries,
				replaceQuestions,
			);
		}
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, entry);
		writeAiAskSession(sessionEntries);
		persistActiveThread();
		renderHistory();
		void fetch("/api/ai/history", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entry,
				...(replaceQuestions.length > 0 ? { replaceQuestions } : {}),
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

	function toggleSaveTurn(turn: AiAskTurn): void {
		if (turn.pending || turn.error || turn.results.length === 0) return;
		if (!signedInForHistory) {
			openQuotaDialog("save");
			return;
		}
		const pinIndex = latestPinnableTurnIndex();
		const target =
			pinIndex >= 0 && turns[pinIndex] ? turns[pinIndex] : turn;
		if (
			target.pending ||
			target.error ||
			target.offTopic ||
			target.results.length === 0
		) {
			return;
		}
		const nextSaved = !target.saved;
		// One pin for the whole thread — keep the flag only on the final turn.
		for (const item of turns) {
			item.saved = false;
		}
		target.saved = nextSaved;
		persistSaveState(target);
		syncLayout();
	}

	function entryQuestionKeys(entry: AiAskSessionEntry): string[] {
		return [entry.question, entry.originalQuestion || ""].filter(Boolean);
	}

	function openThreadMatchesQuestions(questions: readonly string[]): boolean {
		const tipIndex = latestPinnableTurnIndex();
		const tip = tipIndex >= 0 ? turns[tipIndex] : undefined;
		if (!tip) return false;
		const tipKeys = [
			normalizeAskQuestionKey(tip.question),
			normalizeAskQuestionKey(tip.originalQuestion || ""),
		].filter(Boolean);
		return questions.some((question) => {
			const key = normalizeAskQuestionKey(question);
			return key.length > 0 && tipKeys.includes(key);
		});
	}

	async function deleteHistoryQuestions(
		questions: readonly string[],
		options?: { clearOpenThread?: boolean },
	): Promise<void> {
		const keys = questions.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean);
		if (keys.length === 0) return;
		const clearOpen =
			options?.clearOpenThread === true || openThreadMatchesQuestions(keys);
		sessionEntries = removeAskHistoryEntriesByQuestions(sessionEntries, keys);
		writeAiAskSession(sessionEntries);
		if (clearOpen) {
			turns = [];
			clearActiveAskThread();
			setStatus("");
		}
		renderHistory();
		syncLayout();
		if (!signedInForHistory) return;
		try {
			const response = await fetch("/api/ai/history", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "delete", questions: keys }),
			});
			if (response.status === 401) {
				signedInForHistory = false;
				return;
			}
			const data = (await response.json()) as {
				success?: boolean;
				entries?: AiAskSessionEntry[];
			};
			if (response.ok && data.success && Array.isArray(data.entries)) {
				sessionEntries = data.entries;
				writeAiAskSession(sessionEntries);
				renderHistory();
			}
		} catch {
			/* local delete already applied */
		}
	}

	function deleteHistoryEntry(entry: AiAskSessionEntry): void {
		if (
			!window.confirm(
				"Delete this Ask from Recent Asks? This cannot be undone.",
			)
		) {
			return;
		}
		void deleteHistoryQuestions(entryQuestionKeys(entry));
	}

	function deleteOpenAskTurn(turn: AiAskTurn): void {
		if (turn.fromShare || turn.pending || turn.error) return;
		if (
			!window.confirm(
				"Delete this Ask from Recent Asks? This cannot be undone.",
			)
		) {
			return;
		}
		void deleteHistoryQuestions(
			[turn.question, turn.originalQuestion || ""].filter(Boolean),
			{ clearOpenThread: true },
		);
	}

	function toggleHistoryEntryPin(entry: AiAskSessionEntry): void {
		if (!signedInForHistory) {
			openQuotaDialog("save");
			return;
		}
		const next = { ...entry, saved: !entry.saved };
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, next);
		writeAiAskSession(sessionEntries);
		// Keep open-thread pin marker in sync when this card is the open tip.
		if (openThreadMatchesQuestions(entryQuestionKeys(entry))) {
			const tipIndex = latestPinnableTurnIndex();
			for (let i = 0; i < turns.length; i++) {
				const item = turns[i];
				if (!item) continue;
				item.saved = i === tipIndex ? next.saved === true : false;
			}
		}
		renderHistory();
		syncLayout();
		void fetch("/api/ai/history", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ entry: next }),
		})
			.then(async (response) => {
				if (response.status === 401) {
					signedInForHistory = false;
					return;
				}
				if (response.ok) signedInForHistory = true;
			})
			.catch(() => {
				/* best-effort */
			});
	}

	async function shareHistoryEntry(
		entry: AiAskSessionEntry,
		button: HTMLButtonElement,
	): Promise<void> {
		if (entry.results.length === 0) return;
		const previous = button.textContent || "Share link";
		button.disabled = true;
		button.textContent = "Sharing…";
		const thread =
			entry.thread && entry.thread.length > 1
				? entry.thread.map((item) => ({
						question: item.question,
						lookingFor: item.lookingFor,
						queries: item.queries,
						fallbackQueries: item.fallbackQueries,
						summary: item.summary || "",
						results: item.results,
						model: item.model,
						...(item.requestId ? { requestId: item.requestId } : {}),
						...(typeof item.candidateCount === "number" &&
						item.candidateCount > 0
							? { candidateCount: item.candidateCount }
							: {}),
					}))
				: undefined;
		try {
			const response = await fetch("/api/ai/share", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: entry.question,
					lookingFor: entry.lookingFor,
					queries: entry.queries,
					fallbackQueries: entry.fallbackQueries,
					summary: entry.summary || "",
					results: entry.results,
					model: entry.model,
					requestId: entry.requestId,
					shareSlug: entry.shareSlug,
					...(thread ? { thread } : {}),
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				path?: string;
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
			const url = new URL(data.path, window.location.origin).toString();
			await navigator.clipboard.writeText(url);
			button.textContent = "Link copied";
			window.setTimeout(() => {
				button.disabled = false;
				button.textContent = previous;
			}, 1600);
		} catch {
			button.textContent = "Could not share";
			window.setTimeout(() => {
				button.disabled = false;
				button.textContent = previous;
			}, 1800);
		}
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
			// Pin state is only meaningful on the conversation tip.
			const pinIndex = latestPinnableTurnIndex();
			for (let i = 0; i < turns.length; i++) {
				const item = turns[i];
				if (!item) continue;
				if (i !== pinIndex) {
					item.saved = false;
					continue;
				}
				const match =
					findAiAskSessionEntry(sessionEntries, item.question) ||
					findAiAskSessionEntry(
						sessionEntries,
						item.originalQuestion || "",
					);
				item.saved = match?.saved === true;
			}
			renderHistory();
			if (turns.length > 0) syncLayout();
		} catch {
			/* keep local history */
		}
	}

	function renderPersonHit(person: AiAskPersonHit): string {
		const title = escapeHtml(person.title);
		const description = person.description
			? `<p class="ai-person-desc">${escapeHtml(stripHtml(person.description))}</p>`
			: "";
		const more =
			person.discourseCount > person.sampleIds.length
				? ` · +${person.discourseCount - person.sampleIds.length} more`
				: "";
		const samples =
			person.sampleIds.length > 0
				? `<p class="ai-person-ids">${escapeHtml(
						`${person.sampleIds.join(" · ")}${more}`,
					)}</p>`
				: person.discourseCount > 0
					? `<p class="ai-person-ids">${escapeHtml(
							`${person.discourseCount} discourse${
								person.discourseCount === 1 ? "" : "s"
							}`,
						)}</p>`
					: "";
		return `<div data-result-type="person">
			<a href="${escapeHtml(person.href)}" class="ai-person-card search-discourse-card block no-underline text-inherit" data-search-result>
				<div class="ai-person-card-inner">
					<div class="ai-person-kicker">
						<span class="ai-person-badge">Person</span>
					</div>
					<h2 class="ai-person-title">${title}</h2>
					${description}
					${samples}
				</div>
			</a>
		</div>`;
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

	function latestPinnableTurnIndex(): number {
		for (let i = turns.length - 1; i >= 0; i--) {
			const turn = turns[i];
			if (
				turn &&
				!turn.pending &&
				!turn.error &&
				!turn.offTopic &&
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
		const pinIndex = latestPinnableTurnIndex();
		const showPin = turnIndex === pinIndex;
		const conversation = turns.length > 1;
		// Only the current tip counts — an earlier pin must not look pinned after
		// a new follow-up until that fuller thread is saved on this tip.
		const pinned = showPin && turn.saved === true;
		const pinTitle = pinned
			? conversation
				? "Unpin — allow this conversation to drop off with older ones"
				: "Unpin — allow this Ask to drop off with older ones"
			: signedInForHistory
				? conversation
					? "Pin this conversation so the whole thread stays in Recent Asks"
					: "Pin so it stays when older Asks drop off"
				: "Create an account to pin Asks";
		const pinLabel = pinned
			? conversation
				? "Pinned conversation"
				: "Pinned"
			: conversation
				? "Pin conversation"
				: "Pin this Ask";
		const pinBtn = showPin
			? `<button type="button" class="ai-share-btn ai-pin-btn${pinned ? " is-pinned" : ""}" data-ai-pin data-turn-index="${turnIndex}" aria-pressed="${pinned ? "true" : "false"}" title="${pinTitle}" aria-label="${pinTitle}">
				${PIN_ICON_SVG}<span>${pinLabel}</span>
			</button>`
			: "";
		const deleteBtn =
			showPin && !turn.fromShare
				? `<button type="button" class="ai-delete-link" data-ai-delete-turn data-turn-index="${turnIndex}">Delete</button>`
				: "";
		return `<div class="ai-share-actions">
			${pinBtn}
			${deleteBtn}
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

	function shareThreadPayload(upToIndex: number): AiAskShareTurn[] {
		return turns
			.slice(0, Math.max(0, upToIndex) + 1)
			.filter(
				(item) =>
					!item.pending &&
					!item.error &&
					!item.offTopic &&
					item.results.length > 0,
			)
			.map((item) => ({
				question: item.question,
				lookingFor: item.lookingFor,
				queries: item.queries,
				fallbackQueries: item.fallbackQueries,
				summary: item.summary || "",
				results: item.results,
				model: item.model,
				...(item.requestId ? { requestId: item.requestId } : {}),
				...(typeof item.rerankCandidateCount === "number" &&
				item.rerankCandidateCount > 0
					? { candidateCount: item.rerankCandidateCount }
					: {}),
			}));
	}

	async function copyShareLink(
		turn: AiAskTurn,
		button: HTMLButtonElement,
		turnIndex: number,
	): Promise<void> {
		if (turn.results.length === 0) return;
		const previous = button.textContent || "Share link";
		button.disabled = true;
		const index =
			Number.isFinite(turnIndex) && turnIndex >= 0
				? turnIndex
				: turns.indexOf(turn);
		const thread = shareThreadPayload(index >= 0 ? index : turns.length - 1);
		// Already published (e.g. viewing a share page): no need to re-publish.
		// Exception: if this local thread is longer than a bare single-turn share,
		// re-publish so the public page can upgrade to the full conversation.
		if (turn.sharePath && turn.fromShare && thread.length <= 1) {
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
					...(thread.length > 1 ? { thread } : {}),
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
		const cacheNote = turn.fromCache
			? `<p class="ai-cache-note" title="You asked this before, so the saved answer is shown again.">Saved answer from an earlier Ask</p>`
			: "";
		// Reasoning streams live under “Understood”; once finished it stays there,
		// clamped to a few lines with a toggle so the answer isn’t pushed down.
		const reasoningText = displayAskReasoning(turn.reasoning, turn.pending);
		const plannerNote = turn.plannerNote
			? `<p class="ai-process-thinking-note">${escapeHtml(turn.plannerNote)}</p>`
			: "";
		let thinking = "";
		if (reasoningText) {
			const clampable =
				!turn.pending && !turn.reasoningExpanded && askReasoningIsLong(reasoningText);
			const toggle =
				!turn.pending && askReasoningIsLong(reasoningText)
					? `<button type="button" class="ai-process-thinking-toggle" data-ai-toggle-thinking data-turn-index="${turnIndex}" aria-expanded="${turn.reasoningExpanded ? "true" : "false"}">${turn.reasoningExpanded ? "Show less" : "Show all thinking"}</button>`
					: "";
			thinking = `<li class="ai-process-thinking${turn.pending ? " is-live" : ""}${clampable ? " is-clamped" : ""}" aria-label="Model thinking">
				<span class="ai-process-mark" aria-hidden="true"></span>
				<div class="ai-process-thinking-body">
					${plannerNote}
					<div class="ai-process-thinking-text">${renderAskThinkingHtml(reasoningText)}</div>
					${toggle}
				</div>
			</li>`;
		} else if (plannerNote || (!turn.pending && turn.degraded)) {
			const degradedNote =
				!turn.pending && turn.degraded
					? `<p>Simplified search plan — the model’s rewrite JSON was missing or its query chips were unusable, so short topical searches were built from your question instead.</p>`
					: "";
			thinking = `<li class="ai-process-thinking" aria-label="Model notes">
				<span class="ai-process-mark" aria-hidden="true"></span>
				<div class="ai-process-thinking-body">${plannerNote}${degradedNote}</div>
			</li>`;
		}
		const process = processStepsHtml(
			buildAskProcessSteps({
				pending: turn.pending,
				phase: turn.phase,
				question: turn.question,
				lookingFor: turn.lookingFor,
				offTopic: turn.offTopic,
				candidateCount: turn.rerankCandidateCount,
				showCount: turn.rerankShowCount,
				resultCount: turn.results.length,
			}),
			{
				afterFirst: thinking,
				footer: formatAskRoutingDevHtml(turn.routing),
			},
		);
		const summaryText = (turn.summary || "").trim();
		const summary =
			!turn.pending && summaryText && turn.results.length > 0
				? `<div class="ai-summary">${linkifyAskSummaryHtml(
						summaryText,
						turn.results,
					)}</div>`
				: !turn.pending && turn.rankedBySearchOnly && turn.results.length > 0
					? `<p class="ai-result-meta">Ranked by library search only — the rescorer was unavailable, so there is no briefing this time.</p>`
					: "";
		const caption =
			!turn.pending && turn.results.length > 0
				? `<p class="ai-results-caption">${escapeHtml(
						askResultsCaption({
							resultCount: turn.results.length,
							candidateCount: turn.rerankCandidateCount,
						}),
					)}</p>`
				: "";
		const hideQueryChips =
			turn.pending || turn.offTopic || turn.results.length === 0;
		const queryBlock = hideQueryChips ? "" : primaryQueries;
		const fallbackBlock = hideQueryChips ? "" : fallbackQueries;
		let body = "";
		if (turn.error) {
			const retry =
				!turn.fromShare && turnIndex === turns.length - 1
					? `<div class="ai-error-actions">
						<button type="button" class="ai-error-retry" data-ai-edit-question data-turn-index="${turnIndex}">
							Try again
						</button>
					</div>`
					: "";
			// Keep the process strip + any streamed thinking so a timeout or
			// refusal stall is still inspectable after the error lands.
			body = `${process}<p class="ai-error">${escapeHtml(turn.error)}</p>${retry}`;
		} else if (turn.pending) {
			body = `${process}
				<div class="ai-loading" role="status">
					<span class="ai-spinner"></span>
					<span class="sr-only">Working on your Ask</span>
				</div>
				${turn.phase === "search" || turn.phase === "rerank" || !reasoningText ? skeletonHtml() : ""}`;
		} else {
			const personHits = (turn.persons || [])
				.map(renderPersonHit)
				.join("");
			const personBlock = personHits
				? `<div class="ai-persons">${personHits}</div>`
				: "";
			const hits =
				turn.results.length > 0
					? `<div class="ai-hits">${turn.results.map(renderHit).join("")}</div>`
					: personBlock
						? ""
						: emptyHitsHtml(turn);
			body = `${cacheNote}${process}${summary}${queryBlock}${fallbackBlock}${personBlock}${caption}${hits}${shareActionsHtml(turn, turnIndex)}${feedbackHtml(turn, turnIndex)}`;
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
		// Failed turns stay editable so the reader can fix wording or retry.
		// Shared snapshots themselves stay fixed; follow-ups on a share page stay editable.
		const canEdit =
			!turn.fromShare &&
			!turn.pending &&
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

	const HISTORY_PREVIEW_LIMIT = 6;
	let historyExpanded = false;

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
		const hiddenCount = Math.max(0, ordered.length - HISTORY_PREVIEW_LIMIT);
		const visible =
			historyExpanded || hiddenCount === 0
				? ordered
				: ordered.slice(0, HISTORY_PREVIEW_LIMIT);
		const items = visible
			.map((entry) => {
				const when = formatAskRelativeTime(entry.at);
				const threadCount = entry.thread?.length || 0;
				const pinned = entry.saved
					? `<span class="ai-history-pin" title="${threadCount > 1 ? "Pinned conversation" : "Pinned"}" aria-label="${threadCount > 1 ? "Pinned conversation" : "Pinned"}">${PIN_ICON_SVG}</span>`
					: "";
				const resultIds = entry.results
					.slice(0, 6)
					.map((hit) => transformId(hit.slug))
					.filter(Boolean)
					.join(" · ");
				const resultsRow = resultIds
					? `<span class="ai-history-results">${escapeHtml(resultIds)}</span>`
					: "";
				const threadRow =
					threadCount > 1
						? `<span class="ai-history-thread">${threadCount} turns in this conversation</span>`
						: "";
				const rootQuestion =
					threadCount > 1 && entry.thread?.[0]?.question
						? entry.thread[0].question
						: "";
				const rootRow =
					rootQuestion &&
					normalizeAskQuestionKey(rootQuestion) !==
						normalizeAskQuestionKey(entry.question)
						? `<span class="ai-history-root">Started with: ${escapeHtml(rootQuestion)}</span>`
						: "";
				const q = escapeHtml(entry.question);
				const pinAction = entry.saved ? "Unpin" : "Pin";
				return `<div class="ai-history-card${entry.saved ? " is-pinned" : ""}">
						<button type="button" class="ai-history-item" data-ai-history-q="${q}">
							<span class="ai-history-top">
								<span class="ai-history-q">${q}</span>
								<span class="ai-history-meta">${pinned}${when ? `<span class="ai-history-when">${escapeHtml(when)}</span>` : ""}</span>
							</span>
							${rootRow}
							${threadRow}
							${resultsRow}
						</button>
						<div class="ai-history-menu">
							<button type="button" class="ai-history-menu-btn" data-ai-history-menu-toggle data-ai-history-q="${q}" aria-label="Ask options" aria-expanded="false" title="Ask options">
								${MORE_ICON_SVG}
							</button>
							<div class="ai-history-menu-panel" hidden role="menu">
								<button type="button" role="menuitem" data-ai-history-pin data-ai-history-q="${q}">${pinAction}</button>
								<button type="button" role="menuitem" data-ai-history-share data-ai-history-q="${q}">Share link</button>
								<button type="button" role="menuitem" class="is-danger" data-ai-history-delete data-ai-history-q="${q}">Delete</button>
							</div>
						</div>
					</div>`;
			})
			.join("");
		const moreRow =
			hiddenCount > 0
				? historyExpanded
					? `<button type="button" class="ai-history-more" data-ai-history-more>Show fewer</button>`
					: `<button type="button" class="ai-history-more" data-ai-history-more>More · ${hiddenCount} older</button>`
				: "";
		historyEl.innerHTML = `<div class="ai-history-heading">
			<p class="ai-history-label">Recent Asks</p>
			<p class="ai-history-hint">Older ones drop off · pin to keep</p>
		</div><div class="ai-history-list">${items}</div>${moreRow}`;
		historyEl.hidden = false;

		historyEl
			.querySelector<HTMLButtonElement>("[data-ai-history-more]")
			?.addEventListener("click", () => {
				historyExpanded = !historyExpanded;
				renderHistory();
			});

		const closeAllMenus = (): void => {
			historyEl.querySelectorAll<HTMLElement>(".ai-history-menu-panel").forEach(
				(panel) => {
					panel.hidden = true;
				},
			);
			historyEl
				.querySelectorAll<HTMLButtonElement>("[data-ai-history-menu-toggle]")
				.forEach((toggle) => {
					toggle.setAttribute("aria-expanded", "false");
				});
		};

		historyEl.querySelectorAll<HTMLButtonElement>("[data-ai-history-q]").forEach(
			(button) => {
				if (!button.classList.contains("ai-history-item")) return;
				button.addEventListener("click", () => {
					const question = button.getAttribute("data-ai-history-q") || "";
					const entry = findAiAskSessionEntry(sessionEntries, question);
					if (!entry) return;
					openHistoryEntry(entry);
				});
			},
		);
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-menu-toggle]")
			.forEach((toggle) => {
				toggle.addEventListener("click", (event) => {
					event.stopPropagation();
					const menu = toggle.closest(".ai-history-menu");
					const panel = menu?.querySelector<HTMLElement>(".ai-history-menu-panel");
					if (!panel) return;
					const willOpen = panel.hidden;
					closeAllMenus();
					if (willOpen) {
						panel.hidden = false;
						toggle.setAttribute("aria-expanded", "true");
					}
				});
			});
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-pin]")
			.forEach((button) => {
				button.addEventListener("click", (event) => {
					event.stopPropagation();
					const question = button.getAttribute("data-ai-history-q") || "";
					const entry = findAiAskSessionEntry(sessionEntries, question);
					closeAllMenus();
					if (entry) toggleHistoryEntryPin(entry);
				});
			});
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-share]")
			.forEach((button) => {
				button.addEventListener("click", (event) => {
					event.stopPropagation();
					const question = button.getAttribute("data-ai-history-q") || "";
					const entry = findAiAskSessionEntry(sessionEntries, question);
					if (entry) void shareHistoryEntry(entry, button);
				});
			});
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-delete]")
			.forEach((button) => {
				button.addEventListener("click", (event) => {
					event.stopPropagation();
					const question = button.getAttribute("data-ai-history-q") || "";
					const entry = findAiAskSessionEntry(sessionEntries, question);
					closeAllMenus();
					if (entry) deleteHistoryEntry(entry);
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
				if (turn) void copyShareLink(turn, button, index);
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-pin]").forEach((button) => {
			button.addEventListener("click", () => {
				const index = Number(button.getAttribute("data-turn-index"));
				const turn = turns[index];
				if (turn) toggleSaveTurn(turn);
			});
		});
		thread
			.querySelectorAll<HTMLButtonElement>("[data-ai-delete-turn]")
			.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					const turn = turns[index];
					if (turn) deleteOpenAskTurn(turn);
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
		thread
			.querySelectorAll<HTMLButtonElement>("[data-ai-toggle-thinking]")
			.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					const turn = turns[index];
					if (!turn) return;
					turn.reasoningExpanded = !turn.reasoningExpanded;
					syncLayout();
				});
			});
		if (!shareMode) renderHistory();
	}

	function beginEditQuestion(turnIndex: number): void {
		if (busy) return;
		const turn = turns[turnIndex];
		if (!turn || turn.pending || turn.fromShare || turnIndex !== turns.length - 1) {
			return;
		}
		const row = thread.querySelectorAll(".ai-question-row")[turnIndex];
		if (!row) return;
		const existing = row.querySelector(".ai-question-edit");
		if (existing) return;
		row.querySelectorAll("[data-ai-edit-question]").forEach((el) => el.remove());
		row.querySelector(".ai-question")?.remove();
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
			persons: [],
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
						...(item.summary
							? { summary: item.summary.replace(/\s+/g, " ").trim().slice(0, 800) }
							: {}),
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
					if (
						typeof event.candidateCount === "number" &&
						Number.isFinite(event.candidateCount) &&
						event.candidateCount > 0
					) {
						turn.rerankCandidateCount = Math.floor(event.candidateCount);
					}
					if (
						typeof event.showCount === "number" &&
						Number.isFinite(event.showCount) &&
						event.showCount > 0
					) {
						turn.rerankShowCount = Math.floor(event.showCount);
					}
					syncLayoutAndReveal();
				} else if (event.type === "plan") {
					applyCorrectedQuestion(turn, event);
					turn.plannerNote =
						typeof event.plannerNote === "string" && event.plannerNote.trim()
							? event.plannerNote.trim()
							: undefined;
					turn.routing = normalizeAskRouting(event.routing);
					if (turn.routing) {
						console.info(
							"[ai/ask] planner routing",
							turn.routing,
						);
					}
					turn.lookingFor = event.lookingFor || "";
					turn.queries = event.queries || [];
					turn.fallbackQueries = event.fallbackQueries || [];
					turn.offTopic = event.offTopic === true;
					turn.degraded = event.degraded === true;
					turn.persons = sanitizeAskPersonHits(event.persons);
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
					turn.persons = sanitizeAskPersonHits(event.persons);
					turn.results = event.results || [];
					turn.rankedBySearchOnly =
						event.reranked === false && turn.results.length > 0;
					if (
						typeof event.candidateCount === "number" &&
						Number.isFinite(event.candidateCount) &&
						event.candidateCount > 0
					) {
						turn.rerankCandidateCount = Math.floor(event.candidateCount);
					}
					if (
						typeof event.showCount === "number" &&
						Number.isFinite(event.showCount) &&
						event.showCount > 0
					) {
						turn.rerankShowCount = Math.floor(event.showCount);
					} else if (turn.results.length > 0) {
						turn.rerankShowCount = turn.results.length;
					}
					turn.model = event.model || turn.model;
					const resultRouting = normalizeAskRouting(event.routing);
					if (resultRouting) {
						turn.routing = resultRouting;
						console.info("[ai/ask] final routing", resultRouting);
					}
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
		// Seed the thread with the shared snapshot (full prefix when present).
		turns = askShareTurnsForRestore(share).map((turn) =>
			shareTurnToAiAskTurn(turn, share),
		);
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
		openHistoryEntry(entry);
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
