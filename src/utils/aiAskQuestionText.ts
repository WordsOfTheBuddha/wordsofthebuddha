/**
 * Shared Ask / Research question clipping. Keep this module free of
 * server-only imports — the browser bundle uses it.
 */

/** Soft ceiling for composer, APIs, session, and shares. */
export const MAX_QUESTION_CHARS = 8000;

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
