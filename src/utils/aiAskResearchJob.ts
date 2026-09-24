import type { AiAskPersonHit } from "./aiAskPersons";
import { sanitizeAskPersonHits } from "./aiAskPersons";
import {
	publicIllustrationFields,
	type AiDiscourseHit,
} from "./aiDiscourseHits";
import { clipAiQuestion, MAX_QUESTION_CHARS } from "./aiAskQuestionText";
import { RESEARCH_REPORT_MAX_CHARS } from "./aiAskResearchReport";
import {
	clipResearchVersionIndex,
	isResearchRevisionStartedLabel,
	isResearchRevisePlanNote,
	researchRevisionStartedLabel,
	sanitizeResearchReviseClarify,
	type ResearchReviseClarify,
	type ResearchVersionMeta,
} from "./aiAskResearchRevise";
import { normalizeAskSummaryProse } from "./linkifyAskSummary";

export const RESEARCH_JOB_ID_MAX = 80;

export type ResearchJobStatus =
	| "queued"
	| "running"
	| "verify"
	| "searching"
	| "crunching"
	| "reviewing"
	| "answering"
	| "revising"
	/** Revision paused on the planner's questions; the report is unchanged. */
	| "revise-clarifying"
	| "complete"
	| "failed"
	| "cancelled";

export type ResearchAskPhase =
	| "rewrite"
	| "verify"
	| "search"
	| "rerank"
	| "review"
	| "answer"
	| "done";

export interface ResearchJobResult {
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
	/** Markdown research document (not the short Ask briefing). */
	report?: string;
	shareSlug?: string;
	candidateCount?: number;
	requestId?: string;
}

export interface ResearchJobPublic {
	id: string;
	status: ResearchJobStatus;
	phase: ResearchAskPhase;
	pending: boolean;
	question: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	verifyNote: string;
	onTrack?: boolean;
	reasoning: string;
	candidateCount?: number;
	showCount?: number;
	error?: string;
	emailSent?: boolean;
	result?: ResearchJobResult;
	/** Live status line for the process strip (e.g. “Searching · 3 of 8”). */
	progressNote?: string;
	/** Durable hops (further searches, full reads) kept after the job finishes. */
	processNotes?: string[];
	/** When the reader started this research — history `at` should keep this. */
	createdAt?: number;
	/** Changelog rows; bodies live in researchJobs/{id}/versions/{n}. */
	versionIndex?: ResearchVersionMeta[];
	/** Present only while `status` is `revise-clarifying`. */
	reviseClarify?: ResearchReviseClarify;
}

export function isResearchJobTerminal(status: ResearchJobStatus): boolean {
	return (
		status === "complete" || status === "failed" || status === "cancelled"
	);
}

/** A revision cycle is open — running, or paused on the reader's answers. */
export function isResearchJobRevising(status: ResearchJobStatus): boolean {
	return status === "revising" || status === "revise-clarifying";
}

export function isResearchJobReviseClarifying(status: ResearchJobStatus): boolean {
	return status === "revise-clarifying";
}

/** Cancelled or failed jobs can be started again on the same record. */
export function isResearchJobRetryable(status: ResearchJobStatus): boolean {
	return status === "cancelled" || status === "failed";
}

/**
 * Whether retrying this job should consume a new daily credit.
 * A kept credit (early stop) is reused; a refunded fail/stale stop pays again.
 */
export function researchJobRetryReusesCredit(input: {
	quotaSettled?: boolean;
	quotaRefunded?: boolean;
}): boolean {
	return input.quotaSettled === true && input.quotaRefunded !== true;
}

export function researchJobPhase(status: ResearchJobStatus): ResearchAskPhase {
	if (status === "searching" || status === "verify") return "search";
	if (status === "crunching") return "rerank";
	if (status === "reviewing") return "review";
	if (status === "answering" || isResearchJobRevising(status)) return "answer";
	if (isResearchJobTerminal(status)) return "done";
	return "rewrite";
}

export function clipResearchJobId(value: string): string {
	return value.replace(/\s+/g, "").trim().slice(0, RESEARCH_JOB_ID_MAX);
}

/** Enough for the original run plus several revision cycles (~4 hops each). */
export const RESEARCH_PROCESS_NOTES_MAX = 40;
/** Revise plan/read hops need room for several discourse ids and a short summary. */
export const RESEARCH_PROCESS_NOTE_CHARS = 280;

function clipProcessNote(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_PROCESS_NOTE_CHARS);
}

