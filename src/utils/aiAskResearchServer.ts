import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { db, isFirebaseInitialized } from "../service/firebase/server";
import { getSearchDocBySlug } from "../service/search/search";
import { rewriteAskQuestion } from "./aiAskRewrite";
import { resolveAskShareSlug } from "./aiAskShare";
import { resolveAskPersonHits } from "./aiAskPersons";
import {
	AI_SEARCH_CANDIDATE_LIMIT,
	queriesForResultSlugs,
	searchDiscoursesForQueries,
	warmAskSearchIndexes,
	type AiDiscourseSearchBatch,
} from "./aiDiscourseSearch";
import { toPublicAskHit, type AiDiscourseHit } from "./aiDiscourseHits";
import {
	ASK_FUNCTION_BUDGET_MS,
	resolveAskWriterBudgetMs,
} from "./aiAskAnswer";
import {
	rerankDiscourseHits,
	RESEARCH_RERANK_HARD_LIMIT,
	RESEARCH_RERANK_MAX_LIMIT,
	RESEARCH_RERANK_SNIPPET_CANDIDATES,
} from "./aiResultRerank";
import {
	parseAskHistory,
	parseRewritePlan,
	resolveRewriteExcludeSlugs,
	type AiRewriteHistoryTurn,
	type AiRewritePlan,
} from "./aiQueryRewrite";
import { collectAskHistoryShownSlugs } from "./aiAskHistory";
import { upsertUserAskHistoryEntry } from "./aiAskHistoryServer";
import {
	buildAiAskTelemetryAskEvent,
	newAiAskRequestId,
} from "./aiAskTelemetry";
import { recordAiAskTelemetry } from "./aiAskTelemetryServer";
import {
	clipResearchJobId,
	isResearchJobRetryable,
	isResearchJobTerminal,
	parseResearchJobStatus,
	clipResearchProcessNotes,
	rememberResearchProcessNote,
	researchJobRetryReusesCredit,
	sanitizeResearchJobResult,
	toResearchJobPublic,
	type ResearchJobPublic,
	type ResearchJobResult,
	type ResearchJobStatus,
} from "./aiAskResearchJob";
import {
	fallbackResearchReport,
	formatResearchSourceLine,
	type ResearchReportResult,
} from "./aiAskResearchReport";
import {
	formatResearchReadProgress,
	logResearchHop,
	nextResearchHop,
	nextUnreadFullBatch,
	openingResearchFullSlugs,
	parseResearchContinueDecision,
	parseResearchHop,
	RESEARCH_CONTINUE_SYSTEM,
	resolveResearchReadFullSlugs,
	shouldEvaluateResearchContinue,
	unreadFullAfterReads,
} from "./aiAskResearchContinue";
import {
	parseResearchRefinePlan,
	RESEARCH_REFINE_SYSTEM,
	shouldAttemptResearchRefine,
} from "./aiAskResearchRefine";
import { collectDirectDiscourseIds } from "./aiSearchQuery";
import { getPtsDisplay } from "./ptsReferences";
import {
	buildResearchReportEvidence,
	writeResearchReport,
} from "./aiAskResearchReportWrite";
import { sendResearchEmail } from "./researchEmail";
import {
	consumeResearchQuota,
	refundResearchQuota,
} from "./aiResearchQuotaServer";
import {
	shouldRefundResearchCredit,
	utcResearchDay,
} from "./aiResearchQuota";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	getOpenRouterApiKey,
	openRouterChat,
	OPENROUTER_SITE_URL,
} from "./openrouter";

const RESEARCH_PLAN_MS = 60_000;
const RESEARCH_ASSEMBLE_MS = 20_000;
const RESEARCH_RERANK_CAPS = {
	typicalLimit: RESEARCH_RERANK_MAX_LIMIT,
	hardLimit: RESEARCH_RERANK_HARD_LIMIT,
	snippetCandidates: RESEARCH_RERANK_SNIPPET_CANDIDATES,
} as const;

class ResearchCancelledError extends Error {
	constructor() {
		super("Research cancelled.");
		this.name = "ResearchCancelledError";
	}
}

class ResearchStaleWorkerError extends Error {
	constructor() {
		super("Research worker is stale.");
		this.name = "ResearchStaleWorkerError";
	}
}

interface ResearchJobRecord {
	id: string;
	uid: string;
	email: string;
	origin: string;
	status: ResearchJobStatus;
	question: string;
	originalQuestion: string;
	history: unknown;
	runToken: string;
	cancelRequested: boolean;
	clarifyBrief?: string;
	lookingFor?: string;
	queries?: string[];
	fallbackQueries?: string[];
	offTopic?: boolean;
	verifyNote?: string;
	onTrack?: boolean;
	reasoning?: string;
	candidateCount?: number;
	showCount?: number;
	error?: string;
	emailSent?: boolean;
	result?: unknown;
	requestId?: string;
	progressNote?: string;
	processNotes?: string[];
	createdAt?: number;
	/** Credit decision already made; do not re-evaluate later. */
	quotaSettled?: boolean;
	quotaRefunded?: boolean;
	/** 2 = extra function run after the first report. 3 = optional third hop. */
	chainPass?: 1 | 2;
	hop?: 1 | 2 | 3;
	chainStarted?: boolean;
	/** First-pass report; not exposed on the public GET. */
	draftResult?: unknown;
	continueQueries?: string[];
	continueFallbackQueries?: string[];
	continueGuidance?: string;
	continueReadFull?: string[];
	continueReadPali?: string[];
	unreadFull?: string[];
	fullReadSlugs?: string[];
}

const memory = new Map<string, ResearchJobRecord>();

function jobKey(uid: string, jobId: string): string {
	return `${uid}:${jobId}`;
}

function jobsCol(uid: string) {
	return db!.collection("users").doc(uid).collection("researchJobs");
}

