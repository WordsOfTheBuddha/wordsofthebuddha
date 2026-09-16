import type { AiAskPersonHit } from "./aiAskPersons";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	attachResearchToHistoryThread,
	type AiAskSessionEntry,
} from "./aiAskSession";
import {
	clipResearchProcessNotes,
	type ResearchAskPhase,
	type ResearchJobPublic,
} from "./aiAskResearchJob";
import {
	clipResearchVersionIndex,
	currentResearchVersionN,
	healedResearchVersionIndex,
	type ResearchReviseClarify,
	type ResearchVersionMeta,
} from "./aiAskResearchRevise";
import { suggestedClarifyAnswers } from "./aiAskResearchClarify";
import { askSharePath } from "./aiAskShare";
import { REPORT_PARAGRAPH_SELECTOR } from "./paragraphNumbers";

export {
	researchHistoryCardStatsLabel,
	researchHistoryStatsLabel,
	type ResearchHistoryReportStats,
} from "./aiAskResearchHistoryStats";

export const RESEARCH_CHIP_STORAGE_KEY = "ai-mode-research";
export const REVISE_MULTI_HINT_STORAGE_KEY = "ai-mode-revise-multi-hint";
export const REVISE_COMPOSER_DRAFT_STORAGE_KEY = "ai-mode-revise-composer-draft";
export const RESEARCH_PLACEHOLDER =
	"Ask for a cited report based on the Words of the Buddha…";
export const RESEARCH_SIGNED_OUT_PLACEHOLDER =
	"Create an account or Sign in to start a research";
export const ASK_PLACEHOLDER = "Ask a question about the discourses…";
export const ASK_COMPOSER_LABEL = "Ask a question";
export const RESEARCH_COMPOSER_LABEL = "Ask for a cited report";
export const ASK_WAITING_PLACEHOLDER = "Waiting for an answer…";
export const ASK_FOLLOW_PLACEHOLDER = "Follow up in this conversation";
export const RESEARCH_FOLLOW_PLACEHOLDER = "Follow up with a wider search";
export const RESEARCH_REVISE_PLACEHOLDER = "Revise this report";
export const RESEARCH_REVISE_SELECTION_PLACEHOLDER = "What should change here?";
export const RESEARCH_ASK_WITHOUT_EDITING = "Ask a follow-up instead";
export const RESEARCH_REVISE_INSTEAD = "Revise this report instead";
export const RESEARCH_REVISE_CLEAR = "Clear";
export const RESEARCH_REVISE_REMOVE_EDIT = "Remove edit";
export const RESEARCH_REVISE_MULTI_HINT =
	"When you add another selection, it starts a new edit below.";
export const RESEARCH_REVISE_EDITS_CAP = "Max 6 edits at a time.";
export const RESEARCH_REVISE_REPORT = "Revise report";
export const RESEARCH_VERSIONS_ACTION = "Versions";
export const RESEARCH_RESTORE_ACTION = "Restore as current";
export const RESEARCH_REVISE_FROM_ACTION = "Revise from this version";
export const RESEARCH_REVISE_ACCOUNT_TITLE =
	"Revise this report";
export const RESEARCH_REVISE_ACCOUNT_BODY =
	"Revising updates this report in place and uses one Ask. Create a free account to continue.";
export const ASK_LIMITS_NOTE =
	"Freely offered · sustained by dāna";
export const RESEARCH_LIMITS_NOTE = ASK_LIMITS_NOTE;

/** Menu-screen donor note under Search / Ask / Research. */
export function askSponsorNoteVisible(input: {
	askSurface: boolean;
	research?: boolean;
	signedIn?: boolean;
	hasThread?: boolean;
	shareMode?: boolean;
	restoring?: boolean;
}): boolean {
	if (
		!input.askSurface ||
		input.hasThread ||
		input.shareMode ||
		input.restoring
	) {
		return false;
	}
	return true;
}

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
	"Create an account to generate your own";
export const RESEARCH_SIGNIN_TITLE = "Run Research";
export const RESEARCH_SIGNIN_BODY =
	"Perform a deep search of the Words of the Buddha and get a cited report. Create a free account to get started with Research.";
export const SEARCH_TERMS_SOURCING_LABEL = "Search queries used for sourcing:";

/** Primary planner queries first, then fallbacks; trim and dedupe case-insensitively. */
export function dedupeSourcingSearchTerms(
	queries: readonly string[],
	fallbackQueries: readonly string[] = [],
): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of [...queries, ...fallbackQueries]) {
		const query = raw.trim();
		if (!query) continue;
		const key = query.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(query);
	}
	return out;
}

