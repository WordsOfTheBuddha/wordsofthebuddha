import type { AiAskPersonHit } from "./aiAskPersons";
import { sanitizeAskPersonHits } from "./aiAskPersons";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import { clipResearchProcessNotes } from "./aiAskResearchJob";
import { RESEARCH_REPORT_MAX_CHARS } from "./aiAskResearchReport";
import {
	sanitizeResearchHistoryReportStats,
	snapshotResearchHistoryStats,
	type ResearchHistoryReportStats,
} from "./aiAskResearchHistoryStats";
import { normalizeAskSummaryProse } from "./linkifyAskSummary";

export interface AiAskSessionEntry {
	/** Display wording (typo-corrected when available). */
	question: string;
	/** Exact text the user submitted, for cache matching on re-ask. */
	originalQuestion?: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	results: AiDiscourseHit[];
	/** Exact-match person pages shown with the answer. */
	persons?: AiAskPersonHit[];
	model: string;
	reasoning: string;
	/** How the result set aligns with the question (from Gemini rerank). */
	summary?: string;
	/** Preferred public /ask/{shareSlug} theme from the model. */
	shareSlug?: string;
	at: number;
	/** Correlates with server askTelemetry / feedback. */
	requestId?: string;
	/** Set once the user rates this ask in-session. */
	feedback?: "up" | "down";
	/** Signed-in favorite — prefer keeping these when trimming history. */
	saved?: boolean;
	/** Unique search matches (for “found N” / ranked-from-N UI). */
	candidateCount?: number;
	/**
	 * Full conversation snapshot (oldest → newest) when this Ask was part of a
	 * multi-turn thread. Nested entries do not carry their own `thread`.
	 */
	thread?: AiAskSessionEntry[];
	/** Completed Deep Research turn. */
	research?: boolean;
	researchJobId?: string;
	report?: string;
	/** Card preview — server history stores this instead of `report`. */
	reportExcerpt?: string;
	/** Compact card stats — kept when the full report is slimmed away. */
	reportStats?: ResearchHistoryReportStats;
	/** Job is still running — show in Recent so it is not lost. */
	researchPending?: boolean;
	/** Finished research the reader has not opened yet. */
	researchUnread?: boolean;
	/** Durable research hops kept on the finished process strip. */
	processNotes?: string[];
}

const SESSION_KEY = "ai-ask-session-v1";
/** In-tab active Ask thread — restored when the user returns via Back. */
const ACTIVE_THREAD_KEY = "ai-ask-active-thread-v1";
/** In-tab active Research thread — separate so Ask Back does not reopen a report. */
const ACTIVE_RESEARCH_THREAD_KEY = "ai-research-active-thread-v1";

function activeThreadKey(research?: boolean): string {
	return research ? ACTIVE_RESEARCH_THREAD_KEY : ACTIVE_THREAD_KEY;
}
/** Rolling history for signed-in (and local) Ask sessions. */
export const AI_ASK_SESSION_LIMIT = 20;
/** Same 20-row cap as Ask, on its own lane. Unpinned rows drop first. */
export const AI_RESEARCH_SESSION_LIMIT = AI_ASK_SESSION_LIMIT;
/** Recent-Asks preview above the composer; the Pinned tab shows every pin. */
export const ASK_HISTORY_PREVIEW_LIMIT = 5;
export type AskHistoryTab = "recent" | "pinned";
export const AI_ASK_THREAD_TURN_LIMIT = 6;
const ACTIVE_THREAD_TURN_LIMIT = AI_ASK_THREAD_TURN_LIMIT;

const MAX_QUESTION = 500;
const MAX_LOOKING = 280;
const MAX_QUERY = 100;
const MAX_QUERIES = 6;
const MAX_REASONING = 4000;
/** Match Ask briefing cap (adaptive up to AI_RERANK_SUMMARY_MAX). */
const MAX_SUMMARY = 4800;
/** Match Ask display cap (adaptive up to AI_RERANK_MAX_LIMIT). */
const MAX_ASK_RESULTS = 50;
/** Research selected set (up to RESEARCH_RERANK_HARD_LIMIT). */
const MAX_RESEARCH_RESULTS = 160;
const MAX_SNIPPET = 280;
const MAX_TITLE = 160;
const MAX_DESCRIPTION = 280;
/** Firestore per-document cap (1 MiB). Writes fail at this size. */
export const ASK_HISTORY_FIRESTORE_LIMIT_BYTES = 1_048_576;
/** Stay under the cap with encoding headroom (timestamps, field names). */
export const ASK_HISTORY_FIRESTORE_TARGET_BYTES = 900_000;
/** Match RESEARCH_HISTORY_EXCERPT_MAX — keep this module free of UI imports. */
export const ASK_HISTORY_SYNC_EXCERPT_MAX = 180;
const SYNC_ASK_RESULT_LIMIT = 12;
const SYNC_RESULT_CARD_LIMIT = 6;
const SYNC_REASONING_MAX = 400;
const SYNC_SUMMARY_CLIP = 400;
const SYNC_PENDING_NOTES = 2;

