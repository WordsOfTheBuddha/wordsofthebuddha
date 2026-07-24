import type { UnifiedContentItem } from "../types/discover";
import type {
	ActiveToken,
	SuggestionEntityType,
	SuggestionIndexEntry,
	SuggestionSource,
} from "../types/suggestions";
import { normalizeForComparison } from "./searchRanking";
import { createSuggestionSearcher, DEFAULT_LIMIT } from "./suggestionSearcher";

const MIN_QUERY_LEN = 2;

const SOURCE_RANK: Record<SuggestionSource, number> = {
	pali: 0,
	tooltip: 1,
	title: 2,
	synonym: 3,
	corpus: 4,
};

const ENTITY_RANK: Record<SuggestionEntityType, number> = {
	quality: 0,
	topic: 1,
	simile: 2,
	person: 3,
};

function extractPaliTerms(paliArray: string[] | undefined): string[] {
	if (!paliArray?.length) return [];
	const terms: string[] = [];
	for (const raw of paliArray) {
		if (raw.includes(",")) {
			for (const part of raw.split(",")) {
				const t = part.trim();
				if (t) terms.push(t);
			}
		} else {
			const t = raw.trim();
			if (t) terms.push(t);
		}
	}
	return terms;
}

function dedupeCategoryData(items: UnifiedContentItem[]): UnifiedContentItem[] {
	const topics = items.filter((item) => item.type === "topic");
	const topicSlugs = new Set(topics.map((item) => item.slug));
	const topicPaliTerms = new Set<string>();

	for (const topic of topics) {
		for (const term of extractPaliTerms(topic.pali)) {
			topicPaliTerms.add(normalizeForComparison(term));
		}
	}

	return items.filter((item) => {
		if (item.type === "topic" || item.type === "simile" || item.type === "person") {
			return true;
		}
		if (topicSlugs.has(item.slug)) return false;
		for (const term of extractPaliTerms(item.pali)) {
			if (topicPaliTerms.has(normalizeForComparison(term))) return false;
		}
		return true;
	});
}

function upsertEntry(
	map: Map<string, SuggestionIndexEntry>,
	text: string,
	source: SuggestionSource,
	entityType: SuggestionEntityType,
): void {
	const trimmed = text.trim();
	if (trimmed.length < MIN_QUERY_LEN) return;

	const norm = normalizeForComparison(trimmed);
	if (!norm || norm.length < MIN_QUERY_LEN) return;

	const candidate: SuggestionIndexEntry = { text: trimmed, norm, source, entityType };
	const key = norm;
	const existing = map.get(key);
	if (!existing) {
		map.set(key, candidate);
		return;
	}

	const existingScore =
		SOURCE_RANK[existing.source] * 10 + ENTITY_RANK[existing.entityType];
	const candidateScore =
		SOURCE_RANK[candidate.source] * 10 + ENTITY_RANK[candidate.entityType];
	if (candidateScore < existingScore) {
		map.set(key, candidate);
	}
}

/** Build a flat suggestion index from unified category content. */
export function buildSuggestionEntries(
	items: UnifiedContentItem[],
): SuggestionIndexEntry[] {
	const map = new Map<string, SuggestionIndexEntry>();
	const deduped = dedupeCategoryData(items);

	for (const item of deduped) {
		const entityType = item.type;
		for (const pali of extractPaliTerms(item.pali)) {
			upsertEntry(map, pali, "pali", entityType);
		}
		upsertEntry(map, item.title, "title", entityType);
		for (const synonym of item.synonyms ?? []) {
			upsertEntry(map, synonym, "synonym", entityType);
		}
	}

	return Array.from(map.values()).sort((a, b) => a.text.localeCompare(b.text));
}

/** Merge additional layers without overriding curated entries. */
export function mergeSuggestionEntries(
	...layers: SuggestionIndexEntry[][]
): SuggestionIndexEntry[] {
	const map = new Map<string, SuggestionIndexEntry>();
	for (const layer of layers) {
		for (const entry of layer) {
			const existing = map.get(entry.norm);
			if (!existing) {
				map.set(entry.norm, entry);
				continue;
			}
			const existingScore =
				SOURCE_RANK[existing.source] * 10 + ENTITY_RANK[existing.entityType];
			const candidateScore =
				SOURCE_RANK[entry.source] * 10 + ENTITY_RANK[entry.entityType];
			if (candidateScore < existingScore) {
				map.set(entry.norm, entry);
			}
		}
	}
	return Array.from(map.values()).sort((a, b) => a.text.localeCompare(b.text));
}

/** Parse the token at the text cursor for autocomplete. */
export function parseActiveToken(value: string, cursor: number): ActiveToken | null {
	const safeCursor = Math.max(0, Math.min(cursor, value.length));
	let tokenStart = safeCursor;
	while (tokenStart > 0 && !/\s/.test(value[tokenStart - 1]!)) {
		tokenStart--;
	}
	let tokenEnd = safeCursor;
	while (tokenEnd < value.length && !/\s/.test(value[tokenEnd]!)) {
		tokenEnd++;
	}

	const fullToken = value.slice(tokenStart, tokenEnd);
	if (!fullToken) return null;

	const base: ActiveToken = {
		tokenStart,
		tokenEnd,
		matchStart: tokenStart,
		raw: fullToken,
		quotePrefix: "",
		suggestable: false,
	};

	if (/^[!^]/.test(fullToken) || /^(title|content):/.test(fullToken)) {
		return base;
	}

	let quotePrefix = "";
	let raw = fullToken;
	if (fullToken.startsWith("'") || fullToken.startsWith('"')) {
		quotePrefix = fullToken[0]!;
		raw = fullToken.slice(1);
		base.matchStart = tokenStart + quotePrefix.length;
	}

	base.quotePrefix = quotePrefix;
	base.raw = raw;

	if (raw.length < MIN_QUERY_LEN) {
		return base;
	}

	base.suggestable = true;
	return base;
}

/** Rank suggestions for a partial token (diacritic-insensitive). */
export function suggestForToken(
	query: string,
	entries: SuggestionIndexEntry[],
	limit = DEFAULT_LIMIT,
): SuggestionIndexEntry[] {
	return createSuggestionSearcher(entries).suggest(query, limit);
}

/** Replace the active token with a suggestion and return the new value + cursor. */
export function applySuggestion(
	value: string,
	token: ActiveToken,
	suggestionText: string,
): { value: string; cursor: number } {
	const replacement = `${token.quotePrefix}${suggestionText}`;
	const nextValue =
		value.slice(0, token.tokenStart) + replacement + value.slice(token.tokenEnd);
	const cursor = token.tokenStart + replacement.length;
	return { value: nextValue, cursor };
}
