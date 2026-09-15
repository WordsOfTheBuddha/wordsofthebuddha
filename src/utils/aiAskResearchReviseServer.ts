import type { UserRecord } from "firebase-admin/auth";
import { resolveAskWriterBudgetMs } from "./aiAskAnswer";
import type { AskQuotaView } from "./aiAskQuota";
import { consumeAskQuota } from "./aiAskQuotaServer";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	clipResearchJobId,
	dropOpenResearchRevisionCycle,
	isResearchJobReviseClarifying,
	rememberResearchProcessNote,
	researchRevisedLabel,
	sanitizeResearchJobResult,
	toResearchJobPublic,
	type ResearchJobPublic,
	type ResearchJobResult,
} from "./aiAskResearchJob";
import {
	canStartResearchClarify,
	formatClarifyAnswerLines,
	parseResearchClarifyAnswers,
} from "./aiAskResearchClarify";
import {
	clipResearchReport,
	replaceResearchSourcesSection,
	RESEARCH_REPORT_MAX_CHARS,
} from "./aiAskResearchReport";
import {
	applyResearchRevisePatch,
	clipResearchChangelog,
	clipResearchReviseHeading,
	clipResearchReviseInstruction,
	clipResearchReviseQuote,
	clipResearchVersionIndex,
	currentResearchVersionN,
	mergeResearchHits,
	nextResearchRevisionN,
	normalizeResearchReviseEdits,
	openingResearchVersionMeta,
	researchRevisionStartedNote,
	researchRevisePatchIsEmpty,
	researchRevisePlanNote,
	researchRevisePlanSummary,
	researchReviseWriterFailureMessage,
	reviseEditsPlannerInstruction,
	reviseEvidenceRequestedIds,
	isResearchReviseClarifyExpired,
	RESEARCH_REVISE_CLARIFY_EXPIRED_ERROR,
	RESEARCH_REVISE_CLARIFY_TTL_MS,
	RESEARCH_REVISE_CONSIDERING_NOTE,
	RESEARCH_REVISE_SEARCH_NOTE,
	RESEARCH_REVISE_TOO_LONG_ERROR,
	RESEARCH_REVISE_WAITING_NOTE,
	RESEARCH_REVISE_WRITING_NOTE,
	sanitizeResearchReviseEdits,
	versionBodiesToKeep,
	type ResearchReviseEdit,
	type ResearchVersionMeta,
} from "./aiAskResearchRevise";
import {
	formatResearchReadLabelsProgress,
	formatResearchReadProgress,
} from "./aiAskResearchContinue";
import { snapshotResearchHistoryStats } from "./aiAskResearchHistoryStats";
import {
	gatherReviseEvidence,
	planResearchRevise,
	planReviseEvidence,
	writeResearchRevise,
} from "./aiAskResearchReviseWrite";
import {
	abandonResearchReviseCycle,
	createResearchJob,
	persistHistory,
	readJob,
	writeJob,
	type ResearchJobRecord,
} from "./aiAskResearchServer";
import { loadAskShare } from "./aiAskShareServer";
import {
	pruneResearchVersionBodies,
	readResearchVersionBody,
	readShareVersionBody,
	writeResearchVersionBody,
} from "./aiAskResearchVersions";
import { OPENROUTER_SITE_URL } from "./openrouter";

export type ResearchReviseCode =
	| "unauthorized"
	| "ask_quota"
	| "not_found"
	| "no_report"
	| "writer"
	| "too_long"
	| "invalid";

export type ResearchReviseResult =
	| {
			ok: true;
			job: ResearchJobPublic;
			forked: boolean;
			quota?: AskQuotaView;
			runToken?: string;
	  }
	| {
			ok: false;
			code: ResearchReviseCode;
			error: string;
			quota?: AskQuotaView;
	  };

/** Room for two “prompt → answer” lines including an Other note. */
const RESEARCH_REVISE_CLARIFICATIONS_MAX = 1_400;

function originFromRequest(requestUrl: string): string {
	try {
		return new URL(requestUrl).origin;
	} catch {
		return OPENROUTER_SITE_URL;
	}
}

