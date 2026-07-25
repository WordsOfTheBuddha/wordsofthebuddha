export const SEARCH_HISTORY_KEY = "searchRecentQueries";

const STORAGE_VERSION = 1;
export const MAX_SEARCH_HISTORY_ENTRIES = 250;
export const MAX_RECENT_SEARCHES_SHOWN = 8;
export const MIN_RECENT_SEARCH_QUERY_LENGTH = 4;

export function isValidRecentSearchQuery(query: string): boolean {
	return query.trim().length >= MIN_RECENT_SEARCH_QUERY_LENGTH;
}

export interface SearchHistoryEntry {
	q: string;
	ts: number;
}

interface SearchHistoryStore {
	v: number;
	items: SearchHistoryEntry[];
}

/** 0 = string prefix, 1 = word-start match, 2 = contains elsewhere */
type RecentMatchTier = 0 | 1 | 2;

function readStore(): SearchHistoryStore {
	try {
		const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
		if (!raw) return { v: STORAGE_VERSION, items: [] };
		const parsed = JSON.parse(raw) as Partial<SearchHistoryStore>;
		if (parsed.v !== STORAGE_VERSION || !Array.isArray(parsed.items)) {
			return { v: STORAGE_VERSION, items: [] };
		}
		const items = parsed.items.filter(
			(entry): entry is SearchHistoryEntry =>
				typeof entry?.q === "string" &&
				entry.q.trim().length > 0 &&
				typeof entry.ts === "number",
		);
		return { v: STORAGE_VERSION, items };
	} catch {
		return { v: STORAGE_VERSION, items: [] };
	}
}

function writeStore(store: SearchHistoryStore): void {
	try {
		localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(store));
	} catch {
		// ignore quota / private mode
	}
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function getRecentMatchTier(query: string, needle: string): RecentMatchTier | null {
	const q = query.toLowerCase();
	const n = needle.toLowerCase();
	if (!n) return 0;
	if (q.startsWith(n)) return 0;

	const wordStart = new RegExp(`(?:^|\\s)${escapeRegex(n)}`, "i");
	if (wordStart.test(query)) return 1;

	if (q.includes(n)) return 2;
	return null;
}

export function getSearchHistory(): SearchHistoryEntry[] {
	return readStore().items;
}

export function getRecentSearchQueries(): string[] {
	return getSearchHistory().map((entry) => entry.q);
}

export function filterRecentSearches(
	queries: string[],
	prefix: string,
	maxShown = MAX_RECENT_SEARCHES_SHOWN,
): string[] {
	const trimmed = prefix.trim();
	if (!trimmed) return queries.slice(0, maxShown);

	const ranked: { query: string; tier: RecentMatchTier; index: number }[] = [];
	queries.forEach((query, index) => {
		const tier = getRecentMatchTier(query, trimmed);
		if (tier !== null) {
			ranked.push({ query, tier, index });
		}
	});

	ranked.sort((a, b) => {
		if (a.tier !== b.tier) return a.tier - b.tier;
		return a.index - b.index;
	});

	return ranked.slice(0, maxShown).map((entry) => entry.query);
}

export function highlightRecentSearchQuery(text: string, needle: string): string {
	const trimmed = needle.trim();
	if (!trimmed) return escapeHtml(text);

	const lower = text.toLowerCase();
	const n = trimmed.toLowerCase();

	if (lower.startsWith(n)) {
		const matched = escapeHtml(text.slice(0, trimmed.length));
		const after = escapeHtml(text.slice(trimmed.length));
		return `<mark class="search-suggest-mark">${matched}</mark>${after}`;
	}

	const wordStart = new RegExp(`(^|\\s)(${escapeRegex(trimmed)})`, "i");
	const wordMatch = wordStart.exec(text);
	if (wordMatch && wordMatch.index !== undefined) {
		const start = wordMatch.index + wordMatch[1].length;
		const before = escapeHtml(text.slice(0, start));
		const matched = escapeHtml(text.slice(start, start + trimmed.length));
		const after = escapeHtml(text.slice(start + trimmed.length));
		return `${before}<mark class="search-suggest-mark">${matched}</mark>${after}`;
	}

	const idx = lower.indexOf(n);
	if (idx >= 0) {
		const before = escapeHtml(text.slice(0, idx));
		const matched = escapeHtml(text.slice(idx, idx + trimmed.length));
		const after = escapeHtml(text.slice(idx + trimmed.length));
		return `${before}<mark class="search-suggest-mark">${matched}</mark>${after}`;
	}

	return escapeHtml(text);
}

export function addSearchHistory(query: string): void {
	const q = query.trim();
	if (!isValidRecentSearchQuery(q)) return;

	const store = readStore();
	const now = Date.now();
	const withoutDup = store.items.filter(
		(entry) => entry.q.toLowerCase() !== q.toLowerCase(),
	);
	const items = [{ q, ts: now }, ...withoutDup].slice(
		0,
		MAX_SEARCH_HISTORY_ENTRIES,
	);
	writeStore({ v: STORAGE_VERSION, items });
}

export function clearSearchHistory(): void {
	try {
		localStorage.removeItem(SEARCH_HISTORY_KEY);
	} catch {
		// ignore
	}
}
