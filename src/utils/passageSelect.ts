import type { ContentPair } from "./contentParser";

function isHeading(pair: ContentPair): boolean {
	return pair.english.trimStart().startsWith("#");
}

/**
 * Paragraphs `start`–`end`, plus the headings that introduce them.
 * A heading is kept when no numbered paragraph sits between it and the
 * next included paragraph, so the first verse title (for example "#### 146")
 * is included with the first paragraph of the range. Omit both bounds for
 * the whole discourse.
 */
export function selectPassage(
	pairs: ContentPair[],
	start?: number,
	end?: number,
): ContentPair[] {
	const usable = pairs.filter(
		(pair) =>
			pair.english.trim() &&
			!pair.english.includes("Translation in progress"),
	);

	if (start == null) return usable;

	const last = end ?? start;
	const selected: ContentPair[] = [];
	let leading: ContentPair[] = [];

	for (const pair of usable) {
		const number = pair.actualParagraphNumber;
		if (isHeading(pair) || number == null) {
			leading.push(pair);
			continue;
		}
		if (number < start) {
			leading = [];
			continue;
		}
		if (number > last) break;
		selected.push(...leading.filter(isHeading));
		leading = [];
		selected.push(pair);
	}

	return selected;
}