export const RESEARCH_INVITE_AFTER_ASK =
	"Looking for a wider search and a cited report? Try Research";
export const RESEARCH_PIN_ACCOUNT_TITLE = "Pin this report";
export const RESEARCH_PIN_ACCOUNT_BODY =
	"Recent research reports are temporary. Pinning keeps a report at hand when older ones drop off.";
export const ASK_PIN_ACCOUNT_TITLE = "Pin Asks";
export const ASK_PIN_ACCOUNT_BODY =
	"Recent Asks are temporary. Pinning keeps a question at hand when older ones drop off.";
export const RESEARCH_SHARE_ACCOUNT_TITLE =
	"Share this report";
export const RESEARCH_SHARE_ACCOUNT_BODY =
	"Sharing publishes a public link to this report. Create a free account to copy a link you can send.";
export const ASK_SHARE_ACCOUNT_TITLE = "Share this Ask";
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

/** Overflow menu on a Recent card. Pin / sample Delete stay signed-in. */
export function askHistoryCardMenuFlags(input: {
	sample?: boolean;
	signedInForHistory?: boolean;
}): { showPin: boolean; showShare: boolean; showDelete: boolean } {
	const sample = input.sample === true;
	const signedIn = input.signedInForHistory === true;
	return {
		showPin: signedIn,
		showShare: true,
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
	reviseFollow?: boolean;
}): string {
	if (input.pending) return ASK_WAITING_PLACEHOLDER;
	if (input.researchFollow) return RESEARCH_FOLLOW_PLACEHOLDER;
	if (input.reviseFollow) return RESEARCH_REVISE_PLACEHOLDER;
	return ASK_FOLLOW_PLACEHOLDER;
}

/** On a finished report, the meta toggle switches Revise ↔ Ask follow-up. */
export function reportFollowToggleLabel(askMode: boolean): string {
	return askMode ? RESEARCH_REVISE_INSTEAD : RESEARCH_ASK_WITHOUT_EDITING;
}

/** Finished report + chip off → Revise (Ask credit), not a new Research hop. */
export function shouldReviseResearchFollow(input: {
	lastTurnResearch: boolean;
	lastTurnPending: boolean;
	hasReport: boolean;
	researchChipOn: boolean;
	forceAsk?: boolean;
}): boolean {
	if (input.forceAsk || input.researchChipOn || input.lastTurnPending) {
		return false;
	}
	return input.lastTurnResearch && input.hasReport;
}

/** Compact revise dock stays one row until the reader opens or focuses it. */
export function followComposerShouldExpand(input: {
	focused: boolean;
	pinnedOpen?: boolean;
}): boolean {
	return input.pinnedOpen || input.focused;
}

/** Pause/stop should cancel without expanding the compact dock. */
export function followComposerFocusShouldExpand(
	activeElement: Element | null,
): boolean {
	if (!activeElement) return false;
	return !activeElement.closest("[data-ai-stop], .ai-send-stop");
}

/** Clicks on the composer shell expand it; action buttons are excluded. */
export function followComposerClickShouldExpand(target: Element | null): boolean {
	if (!target?.closest(".ai-box")) return false;
	return !target.closest(
		"[data-ai-stop], .ai-send-stop, [data-ai-mic], [data-ai-research-chip], .ai-revise-clear, .ai-revise-row-remove, .ai-revise-row-instruction",
	);
}

/** Report-dock chrome after a research turn (including while a revise is pending). */
export function isResearchReviseInProgress(input: {
	research?: boolean;
	pending?: boolean;
	hasReport?: boolean;
}): boolean {
	return Boolean(input.research && input.pending && input.hasReport);
}

/** Planner questions on a paused revision, plus the reader's draft answers. */
export interface ResearchReviseClarifyDraft extends ResearchReviseClarify {
	answers: Record<string, { choiceId: string; otherText?: string }>;
}

/** The revision is parked on the planner's questions (report unchanged). */
export function isResearchReviseClarifying(input: {
	research?: boolean;
	pending?: boolean;
	reviseClarify?: ResearchReviseClarifyDraft | null;
}): boolean {
	return Boolean(input.research && input.pending && input.reviseClarify);
}

/**
 * Carry the reader's draft answers across polls: the same question set keeps
 * what they picked; a new set (or none) starts from the planner's suggestions.
 */
