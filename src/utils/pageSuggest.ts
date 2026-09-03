import type { DiscourseSuggestHit } from "./discourseIdSuggest";
import { compactDiscourseIdQuery, MIN_TITLE_SUGGEST_LEN } from "./discourseIdSuggest";
import { normalizeForComparison } from "./searchRanking";

export type PageSuggestKind = "essay" | "topic" | "quality" | "simile" | "page";

export interface PageSuggestEntry {
	kind: PageSuggestKind;
	title: string;
	href: string;
	aliases: string[];
	/** Overrides the default kind label (e.g. "Anthology"). */
	label?: string;
}

export interface PageSuggestHit extends PageSuggestEntry {
	exact: boolean;
	kindLabel: string;
}

export type NavSuggestItem =
	| { type: "discourse"; hit: DiscourseSuggestHit }
	| { type: "page"; hit: PageSuggestHit };

export const PAGE_KIND_LABEL: Record<PageSuggestKind, string> = {
	essay: "Essay",
	topic: "Topic",
	quality: "Quality",
	simile: "Simile",
	page: "Page",
};

const KIND_DEDUP_RANK: Record<PageSuggestKind, number> = {
	essay: 0,
	topic: 1,
	quality: 2,
	simile: 3,
	page: 4,
};

const CATALOG_KINDS = new Set<PageSuggestKind>(["topic", "quality", "simile"]);

/** Prefix-match qualities/topics/similes/site pages from this length up. */
export const CATALOG_PREFIX_MIN_LEN = 5;

/** When the query filters by quality/topic/simile, prefix-match from this length. */
export const CATALOG_FILTER_PREFIX_MIN_LEN = 3;

/** Hide catalog pages once more than this many discourses already matched. */
export const MAX_DISCOURSES_FOR_CATALOG = 4;

const MAX_CATALOG_HITS = 5;

/** Hand-maintained site pages shown on exact title/alias match. */
export const SITE_PAGE_SUGGESTIONS: PageSuggestEntry[] = [
	{
		kind: "page",
		title: "Support",
		href: "/support",
		aliases: ["give", "gift", "donate", "donation", "giving"],
	},
	{
		kind: "page",
		title: "Discover",
		href: "/discover",
		aliases: ["explore"],
	},
	{
		kind: "page",
		title: "Recently Added",
		href: "/recent",
		aliases: ["recent", "recently added", "latest discourses", "new translations"],
	},
	{
		kind: "page",
		title: "Ask the discourses",
		href: "/search?mode=ai",
		aliases: ["ask", "ai mode", "ask a question"],
	},
	{
		kind: "page",
		title: "Privacy Policy",
		href: "/privacy",
		aliases: ["privacy"],
	},
	{
		kind: "page",
		title: "Public Domain",
		href: "/public-domain",
		aliases: ["public-domain", "cc0"],
	},
	{
		kind: "page",
		title: "Offline Control Center",
		href: "/offline",
		aliases: ["offline", "offline access"],
	},
	{ kind: "page", title: "Anthologies", href: "/anthologies", aliases: [] },
	{
		kind: "page",
		title: "Similes",
		href: "/simile",
		aliases: ["simile"],
	},
	{
		kind: "page",
		title: "Qualities",
		href: "/qualities",
		aliases: ["topic", "topics", "quality", "mental qualities"],
	},
	{
		kind: "page",
		title: "In the Buddha's Words",
		href: "/anthologies/in-the-buddhas-words",
		aliases: ["in the buddhas words", "in-the-buddhas-words"],
		label: "Anthology",
	},
	{
		kind: "page",
		title: "Noble Truths, Noble Path",
		href: "/anthologies/noble-truths-noble-path",
		aliases: ["noble truths noble path", "noble-truths-noble-path"],
		label: "Anthology",
	},
];

export function pageKindLabel(entry: Pick<PageSuggestEntry, "kind" | "label">): string {
	return entry.label || PAGE_KIND_LABEL[entry.kind];
}