async function loadBaseReport(options: {
	uid: string;
	jobId: string;
	fromVersion: number | null;
	fallback: string;
}): Promise<string> {
	if (options.fromVersion && options.fromVersion > 0) {
		const body = await readResearchVersionBody({
			uid: options.uid,
			jobId: options.jobId,
			n: options.fromVersion,
		});
		if (body) return body;
	}
	return clipResearchReport(options.fallback);
}

async function commitReportVersion(options: {
	record: ResearchJobRecord;
	report: string;
	hits: AiDiscourseHit[];
	meta: ResearchVersionMeta;
	index: ResearchVersionMeta[];
}): Promise<ResearchJobRecord> {
	const result = sanitizeResearchJobResult(options.record.result);
	if (!result) {
		throw new Error("Research result missing.");
	}
	const nextResult: ResearchJobResult = {
		...result,
		results: options.hits,
		report: clipResearchReport(options.report, RESEARCH_REPORT_MAX_CHARS),
	};
	await writeResearchVersionBody({
		uid: options.record.uid,
		jobId: options.record.id,
		n: options.meta.n,
		report: nextResult.report || "",
	});
	await pruneResearchVersionBodies({
		uid: options.record.uid,
		jobId: options.record.id,
		keep: versionBodiesToKeep(options.index),
	});
	const next = await writeJob(options.record, {
		result: nextResult,
		versionIndex: options.index,
		showCount: nextResult.results.length,
	});
	await persistHistory(next, nextResult);
	return next;
}

async function forkShareToJob(options: {
	user: UserRecord;
	shareSlug: string;
	origin: string;
	fromVersion: number | null;
}): Promise<ResearchJobRecord | null> {
	const share = await loadAskShare(options.shareSlug);
	if (!share?.report?.trim()) return null;
	const created = await createResearchJob({
		user: options.user,
		question: share.question,
		origin: options.origin,
	});
	const record = await readJob(options.user.uid, created.job.id);
	if (!record) return null;
	const fromBody =
		options.fromVersion && options.fromVersion > 0
			? await readShareVersionBody({
					slug: share.slug,
					n: options.fromVersion,
				})
			: null;
	const report = clipResearchReport(fromBody || share.report);
	const result: ResearchJobResult = {
		question: share.question,
		lookingFor: share.lookingFor,
		queries: share.queries,
		fallbackQueries: share.fallbackQueries,
		offTopic: false,
		results: share.results,
		model: share.model,
		reasoning: share.reasoning || "",
		summary: share.summary,
		report,
		shareSlug: share.slug,
		candidateCount: share.candidateCount,
		requestId: share.requestId,
	};
	const v1 = openingResearchVersionMeta(
		Date.now(),
		snapshotResearchHistoryStats(report, share.results),
	);
	await writeResearchVersionBody({
		uid: record.uid,
		jobId: record.id,
		n: 1,
		report,
	});
	return writeJob(record, {
		status: "complete",
		lookingFor: share.lookingFor,
		queries: share.queries,
		fallbackQueries: share.fallbackQueries,
		showCount: share.results.length,
		candidateCount: share.candidateCount,
		reasoning: share.reasoning || "",
		progressNote: "",
		result,
		versionIndex: [v1],
		quotaSettled: true,
		quotaRefunded: false,
	});
}

async function resolveWritableJob(options: {
	user: UserRecord;
	jobId: string;
	shareSlug: string;
	fromVersion: number | null;
	origin: string;
}): Promise<{ record: ResearchJobRecord; forked: boolean } | null> {
	const jobId = clipResearchJobId(options.jobId);
	if (jobId) {
		const owned = await readJob(options.user.uid, jobId);
		if (owned && sanitizeResearchJobResult(owned.result)?.report) {
			return { record: owned, forked: false };
		}
	}
	if (options.shareSlug) {
		const forked = await forkShareToJob({
			user: options.user,
			shareSlug: options.shareSlug,
			origin: options.origin,
			fromVersion: options.fromVersion,
		});
		if (forked) return { record: forked, forked: true };
	}
	return null;
}

