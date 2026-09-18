/**
 * Shared Ask / Research question clipping. Keep this module free of
 * server-only imports — the browser bundle uses it.
 */

/** Soft ceiling for guests, Research questions, and shares. */
export const MAX_QUESTION_CHARS = 8000;

/** Signed-in Ask composer and /api/ai/ask. */
export const MAX_ASK_QUESTION_CHARS_SIGNED_IN = 32_000;

/** Pasted notes on Ask — kept inside the signed-in question budget. */
export const MAX_ASK_CONTEXT_CHARS = 28_000;

export function maxAskQuestionChars(signedIn: boolean): number {
	return signedIn ? MAX_ASK_QUESTION_CHARS_SIGNED_IN : MAX_QUESTION_CHARS;
}

/** Matches `.ai-box textarea` max-height: 18rem at a 16px root. */
export const ASK_COMPOSER_TEXTAREA_MAX_PX = 288;

/** Collapse horizontal whitespace and runaway blank lines; keep paragraphs. */
export function normalizeAskQuestionText(value: string): string {
	return value
		.replace(/\r\n/g, "\n")
		.replace(/[^\S\n]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function clipAiQuestion(
	question: string,
	max = MAX_QUESTION_CHARS,
): string {
	return normalizeAskQuestionText(question).slice(0, max);
}