function revisionStartedN(note: string): number {
	const match = note.match(/^started v(\d+) revision/i);
	return match ? Number(match[1]) || 0 : 0;
}

/**
 * Dedupe key for a hop. Revision hops repeat verbatim every cycle
 * (“Considering the revision…”, “Revising the report…”), so they are keyed by
 * the cycle they belong to; otherwise only the first revision kept its hops.
 */
function processNoteDedupeKey(note: string, cycle: number): string {
	return `${cycle}\u0000${note.toLowerCase()}`;
}

export function clipResearchProcessNotes(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	let cycle = 0;
	for (const item of value) {
		if (typeof item !== "string") continue;
		const note = clipProcessNote(item);
		if (!note) continue;
		const family = researchProcessNoteFamily(note);
		if (
			family === "skip" ||
			family === "write" ||
			family === "start" ||
			family === "review"
		) {
			continue;
		}
		if (family === "revise-start") cycle = revisionStartedN(note) || cycle + 1;
		const key = processNoteDedupeKey(note, cycle);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(note);
	}
	return out.length > RESEARCH_PROCESS_NOTES_MAX
		? out.slice(out.length - RESEARCH_PROCESS_NOTES_MAX)
		: out;
}

export function researchProcessNoteFamily(note: string): string {
	const n = clipProcessNote(note);
	if (/^review(?:ing|ed) the evidence/i.test(n)) return "review";
	if (/^review(?:ing|ed) the report/i.test(n)) return "review-report";
	if (/^(?:searching again|searched again)/i.test(n)) return "search-again";
	if (/^going deeper/i.test(n)) return "go-deeper";
	if (/\bin pāli\b/i.test(n)) return "read-pali";
	if (/^(?:reading|read)\b/i.test(n)) return "read-full";
	if (/^(?:writing|wrote|rewriting) the report/i.test(n)) return "write";
	if (/^started v\d+ revision/i.test(n)) return "revise-start";
	if (/^(?:considering|considered) the revision/i.test(n)) return "revise-think";
	if (/^(?:looking up additional|looked up additional)/i.test(n)) {
		return "revise-search";
	}
	if (/^(?:revising|revised) the report/i.test(n)) return "revise";
	if (/^revision failed:/i.test(n)) return "revise-failed";
	if (isResearchRevisePlanNote(n)) return "revise-plan";
	if (/^waiting for your answer/i.test(n)) return "skip";
	if (/^starting/i.test(n)) return "start";
	if (
		/^(?:planning|opening the library|searching ·|crunching|ranking|understood|checking for gaps)/i.test(
			n,
		)
	) {
		return "skip";
	}
	return `note:${n.toLowerCase()}`;
}

/** True when a stored hop marks a revision that actually shipped a version. */
export function revisionCycleShippedNote(note: string): boolean {
	const n = clipProcessNote(note);
	// “Revising the report…” is written before the writer returns; it must not
	// count as shipped until it is replaced with an explicit “Revised … · vN”.
	return /^revised the report\b/i.test(n) && !/^revising the report/i.test(n);
}

/**
 * Drop the hops of a revision cycle that never produced a version (the reader
 * cancelled at the clarify step, the questions expired, or the writer failed),
 * so the strip does not show an open “Started vN revision” with nothing after it.
 */
export function dropOpenResearchRevisionCycle(
	notes: readonly string[] | undefined,
): string[] {
	const current = clipResearchProcessNotes(notes);
	let startAt = -1;
	for (let i = current.length - 1; i >= 0; i -= 1) {
		if (researchProcessNoteFamily(current[i]) === "revise-start") {
			startAt = i;
			break;
		}
	}
	if (startAt < 0) return current;
	const closed = current
		.slice(startAt + 1)
		.some((note) => revisionCycleShippedNote(note));
	return closed ? current : current.slice(0, startAt);
}

export function rememberResearchProcessNote(
	notes: readonly string[] | undefined,
	note: string,
): string[] {
	const next = clipProcessNote(note);
	const current = clipResearchProcessNotes(notes);
	if (!next) return current;
	const family = researchProcessNoteFamily(next);
	if (
		family === "skip" ||
		family === "write" ||
		family === "start" ||
		family === "review"
	) {
		return current;
	}
	const last = current[current.length - 1];
	if (
		last &&
		researchProcessNoteFamily(last) === family &&
		(family === "search-again" ||
			family === "go-deeper" ||
			family === "review-report" ||
			family === "revise-plan" ||
			family === "revise")
	) {
		return clipResearchProcessNotes([...current.slice(0, -1), next]);
	}
	return clipResearchProcessNotes([...current, next]);
}

