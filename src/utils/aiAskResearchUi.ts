import type { AiAskPersonHit } from "./aiAskPersons";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import type { AiAskSessionEntry } from "./aiAskSession";
import type {
	ResearchAskPhase,
	ResearchJobPublic,
} from "./aiAskResearchJob";

export const RESEARCH_CHIP_STORAGE_KEY = "ai-mode-research";
export const RESEARCH_PLACEHOLDER =
	"Ask for a wider briefing from the discourses…";
export const ASK_PLACEHOLDER = "Ask a question about the discourses…";
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
	verifyNote?: string;
	onTrack?: boolean;
	progressNote?: string;
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
}): boolean {
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

export function researchJobToHistoryEntry(job: ResearchJobPublic): AiAskSessionEntry {
	const result = job.result;
	return {
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
		at: Date.now(),
		research: true,
		researchJobId: job.id,
		...(job.pending ? { researchPending: true } : {}),
		...(typeof job.candidateCount === "number" && job.candidateCount > 0
			? { candidateCount: job.candidateCount }
			: result?.candidateCount
				? { candidateCount: result.candidateCount }
				: {}),
	};
}
