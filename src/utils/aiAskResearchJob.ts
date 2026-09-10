import type { AiAskPersonHit } from "./aiAskPersons";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import { sanitizeAskPersonHits } from "./aiAskPersons";
import { RESEARCH_REPORT_MAX_CHARS } from "./aiAskResearchReport";
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
	/** When the reader started this research — history `at` should keep this. */
	createdAt?: number;
}

export function isResearchJobTerminal(status: ResearchJobStatus): boolean {
	return (
		status === "complete" || status === "failed" || status === "cancelled"
	);
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
	if (status === "answering") return "answer";
	if (isResearchJobTerminal(status)) return "done";
	return "rewrite";
}

export function clipResearchJobId(value: string): string {
	return value.replace(/\s+/g, "").trim().slice(0, RESEARCH_JOB_ID_MAX);
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
	for (const item of value.slice(0, 55)) {
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
		});
	}
	return out;
}

export function sanitizeResearchJobResult(
	raw: unknown,
): ResearchJobResult | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const question = clip(
		typeof record.question === "string" ? record.question : "",
		500,
	);
	if (!question) return undefined;
	const originalQuestion =
		typeof record.originalQuestion === "string"
			? clip(record.originalQuestion, 500)
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
	createdAt?: number;
}): ResearchJobPublic {
	const status = input.status;
	const result = sanitizeResearchJobResult(input.result);
	return {
		id: clipResearchJobId(input.id),
		status,
		phase: researchJobPhase(status),
		pending: !isResearchJobTerminal(status),
		question: clip(input.question, 500),
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
	};
}