/** Finished-strip label for a recorded hop. */
export function formatResearchProcessHopLabel(note: string): string {
	return clipProcessNote(note)
		.replace(/^Reviewing the report/i, "Reviewed the report")
		.replace(/^Searching again/i, "Searched again")
		.replace(/^Considering the revision/i, "Considered the revision")
		.replace(/^Looking up additional discourses/i, "Looked up additional discourses")
		.replace(/^Revising the report/i, "Revised the report")
		.replace(/^Reading\b/i, "Read")
		.replace(/…$/, "")
		.trim();
}

export function isResearchReviseHopLabel(text: string): boolean {
	const family = researchProcessNoteFamily(text);
	return (
		family === "revise-start" ||
		family === "revise-think" ||
		family === "revise-plan" ||
		family === "revise-search" ||
		family === "revise"
	);
}

function isRevisionThinkHopLabel(text: string): boolean {
	return /consider(?:ing|ed) the revision/i.test(text);
}

function isRevisionDoneHopLabel(text: string): boolean {
	return /^revised the report/i.test(text);
}

function isRevisionStartedHopLabel(text: string): boolean {
	return /^started v\d+ revision/i.test(text);
}

/**
 * Insert “Started vN revision” before each revise cycle when the job did not
 * already record that hop. Live revises get the next version number.
 */
export function interleaveResearchRevisionStartedHops(
	hops: readonly string[],
	options: { currentN?: number; revising?: boolean } = {},
): string[] {
	const currentN = Math.max(1, Math.floor(options.currentN || 1));
	const revising = options.revising === true;
	if (hops.length === 0 && !revising) return [];
	if (hops.some(isRevisionStartedHopLabel)) {
		if (!revising) return [...hops];
		const lastStarted = [...hops]
			.reverse()
			.find(isRevisionStartedHopLabel);
		const liveN = Math.max(2, currentN + 1);
		const lastN = Number((lastStarted || "").match(/v(\d+)/i)?.[1] || 0);
		const afterLastStart = lastStarted
			? hops.slice(hops.lastIndexOf(lastStarted) + 1)
			: hops;
		const cycleClosed = afterLastStart.some(isRevisionDoneHopLabel);
		if (cycleClosed && lastN !== liveN) {
			return [...hops, researchRevisionStartedLabel(liveN)];
		}
		return [...hops];
	}
	const out: string[] = [];
	let cycle = 0;
	let open = false;
	for (const hop of hops) {
		if (isRevisionThinkHopLabel(hop) && !open) {
			cycle += 1;
			out.push(researchRevisionStartedLabel(cycle + 1));
			open = true;
		}
		out.push(hop);
		if (isRevisionDoneHopLabel(hop)) open = false;
	}
	if (revising && !open) {
		const n = cycle > 0 ? cycle + 2 : Math.max(2, currentN + 1);
		out.push(researchRevisionStartedLabel(n));
	}
	return out;
}

/** Original hops stay before “Wrote the report”; revise hops append after it. */
export function splitResearchReviseHopLabels(labels: readonly string[]): {
	original: string[];
	revise: string[];
} {
	const splitAt = labels.findIndex((text) => isResearchReviseHopLabel(text));
	if (splitAt < 0) return { original: [...labels], revise: [] };
	return {
		original: labels.slice(0, splitAt),
		revise: labels.slice(splitAt),
	};
}

export function researchProcessHopLabels(
	notes: readonly string[] = [],
	hideNote?: string,
): string[] {
	const hideFamily = hideNote ? researchProcessNoteFamily(hideNote) : "";
	const out: string[] = [];
	const seen = new Set<string>();
	let cycle = 0;
	for (const note of notes) {
		const family = researchProcessNoteFamily(note);
		if (
			family === "skip" ||
			family === "write" ||
			family === "start" ||
			family === "review"
		) {
			continue;
		}
		if (family === "revise-start") cycle = revisionStartedN(note) || cycle + 1;
		if (hideFamily && family === hideFamily) continue;
		// “Revising the report…” is written before the writer returns. Only an
		// explicit “Revised the report · vN” hop means a version actually shipped.
		if (family === "revise" && !revisionCycleShippedNote(note)) continue;
		const label = formatResearchProcessHopLabel(note);
		const key = processNoteDedupeKey(label, cycle);
		if (!label || seen.has(key)) continue;
		seen.add(key);
		out.push(label);
	}
	return out;
}

/** Finished hop that closes a revision cycle: “Revised the report · v3”. */
export function researchRevisedLabel(n: number): string {
	const version = Math.max(2, Math.floor(Number(n) || 2));
	return `Revised the report · v${version}`;
}

