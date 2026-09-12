import type { AiAskPersonHit } from "./aiAskPersons";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	attachResearchToHistoryThread,
	type AiAskSessionEntry,
} from "./aiAskSession";
import type {
	ResearchAskPhase,
	ResearchJobPublic,
} from "./aiAskResearchJob";

export {
	researchHistoryStatsLabel,
	type ResearchHistoryReportStats,
} from "./aiAskResearchHistoryStats";

export const RESEARCH_CHIP_STORAGE_KEY = "ai-mode-research";
export const RESEARCH_PLACEHOLDER =
	"Ask for a cited report based on the Words of the Buddha…";
export const ASK_PLACEHOLDER = "Ask a question about the discourses…";
export const ASK_COMPOSER_LABEL = "Ask a question";
export const RESEARCH_COMPOSER_LABEL = "Ask for a cited report";
export const ASK_WAITING_PLACEHOLDER = "Waiting for an answer…";
export const ASK_FOLLOW_PLACEHOLDER = "Follow up in this conversation";
export const RESEARCH_FOLLOW_PLACEHOLDER = "Follow up with a wider search";
export const ASK_LIMITS_NOTE = "Experimental AI search · limited free Asks";
export const RESEARCH_LIMITS_NOTE =
	"Experimental AI research";
export const ASK_HISTORY_LABEL = "Recent Asks";
export const RESEARCH_HISTORY_LABEL = "Recent reports";
export const ASK_HISTORY_ARIA = "Ask history";
export const RESEARCH_HISTORY_ARIA = "Research history";
export const ASK_OPTIONS_ARIA = "Ask options";
export const RESEARCH_OPTIONS_ARIA = "Research options";
export const ASK_HISTORY_HINT_RECENT = "Older ones drop off · pin to keep";
export const ASK_HISTORY_HINT_PINNED = "Stay until you unpin";
export const ASK_DELETE_CONFIRM =
	"Delete this Ask from Recent Asks? This cannot be undone.";
export const RESEARCH_DELETE_CONFIRM =
	"Delete this report from Recent reports? This cannot be undone.";
export const RESEARCH_SIGNIN_EMPTY_NOTE =
	"Create an account or sign in to run Research.";
export const RESEARCH_SIGNIN_TITLE = "Run Research";
export const RESEARCH_SIGNIN_BODY =
	"Perform a deep search of the Words of the Buddha and get a cited report. Create a free account to get started with Research.";
export const RESEARCH_INVITE_AFTER_ASK =
	"Looking for a wider search and a cited report based on the Words of the Buddha? Try Research.";
export const RESEARCH_PIN_ACCOUNT_TITLE = "Create an account to pin this report";
export const RESEARCH_PIN_ACCOUNT_BODY =
	"Recent research reports are temporary. Pinning keeps a report at hand when older ones drop off.";
export const ASK_PIN_ACCOUNT_TITLE = "Create an account to pin Asks";
export const ASK_PIN_ACCOUNT_BODY =
	"Recent Asks are temporary. Pinning keeps a question at hand when older ones drop off.";
export const RESEARCH_SHARE_ACCOUNT_TITLE =
	"Create an account to share this report";
export const RESEARCH_SHARE_ACCOUNT_BODY =
	"Sharing publishes a public link to this report. Create a free account to copy a link you can send.";
export const ASK_SHARE_ACCOUNT_TITLE = "Create an account to share this Ask";
export const ASK_SHARE_ACCOUNT_BODY =
	"Sharing publishes a public link to this Ask. Create a free account to copy a link you can send.";
export const RESEARCH_PIN_ACTION = "Pin this report";
export const RESEARCH_UNPIN_ACTION = "Unpin this report";
export const RESEARCH_DELETE_ACTION = "Delete this report";