function reviseFailureMessage(error: unknown): string {
	const reason =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";
	const compact = reason.replace(/\s+/g, " ").trim().slice(0, 240);
	if (/abort|timeout/i.test(compact)) {
		return `Revision timed out before the writer finished. Try fewer changes in one request, or split across two revisions. (${compact})`;
	}
	return compact
		? `Could not revise the report. (${compact})`
		: "Could not revise the report.";
}

async function restoreCompleteJob(
	record: ResearchJobRecord,
	error = "",
	options: { shippedVersion?: number } = {},
): Promise<ResearchJobRecord> {
	const trimmed = error.trim();
	let processNotes = record.processNotes;
	if (trimmed) {
		processNotes = rememberResearchProcessNote(
			processNotes,
			`Revision failed: ${trimmed.slice(0, 200)}`,
		);
	} else if (options.shippedVersion) {
		processNotes = rememberResearchProcessNote(
			processNotes,
			researchRevisedLabel(options.shippedVersion),
		);
	}
	return writeJob(record, {
		status: "complete",
		progressNote: "",
		...(processNotes !== record.processNotes ? { processNotes } : {}),
		error: trimmed,
		reviseInstruction: "",
		reviseHeading: "",
		reviseQuote: "",
		reviseFromVersion: null,
		reviseClarify: null,
		reviseClarifications: "",
	});
}

