import { extractJsonObject } from "./extractJsonObject";
import {
	normalizeAiSearchQuery,
	prefixedAiDiscourseIdsInQuery,
} from "./aiSearchQuery";
import { getSlugId, transformId } from "./transformId";

/** Room to ask the model whether to continue, then enqueue the next run. */
export const RESEARCH_CONTINUE_MIN_REMAINING_MS = 25_000;
export const RESEARCH_CONTINUE_MAX_QUERIES = 6;
export const RESEARCH_CONTINUE_MAX_READ_FULL = 12;

export const RESEARCH_CONTINUE_SYSTEM = `You are reviewing a research report written from early Buddhist discourses.

The writer often saw only short matched passages, not the whole discourse. Decide whether another pass would materially improve the report.

Return JSON only:
{"continue":true,"queries":["…"],"fallbackQueries":["…"],"readFull":["MN 70"],"readPali":["MN 70"],"guidance":"what the next search and rewrite should do","reason":"short"}

Three operations, which you may combine:
- queries: more library searches (Pāli terms, discourse IDs, topical phrases), 2–6 items, when discourses seem missing from the selected list
- readFull: ordinary discourse IDs already on the selected list, when a claim was limited by a thin excerpt (a section, follower, or definition that the brief needs but the excerpt did not contain)
- readPali: ordinary discourse IDs already on the selected list, when a claim turns on Pāli wording. Those discourses are then opened in Pāli and English

Rules:
- continue:true only if you can name a concrete gap and give queries, readFull, and/or readPali IDs that would close it
- If the report is already a fair, defensible synthesis of the brief, {"continue":false,"queries":[],"readFull":[],"readPali":[],"reason":"…"}
- readFull and readPali only from the selected list. Never invent discourse IDs
- Do not ask for a second pass only to polish prose`;

export interface ResearchContinueDecision {
	continue: boolean;
	queries: string[];
	fallbackQueries: string[];
	readFull: string[];
	readPali: string[];
	guidance: string;
	reason: string;
}

export function shouldEvaluateResearchContinue(timeLeftMs: number): boolean {
	return timeLeftMs >= RESEARCH_CONTINUE_MIN_REMAINING_MS;
}

function clipQueries(
	value: unknown,
	tried: ReadonlySet<string>,
	max = RESEARCH_CONTINUE_MAX_QUERIES,
): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") continue;
		const query = normalizeAiSearchQuery(item);
		if (!query) continue;
		const key = query.toLowerCase();
		if (tried.has(key) || seen.has(key)) continue;
		seen.add(key);
		out.push(query);
		if (out.length >= max) break;
	}
	return out;
}

function clipNote(value: unknown, max: number): string {
	if (typeof value !== "string") return "";
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Map a model ID to a slug that is already in the selected set. */
export function resolveSelectedDiscourseRef(
	raw: string,
	selectedSlugs: readonly string[],
): string {
	const selected = new Set(
		selectedSlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean),
	);
	if (selected.size === 0) return "";
	const trimmed = raw.replace(/\s+/g, " ").trim();
	if (!trimmed) return "";
	const compact = trimmed.toLowerCase().replace(/[^a-z0-9.-]/g, "");
	if (selected.has(compact)) return compact;
	const fromDisplay = getSlugId(trimmed).toLowerCase();
	if (fromDisplay && selected.has(fromDisplay)) return fromDisplay;
	const spaced = getSlugId(trimmed.replace(/([a-zA-Z]+)(\d)/, "$1 $2")).toLowerCase();
	if (spaced && selected.has(spaced)) return spaced;
	return "";
}

export function resolveSelectedDiscourseRefs(
	value: unknown,
	selectedSlugs: readonly string[] = [],
	max = RESEARCH_CONTINUE_MAX_READ_FULL,
): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") continue;
		const slug = resolveSelectedDiscourseRef(item, selectedSlugs);
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
		if (out.length >= max) break;
	}
	return out;
}

/** Live status when the writer is opening named discourses in full. */
export function formatResearchReadFullProgress(
	slugs: readonly string[] = [],
): string {
	const labels = slugs.map((slug) => transformId(slug)).filter(Boolean);
	if (labels.length === 0) return "Reading selected discourses in full…";
	const listed = labels.slice(0, 8).join(", ");
	const extra = labels.length > 8 ? ` +${labels.length - 8}` : "";
	return `Reading ${listed}${extra} in full…`;
}