/** Pin / Share / Delete on an open Ask or Research turn. */
export function openAskTurnActionFlags(input: {
	pending?: boolean;
	error?: string;
	fromShare?: boolean;
	fromSample?: boolean;
	isTip: boolean;
	research?: boolean;
	researchJobId?: string;
	resultCount: number;
	hasReport?: boolean;
	isPinnableTip?: boolean;
}): {
	showPin: boolean;
	showDelete: boolean;
	showShare: boolean;
	showDownload: boolean;
} {
	const pending = input.pending === true;
	const error = Boolean((input.error || "").trim());
	const fromShare = input.fromShare === true;
	const fromSample = input.fromSample === true;
	const hasHits = input.resultCount > 0;
	const jobId = (input.researchJobId || "").trim();
	const showPin = !pending && !error && input.isPinnableTip === true;
	// Research jobs are keyed by id — empty / failed reports still need Delete.
	const showDelete =
		!pending &&
		!fromShare &&
		!fromSample &&
		input.isTip &&
		((input.research === true && Boolean(jobId)) ||
			input.isPinnableTip === true);
	const showShare =
		!pending &&
		!error &&
		input.isTip &&
		(hasHits || input.hasReport === true);
	const showDownload =
		!pending &&
		!error &&
		input.isTip &&
		input.research === true &&
		(hasHits || input.hasReport === true);
	return { showPin, showDelete, showShare, showDownload };
}

/** Overflow menu on a Recent card. Signed-in only gates sample hide/share. */
export function askHistoryCardMenuFlags(input: {
	sample?: boolean;
	signedInForHistory?: boolean;
}): { showPin: boolean; showShare: boolean; showDelete: boolean } {
	const sample = input.sample === true;
	const signedIn = input.signedInForHistory === true;
	return {
		showPin: signedIn,
		showShare: !sample || signedIn,
		showDelete: !sample || signedIn,
	};
}
export const ASK_NEW_LABEL = "+ New Ask";
export const RESEARCH_NEW_LABEL = "+ New Research";
export const REVIEW_ROOM_ASK_NEW_LABEL = "+ Ask";
export const REVIEW_ROOM_REPORT_NEW_LABEL = "+ Research";
export const REVIEW_ROOM_ASK_EMPTY = "No asks yet.";
export const REVIEW_ROOM_REPORT_EMPTY = "No research reports yet.";
/** First lines of a report in Review Room — not discourse ID chips. */
export const RESEARCH_HISTORY_EXCERPT_MAX = 180;

