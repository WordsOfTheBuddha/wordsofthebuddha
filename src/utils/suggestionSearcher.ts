import type { SuggestionIndexEntry } from "../types/suggestions";
import { inflectionStemKey } from "./paliInflectionUtils";
import { normalizeForComparison } from "./searchRanking";

const SOURCE_RANK = {
	pali: 0,
	tooltip: 1,
	title: 2,
	synonym: 3,
	corpus: 4,
} as const;

const ENTITY_RANK = {
	quality: 0,
	topic: 1,
	simile: 2,
	person: 3,
} as const;

const MATCH_TIER = {
	exact: 0,
	prefix: 1,
	contains: 2,
	fuzzy: 3,
} as const;

type MatchTier = (typeof MATCH_TIER)[keyof typeof MATCH_TIER];

const MIN_QUERY_LEN = 2;
const MIN_FUZZY_QUERY_LEN = 4;
const DEFAULT_LIMIT = 8;
const LOWER_ALPHA = "abcdefghijklmnopqrstuvwxyz";

/** All normalized index keys one edit away from `q` (for O(1) fuzzy lookup). */
function neighborsAtEditDistance1(q: string): string[] {
	const out = new Set<string>();

	for (let i = 0; i < q.length; i++) {
		out.add(q.slice(0, i) + q.slice(i + 1));
	}
	for (let i = 0; i < q.length; i++) {
		const ch = q[i]!;
		for (const c of LOWER_ALPHA) {
			if (c !== ch) out.add(q.slice(0, i) + c + q.slice(i + 1));
		}
	}
	for (let i = 0; i <= q.length; i++) {
		for (const c of LOWER_ALPHA) {
			out.add(q.slice(0, i) + c + q.slice(i));
		}
	}

	out.delete(q);
	return [...out];
}

function buildNormIndex(
	entries: SuggestionIndexEntry[],
): Map<string, SuggestionIndexEntry[]> {
	const map = new Map<string, SuggestionIndexEntry[]>();
	for (const entry of entries) {
		const bucket = map.get(entry.norm);
		if (bucket) bucket.push(entry);
		else map.set(entry.norm, [entry]);
	}
	return map;
}

function collectFuzzyMatches(
	query: string,
	normIndex: Map<string, SuggestionIndexEntry[]>,
	seen: Set<string>,
): Array<{ entry: SuggestionIndexEntry; score: number }> {
	const matches: Array<{ entry: SuggestionIndexEntry; score: number }> = [];

	for (const neighbor of neighborsAtEditDistance1(query)) {
		const entries = normIndex.get(neighbor);
		if (!entries) continue;
		for (const entry of entries) {
			if (seen.has(entry.norm)) continue;
			matches.push({
				entry,
				score: scoreEntry(entry, MATCH_TIER.fuzzy, query),
			});
			seen.add(entry.norm);
		}
	}

	return matches;
}

function scoreEntry(
	entry: SuggestionIndexEntry,
	tier: MatchTier,
	query: string,
): number {
	const prefixBonus =
		tier === MATCH_TIER.prefix
			? Math.max(0, entry.norm.length - query.length)
			: 0;
	return (
		tier * 10_000 +
		SOURCE_RANK[entry.source] * 1_000 +
		ENTITY_RANK[entry.entityType] * 100 +
		prefixBonus * 10 +
		entry.norm.length
	);
}

function lowerBoundNorm(
	sorted: SuggestionIndexEntry[],
	query: string,
): number {
	let lo = 0;
	let hi = sorted.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid]!.norm < query) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

function rankMatches(
	matches: Array<{ entry: SuggestionIndexEntry; score: number }>,
	limit: number,
): SuggestionIndexEntry[] {
	matches.sort((a, b) => {
		if (a.score !== b.score) return a.score - b.score;
		return a.entry.text.localeCompare(b.entry.text);
	});

	const seen = new Set<string>();
	const results: SuggestionIndexEntry[] = [];
	for (const { entry } of matches) {
		if (seen.has(entry.norm)) continue;
		seen.add(entry.norm);
		results.push(entry);
		if (results.length >= limit) break;
	}
	return results;
}

