import { compareDiscourseIds, formatDiscourseTitle } from "./discourseSort";
import { normalizeForComparison } from "./searchRanking";

export interface DiscourseSuggestEntry {
	slug: string;
	title: string;
	referenceOnly: boolean;
}

export interface DiscourseSuggestHit extends DiscourseSuggestEntry {
	idLabel: string;
	paliTitle: string;
	englishTitle: string;
	shortTitle: string;
	href: string;
	exact: boolean;
}

export const DEFAULT_DISCOURSE_SUGGEST_LIMIT = 8;
export const MIN_TITLE_SUGGEST_LEN = 3;

const ID_QUERY = /^[a-z]{2,5}\d[\d.\-]*$/;

/** Compact form: "MN 10" → "mn10", "AN 6.12" → "an6.12". Null if not ID-shaped. */
export function compactDiscourseIdQuery(raw: string): string | null {
	const compact = raw.trim().toLowerCase().replace(/\s+/g, "");
	if (!ID_QUERY.test(compact)) return null;
	return compact;
}

export function isDiscourseIdQuery(raw: string): boolean {
	return compactDiscourseIdQuery(raw) !== null;
}

export function splitDiscourseTitle(title: string): {
	pali: string;
	english: string;
} {
	const trimmed = title.trim();
	const idx = trimmed.indexOf(" - ");
	if (idx >= 0) {
		return {
			pali: trimmed.slice(0, idx).trim(),
			english: trimmed.slice(idx + 3).trim(),
		};
	}
	if (!trimmed.includes(" ") && /sutta/i.test(trimmed)) {
		return { pali: trimmed, english: "" };
	}
	return { pali: "", english: trimmed };
}

export function shortDiscourseTitle(title: string): string {
	const { pali, english } = splitDiscourseTitle(title);
	return english || pali;
}

export function discourseSuggestHref(slug: string): string {
	return `/${slug}`;
}

function toHit(entry: DiscourseSuggestEntry, exact: boolean): DiscourseSuggestHit {
	const { pali, english } = splitDiscourseTitle(entry.title);
	return {
		...entry,
		idLabel: formatDiscourseTitle(entry.slug),
		paliTitle: pali,
		englishTitle: english,
		shortTitle: english || pali,
		href: discourseSuggestHref(entry.slug),
		exact,
	};
}

function nativeFirst(a: DiscourseSuggestEntry, b: DiscourseSuggestEntry): number {
	const id = compareDiscourseIds(a.slug, b.slug);
	if (id !== 0) return id;
	return Number(a.referenceOnly) - Number(b.referenceOnly);
}

/**
 * Prefix that continues at a segment boundary (an6 → an6.1, not an60).
 * After a dotted query, also allow last-segment digit growth (an6.1 → an6.12).
 */
export function isDiscourseIdPrefix(slug: string, compact: string): boolean {
	if (slug === compact) return false;
	if (slug.startsWith(`${compact}.`) || slug.startsWith(`${compact}-`)) {
		return true;
	}
	if (compact.includes(".") && slug.startsWith(compact)) {
		const next = slug.charAt(compact.length);
		return next >= "0" && next <= "9";
	}
	return false;
}

type TitleMatchRank = 0 | 1 | 2;

function titleMatchRank(
	entry: DiscourseSuggestEntry,
	queryNorm: string,
): TitleMatchRank | null {
	const { pali, english } = splitDiscourseTitle(entry.title);
	const paliNorm = normalizeForComparison(pali);
	const englishNorm = normalizeForComparison(english);

	if (paliNorm === queryNorm || englishNorm === queryNorm) return 0;
	if (paliNorm.startsWith(queryNorm) || englishNorm.startsWith(queryNorm)) {
		return 1;
	}

	const words = `${paliNorm} ${englishNorm}`.split(/[\s\-_]+/).filter(Boolean);
	if (words.some((word) => word.startsWith(queryNorm))) return 2;
	return null;
}

function suggestByTitle(
	entries: readonly DiscourseSuggestEntry[],
	raw: string,
	limit: number,
): DiscourseSuggestHit[] {
	const queryNorm = normalizeForComparison(raw.trim());
	if (queryNorm.length < MIN_TITLE_SUGGEST_LEN) return [];

	const ranked: Array<{ entry: DiscourseSuggestEntry; rank: TitleMatchRank }> =
		[];
	for (const entry of entries) {
		const rank = titleMatchRank(entry, queryNorm);
		if (rank === null) continue;
		ranked.push({ entry, rank });
	}

	ranked.sort((a, b) => {
		if (a.rank !== b.rank) return a.rank - b.rank;
		const native = Number(a.entry.referenceOnly) - Number(b.entry.referenceOnly);
		if (native !== 0) return native;
		return compareDiscourseIds(a.entry.slug, b.entry.slug);
	});

	return ranked.slice(0, limit).map(({ entry, rank }) => toHit(entry, rank === 0));
}

export function suggestDiscourses(
	entries: readonly DiscourseSuggestEntry[],
	raw: string,
	limit = DEFAULT_DISCOURSE_SUGGEST_LIMIT,
): DiscourseSuggestHit[] {
	const compact = compactDiscourseIdQuery(raw);
	if (!compact) {
		return suggestByTitle(entries, raw, limit);
	}

	const exact: DiscourseSuggestEntry[] = [];
	const prefix: DiscourseSuggestEntry[] = [];
	for (const entry of entries) {
		if (entry.slug === compact) exact.push(entry);
		else if (isDiscourseIdPrefix(entry.slug, compact)) prefix.push(entry);
	}

	exact.sort(nativeFirst);
	prefix.sort(nativeFirst);

	return [
		...exact.map((entry) => toHit(entry, true)),
		...prefix.map((entry) => toHit(entry, false)),
	].slice(0, limit);
}

/** Unique exact ID hit (native preferred). Used for Enter with nothing highlighted. */
export function uniqueExactDiscourse(
	entries: readonly DiscourseSuggestEntry[],
	raw: string,
): DiscourseSuggestHit | null {
	const compact = compactDiscourseIdQuery(raw);
	if (!compact) return null;
	const exact = entries.filter((entry) => entry.slug === compact);
	if (exact.length === 0) return null;
	exact.sort(nativeFirst);
	return toHit(exact[0]!, true);
}
