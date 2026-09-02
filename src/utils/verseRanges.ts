/**
 * Light verse-range helpers for discourse chrome and PED slug mapping.
 * Not in-text verse numbering — just the sutta’s span (e.g. vv. 143–152).
 */

import { SNP_VERSE_RANGES } from "../data/snpVerseRanges.generated";

export type VerseRange = { start: number; end: number };

/** Hosted Snp sutta → continuous SC/PTS-style verse span. */
export function getSnpVerseRange(slug: string): VerseRange | null {
	const hit = SNP_VERSE_RANGES.find((r) => r.slug === slug);
	return hit ? { start: hit.start, end: hit.end } : null;
}

/** Dhp range slugs like dhp100-115 → { start: 100, end: 115 }. */
export function getDhpVerseRangeFromSlug(slug: string): VerseRange | null {
	const m = slug.match(/^dhp(\d+)(?:-(\d+))?$/i);
	if (!m) return null;
	const start = Number(m[1]);
	const end = m[2] ? Number(m[2]) : start;
	if (!start || !end || end < start) return null;
	return { start, end };
}

export function getVerseRangeForSlug(slug: string): VerseRange | null {
	if (slug.startsWith("snp")) return getSnpVerseRange(slug);
	if (slug.startsWith("dhp")) return getDhpVerseRangeFromSlug(slug);
	return null;
}

/** Compact label: "vv. 143–152" or "v. 145". */
export function formatVerseRangeLabel(range: VerseRange): string {
	if (range.start === range.end) return `v. ${range.start}`;
	return `vv. ${range.start}–${range.end}`;
}