function normalizeRevisionHop(note: string): string {
	return note
		.replace(/…|\.{3}$/u, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

/** Latest open “Started vN revision” hop on the client, if the strip has one. */
export function latestRevisionStartedNote(
	notes: readonly string[] | undefined,
): string {
	let latest = "";
	for (const note of notes || []) {
		if (isResearchRevisionStartedLabel(note)) latest = note;
	}
	return latest;
}

/**
 * Whether a revise submit is on the server. Pending, a new version, the
 * cycle’s “Started vN” hop, or the shipped “Revised the report · vN” hop
 * all count. A lost HTTP response can still be a landed revision.
 */
export function researchReviseCycleLanded(input: {
	pending: boolean;
	processNotes?: readonly string[];
	versionCount: number;
	versionCountBefore: number;
	startedNote: string;
}): boolean {
	if (input.pending) return true;
	if (input.versionCount > Math.max(0, input.versionCountBefore)) return true;
	const started = normalizeRevisionHop(input.startedNote);
	if (!started) return false;
	const versionMatch = started.match(/\bv(\d+)\b/);
	const revised = versionMatch
		? normalizeRevisionHop(researchRevisedLabel(Number(versionMatch[1])))
		: "";
	return (input.processNotes || []).some((note) => {
		const normalized = normalizeRevisionHop(note);
		return normalized === started || (revised !== "" && normalized === revised);
	});
}

/**
 * The client opened a revision cycle that the server job does not have.
 * Used when a reload replays an optimistic “Started vN” hop after the
 * submit never arrived.
 */
export function localRevisionMissingOnServer(input: {
	localNotes?: readonly string[];
	serverPending: boolean;
	serverNotes?: readonly string[];
}): boolean {
	if (input.serverPending) return false;
	const startedNote = latestRevisionStartedNote(input.localNotes);
	if (!startedNote) return false;
	return !researchReviseCycleLanded({
		pending: false,
		processNotes: input.serverNotes,
		versionCount: 0,
		versionCountBefore: 0,
		startedNote,
	});
}

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function stringList(value: unknown, maxItems: number, maxChars: number): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const item of value) {
		if (typeof item !== "string") continue;
		const next = clip(item, maxChars);
		if (!next) continue;
		out.push(next);
		if (out.length >= maxItems) break;
	}
	return out;
}

function sanitizeHits(value: unknown): AiDiscourseHit[] {
	if (!Array.isArray(value)) return [];
	const out: AiDiscourseHit[] = [];
	for (const item of value.slice(0, 160)) {
		if (!item || typeof item !== "object") continue;
		const hit = item as Record<string, unknown>;
		const slug = clip(typeof hit.slug === "string" ? hit.slug : "", 64);
		const href = clip(typeof hit.href === "string" ? hit.href : "", 120);
		if (!slug || !href) continue;
		out.push({
			slug,
			title: clip(typeof hit.title === "string" ? hit.title : slug, 160),
			description: clip(
				typeof hit.description === "string" ? hit.description : "",
				280,
			),
			contentSnippet:
				typeof hit.contentSnippet === "string" && hit.contentSnippet
					? clip(hit.contentSnippet, 280)
					: null,
			referenceOnly: hit.referenceOnly === true,
			...(typeof hit.volpage === "string" && hit.volpage
				? { volpage: clip(hit.volpage, 80) }
				: {}),
			href,
			...publicIllustrationFields(hit),
		});
	}
	return out;
}