export function nextReviseClarifyDraft(
	previous: ResearchReviseClarifyDraft | undefined,
	incoming: ResearchReviseClarify | undefined,
): ResearchReviseClarifyDraft | undefined {
	if (!incoming) return undefined;
	if (previous && previous.id === incoming.id) {
		return { ...incoming, answers: previous.answers };
	}
	return { ...incoming, answers: suggestedClarifyAnswers(incoming.questions) };
}

/**
 * Rendered element for a revise block id (`p12`, `h3`, `c1`, `t2`) inside a
 * report body, so a clarify choice can point at the block it names. Numbered
 * paragraphs come from the `¶` decoration; other kinds count in document order.
 */
export function findReportBlockElement(
	body: ParentNode,
	blockId: string,
): HTMLElement | null {
	const match = /^([phtc])(\d{1,4})$/i.exec(blockId.trim());
	if (!match) return null;
	const kind = match[1].toLowerCase();
	const n = Number(match[2]);
	if (!Number.isFinite(n) || n < 1) return null;
	if (kind === "p") {
		const decorated = body.querySelector<HTMLElement>(
			`[data-paragraph-number="${n}"]`,
		);
		if (decorated) return decorated;
		return body.querySelectorAll<HTMLElement>(REPORT_PARAGRAPH_SELECTOR)[n - 1] || null;
	}
	const selector =
		kind === "h"
			? ":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6"
			: kind === "c"
				? ":scope > pre, :scope > .mermaid, :scope > [data-mermaid], :scope > .ai-report-diagram, :scope > .ai-report-mermaid, :scope > .ai-report-code, :scope > .ai-report-html"
				: ":scope > table, :scope > hr, :scope > .ai-report-table-wrap, :scope > .ai-report-html";
	return body.querySelectorAll<HTMLElement>(selector)[n - 1] || null;
}

/** Keep a body-docked follow bar flush when mobile chrome shrinks the visual viewport. */
export function followDockBottomInset(input: {
	innerHeight: number;
	visualViewport?: Pick<VisualViewport, "height" | "offsetTop"> | null;
}): number {
	const vv = input.visualViewport;
	if (!vv) return 0;
	return Math.max(0, Math.round(input.innerHeight - vv.height - vv.offsetTop));
}

/** Finished Ask sample threads use the compact follow dock. */
export function askSampleFollowDock(
	turns: readonly {
		fromSample?: boolean;
		research?: boolean;
	}[],
): boolean {
	if (turns.length === 0) return false;
	return turns.every(
		(turn) => turn.fromSample === true && turn.research !== true,
	);
}

export function researchReportFollowChrome(input: {
	research: boolean;
	pending: boolean;
	hasReport: boolean;
	clarifying?: boolean;
	declinedOpen?: boolean;
	expanded?: boolean;
}): {
	reportDock: boolean;
	revisingReport: boolean;
	followCompact: boolean;
} {
	const revisingReport = isResearchReviseInProgress(input);
	const reportDock = Boolean(
		input.research &&
			input.hasReport &&
			(!input.pending || revisingReport) &&
			!input.clarifying &&
			!input.declinedOpen,
	);
	return {
		reportDock,
		revisingReport,
		followCompact: reportDock && !input.expanded,
	};
}

