/**
 * Search snippet highlighting.
 *
 * Prefers one contiguous mark when query terms appear in order (including
 * stopwords like "of"), even when a gloss splits them:
 *   aggregate of |liberation::…|  →  one highlight on "aggregate of liberation"
 * Falls back to first-match-per-term when no in-order span exists.
 */
import type { HighlightTerm } from "./fuseQueryParser";
import { isStopword, stripAnnotations } from "./searchRanking";

const MIN_LENGTH_FOR_INFIX_HIGHLIGHT = 4;
const MARK_STYLE = 'style="padding-inline:0.05rem"';
const UL = "\\p{L}\\p{N}";
const NOT_UL = `[^${UL}]`;
const ANNOTATION_RE = /\|([^|]*?)::[^|]*\|/g;
const SKIP_OPS = new Set([
	"doesNotStartWith",
	"doesNotEndWith",
	"negation",
]);

const PHRASE_MARK_CLASS = "bg-yellow-100 dark:bg-yellow-900";
const EXACT_MARK_CLASS = "bg-yellow-200 dark:bg-yellow-800";
const FUZZY_MARK_CLASS = "bg-yellow-100 dark:bg-yellow-900";

export interface HighlightSnippetOptions {
	paliMode?: boolean;
	/** First-match fallback skips stopwords (titles). Snippets keep them. */
	fallbackSkipStopwords?: boolean;
}

interface TermHit {
	start: number;
	end: number;
}

interface AnnotationRange {
	origStart: number;
	origEnd: number;
}

interface VisibleMap {
	visible: string;
	origIndex: number[];
	annotations: AnnotationRange[];
}

function normalizeText(text: string): string {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createExactLiteralPattern(term: string): string {
	let pattern = "";
	for (const char of term.normalize("NFC")) {
		if (/\p{L}/u.test(char)) {
			const lower = char.toLowerCase();
			const upper = char.toUpperCase();
			if (lower === upper) {
				pattern += escapeRegExp(char);
			} else {
				pattern += `[${escapeRegExp(lower)}${escapeRegExp(upper)}]`;
			}
		} else {
			pattern += escapeRegExp(char);
		}
	}
	return pattern;
}

function vowelPattern(vowel: string): string {
	const patterns: Record<string, string> = {
		a: "[aAáÁàÀâÂäÄãÃåÅāĀăĂąĄ]",
		e: "[eEéÉèÈêÊëËēĒĕĔėĖ]",
		i: "[iIíÍìÌîÎïÏīĪĭĬįĮ]",
		o: "[oOóÓòÒôÔöÖõÕōŌŏŎőŐ]",
		u: "[uUúÚùÙûÛüÜūŪŭŬůŮ]",
	};
	return patterns[vowel.toLowerCase()] || vowel;
}

const ANY_VOWEL_PATTERN =
	"[aAáÁàÀâÂäÄãÃåÅāĀăĂąĄeEéÉèÈêÊëËēĒĕĔėĖiIíÍìÌîÎïÏīĪĭĬįĮoOóÓòÒôÔöÖõÕōŌŏŎőŐuUúÚùÙûÛüÜūŪŭŬůŮ]";

function consonantPattern(char: string): string {
	const paliVariants: Record<string, string> = {
		t: "[tTṭṬ]",
		d: "[dDḍḌ]",
		n: "[nNñÑṇṆṅṄ]",
		m: "[mMṁṀṃṂ]",
		l: "[lLḷḶ]",
		s: "[sSśŚṣṢ]",
		r: "[rRṛṚ]",
		h: "[hHḥḤ]",
	};
	const lower = char.toLowerCase();
	if (paliVariants[lower]) return paliVariants[lower];
	const upper = char.toUpperCase();
	if (lower === upper) return escapeRegExp(char);
	return `[${lower}${upper}]`;
}

export function createHighlightPattern(
	term: string,
	operation: HighlightTerm["operation"],
	paliMode = false,
): string {
	if (operation === "exact") {
		return createExactLiteralPattern(term);
	}

	const normalized = normalizeText(term);
	let diacriticPattern = "";
	for (const char of normalized) {
		if (/[aeiou]/i.test(char)) {
			diacriticPattern += vowelPattern(char);
		} else if (/[a-z]/i.test(char)) {
			diacriticPattern += consonantPattern(char);
		} else {
			diacriticPattern += escapeRegExp(char);
		}
	}

	if (paliMode && /[aeiou]$/i.test(normalized)) {
		diacriticPattern = diacriticPattern.replace(
			/(\[[^\]]*\])$/,
			ANY_VOWEL_PATTERN,
		);
	}

	switch (operation) {
		case "doesNotStartWith":
		case "doesNotEndWith":
		case "negation":
			return "";
		case "startsWith":
			return `^[^\\S\\r\\n]*${diacriticPattern}`;
		case "endsWith":
			return `${diacriticPattern}$`;
		default:
			if (term.length < MIN_LENGTH_FOR_INFIX_HIGHLIGHT) {
				return `(?<=^|${NOT_UL})${diacriticPattern}(?=${NOT_UL}|$)`;
			}
			return diacriticPattern;
	}
}

