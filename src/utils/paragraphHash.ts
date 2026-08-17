/**
 * Discourse URL hashes are used two ways:
 *   `#1`, `#4-6`, `#1,2,4-6`  — highlight those paragraph numbers
 *   `#1-3-perception-and-the-self` — jump to a named section heading
 *
 * Section slugs from markdown headings often start with the same numerals
 * (e.g. “1.3. Perception…” → `1-3-perception-and-the-self`). A paragraph
 * range is only the whole token `start-end` of digits, never a longer slug.
 */

export interface ParagraphHashTarget {
	paragraphs: number[];
	scrollTo: number | null;
}

const RANGE_RE = /^(\d+)-(\d+)$/;
const SINGLE_RE = /^\d+$/;

export function parseHashRange(hash: string): ParagraphHashTarget {
	if (!hash) return { paragraphs: [], scrollTo: null };

	let hashValue = hash.startsWith("#") ? hash.slice(1) : hash;
	hashValue = hashValue.split(/[?&]/)[0];
	try {
		hashValue = decodeURIComponent(hashValue);
	} catch {
		/* keep raw value */
	}

	const paragraphNumbers: number[] = [];
	let scrollTo: number | null = null;

	const parts = hashValue
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);

	for (const part of parts) {
		const rangeMatch = part.match(RANGE_RE);
		if (rangeMatch) {
			const startNum = Number(rangeMatch[1]);
			const endNum = Number(rangeMatch[2]);
			if (startNum <= endNum) {
				for (let i = startNum; i <= endNum; i++) {
					paragraphNumbers.push(i);
				}
				if (scrollTo === null) scrollTo = startNum;
			}
			continue;
		}

		if (SINGLE_RE.test(part)) {
			const paragraphNum = Number(part);
			paragraphNumbers.push(paragraphNum);
			if (scrollTo === null) scrollTo = paragraphNum;
		}
	}

	const uniqueParagraphs = [...new Set(paragraphNumbers)].sort((a, b) => a - b);

	return {
		paragraphs: uniqueParagraphs,
		scrollTo: uniqueParagraphs.length > 0 ? scrollTo : null,
	};
}