/** Collapse punctuation/hyphens so "Buddha's" and "buddhas" compare equal. */
export function normalizePageKey(value: string): string {
	return normalizeForComparison(value)
		.replace(/[''`]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function splitTitleWords(value: string): string[] {
	return value.split(/\s+/).filter(Boolean);
}

function wordsMatchInOrder(haystack: string[], needles: string[]): boolean {
	if (needles.length === 0) return false;
	let i = 0;
	for (const needle of needles) {
		let found = false;
		while (i < haystack.length) {
			if (haystack[i]!.startsWith(needle)) {
				found = true;
				i += 1;
				break;
			}
			i += 1;
		}
		if (!found) return false;
	}
	return true;
}

function uniqueAliasKeys(title: string, aliases: readonly string[]): string[] {
	const titleKey = normalizePageKey(title);
	const seen = new Set<string>(titleKey ? [titleKey] : []);
	const out: string[] = [];
	for (const alias of aliases) {
		const key = normalizePageKey(alias);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(alias);
		if (out.length >= 20) break;
	}
	return out;
}

export function compactPageAliases(
	title: string,
	aliases: readonly string[],
): string[] {
	return uniqueAliasKeys(title, aliases);
}

/** Keep the higher-priority kind when two catalog items share an href. */
export function dedupePageEntries(
	entries: readonly PageSuggestEntry[],
): PageSuggestEntry[] {
	const byHref = new Map<string, PageSuggestEntry>();
	for (const entry of entries) {
		const existing = byHref.get(entry.href);
		if (
			existing &&
			KIND_DEDUP_RANK[existing.kind] <= KIND_DEDUP_RANK[entry.kind]
		) {
			continue;
		}
		byHref.set(entry.href, {
			...entry,
			aliases: compactPageAliases(entry.title, entry.aliases),
		});
	}
	return [...byHref.values()];
}

type PageMatchMode = "exact" | "prefix";

function queryKeys(queryNorm: string): string[] {
	const keys = [queryNorm];
	const stripped = queryNorm.replace(/^(the|an|a) /, "");
	if (stripped && stripped !== queryNorm) keys.push(stripped);
	return keys;
}

function pageMatches(
	entry: PageSuggestEntry,
	queryNorm: string,
	mode: PageMatchMode,
): { matched: boolean; exact: boolean } {
	const texts = [entry.title, ...entry.aliases];
	let prefix = false;
	for (const query of queryKeys(queryNorm)) {
		for (const text of texts) {
			const norm = normalizePageKey(text);
			if (!norm) continue;
			if (norm === query) return { matched: true, exact: true };
			if (mode === "prefix" && norm.startsWith(query)) prefix = true;
		}
		if (mode === "prefix") {
			const titleWords = splitTitleWords(normalizePageKey(entry.title));
			const queryWords = splitTitleWords(query);
			if (wordsMatchInOrder(titleWords, queryWords)) {
				prefix = true;
			}
		}
	}
	return { matched: prefix, exact: false };
}

function toPageHit(entry: PageSuggestEntry, exact: boolean): PageSuggestHit {
	return {
		...entry,
		exact,
		kindLabel: pageKindLabel(entry),
	};
}

export function matchPageEntries(
	pages: readonly PageSuggestEntry[],
	queryNorm: string,
	options: { kinds: readonly PageSuggestKind[]; mode: PageMatchMode },
): PageSuggestHit[] {
	const kindSet = new Set(options.kinds);
	const hits: PageSuggestHit[] = [];
	for (const entry of pages) {
		if (!kindSet.has(entry.kind)) continue;
		const { matched, exact } = pageMatches(entry, queryNorm, options.mode);
		if (!matched) continue;
		hits.push(toPageHit(entry, exact));
	}
	hits.sort((a, b) => {
		if (a.exact !== b.exact) return a.exact ? -1 : 1;
		return a.title.length - b.title.length || a.title.localeCompare(b.title);
	});
	return hits;
}

const KIND_HINT_WORDS: Record<string, PageSuggestKind[]> = {
	quality: ["quality", "topic"],
	qualities: ["quality", "topic"],
	topic: ["topic", "quality"],
	topics: ["topic", "quality"],
	simile: ["simile"],
	similes: ["simile"],
};

const KIND_PREFIX_RE =
	/^(quality|qualities|topic|topics|simile|similes)\s*:\s*(.+)$/i;

/** Strip quality/topic/simile hint words so the rest can match catalog titles. */
export function parseCatalogKindHint(
	queryNorm: string,
	rawQuery = "",
): {
	remainder: string;
	kinds: PageSuggestKind[] | null;
	forced: boolean;
} {
	const prefixed = rawQuery.trim().match(KIND_PREFIX_RE);
	if (prefixed) {
		const hinted = KIND_HINT_WORDS[prefixed[1]!.toLowerCase()];
		const remainder = normalizePageKey(prefixed[2] ?? "");
		if (hinted && remainder) {
			return { remainder, kinds: hinted, forced: true };
		}
	}

	const words = splitTitleWords(queryNorm);
	const kinds = new Set<PageSuggestKind>();
	const rest: string[] = [];
	for (const word of words) {
		const hinted = KIND_HINT_WORDS[word];
		if (hinted) {
			for (const kind of hinted) kinds.add(kind);
		} else {
			rest.push(word);
		}
	}
	if (kinds.size === 0) {
		return { remainder: queryNorm, kinds: null, forced: false };
	}
	const remainder = rest.join(" ");
	return {
		remainder,
		kinds: [...kinds],
		forced: remainder.length > 0,
	};
}

function catalogMatchMode(
	queryNorm: string,
	prefixMinLen = CATALOG_PREFIX_MIN_LEN,
): PageMatchMode {
	return queryNorm.length >= prefixMinLen ? "prefix" : "exact";
}

export function hasCatalogKindFilter(rawQuery: string): boolean {
	return parseCatalogKindHint(normalizePageKey(rawQuery), rawQuery).forced;
}

/**
 * Essays first (prefix OK), then discourses, then topic/quality/simile pages
 * (exact, or prefix from 5 characters — 3 when filtering by quality/topic/simile)
 * then other site pages. Queries that include quality/topic/simile — including
 * `quality:radical` — always surface matching catalog pages for the remaining
 * words. ID-shaped queries stay discourse-only.
 */
export function composeNavSuggestions(
	query: string,
	discourses: readonly DiscourseSuggestHit[],
	pages: readonly PageSuggestEntry[],
): NavSuggestItem[] {
	if (compactDiscourseIdQuery(query)) {
		return discourses.map((hit) => ({ type: "discourse", hit }));
	}

	const queryNorm = normalizePageKey(query);
	if (queryNorm.length < MIN_TITLE_SUGGEST_LEN) {
		return discourses.map((hit) => ({ type: "discourse", hit }));
	}

	const hint = parseCatalogKindHint(queryNorm, query);
	const catalogQuery = hint.forced ? hint.remainder : queryNorm;
	const pageMode = catalogMatchMode(queryNorm);
	const catalogMode = catalogMatchMode(
		catalogQuery,
		hint.forced ? CATALOG_FILTER_PREFIX_MIN_LEN : CATALOG_PREFIX_MIN_LEN,
	);
	const essays = matchPageEntries(pages, queryNorm, {
		kinds: ["essay"],
		mode: "prefix",
	});
	const catalog = matchPageEntries(pages, catalogQuery, {
		kinds: hint.kinds ?? [...CATALOG_KINDS],
		mode: catalogMode,
	}).slice(0, MAX_CATALOG_HITS);
	const site = matchPageEntries(pages, queryNorm, {
		kinds: ["page"],
		mode: pageMode,
	});

	const items: NavSuggestItem[] = [
		...essays.map((hit) => ({ type: "page" as const, hit })),
		...discourses.map((hit) => ({ type: "discourse" as const, hit })),
	];

	if (hint.forced || discourses.length <= MAX_DISCOURSES_FOR_CATALOG) {
		items.push(...catalog.map((hit) => ({ type: "page" as const, hit })));
	}

	const seen = new Set(
		items.filter((item) => item.type === "page").map((item) => item.hit.href),
	);
	for (const hit of site) {
		if (seen.has(hit.href)) continue;
		items.push({ type: "page", hit });
		seen.add(hit.href);
	}

	return items;
}