function findAllMatches(
	text: string,
	infixPattern: string,
	operation: HighlightTerm["operation"],
): TermHit[] {
	const hits: TermHit[] = [];
	if (!infixPattern || !text) return hits;

	if (operation === "exact") {
		const regex = new RegExp(
			`(?<=^|${NOT_UL})(${infixPattern})(?=${NOT_UL}|$)`,
			"gu",
		);
		for (const match of text.matchAll(regex)) {
			hits.push({
				start: match.index!,
				end: match.index! + match[1].length,
			});
		}
		return hits;
	}

	if (operation === "startsWith" || operation === "endsWith") {
		const regex = new RegExp(infixPattern, "u");
		const match = regex.exec(text);
		if (match) {
			hits.push({
				start: match.index,
				end: match.index + match[0].length,
			});
		}
		return hits;
	}

	// Short-term patterns already include Unicode boundaries
	if (infixPattern.includes("(?<=")) {
		const regex = new RegExp(infixPattern, "gu");
		for (const match of text.matchAll(regex)) {
			hits.push({
				start: match.index!,
				end: match.index! + match[0].length,
			});
		}
		return hits;
	}

	const wholeWordRegex = new RegExp(
		`(^|${NOT_UL})(?=${infixPattern})(${infixPattern}[${UL}]{0,3})(?=${NOT_UL}|$)`,
		"gu",
	);
	for (const match of text.matchAll(wholeWordRegex)) {
		const pre = match[1];
		const matched = match[2];
		const start = match.index! + pre.length;
		hits.push({ start, end: start + matched.length });
	}
	if (hits.length > 0) return hits;

	const regex = new RegExp(infixPattern, "gu");
	for (const match of text.matchAll(regex)) {
		hits.push({
			start: match.index!,
			end: match.index! + match[0].length,
		});
	}
	return hits;
}

function buildVisibleMap(text: string): VisibleMap {
	const origIndex: number[] = [];
	const annotations: AnnotationRange[] = [];
	let visible = "";
	let last = 0;
	const regex = new RegExp(ANNOTATION_RE.source, "g");
	let match: RegExpExecArray | null;
	while ((match = regex.exec(text)) !== null) {
		for (let i = last; i < match.index; i++) {
			visible += text[i];
			origIndex.push(i);
		}
		const visiblePart = match[1];
		const visibleOrigStart = match.index + 1;
		for (let i = 0; i < visiblePart.length; i++) {
			visible += visiblePart[i];
			origIndex.push(visibleOrigStart + i);
		}
		annotations.push({
			origStart: match.index,
			origEnd: match.index + match[0].length,
		});
		last = match.index + match[0].length;
	}
	for (let i = last; i < text.length; i++) {
		visible += text[i];
		origIndex.push(i);
	}
	return { visible, origIndex, annotations };
}

function toOriginalSpan(
	map: VisibleMap,
	visStart: number,
	visEnd: number,
): { start: number; end: number } | null {
	if (visStart < 0 || visEnd <= visStart || visEnd > map.origIndex.length) {
		return null;
	}
	let start = map.origIndex[visStart];
	let end = map.origIndex[visEnd - 1] + 1;
	for (const ann of map.annotations) {
		if (start < ann.origEnd && end > ann.origStart) {
			if (start > ann.origStart) start = ann.origStart;
			if (end < ann.origEnd) end = ann.origEnd;
		}
	}
	return { start, end };
}

function gapHasParagraphBreak(visible: string, start: number, end: number): boolean {
	return visible.slice(start, end).includes("\n\n");
}

function interveningHasContentWord(
	visible: string,
	aEnd: number,
	bStart: number,
): boolean {
	const gap = visible.slice(aEnd, bStart);
	const words = gap.match(/\p{L}+/gu) ?? [];
	return words.some((word) => !isStopword(word));
}

function shouldWrapAsOneSpan(
	visible: string,
	hits: TermHit[],
): boolean {
	for (let i = 1; i < hits.length; i++) {
		if (interveningHasContentWord(visible, hits[i - 1].end, hits[i].start)) {
			return false;
		}
	}
	return true;
}

