import { compareDiscourseIds, formatDiscourseTitle } from "./discourseSort";
import {
	compactDiscourseIdQuery,
	discourseIdKey,
	isDiscourseIdPrefix,
	isDiscourseRangeContainment,
	isPrefixedDiscourseId,
	normalizeForComparison,
} from "./searchRanking";

export {
	compactDiscourseIdQuery,
	discourseIdKey,
	discourseNumericId,
	isDiscourseIdPrefix,
	isDiscourseIdQuery,
	isDiscourseRangeContainment,
	isPrefixedDiscourseId,
} from "./searchRanking";

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

export const DEFAULT_DISCOURSE_SUGGEST_LIMIT = 11;
export const NARROW_DISCOURSE_SUGGEST_LIMIT = 5;
export const MIN_TITLE_SUGGEST_LEN = 3;

/** Fewer hits on phones so stacked ID + title rows stay scannable. */
export function discourseSuggestLimit(): number {
	if (typeof window === "undefined") return DEFAULT_DISCOURSE_SUGGEST_LIMIT;
	return window.matchMedia("(max-width: 767px)").matches
		? NARROW_DISCOURSE_SUGGEST_LIMIT
		: DEFAULT_DISCOURSE_SUGGEST_LIMIT;
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
 * Suggest-only: mn1 → mn10, iti4 → iti40. Remainder must be digits so
 * an1 does not pull in an10.1. Ranking still uses isDiscourseIdPrefix.
 * Also used on numeric tails so `10` can continue to `100`.
 */
export function isUndottedNumberContinuation(slug: string, compact: string): boolean {
	if (slug === compact || !slug.startsWith(compact)) return false;
	return /^\d+$/.test(slug.slice(compact.length));
}

type TitleMatchRank = 0 | 1 | 2;

function splitTitleWords(value: string): string[] {
	return value.split(/[\s\-_]+/).filter(Boolean);
}

/** Each query word is a prefix of a later title word (skips in between). */
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

function titleMatchRank(
	entry: DiscourseSuggestEntry,
	queryNorm: string,
): TitleMatchRank | null {
	const { pali, english } = splitDiscourseTitle(entry.title);
	const paliNorm = normalizeForComparison(pali);
	const englishNorm = normalizeForComparison(english);
	const combined = `${paliNorm} ${englishNorm}`.trim();

	if (paliNorm === queryNorm || englishNorm === queryNorm) return 0;
	if (
		paliNorm.startsWith(queryNorm) ||
		englishNorm.startsWith(queryNorm) ||
		combined.startsWith(queryNorm)
	) {
		return 1;
	}

	const needles = splitTitleWords(queryNorm);
	const haystack = splitTitleWords(combined);
	if (wordsMatchInOrder(haystack, needles)) return 2;
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

/**
 * ID queries (`mn10`, `36.3`) match slugs; everything else matches titles.
 * Numeral-only IDs use the same exact / range-containment / dotted-prefix /
 * digit-continuation rules against each slug's numeric tail, so `36.3` finds
 * SN 36.3 and `1.8` finds AN 1.1–10.
 */
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
	const inRange: DiscourseSuggestEntry[] = [];
	const dottedPrefix: DiscourseSuggestEntry[] = [];
	const digitPrefix: DiscourseSuggestEntry[] = [];
	for (const entry of entries) {
		const id = discourseIdKey(entry.slug, compact);
		if (!id) continue;
		if (id === compact) exact.push(entry);
		else if (isDiscourseRangeContainment(entry.slug, compact)) {
			inRange.push(entry);
		} else if (isDiscourseIdPrefix(id, compact)) dottedPrefix.push(entry);
		else if (isUndottedNumberContinuation(id, compact)) {
			digitPrefix.push(entry);
		}
	}

	exact.sort(nativeFirst);
	inRange.sort(nativeFirst);
	const prefix = (dottedPrefix.length > 0 ? dottedPrefix : digitPrefix).sort(
		nativeFirst,
	);

	return [
		...exact.map((entry) => toHit(entry, true)),
		// Range files are near-exact: the queried sutta lives in that file.
		...inRange.map((entry) => toHit(entry, true)),
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
	const exact = entries.filter(
		(entry) => discourseIdKey(entry.slug, compact) === compact,
	);
	if (exact.length === 0) return null;
	exact.sort(nativeFirst);
	// Numeral queries (36.3, 10) only auto-navigate when one collection has that number.
	if (!isPrefixedDiscourseId(compact) && exact.length > 1) return null;
	return toHit(exact[0]!, true);
}
