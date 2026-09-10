import { extractJsonObject } from "./extractJsonObject";
import { normalizeAiSearchQuery } from "./aiSearchQuery";

/** Need this much function time left after the first pass to try another search. */
export const RESEARCH_REFINE_MIN_REMAINING_MS = 90_000;
export const RESEARCH_REFINE_MAX_QUERIES = 6;

export const RESEARCH_REFINE_SYSTEM = `You scout a first-pass discourse set for a research report. Decide if another library search is needed to zoom in or correct the thesis.

Return JSON only:
{"needed":true,"queries":["…"],"fallbackQueries":["…"],"reason":"short"}

Rules:
- needed:true only if a clear gap, missed collection, or thesis shift requires new searches
- 2–6 short queries, like Ask search chips (Pāli terms, discourse IDs, topical phrases)
- Do not repeat queries already tried unless a tighter ID or compound will help
- If the set already covers the brief, {"needed":false,"queries":[],"reason":"…"}
- Never invent discourse IDs that were not named in the brief or the selected list`;

export interface ResearchRefinePlan {
	needed: boolean;
	queries: string[];
	fallbackQueries: string[];
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

export function parseResearchRefinePlan(
	raw: string,
	triedQueries: readonly string[] = [],
): ResearchRefinePlan {
	const empty: ResearchRefinePlan = {
		needed: false,
		queries: [],
		fallbackQueries: [],
		reason: "",
	};
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") return empty;
	const record = parsed as Record<string, unknown>;
	const tried = new Set(
		triedQueries.map((query) => normalizeAiSearchQuery(query).toLowerCase()).filter(Boolean),
	);
	const queries = clipQueries(record.queries, tried);
	const fallbackQueries = clipQueries(record.fallbackQueries, tried);
	const needed = record.needed === true && queries.length > 0;
	const reason =
		typeof record.reason === "string"
			? record.reason.replace(/\s+/g, " ").trim().slice(0, 240)
			: "";
	return { needed, queries, fallbackQueries, reason };
}
