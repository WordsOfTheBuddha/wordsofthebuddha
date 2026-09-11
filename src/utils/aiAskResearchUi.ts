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

export const RESEARCH_CHIP_STORAGE_KEY = "ai-mode-research";
export const RESEARCH_PLACEHOLDER =
	"Ask for a wider briefing from the discourses…";
export const ASK_PLACEHOLDER = "Ask a question about the discourses…";
export const ASK_WAITING_PLACEHOLDER = "Waiting for an answer…";
export const ASK_FOLLOW_PLACEHOLDER = "Follow up in this conversation";
export const RESEARCH_FOLLOW_PLACEHOLDER = "Follow up with a wider search";

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
	"A few questions first, then a longer cited report. 2 per day. We’ll email you when it’s ready.";
export const RESEARCH_EMAIL_PENDING_NOTE =
	"We’ll email you when this is ready. Feel free to leave.";

export const RESEARCH_EXAMPLES = [
	"Survey how the discourses describe mindfulness of the body",
	"Which suttas treat the five aggregates in depth?",
	"How do the early discourses talk about death and rebirth?",
] as const;

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
		const unit = n === 1 ? "research" : "researches";
		return `${n} ${unit} left today`;
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