export function normalizeAskQuestionKey(question: string): string {
	return question.replace(/\s+/g, " ").trim().toLowerCase();
}

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function clipReportExcerpt(
	value: string,
	max = ASK_HISTORY_SYNC_EXCERPT_MAX,
): string {
	const text = value
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_~`>#]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!text) return "";
	if (text.length <= max) return text;
	const sliced = text.slice(0, max);
	return sliced.replace(/\s+\S*$/, "").trim() || sliced.trim();
}

function defaultStorage(): Storage | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage;
}

/** One-time move from sessionStorage so prior tabs keep working. */
function migrateSessionStorageOnce(storage: Storage): void {
	if (typeof sessionStorage === "undefined") return;
	try {
		if (storage.getItem(SESSION_KEY)) return;
		const legacy = sessionStorage.getItem(SESSION_KEY);
		if (!legacy) return;
		storage.setItem(SESSION_KEY, legacy);
		sessionStorage.removeItem(SESSION_KEY);
	} catch {
		/* ignore */
	}
}

export function sanitizeAskHistoryEntry(
	raw: unknown,
	options?: { allowThread?: boolean },
): AiAskSessionEntry | null {
	if (!raw || typeof raw !== "object") return null;
	const allowThread = options?.allowThread !== false;
	const record = raw as Record<string, unknown>;
	const question = clip(typeof record.question === "string" ? record.question : "", MAX_QUESTION);
	if (!question) return null;
	const resultsRaw = Array.isArray(record.results) ? record.results : [];
	const results: AiDiscourseHit[] = [];
	const maxResults =
		record.research === true ? MAX_RESEARCH_RESULTS : MAX_ASK_RESULTS;
	for (const item of resultsRaw.slice(0, maxResults)) {
		if (!item || typeof item !== "object") continue;
		const hit = item as Record<string, unknown>;
		const slug = clip(typeof hit.slug === "string" ? hit.slug : "", 64);
		const href = clip(typeof hit.href === "string" ? hit.href : "", 120);
		if (!slug || !href) continue;
		results.push({
			slug,
			title: clip(typeof hit.title === "string" ? hit.title : slug, MAX_TITLE),
			description: clip(
				typeof hit.description === "string" ? hit.description : "",
				MAX_DESCRIPTION,
			),
			contentSnippet:
				typeof hit.contentSnippet === "string" && hit.contentSnippet
					? clip(hit.contentSnippet, MAX_SNIPPET)
					: null,
			referenceOnly: hit.referenceOnly === true,
			...(typeof hit.volpage === "string" && hit.volpage
				? { volpage: clip(hit.volpage, 80) }
				: {}),
			href,
		});
	}
	const keepEmptyResearch =
		record.research === true &&
		(record.researchPending === true ||
			(typeof record.researchJobId === "string" &&
				Boolean(record.researchJobId.trim())) ||
			(typeof record.report === "string" && Boolean(record.report.trim())) ||
			(typeof record.reportExcerpt === "string" &&
				Boolean(record.reportExcerpt.trim())));
	if (results.length === 0 && !keepEmptyResearch) return null;

	const queries = Array.isArray(record.queries)
		? record.queries
				.filter((query): query is string => typeof query === "string")
				.map((query) => clip(query, MAX_QUERY))
				.filter(Boolean)
				.slice(0, MAX_QUERIES)
		: [];
	const fallbackQueries = Array.isArray(record.fallbackQueries)
		? record.fallbackQueries
				.filter((query): query is string => typeof query === "string")
				.map((query) => clip(query, MAX_QUERY))
				.filter(Boolean)
				.slice(0, MAX_QUERIES)
		: [];
	const originalQuestion =
		typeof record.originalQuestion === "string"
			? clip(record.originalQuestion, MAX_QUESTION)
			: "";
	const at =
		typeof record.at === "number" && Number.isFinite(record.at)
			? Math.max(0, Math.round(record.at))
			: Date.now();

	const thread =
		allowThread && Array.isArray(record.thread)
			? record.thread
					.map((item) =>
						sanitizeAskHistoryEntry(item, { allowThread: false }),
					)
					.filter((item): item is AiAskSessionEntry => Boolean(item))
					.slice(0, AI_ASK_THREAD_TURN_LIMIT)
			: [];

	return {
		question,
		...(originalQuestion ? { originalQuestion } : {}),
		lookingFor: clip(
			typeof record.lookingFor === "string" ? record.lookingFor : "",
			MAX_LOOKING,
		),
		queries,
		fallbackQueries,
		offTopic: record.offTopic === true,
		results,
		model: clip(typeof record.model === "string" ? record.model : "", 120),
		reasoning: clip(
			typeof record.reasoning === "string" ? record.reasoning : "",
			MAX_REASONING,
		),
		...(typeof record.summary === "string" && record.summary.trim()
			? { summary: normalizeAskSummaryProse(record.summary, MAX_SUMMARY) }
			: {}),
		...(typeof record.report === "string" && record.report.trim()
			? {
					report: record.report
						.replace(/\r\n/g, "\n")
						.trim()
						.slice(0, RESEARCH_REPORT_MAX_CHARS),
				}
			: {}),
		...(typeof record.reportExcerpt === "string" && record.reportExcerpt.trim()
			? { reportExcerpt: clipReportExcerpt(record.reportExcerpt) }
			: {}),
		...(() => {
			const stored = sanitizeResearchHistoryReportStats(record.reportStats);
			const reportStats =
				stored ||
				snapshotResearchHistoryStats(
					typeof record.report === "string" ? record.report : "",
					results,
				);
			return reportStats ? { reportStats } : {};
		})(),
		...(typeof record.shareSlug === "string" && record.shareSlug.trim()
			? { shareSlug: clip(record.shareSlug.toLowerCase(), 48) }
			: {}),
		...(() => {
			const persons = sanitizeAskPersonHits(record.persons);
			return persons.length > 0 ? { persons } : {};
		})(),
		at,
		...(typeof record.requestId === "string" && record.requestId.trim()
			? { requestId: clip(record.requestId, 80) }
			: {}),
		...(record.feedback === "up" || record.feedback === "down"
			? { feedback: record.feedback }
			: {}),
		saved: record.saved === true,
		...(typeof record.candidateCount === "number" &&
		Number.isFinite(record.candidateCount) &&
		record.candidateCount > 0
			? { candidateCount: Math.min(2000, Math.floor(record.candidateCount)) }
			: {}),
		...(thread.length > 1 ? { thread } : {}),
		...(record.research === true ? { research: true } : {}),
		...(typeof record.researchJobId === "string" && record.researchJobId.trim()
			? { researchJobId: clip(record.researchJobId, 80) }
			: {}),
		...(record.researchPending === true ? { researchPending: true } : {}),
		...(record.researchUnread === true ? { researchUnread: true } : {}),
		...(() => {
			const processNotes = clipResearchProcessNotes(record.processNotes);
			return processNotes.length > 0 ? { processNotes } : {};
		})(),
	};
}

/**
 * Keep a follow-up research report as the last turn of its conversation.
 * Prefer the live thread when the reader is still on the page; otherwise
 * reuse the snapshot saved when they left.
 */
export function attachResearchToHistoryThread(
	research: AiAskSessionEntry,
	existing?: Pick<AiAskSessionEntry, "thread"> | null,
	liveThread?: readonly AiAskSessionEntry[],
): AiAskSessionEntry {
	const fromLive = (liveThread || [])
		.map((item) => sanitizeAskHistoryEntry(item, { allowThread: false }))
		.filter((item): item is AiAskSessionEntry => Boolean(item));
	const fromExisting = (existing?.thread || [])
		.map((item) => sanitizeAskHistoryEntry(item, { allowThread: false }))
		.filter((item): item is AiAskSessionEntry => Boolean(item));
	const base = fromLive.length > 1 ? fromLive : fromExisting;
	const jobId = research.researchJobId || "";
	const prior = base.filter(
		(item) => !jobId || item.researchJobId !== jobId,
	);
	const tip = sanitizeAskHistoryEntry(research, { allowThread: false });
	if (!tip) return research;
	const thread = [...prior, tip];
	if (thread.length <= 1) {
		const { thread: _drop, ...solo } = research;
		return solo;
	}
	return { ...research, thread };
}

/** Entries to restore into the Ask UI (full thread when a snapshot exists). */
export function askHistoryEntriesForRestore(
	entry: AiAskSessionEntry | null | undefined,
): AiAskSessionEntry[] {
	const clean = entry ? sanitizeAskHistoryEntry(entry) : null;
	if (!clean) return [];
	if (clean.thread && clean.thread.length > 1) {
		return clean.thread;
	}
	const { thread: _thread, ...solo } = clean;
	return [solo];
}

export function isResearchHistoryEntry(
	entry: Pick<AiAskSessionEntry, "research" | "researchJobId" | "report">,
): boolean {
	return (
		entry.research === true ||
		Boolean(entry.researchJobId) ||
		Boolean((entry.report || "").trim())
	);
}

export function askHistoryLaneEntries(
	entries: readonly AiAskSessionEntry[],
	research: boolean,
): AiAskSessionEntry[] {
	return entries.filter((entry) => isResearchHistoryEntry(entry) === research);
}

function trimHistoryLane(
	entries: readonly AiAskSessionEntry[],
	limit: number,
): AiAskSessionEntry[] {
	const out = [...entries];
	while (out.length > limit) {
		let dropIndex = -1;
		for (let i = out.length - 1; i >= 0; i--) {
			if (!out[i]?.saved) {
				dropIndex = i;
				break;
			}
		}
		if (dropIndex === -1) out.pop();
		else out.splice(dropIndex, 1);
	}
	return out;
}

/**
 * Newest-first trim. Ask and Research each keep `limit` unsaved rows.
 * Pinned rows are kept until unpinned (same rule as Ask).
 */
export function trimAskHistoryEntries(
	entries: readonly AiAskSessionEntry[],
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	const out = entries
		.map((entry) => sanitizeAskHistoryEntry(entry))
		.filter((entry): entry is AiAskSessionEntry => Boolean(entry));
	const ask = new Set(
		trimHistoryLane(
			out.filter((entry) => !isResearchHistoryEntry(entry)),
			limit,
		),
	);
	const research = new Set(
		trimHistoryLane(
			out.filter((entry) => isResearchHistoryEntry(entry)),
			limit,
		),
	);
	return out.filter((entry) => ask.has(entry) || research.has(entry));
}

export function sanitizeAskHistoryEntries(
	raw: unknown,
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	if (!Array.isArray(raw)) return [];
	const out: AiAskSessionEntry[] = [];
	for (const item of raw) {
		const entry = sanitizeAskHistoryEntry(item);
		if (!entry) continue;
		out.push(entry);
	}
	return trimAskHistoryEntries(out, limit);
}

export function askHistoryFirestoreBytes(
	entries: readonly AiAskSessionEntry[],
): number {
	return new TextEncoder().encode(JSON.stringify({ entries })).length;
}

export function isAskHistoryDocumentSizeError(error: unknown): boolean {
	const code =
		error && typeof error === "object" && "code" in error
			? String((error as { code: unknown }).code)
			: "";
	const message = error instanceof Error ? error.message : String(error ?? "");
	return (
		code === "3" ||
		code === "INVALID_ARGUMENT" ||
		/INVALID_ARGUMENT/i.test(message) ||
		/exceeds the maximum allowed size/i.test(message)
	);
}

function slimHistoryHit(
	hit: AiDiscourseHit,
	keepTitle: boolean,
): AiDiscourseHit {
	return {
		slug: hit.slug,
		title: keepTitle ? hit.title : hit.slug,
		description: "",
		contentSnippet: null,
		referenceOnly: hit.referenceOnly === true,
		href: hit.href,
	};
}

/**
 * Server / Firestore copy. Drops full research reports and clips other heavy
 * fields so the aggregated history document stays under 1 MiB.
 */
export function slimAskHistoryEntryForSync(
	raw: unknown,
	level: 0 | 1 | 2 = 0,
): AiAskSessionEntry | null {
	const clean = sanitizeAskHistoryEntry(raw, { allowThread: true });
	if (!clean) return null;
	const research = isResearchHistoryEntry(clean);
	const excerpt =
		clean.reportExcerpt ||
		(clean.report ? clipReportExcerpt(clean.report) : "");
	const reportStats =
		clean.reportStats ||
		snapshotResearchHistoryStats(clean.report, clean.results);
	const resultCap = research
		? level >= 2
			? 0
			: SYNC_RESULT_CARD_LIMIT
		: level >= 2
			? 1
			: level >= 1
				? SYNC_RESULT_CARD_LIMIT
				: SYNC_ASK_RESULT_LIMIT;
	const results = clean.results
		.slice(0, Math.max(resultCap, research ? 0 : 1))
		.map((hit) => slimHistoryHit(hit, level === 0 && !research));
	const thread =
		level >= 2 || !clean.thread
			? []
			: clean.thread
					.map((item) =>
						slimAskHistoryEntryForSync(
							{ ...item, thread: undefined, report: undefined },
							level === 0 ? 1 : 2,
						),
					)
					.filter((item): item is AiAskSessionEntry => Boolean(item));
	const pendingNotes =
		research && clean.researchPending && level === 0
			? (clean.processNotes || []).slice(-SYNC_PENDING_NOTES)
			: [];
	const {
		report: _report,
		processNotes: _notes,
		persons: _persons,
		summary: _summary,
		reasoning: _reasoning,
		thread: _thread,
		results: _results,
		...rest
	} = clean;
	return sanitizeAskHistoryEntry({
		...rest,
		results,
		reasoning: research || level >= 1 ? "" : clip(clean.reasoning, SYNC_REASONING_MAX),
		...(research || level >= 2
			? {}
			: clean.summary
				? {
						summary:
							level >= 1
								? clip(clean.summary, SYNC_SUMMARY_CLIP)
								: clean.summary,
					}
				: {}),
		...(research && excerpt ? { reportExcerpt: excerpt } : {}),
		...(reportStats ? { reportStats } : {}),
		...(pendingNotes.length > 0 ? { processNotes: pendingNotes } : {}),
		...(thread.length > 1 ? { thread } : {}),
		queries: level >= 2 ? clean.queries.slice(0, 1) : clean.queries,
		fallbackQueries: level >= 2 ? [] : clean.fallbackQueries,
		lookingFor: level >= 2 ? "" : clean.lookingFor,
		...(clean.candidateCount || clean.results.length
			? {
					candidateCount:
						clean.candidateCount || clean.results.length,
				}
			: {}),
	});
}

function dropUnsavedHistoryUntilUnderBudget(
	entries: readonly AiAskSessionEntry[],
	targetBytes: number,
): AiAskSessionEntry[] {
	const next = [...entries];
	while (
		askHistoryFirestoreBytes(next) > targetBytes &&
		next.length > 0
	) {
		let dropIndex = -1;
		for (let i = next.length - 1; i >= 0; i--) {
			if (!next[i]?.saved) {
				dropIndex = i;
				break;
			}
		}
		if (dropIndex === -1) break;
		next.splice(dropIndex, 1);
	}
	return next;
}

/** Slim + progressively drop heavy fields; keep the 20+20 row caps. */
export function slimAskHistoryEntriesForSync(
	raw: unknown,
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	const entries = sanitizeAskHistoryEntries(raw, limit);
	const apply = (level: 0 | 1 | 2): AiAskSessionEntry[] =>
		entries
			.map((entry) => slimAskHistoryEntryForSync(entry, level))
			.filter((entry): entry is AiAskSessionEntry => Boolean(entry));
	let next = apply(0);
	if (askHistoryFirestoreBytes(next) <= ASK_HISTORY_FIRESTORE_TARGET_BYTES) {
		return next;
	}
	next = apply(1);
	if (askHistoryFirestoreBytes(next) <= ASK_HISTORY_FIRESTORE_TARGET_BYTES) {
		return next;
	}
	next = apply(2);
	if (askHistoryFirestoreBytes(next) <= ASK_HISTORY_FIRESTORE_TARGET_BYTES) {
		return next;
	}
	return dropUnsavedHistoryUntilUnderBudget(
		next,
		ASK_HISTORY_FIRESTORE_TARGET_BYTES,
	);
}

/** Finished research whose report is not in this row — restore from the job. */
export function researchHistoryNeedsJobRestore(
	entry: Pick<
		AiAskSessionEntry,
		"researchJobId" | "researchPending" | "report"
	>,
): boolean {
	if (!(entry.researchJobId || "").trim()) return false;
	if (entry.researchPending === true) return true;
	return !Boolean((entry.report || "").trim());
}

export function readAiAskSession(
	storage: Storage | null | undefined = defaultStorage(),
): AiAskSessionEntry[] {
	if (!storage) return [];
	migrateSessionStorageOnce(storage);
	try {
		const raw = storage.getItem(SESSION_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as { entries?: unknown };
		return sanitizeAskHistoryEntries(parsed.entries);
	} catch {
		return [];
	}
}

export function writeAiAskSession(
	entries: readonly AiAskSessionEntry[],
	storage: Storage | null | undefined = defaultStorage(),
): void {
	if (!storage) return;
	try {
		storage.setItem(
			SESSION_KEY,
			JSON.stringify({
				entries: trimAskHistoryEntries(entries, AI_ASK_SESSION_LIMIT),
			}),
		);
	} catch {
		/* quota / private mode */
	}
}

function entryMatchesQuestionKey(
	entry: AiAskSessionEntry,
	key: string,
): boolean {
	if (!key) return false;
	if (normalizeAskQuestionKey(entry.question) === key) return true;
	const original = normalizeAskQuestionKey(entry.originalQuestion || "");
	return original.length > 0 && original === key;
}

function researchJobIdOf(
	entry: Pick<AiAskSessionEntry, "researchJobId">,
): string {
	return (entry.researchJobId || "").trim();
}

function historyIdentityKeys(entry: AiAskSessionEntry): string[] {
	if (isResearchHistoryEntry(entry)) {
		const jobId = researchJobIdOf(entry);
		if (jobId) return [`r:job:${jobId}`];
		const question = normalizeAskQuestionKey(entry.question);
		return question ? [`r:q:${question}`] : [];
	}
	return [
		`a:q:${normalizeAskQuestionKey(entry.question)}`,
		`a:q:${normalizeAskQuestionKey(entry.originalQuestion || "")}`,
	].filter((key) => key.length > 4);
}

function researchReportIsComplete(
	entry: Pick<
		AiAskSessionEntry,
		"report" | "researchPending" | "researchJobId"
	>,
): boolean {
	if (entry.researchPending === true) return false;
	if ((entry.report || "").trim()) return true;
	return Boolean((entry.researchJobId || "").trim());
}

function pickLongerText(left?: string, right?: string): string | undefined {
	const a = (left || "").trim();
	const b = (right || "").trim();
	if (b.length > a.length) return right;
	if (a) return left;
	return undefined;
}

function richerHits(
	left: AiDiscourseHit[],
	right: AiDiscourseHit[],
): AiDiscourseHit[] {
	if (left.length !== right.length) {
		return left.length >= right.length ? left : right;
	}
	const score = (hits: AiDiscourseHit[]): number =>
		hits.reduce(
			(sum, hit) =>
				sum +
				(hit.contentSnippet?.length || 0) +
				(hit.description?.length || 0) +
				(hit.title?.length || 0),
			0,
		);
	return score(left) >= score(right) ? left : right;
}

function fillHistoryGaps(
	winner: AiAskSessionEntry,
	other: AiAskSessionEntry,
): AiAskSessionEntry {
	const report = pickLongerText(winner.report, other.report);
	const reportExcerpt = pickLongerText(winner.reportExcerpt, other.reportExcerpt);
	const reasoning = pickLongerText(winner.reasoning, other.reasoning);
	const summary = pickLongerText(winner.summary, other.summary);
	const results = richerHits(winner.results, other.results);
	const thread =
		(winner.thread?.length || 0) >= (other.thread?.length || 0)
			? winner.thread
			: other.thread;
	const processNotes =
		(winner.processNotes?.length || 0) >= (other.processNotes?.length || 0)
			? winner.processNotes
			: other.processNotes;
	const candidateCount = Math.max(
		winner.candidateCount || 0,
		other.candidateCount || 0,
	);
	const filled = sanitizeAskHistoryEntry({
		...winner,
		...(report ? { report } : {}),
		...(reportExcerpt ? { reportExcerpt } : {}),
		reasoning: reasoning || "",
		...(summary ? { summary } : {}),
		results,
		...(thread && thread.length > 1 ? { thread } : {}),
		...(processNotes && processNotes.length > 0 ? { processNotes } : {}),
		...(candidateCount > 0 ? { candidateCount } : {}),
		...(winner.reportStats || other.reportStats
			? {
					reportStats: winner.reportStats || other.reportStats,
				}
			: {}),
	});
	return filled || winner;
}

/** Once a finished report has been opened, do not resurrect the unread badge. */
export function mergeResearchUnreadFlag(
	left: Pick<
		AiAskSessionEntry,
		"report" | "researchPending" | "researchUnread" | "researchJobId"
	>,
	right: Pick<
		AiAskSessionEntry,
		"report" | "researchPending" | "researchUnread" | "researchJobId"
	>,
): boolean {
	if (researchReportIsComplete(left) && researchReportIsComplete(right)) {
		return left.researchUnread === true && right.researchUnread === true;
	}
	return left.researchUnread === true || right.researchUnread === true;
}

function minHistoryAt(left: number, right: number): number {
	if (left > 0 && right > 0) return Math.min(left, right);
	if (left > 0) return left;
	if (right > 0) return right;
	return Date.now();
}

function mergeResearchHistoryCopies(
	prior: AiAskSessionEntry,
	incoming: AiAskSessionEntry,
	saved: "incoming" | "either",
): AiAskSessionEntry {
	const priorComplete = researchReportIsComplete(prior);
	const incomingComplete = researchReportIsComplete(incoming);
	const winner =
		incomingComplete && !priorComplete
			? incoming
			: priorComplete && !incomingComplete
				? prior
				: incoming;
	const unread = mergeResearchUnreadFlag(prior, incoming);
	return fillHistoryGaps(
		{
			...winner,
			at: minHistoryAt(prior.at, incoming.at),
			saved:
				saved === "either"
					? prior.saved === true || incoming.saved === true
					: incoming.saved === true,
			...(unread ? { researchUnread: true } : { researchUnread: undefined }),
			researchPending: winner.researchPending === true,
		},
		winner === incoming ? prior : incoming,
	);
}

function stripUndefinedResearchUnread(
	entry: AiAskSessionEntry,
): AiAskSessionEntry {
	if (entry.researchUnread !== undefined) return entry;
	const { researchUnread: _drop, ...rest } = entry;
	return rest;
}

/**
 * A finished job missing from Recent, while another report with the same
 * question is still listed, was almost certainly collapsed by the old
 * question-key merge — not deleted.
 */
export function shouldRestoreDroppedResearchJob(
	entries: readonly AiAskSessionEntry[],
	job: { id?: string; question?: string; originalQuestion?: string },
): boolean {
	const jobId = (job.id || "").replace(/\s+/g, "").trim();
	if (!jobId) return false;
	if (entries.some((item) => researchJobIdOf(item) === jobId)) return false;
	const keys = [
		normalizeAskQuestionKey(job.question || ""),
		normalizeAskQuestionKey(job.originalQuestion || ""),
	].filter(Boolean);
	if (keys.length === 0) return false;
	return entries.some(
		(item) =>
			isResearchHistoryEntry(item) &&
			researchJobIdOf(item) !== jobId &&
			keys.some((key) => entryMatchesQuestionKey(item, key)),
	);
}

/** Job ids from earlier research turns in a conversation, excluding the tip. */
export function priorResearchJobIdsInThread(
	entry: Pick<AiAskSessionEntry, "researchJobId" | "thread">,
): string[] {
	const tip = researchJobIdOf(entry);
	const ids: string[] = [];
	for (const item of entry.thread || []) {
		const id = researchJobIdOf(item);
		if (!id || id === tip || ids.includes(id)) continue;
		ids.push(id);
	}
	return ids;
}

/** Newest first. Asks replace by question; reports replace by job id. */
export function upsertAiAskSessionEntry(
	entries: readonly AiAskSessionEntry[],
	entry: AiAskSessionEntry,
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	const clean = sanitizeAskHistoryEntry(entry);
	if (!clean) return trimAskHistoryEntries(entries, limit);
	const jobId = isResearchHistoryEntry(clean) ? researchJobIdOf(clean) : "";
	if (jobId) {
		const prior = entries.find((item) => researchJobIdOf(item) === jobId);
		const mergedRaw = prior
			? mergeResearchHistoryCopies(prior, clean, "incoming")
			: clean;
		const merged =
			sanitizeAskHistoryEntry(stripUndefinedResearchUnread(mergedRaw)) ||
			clean;
		const rest = entries.filter((item) => researchJobIdOf(item) !== jobId);
		return trimAskHistoryEntries([merged, ...rest], limit);
	}
	const keys = [
		normalizeAskQuestionKey(clean.question),
		normalizeAskQuestionKey(clean.originalQuestion || ""),
	].filter(Boolean);
	const rest = entries.filter((item) => {
		if (isResearchHistoryEntry(clean) !== isResearchHistoryEntry(item)) {
			return true;
		}
		if (jobId && researchJobIdOf(item) === jobId) return false;
		return !keys.some((key) => entryMatchesQuestionKey(item, key));
	});
	return trimAskHistoryEntries([clean, ...rest], limit);
}

export function findAiAskSessionEntry(
	entries: readonly AiAskSessionEntry[],
	question: string,
	options?: { research?: boolean; researchJobId?: string },
): AiAskSessionEntry | undefined {
	const jobId = (options?.researchJobId || "").trim();
	if (jobId) {
		return entries.find((entry) => researchJobIdOf(entry) === jobId);
	}
	const key = normalizeAskQuestionKey(question);
	if (!key) return undefined;
	return entries.find((entry) => {
		if (
			options &&
			typeof options.research === "boolean" &&
			isResearchHistoryEntry(entry) !== options.research
		) {
			return false;
		}
		return entryMatchesQuestionKey(entry, key);
	});
}

/** Drop history rows matching any of the given question strings. */
export function removeAskHistoryEntriesByQuestions(
	entries: readonly AiAskSessionEntry[],
	questions: readonly string[],
	options?: { research?: boolean },
): AiAskSessionEntry[] {
	const keys = questions
		.map((question) => normalizeAskQuestionKey(question))
		.filter(Boolean);
	if (keys.length === 0) return [...entries];
	return entries.filter((entry) => {
		if (
			typeof options?.research === "boolean" &&
			isResearchHistoryEntry(entry) !== options.research
		) {
			return true;
		}
		return !keys.some((key) => entryMatchesQuestionKey(entry, key));
	});
}

/** Drop research rows for these job ids. Other lanes are left alone. */
export function removeAskHistoryEntriesByJobIds(
	entries: readonly AiAskSessionEntry[],
	jobIds: readonly string[],
): AiAskSessionEntry[] {
	const ids = new Set(
		jobIds.map((id) => id.replace(/\s+/g, "").trim()).filter(Boolean),
	);
	if (ids.size === 0) return [...entries];
	return entries.filter((entry) => {
		const jobId = researchJobIdOf(entry);
		return !jobId || !ids.has(jobId);
	});
}

/** Merge lists by identity; the newer `at` wins for Asks. Newest first. */
export function mergeAskHistoryEntries(
	left: readonly AiAskSessionEntry[],
	right: readonly AiAskSessionEntry[],
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	const byKey = new Map<string, AiAskSessionEntry>();
	const consider = (raw: AiAskSessionEntry): void => {
		const entry = sanitizeAskHistoryEntry(raw);
		if (!entry) return;
		const keys = historyIdentityKeys(entry);
		if (keys.length === 0) return;
		let prior: AiAskSessionEntry | undefined;
		for (const key of keys) {
			const existing = byKey.get(key);
			if (existing && (!prior || existing.at >= prior.at)) prior = existing;
		}
		let next = entry;
		if (prior) {
			const sameResearchJob =
				isResearchHistoryEntry(prior) &&
				isResearchHistoryEntry(entry) &&
				Boolean(researchJobIdOf(prior)) &&
				researchJobIdOf(prior) === researchJobIdOf(entry);
			if (sameResearchJob) {
				next =
					sanitizeAskHistoryEntry(
						stripUndefinedResearchUnread(
							mergeResearchHistoryCopies(prior, entry, "either"),
						),
					) || entry;
			} else if (prior.at > entry.at) {
				return;
			} else if (prior.at === entry.at) {
				next = fillHistoryGaps(entry, prior);
			}
			for (const [key, value] of byKey) {
				if (value === prior) byKey.delete(key);
			}
		}
		for (const key of historyIdentityKeys(next)) byKey.set(key, next);
	};
	for (const entry of left) consider(entry);
	for (const entry of right) consider(entry);
	return trimAskHistoryEntries(
		[...new Set(byKey.values())].sort((a, b) => b.at - a.at),
		limit,
	);
}

/**
 * History sync must not drop an in-flight Research job the client already has.
 * The server list can lag (empty-result pending rows used to be rejected).
 */
export function preservePendingResearchHistory(
	local: readonly AiAskSessionEntry[],
	remote: readonly AiAskSessionEntry[],
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	let next = mergeAskHistoryEntries(local, remote, limit);
	for (const raw of local) {
		const entry = sanitizeAskHistoryEntry(raw);
		if (!entry?.researchJobId) continue;
		if (!entry.researchPending && !entry.report) continue;
		const match = next.find((item) => item.researchJobId === entry.researchJobId);
		if (!match) {
			next = upsertAiAskSessionEntry(next, entry, limit);
			continue;
		}
		if (entry.researchPending && !match.researchPending && !match.report) {
			next = upsertAiAskSessionEntry(next, entry, limit);
		} else if ((entry.report || "").length > (match.report || "").length) {
			next = upsertAiAskSessionEntry(next, entry, limit);
		}
	}
	return next;
}

export function formatAskRelativeTime(at: number, now = Date.now()): string {
	if (!Number.isFinite(at) || at <= 0) return "";
	const delta = Math.max(0, now - at);
	const mins = Math.floor(delta / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 14) return `${days}d ago`;
	try {
		return new Date(at).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
	} catch {
		return "";
	}
}

export function orderAskHistoryByRecent(
	entries: readonly AiAskSessionEntry[],
): AiAskSessionEntry[] {
	return [...entries].sort((a, b) => b.at - a.at);
}

export function pinnedAskHistoryEntries(
	entries: readonly AiAskSessionEntry[],
): AiAskSessionEntry[] {
	return orderAskHistoryByRecent(entries).filter((entry) => entry.saved);
}

export function resolveAskHistoryTab(
	entries: readonly AiAskSessionEntry[],
	tab: AskHistoryTab,
): AskHistoryTab {
	if (tab === "pinned" && pinnedAskHistoryEntries(entries).length > 0) {
		return "pinned";
	}
	return "recent";
}

export function askHistoryEntriesForTab(
	entries: readonly AiAskSessionEntry[],
	tab: AskHistoryTab,
): AiAskSessionEntry[] {
	const recent = orderAskHistoryByRecent(entries);
	if (tab === "pinned") return recent.filter((entry) => entry.saved);
	return recent;
}

export function visibleAskHistoryEntries(
	entries: readonly AiAskSessionEntry[],
	tab: AskHistoryTab,
	expanded: boolean,
	limit = ASK_HISTORY_PREVIEW_LIMIT,
): AiAskSessionEntry[] {
	const list = askHistoryEntriesForTab(entries, tab);
	if (tab === "pinned" || expanded || list.length <= limit) return list;
	return list.slice(0, limit);
}

function sessionStorageOrNull(): Storage | null {
	if (typeof sessionStorage === "undefined") return null;
	return sessionStorage;
}

/**
 * Remember the open Ask or Research thread so Back from a discourse restores
 * it on the matching pane without forcing a public /ask/:slug URL.
 */
export function writeActiveAskThread(
	entries: readonly AiAskSessionEntry[],
	storage: Storage | null | undefined = sessionStorageOrNull(),
	options?: { research?: boolean },
): void {
	if (!storage) return;
	const key = activeThreadKey(options?.research);
	const turns = entries
		.map((entry) => sanitizeAskHistoryEntry(entry))
		.filter((entry): entry is AiAskSessionEntry => Boolean(entry))
		.slice(-ACTIVE_THREAD_TURN_LIMIT);
	if (turns.length === 0) {
		clearActiveAskThread(storage, options);
		return;
	}
	try {
		storage.setItem(
			key,
			JSON.stringify({
				turns,
				at: Date.now(),
				research: options?.research === true,
			}),
		);
	} catch {
		/* quota / private mode */
	}
}

export function readActiveAskThread(
	storage: Storage | null | undefined = sessionStorageOrNull(),
	options?: { research?: boolean },
): AiAskSessionEntry[] {
	if (!storage) return [];
	try {
		const raw = storage.getItem(activeThreadKey(options?.research));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as { turns?: unknown };
		return sanitizeAskHistoryEntries(
			parsed.turns,
			ACTIVE_THREAD_TURN_LIMIT,
		);
	} catch {
		return [];
	}
}

export function clearActiveAskThread(
	storage: Storage | null | undefined = sessionStorageOrNull(),
	options?: { research?: boolean },
): void {
	if (!storage) return;
	try {
		if (options && typeof options.research === "boolean") {
			storage.removeItem(activeThreadKey(options.research));
		} else {
			storage.removeItem(ACTIVE_THREAD_KEY);
			storage.removeItem(ACTIVE_RESEARCH_THREAD_KEY);
		}
	} catch {
		/* ignore */
	}
}

/** Set when the reader leaves an open Ask or Research thread for a discourse. */
const ASK_RESUME_FROM_DISCOURSE_KEY = "ai-ask-resume-from-discourse-v1";
const RESEARCH_RESUME_FROM_DISCOURSE_KEY =
	"ai-research-resume-from-discourse-v1";

function resumeFromDiscourseKey(research?: boolean): string {
	return research
		? RESEARCH_RESUME_FROM_DISCOURSE_KEY
		: ASK_RESUME_FROM_DISCOURSE_KEY;
}

export function markAskResumeFromDiscourse(
	storage: Storage | null | undefined = sessionStorageOrNull(),
	options?: { research?: boolean },
): void {
	if (!storage) return;
	try {
		storage.setItem(resumeFromDiscourseKey(options?.research), "1");
	} catch {
		/* quota / private mode */
	}
}

export function shouldResumeAskFromDiscourse(
	storage: Storage | null | undefined = sessionStorageOrNull(),
	options?: { research?: boolean },
): boolean {
	if (!storage) return false;
	return storage.getItem(resumeFromDiscourseKey(options?.research)) === "1";
}

export function clearAskResumeFromDiscourse(
	storage: Storage | null | undefined = sessionStorageOrNull(),
	options?: { research?: boolean },
): void {
	if (!storage) return;
	try {
		if (options && typeof options.research === "boolean") {
			storage.removeItem(resumeFromDiscourseKey(options.research));
		} else {
			storage.removeItem(ASK_RESUME_FROM_DISCOURSE_KEY);
			storage.removeItem(RESEARCH_RESUME_FROM_DISCOURSE_KEY);
		}
	} catch {
		/* ignore */
	}
}

/** Drop the in-tab thread and any pending Back-from-discourse resume for that pane. */
export function clearAskThreadResumeIntent(
	storage: Storage | null | undefined = sessionStorageOrNull(),
	options?: { research?: boolean },
): void {
	clearActiveAskThread(storage, options);
	clearAskResumeFromDiscourse(storage, options);
}

/**
 * Restore the open Ask thread only when the reader is returning to it — not
 * when they open Ask fresh via nav (New question, Back, navbar, etc.).
 */
export function shouldRestoreActiveAskThread(
	navigationType: string,
	resumeFromDiscourse: boolean,
): boolean {
	if (navigationType === "back_forward") return resumeFromDiscourse;
	if (navigationType === "reload") return true;
	return false;
}