function newClarifyId(): string {
	return `rc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** True while the stored job is still this revise worker's run. */
async function readActiveReviseWorkerRecord(
	uid: string,
	jobId: string,
	runToken: string,
): Promise<ResearchJobRecord | null> {
	const fresh = await readJob(uid, jobId);
	if (!fresh || fresh.status !== "revising") return null;
	if (runToken && fresh.runToken !== runToken) return null;
	return fresh;
}

async function writeReviseJobIfActive(
	record: ResearchJobRecord,
	patch: Partial<ResearchJobRecord>,
	runToken: string,
): Promise<ResearchJobRecord | null> {
	const fresh = await readActiveReviseWorkerRecord(record.uid, record.id, runToken);
	if (!fresh) return null;
	const written = await writeJob(fresh, patch);
	if (runToken && written.runToken !== runToken) return null;
	if (typeof patch.status === "string" && written.status !== patch.status) {
		return null;
	}
	return written;
}

/**
 * Resume a revision the planner paused on its questions. Validates the answers
 * against the stored questions, folds them into the instruction context, and
 * puts the job back to `revising` for the worker the route then starts.
 */
export async function answerResearchReviseClarify(options: {
	uid: string;
	jobId: string;
	clarifyId: string;
	answers: unknown;
}): Promise<
	| { ok: true; job: ResearchJobPublic; runToken: string }
	| { ok: false; code: ResearchReviseCode; error: string }
> {
	const record = await readJob(options.uid, options.jobId);
	if (!record) return { ok: false, code: "not_found", error: "Research not found." };
	const clarify = record.reviseClarify;
	if (!isResearchJobReviseClarifying(record.status) || !clarify) {
		return {
			ok: false,
			code: "invalid",
			error: "This revision is not waiting on an answer.",
		};
	}
	if (clarify.id !== (options.clarifyId || "").trim()) {
		return { ok: false, code: "invalid", error: "These questions are out of date." };
	}
	if (isResearchReviseClarifyExpired(clarify)) {
		await abandonResearchReviseCycle(record, RESEARCH_REVISE_CLARIFY_EXPIRED_ERROR);
		return { ok: false, code: "invalid", error: RESEARCH_REVISE_CLARIFY_EXPIRED_ERROR };
	}
	const answers = parseResearchClarifyAnswers(options.answers);
	if (!canStartResearchClarify(clarify.questions, answers)) {
		return { ok: false, code: "invalid", error: "Answer each question to continue." };
	}
	const clarifications = formatClarifyAnswerLines(clarify.questions, answers)
		.join("\n")
		.slice(0, RESEARCH_REVISE_CLARIFICATIONS_MAX);
	const next = await writeJob(record, {
		status: "revising",
		progressNote: RESEARCH_REVISE_CONSIDERING_NOTE,
		error: "",
		cancelRequested: false,
		reviseClarify: null,
		reviseClarifications: clarifications,
	});
	return { ok: true, job: toResearchJobPublic(next), runToken: next.runToken };
}

export async function beginResearchRevise(options: {
	request: Request;
	user: UserRecord;
	instruction: string;
	heading?: string;
	quote?: string;
	edits?: ResearchReviseEdit[];
	jobId?: string;
	shareSlug?: string;
	fromVersion?: number | null;
}): Promise<ResearchReviseResult> {
	const edits =
		options.edits && options.edits.length > 0
			? options.edits
			: normalizeResearchReviseEdits(options);
	const instruction = reviseEditsPlannerInstruction(edits);
	const primary = edits[0];
	const heading = clipResearchReviseHeading(primary?.heading || options.heading || "");
	const quote = clipResearchReviseQuote(primary?.quote || options.quote || "");
	const fromVersion =
		typeof options.fromVersion === "number" && options.fromVersion > 0
			? Math.floor(options.fromVersion)
			: null;
	if (!instruction || edits.length === 0) {
		return {
			ok: false,
			code: "invalid",
			error: "Say how to revise the report.",
		};
	}

	const consumed = await consumeAskQuota({
		request: options.request,
		user: options.user,
	});
	const quota = consumed.view;
	if (!consumed.allowed) {
		return {
			ok: false,
			code: "ask_quota",
			error: consumed.view.signedIn
				? "You’ve used today’s Asks. Come back tomorrow."
				: consumed.view.needsEmailVerification
					? "You’ve used today’s free Asks. Verify your email for more Asks today."
					: "You’ve used today’s free Asks. Sign in for more Asks today.",
			quota,
		};
	}

	const resolved = await resolveWritableJob({
		user: options.user,
		jobId: options.jobId || "",
		shareSlug: options.shareSlug || "",
		fromVersion,
		origin: originFromRequest(options.request.url),
	});
	if (!resolved) {
		return { ok: false, code: "not_found", error: "Research not found.", quota };
	}
	let { record, forked } = resolved;
	const current = sanitizeResearchJobResult(record.result);
	if (!current?.report?.trim()) {
		return {
			ok: false,
			code: "no_report",
			error: "This research has no report yet.",
			quota,
		};
	}

	const nextN = nextResearchRevisionN(clipResearchVersionIndex(record.versionIndex));
	record = await writeJob(record, {
		status: "revising",
		progressNote: RESEARCH_REVISE_CONSIDERING_NOTE,
		processNotes: rememberResearchProcessNote(
			dropOpenResearchRevisionCycle(record.processNotes),
			researchRevisionStartedNote(nextN),
		),
		error: "",
		cancelRequested: false,
		reviseInstruction: instruction,
		reviseHeading: heading,
		reviseQuote: quote,
		reviseEdits: edits,
		reviseFromVersion: fromVersion,
		reviseClarify: null,
		reviseClarifications: "",
	});
	return {
		ok: true,
		job: toResearchJobPublic(record),
		forked,
		quota,
		runToken: record.runToken,
	};
}

export async function runResearchReviseJob(options: {
	uid: string;
	jobId: string;
	runToken?: string;
}): Promise<void> {
	let record = await readJob(options.uid, options.jobId);
	if (!record || record.status !== "revising") return;
	const runToken = options.runToken || record.runToken || "";
	if (runToken && record.runToken && record.runToken !== runToken) {
		return;
	}

	const instruction = clipResearchReviseInstruction(record.reviseInstruction || "");
	const storedEdits = sanitizeResearchReviseEdits(record.reviseEdits);
	const edits =
		storedEdits.length > 0
			? storedEdits
			: normalizeResearchReviseEdits({
					instruction,
					heading: record.reviseHeading || "",
					quote: record.reviseQuote || "",
				});
	const heading = clipResearchReviseHeading(record.reviseHeading || "");
	const quote = clipResearchReviseQuote(record.reviseQuote || "");
	const fromVersion =
		typeof record.reviseFromVersion === "number" && record.reviseFromVersion > 0
			? record.reviseFromVersion
			: null;
	const current = sanitizeResearchJobResult(record.result);
	if (!instruction || !current?.report?.trim()) {
		await restoreCompleteJob(record, "Could not revise the report.");
		return;
	}
	const clarifications = (record.reviseClarifications || "").trim();
	// Set when this run parks the job on questions: the resumed run owns the
	// job from then on, so the cleanup below must not touch it.
	let paused = false;
	const workerStarted = Date.now();

	try {
		const index = clipResearchVersionIndex(record.versionIndex);
		const currentN = currentResearchVersionN(
			index.length > 0 ? index : [openingResearchVersionMeta()],
		);
		console.warn(
			`[ai/research/revise] job ${record.id} start fromVersion=${fromVersion ?? "head"} instructionChars=${instruction.length}`,
		);
		const baseReport = await loadBaseReport({
			uid: record.uid,
			jobId: record.id,
			fromVersion,
			fallback: current.report,
		});
		// Pass 1 — the planner picks the target blocks and what evidence the
		// writer needs (one search round, a few full reads). Runs under the
		// “Considering the revision…” hop already recorded at start.
		const planned = await planResearchRevise({
			report: baseReport,
			instruction,
			edits,
			originalQuestion: record.originalQuestion,
			clarifyBrief: record.clarifyBrief,
			clarifications,
			heading,
			quote,
		});
		record = (await readActiveReviseWorkerRecord(record.uid, record.id, runToken)) ?? null;
		if (!record) return;
		const plan = planned.plan;
		// The reader sees the planner's reading as a hop within seconds, and can
		// stop the revision if it is wrong.
		const planNote = plan ? researchRevisePlanNote(plan) : "";
		if (planNote) {
			const next = await writeReviseJobIfActive(record, { progressNote: planNote }, runToken);
			if (!next) return;
			record = next;
		}
		// Genuine ambiguity: park the job on the questions. Nothing has been
		// written; the route resumes the worker once the reader answers.
		if (!clarifications && plan?.questions?.length) {
			paused = true;
			const parked = await writeReviseJobIfActive(
				record,
				{
					status: "revise-clarifying",
					progressNote: RESEARCH_REVISE_WAITING_NOTE,
					reviseClarify: {
						id: newClarifyId(),
						questions: plan.questions,
						interpretation: researchRevisePlanSummary(plan),
						fromVersion,
						expiresAt: Date.now() + RESEARCH_REVISE_CLARIFY_TTL_MS,
					},
				},
				runToken,
			);
			if (!parked) paused = false;
			return;
		}
		const evidencePlan = planReviseEvidence({
			instruction,
			existingHits: current.results,
			plan,
		});
		if (evidencePlan.needsSearch) {
			const next = await writeReviseJobIfActive(
				record,
				{ progressNote: RESEARCH_REVISE_SEARCH_NOTE },
				runToken,
			);
			if (!next) return;
			record = next;
		}
		console.warn(
			`[ai/research/revise] job ${record.id} evidence plan: search=${evidencePlan.needsSearch} reread=${evidencePlan.reread.length} queries=${evidencePlan.queries.length} readFull=${(plan?.readFull || []).join(",")} readPali=${(plan?.readPali || []).join(",")} readIllustration=${(plan?.readIllustration || []).join(",")}`,
		);
		const gathered = await gatherReviseEvidence({
			instruction,
			existingHits: current.results,
			plan,
		});
		record = (await readActiveReviseWorkerRecord(record.uid, record.id, runToken)) ?? null;
		if (!record) return;
		const requestedIds = reviseEvidenceRequestedIds({
			instruction,
			plan,
		});
		if (
			gathered.readFull.length > 0 ||
			gathered.readPali.length > 0 ||
			gathered.readIllustration.length > 0 ||
			requestedIds.length > 0
		) {
			const readLabels = gathered.readFullLabels?.length
				? gathered.readFullLabels
				: gathered.readFull.length
					? gathered.readFull
					: requestedIds;
			const readNote =
				gathered.readPali.length > 0 || gathered.readIllustration.length > 0
					? formatResearchReadProgress({
							readFull: gathered.readFull.length ? gathered.readFull : readLabels,
							readPali: gathered.readPali,
							readIllustration: gathered.readIllustration,
						})
					: formatResearchReadLabelsProgress(readLabels);
			const next = await writeReviseJobIfActive(
				record,
				{ progressNote: readNote },
				runToken,
			);
			if (!next) return;
			record = next;
		}
		{
			const next = await writeReviseJobIfActive(
				record,
				{ progressNote: RESEARCH_REVISE_WRITING_NOTE },
				runToken,
			);
			if (!next) return;
			record = next;
		}
		console.warn(
			`[ai/research/revise] job ${record.id} writing (evidenceChars=${gathered.evidence.length})`,
		);
		// Pass 2 — the writer sees the block-numbered report, the plan, the
		// target blocks and the passages, and returns block ops.
		const written = await writeResearchRevise({
			report: baseReport,
			instruction,
			edits,
			originalQuestion: record.originalQuestion,
			clarifyBrief: record.clarifyBrief,
			clarifications,
			heading,
			quote,
			evidence: gathered.evidence,
			plan,
			timeoutMs: resolveAskWriterBudgetMs(Date.now() - workerStarted),
		});
		record = (await readActiveReviseWorkerRecord(record.uid, record.id, runToken)) ?? null;
		if (!record) return;
		if (written.tooLong) {
			await restoreCompleteJob(record, RESEARCH_REVISE_TOO_LONG_ERROR);
			return;
		}
		if (!written.patch || researchRevisePatchIsEmpty(written.patch)) {
			const message = researchReviseWriterFailureMessage({
				unparseable: written.unparseable,
				emptyPatch: written.emptyPatch,
				opsDropped: written.opsDropped,
			});
			console.warn(
				`[ai/research/revise] job ${record.id} failed: ${message} (model=${written.model || "unknown"}, tooLong=${Boolean(written.tooLong)}, unparseable=${Boolean(written.unparseable)}, emptyPatch=${Boolean(written.emptyPatch)}, opsDropped=${written.opsDropped || 0})`,
			);
			await restoreCompleteJob(record, message);
			return;
		}
		const hits = mergeResearchHits(current.results, gathered.hits);
		const spliced = applyResearchRevisePatch(baseReport, written.patch);
		const report = replaceResearchSourcesSection(spliced, hits);
		const n = nextResearchRevisionN(index);
		const stats = snapshotResearchHistoryStats(report, hits);
		const meta: ResearchVersionMeta = {
			n,
			at: Date.now(),
			instruction,
			changelog: written.patch.changelog || clipResearchChangelog(instruction),
			from: fromVersion && fromVersion !== currentN ? fromVersion : currentN,
			...(heading ? { heading } : {}),
			...(stats ? { stats } : {}),
		};
		const nextIndex =
			index.length > 0
				? [...index, meta]
				: [
						openingResearchVersionMeta(
							record.createdAt || meta.at,
							snapshotResearchHistoryStats(current.report, current.results),
						),
						meta,
					];
		if (index.length === 0) {
			await writeResearchVersionBody({
				uid: record.uid,
				jobId: record.id,
				n: 1,
				report: current.report,
			});
		}
		record = await commitReportVersion({
			record,
			report,
			hits,
			meta,
			index: nextIndex,
		});
		// Ship the “Revised · vN” hop only when the job is marked complete, so a
		// crash or timeout after commit cannot leave a false success hop behind.
		await restoreCompleteJob(record, "", { shippedVersion: n });
	} catch (error) {
		const message = reviseFailureMessage(error);
		console.warn(`[ai/research/revise] job ${options.jobId} worker failed: ${message}`);
		const fresh = await readJob(options.uid, options.jobId);
		if (!paused && fresh && fresh.status === "revising") {
			await restoreCompleteJob(fresh, message);
		}
	} finally {
		if (!paused) {
			const leftover = await readJob(options.uid, options.jobId);
			if (leftover?.status === "revising") {
				await restoreCompleteJob(
					leftover,
					reviseFailureMessage("Revision did not finish."),
				);
			}
		}
	}
}

export async function startResearchReviseWorker(options: {
	requestUrl: string;
	uid: string;
	jobId: string;
	runToken: string;
}): Promise<void> {
	const work = runResearchReviseJob({
		uid: options.uid,
		jobId: options.jobId,
		runToken: options.runToken,
	}).catch((error) => {
		console.warn(
			"[ai/research/revise] worker failed",
			error instanceof Error ? error.message : error,
		);
	});
	try {
		const vercel = await import("@vercel/functions");
		vercel.waitUntil(work);
	} catch {
		const runUrl = new URL("/api/ai/research/revise-run", options.requestUrl);
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
				"[ai/research/revise] worker start failed",
				error instanceof Error ? error.message : error,
			);
		});
		return;
	}
	void work;
}

export async function applyResearchRevise(options: {
	request: Request;
	user: UserRecord;
	instruction: string;
	heading?: string;
	quote?: string;
	jobId?: string;
	shareSlug?: string;
	fromVersion?: number | null;
	action?: "revise" | "restore";
}): Promise<ResearchReviseResult> {
	const instruction = clipResearchReviseInstruction(options.instruction);
	const heading = clipResearchReviseHeading(options.heading || "");
	const quote = clipResearchReviseQuote(options.quote || "");
	const action = options.action === "restore" ? "restore" : "revise";
	const fromVersion =
		typeof options.fromVersion === "number" && options.fromVersion > 0
			? Math.floor(options.fromVersion)
			: null;
	if (action === "revise") {
		return beginResearchRevise({
			request: options.request,
			user: options.user,
			instruction,
			heading,
			quote,
			jobId: options.jobId,
			shareSlug: options.shareSlug,
			fromVersion,
		});
	}
	if (!fromVersion) {
		return {
			ok: false,
			code: "invalid",
			error: "Pick a version to restore.",
		};
	}

	const resolved = await resolveWritableJob({
		user: options.user,
		jobId: options.jobId || "",
		shareSlug: options.shareSlug || "",
		fromVersion,
		origin: originFromRequest(options.request.url),
	});
	if (!resolved) {
		return { ok: false, code: "not_found", error: "Research not found." };
	}
	let { record, forked } = resolved;
	const current = sanitizeResearchJobResult(record.result);
	if (!current?.report?.trim()) {
		return {
			ok: false,
			code: "no_report",
			error: "This research has no report yet.",
		};
	}

	const index = clipResearchVersionIndex(record.versionIndex);
	if (forked) {
		return {
			ok: true,
			job: toResearchJobPublic(record),
			forked,
		};
	}
	const body = await readResearchVersionBody({
		uid: record.uid,
		jobId: record.id,
		n: fromVersion || 0,
	});
	if (!body) {
		return {
			ok: false,
			code: "not_found",
			error: "That version is no longer kept.",
		};
	}
	const n = nextResearchRevisionN(index);
	const restored = replaceResearchSourcesSection(body, current.results);
	const restoredStats = snapshotResearchHistoryStats(restored, current.results);
	const meta: ResearchVersionMeta = {
		n,
		at: Date.now(),
		instruction: "",
		changelog: clipResearchChangelog(`Restored v${fromVersion}.`),
		from: fromVersion,
		...(restoredStats ? { stats: restoredStats } : {}),
	};
	record = await commitReportVersion({
		record,
		report: restored,
		hits: current.results,
		meta,
		index: [...index, meta],
	});
	return {
		ok: true,
		job: toResearchJobPublic(record),
		forked,
	};
}

export async function loadResearchVersionForUser(options: {
	uid: string;
	jobId: string;
	n: number;
}): Promise<{ n: number; report: string } | null> {
	const record = await readJob(options.uid, options.jobId);
	if (!record) return null;
	const report = await readResearchVersionBody({
		uid: options.uid,
		jobId: options.jobId,
		n: options.n,
	});
	if (!report) return null;
	return { n: options.n, report };
}