function findBestInOrderHits(
	visible: string,
	perTermHits: TermHit[][],
): TermHit[] | null {
	if (perTermHits.length < 2) return null;
	if (perTermHits.some((hits) => hits.length === 0)) return null;

	let best: TermHit[] | null = null;
	let bestSpan = Infinity;

	for (const first of perTermHits[0]) {
		const chosen: TermHit[] = [first];
		let cursor = first.end;
		let valid = true;
		for (let i = 1; i < perTermHits.length; i++) {
			const next = perTermHits[i].find((hit) => hit.start >= cursor);
			if (!next) {
				valid = false;
				break;
			}
			if (gapHasParagraphBreak(visible, chosen[chosen.length - 1].end, next.start)) {
				valid = false;
				break;
			}
			chosen.push(next);
			cursor = next.end;
		}
		if (!valid) continue;
		const span = chosen[chosen.length - 1].end - chosen[0].start;
		if (span < bestSpan) {
			bestSpan = span;
			best = chosen;
		}
	}

	return best;
}

function markOpen(markClass: string, termCount: number): string {
	return `<mark class="${markClass} rounded box-decoration-clone" ${MARK_STYLE} data-hl-count="${termCount}">`;
}

interface OrigMark {
	start: number;
	end: number;
	markClass: string;
	termCount: number;
}

function applyMarks(text: string, marks: OrigMark[]): string {
	if (marks.length === 0) return text;
	const sorted = [...marks].sort((a, b) => b.start - a.start);
	let result = text;
	for (const mark of sorted) {
		if (mark.start < 0 || mark.end > result.length || mark.start >= mark.end) {
			continue;
		}
		result =
			result.slice(0, mark.start) +
			markOpen(mark.markClass, mark.termCount) +
			result.slice(mark.start, mark.end) +
			"</mark>" +
			result.slice(mark.end);
	}
	return result;
}

function countFromAttrs(attrs: string): number {
	const match = attrs.match(/data-hl-count="(\d+)"/);
	return match ? Number(match[1]) : 1;
}

/** Join neighboring marks so "aggregate" + "of" read as one highlight. */
export function mergeAdjacentMarks(html: string): string {
	const re =
		/<mark(\s[^>]*)>([\s\S]*?)<\/mark>(\s*)<mark(\s[^>]*)>([\s\S]*?)<\/mark>/;
	let current = html;
	let prev = "";
	while (current !== prev) {
		prev = current;
		current = current.replace(re, (_whole, a, t1, ws, b, t2) => {
			const count = countFromAttrs(a) + countFromAttrs(b);
			const cleaned = String(a).replace(/\sdata-hl-count="\d+"/, "");
			return `<mark${cleaned} data-hl-count="${count}">${t1}${ws}${t2}</mark>`;
		});
	}
	return current;
}

function activeHighlightTerms(highlightTerms: HighlightTerm[]): HighlightTerm[] {
	return highlightTerms.filter(
		(ht) =>
			ht.term &&
			(!ht.field || ht.field === "content" || ht.field === "contentPali") &&
			!SKIP_OPS.has(ht.operation),
	);
}

function phraseCandidateTerms(terms: HighlightTerm[]): HighlightTerm[] {
	return terms.filter(
		(ht) => ht.operation === "exact" || ht.operation === "fuzzy",
	);
}

function hitsForTerm(
	visible: string,
	ht: HighlightTerm,
	paliMode: boolean,
): TermHit[] {
	const pattern = createHighlightPattern(ht.term, ht.operation, paliMode);
	return findAllMatches(visible, pattern, ht.operation);
}

/**
 * Highlight query terms in snippet/title text.
 * In-order matches (quoted or not) win over first-occurrence-per-term.
 */