export function researchHistoryExcerpt(
	report?: string | null,
	max = RESEARCH_HISTORY_EXCERPT_MAX,
): string {
	const text = (report || "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_~`>#]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!text) return "";
	if (text.length <= max) return text;
	const sliced = text.slice(0, max);
	const clipped = sliced.replace(/\s+\S*$/, "").trim();
	return clipped || sliced.trim();
}

/** Fallback prompts for tests and docs. The Research pane chips come from saved samples. */
export const RESEARCH_EXAMPLES = [
	"Survey how the discourses describe mindfulness of the body",
	"Which suttas treat the five aggregates in depth?",
	"How do the early discourses talk about death and rebirth?",
] as const;

/** Follow-up copy only after the current question has an answer. */
export function askFollowPlaceholder(input: {
	pending: boolean;
	researchFollow?: boolean;
}): string {
	if (input.pending) return ASK_WAITING_PLACEHOLDER;
	return input.researchFollow
		? RESEARCH_FOLLOW_PLACEHOLDER
		: ASK_FOLLOW_PLACEHOLDER;
}
export const RESEARCH_CHIP_TITLE =
	"A few questions first, then a cited report based on the Words of the Buddha. We’ll email you when it’s ready.";
export const RESEARCH_EMAIL_PENDING_NOTE =
	"We’ll email you when this is ready. Feel free to leave.";

function envFlag(name: string): string {
	const meta = (
		import.meta as ImportMeta & { env?: Record<string, string | undefined> }
	).env;
	const fromProcess =
		typeof process !== "undefined" ? process.env[name] : undefined;
	return (fromProcess || meta?.[name] || "").trim();
}

/**
 * Off by default. Enable when shipping the clarify-then-report Research loop.
 */
export function isAskResearchEnabled(): boolean {
	const flag = envFlag("PUBLIC_AI_RESEARCH").toLowerCase();
	return flag === "1" || flag === "true";
}

export interface ResearchTurnFields {
	question: string;
	originalQuestion?: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	results: AiDiscourseHit[];
	persons?: AiAskPersonHit[];
	model: string;
	reasoning: string;
	summary?: string;
	report?: string;
	shareSlug?: string;
	pending: boolean;
	phase: ResearchAskPhase;
	rerankCandidateCount?: number;
	rerankShowCount?: number;
	error?: string;
	requestId?: string;
	research?: boolean;
	researchJobId?: string;
	/** When the research was started — history recency. */
	researchStartedAt?: number;
	verifyNote?: string;
	onTrack?: boolean;
	progressNote?: string;
	processNotes?: string[];
}

/**
 * Whether the composer meter should show Research credits.
 * A finished research turn does not count — follow-ups are ordinary Asks
 * unless the chip is on again, questions are open, or a job is in flight.
 */
export function askComposerMeterIsResearch(input: {
	chipOn: boolean;
	clarifying?: boolean;
	researchPending?: boolean;
}): boolean {
	return Boolean(input.chipOn || input.clarifying || input.researchPending);
}

export function askMeterLabel(input: {
	signedIn: boolean;
	needsEmailVerification?: boolean;
	researchOn: boolean;
	askRemaining: number;
	researchRemaining?: number;
	hideResearchRemaining?: boolean;
}): string {
	if (!input.signedIn) return "";
	if (input.needsEmailVerification) {
		const n = Math.max(0, Math.floor(input.askRemaining));
		const unit = n === 1 ? "Ask" : "Asks";
		return `${n} ${unit} left today · verify email for more`;
	}
	if (input.hideResearchRemaining) return "";
	if (input.researchOn && typeof input.researchRemaining === "number") {
		const n = Math.max(0, Math.floor(input.researchRemaining));
		const unit = n === 1 ? "research report" : "research reports";
		return `${n} ${unit} available today`;
	}
	const n = Math.max(0, Math.floor(input.askRemaining));
	const unit = n === 1 ? "Ask" : "Asks";
	return `${n} ${unit} left today`;
}

export function canShowResearchChip(input: {
	signedIn?: boolean;
	needsEmailVerification?: boolean;
	hasResearchQuota: boolean;
}): boolean {
	if (!isAskResearchEnabled()) return false;
	return Boolean(
		input.signedIn &&
			!input.needsEmailVerification &&
			input.hasResearchQuota,
	);
}

export function shouldUseResearchAsk(input: {
	chipOn: boolean;
	followUp: boolean;
	lastTurnResearch: boolean;
	retryIncompleteResearch?: boolean;
	forceAsk?: boolean;
}): boolean {
	if (input.forceAsk) return false;
	if (input.retryIncompleteResearch) return true;
	return input.chipOn === true;
}

/** A research turn that never produced a report — retry should stay Research. */
export function isIncompleteResearchTurn(turn: {
	research?: boolean;
	pending?: boolean;
	report?: string;
	researchClarify?: unknown;
	researchDeclined?: unknown;
}): boolean {
	if (!turn.research || turn.pending) return false;
	if (turn.researchClarify || turn.researchDeclined) return false;
	return !(turn.report || "").trim();
}

export function researchRetrySubmitLabel(research: boolean): string {
	return research ? "Research again" : "Ask again";
}

export function researchEditAskInsteadLabel(): string {
	return "Ask instead";
}

export function sameResearchRetryQuestion(
	next: string,
	turn: { question?: string; originalQuestion?: string },
): boolean {
	const clip = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
	const q = clip(next);
	if (!q) return false;
	return q === clip(turn.question || "") || q === clip(turn.originalQuestion || "");
}

export function researchVerifyStepText(input: {
	phase: ResearchAskPhase;
	verifyNote?: string;
	onTrack?: boolean;
}): { state: "todo" | "active" | "done"; text: string } {
	if (input.phase === "rewrite") {
		return { state: "todo", text: "Check first hits" };
	}
	if (input.phase === "verify") {
		return { state: "active", text: "Checking first hits…" };
	}
	const note = (input.verifyNote || "").replace(/\s+/g, " ").trim();
	if (note) return { state: "done", text: note };
	if (input.onTrack === false) {
		return { state: "done", text: "Adjusted searches" };
	}
	if (input.onTrack === true) {
		return { state: "done", text: "On track" };
	}
	return { state: "done", text: "Checked first hits" };
}

export function applyResearchJobToTurn<T extends ResearchTurnFields>(
	turn: T,
	job: ResearchJobPublic,
): T {
	turn.research = true;
	turn.researchJobId = job.id;
	if (job.createdAt && job.createdAt > 0) {
		turn.researchStartedAt = job.createdAt;
	}
	const result = job.result;
	if (result?.question) turn.question = result.question;
	else if (job.question) turn.question = job.question;
	if (result?.originalQuestion) {
		turn.originalQuestion = result.originalQuestion;
	}
	turn.lookingFor = job.lookingFor || result?.lookingFor || turn.lookingFor;
	turn.queries = job.queries.length > 0 ? job.queries : result?.queries || turn.queries;
	turn.fallbackQueries =
		job.fallbackQueries.length > 0
			? job.fallbackQueries
			: result?.fallbackQueries || turn.fallbackQueries;
	turn.offTopic = job.offTopic || result?.offTopic === true;
	turn.verifyNote = job.verifyNote;
	turn.onTrack = job.onTrack;
	turn.reasoning = job.reasoning || result?.reasoning || turn.reasoning;
	turn.pending = job.pending;
	turn.phase = job.phase;
	turn.progressNote = job.progressNote || "";
	turn.processNotes = job.processNotes || [];
	if (typeof job.candidateCount === "number" && job.candidateCount > 0) {
		turn.rerankCandidateCount = job.candidateCount;
	}
	if (typeof job.showCount === "number" && job.showCount > 0) {
		turn.rerankShowCount = job.showCount;
	}
	if (result) {
		turn.results = result.results;
		turn.persons = result.persons;
		turn.summary = result.summary || "";
		if (result.report) turn.report = result.report;
		if (result.shareSlug) turn.shareSlug = result.shareSlug;
		if (result.model) turn.model = result.model;
		if (result.requestId) turn.requestId = result.requestId;
		if (result.reasoning) turn.reasoning = result.reasoning;
	}
	if (job.status === "failed") {
		turn.pending = false;
		turn.phase = "done";
		turn.error = job.error || "Research could not finish. Try again shortly.";
	} else if (job.status === "cancelled") {
		turn.pending = false;
		turn.phase = "done";
		turn.error = job.error || "Research stopped.";
	} else {
		turn.error = undefined;
	}
	return turn;
}

/** History recency is when they asked — not when a long job later finished. */
export function researchHistoryTimestamp(input: {
	existingAt?: number;
	createdAt?: number;
	now?: number;
}): number {
	const existing =
		typeof input.existingAt === "number" &&
		Number.isFinite(input.existingAt) &&
		input.existingAt > 0
			? Math.round(input.existingAt)
			: 0;
	const created =
		typeof input.createdAt === "number" &&
		Number.isFinite(input.createdAt) &&
		input.createdAt > 0
			? Math.round(input.createdAt)
			: 0;
	if (existing > 0 && created > 0) return Math.min(existing, created);
	if (existing > 0) return existing;
	if (created > 0) return created;
	return input.now ?? Date.now();
}

const ASK_COPY_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>`;

const ASK_BUTTON_FEEDBACK_LABEL_SELECTOR =
	".ai-answer-copy-label, .ai-share-label-full, .ai-share-label-short";

export const ASK_CLIPBOARD_COPIED_LABEL = "Copied";
export const ASK_CLIPBOARD_FAILED_LABEL = "Could not copy";
export const ASK_SHARE_COPIED_LABEL = "Link copied";
export const ASK_SHARE_FAILED_LABEL = "Could not share";
export const ASK_CLIPBOARD_COPIED_MS = 1600;
export const ASK_CLIPBOARD_FAILED_MS = 1800;

export type AskButtonIdleState = {
	html: string;
	ariaLabel: string | null;
	title: string | null;
};

export type AskButtonFeedbackKind = "copied" | "error" | "busy";

export function readAskButtonIdle(
	button: HTMLButtonElement,
): AskButtonIdleState {
	return {
		html: button.innerHTML,
		ariaLabel: button.getAttribute("aria-label"),
		title: button.getAttribute("title"),
	};
}

function askButtonFeedbackLabels(button: HTMLButtonElement): HTMLElement[] {
	return [
		...button.querySelectorAll<HTMLElement>(ASK_BUTTON_FEEDBACK_LABEL_SELECTOR),
	];
}

/** Swap a Copy/Share control to a status word without rebuilding the thread. */
export function applyAskButtonFeedback(
	button: HTMLButtonElement,
	message: string,
	kind: AskButtonFeedbackKind,
): void {
	button.disabled = true;
	const labels = askButtonFeedbackLabels(button);
	if (labels.length > 0) {
		for (const label of labels) {
			label.textContent = message;
			label.hidden = false;
			label.removeAttribute("hidden");
		}
	} else {
		button.textContent = message;
	}
	button.setAttribute("aria-label", message);
	button.setAttribute("title", message);
	button.classList.toggle("is-copied", kind === "copied");
	button.classList.toggle("is-copy-error", kind === "error");
}

export function restoreAskButtonIdle(
	button: HTMLButtonElement,
	idle: AskButtonIdleState,
): void {
	button.disabled = false;
	button.innerHTML = idle.html;
	button.classList.remove("is-copied", "is-copy-error");
	if (idle.ariaLabel) button.setAttribute("aria-label", idle.ariaLabel);
	else button.removeAttribute("aria-label");
	if (idle.title) button.setAttribute("title", idle.title);
	else button.removeAttribute("title");
}

export function flashAskButtonFeedback(
	button: HTMLButtonElement,
	message: string,
	kind: Exclude<AskButtonFeedbackKind, "busy">,
	idle: AskButtonIdleState = readAskButtonIdle(button),
	schedule: (fn: () => void, ms: number) => void = (fn, ms) => {
		window.setTimeout(fn, ms);
	},
): void {
	applyAskButtonFeedback(button, message, kind);
	schedule(
		() => restoreAskButtonIdle(button, idle),
		kind === "copied" ? ASK_CLIPBOARD_COPIED_MS : ASK_CLIPBOARD_FAILED_MS,
	);
}

export function askAnswerCopyButtonHtml(input: {
	turnIndex: number;
	kind: "report" | "answer";
	placement: "start" | "end";
}): string {
	const noun = input.kind === "report" ? "report" : "answer";
	const title =
		input.kind === "report" ? "Copy report as Markdown" : "Copy answer";
	const showLabel = input.placement === "end";
	return `<button type="button" class="ai-answer-copy" data-ai-copy-answer data-copy-kind="${input.kind}" data-copy-placement="${input.placement}" data-turn-index="${input.turnIndex}" title="${title}" aria-label="Copy ${noun}">
		${ASK_COPY_ICON_SVG}<span class="ai-answer-copy-label"${showLabel ? "" : " hidden"}>Copy</span>
	</button>`;
}

export function wrapAskAnswerHtml(input: {
	kind: "report" | "answer";
	bodyHtml: string;
	turnIndex: number;
	kicker?: string;
}): string {
	const className =
		input.kind === "report" ? "ai-answer ai-report" : "ai-answer ai-summary";
	const start =
		input.kicker
			? `<div class="ai-answer-toolbar ai-answer-toolbar-start">
			<p class="ai-report-kicker">${input.kicker}</p>
			${askAnswerCopyButtonHtml({ turnIndex: input.turnIndex, kind: input.kind, placement: "start" })}
		</div>`
			: "";
	return `<div class="${className}">
		${start}
		<div class="ai-answer-body">${input.bodyHtml}</div>
		<div class="ai-answer-toolbar ai-answer-toolbar-end">
			${askAnswerCopyButtonHtml({ turnIndex: input.turnIndex, kind: input.kind, placement: "end" })}
		</div>
	</div>`;
}

export function researchJobToHistoryEntry(
	job: ResearchJobPublic,
	existing?: { at?: number; thread?: AiAskSessionEntry[] },
): AiAskSessionEntry {
	const result = job.result;
	const entry: AiAskSessionEntry = {
		question: result?.question || job.question,
		...(result?.originalQuestion && result.originalQuestion !== job.question
			? { originalQuestion: result.originalQuestion }
			: {}),
		lookingFor: job.lookingFor || result?.lookingFor || "",
		queries: job.queries.length > 0 ? job.queries : result?.queries || [],
		fallbackQueries:
			job.fallbackQueries.length > 0
				? job.fallbackQueries
				: result?.fallbackQueries || [],
		offTopic: job.offTopic || result?.offTopic === true,
		results: result?.results || [],
		...(result?.persons && result.persons.length > 0
			? { persons: result.persons }
			: {}),
		model: result?.model || "",
		reasoning: job.reasoning || result?.reasoning || "",
		...(result?.summary ? { summary: result.summary } : {}),
		...(result?.report ? { report: result.report } : {}),
		at: researchHistoryTimestamp({
			existingAt: existing?.at,
			createdAt: job.createdAt,
		}),
		research: true,
		researchJobId: job.id,
		...(job.processNotes && job.processNotes.length > 0
			? { processNotes: job.processNotes }
			: {}),
		...(job.pending ? { researchPending: true } : {}),
		...(typeof job.candidateCount === "number" && job.candidateCount > 0
			? { candidateCount: job.candidateCount }
			: result?.candidateCount
				? { candidateCount: result.candidateCount }
				: {}),
	};
	return attachResearchToHistoryThread(entry, existing);
}
