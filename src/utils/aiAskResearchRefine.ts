import { extractJsonObject } from "./extractJsonObject";
import { normalizeAiSearchQuery } from "./aiSearchQuery";
import { resolveSelectedDiscourseRefs } from "./aiAskResearchContinue";

/** Need this much function time left after the first pass to scout and maybe search. */
export const RESEARCH_REFINE_MIN_REMAINING_MS = 90_000;
export const RESEARCH_REFINE_MAX_QUERIES = 6;

export const RESEARCH_REFINE_SYSTEM = `You scout passages already loaded for a research report. You do not write the report. Decide whether a gap in the evidence should be closed before the writer runs.

Return JSON only:
{"needed":true,"queries":["…"],"fallbackQueries":["…"],"readFull":["MN 70"],"readPali":["SN 12.49"],"guidance":"what the next search or fuller read should do","reason":"short"}

You have excerpts and, for some IDs, full English. Use them. Titles alone are not enough.

Three operations, which you may combine:
- queries: 1–6 library searches (Pāli terms, discourse IDs, topical phrases) when a claim needs a cross-check, a missed collection, or a text the passages point to that is not in this set
- readFull: ordinary discourse IDs already in this set, when the excerpt is too thin for the brief (a later section, definition, or follower the excerpt does not contain)
- readPali: ordinary discourse IDs already in this set, when a claim turns on Pāli wording

Rules:
- needed:true only if you can name a concrete gap and give queries, readFull, and/or readPali that would close it
- If the passages already cover the brief, {"needed":false,"queries":[],"readFull":[],"readPali":[],"reason":"…"}
- Do not repeat queries already tried unless a tighter ID or compound will help
- readFull and readPali only from this set. Never invent those IDs
- queries may fetch a new ID or term the passages or the brief actually point to. Do not pad with guesswork IDs
- Do not ask for a hop only to polish prose`;

export interface ResearchRefinePlan {
	needed: boolean;
	queries: string[];
	fallbackQueries: string[];
	readFull: string[];
	readPali: string[];
	guidance: string;
	reason: string;
}

export function shouldAttemptResearchRefine(timeLeftMs: number): boolean {
	return timeLeftMs >= RESEARCH_REFINE_MIN_REMAINING_MS;
}

function clipQueries(
	value: unknown,
	tried: ReadonlySet<string>,
	max = RESEARCH_REFINE_MAX_QUERIES,
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

export function parseResearchRefinePlan(
	raw: string,
	triedQueries: readonly string[] = [],
	selectedSlugs: readonly string[] = [],
): ResearchRefinePlan {
	const empty: ResearchRefinePlan = {
		needed: false,
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
		needed:
			record.needed === true &&
			(queries.length > 0 || readFull.length > 0 || readPali.length > 0),
		queries,
		fallbackQueries,
		readFull,
		readPali,
		guidance: clipNote(record.guidance, 600),
		reason: clipNote(record.reason, 240),
	};
}