export function highlightSnippetText(
	text: string,
	highlightTerms: HighlightTerm[],
	options: HighlightSnippetOptions | boolean = {},
): string {
	const opts: HighlightSnippetOptions =
		typeof options === "boolean" ? { paliMode: options } : options;
	const paliMode = opts.paliMode ?? false;
	const fallbackSkipStopwords = opts.fallbackSkipStopwords ?? false;

	const terms = activeHighlightTerms(highlightTerms);
	if (!text) return text;
	if (terms.length === 0) return stripAnnotations(text);

	const map = buildVisibleMap(text);
	const phraseTerms = phraseCandidateTerms(terms);
	const allHits = phraseTerms.map((ht) => hitsForTerm(map.visible, ht, paliMode));

	const nonStopwordIdx = phraseTerms
		.map((ht, i) => (isStopword(ht.term) ? -1 : i))
		.filter((i) => i >= 0);

	let inOrderHits: TermHit[] | null = null;
	let inOrderTermCount = 0;

	if (phraseTerms.length >= 2) {
		inOrderHits = findBestInOrderHits(map.visible, allHits);
		inOrderTermCount = phraseTerms.length;
	}
	if (!inOrderHits && nonStopwordIdx.length >= 2) {
		inOrderHits = findBestInOrderHits(
			map.visible,
			nonStopwordIdx.map((i) => allHits[i]),
		);
		inOrderTermCount = nonStopwordIdx.length;
	}

	if (inOrderHits && inOrderHits.length >= 2) {
		if (shouldWrapAsOneSpan(map.visible, inOrderHits)) {
			const orig = toOriginalSpan(
				map,
				inOrderHits[0].start,
				inOrderHits[inOrderHits.length - 1].end,
			);
			if (orig) {
				return stripAnnotations(
					applyMarks(text, [
						{
							start: orig.start,
							end: orig.end,
							markClass: PHRASE_MARK_CLASS,
							termCount: inOrderTermCount,
						},
					]),
				);
			}
		}

		const marks: OrigMark[] = [];
		for (const hit of inOrderHits) {
			const orig = toOriginalSpan(map, hit.start, hit.end);
			if (!orig) continue;
			marks.push({
				start: orig.start,
				end: orig.end,
				markClass: PHRASE_MARK_CLASS,
				termCount: 1,
			});
		}
		return stripAnnotations(mergeAdjacentMarks(applyMarks(text, marks)));
	}

	const marks: OrigMark[] = [];
	const usedVisible: Array<{ start: number; end: number }> = [];
	for (const ht of terms) {
		if (fallbackSkipStopwords && isStopword(ht.term)) continue;
		const hits = hitsForTerm(map.visible, ht, paliMode);
		const hit = hits.find((candidate) =>
			usedVisible.every(
				(used) => candidate.end <= used.start || candidate.start >= used.end,
			),
		);
		if (!hit) continue;
		const orig = toOriginalSpan(map, hit.start, hit.end);
		if (!orig) continue;
		usedVisible.push(hit);
		marks.push({
			start: orig.start,
			end: orig.end,
			markClass: ht.operation === "exact" ? EXACT_MARK_CLASS : FUZZY_MARK_CLASS,
			termCount: 1,
		});
	}
	return stripAnnotations(mergeAdjacentMarks(applyMarks(text, marks)));
}

/** Sum of highlighted terms; phrase marks use data-hl-count. */
export function countSnippetHighlightTerms(
	snippet: string | null | undefined,
): number {
	if (!snippet) return 0;
	let total = 0;
	const re = /<mark\b([^>]*)>/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(snippet)) !== null) {
		total += countFromAttrs(match[1]);
	}
	return total;
}

function lastIndexBefore(html: string, char: string, index: number): number {
	return html.lastIndexOf(char, Math.max(0, index - 1));
}

/** Move a clip point so we do not split a tag or |gloss::tooltip|. */
function snapClipIndex(
	html: string,
	index: number,
	side: "start" | "end",
): number {
	if (index <= 0) return 0;
	if (index >= html.length) return html.length;

	const lastLt = lastIndexBefore(html, "<", index);
	const lastGt = lastIndexBefore(html, ">", index);
	if (lastLt > lastGt) {
		return side === "start"
			? lastLt
			: Math.min(html.length, html.indexOf(">", index) + 1 || html.length);
	}

	const lastPipe = lastIndexBefore(html, "|", index);
	if (lastPipe >= 0) {
		const nextPipe = html.indexOf("|", lastPipe + 1);
		if (
			nextPipe >= index &&
			html.slice(lastPipe, nextPipe + 1).includes("::")
		) {
			return side === "start" ? lastPipe : nextPipe + 1;
		}
	}

	return index;
}

export const DEFAULT_SNIPPET_CLIP = 440;

/**
 * Keep the highlighted span in view. Long paragraphs otherwise hide an
 * in-order phrase that appears late (e.g. "aggregate of liberation").
 */
export function clipSnippetAroundHighlight(
	html: string,
	maxLength = DEFAULT_SNIPPET_CLIP,
): string {
	if (!html || html.length <= maxLength) return html;

	const markOpen = html.indexOf("<mark");
	if (markOpen < 0) {
		return `${html.slice(0, maxLength).trimEnd()}...`;
	}
	const closeAt = html.indexOf("</mark>", markOpen);
	const markEnd =
		closeAt >= 0 ? closeAt + "</mark>".length : html.length;
	const markLen = markEnd - markOpen;
	const extra = Math.max(80, maxLength - markLen);
	const before = Math.min(markOpen, Math.floor(extra * 0.35));
	let start = markOpen - before;
	let end = Math.min(html.length, Math.max(markEnd + 40, start + maxLength));
	if (end < markEnd) end = markEnd;

	start = snapClipIndex(html, start, "start");
	end = snapClipIndex(html, end, "end");
	if (start > markOpen) start = snapClipIndex(html, markOpen, "start");
	if (end < markEnd) end = markEnd;

	const prefix = start > 0 ? "..." : "";
	const suffix = end < html.length ? "..." : "";
	return `${prefix}${html.slice(start, end).trim()}${suffix}`;
}