/** Empty Research home: signed-out readers cannot start a report. */
export function researchEmptyComposerGated(input: {
	researchPane: boolean;
	hasThread: boolean;
	quotaReady: boolean;
	signedIn: boolean;
}): boolean {
	return (
		input.researchPane &&
		!input.hasThread &&
		(!input.quotaReady || !input.signedIn)
	);
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
	sharePath?: string;
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
	versionIndex?: ResearchVersionMeta[];
	reviseClarify?: ResearchReviseClarifyDraft;
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

/** Merge authoritative version metadata from a job poll without replacing the report. */
export function mergeResearchJobVersionMetadata<
	T extends {
		versionIndex?: ResearchVersionMeta[];
		processNotes?: string[];
		researchStartedAt?: number;
	},
>(target: T, job: Pick<ResearchJobPublic, "versionIndex" | "processNotes" | "createdAt">): boolean {
	const jobIndex = clipResearchVersionIndex(job.versionIndex);
	const localIndex = clipResearchVersionIndex(target.versionIndex);
	const jobN = jobIndex.length > 0 ? currentResearchVersionN(jobIndex) : 0;
	const localN = localIndex.length > 0 ? currentResearchVersionN(localIndex) : 0;
	const jobNotes = clipResearchProcessNotes(job.processNotes);
	const localNotes = clipResearchProcessNotes(target.processNotes);
	const takeIndex =
		jobIndex.length > 0 && (jobN > localN || jobIndex.length > localIndex.length);
	const takeNotes = jobNotes.length > localNotes.length;
	if (!takeIndex && !takeNotes) return false;
	const processNotes = takeNotes ? jobNotes : target.processNotes;
	if (takeIndex) {
		target.versionIndex = healedResearchVersionIndex({
			versionIndex: jobIndex,
			processNotes,
			createdAt: job.createdAt ?? target.researchStartedAt,
		});
	}
	if (takeNotes) {
		target.processNotes = jobNotes;
	}
	return true;
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
	turn.reviseClarify = nextReviseClarifyDraft(turn.reviseClarify, job.reviseClarify);
	mergeResearchJobVersionMetadata(turn, job);
	if (!turn.versionIndex?.length) {
		turn.versionIndex = healedResearchVersionIndex({
			processNotes: turn.processNotes,
			createdAt: turn.researchStartedAt,
		});
	}
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
		if (result.shareSlug) {
			turn.shareSlug = result.shareSlug;
			turn.sharePath = askSharePath(result.shareSlug, { research: true });
		}
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
	} else if (
		job.status === "complete" &&
		typeof job.error === "string" &&
		job.error.trim()
	) {
		// A revise that failed after returning to `complete` (empty patch, too long).
		turn.pending = false;
		turn.phase = "done";
		turn.error = job.error.trim();
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

const ASK_COPY_CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="16" height="16" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;

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

function applyAskCopyTickFeedback(
	button: HTMLButtonElement,
	message: string,
): void {
	button.disabled = true;
	const icon = button.querySelector("svg");
	if (icon) icon.outerHTML = ASK_COPY_CHECK_SVG;
	button.setAttribute("aria-label", message);
	button.setAttribute("title", message);
	button.classList.add("is-copied");
	button.classList.remove("is-copy-error");
}

/** Swap a Copy/Share control to a status word without rebuilding the thread. */
export function applyAskButtonFeedback(
	button: HTMLButtonElement,
	message: string,
	kind: AskButtonFeedbackKind,
): void {
	if (kind === "copied" && button.classList.contains("ai-answer-copy")) {
		applyAskCopyTickFeedback(button, message);
		return;
	}
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

export const REPORT_PARAGRAPH_SHOW_TITLE = "Show paragraph numbering";
export const REPORT_PARAGRAPH_HIDE_TITLE = "Hide paragraph numbering";

export function reportParagraphToggleHtml(): string {
	return `<button type="button" class="ai-paragraph-btn" data-ai-report-paragraphs title="${REPORT_PARAGRAPH_SHOW_TITLE}" aria-label="${REPORT_PARAGRAPH_SHOW_TITLE}" aria-pressed="false"><span class="ai-paragraph-glyph" aria-hidden="true">¶</span></button>`;
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
	versionStart?: string;
	stats?: string;
}): string {
	const className =
		input.kind === "report" ? "ai-answer ai-report" : "ai-answer ai-summary";
	const stats = input.stats
		? `<p class="ai-report-stats">${input.stats}</p>`
		: "";
	const showStart = Boolean(
		input.kicker || input.versionStart || input.stats,
	);
	const start = showStart
		? `<div class="ai-answer-toolbar ai-answer-toolbar-start">
			${input.kicker ? `<p class="ai-report-kicker">${input.kicker}</p>` : ""}
			<div class="ai-report-toolbar-main">
				<div class="ai-report-actions-group">
					${input.versionStart || ""}
					${input.kind === "report" ? reportParagraphToggleHtml() : ""}
				</div>
				${stats ? `<div class="ai-report-stats-row">${stats}</div>` : ""}
				${askAnswerCopyButtonHtml({ turnIndex: input.turnIndex, kind: input.kind, placement: "start" })}
			</div>
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
		...(job.versionIndex && job.versionIndex.length > 0
			? {
					versionIndex: healedResearchVersionIndex({
						versionIndex: job.versionIndex,
						processNotes: job.processNotes,
						createdAt: job.createdAt,
					}),
				}
			: job.processNotes && job.processNotes.length > 0
				? {
						versionIndex: healedResearchVersionIndex({
							processNotes: job.processNotes,
							createdAt: job.createdAt,
						}),
					}
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
