import {
	getSearchDocBySlug,
	performSearch,
	type SearchResult,
} from "../service/search/search";
import { getPtsDisplay } from "./ptsReferences";
import {
	mergeDiscourseHits,
	toAiDiscourseHit,
	type AiDiscourseHit,
} from "./aiDiscourseHits";
import {
	isPrefixedAiDiscourseIdQuery,
	normalizeAiSearchQuery,
	relaxSearchQuery,
} from "./aiSearchQuery";

export type { AiDiscourseHit } from "./aiDiscourseHits";
export { mergeDiscourseHits, toAiDiscourseHit } from "./aiDiscourseHits";
export {
	normalizeAiSearchQuery,
	relaxSearchQuery,
} from "./aiSearchQuery";

/** Hits kept per query before merge (wide pool for Gemini). */
const PER_QUERY_LIMIT_WIDE = 200;
/** Smaller per-query cap when not building a rerank pool. */
const PER_QUERY_LIMIT_NARROW = 12;
const ENOUGH_HITS = 3;
const MAX_SEARCH_CALLS = 12;
/**
 * Wide pool for Gemini rescoring. Search overfits easily; send a large
 * candidate set and let the reranker pick the best 10–20.
 */
export const AI_SEARCH_CANDIDATE_LIMIT = 500;

function uniqueQueries(queries: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of queries) {
		const query = normalizeAiSearchQuery(raw);
		if (!query || seen.has(query)) continue;
		seen.add(query);
		out.push(query);
	}
	return out;
}

function searchResultFromDoc(doc: {
	slug: string;
	title: string;
	description?: string;
	priority?: number;
	referenceOnly?: boolean;
	volpage?: string;
}): SearchResult {
	return {
		slug: doc.slug,
		title: doc.title,
		description: doc.description || "",
		contentSnippet: null,
		priority: doc.priority,
		referenceOnly: doc.referenceOnly,
		volpage: getPtsDisplay(doc.slug) || doc.volpage,
	};
}

/**
 * Run one rewrite query. Discourse IDs resolve by exact slug (incl. references)
 * so "MN 109" / "mn109" do not collapse into fuzzy MN 10 neighbors.
 */
export async function searchHitsForAiQuery(
	query: string,
	limit = PER_QUERY_LIMIT_NARROW,
): Promise<SearchResult[]> {
	const normalized = normalizeAiSearchQuery(query);
	if (!normalized) return [];

	if (isPrefixedAiDiscourseIdQuery(normalized)) {
		const exact = await getSearchDocBySlug(normalized, true);
		if (exact) return [searchResultFromDoc(exact)];

		const fuzzy = await performSearch(normalized, {
			includeReferences: true,
			includeContent: true,
		});
		const exactHits = fuzzy.filter(
			(hit) => hit.slug.toLowerCase() === normalized.toLowerCase(),
		);
		return exactHits.slice(0, 1);
	}

	const hits = await performSearch(normalized, {
		includeReferences: true,
		includeContent: true,
	});
	return hits.slice(0, Math.max(1, limit));
}

async function searchBatchesConcurrently(
	queries: readonly string[],
	perQueryLimit: number,
): Promise<{ query: string; hits: SearchResult[] }[]> {
	const list = uniqueQueries(queries).slice(0, MAX_SEARCH_CALLS);
	return Promise.all(
		list.map(async (query) => ({
			query,
			hits: await searchHitsForAiQuery(query, perQueryLimit),
		})),
	);
}

/**
 * Search all rewrite queries (and usually fallbacks) then merge.
 * For large mergeLimit (Gemini pool), runs queries concurrently and pulls
 * many hits per query so the reranker sees a broad set.
 */
export async function searchDiscoursesForQueries(
	queries: readonly string[],
	fallbackQueries: readonly string[] = [],
	options: { mergeLimit?: number } = {},
): Promise<AiDiscourseHit[]> {
	const mergeLimit = options.mergeLimit ?? AI_SEARCH_CANDIDATE_LIMIT;
	const wide = mergeLimit >= 100;
	const perQueryLimit = wide ? PER_QUERY_LIMIT_WIDE : PER_QUERY_LIMIT_NARROW;

	if (wide) {
		const pool = uniqueQueries([
			...queries,
			...fallbackQueries,
			...uniqueQueries(queries).map(relaxSearchQuery),
		]);
		const batches = await searchBatchesConcurrently(pool, perQueryLimit);
		return mergeDiscourseHits(batches, mergeLimit).map(toAiDiscourseHit);
	}

	const batches: {
		query: string;
		hits: SearchResult[];
	}[] = [];
	const tried = new Set<string>();

	async function run(
		next: readonly string[],
		runOptions: { stopWhenMerged?: number } = {},
	): Promise<void> {
		for (const query of uniqueQueries(next)) {
			if (tried.size >= MAX_SEARCH_CALLS) return;
			if (tried.has(query)) continue;
			tried.add(query);
			const hits = await searchHitsForAiQuery(query, perQueryLimit);
			batches.push({ query, hits });
			if (
				typeof runOptions.stopWhenMerged === "number" &&
				mergeDiscourseHits(batches, mergeLimit).length >=
					runOptions.stopWhenMerged
			) {
				return;
			}
		}
	}

	await run(queries);
	let merged = mergeDiscourseHits(batches, mergeLimit);
	if (merged.length < ENOUGH_HITS) {
		await run(fallbackQueries, { stopWhenMerged: 8 });
		merged = mergeDiscourseHits(batches, mergeLimit);
	}
	if (merged.length < ENOUGH_HITS) {
		await run(uniqueQueries(queries).map(relaxSearchQuery), {
			stopWhenMerged: 8,
		});
	}
	return mergeDiscourseHits(batches, mergeLimit).map(toAiDiscourseHit);
}
