/**
 * Open discourse-page Ask thread, kept for the browser tab only.
 * Keyed by discourse slug so each page restores its own thread.
 * localStorage is intentionally not used.
 */

const PREFIX = "dask-page-thread-v1:";
/** Same cap as the Ask page thread (`AI_ASK_THREAD_TURN_LIMIT`). */
export const DISCOURSE_ASK_PAGE_THREAD_TURN_LIMIT = 6;

const MAX_QUESTION = 8000;
const MAX_LOOKING = 280;
const MAX_QUERY = 100;
const MAX_QUERIES = 6;
const MAX_SUMMARY = 4800;
const MAX_RESULTS = 50;
const MAX_TITLE = 160;
const MAX_DESCRIPTION = 600;
const MAX_HREF = 180;
const MAX_ERROR = 500;
const MAX_MODEL = 120;
const MAX_REQUEST_ID = 80;

const PHASES = new Set(["rewrite", "search", "rerank", "answer", "done"]);

export type DiscourseAskPagePhase =
	| "rewrite"
	| "search"
	| "rerank"
	| "answer"
	| "done";

export interface DiscourseAskPageHit {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
	referenceOnly: boolean;
	href: string;
}

/** Settled turn. In-flight (`pending`) turns are never stored. */
export interface DiscourseAskPageTurn {
	question: string;
	originalQuestion: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	results: DiscourseAskPageHit[];
	summary: string;
	model: string;
	requestId?: string;
	candidateCount?: number;
	showCount?: number;
	phase: DiscourseAskPagePhase;
	error?: string;
}

function sessionStorageOrNull(): Storage | null {
	if (typeof sessionStorage === "undefined") return null;
	return sessionStorage;
}

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function clipBlock(value: string, max: number): string {
	return value.replace(/\r\n/g, "\n").trim().slice(0, max);
}

function clipList(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((item): item is string => typeof item === "string")
		.map((item) => clip(item, MAX_QUERY))
		.filter(Boolean)
		.slice(0, MAX_QUERIES);
}

/** `sn10.8`, `/sn10.8`, and `SN10.8?pli=true` share one key. */
export function discourseAskPageThreadKey(slug: string): string {
	const id = (slug || "")
		.trim()
		.toLowerCase()
		.split("?")[0]
		.split("#")[0]
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
	return id ? `${PREFIX}${id}` : "";
}

function sanitizeHit(raw: unknown): DiscourseAskPageHit | null {
	if (!raw || typeof raw !== "object") return null;
	const hit = raw as Record<string, unknown>;
	const slug = clip(typeof hit.slug === "string" ? hit.slug : "", 64).toLowerCase();
	if (!slug) return null;
	const href =
		clip(typeof hit.href === "string" ? hit.href : "", MAX_HREF) || `/${slug}`;
	return {
		slug,
		title: clip(typeof hit.title === "string" ? hit.title : slug, MAX_TITLE),
		description: clip(
			typeof hit.description === "string" ? hit.description : "",
			MAX_DESCRIPTION,
		),
		contentSnippet: null,
		referenceOnly: hit.referenceOnly === true,
		href,
	};
}

function sanitizeTurn(raw: unknown): DiscourseAskPageTurn | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	if (record.pending === true) return null;
	const question = clip(
		typeof record.question === "string" ? record.question : "",
		MAX_QUESTION,
	);
	if (!question) return null;
	const results = (Array.isArray(record.results) ? record.results : [])
		.slice(0, MAX_RESULTS)
		.map(sanitizeHit)
		.filter((hit): hit is DiscourseAskPageHit => Boolean(hit));
	const error = clip(
		typeof record.error === "string" ? record.error : "",
		MAX_ERROR,
	);
	const summary = clipBlock(
		typeof record.summary === "string" ? record.summary : "",
		MAX_SUMMARY,
	);
	const offTopic = record.offTopic === true;
	if (!error && !summary && results.length === 0 && !offTopic) return null;
	const phaseRaw = typeof record.phase === "string" ? record.phase : "";
	const phase: DiscourseAskPagePhase =
		error && PHASES.has(phaseRaw)
			? (phaseRaw as DiscourseAskPagePhase)
			: "done";
	const originalQuestion = clip(
		typeof record.originalQuestion === "string" ? record.originalQuestion : "",
		MAX_QUESTION,
	);
	const requestId = clip(
		typeof record.requestId === "string" ? record.requestId : "",
		MAX_REQUEST_ID,
	);
	const candidateCount =
		typeof record.candidateCount === "number" &&
		Number.isFinite(record.candidateCount) &&
		record.candidateCount > 0
			? Math.min(2000, Math.floor(record.candidateCount))
			: undefined;
	const showCount =
		typeof record.showCount === "number" &&
		Number.isFinite(record.showCount) &&
		record.showCount > 0
			? Math.min(MAX_RESULTS, Math.floor(record.showCount))
			: undefined;
	return {
		question,
		originalQuestion: originalQuestion || question,
		lookingFor: clip(
			typeof record.lookingFor === "string" ? record.lookingFor : "",
			MAX_LOOKING,
		),
		queries: clipList(record.queries),
		fallbackQueries: clipList(record.fallbackQueries),
		offTopic,
		results,
		summary,
		model: clip(typeof record.model === "string" ? record.model : "", MAX_MODEL),
		...(requestId ? { requestId } : {}),
		...(candidateCount != null ? { candidateCount } : {}),
		...(showCount != null ? { showCount } : {}),
		phase,
		...(error ? { error } : {}),
	};
}

export function readDiscourseAskPageThread(
	slug: string,
	storage: Storage | null | undefined = sessionStorageOrNull(),
): DiscourseAskPageTurn[] {
	const key = discourseAskPageThreadKey(slug);
	if (!key || !storage) return [];
	try {
		const raw = storage.getItem(key);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as { turns?: unknown };
		if (!Array.isArray(parsed.turns)) return [];
		return parsed.turns
			.map(sanitizeTurn)
			.filter((turn): turn is DiscourseAskPageTurn => Boolean(turn))
			.slice(-DISCOURSE_ASK_PAGE_THREAD_TURN_LIMIT);
	} catch {
		return [];
	}
}

export function writeDiscourseAskPageThread(
	slug: string,
	turns: readonly unknown[],
	storage: Storage | null | undefined = sessionStorageOrNull(),
): void {
	const key = discourseAskPageThreadKey(slug);
	if (!key || !storage) return;
	const clean = turns
		.map(sanitizeTurn)
		.filter((turn): turn is DiscourseAskPageTurn => Boolean(turn))
		.slice(-DISCOURSE_ASK_PAGE_THREAD_TURN_LIMIT);
	try {
		if (clean.length === 0) {
			storage.removeItem(key);
			return;
		}
		storage.setItem(key, JSON.stringify({ turns: clean }));
	} catch {
		/* quota / private mode */
	}
}

export function discourseAskPageHasThread(
	slug: string,
	storage: Storage | null | undefined = sessionStorageOrNull(),
): boolean {
	return readDiscourseAskPageThread(slug, storage).length > 0;
}
