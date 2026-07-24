import type { SuggestionIndexEntry, SuggestionSource } from "../types/suggestions";
import { normalizeForComparison } from "./searchRanking";

const SOURCE_RANK: Record<SuggestionSource, number> = {
	pali: 0,
	tooltip: 1,
	title: 2,
	synonym: 3,
	corpus: 4,
};

/** Regex class for any vowel (Pali stem-final flexibility in highlight patterns). */
export const HIGHLIGHT_STEM_VOWEL_PATTERN =
	"[aAáÁàÀâÂäÄãÃåÅāĀăĂąĄeEéÉèÈêÊëËēĒĕĔėĖiIíÍìÌîÎïÏīĪĭĬįĮoOóÓòÒôÔöÖõÕōŌŏŎőŐuUúÚùÙûÛüÜūŪŭŬůŮ]";

/** Allow a/o (etc.) stem variants on the final vowel of a highlight regex. */
export function applyStemVowelToHighlightPattern(
	pattern: string,
	term: string,
): string {
	const norm = normalizeForComparison(term);
	if (norm.length < 5 || !/[aeiou]$/.test(norm)) return pattern;
	return pattern.replace(/(\[[^\]]*\])$/, HIGHLIGHT_STEM_VOWEL_PATTERN);
}

export function inflectionStemKey(norm: string): string {
	if (norm.length < 5) return norm;
	const last = norm.at(-1)!;
	if (last === "a" || last === "o") return norm.slice(0, -1);
	if (last === "ā") return `${norm.slice(0, -1)}a`;
	return norm;
}

function normalizedLengthToTextIndex(text: string, targetNormLen: number): number {
	if (targetNormLen <= 0) return 0;
	for (let i = 1; i <= text.length; i++) {
		if (normalizeForComparison(text.slice(0, i)).length >= targetNormLen) {
			return i;
		}
	}
	return text.length;
}

/** Length in `text` to highlight for a diacritic- and inflection-aware prefix match. */
export function computeHighlightEnd(text: string, query: string): number {
	const normText = normalizeForComparison(text);
	const normQuery = normalizeForComparison(query);
	if (!normText || !normQuery) return 0;

	let normLen = 0;
	if (normText.startsWith(normQuery)) {
		normLen = normQuery.length;
	} else if (normQuery.startsWith(normText)) {
		normLen = normText.length;
	} else if (inflectionStemKey(normText) === inflectionStemKey(normQuery)) {
		normLen = normText.length;
	} else {
		while (
			normLen < normText.length &&
			normLen < normQuery.length &&
			normText[normLen] === normQuery[normLen]
		) {
			normLen++;
		}
	}

	if (normLen < 1) return 0;
	return normalizedLengthToTextIndex(text, normLen);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function highlightSuggestionText(text: string, query: string): string {
	const end = computeHighlightEnd(text, query);
	if (end <= 0) return escapeHtml(text);
	const matched = escapeHtml(text.slice(0, end));
	const after = escapeHtml(text.slice(end));
	return `<mark class="search-suggest-mark">${matched}</mark>${after}`;
}

/** Keep the best entry per inflection stem (tooltip/curated over corpus). */
export function dedupeInflectionVariants(
	entries: SuggestionIndexEntry[],
): SuggestionIndexEntry[] {
	const byStem = new Map<string, SuggestionIndexEntry>();

	for (const entry of entries) {
		const stem = inflectionStemKey(entry.norm);
		const existing = byStem.get(stem);
		if (!existing) {
			byStem.set(stem, entry);
			continue;
		}
		if (SOURCE_RANK[entry.source] < SOURCE_RANK[existing.source]) {
			byStem.set(stem, entry);
		}
	}

	return Array.from(byStem.values()).sort((a, b) =>
		a.text.localeCompare(b.text),
	);
}

/** Norms and inflection stems already covered by higher-priority layers. */
export function buildCoveredNormSet(entries: SuggestionIndexEntry[]): Set<string> {
	const covered = new Set<string>();
	for (const entry of entries) {
		covered.add(entry.norm);
		covered.add(inflectionStemKey(entry.norm));
	}
	return covered;
}