function collectPrefixMatches(
	sorted: SuggestionIndexEntry[],
	query: string,
): Array<{ entry: SuggestionIndexEntry; score: number }> {
	const start = lowerBoundNorm(sorted, query);
	const matches: Array<{ entry: SuggestionIndexEntry; score: number }> = [];

	for (let i = start; i < sorted.length; i++) {
		const entry = sorted[i]!;
		if (!entry.norm.startsWith(query)) break;
		const tier =
			entry.norm === query ? MATCH_TIER.exact : MATCH_TIER.prefix;
		matches.push({ entry, score: scoreEntry(entry, tier, query) });
	}

	return matches;
}

function collectInflectionMatches(
	byStem: Map<string, SuggestionIndexEntry[]>,
	query: string,
	seen: Set<string>,
): Array<{ entry: SuggestionIndexEntry; score: number }> {
	const qStem = inflectionStemKey(query);
	const hits = byStem.get(qStem) ?? [];
	const matches: Array<{ entry: SuggestionIndexEntry; score: number }> = [];

	for (const entry of hits) {
		if (seen.has(entry.norm) || entry.norm.startsWith(query)) continue;
		if (inflectionStemKey(entry.norm) !== qStem) continue;
		const tier =
			entry.norm === query ? MATCH_TIER.exact : MATCH_TIER.prefix;
		matches.push({ entry, score: scoreEntry(entry, tier, query) });
		seen.add(entry.norm);
	}

	return matches;
}

function suggestFromSorted(
	sorted: SuggestionIndexEntry[],
	byStem: Map<string, SuggestionIndexEntry[]>,
	normIndex: Map<string, SuggestionIndexEntry[]>,
	query: string,
	limit = DEFAULT_LIMIT,
): SuggestionIndexEntry[] {
	const q = normalizeForComparison(query.trim());
	if (q.length < MIN_QUERY_LEN) return [];

	const prefixMatches = collectPrefixMatches(sorted, q);
	const seen = new Set(prefixMatches.map((m) => m.entry.norm));
	const matches = [...prefixMatches];

	const inflectionMatches = collectInflectionMatches(byStem, q, seen);
	matches.push(...inflectionMatches);

	const hasExact = matches.some((m) => m.entry.norm === q);
	if (q.length >= MIN_FUZZY_QUERY_LEN && !hasExact) {
		matches.push(...collectFuzzyMatches(q, normIndex, seen));
	}

	if (matches.length < limit) {
		for (const entry of sorted) {
			if (seen.has(entry.norm)) continue;
			if (entry.norm.includes(q) && !entry.norm.startsWith(q)) {
				matches.push({
					entry,
					score: scoreEntry(entry, MATCH_TIER.contains, q),
				});
				seen.add(entry.norm);
			}
		}
	}

	return rankMatches(matches, limit);
}

export interface SuggestionSearcher {
	suggest: (query: string, limit?: number) => SuggestionIndexEntry[];
}

/** Build a sorted, prefix-aware searcher (create once per loaded index). */
export function createSuggestionSearcher(
	entries: SuggestionIndexEntry[],
): SuggestionSearcher {
	const sorted = [...entries].sort((a, b) => a.norm.localeCompare(b.norm));
	const byStem = new Map<string, SuggestionIndexEntry[]>();
	for (const entry of sorted) {
		const stem = inflectionStemKey(entry.norm);
		const bucket = byStem.get(stem);
		if (bucket) bucket.push(entry);
		else byStem.set(stem, [entry]);
	}
	const normIndex = buildNormIndex(sorted);
	return {
		suggest: (query: string, limit = DEFAULT_LIMIT) =>
			suggestFromSorted(sorted, byStem, normIndex, query, limit),
	};
}

export {
	suggestFromSorted,
	buildNormIndex,
	neighborsAtEditDistance1,
	MIN_FUZZY_QUERY_LEN,
	DEFAULT_LIMIT,
};