/** Live status when the writer is opening Pāli with the English. */
export function formatResearchReadPaliProgress(
	slugs: readonly string[] = [],
): string {
	const labels = slugs.map((slug) => transformId(slug)).filter(Boolean);
	if (labels.length === 0) return "Reading Pāli with the English…";
	const listed = labels.slice(0, 8).join(", ");
	const extra = labels.length > 8 ? ` +${labels.length - 8}` : "";
	return `Reading ${listed}${extra} in Pāli and English…`;
}

export function formatResearchReadProgress(input: {
	readFull?: readonly string[];
	readPali?: readonly string[];
}): string {
	const pali = (input.readPali || []).filter(Boolean);
	if (pali.length > 0) return formatResearchReadPaliProgress(pali);
	return formatResearchReadFullProgress(input.readFull);
}

/** Named search IDs plus an explicit readFull list, resolved onto the selected set. */
export function resolveResearchReadFullSlugs(
	namedQueries: readonly string[] = [],
	selectedSlugs: readonly string[] = [],
	extraReadFull: readonly string[] = [],
): string[] {
	const expanded = namedQueries.flatMap((query) => {
		const ids = prefixedAiDiscourseIdsInQuery(query);
		return ids.length > 0 ? ids : [query];
	});
	return resolveSelectedDiscourseRefs(
		[...expanded, ...extraReadFull],
		selectedSlugs,
	);
}

/** Parse the model’s continue decision. No topic rules — JSON only. */
export function parseResearchContinueDecision(
	raw: string,
	triedQueries: readonly string[] = [],
	selectedSlugs: readonly string[] = [],
): ResearchContinueDecision {
	const empty: ResearchContinueDecision = {
		continue: false,
		queries: [],
		fallbackQueries: [],
		readFull: [],
		readPali: [],
		guidance: "",
		reason: "",
	};
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") return empty;
	const record = parsed as Record<string, unknown>;
	const tried = new Set(
		triedQueries
			.map((query) => normalizeAiSearchQuery(query).toLowerCase())
			.filter(Boolean),
	);
	const queries = clipQueries(record.queries, tried);
	const fallbackQueries = clipQueries(record.fallbackQueries, tried);
	const readFull = resolveSelectedDiscourseRefs(record.readFull, selectedSlugs);
	const readPali = resolveSelectedDiscourseRefs(record.readPali, selectedSlugs);
	return {
		continue:
			record.continue === true &&
			(queries.length > 0 || readFull.length > 0 || readPali.length > 0),
		queries,
		fallbackQueries,
		readFull,
		readPali,
		guidance: clipNote(record.guidance, 600),
		reason: clipNote(record.reason, 240),
	};
}

export const RESEARCH_MAX_HOP = 3;

export function uniqueDiscourseSlugs(slugs: readonly string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of slugs) {
		const slug = raw.replace(/\s+/g, "").trim().toLowerCase();
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
	}
	return out;
}

export function unreadFullAfterReads(
	selected: readonly string[],
	alreadyRead: readonly string[],
): string[] {
	const read = new Set(uniqueDiscourseSlugs(alreadyRead));
	return uniqueDiscourseSlugs(selected).filter((slug) => !read.has(slug));
}

export function nextUnreadFullBatch(
	unread: readonly string[],
	size = RESEARCH_CONTINUE_MAX_READ_FULL,
): { batch: string[]; rest: string[] } {
	const list = uniqueDiscourseSlugs(unread);
	const n = Math.max(1, Math.floor(size));
	return { batch: list.slice(0, n), rest: list.slice(n) };
}

/** Named/scout IDs first, then fill the hop-1 batch from unread selected slugs. */
export function openingResearchFullSlugs(input: {
	namedAndScout: readonly string[];
	selected: readonly string[];
	max?: number;
}): { readNow: string[]; unreadFull: string[] } {
	const max = input.max ?? RESEARCH_CONTINUE_MAX_READ_FULL;
	const named = uniqueDiscourseSlugs(input.namedAndScout).slice(0, max);
	const unread = unreadFullAfterReads(input.selected, named);
	const fill = Math.max(0, max - named.length);
	const readNow = uniqueDiscourseSlugs([...named, ...unread.slice(0, fill)]);
	return {
		readNow,
		unreadFull: unreadFullAfterReads(input.selected, readNow),
	};
}

export function parseResearchHop(value: unknown): 1 | 2 | 3 {
	if (value === 2 || value === 3) return value;
	return 1;
}

export function nextResearchHop(current: 1 | 2 | 3): 2 | 3 | null {
	if (current === 1) return 2;
	if (current === 2) return 3;
	return null;
}

export function logResearchHop(payload: Record<string, unknown>): void {
	console.info("[ai/research] hop", JSON.stringify(payload));
}
