/**
 * Requested report length is a hint, not a contract. One write can hold a
 * thorough survey of a few thousand words; anything above this ceiling is
 * ignored as a target and gets a short reader note.
 */
export const RESEARCH_REPORT_WORD_HINT_MAX = 8_000;

export const RESEARCH_REPORT_LENGTH_NOTE =
	"This is a cited survey of the selected discourses, not a book-length treatment. The requested word count is beyond what one report can hold, so it is not used as a target.";

export const RESEARCH_REPORT_LENGTH_NOTE_MD = `> ${RESEARCH_REPORT_LENGTH_NOTE}`;

export const RESEARCH_REPORT_LENGTH_GUIDANCE =
	"They asked for a word count beyond a single-pass report. Write a thorough cited survey of the selected discourses. Do not pad. Do not chase the requested count. Do not restate a length disclaimer; the harness adds one.";

const K_WORDS_RE = /\b(\d+(?:\.\d+)?)\s*k\b(?:[-–—\s]*)words?\b/gi;
const THOUSAND_WORDS_RE =
	/\b(\d+(?:\.\d+)?)\s*thousand\b(?:[-–—\s]*)words?\b/gi;
const PLAIN_WORDS_RE =
	/\b(\d{1,3}(?:[,\s]\d{3})+|\d{3,6})\b(?:[-–—\s]*)words?\b/gi;

function takeRequestedWords(text: string): number {
	let max = 0;
	const consider = (n: number) => {
		if (!Number.isFinite(n) || n < 1) return;
		max = Math.max(max, Math.round(n));
	};
	for (const match of text.matchAll(K_WORDS_RE)) {
		consider(Number(match[1]) * 1000);
	}
	for (const match of text.matchAll(THOUSAND_WORDS_RE)) {
		consider(Number(match[1]) * 1000);
	}
	for (const match of text.matchAll(PLAIN_WORDS_RE)) {
		consider(Number((match[1] || "").replace(/[,\s]/g, "")));
	}
	return max;
}

/** Largest explicit word-count request in the given strings, or 0. */
export function requestedResearchReportWords(
	...parts: Array<string | null | undefined>
): number {
	let max = 0;
	for (const part of parts) {
		const text = (part || "").replace(/\s+/g, " ").trim();
		if (!text) continue;
		max = Math.max(max, takeRequestedWords(text));
	}
	return max;
}

export function researchReportExceedsWordHint(
	...parts: Array<string | null | undefined>
): boolean {
	return requestedResearchReportWords(...parts) > RESEARCH_REPORT_WORD_HINT_MAX;
}

export function researchReportLengthGuidance(
	...parts: Array<string | null | undefined>
): string {
	return researchReportExceedsWordHint(...parts)
		? RESEARCH_REPORT_LENGTH_GUIDANCE
		: "";
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const LENGTH_NOTE_RE = new RegExp(
	`^(?:>\\s*)?${escapeRegExp(RESEARCH_REPORT_LENGTH_NOTE)}\\s*`,
	"i",
);

export function stripResearchReportLengthNote(markdown: string): string {
	let text = markdown.replace(/\r\n/g, "\n").trim();
	if (!text) return "";
	text = text.replace(LENGTH_NOTE_RE, "").trim();
	text = text
		.replace(
			new RegExp(`\\n+(?:>\\s*)?${escapeRegExp(RESEARCH_REPORT_LENGTH_NOTE)}`, "i"),
			"",
		)
		.trim();
	return text;
}

export function withResearchReportLengthNote(markdown: string): string {
	const text = markdown.replace(/\r\n/g, "\n").trim();
	if (text.includes(RESEARCH_REPORT_LENGTH_NOTE)) return text;
	if (!text) return RESEARCH_REPORT_LENGTH_NOTE_MD;
	return `${RESEARCH_REPORT_LENGTH_NOTE_MD}\n\n${text}`;
}

/** Prepend the reader note when they asked for more than one pass can hold. */
export function finishResearchReportLength(
	markdown: string,
	sources: {
		question?: string;
		originalQuestion?: string;
		brief?: string;
	},
): string {
	const text = markdown.replace(/\r\n/g, "\n").trim();
	if (!text) return "";
	if (
		!researchReportExceedsWordHint(
			sources.question,
			sources.originalQuestion,
			sources.brief,
		)
	) {
		return text;
	}
	return withResearchReportLengthNote(text);
}
