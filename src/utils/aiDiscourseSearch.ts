import {
	ensureReferenceSearchIndexLoaded,
	getNormalizedContentMap,
	getSearchDocBySlug,
	performSearch,
	type SearchResult,
} from "../service/search/search";
import { getPtsDisplay } from "./ptsReferences";
import {
	mergeDiscourseHits,
	toAiDiscourseHit,
	type AiDiscourseHit,
	type DiscourseHitLike,
} from "./aiDiscourseHits";
import {
	isPrefixedAiDiscourseIdOnlyQuery,
	namedTermSearchQueries,
	normalizeAiSearchQuery,
	prefixedAiDiscourseIdsInQuery,
	prefixedAiDiscourseIdsInText,
	relaxSearchQuery,
} from "./aiSearchQuery";

export type { AiDiscourseHit } from "./aiDiscourseHits";
export { mergeDiscourseHits, toAiDiscourseHit } from "./aiDiscourseHits";
export {
	normalizeAiSearchQuery,
	relaxSearchQuery,
} from "./aiSearchQuery";

/**
 * Inflate the gzipped search indexes and body maps. Call this while the
 * planner is streaming so a cold isolate does not block the SSE after `plan`
 * (that stall is what the browser reports as a network error).
 */
export async function warmAskSearchIndexes(): Promise<void> {
	await ensureReferenceSearchIndexLoaded();
	await getNormalizedContentMap(true);
}

/** Hits kept per query before merge (wide pool for Gemini). */
const PER_QUERY_LIMIT_WIDE = 200;
/** Smaller per-query cap when not building a rerank pool. */
const PER_QUERY_LIMIT_NARROW = 12;
const ENOUGH_HITS = 3;
const MAX_SEARCH_CALLS = 12;
/**
 * Cap overlapping full-corpus searches. Ask used to Promise.all() every
 * query; on a cold Vercel instance that rebuilt Fuse + normalized body maps
 * ~12× and the function was killed for memory.
 */
const SEARCH_CONCURRENCY = 3;
/**
 * Wide pool for Gemini rescoring. Search overfits easily; send a large
 * candidate set and let the reranker pick the best 10–50.
 */
export const AI_SEARCH_CANDIDATE_LIMIT = 500;

/** Ask search must request snippets — the ranker/writer have no other body text. */
export const AI_ASK_SEARCH_OPTIONS = {
	includeReferences: true,
	includeContent: true,
	highlight: true,
} as const;

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

	if (isPrefixedAiDiscourseIdOnlyQuery(normalized)) {
		const hits: SearchResult[] = [];
		const seen = new Set<string>();
		for (const id of prefixedAiDiscourseIdsInQuery(normalized)) {
			const exact = await getSearchDocBySlug(id, true);
			if (exact) {
				const key = exact.slug.toLowerCase();
				if (seen.has(key)) continue;
				seen.add(key);
				hits.push(searchResultFromDoc(exact));
				continue;
			}
			const fuzzy = await performSearch(id, AI_ASK_SEARCH_OPTIONS);
			const exactHits = fuzzy.filter(
				(hit) => hit.slug.toLowerCase() === id.toLowerCase(),
			);
			for (const hit of exactHits.slice(0, 1)) {
				const key = hit.slug.toLowerCase();
				if (seen.has(key)) continue;
				seen.add(key);
				hits.push(hit);
			}
		}
		if (hits.length > 0) return hits;
	}

	const hits = await performSearch(normalized, AI_ASK_SEARCH_OPTIONS);
	return hits.slice(0, Math.max(1, limit));
}

async function mapPool<T, R>(
	items: readonly T[],
	concurrency: number,
	mapper: (item: T) => Promise<R>,
): Promise<R[]> {
	if (items.length === 0) return [];
	const results: R[] = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const index = next;
			next += 1;
			results[index] = await mapper(items[index]);
		}
	}
	const workers = Math.min(Math.max(1, concurrency), items.length);
	await Promise.all(Array.from({ length: workers }, () => worker()));
	return results;
}

async function searchBatchesConcurrently(
	queries: readonly string[],
	perQueryLimit: number,
	onProgress?: (info: {
		done: number;
		total: number;
		query: string;
		slugs: string[];
	}) => void,
): Promise<{ query: string; hits: SearchResult[] }[]> {
	const list = uniqueQueries(queries).slice(0, MAX_SEARCH_CALLS);
	let done = 0;
	return mapPool(list, SEARCH_CONCURRENCY, async (query) => {
		const hits = await searchHitsForAiQuery(query, perQueryLimit);
		done += 1;
		onProgress?.({
			done,
			total: list.length,
			query,
			slugs: hits.map((hit) => hit.slug).filter(Boolean),
		});
		return { query, hits };
	});
}

export interface AiDiscourseSearchBatch {
	query: string;
	slugs: string[];
}

export interface AiDiscourseSearchResult {
	hits: AiDiscourseHit[];
	/** Normalized batches used for merge (for fallback contribution checks). */
	batches: AiDiscourseSearchBatch[];
}

/**
 * Queries (primary or fallback) whose search actually surfaced at least one
 * of the final result slugs — so chips for dead-end searches can be dropped.
 * Returned in the caller’s order using the caller’s original spelling.
 */
export function queriesForResultSlugs(
	queries: readonly string[],
	batches: readonly AiDiscourseSearchBatch[],
	resultSlugs: readonly string[],
): string[] {
	const wanted = new Set(
		resultSlugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean),
	);
	if (wanted.size === 0) return [];
	const contributing = new Set<string>();
	for (const batch of batches) {
		if (batch.slugs.some((slug) => wanted.has(slug.toLowerCase()))) {
			contributing.add(batch.query.toLowerCase());
		}
	}
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of queries) {
		const key = normalizeAiSearchQuery(raw).toLowerCase();
		if (!key || seen.has(key) || !contributing.has(key)) continue;
		seen.add(key);
		out.push(raw);
	}
	return out;
}