export function sanitizeResearchJobResult(
	raw: unknown,
): ResearchJobResult | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const question = clipAiQuestion(
		typeof record.question === "string" ? record.question : "",
		MAX_QUESTION_CHARS,
	);
	if (!question) return undefined;
	const originalQuestion =
		typeof record.originalQuestion === "string"
			? clipAiQuestion(record.originalQuestion, MAX_QUESTION_CHARS)
			: "";
	const persons = sanitizeAskPersonHits(record.persons);
	return {
		question,
		...(originalQuestion && originalQuestion !== question
			? { originalQuestion }
			: {}),
		lookingFor: clip(
			typeof record.lookingFor === "string" ? record.lookingFor : "",
			280,
		),
		queries: stringList(record.queries, 6, 100),
		fallbackQueries: stringList(record.fallbackQueries, 6, 100),
		offTopic: record.offTopic === true,
		results: sanitizeHits(record.results),
		...(persons.length > 0 ? { persons } : {}),
		model: clip(typeof record.model === "string" ? record.model : "", 160),
		reasoning: clip(
			typeof record.reasoning === "string" ? record.reasoning : "",
			4000,
		),
		...(typeof record.summary === "string" && record.summary.trim()
			? { summary: normalizeAskSummaryProse(record.summary, 4800) }
			: {}),
		...(typeof record.report === "string" && record.report.trim()
			? {
					report: record.report
						.replace(/\r\n/g, "\n")
						.trim()
						.slice(0, RESEARCH_REPORT_MAX_CHARS),
				}
			: {}),
		...(typeof record.shareSlug === "string" && record.shareSlug.trim()
			? { shareSlug: clip(record.shareSlug.toLowerCase(), 48) }
			: {}),
		...(typeof record.candidateCount === "number" &&
		Number.isFinite(record.candidateCount) &&
		record.candidateCount > 0
			? { candidateCount: Math.min(2000, Math.floor(record.candidateCount)) }
			: {}),
		...(typeof record.requestId === "string" && record.requestId.trim()
			? { requestId: clip(record.requestId, 80) }
			: {}),
	};
}

export function parseResearchJobStatus(value: unknown): ResearchJobStatus | null {
	if (
		value === "queued" ||
		value === "running" ||
		value === "verify" ||
		value === "searching" ||
		value === "crunching" ||
		value === "reviewing" ||
		value === "answering" ||
		value === "revising" ||
		value === "revise-clarifying" ||
		value === "complete" ||
		value === "failed" ||
		value === "cancelled"
	) {
		return value;
	}
	return null;
}

export function toResearchJobPublic(input: {
	id: string;
	status: ResearchJobStatus;
	question: string;
	lookingFor?: string;
	queries?: readonly string[];
	fallbackQueries?: readonly string[];
	offTopic?: boolean;
	verifyNote?: string;
	onTrack?: boolean;
	reasoning?: string;
	candidateCount?: number;
	showCount?: number;
	error?: string;
	emailSent?: boolean;
	result?: unknown;
	progressNote?: string;
	processNotes?: readonly string[];
	createdAt?: number;
	versionIndex?: unknown;
	reviseClarify?: unknown;
}): ResearchJobPublic {
	const status = input.status;
	const result = sanitizeResearchJobResult(input.result);
	const reviseClarify = isResearchJobReviseClarifying(status)
		? sanitizeResearchReviseClarify(input.reviseClarify)
		: null;
	return {
		id: clipResearchJobId(input.id),
		status,
		phase: researchJobPhase(status),
		pending: !isResearchJobTerminal(status),
		question: clipAiQuestion(input.question, MAX_QUESTION_CHARS),
		lookingFor: clip(input.lookingFor || result?.lookingFor || "", 280),
		queries: input.queries
			? stringList(input.queries, 6, 100)
			: result?.queries || [],
		fallbackQueries: input.fallbackQueries
			? stringList(input.fallbackQueries, 6, 100)
			: result?.fallbackQueries || [],
		offTopic: input.offTopic === true || result?.offTopic === true,
		verifyNote: clip(input.verifyNote || "", 160),
		...(typeof input.onTrack === "boolean" ? { onTrack: input.onTrack } : {}),
		reasoning: clip(input.reasoning || result?.reasoning || "", 4000),
		...(input.progressNote
			? { progressNote: clip(input.progressNote, 160) }
			: {}),
		...(() => {
			const processNotes = clipResearchProcessNotes(input.processNotes);
			return processNotes.length > 0 ? { processNotes } : {};
		})(),
		...(typeof input.candidateCount === "number" && input.candidateCount > 0
			? { candidateCount: Math.floor(input.candidateCount) }
			: result?.candidateCount
				? { candidateCount: result.candidateCount }
				: {}),
		...(typeof input.showCount === "number" && input.showCount > 0
			? { showCount: Math.floor(input.showCount) }
			: result?.results.length
				? { showCount: result.results.length }
				: {}),
		...(input.error ? { error: clip(input.error, 280) } : {}),
		...(input.emailSent === true ? { emailSent: true } : {}),
		...(typeof input.createdAt === "number" &&
		Number.isFinite(input.createdAt) &&
		input.createdAt > 0
			? { createdAt: Math.floor(input.createdAt) }
			: {}),
		...(result ? { result } : {}),
		...(() => {
			const versionIndex = clipResearchVersionIndex(input.versionIndex);
			return versionIndex.length > 0 ? { versionIndex } : {};
		})(),
		...(reviseClarify ? { reviseClarify } : {}),
	};
}
