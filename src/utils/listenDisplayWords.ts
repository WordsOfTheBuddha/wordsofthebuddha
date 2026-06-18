/**
 * Listen-mode display capitalization for manifest word tokens.
 * Pure helpers used by `listenModeClient.renderWordSpans` and unit tests.
 */

export type ListenWordToken = { w: string };

const hasLetter = (s: string): boolean => /\p{L}/u.test(s);

const isPeriodOnlyToken = (s: string): boolean => /^\.+$/.test(s.trim());

/** Sentence end for display caps — excludes ellipses used as pauses between phrases. */
export function endsSentence(s: string): boolean {
	const t = s.trim();
	if (!t) return false;
	if (isPeriodOnlyToken(t) && t.length >= 2) return false;
	if (/\.{2,}["'”’)\]]*$/.test(t)) return false;
	if (/[\u2026]["'”’)\]]*$/.test(t)) return false;
	return /[.!?]["'”’)\]]*$/.test(t);
}

export function capitalizeFirstLetter(s: string): string {
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		const upper = ch.toLocaleUpperCase();
		const lower = ch.toLocaleLowerCase();
		if (upper !== lower) {
			if (ch === lower && ch !== upper) {
				return s.slice(0, i) + upper + s.slice(i + 1);
			}
			return s;
		}
	}
	return s;
}

/** Lone token that is only opening punctuation (e.g. "(" or "["). */
export function isOpeningPunctOnly(s: string): boolean {
	return /^[([{“‘]+$/.test(s.trim());
}

/** Lone open bracket token — defers sentence-start capitalization (not quotes). */
export function isOpenBracketOnly(s: string): boolean {
	return /^[([{]+$/.test(s.trim());
}

/** Word token whose first letter is preceded by an open bracket. */
export function hasLeadingOpenBracket(s: string): boolean {
	return /^[([{]+/.test(s.trimStart());
}

/** Whether sentence/paragraph-start capitalization should apply to this token. */
export function shouldApplySentenceCap(word: string, prevWord: string): boolean {
	if (isOpenBracketOnly(prevWord)) return false;
	if (hasLeadingOpenBracket(word)) return false;
	return true;
}

/**
 * Map manifest tokens to listen-mode display strings, applying paragraph- and
 * sentence-start capitalization while preserving source casing inside brackets.
 */
export function listenDisplayWords(words: ListenWordToken[]): string[] {
	const out: string[] = [];
	let shouldCapitalizeNext = true;

	for (let i = 0; i < words.length; i++) {
		const raw = words[i].w;
		let displayWord = raw;
		const prevWord = words[i - 1]?.w ?? "";

		if (shouldCapitalizeNext) {
			displayWord = displayWord.trimStart();
			if (shouldApplySentenceCap(displayWord, prevWord)) {
				displayWord = capitalizeFirstLetter(displayWord);
			}
		}

		out.push(displayWord);

		const trimmedDisplay = displayWord.trim();
		if (isPeriodOnlyToken(trimmedDisplay) && trimmedDisplay.length === 1) {
			let runStart = i;
			while (runStart > 0 && isPeriodOnlyToken(words[runStart - 1]?.w ?? "")) {
				runStart--;
			}
			let runEnd = i;
			while (
				runEnd + 1 < words.length &&
				isPeriodOnlyToken(words[runEnd + 1]?.w ?? "")
			) {
				runEnd++;
			}
			if (runEnd - runStart + 1 === 1) {
				shouldCapitalizeNext = true;
			}
		} else if (endsSentence(displayWord)) {
			shouldCapitalizeNext = true;
		} else if (hasLetter(displayWord)) {
			shouldCapitalizeNext = false;
		}
	}

	return out;
}