/** @deprecated use queriesForResultSlugs */
export const fallbackQueriesForResultSlugs = queriesForResultSlugs;

function toSearchBatches(
	batches: readonly { query: string; hits: SearchResult[] }[],
): AiDiscourseSearchBatch[] {
	return batches.map((batch) => ({
		query: batch.query,
		slugs: batch.hits.map((hit) => hit.slug).filter(Boolean),
	}));
}

/**
 * Record which searches retrieved each hit, and prefer the named-term
 * highlight paragraph over a broader-query snippet when both exist.
 */
export function annotateAskSearchHits<T extends DiscourseHitLike>(
	hits: readonly T[],
	batches: readonly { query: string; hits: readonly DiscourseHitLike[] }[],
	options: {
		question?: string;
		primaryQueries?: readonly string[];
		termQueries?: readonly string[];
	} = {},
): T[] {
	const namedKeys = new Set(
		namedTermSearchQueries(
			options.question || "",
			options.primaryQueries || [],
			options.termQueries,
		).map((query) => query.toLowerCase()),
	);
	const bySlug = new Map<
		string,
		{ queries: string[]; namedSnippet: string | null; anySnippet: string | null }
	>();
	for (const batch of batches) {
		const query = normalizeAiSearchQuery(batch.query);
		if (!query) continue;
		const key = query.toLowerCase();
		const named = namedKeys.has(key);
		for (const hit of batch.hits) {
			if (!hit.slug) continue;
			const slug = hit.slug.toLowerCase();
			let entry = bySlug.get(slug);
			if (!entry) {
				entry = { queries: [], namedSnippet: null, anySnippet: null };
				bySlug.set(slug, entry);
			}
			if (!entry.queries.some((item) => item.toLowerCase() === key)) {
				entry.queries.push(query);
			}
			if (hit.contentSnippet) {
				if (!entry.anySnippet) entry.anySnippet = hit.contentSnippet;
				if (named && !entry.namedSnippet) {
					entry.namedSnippet = hit.contentSnippet;
				}
			}
		}
	}
	return hits.map((hit) => {
		const entry = bySlug.get(hit.slug.toLowerCase());
		const matchedQueries = entry?.queries || [];
		const snippet =
			entry?.namedSnippet || hit.contentSnippet || entry?.anySnippet || null;
		return {
			...hit,
			contentSnippet: snippet,
			...(matchedQueries.length > 0 ? { matchedQueries } : {}),
		};
	});
}

function finishAskSearch(
	merged: DiscourseHitLike[],
	batches: readonly { query: string; hits: SearchResult[] }[],
	queries: readonly string[],
	question: string,
	termQueries?: readonly string[],
): AiDiscourseSearchResult {
	const annotated = annotateAskSearchHits(merged, batches, {
		question,
		primaryQueries: queries,
		termQueries,
	});
	return {
		hits: annotated.map(toAiDiscourseHit),
		batches: toSearchBatches(batches),
	};
}

/**
 * Search all rewrite queries (and usually fallbacks) then merge.
 * For large mergeLimit (Gemini pool), runs queries concurrently and pulls
 * many hits per query so the reranker sees a broad set.
 */
export async function searchDiscoursesForQueries(
	queries: readonly string[],
	fallbackQueries: readonly string[] = [],
	options: {
		mergeLimit?: number;
		question?: string;
		termQueries?: readonly string[];
		onProgress?: (info: {
			done: number;
			total: number;
			query: string;
			slugs: string[];
		}) => void;
	} = {},
): Promise<AiDiscourseSearchResult> {
	const mergeLimit = options.mergeLimit ?? AI_SEARCH_CANDIDATE_LIMIT;
	const question = options.question || "";
	const termQueries = options.termQueries || [];
	const onProgress = options.onProgress;
	const wide = mergeLimit >= 100;
	const perQueryLimit = wide ? PER_QUERY_LIMIT_WIDE : PER_QUERY_LIMIT_NARROW;
	const namedIds = prefixedAiDiscourseIdsInText(question);

	if (wide) {
		// Inflate shared indexes once before fan-out. Overlapping first searches
		// used to each copy ~27 MB of body text into normalized maps.
		await ensureReferenceSearchIndexLoaded();
		await getNormalizedContentMap(true);
		const pool = uniqueQueries([
			...namedIds,
			...queries,
			...fallbackQueries,
			...uniqueQueries(queries).map(relaxSearchQuery),
		]);
		const batches = await searchBatchesConcurrently(
			pool,
			perQueryLimit,
			onProgress,
		);
		return finishAskSearch(
			mergeDiscourseHits(batches, mergeLimit),
			batches,
			queries,
			question,
			termQueries,
		);
	}

	const batches: {
		query: string;
		hits: SearchResult[];
	}[] = [];
	const tried = new Set<string>();
	const planned = uniqueQueries([
		...namedIds,
		...queries,
		...fallbackQueries,
		...uniqueQueries(queries).map(relaxSearchQuery),
	]).slice(0, MAX_SEARCH_CALLS);

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
			onProgress?.({
				done: tried.size,
				total: Math.max(planned.length, tried.size),
				query,
				slugs: hits.map((hit) => hit.slug).filter(Boolean),
			});
			if (
				typeof runOptions.stopWhenMerged === "number" &&
				mergeDiscourseHits(batches, mergeLimit).length >=
					runOptions.stopWhenMerged
			) {
				return;
			}
		}
	}

	await run(namedIds);
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
	return finishAskSearch(
		mergeDiscourseHits(batches, mergeLimit),
		batches,
		queries,
		question,
		termQueries,
	);
}