function newId(): string {
	try {
		return randomUUID();
	} catch {
		return `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
	}
}

function timestampMillis(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return Math.floor(value);
	}
	if (
		value &&
		typeof value === "object" &&
		"toMillis" in value &&
		typeof (value as { toMillis: () => number }).toMillis === "function"
	) {
		const ms = (value as { toMillis: () => number }).toMillis();
		return Number.isFinite(ms) ? ms : 0;
	}
	if (value && typeof value === "object" && "_seconds" in value) {
		const seconds = Number((value as { _seconds: unknown })._seconds);
		return Number.isFinite(seconds) ? Math.floor(seconds * 1000) : 0;
	}
	return 0;
}

function recordToPublic(record: ResearchJobRecord): ResearchJobPublic {
	return toResearchJobPublic(record);
}

function recordFromData(
	id: string,
	uid: string,
	data: Record<string, unknown>,
): ResearchJobRecord | null {
	const status = parseResearchJobStatus(data.status);
	if (!status) return null;
	const question = typeof data.question === "string" ? data.question : "";
	return {
		id,
		uid,
		email: typeof data.email === "string" ? data.email : "",
		origin: typeof data.origin === "string" ? data.origin : OPENROUTER_SITE_URL,
		status,
		question,
		originalQuestion:
			typeof data.originalQuestion === "string"
				? data.originalQuestion
				: question,
		history: data.history,
		runToken: typeof data.runToken === "string" ? data.runToken : "",
		cancelRequested: data.cancelRequested === true,
		clarifyBrief:
			typeof data.clarifyBrief === "string" ? data.clarifyBrief : "",
		lookingFor: typeof data.lookingFor === "string" ? data.lookingFor : "",
		queries: Array.isArray(data.queries) ? (data.queries as string[]) : [],
		fallbackQueries: Array.isArray(data.fallbackQueries)
			? (data.fallbackQueries as string[])
			: [],
		offTopic: data.offTopic === true,
		verifyNote: typeof data.verifyNote === "string" ? data.verifyNote : "",
		onTrack: typeof data.onTrack === "boolean" ? data.onTrack : undefined,
		reasoning: typeof data.reasoning === "string" ? data.reasoning : "",
		candidateCount:
			typeof data.candidateCount === "number" ? data.candidateCount : undefined,
		showCount: typeof data.showCount === "number" ? data.showCount : undefined,
		error: typeof data.error === "string" ? data.error : undefined,
		emailSent: data.emailSent === true,
		result: data.result,
		requestId: typeof data.requestId === "string" ? data.requestId : undefined,
		progressNote:
			typeof data.progressNote === "string" ? data.progressNote : undefined,
		processNotes: clipResearchProcessNotes(data.processNotes),
		createdAt: timestampMillis(data.createdAt),
		quotaSettled: data.quotaSettled === true,
		quotaRefunded: data.quotaRefunded === true,
		chainPass: data.chainPass === 2 ? 2 : data.chainPass === 1 ? 1 : undefined,
		hop: parseResearchHop(data.hop),
		chainStarted: data.chainStarted === true,
		draftResult: data.draftResult,
		continueQueries: Array.isArray(data.continueQueries)
			? (data.continueQueries as string[])
			: undefined,
		continueFallbackQueries: Array.isArray(data.continueFallbackQueries)
			? (data.continueFallbackQueries as string[])
			: undefined,
		continueGuidance:
			typeof data.continueGuidance === "string"
				? data.continueGuidance
				: undefined,
		continueReadFull: Array.isArray(data.continueReadFull)
			? (data.continueReadFull as string[])
			: undefined,
		continueReadPali: Array.isArray(data.continueReadPali)
			? (data.continueReadPali as string[])
			: undefined,
		unreadFull: Array.isArray(data.unreadFull)
			? (data.unreadFull as string[])
			: undefined,
		fullReadSlugs: Array.isArray(data.fullReadSlugs)
			? (data.fullReadSlugs as string[])
			: undefined,
	};
}

async function readJob(
	uid: string,
	jobId: string,
): Promise<ResearchJobRecord | null> {
	const id = clipResearchJobId(jobId);
	if (!id || !uid) return null;
	if (!isFirebaseInitialized || !db) {
		return memory.get(jobKey(uid, id)) || null;
	}
	const snap = await jobsCol(uid).doc(id).get();
	if (!snap.exists) return null;
	return recordFromData(id, uid, snap.data() as Record<string, unknown>);
}

function jobPatchNeedsLease(patch: Partial<ResearchJobRecord>): boolean {
	return (
		patch.runToken !== undefined ||
		patch.status !== undefined ||
		patch.result !== undefined ||
		patch.draftResult !== undefined ||
		patch.cancelRequested !== undefined ||
		patch.chainPass !== undefined ||
		patch.hop !== undefined ||
		patch.quotaSettled !== undefined ||
		"error" in patch
	);
}

async function writeJob(
	record: ResearchJobRecord,
	patch: Partial<ResearchJobRecord> = {},
): Promise<ResearchJobRecord> {
	const takingOver =
		typeof patch.runToken === "string" && patch.runToken.length > 0;
	const key = jobKey(record.uid, record.id);
	const existingMem = memory.get(key);
	if (
		existingMem &&
		existingMem.runToken &&
		existingMem.runToken !== record.runToken &&
		!takingOver
	) {
		return existingMem;
	}
	const processNotes =
		typeof patch.progressNote === "string"
			? rememberResearchProcessNote(
					patch.processNotes ?? record.processNotes,
					patch.progressNote,
				)
			: patch.processNotes !== undefined
				? patch.processNotes
				: record.processNotes;
	const merged: Partial<ResearchJobRecord> = {
		...patch,
		...(processNotes !== undefined ? { processNotes } : {}),
	};
	const next = { ...record, ...merged };
	const stored: Record<string, unknown> = {
		updatedAt: FieldValue.serverTimestamp(),
	};
	for (const [keyName, value] of Object.entries(merged)) {
		if (keyName === "id" || keyName === "uid") continue;
		if (value === undefined) continue;
		stored[keyName] = value;
	}
	if (!isFirebaseInitialized || !db) {
		memory.set(key, next);
		return next;
	}
	const ref = jobsCol(next.uid).doc(next.id);
	if (!jobPatchNeedsLease(patch)) {
		memory.set(key, next);
		await ref.set(stored, { merge: true });
		return next;
	}
	const applied = await db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (snap.exists) {
			const storedToken = (snap.data() as Record<string, unknown>).runToken;
			if (
				typeof storedToken === "string" &&
				storedToken &&
				storedToken !== record.runToken &&
				!takingOver
			) {
				return { stale: true as const, data: snap.data() as Record<string, unknown> };
			}
		}
		tx.set(ref, stored, { merge: true });
		return { stale: false as const };
	});
	if (applied.stale) {
		const fresh = recordFromData(next.id, next.uid, applied.data);
		if (fresh) memory.set(key, fresh);
		return fresh || existingMem || record;
	}
	memory.set(key, next);
	return next;
}

async function throwIfCancelled(record: ResearchJobRecord): Promise<void> {
	const fresh = await readJob(record.uid, record.id);
	if (fresh && fresh.runToken && fresh.runToken !== record.runToken) {
		throw new ResearchStaleWorkerError();
	}
	if (fresh?.cancelRequested || fresh?.status === "cancelled") {
		throw new ResearchCancelledError();
	}
}

export async function createResearchJob(options: {
	user: UserRecord;
	question: string;
	history?: unknown;
	origin?: string;
	clarifyBrief?: string;
}): Promise<{ job: ResearchJobPublic; runToken: string }> {
	const id = newId();
	const runToken = newId();
	const record: ResearchJobRecord = {
		id,
		uid: options.user.uid,
		email: options.user.email || "",
		origin: (options.origin || OPENROUTER_SITE_URL).replace(/\/+$/, ""),
		status: "queued",
		question: options.question,
		originalQuestion: options.question,
		history: options.history ?? [],
		runToken,
		cancelRequested: false,
		requestId: newAiAskRequestId(),
		progressNote: "Starting…",
		processNotes: [],
		createdAt: Date.now(),
		chainPass: 1,
		hop: 1,
		...(options.clarifyBrief
			? { clarifyBrief: options.clarifyBrief.slice(0, 1200) }
			: {}),
	};
	memory.set(jobKey(record.uid, record.id), record);
	if (isFirebaseInitialized && db) {
		await jobsCol(record.uid).doc(record.id).set(
			{
				...record,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);
	}
	return { job: recordToPublic(record), runToken };
}

export async function getResearchJobForUser(
	uid: string,
	jobId: string,
): Promise<ResearchJobPublic | null> {
	const record = await readJob(uid, jobId);
	if (!record) return null;
	// Failed jobs and empty completes refund on read (time-independent). Do
	// not re-evaluate cancelled jobs here: an early stop must keep its credit
	// even after the refund window.
	if (record.status === "failed") {
		return recordToPublic(await settleResearchJobQuota(record));
	}
	if (
		record.status === "complete" &&
		(sanitizeResearchJobResult(record.result)?.results.length ?? 0) === 0
	) {
		return recordToPublic(await settleResearchJobQuota(record));
	}
	return recordToPublic(record);
}

async function claimResearchQuotaRefund(
	record: ResearchJobRecord,
): Promise<boolean> {
	if (record.quotaRefunded || record.quotaSettled) return false;
	const key = jobKey(record.uid, record.id);
	if (!isFirebaseInitialized || !db) {
		const current = memory.get(key) || record;
		if (current.quotaRefunded || current.quotaSettled) return false;
		memory.set(key, { ...current, quotaSettled: true, quotaRefunded: true });
		return true;
	}
	const claimed = await db.runTransaction(async (tx) => {
		const ref = jobsCol(record.uid).doc(record.id);
		const snap = await tx.get(ref);
		if (!snap.exists) return false;
		const data = snap.data() as Record<string, unknown>;
		if (data.quotaRefunded === true || data.quotaSettled === true) return false;
		tx.set(
			ref,
			{
				quotaSettled: true,
				quotaRefunded: true,
				updatedAt: FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);
		return true;
	});
	if (claimed) {
		const current = memory.get(key) || record;
		memory.set(key, { ...current, quotaSettled: true, quotaRefunded: true });
	}
	return claimed;
}

async function settleResearchJobQuota(
	record: ResearchJobRecord,
	now = Date.now(),
): Promise<ResearchJobRecord> {
	if (record.quotaRefunded || record.quotaSettled) return record;
	const completeResults =
		record.status === "complete"
			? sanitizeResearchJobResult(record.result)?.results.length ?? 0
			: undefined;
	if (
		!shouldRefundResearchCredit({
			status: record.status,
			createdAt: record.createdAt,
			now,
			resultCount: completeResults,
		})
	) {
		return writeJob(record, { quotaSettled: true });
	}
	try {
		const claimed = await claimResearchQuotaRefund(record);
		if (!claimed) {
			return { ...record, quotaSettled: true, quotaRefunded: true };
		}
		await refundResearchQuota({
			uid: record.uid,
			now,
			day: utcResearchDay(record.createdAt || now),
		});
		return { ...record, quotaSettled: true, quotaRefunded: true };
	} catch (error) {
		console.error("[ai/research] quota refund failed", error);
		try {
			await writeJob(record, { quotaSettled: false, quotaRefunded: false });
		} catch {
			/* keep trying on a later failed-job read */
		}
		return record;
	}
}

export async function listRecentResearchJobsForUser(
	uid: string,
	limit = 8,
): Promise<ResearchJobPublic[]> {
	const seen = new Map<string, ResearchJobRecord>();
	for (const record of memory.values()) {
		if (record.uid === uid) seen.set(record.id, record);
	}
	if (isFirebaseInitialized && db) {
		try {
			const snap = await jobsCol(uid)
				.orderBy("updatedAt", "desc")
				.limit(Math.max(1, Math.min(20, Math.floor(limit))))
				.get();
			for (const doc of snap.docs) {
				const record = recordFromData(
					doc.id,
					uid,
					doc.data() as Record<string, unknown>,
				);
				if (record) seen.set(record.id, record);
			}
		} catch {
			/* missing index / empty collection — memory jobs still count */
		}
	}
	return [...seen.values()]
		.sort((a, b) => {
			const aDone = isResearchJobTerminal(a.status) ? 1 : 0;
			const bDone = isResearchJobTerminal(b.status) ? 1 : 0;
			if (aDone !== bDone) return aDone - bDone;
			return 0;
		})
		.slice(0, Math.max(1, Math.min(20, Math.floor(limit))))
		.map(recordToPublic);
}

export async function requestResearchJobCancel(
	uid: string,
	jobId: string,
): Promise<ResearchJobPublic | null> {
	const record = await readJob(uid, jobId);
	if (!record) return null;
	if (isResearchJobTerminal(record.status)) {
		if (record.status === "failed") {
			return recordToPublic(await settleResearchJobQuota(record));
		}
		if (
			record.status === "complete" &&
			(sanitizeResearchJobResult(record.result)?.results.length ?? 0) === 0
		) {
			return recordToPublic(await settleResearchJobQuota(record));
		}
		return recordToPublic(record);
	}
	const next = await writeJob(record, {
		cancelRequested: true,
		status: "cancelled",
		error: "Research stopped.",
	});
	const settled = await settleResearchJobQuota(next);
	return recordToPublic(settled);
}

export async function retryResearchJob(options: {
	uid: string;
	jobId: string;
	requestUrl: string;
}): Promise<
	| { ok: true; job: ResearchJobPublic; runToken: string; reusedCredit: boolean }
	| {
			ok: false;
			code: "not_found" | "not_retryable" | "research_quota";
			error: string;
			job?: ResearchJobPublic;
			researchQuota?: Awaited<ReturnType<typeof consumeResearchQuota>>["view"];
	  }
> {
	const record = await readJob(options.uid, options.jobId);
	if (!record) {
		return { ok: false, code: "not_found", error: "Research not found." };
	}
	if (!isResearchJobTerminal(record.status)) {
		return {
			ok: true,
			job: recordToPublic(record),
			runToken: record.runToken,
			reusedCredit: true,
		};
	}
	if (!isResearchJobRetryable(record.status)) {
		return {
			ok: false,
			code: "not_retryable",
			error: "This research already finished.",
			job: recordToPublic(record),
		};
	}
	const reusedCredit = researchJobRetryReusesCredit(record);
	if (!reusedCredit) {
		const quota = await consumeResearchQuota({ uid: options.uid });
		if (!quota.allowed) {
			return {
				ok: false,
				code: "research_quota",
				error: "You’ve used today’s Research. Come back tomorrow.",
				researchQuota: quota.view,
			};
		}
	}
	const runToken = newId();
	const next = await writeJob(record, {
		status: "queued",
		runToken,
		cancelRequested: false,
		error: "",
		progressNote: "Starting…",
		emailSent: false,
		chainPass: 1,
		hop: 1,
		chainStarted: false,
		draftResult: null,
		continueQueries: [],
		continueFallbackQueries: [],
		continueGuidance: "",
		continueReadFull: [],
		continueReadPali: [],
		unreadFull: [],
		fullReadSlugs: [],
		processNotes: [],
		result: null,
		reasoning: "",
		lookingFor: "",
		queries: [],
		fallbackQueries: [],
		candidateCount: 0,
		showCount: 0,
		verifyNote: "",
		quotaSettled: false,
		quotaRefunded: false,
		createdAt: Date.now(),
	});
	void startResearchJobWorker({
		requestUrl: options.requestUrl,
		uid: options.uid,
		jobId: next.id,
		runToken,
	});
	return {
		ok: true,
		job: recordToPublic(next),
		runToken,
		reusedCredit,
	};
}

async function retryOnce<T>(
	label: string,
	fn: () => Promise<T>,
	onRetry?: () => void | Promise<void>,
): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		console.warn(
			`[ai/research] ${label} failed, retrying`,
			error instanceof Error ? error.message : error,
		);
		await onRetry?.();
		return fn();
	}
}

function timeLeft(startedAt: number): number {
	return ASK_FUNCTION_BUDGET_MS - (Date.now() - startedAt);
}

async function withCatalogTitles(
	hits: AiDiscourseHit[],
): Promise<AiDiscourseHit[]> {
	return Promise.all(
		hits.map(async (hit) => {
			const doc = await getSearchDocBySlug(hit.slug, true);
			const title = (doc?.title || hit.title || "")
				.replace(/\s+/g, " ")
				.trim();
			const description = (doc?.description || hit.description || "")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 280);
			const volpage = getPtsDisplay(hit.slug) || hit.volpage || "";
			return {
				...hit,
				title: title || hit.title,
				description,
				...(volpage ? { volpage } : {}),
			};
		}),
	);
}

async function planResearchRefine(input: {
	question: string;
	brief: string;
	triedQueries: readonly string[];
	hits: readonly AiDiscourseHit[];
	termQueries?: readonly string[];
	namedQueries?: readonly string[];
}): Promise<ReturnType<typeof parseResearchRefinePlan>> {
	if (!getOpenRouterApiKey()) {
		return parseResearchRefinePlan("");
	}
	const selectedSlugs = input.hits.map((hit) => hit.slug);
	const tried = input.triedQueries.filter(Boolean).join(", ");
	try {
		const evidence = await buildResearchReportEvidence({
			question: input.question,
			hits: input.hits,
			termQueries: input.termQueries,
			namedQueries: input.namedQueries,
		});
		const reply = await openRouterChat({
			model: ASK_PLANNER_PAID_FALLBACK_MODEL,
			jsonMode: true,
			maxTokens: 700,
			messages: [
				{ role: "system", content: RESEARCH_REFINE_SYSTEM },
				{
					role: "user",
					content: `Question: ${input.question.replace(/\s+/g, " ").trim()}
${input.brief ? `Clarifying brief:\n${input.brief}\n` : ""}Tried queries: ${tried || "(none)"}
Passages from the selected discourses (excerpts, and full text where named IDs were opened):
${evidence.trim() || "(none)"}

JSON:`,
				},
			],
		});
		return parseResearchRefinePlan(
			reply.content,
			input.triedQueries,
			selectedSlugs,
		);
	} catch (error) {
		console.warn(
			"[ai/research] refine planner failed",
			error instanceof Error ? error.message : error,
		);
		return parseResearchRefinePlan("");
	}
}

async function evaluateResearchContinue(input: {
	question: string;
	brief: string;
	report: string;
	hits: readonly AiDiscourseHit[];
	triedQueries: readonly string[];
}): Promise<ReturnType<typeof parseResearchContinueDecision>> {
	if (!getOpenRouterApiKey()) {
		return parseResearchContinueDecision("");
	}
	const selected = input.hits
		.map((hit) => formatResearchSourceLine(hit))
		.join("\n");
	const tried = input.triedQueries.filter(Boolean).join(", ");
	const report = input.report.replace(/\r\n/g, "\n").trim().slice(0, 8_000);
	try {
		const reply = await openRouterChat({
			model: ASK_PLANNER_PAID_FALLBACK_MODEL,
			jsonMode: true,
			maxTokens: 700,
			messages: [
				{ role: "system", content: RESEARCH_CONTINUE_SYSTEM },
				{
					role: "user",
					content: `Question: ${input.question.replace(/\s+/g, " ").trim()}
${input.brief ? `Clarifying brief:\n${input.brief}\n` : ""}Tried queries: ${tried || "(none)"}
Selected discourses:
${selected || "(none)"}

Report:
${report || "(empty)"}

JSON:`,
				},
			],
		});
		return parseResearchContinueDecision(
			reply.content,
			input.triedQueries,
			input.hits.map((hit) => hit.slug),
		);
	} catch (error) {
		console.warn(
			"[ai/research] continue review failed",
			error instanceof Error ? error.message : error,
		);
		return parseResearchContinueDecision("");
	}
}

async function followUpResearchPaliRead(input: {
	written: ResearchReportResult;
	startedAt: number;
	onProgress: (slugs: readonly string[]) => Promise<void>;
	write: (timeoutMs: number) => Promise<ResearchReportResult>;
}): Promise<ResearchReportResult> {
	const slugs = input.written.readPali || [];
	if (!input.written.report || slugs.length === 0) return input.written;
	const timeoutMs = resolveAskWriterBudgetMs(Date.now() - input.startedAt);
	if (timeoutMs <= 0) return input.written;
	await input.onProgress(slugs);
	try {
		const again = await input.write(timeoutMs);
		return again.report ? again : input.written;
	} catch (error) {
		console.warn(
			"[ai/research] pali reread failed",
			error instanceof Error ? error.message : error,
		);
		return input.written;
	}
}

async function finalizeFromDraft(
	uid: string,
	jobId: string,
	expectedToken?: string,
): Promise<void> {
	const fresh = await readJob(uid, jobId);
	if (!fresh || isResearchJobTerminal(fresh.status)) return;
	if (expectedToken && fresh.runToken !== expectedToken) return;
	const draft = sanitizeResearchJobResult(fresh.draftResult);
	if (!draft?.report) {
		const failed = await writeJob(fresh, {
			status: "failed",
			error: "Research could not finish. Try again shortly.",
		});
		await settleResearchJobQuota(failed);
		return;
	}
	const next = await writeJob(fresh, {
		status: "complete",
		lookingFor: draft.lookingFor,
		queries: draft.queries,
		fallbackQueries: draft.fallbackQueries,
		showCount: draft.results.length,
		candidateCount: draft.candidateCount,
		reasoning: draft.reasoning,
		progressNote: "",
		result: draft,
	});
	await persistHistory(next, draft);
	await finishEmail(next, true);
}

async function enqueueResearchContinue(options: {
	uid: string;
	jobId: string;
	runToken: string;
	requestUrl?: string;
	origin: string;
}): Promise<boolean> {
	const base = (options.requestUrl || options.origin || "").replace(/\/+$/, "");
	if (!base) return false;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const runUrl = new URL("/api/ai/research/run", `${base}/`);
			const res = await fetch(runUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					uid: options.uid,
					jobId: options.jobId,
					runToken: options.runToken,
				}),
			});
			if (res.ok) return true;
		} catch (error) {
			console.warn(
				"[ai/research] continue enqueue failed",
				error instanceof Error ? error.message : error,
			);
		}
	}
	return false;
}

export async function runResearchJobAndMaybeChain(options: {
	uid: string;
	jobId: string;
	runToken: string;
	requestUrl?: string;
}): Promise<void> {
	const outcome = await runResearchJob(options);
	if (outcome !== "chained") return;
	const record = await readJob(options.uid, options.jobId);
	if (
		!record ||
		isResearchJobTerminal(record.status)
	) {
		return;
	}
	const hop = parseResearchHop(record.hop);
	if (hop < 2 && record.chainPass !== 2) return;
	const enqueued = await enqueueResearchContinue({
		uid: options.uid,
		jobId: options.jobId,
		runToken: options.runToken,
		requestUrl: options.requestUrl,
		origin: record.origin,
	});
	if (enqueued) return;
	await runResearchJob(options);
}

function surveyPlan(
	plan: AiRewritePlan,
	question: string,
	brief: string,
): AiRewritePlan {
	const fallback = parseRewritePlan("", question);
	const queries = plan.queries.length > 0 ? plan.queries : fallback.queries;
	const fallbackQueries =
		plan.fallbackQueries.length > 0
			? plan.fallbackQueries
			: fallback.fallbackQueries;
	const ranking = [plan.rankingGuidance, brief]
		.map((part) => part.replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.join(" ");
	return {
		...plan,
		offTopic: false,
		coverage: "survey",
		queries,
		fallbackQueries,
		...(ranking ? { rankingGuidance: ranking } : {}),
	};
}

async function runResearchChainPass(
	record: ResearchJobRecord,
): Promise<"chained" | "done"> {
	let current = record;
	const startedAt = Date.now();
	const draft = sanitizeResearchJobResult(current.draftResult);
	if (!draft?.report) {
		await finalizeFromDraft(current.uid, current.id, current.runToken);
		return;
	}
	const continueQueries = (current.continueQueries || []).filter(Boolean);
	let readFull = (current.continueReadFull || []).filter(Boolean);
	const readPali = (current.continueReadPali || []).filter(Boolean);
	if (readFull.length === 0 && (current.unreadFull || []).length > 0) {
		readFull = nextUnreadFullBatch(current.unreadFull || []).batch;
	}
	if (
		continueQueries.length === 0 &&
		readFull.length === 0 &&
		readPali.length === 0
	) {
		await finalizeFromDraft(current.uid, current.id, current.runToken);
		return "done";
	}

	const history: readonly AiRewriteHistoryTurn[] = parseAskHistory(
		current.history,
	);
	const brief = (current.clarifyBrief || "").trim();
	const question = draft.question || current.question;
	const plan = surveyPlan(
		{
			...parseRewritePlan("", question),
			lookingFor: current.lookingFor || draft.lookingFor,
			queries: continueQueries,
			fallbackQueries: current.continueFallbackQueries || [],
			rankingGuidance: current.continueGuidance || "",
			coverage: "survey",
			offTopic: false,
		},
		question,
		brief,
	);
	let pool: AiDiscourseHit[] = [...draft.results];
	let results = [...draft.results];
	let report = draft.report;
	let reasoning = current.reasoning || draft.reasoning || "";
	let usedModel = draft.model || ASK_PLANNER_PAID_FALLBACK_MODEL;
	let summary = draft.summary || "";
	const shareSlug = draft.shareSlug || "";
	const requestId = current.requestId || draft.requestId || newAiAskRequestId();
	const showCount = Math.max(
		RESEARCH_RERANK_MAX_LIMIT,
		draft.results.length,
	);

	const settleCancelledJob = async (): Promise<void> => {
		const fresh = await readJob(current.uid, current.id);
		if (!fresh) return;
		if (fresh.runToken !== record.runToken) return;
		if (fresh.status === "failed") {
			await settleResearchJobQuota(fresh);
			return;
		}
		if (isResearchJobTerminal(fresh.status)) return;
		const cancelled = await writeJob(fresh, {
			status: "cancelled",
			error: "Research stopped.",
		});
		await settleResearchJobQuota(cancelled);
	};

	const commitDraft = async (): Promise<void> => {
		await finalizeFromDraft(current.uid, current.id, record.runToken);
	};

	try {
		await throwIfCancelled(current);
		await warmAskSearchIndexes().catch((error) => {
			console.warn("[ai/research] search index warm failed", error);
		});
		current = await writeJob(current, {
			status: continueQueries.length > 0 ? "searching" : "answering",
			progressNote:
				continueQueries.length > 0
					? "Going deeper…"
					: formatResearchReadProgress({ readFull, readPali }),
		});
		if (continueQueries.length > 0) {
			try {
			const searched = await searchDiscoursesForQueries(
				plan.queries,
				plan.fallbackQueries,
				{
					mergeLimit: AI_SEARCH_CANDIDATE_LIMIT,
					question,
					termQueries: plan.termQueries,
					onProgress: (info) => {
						const progressNote = `Going deeper · ${info.done} of ${info.total} queries`;
						current = { ...current, progressNote };
						void writeJob(current, { progressNote });
					},
				},
			);
			const known = new Set(pool.map((hit) => hit.slug));
			const freshHits: AiDiscourseHit[] = [];
			for (const hit of searched.hits) {
				if (known.has(hit.slug)) continue;
				known.add(hit.slug);
				pool.push(hit);
				freshHits.push(hit);
			}
			if (
				freshHits.length === 0 &&
				readFull.length === 0 &&
				readPali.length === 0
			) {
				await commitDraft();
				return "done";
			}
			if (timeLeft(startedAt) > RESEARCH_ASSEMBLE_MS + 40_000) {
				current = await writeJob(current, {
					status: "crunching",
					candidateCount: pool.length,
					progressNote: `Crunching ${pool.length.toLocaleString()} discourses…`,
				});
				try {
					const ranked = await rerankDiscourseHits({
						question,
						candidates: pool,
						fallbackQueries: [
							...draft.fallbackQueries,
							...plan.fallbackQueries,
						],
						history,
						limit: showCount,
						openRouterModel: ASK_PLANNER_PAID_FALLBACK_MODEL,
						guidance: [plan.rankingGuidance, current.continueGuidance]
							.filter(Boolean)
							.join(" "),
						planningNotes: reasoning,
						primaryQueries: [...draft.queries, ...plan.queries],
						termQueries: plan.termQueries,
						...RESEARCH_RERANK_CAPS,
					});
					results = ranked.results.map(toPublicAskHit);
					if (ranked.summary) summary = ranked.summary;
				} catch (error) {
					console.warn(
						"[ai/research] continue rerank failed — merging new hits",
						error instanceof Error ? error.message : error,
					);
					const have = new Set(results.map((hit) => hit.slug));
					for (const hit of freshHits) {
						if (have.has(hit.slug)) continue;
						have.add(hit.slug);
						results.push(toPublicAskHit(hit));
						if (results.length >= showCount) break;
					}
				}
			} else {
				const have = new Set(results.map((hit) => hit.slug));
				for (const hit of freshHits) {
					if (have.has(hit.slug)) continue;
					have.add(hit.slug);
					results.push(toPublicAskHit(hit));
					if (results.length >= showCount) break;
				}
			}
		} catch (error) {
			console.warn(
				"[ai/research] continue search failed",
				error instanceof Error ? error.message : error,
			);
			if (readFull.length === 0 && readPali.length === 0) {
				await commitDraft();
				return "done";
			}
		}
		}

		results = await withCatalogTitles(results);
		const writerBudget = resolveAskWriterBudgetMs(Date.now() - startedAt);
		if (
			results.length === 0 ||
			!getOpenRouterApiKey() ||
			writerBudget <= 0
		) {
			await commitDraft();
			return "done";
		}
		current = await writeJob(current, {
			status: "answering",
			showCount: results.length,
			candidateCount: pool.length,
			progressNote: "Rewriting the report…",
		});
		await throwIfCancelled(current);
		try {
			const written = await retryOnce(
				"continue-report",
				() =>
					writeResearchReport({
						question,
						brief,
						hits: results,
						model: ASK_PLANNER_PAID_FALLBACK_MODEL,
						termQueries: plan.termQueries,
						guidance: current.continueGuidance || plan.rankingGuidance,
						history,
						timeoutMs: writerBudget,
						priorReport: draft.report,
						namedQueries: [
							...collectDirectDiscourseIds({ question }),
							...plan.queries,
							...plan.fallbackQueries,
							...(plan.termQueries || []),
						],
						readFullSlugs: readFull,
						readPaliSlugs: readPali,
						onReasoning: (delta) => {
							const next = `${current.reasoning || ""}${delta}`;
							current = { ...current, reasoning: next };
							void writeJob(current, { reasoning: next });
						},
					}),
				() => {
					void writeJob(current, {
						progressNote: "Rewriting the report again…",
					});
				},
			);
			const followed = await followUpResearchPaliRead({
				written,
				startedAt,
				onProgress: async (slugs) => {
					current = await writeJob(current, {
						status: "answering",
						progressNote: formatResearchReadProgress({
							readPali: slugs,
						}),
					});
					await throwIfCancelled(current);
				},
				write: (timeoutMs) =>
					writeResearchReport({
						question,
						brief,
						hits: results,
						model: ASK_PLANNER_PAID_FALLBACK_MODEL,
						termQueries: plan.termQueries,
						guidance: current.continueGuidance || plan.rankingGuidance,
						history,
						timeoutMs,
						priorReport: written.report,
						namedQueries: [
							...collectDirectDiscourseIds({ question }),
							...plan.queries,
							...plan.fallbackQueries,
							...(plan.termQueries || []),
						],
						readFullSlugs: [...readFull, ...(written.readPali || [])],
						readPaliSlugs: written.readPali,
						onReasoning: (delta) => {
							const next = `${current.reasoning || ""}${delta}`;
							current = { ...current, reasoning: next };
							void writeJob(current, { reasoning: next });
						},
					}),
			});
			if (!followed.report) {
				await commitDraft();
				return "done";
			}
			report = followed.report;
			usedModel = `${usedModel} + ${followed.model || ASK_PLANNER_PAID_FALLBACK_MODEL}`;
			if (followed.reasoning) reasoning = followed.reasoning;
		} catch (error) {
			console.warn(
				"[ai/research] continue writer failed — keeping first report",
				error instanceof Error ? error.message : error,
			);
			await commitDraft();
			return "done";
		}

		await throwIfCancelled(current);
		const fresh = await readJob(current.uid, current.id);
		if (!fresh || isResearchJobTerminal(fresh.status)) return "done";
		current = fresh;
		if (!summary && report) {
			summary = report.replace(/\s+/g, " ").trim().slice(0, 4800);
		}
		const persons = resolveAskPersonHits({
			correctedQuestion: plan.correctedQuestion,
			lookingFor: plan.lookingFor,
			queries: plan.queries,
			fallbackQueries: plan.fallbackQueries,
			personSlugs: plan.personSlugs,
		});
		const result: ResearchJobResult = {
			question,
			originalQuestion: current.originalQuestion,
			lookingFor: plan.lookingFor || draft.lookingFor,
			queries: [...draft.queries, ...plan.queries],
			fallbackQueries:
				plan.fallbackQueries.length > 0
					? plan.fallbackQueries
					: draft.fallbackQueries,
			offTopic: false,
			results,
			...(persons.length > 0 ? { persons } : {}),
			model: usedModel,
			reasoning,
			...(summary ? { summary } : {}),
			report,
			...(shareSlug ? { shareSlug } : {}),
			candidateCount: pool.length,
			requestId,
		};
		const alreadyRead = [
			...(current.fullReadSlugs || []),
			...readFull,
			...readPali,
		];
		const unread = unreadFullAfterReads(
			(current.unreadFull || []).length > 0
				? current.unreadFull || []
				: results.map((hit) => hit.slug),
			alreadyRead,
		);
		const hop = parseResearchHop(current.hop);
		const nextHop = nextResearchHop(hop);
		logResearchHop({
			hop,
			pool: pool.length,
			selected: results.length,
			fullRead: readFull.length,
			unreadFull: unread.length,
			continue: continueQueries.length > 0,
		});
		if (nextHop && unread.length > 0) {
			const { batch, rest } = nextUnreadFullBatch(unread);
			current = await writeJob(current, {
				status: "searching",
				chainPass: 2,
				hop: nextHop,
				chainStarted: false,
				draftResult: { ...result, report, reasoning },
				continueQueries: [],
				continueFallbackQueries: [],
				continueReadFull: batch,
				continueReadPali: [],
				unreadFull: rest,
				fullReadSlugs: alreadyRead,
				progressNote: formatResearchReadProgress({ readFull: batch }),
				lookingFor: result.lookingFor,
				queries: result.queries,
				fallbackQueries: result.fallbackQueries,
				showCount: results.length,
				candidateCount: pool.length,
				reasoning,
			});
			return "chained";
		}
		current = await writeJob(current, {
			status: "complete",
			lookingFor: result.lookingFor,
			queries: result.queries,
			fallbackQueries: result.fallbackQueries,
			showCount: results.length,
			candidateCount: pool.length,
			reasoning,
			progressNote: "",
			result,
		});
		if (current.runToken !== record.runToken) return "done";
		await persistHistory(current, result);
		await finishEmail(current, true);
		return "done";
	} catch (error) {
		if (error instanceof ResearchStaleWorkerError) return "done";
		if (error instanceof ResearchCancelledError) {
			await settleCancelledJob();
			return "done";
		}
		console.warn(
			"[ai/research] continue pass failed — keeping first report",
			error instanceof Error ? error.message : error,
		);
		await commitDraft();
		return "done";
	}
}

export async function runResearchJob(options: {
	uid: string;
	jobId: string;
	runToken: string;
	requestUrl?: string;
}): Promise<"chained" | "done"> {
	const record = await readJob(options.uid, options.jobId);
	if (!record) return "done";
	if (record.runToken !== options.runToken) return "done";
	if (isResearchJobTerminal(record.status)) return "done";
	if ((record.hop && record.hop >= 2) || record.chainPass === 2) {
		if (record.chainStarted) return "done";
		const current = await writeJob(record, {
			chainStarted: true,
			status: "searching",
			progressNote: "Going deeper…",
		});
		return runResearchChainPass(current);
	}
	if (record.status !== "queued") return "done";

	let current = await writeJob(record, {
		status: "running",
		progressNote: "Planning searches…",
	});
	const startedAt = Date.now();
	const history: readonly AiRewriteHistoryTurn[] = parseAskHistory(
		current.history,
	);
	const requestId = current.requestId || newAiAskRequestId();
	const brief = (current.clarifyBrief || "").trim();
	const indexesReady = warmAskSearchIndexes().catch((error) => {
		console.warn("[ai/research] search index warm failed", error);
	});

	const persistTelemetry = (input: {
		displayQuestion: string;
		lookingFor: string;
		queries: string[];
		fallbackQueries: string[];
		offTopic: boolean;
		results: { slug?: string }[];
		model: string;
		reasoning: string;
		summary?: string;
	}) => {
		void recordAiAskTelemetry(
			buildAiAskTelemetryAskEvent({
				requestId,
				question: input.displayQuestion || current.question,
				lookingFor: input.lookingFor,
				queries: input.queries,
				fallbackQueries: input.fallbackQueries,
				resultSlugs: input.results
					.map((item) => item.slug || "")
					.filter(Boolean),
				model: input.model,
				reasoning: input.reasoning,
				summary: input.summary,
				offTopic: input.offTopic,
				ms: Date.now() - startedAt,
				mode: "research",
				jobId: current.id,
			}),
		);
	};

	let plan: AiRewritePlan = parseRewritePlan("", current.question);
	let reasoning = "";
	let usedModel = ASK_PLANNER_PAID_FALLBACK_MODEL;
	let pool: AiDiscourseHit[] = [];
	let searchBatches: AiDiscourseSearchBatch[] = [];
	let results: AiDiscourseHit[] = [];
	let report = "";
	let summary = "";
	let shareSlug = "";
	let shownQueries: string[] = [];
	let usefulFallbacks: string[] = [];

	const assembleArtifact = (): ResearchJobResult => {
		const displayQuestion = plan.correctedQuestion || current.question;
		if (!report) {
			report = fallbackResearchReport({
				question: displayQuestion,
				hits: results,
				emptyReason:
					results.length === 0
						? "The library search did not return matching discourses for this brief."
						: undefined,
			});
		}
		if (!summary && report) {
			summary = report.replace(/\s+/g, " ").trim().slice(0, 4800);
		}
		const persons = resolveAskPersonHits({
			correctedQuestion: plan.correctedQuestion,
			lookingFor: plan.lookingFor,
			queries: plan.queries,
			fallbackQueries: plan.fallbackQueries,
			personSlugs: plan.personSlugs,
		});
		return {
			question: displayQuestion,
			originalQuestion: current.originalQuestion,
			lookingFor: plan.lookingFor,
			queries: shownQueries.length > 0 ? shownQueries : plan.queries,
			fallbackQueries:
				usefulFallbacks.length > 0 ? usefulFallbacks : plan.fallbackQueries,
			offTopic: false,
			results,
			...(persons.length > 0 ? { persons } : {}),
			model: usedModel,
			reasoning,
			...(summary ? { summary } : {}),
			...(report ? { report } : {}),
			...(shareSlug ? { shareSlug } : {}),
			candidateCount: pool.length,
			requestId,
		};
	};

	const commitComplete = async (
		result: ResearchJobResult,
		ok: boolean,
	): Promise<void> => {
		await throwIfCancelled(current);
		const fresh = await readJob(current.uid, current.id);
		if (!fresh || isResearchJobTerminal(fresh.status)) return;
		current = fresh;
		current = await writeJob(current, {
			status: "complete",
			lookingFor: plan.lookingFor,
			queries: result.queries,
			fallbackQueries: result.fallbackQueries,
			showCount: results.length,
			candidateCount: pool.length,
			reasoning,
			progressNote: "",
			result,
		});
		if (current.runToken !== options.runToken) return;
		persistTelemetry({
			displayQuestion: result.question,
			lookingFor: result.lookingFor,
			queries: plan.queries,
			fallbackQueries: result.fallbackQueries,
			offTopic: false,
			results,
			model: usedModel,
			reasoning,
			summary,
		});
		await persistHistory(current, result);
		await finishEmail(current, ok);
		if (result.results.length === 0) {
			current = await settleResearchJobQuota(current);
		}
	};

	const completeWithArtifact = async (ok: boolean): Promise<void> => {
		await commitComplete(assembleArtifact(), ok);
	};

	const queueContinueIfNeeded = async (): Promise<boolean> => {
		const artifact = assembleArtifact();
		if (!artifact.report || artifact.results.length === 0) return false;
		const alreadyRead = current.fullReadSlugs || [];
		const unread = unreadFullAfterReads(
			(current.unreadFull || []).length > 0
				? current.unreadFull || []
				: artifact.results.map((hit) => hit.slug),
			alreadyRead,
		);
		let extraQueries: string[] = [];
		let extraFallback: string[] = [];
		let extraPali: string[] = [];
		let extraFull: string[] = [];
		let guidance = "";
		if (shouldEvaluateResearchContinue(timeLeft(startedAt))) {
			current = await writeJob(current, {
				status: "answering",
				progressNote: "Reviewing the report…",
			});
			await throwIfCancelled(current);
			try {
				const decision = await evaluateResearchContinue({
					question: artifact.question,
					brief,
					report: artifact.report,
					hits: artifact.results,
					triedQueries: [
						...plan.queries,
						...plan.fallbackQueries,
						...shownQueries,
					],
				});
				extraQueries = decision.queries;
				extraFallback = decision.fallbackQueries;
				extraPali = decision.readPali;
				extraFull = unreadFullAfterReads(decision.readFull, alreadyRead);
				guidance = decision.guidance;
			} catch (error) {
				console.warn(
					"[ai/research] continue review skipped",
					error instanceof Error ? error.message : error,
				);
			}
		}
		const { batch, rest } = nextUnreadFullBatch([...extraFull, ...unread]);
		const wantChain =
			batch.length > 0 || extraQueries.length > 0 || extraPali.length > 0;
		logResearchHop({
			hop: 1,
			pool: pool.length,
			selected: artifact.results.length,
			expanded: Math.min(artifact.results.length, 28),
			fullRead: alreadyRead.length,
			unreadFull: unread.length,
			continue: extraQueries.length > 0,
			runPosted: wantChain,
		});
		if (!wantChain) return false;
		current = await writeJob(current, {
			status: "searching",
			chainPass: 2,
			hop: 2,
			chainStarted: false,
			draftResult: { ...artifact, report, reasoning },
			continueQueries: extraQueries,
			continueFallbackQueries: extraFallback,
			continueReadFull: batch,
			continueReadPali: extraPali,
			continueGuidance: guidance,
			unreadFull: rest,
			fullReadSlugs: alreadyRead,
			progressNote:
				extraQueries.length > 0
					? "Going deeper…"
					: formatResearchReadProgress({
							readFull: batch,
							readPali: extraPali,
						}),
			lookingFor: artifact.lookingFor,
			queries: artifact.queries,
			fallbackQueries: artifact.fallbackQueries,
			showCount: artifact.results.length,
			candidateCount: pool.length,
			reasoning,
		});
		return true;
	};

	const settleCancelledJob = async (): Promise<void> => {
		const fresh = await readJob(options.uid, options.jobId);
		if (!fresh) return;
		if (fresh.runToken !== options.runToken) return;
		if (fresh.status === "failed") {
			await settleResearchJobQuota(fresh);
			return;
		}
		if (isResearchJobTerminal(fresh.status)) return;
		const cancelled = await writeJob(fresh, {
			status: "cancelled",
			error: "Research stopped.",
		});
		await settleResearchJobQuota(cancelled);
	};

	try {
		await throwIfCancelled(current);
		try {
			const rewrite = await retryOnce(
				"plan",
				() =>
					rewriteAskQuestion({
						question: current.question,
						history,
						model: ASK_PLANNER_PAID_FALLBACK_MODEL,
						models: [ASK_PLANNER_PAID_FALLBACK_MODEL],
						attemptTimeoutMs: Math.min(
							RESEARCH_PLAN_MS,
							Math.max(20_000, timeLeft(startedAt) - 90_000),
						),
						onReasoning: (delta) => {
							const next = `${current.reasoning || ""}${delta}`;
							current = { ...current, reasoning: next };
							void writeJob(current, { reasoning: next });
						},
					}),
				() => {
					current = {
						...current,
						progressNote: "Planning searches again…",
					};
					void writeJob(current, { progressNote: "Planning searches again…" });
				},
			);
			plan = surveyPlan(rewrite.plan, current.question, brief);
			reasoning = rewrite.reasoning;
			usedModel = rewrite.model;
		} catch (error) {
			console.warn(
				"[ai/research] planner failed — synthesized queries",
				error instanceof Error ? error.message : error,
			);
			plan = surveyPlan(
				parseRewritePlan("", current.question),
				current.question,
				brief,
			);
		}
		current = await writeJob(current, {
			lookingFor: plan.lookingFor,
			queries: plan.queries,
			fallbackQueries: plan.fallbackQueries,
			offTopic: false,
			reasoning,
			status: "searching",
			progressNote: "Opening the library…",
		});
		await throwIfCancelled(current);
		await Promise.race([
			indexesReady,
			new Promise<void>((resolve) => {
				setTimeout(resolve, 12_000);
			}),
		]);

		const seenSlugs = new Set<string>();
		try {
			const searched = await searchDiscoursesForQueries(
				plan.queries,
				plan.fallbackQueries,
				{
					mergeLimit: AI_SEARCH_CANDIDATE_LIMIT,
					question: plan.correctedQuestion || current.question,
					termQueries: plan.termQueries,
					onProgress: (info) => {
						for (const slug of info.slugs) {
							if (slug) seenSlugs.add(slug);
						}
						const found =
							seenSlugs.size > 0
								? ` · ${seenSlugs.size.toLocaleString()} so far`
								: "";
						const progressNote = `Searching · ${info.done} of ${info.total} queries${found}`;
						current = {
							...current,
							progressNote,
							candidateCount: seenSlugs.size || current.candidateCount,
						};
						void writeJob(current, {
							progressNote,
							...(seenSlugs.size > 0
								? { candidateCount: seenSlugs.size }
								: {}),
						});
					},
				},
			);
			pool = searched.hits;
			searchBatches = searched.batches;
		} catch (error) {
			console.warn(
				"[ai/research] search failed",
				error instanceof Error ? error.message : error,
			);
			pool = [];
			searchBatches = [];
		}

		const searchedNote =
			pool.length > 0
				? `Searched · ${pool.length.toLocaleString()} discourses`
				: "Searched · no matching discourses yet";
		const showCount = RESEARCH_RERANK_MAX_LIMIT;
		const crunchNote =
			pool.length > 0
				? `Crunching ${pool.length.toLocaleString()} discourses…`
				: "Crunching candidates…";
		current = await writeJob(current, {
			status: "crunching",
			candidateCount: pool.length,
			showCount,
			progressNote: timeLeft(startedAt) > RESEARCH_ASSEMBLE_MS + 40_000 && pool.length > 0
				? crunchNote
				: searchedNote,
		});
		await throwIfCancelled(current);

		if (pool.length > 0 && timeLeft(startedAt) > RESEARCH_ASSEMBLE_MS + 40_000) {
			try {
				const ranked = await retryOnce(
					"rerank",
					() =>
						rerankDiscourseHits({
							question: plan.correctedQuestion || current.question,
							candidates: pool,
							fallbackQueries: plan.fallbackQueries,
							history,
							limit: showCount,
							openRouterModel: ASK_PLANNER_PAID_FALLBACK_MODEL,
							guidance: plan.rankingGuidance,
							planningNotes: reasoning,
							primaryQueries: plan.queries,
							termQueries: plan.termQueries,
							excludeSlugs: resolveRewriteExcludeSlugs(
								plan,
								collectAskHistoryShownSlugs(history),
								plan.correctedQuestion || current.question,
							),
							...RESEARCH_RERANK_CAPS,
						}),
					() => {
						void writeJob(current, {
							progressNote: "Crunching again…",
						});
					},
				);
				results = ranked.results.map(toPublicAskHit);
				summary = ranked.summary || "";
				shareSlug = resolveAskShareSlug(
					ranked.shareSlug || plan.shareSlug,
					plan.lookingFor,
					plan.correctedQuestion || current.question,
				);
				if (ranked.reranked) {
					const rerankLabel =
						ranked.provider === "openrouter"
							? ranked.model || "openrouter-rerank"
							: ranked.model || "gemini-rerank";
					usedModel = `${usedModel} + ${rerankLabel}`;
				}
				usefulFallbacks = ranked.usefulFallbackQueriesSpecified
					? ranked.usefulFallbackQueries
					: queriesForResultSlugs(
							plan.fallbackQueries,
							searchBatches,
							results.map((hit) => hit.slug),
						);
			} catch (error) {
				console.warn(
					"[ai/research] rerank failed — using search order",
					error instanceof Error ? error.message : error,
				);
				results = pool.slice(0, showCount).map(toPublicAskHit);
			}
		} else {
			results = pool.slice(0, showCount).map(toPublicAskHit);
		}

		const resultSlugs = results.map((hit) => hit.slug);
		if (usefulFallbacks.length === 0) {
			usefulFallbacks = queriesForResultSlugs(
				plan.fallbackQueries,
				searchBatches,
				resultSlugs,
			);
		}
		const contributingQueries = queriesForResultSlugs(
			plan.queries,
			searchBatches,
			resultSlugs,
		);
		shownQueries =
			contributingQueries.length > 0 ? contributingQueries : plan.queries;

		const namedQueries = [
			...collectDirectDiscourseIds({
				question: plan.correctedQuestion || current.question,
			}),
			...plan.queries,
			...plan.fallbackQueries,
			...(plan.termQueries || []),
		];
		let scoutReadFull: string[] = [];
		let scoutReadPali: string[] = [];
		let scoutGuidance = "";
		let scoutQueries: string[] = [];

		if (shouldAttemptResearchRefine(timeLeft(startedAt))) {
			await throwIfCancelled(current);
			current = await writeJob(current, {
				status: "reviewing",
				showCount: results.length,
				candidateCount: pool.length,
				progressNote: "Reviewing the evidence…",
			});
			const refine = await planResearchRefine({
				question: plan.correctedQuestion || current.question,
				brief,
				triedQueries: [...plan.queries, ...plan.fallbackQueries],
				hits: results,
				termQueries: plan.termQueries,
				namedQueries,
			});
			scoutReadFull = refine.readFull;
			scoutReadPali = refine.readPali;
			scoutGuidance = refine.guidance || refine.reason;
			scoutQueries = refine.queries;
			if (refine.needed && refine.queries.length > 0) {
				current = await writeJob(current, {
					progressNote: "Searching again…",
				});
				try {
					const second = await searchDiscoursesForQueries(
						refine.queries,
						refine.fallbackQueries,
						{
							mergeLimit: AI_SEARCH_CANDIDATE_LIMIT,
							question: plan.correctedQuestion || current.question,
							termQueries: plan.termQueries,
							onProgress: (info) => {
								const progressNote = `Searching again · ${info.done} of ${info.total} queries`;
								current = { ...current, progressNote };
								void writeJob(current, { progressNote });
							},
						},
					);
					const known = new Set(pool.map((hit) => hit.slug));
					for (const hit of second.hits) {
						if (known.has(hit.slug)) continue;
						known.add(hit.slug);
						pool.push(hit);
					}
					searchBatches = [...searchBatches, ...second.batches];
					if (
						second.hits.length > 0 &&
						timeLeft(startedAt) > RESEARCH_ASSEMBLE_MS + 50_000
					) {
						current = await writeJob(current, {
							status: "crunching",
							candidateCount: pool.length,
							progressNote: `Crunching ${pool.length.toLocaleString()} discourses…`,
						});
						try {
							const ranked = await rerankDiscourseHits({
								question: plan.correctedQuestion || current.question,
								candidates: pool,
								fallbackQueries: [
									...plan.fallbackQueries,
									...refine.fallbackQueries,
								],
								history,
								limit: showCount,
								openRouterModel: ASK_PLANNER_PAID_FALLBACK_MODEL,
								guidance: [
									plan.rankingGuidance,
									refine.guidance,
									refine.reason,
								]
									.filter(Boolean)
									.join(" "),
								planningNotes: reasoning,
								primaryQueries: [...plan.queries, ...refine.queries],
								termQueries: plan.termQueries,
								excludeSlugs: resolveRewriteExcludeSlugs(
									plan,
									collectAskHistoryShownSlugs(history),
									plan.correctedQuestion || current.question,
								),
								...RESEARCH_RERANK_CAPS,
							});
							results = ranked.results.map(toPublicAskHit);
						} catch (error) {
							console.warn(
								"[ai/research] second rerank failed — keeping first set plus new hits",
								error instanceof Error ? error.message : error,
							);
							const have = new Set(results.map((hit) => hit.slug));
							for (const hit of second.hits) {
								if (have.has(hit.slug)) continue;
								have.add(hit.slug);
								results.push(toPublicAskHit(hit));
								if (results.length >= showCount) break;
							}
						}
					} else {
						const have = new Set(results.map((hit) => hit.slug));
						for (const hit of second.hits) {
							if (have.has(hit.slug)) continue;
							have.add(hit.slug);
							results.push(toPublicAskHit(hit));
							if (results.length >= showCount) break;
						}
					}
				} catch (error) {
					console.warn(
						"[ai/research] second search failed",
						error instanceof Error ? error.message : error,
					);
				}
			}
		}

		results = await withCatalogTitles(results);

		const writerBudget = resolveAskWriterBudgetMs(Date.now() - startedAt);
		if (results.length > 0 && getOpenRouterApiKey() && writerBudget > 0) {
			const writerGuidance = [plan.rankingGuidance, scoutGuidance]
				.filter(Boolean)
				.join(" ");
			const writerNamedQueries = [...namedQueries, ...scoutQueries];
			const namedAndScout = resolveResearchReadFullSlugs(
				writerNamedQueries,
				results.map((hit) => hit.slug),
				scoutReadFull,
			);
			const opening = openingResearchFullSlugs({
				namedAndScout,
				selected: results.map((hit) => hit.slug),
			});
			const openingFull = opening.readNow;
			current = await writeJob(current, {
				status: "answering",
				showCount: results.length,
				candidateCount: pool.length,
				unreadFull: opening.unreadFull,
				fullReadSlugs: openingFull,
				progressNote:
					openingFull.length > 0 || scoutReadPali.length > 0
						? formatResearchReadProgress({
								readFull: openingFull,
								readPali: scoutReadPali,
							})
						: "Writing the report…",
			});
			await throwIfCancelled(current);
			try {
				const written = await retryOnce(
					"report",
					() =>
						writeResearchReport({
							question: plan.correctedQuestion || current.question,
							brief,
							hits: results,
							model: ASK_PLANNER_PAID_FALLBACK_MODEL,
							termQueries: plan.termQueries,
							guidance: writerGuidance,
							history,
							timeoutMs: writerBudget,
							namedQueries: writerNamedQueries,
							readFullSlugs: openingFull,
							readPaliSlugs: scoutReadPali,
							onReasoning: (delta) => {
								const next = `${current.reasoning || ""}${delta}`;
								current = { ...current, reasoning: next };
								void writeJob(current, { reasoning: next });
							},
						}),
					() => {
						void writeJob(current, {
							progressNote: "Writing the report again…",
						});
					},
				);
				if (written.report) {
					const followed = await followUpResearchPaliRead({
						written,
						startedAt,
						onProgress: async (slugs) => {
							current = await writeJob(current, {
								status: "answering",
								progressNote: formatResearchReadProgress({
									readPali: slugs,
								}),
							});
							await throwIfCancelled(current);
						},
						write: (timeoutMs) =>
							writeResearchReport({
								question:
									plan.correctedQuestion || current.question,
								brief,
								hits: results,
								model: ASK_PLANNER_PAID_FALLBACK_MODEL,
								termQueries: plan.termQueries,
								guidance: writerGuidance,
								history,
								timeoutMs,
								priorReport: written.report,
								namedQueries: writerNamedQueries,
								readFullSlugs: [
									...openingFull,
									...(written.readPali || []),
								],
								readPaliSlugs: written.readPali,
								onReasoning: (delta) => {
									const next = `${current.reasoning || ""}${delta}`;
									current = { ...current, reasoning: next };
									void writeJob(current, { reasoning: next });
								},
							}),
					});
					report = followed.report;
					usedModel = `${usedModel} + ${followed.model || ASK_PLANNER_PAID_FALLBACK_MODEL}`;
					if (followed.reasoning) reasoning = followed.reasoning;
				}
			} catch (error) {
				console.warn(
					"[ai/research] report writer failed — assembling fallback",
					error instanceof Error ? error.message : error,
				);
			}
		}

		try {
			if (await queueContinueIfNeeded()) return "chained";
		} catch (error) {
			if (
				error instanceof ResearchCancelledError ||
				error instanceof ResearchStaleWorkerError
			) {
				throw error;
			}
			console.warn(
				"[ai/research] continue review skipped",
				error instanceof Error ? error.message : error,
			);
		}
		await completeWithArtifact(true);
		return "done";
	} catch (error) {
		if (error instanceof ResearchStaleWorkerError) return "done";
		if (error instanceof ResearchCancelledError) {
			await settleCancelledJob();
			return "done";
		}
		console.error("[ai/research]", error);
		try {
			await completeWithArtifact(true);
		} catch (finishError) {
			if (finishError instanceof ResearchStaleWorkerError) return "done";
			if (finishError instanceof ResearchCancelledError) {
				await settleCancelledJob();
				return "done";
			}
			console.error("[ai/research] could not assemble a report", finishError);
			current = await writeJob(current, {
				status: "failed",
				error: "Research could not finish. Try again shortly.",
			});
			if (current.runToken !== options.runToken) return "done";
			current = await settleResearchJobQuota(current);
			persistTelemetry({
				displayQuestion: current.question,
				lookingFor: current.lookingFor || "",
				queries: current.queries || [],
				fallbackQueries: current.fallbackQueries || [],
				offTopic: false,
				results: [],
				model: ASK_PLANNER_PAID_FALLBACK_MODEL,
				reasoning: current.reasoning || "",
			});
			await finishEmail(current, false);
		}
		return "done";
	}
}

async function persistHistory(
	record: ResearchJobRecord,
	result: {
		question: string;
		originalQuestion?: string;
		lookingFor: string;
		queries: string[];
		fallbackQueries: string[];
		offTopic: boolean;
		results: { slug: string; title: string; description: string; contentSnippet: string | null; referenceOnly: boolean; href: string; volpage?: string }[];
		persons?: ReturnType<typeof resolveAskPersonHits>;
		model: string;
		reasoning: string;
		summary?: string;
		report?: string;
		shareSlug?: string;
		candidateCount?: number;
		requestId?: string;
	},
): Promise<void> {
	if (result.results.length === 0 && !result.report) return;
	try {
		await upsertUserAskHistoryEntry(
			{ uid: record.uid } as UserRecord,
			{
				question: result.question,
				originalQuestion: result.originalQuestion,
				lookingFor: result.lookingFor,
				queries: result.queries,
				fallbackQueries: result.fallbackQueries,
				offTopic: result.offTopic,
				results: result.results,
				persons: result.persons,
				model: result.model,
				reasoning: result.reasoning,
				summary: result.summary,
				report: result.report,
				shareSlug: result.shareSlug,
				at:
					record.createdAt && record.createdAt > 0
						? record.createdAt
						: Date.now(),
				requestId: result.requestId,
				candidateCount: result.candidateCount,
				research: true,
				researchJobId: record.id,
				...(record.processNotes && record.processNotes.length > 0
					? { processNotes: record.processNotes }
					: {}),
			},
		);
	} catch (error) {
		console.warn(
			"[ai/research] history upsert failed",
			error instanceof Error ? error.message : error,
		);
	}
}

async function finishEmail(record: ResearchJobRecord, ok: boolean): Promise<void> {
	if (!record.email) return;
	const sent = await sendResearchEmail({
		to: record.email,
		lookingFor: record.lookingFor || record.question,
		question: record.question,
		jobId: record.id,
		origin: record.origin,
		ok,
	});
	if (sent.sent) {
		await writeJob(record, { emailSent: true });
		return;
	}
	console.warn("[ai/research] email not sent", sent.error);
}

export function resetResearchJobMemoryForTests(): void {
	memory.clear();
}

export async function startResearchJobWorker(options: {
	requestUrl: string;
	uid: string;
	jobId: string;
	runToken: string;
}): Promise<void> {
	const work = runResearchJobAndMaybeChain({
		uid: options.uid,
		jobId: options.jobId,
		runToken: options.runToken,
		requestUrl: options.requestUrl,
	}).catch((error) => {
		console.warn(
			"[ai/research] worker failed",
			error instanceof Error ? error.message : error,
		);
	});
	try {
		const vercel = await import("@vercel/functions");
		vercel.waitUntil(work);
	} catch {
		if (isFirebaseInitialized) {
			const runUrl = new URL("/api/ai/research/run", options.requestUrl);
			void fetch(runUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					uid: options.uid,
					jobId: options.jobId,
					runToken: options.runToken,
				}),
			}).catch((error) => {
				console.warn(
					"[ai/research] worker start failed",
					error instanceof Error ? error.message : error,
				);
			});
			return;
		}
	}
	void work;
}
