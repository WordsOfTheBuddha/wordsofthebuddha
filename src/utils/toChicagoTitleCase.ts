/**
 * Converts a string to Chicago-style title case.
 * - Capitalizes the first and last words.
 * - Capitalizes all major words (nouns, pronouns, verbs, adjectives, adverbs, and subordinating conjunctions).
 * - Lowercases articles, coordinating conjunctions, and prepositions (unless first or last word).
 * @param input The string to convert.
 * @returns The string in Chicago-style title case.
 */
export function toChicagoTitleCase(input: string): string {
	const smallWords = new Set([
		"a",
		"an",
		"the",
		"and",
		"but",
		"or",
		"nor",
		"for",
		"so",
		"yet",
		"as",
		"at",
		"by",
		"for",
		"in",
		"of",
		"on",
		"per",
		"to",
		"up",
		"via",
		"with",
		"from",
	]);

	const words = input.split(/\s+/);
	return words
		.map((word, i) => {
			const lower = word.toLowerCase();
			const isFirst = i === 0;
			const isLast = i === words.length - 1;
			if (isFirst || isLast || !smallWords.has(lower)) {
				// Capitalize first letter, preserve rest
				return word.charAt(0).toUpperCase() + word.slice(1);
			}
			return lower;
		})
		.join(" ");
}
