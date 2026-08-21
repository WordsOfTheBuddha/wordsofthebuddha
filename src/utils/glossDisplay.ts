/**
 * Display-side gloss handling for |term::tooltip| and |term::tooltip::tts|.
 *
 * Listen-mode already omits four-colon vocatives whose TTS override is empty
 * or punctuation-only (`|bhikkhus,::::|`, `|, bhikkhus,::::,|`). Main rendering
 * (page, collapse, PDF/EPUB) uses the same rule. When that omit leaves the
 * next letter at the start of a paragraph or sentence (after optional
 * “ " ‘ '), apply the same first-letter capitalization as listen mode.
 */

import { capitalizeFirstLetter, endsSentence } from "./listenDisplayWords";

export type GlossDisplay =
	| { kind: "omit"; text: string }
	| { kind: "plain"; text: string }
	| { kind: "tooltip"; term: string; tooltip: string };

/** Opening quotes that may precede the first letter of a paragraph/sentence. */
const TRAILING_OPENERS = /[\s“"‘']+$/;
const PARAGRAPH_START_LEAD = /^[\s“"‘']*$/;

/** Split the `rest` of `|term::rest|` into tooltip and optional TTS override. */
export function splitGlossRest(rest: string): { tooltip: string; tts: string } {
	const ttsSep = rest.indexOf("::");
	if (ttsSep < 0) return { tooltip: rest, tts: "" };
	return {
		tooltip: rest.slice(0, ttsSep),
		tts: rest.slice(ttsSep + 2),
	};
}

export function containsLetter(text: string): boolean {
	return /\p{L}/u.test(text);
}

/**
 * True when `prefix` (text before a gloss) is still at the start of a
 * paragraph: only whitespace and opening quotes since the last newline.
 */
export function isParagraphStartPrefix(prefix: string): boolean {
	const lineStart = prefix.split(/\r\n|\n|\r/).pop() ?? prefix;
	return PARAGRAPH_START_LEAD.test(lineStart);
}

/**
 * True when the next content after `prefix` starts a paragraph or sentence —
 * the listen-mode rule for capitalizing the following word.
 */
export function isSentenceStartPrefix(prefix: string): boolean {
	if (isParagraphStartPrefix(prefix)) return true;
	const stripped = prefix.replace(TRAILING_OPENERS, "");
	if (!stripped) return true;
	return endsSentence(stripped);
}

/**
 * After omitting a paragraph/sentence-start vocative: drop leftover space and
 * capitalize the first letter, skipping opening quotes — same as listen mode.
 */
export function capitalizeAfterOmittedVocative(text: string): string {
	let s = text.replace(/^\s+/, "");
	s = s.replace(/^([“"‘']+)\s+/, "$1");
	if (s.startsWith("<") || /^[“"‘']+</.test(s)) return s;
	return capitalizeFirstLetter(s);
}

/**
 * Decide how a gloss should appear in main rendering.
 *
 * - `|visible::tooltip|` / `|visible::tooltip::tts|` → keep visible term (tooltip if present)
 * - `|visible::::spoken words|` → keep visible term (TTS override is pronunciation only)
 * - `|visible::::|` or `|visible::::,|` → omit the term; keep empty/punctuation TTS
 */
export function resolveGlossForDisplay(term: string, rest: string): GlossDisplay {
	const { tooltip, tts } = splitGlossRest(rest);
	if (!tooltip.trim() && !containsLetter(tts)) {
		return { kind: "omit", text: tts.trim() };
	}
	if (!tooltip.trim()) {
		return { kind: "plain", text: term };
	}
	return { kind: "tooltip", term, tooltip };
}

const GLOSS_RE = /\|(.+?)::(.+?)\|/g;

function applyPendingStartCap(text: string): { text: string; consumed: boolean } {
	const capped = capitalizeAfterOmittedVocative(text);
	if (containsLetter(capped)) return { text: capped, consumed: true };
	return { text: text.replace(/^\s+/, ""), consumed: false };
}

/**
 * Replace gloss markup in a text node / markdown fragment.
 * Omitted vocatives become their TTS punctuation (or empty).
 * Tooltip glosses are handed to `renderTooltip`.
 */
export function replaceGlossMarkup(
	text: string,
	renderTooltip: (term: string, tooltip: string) => string,
): string {
	let out = "";
	let lastIndex = 0;
	let capitalizeNext = false;
	let dropNextLeadingSpace = false;
	GLOSS_RE.lastIndex = 0;

	for (const match of text.matchAll(GLOSS_RE)) {
		const index = match.index ?? 0;
		let between = text.slice(lastIndex, index);
		if (capitalizeNext) {
			const next = applyPendingStartCap(between);
			between = next.text;
			if (next.consumed) capitalizeNext = false;
		} else if (dropNextLeadingSpace) {
			between = between.replace(/^ /, "");
			dropNextLeadingSpace = false;
		}
		out += between;

		const resolved = resolveGlossForDisplay(match[1], match[2]);
		if (resolved.kind === "tooltip") {
			const term = capitalizeNext
				? capitalizeFirstLetter(resolved.term)
				: resolved.term;
			if (capitalizeNext && containsLetter(term)) capitalizeNext = false;
			out += renderTooltip(term, resolved.tooltip);
		} else if (resolved.text !== "") {
			const piece = capitalizeNext
				? capitalizeAfterOmittedVocative(resolved.text)
				: resolved.text;
			if (capitalizeNext && containsLetter(piece)) capitalizeNext = false;
			out += piece;
		} else if (isSentenceStartPrefix(out)) {
			capitalizeNext = true;
		} else if (out.length > 0 && /\s/.test(out[out.length - 1])) {
			dropNextLeadingSpace = true;
		}

		lastIndex = index + match[0].length;
	}

	let tail = text.slice(lastIndex);
	if (capitalizeNext) {
		tail = applyPendingStartCap(tail).text;
	} else if (dropNextLeadingSpace) {
		tail = tail.replace(/^ /, "");
	}
	return out + tail;
}
