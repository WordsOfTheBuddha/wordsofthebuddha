/**
 * Search Ranking Utilities
 *
 * Centralized logic for:
 * - Query preprocessing (length-based rules)
 * - Match type detection (exact, prefix, infix, fuzzy)
 * - Edit distance calculation (Levenshtein)
 * - Stopword handling for multi-term queries
 * - Strata-based diversity ranking
 * - Pagination helpers
 */

// ==================== STOPWORDS ====================

/** Common English stopwords that should have lower weight in search */
export const STOPWORDS = new Set([
	// Articles
	"a",
	"an",
	"the",
	// Prepositions
	"in",
	"on",
	"at",
	"to",
	"for",
	"of",
	"with",
	"by",
	"from",
	"up",
	"about",
	"into",
	"through",
	"during",
	"before",
	"after",
	"above",
	"below",
	"between",
	"under",
	"again",
	"further",
	"then",
	"once",
	// Conjunctions
	"and",
	"but",
	"or",
	"nor",
	"so",
	"yet",
	"both",
	"either",
	"neither",
	// Pronouns
	"i",
	"me",
	"my",
	"myself",
	"we",
	"our",
	"ours",
	"ourselves",
	"you",
	"your",
	"yours",
	"yourself",
	"yourselves",
	"he",
	"him",
	"his",
	"himself",
	"she",
	"her",
	"hers",
	"herself",
	"it",
	"its",
	"itself",
	"they",
	"them",
	"their",
	"theirs",
	"themselves",
	"what",
	"which",
	"who",
	"whom",
	"this",
	"that",
	"these",
	"those",
	// Verbs (common)
	"is",
	"are",
	"was",
	"were",
	"be",
	"been",
	"being",
	"have",
	"has",
	"had",
	"having",
	"do",
	"does",
	"did",
	"doing",
	"will",
	"would",
	"could",
	"should",
	"might",
	"must",
	"shall",
	"can",
	"may",
	// Adverbs
	"here",
	"there",
	"when",
	"where",
	"why",
	"how",
	"all",
	"each",
	"every",
	"any",
	"some",
	"no",
	"not",
	"only",
	"own",
	"same",
	"than",
	"too",
	"very",
	"just",
	"also",
	"now",
	// Other common words
	"as",
	"if",
	"because",
	"until",
	"while",
	"such",
	"more",
	"most",
	"other",
	"over",
	"out",
]);

/**
 * Check if a word is a stopword
 */
export function isStopword(word: string): boolean {
	return STOPWORDS.has(word.toLowerCase());
}

/**
 * Strip annotation/gloss syntax from text: |visible::tooltip| → visible
 * Keeps the visible part so glosses in content can still match
 */
export function stripAnnotations(text: string): string {
	return (text || "").replace(/\|(.+?)::[^|]+\|/g, "$1");
}

/**
 * Normalize a slug for matching purposes.
 * Handles both raw slugs (mn38) and formatted queries (mn 38, MN 38, MN38).
 * Returns lowercase slug without spaces.
 */
export function normalizeSlugForMatching(input: string): string {
	return input.toLowerCase().replace(/\s+/g, "");
}

/**
 * Check if a slug matches a query (handles both raw and formatted forms).
 * e.g., "mn38" matches "mn 38", "MN 38", "mn38", "MN38"
 */
export function slugMatchesQuery(
	slug: string,
	query: string,
): "exact" | "prefix" | "none" {
	const normalizedSlug = normalizeSlugForMatching(slug);
	const normalizedQuery = normalizeSlugForMatching(query);

	if (normalizedSlug === normalizedQuery) {
		return "exact";
	}
	if (normalizedSlug.startsWith(normalizedQuery)) {
		return "prefix";
	}
	return "none";
}

/**
 * Normalize diacritics in text for matching (e.g., jhāna → jhana, sīla → sila)
 * Uses Unicode NFD normalization then removes combining marks
 */
export function normalizeDiacritics(text: string): string {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Get the singular stem of a word (simple English plural handling).
 * Returns the base form to enable singular/plural matching.
 * E.g., "truths" → "truth", "qualities" → "quality", "beings" → "being"
 */
export function getSingularStem(word: string): string {
	const lower = word.toLowerCase();

	// Handle common irregular plurals
	const irregulars: Record<string, string> = {
		people: "person",
		men: "man",
		women: "woman",
		children: "child",
		feet: "foot",
		teeth: "tooth",
		mice: "mouse",
		geese: "goose",
	};
	if (irregulars[lower]) return irregulars[lower];

	// -ies → -y (e.g., qualities → quality, but not "series")
	if (lower.endsWith("ies") && lower.length > 4) {
		return lower.slice(0, -3) + "y";
	}

	// -es after s, x, z, ch, sh → remove -es (e.g., boxes → box, wishes → wish)
	if (lower.endsWith("es") && lower.length > 3) {
		const stem = lower.slice(0, -2);
		if (/[sxz]$/.test(stem) || /[sc]h$/.test(stem)) {
			return stem;
		}
	}

	// -s → remove (e.g., truths → truth, beings → being)
	// But not words ending in -ss (e.g., "stress")
	if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 2) {
		return lower.slice(0, -1);
	}

	return lower;
}

/**
 * Get both singular and plural forms for a word.
 * Returns array with original and alternate form.
 */
export function getSingularPluralForms(word: string): string[] {
	const lower = word.toLowerCase();
	const stem = getSingularStem(lower);

	// If stemming changed the word, return both forms
	if (stem !== lower) {
		return [lower, stem];
	}

	// Word is likely already singular, generate plural
	// -y → -ies (quality → qualities)
	if (lower.endsWith("y") && lower.length > 2 && !/[aeiou]y$/.test(lower)) {
		return [lower, lower.slice(0, -1) + "ies"];
	}

	// -s, -x, -z, -ch, -sh → add -es
	if (/[sxz]$/.test(lower) || /[sc]h$/.test(lower)) {
		return [lower, lower + "es"];
	}

	// Default: add -s
	return [lower, lower + "s"];
}

/**
 * Prepare text for term matching: strip annotations, lowercase, normalize diacritics
 */
export function prepareTextForMatching(text: string): string {
	return normalizeDiacritics(stripAnnotations(text).toLowerCase());
}

/**
 * Match quality for a term in text
 */
export type TermMatchQuality = "exact" | "prefix" | "infix" | "none";

/**
 * Check if a term has a TRUE exact word match in text.
 * Excludes hyphen-prefixed matches like "non-attention" for term "attention".
 * These are semantically different (often opposites).
 */
function hasExactWordMatch(text: string, term: string): boolean {
	const normalizedText = prepareTextForMatching(text);
	const normalizedTerm = normalizeDiacritics(term.toLowerCase());

	// Use regex that requires either start-of-string or whitespace before the word
	// This excludes hyphen-prefixed words like "non-attention"
	const exactRegex = new RegExp(
		`(?:^|\\s)${normalizedTerm}(?:\\s|$|[.,;:!?)])/`,
		"i",
	);
	if (exactRegex.test(normalizedText)) {
		return true;
	}

	// Also check for standard word boundary but exclude hyphen-prefixed
	// Match word boundary but ensure it's not preceded by a hyphen
	const matches = normalizedText.match(
		new RegExp(`(^|.)\\b${normalizedTerm}\\b`, "gi"),
	);
	if (matches) {
		for (const match of matches) {
			// If the character before is not a hyphen, it's a valid exact match
			const charBefore = match.charAt(0);
			if (charBefore !== "-" && match.length > normalizedTerm.length) {
				return true;
			}
			// If the match is exactly the term (start of string), it's valid
			if (match.toLowerCase() === normalizedTerm) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if a term has a prefix match (term at start of a word).
 * Excludes hyphen-prefixed matches.
 */
function hasPrefixMatch(text: string, term: string): boolean {
	const normalizedText = prepareTextForMatching(text);
	const normalizedTerm = normalizeDiacritics(term.toLowerCase());

	// Match word boundary at start, but exclude hyphen-prefixed
	const matches = normalizedText.match(
		new RegExp(`(^|.)\\b${normalizedTerm}`, "gi"),
	);
	if (matches) {
		for (const match of matches) {
			const charBefore = match.charAt(0);
			if (charBefore !== "-" && match.length > normalizedTerm.length) {
				return true;
			}
			if (
				match.toLowerCase().startsWith(normalizedTerm) &&
				match.length === normalizedTerm.length + 1
			) {
				// Check if charBefore is whitespace or start
				if (/\s/.test(charBefore)) return true;
			}
			if (match.toLowerCase() === normalizedTerm) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Get the best match quality for a term in text.
 * - exact: term appears as a complete word (e.g., "attention" matches "attention")
 * - prefix: term appears at word start (e.g., "attend" matches "attention")
 * - infix: term appears within a word or hyphenated (e.g., "attention" in "non-attention")
 * - none: term not found
 */
export function getTermMatchQuality(
	text: string,
	term: string,
): TermMatchQuality {
	const normalizedText = prepareTextForMatching(text);
	const normalizedTerm = normalizeDiacritics(term.toLowerCase());

	// Check for TRUE exact word match (excludes hyphen-prefixed)
	if (hasExactWordMatch(text, term)) {
		return "exact";
	}

	// Check for prefix match (excludes hyphen-prefixed)
	if (hasPrefixMatch(text, term)) {
		return "prefix";
	}

	// Check for infix match (term appears anywhere, including hyphenated)
	if (normalizedText.includes(normalizedTerm)) {
		return "infix";
	}

	return "none";
}

/**
 * Count term matches with quality scoring.
 * Returns { count, score } where score weights exact > prefix > infix matches.
 * - exact match: 1.0 points
 * - prefix match: 0.8 points
 * - infix match: 0.3 points (poor quality, like "attention" in "non-attention")
 */
export function countTermMatchesWithQuality(
	text: string,
	terms: string[],
): { count: number; score: number; qualities: TermMatchQuality[] } {
	if (terms.length === 0) return { count: 0, score: 0, qualities: [] };

	const qualities: TermMatchQuality[] = [];
	let count = 0;
	let score = 0;

	for (const term of terms) {
		const quality = getTermMatchQuality(text, term);
		qualities.push(quality);

		if (quality !== "none") {
			count++;
			switch (quality) {
				case "exact":
					score += 1.0;
					break;
				case "prefix":
					score += 0.8;
					break;
				case "infix":
					score += 0.3;
					break;
			}
		}
	}

	return { count, score, qualities };
}

/**
 * Count how many terms from a list match in the given text.
 * Uses word boundary matching (exact word match) with diacritic normalization.
 * For quality-aware matching, use countTermMatchesWithQuality instead.
 */
export function countTermMatches(text: string, terms: string[]): number {
	if (terms.length === 0) return 0;
	const normalizedText = prepareTextForMatching(text);

	return terms.filter((term) => {
		const normalizedTerm = normalizeDiacritics(term.toLowerCase());
		// Exact word boundary match (not just prefix)
		const wordRegex = new RegExp(`\\b${normalizedTerm}\\b`, "i");
		return wordRegex.test(normalizedText);
	}).length;
}

/**
 * Calculate title coverage ratio - what percentage of the title is covered by the query.
 * Used as a tie-breaker: "Suffering" (1 word, 100%) ranks above "Destined for Suffering" (3 words, 33%)
 * Returns a value between 0 and 1.
 */
export function getTitleCoverageRatio(title: string, query: string): number {
	if (!title || !query) return 0;

	const normalizedTitle = normalizeDiacritics(title.toLowerCase());
	const normalizedQuery = normalizeDiacritics(query.toLowerCase());

	// Split title into significant words (skip common words like "sutta", "discourse", "-")
	const titleWords = normalizedTitle
		.split(/[\s\-–—]+/)
		.filter(
			(w) =>
				w.length >= 2 &&
				![
					"the",
					"a",
					"an",
					"of",
					"to",
					"in",
					"on",
					"at",
					"for",
					"sutta",
					"discourse",
				].includes(w),
		);

	if (titleWords.length === 0) return 0;

	// Count how many title words are matched by the query
	const queryTerms = normalizedQuery
		.split(/\s+/)
		.filter((t) => t.length >= 2);
	const matchedWords = titleWords.filter((word) =>
		queryTerms.some((term) => word === term || word.startsWith(term)),
	).length;

	return matchedWords / titleWords.length;
}

/**
 * Strip Fuse.js search operators from a term
 * Operators: ' (exact), ^ (starts with), ! (negation), $ (ends with), " (phrase quotes)
 */
export function stripSearchOperators(term: string): string {
	// Remove leading operators: ', ^, !, !^, "
	let cleaned = term.replace(/^['^!"]+/, "");
	// Remove trailing operators: $, "
	cleaned = cleaned.replace(/[\$"]+$/, "");
	return cleaned;
}

/**
 * Split query into terms and classify them
 */
export function tokenizeQuery(
	query: string,
): { term: string; isStopword: boolean }[] {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 0);
	return terms
		.map((term) => {
			// Strip search operators to get the actual term
			const cleanTerm = stripSearchOperators(term);
			return {
				term: cleanTerm,
				isStopword: isStopword(cleanTerm),
			};
		})
		.filter((t) => t.term.length > 0); // Filter out empty terms after stripping
}

/**
 * Get non-stopword terms from a query
 */
export function getNonStopwordTerms(query: string): string[] {
	return tokenizeQuery(query)
		.filter((t) => !t.isStopword)
		.map((t) => t.term);
}

/**
 * Count how many non-stopword terms match in text
 */
export function countNonStopwordMatches(text: string, query: string): number {
	const nonStopwords = getNonStopwordTerms(query);
	if (nonStopwords.length === 0) return 0;

	const textLower = text.toLowerCase();
	return nonStopwords.filter((term) => textLower.includes(term)).length;
}

// ==================== PHRASE PROXIMITY MATCHING ====================

/**
 * Configuration for phrase proximity matching
 */
export const PHRASE_PROXIMITY_CONFIG = {
	// Maximum word distance between terms to consider a phrase match
	MAX_WORD_DISTANCE: 5,
	// Boost for exact adjacent phrase match (terms next to each other)
	ADJACENT_BOOST: 18,
	// Boost for near phrase match (terms within MAX_WORD_DISTANCE)
	NEAR_BOOST: 12,
	// Additional boost for phrase in title vs content
	TITLE_MULTIPLIER: 1.5,
	// Additional boost for phrase in description
	DESCRIPTION_MULTIPLIER: 1.3,
	// Penalty for scattered matches (high occurrences but no phrase proximity)
	// Applied when query has 2+ non-stopword terms but they don't appear near each other
	// This is significant - items with phrase proximity should win over scattered matches
	SCATTERED_PENALTY: 15,
};

/**
 * Find all positions of a term in tokenized text
 * Returns array of word indices where the term appears
 */
function findTermPositions(words: string[], term: string): number[] {
	const termLower = term.toLowerCase();
	const positions: number[] = [];

	for (let i = 0; i < words.length; i++) {
		// Check for exact word match or word starting with term (for stemming)
		if (words[i] === termLower || words[i].startsWith(termLower)) {
			positions.push(i);
		}
	}

	return positions;
}

/**
 * Find the best phrase match location in text and return character positions
 * for each term that forms the phrase.
 *
 * This is used for highlighting - when terms appear close together as a phrase,
 * we want to highlight that specific occurrence rather than the first occurrence
 * of each term.
 *
 * NOTE: This function works on VISIBLE text (annotations stripped) to find
 * phrase matches. The returned positions are in the stripped text coordinate space.
 *
 * @param text The text to search in (may contain |visible::tooltip| annotations)
 * @param terms Non-stopword query terms
 * @returns Array of {term, startPos, endPos} for the best phrase match, or null if no phrase match
 */
export function findPhraseMatchPositions(
	text: string,
	terms: string[],
): Array<{ term: string; startPos: number; endPos: number }> | null {
	if (terms.length < 2 || !text) {
		return null;
	}

	// Strip annotations to get visible text only
	// This ensures we find phrases in what the user actually sees
	const visibleText = stripAnnotations(text);
	const textLower = visibleText.toLowerCase();

	// First check if we have a phrase proximity match (this also uses stripped text internally)
	const proximity = calculatePhraseProximity(text, terms);
	if (!proximity.isAdjacent && !proximity.isNear) {
		return null;
	}

	// Find all occurrences of each term with their character positions in visible text
	const termOccurrences: Map<
		string,
		Array<{ start: number; end: number }>
	> = new Map();

	for (const term of terms) {
		const termLower2 = term.toLowerCase();
		const occurrences: Array<{ start: number; end: number }> = [];

		// Use regex to find word boundaries
		const regex = new RegExp(
			`\\b${escapeRegExpForSearch(termLower2)}\\w*`,
			"gi",
		);
		let match;
		while ((match = regex.exec(textLower)) !== null) {
			occurrences.push({
				start: match.index,
				end: match.index + match[0].length,
			});
		}

		if (occurrences.length === 0) {
			return null; // Term not found
		}
		termOccurrences.set(term, occurrences);
	}

	// Find the occurrence set where terms appear closest together in order
	let bestMatch: Array<{
		term: string;
		startPos: number;
		endPos: number;
	}> | null = null;
	let bestDistance = Infinity;

	const firstTermOccurrences = termOccurrences.get(terms[0]) || [];

	for (const firstOcc of firstTermOccurrences) {
		const currentMatch: Array<{
			term: string;
			startPos: number;
			endPos: number;
		}> = [
			{ term: terms[0], startPos: firstOcc.start, endPos: firstOcc.end },
		];
		let currentEndPos = firstOcc.end;
		let totalDistance = 0;
		let valid = true;

		for (let i = 1; i < terms.length; i++) {
			const termOccs = termOccurrences.get(terms[i]) || [];
			// Find the first occurrence of this term that comes after the previous term
			const nextOcc = termOccs.find((occ) => occ.start > currentEndPos);

			if (!nextOcc) {
				valid = false;
				break;
			}

			const distance = nextOcc.start - currentEndPos;
			totalDistance += distance;
			currentMatch.push({
				term: terms[i],
				startPos: nextOcc.start,
				endPos: nextOcc.end,
			});
			currentEndPos = nextOcc.end;
		}

		if (valid && totalDistance < bestDistance) {
			bestDistance = totalDistance;
			bestMatch = currentMatch;
		}
	}

	// Only return if distance is reasonable (MAX_WORD_DISTANCE * ~10 chars per word)
	if (
		bestMatch &&
		bestDistance <= PHRASE_PROXIMITY_CONFIG.MAX_WORD_DISTANCE * 15
	) {
		return bestMatch;
	}

	return null;
}

/**
 * Escape special regex characters for search
 */
function escapeRegExpForSearch(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calculate phrase proximity score for a text and query terms.
 *
 * Checks if non-stopword terms appear:
 * 1. Adjacent (in order, next to each other) - highest score
 * 2. Near (in order, within MAX_WORD_DISTANCE) - medium score
 * 3. Out of order or far apart - no proximity boost
 *
 * @param text The text to search in
 * @param terms Non-stopword query terms (already filtered)
 * @returns Proximity score (0 = no proximity match, higher = better match)
 */
export function calculatePhraseProximity(
	text: string,
	terms: string[],
): {
	score: number;
	isAdjacent: boolean;
	isNear: boolean;
	minDistance: number;
} {
	// Need at least 2 terms for phrase matching
	if (terms.length < 2 || !text) {
		return {
			score: 0,
			isAdjacent: false,
			isNear: false,
			minDistance: Infinity,
		};
	}

	// Strip annotations and normalize text
	const cleanText = stripAnnotations(text).toLowerCase();

	// Insert paragraph boundary markers before tokenizing
	// These add significant "distance" between terms that span paragraph/sentence breaks
	// This prevents matching "ending.\n\nCraving" as if they were a phrase
	// We insert multiple markers to ensure the distance exceeds MAX_WORD_DISTANCE
	const PARA_MARKERS =
		"__PARA__ __PARA__ __PARA__ __PARA__ __PARA__ __PARA__ __PARA__"; // 7 markers = > MAX_WORD_DISTANCE
	const textWithBoundaries = cleanText
		.replace(/\.\s*\n/g, `. ${PARA_MARKERS} `)
		.replace(/\n\n+/g, ` ${PARA_MARKERS} `);

	// Tokenize into words, removing punctuation (but keeping __PARA__ markers)
	const words = textWithBoundaries
		.replace(/[^\w\s_]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 0);

	if (words.length === 0) {
		return {
			score: 0,
			isAdjacent: false,
			isNear: false,
			minDistance: Infinity,
		};
	}

	// Find positions for each term
	const termPositions: number[][] = terms.map((term) =>
		findTermPositions(words, term),
	);

	// Check if all terms are found
	if (termPositions.some((positions) => positions.length === 0)) {
		return {
			score: 0,
			isAdjacent: false,
			isNear: false,
			minDistance: Infinity,
		};
	}

	// Find the best (minimum) total distance between consecutive terms in order
	// Uses dynamic programming approach to find optimal positions
	let minTotalDistance = Infinity;

	// Try each position of the first term as a starting point
	for (const startPos of termPositions[0]) {
		let currentPos = startPos;
		let totalDistance = 0;
		let valid = true;

		// Find the closest next term position that comes AFTER current position
		for (let i = 1; i < termPositions.length; i++) {
			// Find first position of term[i] that is after currentPos
			const nextPositions = termPositions[i].filter(
				(p) => p > currentPos,
			);

			if (nextPositions.length === 0) {
				valid = false;
				break;
			}

			const nextPos = Math.min(...nextPositions);
			const distance = nextPos - currentPos - 1; // Words between them
			totalDistance += distance;
			currentPos = nextPos;
		}

		if (valid && totalDistance < minTotalDistance) {
			minTotalDistance = totalDistance;
		}
	}

	if (minTotalDistance === Infinity) {
		return {
			score: 0,
			isAdjacent: false,
			isNear: false,
			minDistance: Infinity,
		};
	}

	// Calculate score based on distance
	const numGaps = terms.length - 1;
	const avgDistance = minTotalDistance / numGaps;
	const isAdjacent = minTotalDistance === 0; // All terms directly adjacent
	const isNear = avgDistance <= PHRASE_PROXIMITY_CONFIG.MAX_WORD_DISTANCE;

	let score = 0;
	if (isAdjacent) {
		score = PHRASE_PROXIMITY_CONFIG.ADJACENT_BOOST;
	} else if (isNear) {
		// Score decreases as distance increases
		const distanceRatio =
			1 - avgDistance / (PHRASE_PROXIMITY_CONFIG.MAX_WORD_DISTANCE + 1);
		score = PHRASE_PROXIMITY_CONFIG.NEAR_BOOST * distanceRatio;
	}

	return { score, isAdjacent, isNear, minDistance: minTotalDistance };
}

/**
 * Calculate phrase proximity boost across multiple fields.
 * Applies field-specific multipliers for title, description, and content.
 *
 * @param title Discourse/item title
 * @param description Discourse/item description
 * @param content Full content text
 * @param terms Non-stopword query terms
 * @returns Total phrase proximity boost to add to score
 */
export function calculatePhraseProximityBoost(
	title: string | undefined,
	description: string | undefined,
	content: string | undefined,
	terms: string[],
): {
	boost: number;
	titleMatch: boolean;
	descriptionMatch: boolean;
	contentMatch: boolean;
	hasAnyProximity: boolean;
	bestProximity: {
		isAdjacent: boolean;
		isNear: boolean;
		minDistance: number;
	} | null;
} {
	if (terms.length < 2) {
		return {
			boost: 0,
			titleMatch: false,
			descriptionMatch: false,
			contentMatch: false,
			hasAnyProximity: false,
			bestProximity: null,
		};
	}

	let totalBoost = 0;
	let titleMatch = false;
	let descriptionMatch = false;
	let contentMatch = false;
	let bestMinDistance = Infinity;
	let bestIsAdjacent = false;
	let bestIsNear = false;

	// Helper to update best proximity
	const updateBestProximity = (proximity: {
		isAdjacent: boolean;
		isNear: boolean;
		minDistance: number;
	}) => {
		if (proximity.minDistance < bestMinDistance) {
			bestMinDistance = proximity.minDistance;
			bestIsAdjacent = proximity.isAdjacent;
			bestIsNear = proximity.isNear;
		}
	};

	// Check title (highest value)
	if (title) {
		const titleProximity = calculatePhraseProximity(title, terms);
		if (titleProximity.score > 0) {
			totalBoost +=
				titleProximity.score * PHRASE_PROXIMITY_CONFIG.TITLE_MULTIPLIER;
			titleMatch = true;
			updateBestProximity(titleProximity);
		}
	}

	// Check description
	if (description) {
		const descProximity = calculatePhraseProximity(description, terms);
		if (descProximity.score > 0) {
			totalBoost +=
				descProximity.score *
				PHRASE_PROXIMITY_CONFIG.DESCRIPTION_MULTIPLIER;
			descriptionMatch = true;
			updateBestProximity(descProximity);
		}
	}

	// Check content - always check for best proximity tracking
	if (content) {
		const contentProximity = calculatePhraseProximity(content, terms);
		if (contentProximity.score > 0) {
			// Only add to boost if no title/description match (avoid double-counting)
			if (!titleMatch && !descriptionMatch) {
				totalBoost += contentProximity.score;
			}
			contentMatch = true;
			updateBestProximity(contentProximity);
		}
	}

	const hasAnyProximity = titleMatch || descriptionMatch || contentMatch;
	const bestProximity = hasAnyProximity
		? {
				isAdjacent: bestIsAdjacent,
				isNear: bestIsNear,
				minDistance: bestMinDistance,
			}
		: null;

	return {
		boost: totalBoost,
		titleMatch,
		descriptionMatch,
		contentMatch,
		hasAnyProximity,
		bestProximity,
	};
}

/**
 * Find the best paragraph/section from content that has the best phrase proximity.
 * For phrase-like queries, prefer paragraphs where query terms appear close together.
 *
 * @param content Full content text
 * @param terms Non-stopword query terms
 * @param maxSnippetLength Maximum length of returned snippet
 * @returns Best snippet with phrase proximity, or null if no good match
 */
export function findBestPhraseSnippet(
	content: string,
	terms: string[],
	maxSnippetLength: number = 300,
): { snippet: string; hasProximity: boolean; isAdjacent: boolean } | null {
	if (!content || terms.length < 2) {
		return null;
	}

	// Split content into paragraphs (by double newlines or <br> tags)
	const paragraphs = content
		.split(/(?:\r?\n\r?\n|<br\s*\/?>\s*<br\s*\/?>)/i)
		.map((p) => p.trim())
		.filter((p) => p.length > 20); // Skip very short paragraphs

	if (paragraphs.length === 0) {
		return null;
	}

	// Score each paragraph by phrase proximity
	let bestParagraph: string | null = null;
	let bestScore = -1;
	let bestIsAdjacent = false;
	let bestIsNear = false;

	for (const para of paragraphs) {
		const proximity = calculatePhraseProximity(para, terms);

		// Calculate score: adjacent > near > has all terms > has some terms
		let score = 0;

		if (proximity.isAdjacent) {
			score = 100 + (1 / (proximity.minDistance + 1)) * 10;
		} else if (proximity.isNear) {
			score = 50 + (1 / (proximity.minDistance + 1)) * 10;
		} else {
			// Check if paragraph has all terms even if not in proximity
			const paraLower = stripAnnotations(para).toLowerCase();
			const hasAllTerms = terms.every((term) =>
				paraLower.includes(term.toLowerCase()),
			);
			if (hasAllTerms) {
				score = 10;
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestParagraph = para;
			bestIsAdjacent = proximity.isAdjacent;
			bestIsNear = proximity.isNear;
		}
	}

	if (!bestParagraph || bestScore <= 0) {
		return null;
	}

	// Truncate to maxSnippetLength if needed
	let snippet = bestParagraph;
	if (snippet.length > maxSnippetLength) {
		// Try to find the phrase match location and center the snippet around it
		const phraseLocation = findPhraseLocation(snippet, terms);
		if (phraseLocation >= 0) {
			const start = Math.max(
				0,
				phraseLocation - Math.floor(maxSnippetLength / 3),
			);
			const end = Math.min(snippet.length, start + maxSnippetLength);
			snippet =
				(start > 0 ? "..." : "") +
				snippet.slice(start, end) +
				(end < bestParagraph.length ? "..." : "");
		} else {
			snippet = snippet.slice(0, maxSnippetLength) + "...";
		}
	}

	return {
		snippet,
		hasProximity: bestIsAdjacent || bestIsNear,
		isAdjacent: bestIsAdjacent,
	};
}

/**
 * Find the character position where query terms appear closest together.
 * Used for centering snippets around the best match.
 */
function findPhraseLocation(text: string, terms: string[]): number {
	const textLower = stripAnnotations(text).toLowerCase();

	// Find first occurrence of each term
	const positions: number[] = [];
	for (const term of terms) {
		const pos = textLower.indexOf(term.toLowerCase());
		if (pos >= 0) {
			positions.push(pos);
		}
	}

	if (positions.length === 0) {
		return -1;
	}

	// Return the position of the first term (start of phrase)
	return Math.min(...positions);
}

/**
 * Parse slug prefix filters from query.
 * Syntax: ^prefix filters results to slugs starting with "prefix" (case-insensitive)
 * Example: "^SN12 consciousness jhana" → { prefixes: ["sn12"], searchQuery: "consciousness jhana" }
 * Also handles: "^sn 12" → { prefixes: ["sn12"], searchQuery: "" } (merges prefix with following number)
 */
export function parseSlugPrefixes(query: string): {
	prefixes: string[];
	searchQuery: string;
} {
	const terms = query.trim().split(/\s+/);
	const prefixes: string[] = [];
	const searchTerms: string[] = [];

	for (let i = 0; i < terms.length; i++) {
		const term = terms[i];
		if (term.startsWith("^") && term.length > 1) {
			let prefix = term.slice(1).toLowerCase();

			// Check if prefix ends with letters and next term is a number
			// e.g., "^sn" followed by "12" should become "sn12"
			const nextTerm = terms[i + 1];
			if (nextTerm && /^[a-z]+$/i.test(prefix) && /^\d+/.test(nextTerm)) {
				prefix = prefix + nextTerm.toLowerCase();
				i++; // Skip the next term since we merged it
			}

			prefixes.push(prefix);
		} else {
			searchTerms.push(term);
		}
	}

	return {
		prefixes,
		searchQuery: searchTerms.join(" "),
	};
}

/**
 * Check if a slug matches any of the prefix filters
 */
export function slugMatchesPrefixes(slug: string, prefixes: string[]): boolean {
	if (prefixes.length === 0) return true; // No filter = match all
	const slugLower = slug.toLowerCase();
	return prefixes.some((prefix) => slugLower.startsWith(prefix));
}

// ==================== TYPES ====================

export type MatchType =
	| "exact"
	| "word-exact"
	| "prefix"
	| "word-prefix"
	| "infix"
	| "none";

export type ResultType = "discourse" | "topic-quality" | "simile";

export interface ScoredResult {
	type: ResultType;
	score: number;
	item: any;
	matchType?: string;
	/** Optional priority multiplier for discourses (from frontmatter) */
	priority?: number;
	/** Number of non-stopword terms matched (for multi-term query ranking) */
	nonStopwordMatches?: number;
	/** Index of the matched synonym (0 = first synonym, lower = more relevant) */
	synonymMatchPosition?: number;
	/** Content snippet for similarity detection (may also be on item.contentSnippet) */
	contentSnippet?: string;
}

export interface SearchConfig {
	/** Minimum query length for prefix matching (default: 3) */
	minLengthForPrefix: number;
	/** Minimum query length for infix matching (default: 4) */
	minLengthForInfix: number;
	/** Minimum query length for 1-edit fuzzy (default: 4) */
	minLengthForFuzzy1: number;
	/** Minimum query length for 2-edit fuzzy (default: 8) */
	minLengthForFuzzy2: number;
	/** Score tolerance for diversity (-25 means allow items 25 points lower) */
	diversityTolerance: number;
	/** Max same type in a row before diversity kicks in */
	maxSameTypeInRow: number;
	/** Strata boundaries (descending) */
	strataBoundaries: number[];
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
	minLengthForPrefix: 3,
	minLengthForInfix: 5,
	minLengthForFuzzy1: 4,
	minLengthForFuzzy2: 8,
	diversityTolerance: 25,
	maxSameTypeInRow: 3,
	strataBoundaries: [76, 51, 26, 0], // 100-76, 75-51, 50-26, 25-0
};

// ==================== QUERY PREPROCESSING ====================

/**
 * Get max allowed edit distance based on query length
 */
export function getMaxAllowedEditDistance(
	queryLength: number,
	config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): number {
	if (queryLength >= config.minLengthForFuzzy2) return 2;
	if (queryLength >= config.minLengthForFuzzy1) return 1;
	return 0;
}

/**
 * Check if prefix matching is allowed for this query length
 */
export function allowPrefixMatch(
	queryLength: number,
	config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): boolean {
	return queryLength >= config.minLengthForPrefix;
}

/**
 * Check if infix matching is allowed for this query length
 */
export function allowInfixMatch(
	queryLength: number,
	config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): boolean {
	return queryLength >= config.minLengthForInfix;
}

// ==================== MATCH TYPE DETECTION ====================

/**
 * Determine match type between text and query
 * Returns "none" for prefix/infix if query is too short
 * Uses diacritic normalization so "jhana" matches "jhāna"
 */
export function getMatchType(
	text: string,
	query: string,
	config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): MatchType {
	// Normalize both text and query for diacritic-insensitive matching
	const textLower = normalizeDiacritics(text.toLowerCase());
	const queryLower = normalizeDiacritics(query.toLowerCase());
	const queryLength = queryLower.length;

	// Exact match always allowed (entire text equals query)
	if (textLower === queryLower) return "exact";

	// Word-exact match: query exactly matches one of the words in text
	// This is higher priority than prefix matching
	const words = textLower.split(/[\s\-_]+/);
	if (words.some((word) => word === queryLower)) {
		return "word-exact";
	}

	// Prefix match - requires minimum length
	if (
		allowPrefixMatch(queryLength, config) &&
		textLower.startsWith(queryLower)
	) {
		return "prefix";
	}

	// Word-prefix match - check if any word starts with query (but not exact)
	if (allowPrefixMatch(queryLength, config)) {
		if (
			words.some(
				(word) => word.startsWith(queryLower) && word !== queryLower,
			)
		) {
			return "word-prefix";
		}
	}

	// Infix match - requires minimum length
	if (
		allowInfixMatch(queryLength, config) &&
		textLower.includes(queryLower)
	) {
		return "infix";
	}

	return "none";
}

/**
 * Check if text contains query (case-insensitive, diacritic-insensitive)
 * Used for content matching - always allowed regardless of query length.
 * Also handles singular/plural variations (e.g., "truths" matches "truth").
 */
export function textContainsQuery(text: string, query: string): boolean {
	const normalizedText = text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	const normalizedQuery = query
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

	// First check exact match
	if (normalizedText.includes(normalizedQuery)) {
		return true;
	}

	// Check with plural/singular variations
	// For multi-word queries, try alternate form of last word
	const words = normalizedQuery.split(/\s+/);
	if (words.length > 0) {
		const lastWord = words[words.length - 1];
		const forms = getSingularPluralForms(lastWord);
		const alternateForm = forms.find((f) => f !== lastWord);

		if (alternateForm) {
			const alternateQuery = [...words.slice(0, -1), alternateForm].join(
				" ",
			);
			if (normalizedText.includes(alternateQuery)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Check if text contains query as a whole word (case-insensitive, diacritic-insensitive)
 * Returns true if query appears surrounded by word boundaries.
 * Also handles singular/plural variations (e.g., "truths" matches "truth").
 */
export function textContainsWholeWord(text: string, query: string): boolean {
	const normalizedText = text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	const normalizedQuery = query
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

	// Generate patterns that match both singular and plural forms
	// For multi-word queries, make the last word flexible (truth|truths)
	const words = normalizedQuery.split(/\s+/);
	const patterns: string[] = [];

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		const forms = getSingularPluralForms(word);
		const escapedForms = forms.map((f) =>
			f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
		);

		// For last word, always use alternation to match both forms
		// For other words, also allow flexibility but exact match is preferred
		if (escapedForms.length > 1 && escapedForms[0] !== escapedForms[1]) {
			patterns.push(`(?:${escapedForms.join("|")})`);
		} else {
			patterns.push(escapedForms[0]);
		}
	}

	const pattern = patterns.join("\\s+");

	// Use word boundary but exclude hyphen-prefixed matches
	// e.g., "non-craving" should NOT match "craving" as a whole word
	const regex = new RegExp(`(^|[^-])\\b${pattern}\\b`, "i");
	return regex.test(normalizedText);
}

/**
 * Count occurrences of query as a whole word in text
 * Used to boost content matches where query appears multiple times
 */
export function countWholeWordOccurrences(text: string, query: string): number {
	const normalizedText = text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
	const normalizedQuery = query
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

	// Generate pattern with singular/plural support
	const words = normalizedQuery.split(/\s+/);
	const patterns: string[] = [];

	for (const word of words) {
		const forms = getSingularPluralForms(word);
		const escapedForms = forms.map((f) =>
			f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
		);
		if (escapedForms.length > 1 && escapedForms[0] !== escapedForms[1]) {
			patterns.push(`(?:${escapedForms.join("|")})`);
		} else {
			patterns.push(escapedForms[0]);
		}
	}

	const pattern = patterns.join("\\s+");
	const regex = new RegExp(`(^|[^-])\\b${pattern}\\b`, "gi");
	const matches = normalizedText.match(regex);
	return matches ? matches.length : 0;
}

/**
 * Normalize string for diacritic-insensitive comparison
 */
export function normalizeForComparison(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

// ==================== EDIT DISTANCE ====================

/**
 * Levenshtein distance calculation
 */
export function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];
	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}
	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1, // deletion
				);
			}
		}
	}
	return matrix[b.length][a.length];
}

/**
 * Find minimum edit distance to any word in text or the text itself
 */
export function minEditDistance(text: string, query: string): number {
	const textLower = text.toLowerCase();
	const queryLower = query.toLowerCase();

	// Check against full text
	let minDist = levenshteinDistance(textLower, queryLower);

	// Check against individual words
	const words = textLower.split(/[\s\-_]+/);
	for (const word of words) {
		const dist = levenshteinDistance(word, queryLower);
		if (dist < minDist) minDist = dist;
	}

	return minDist;
}

// ==================== SCORING ====================

/** Score values for different match types */
export const SCORE = {
	// Category matches (topics, qualities, similes)
	CATEGORY_EXACT_TITLE: 100,
	CATEGORY_EXACT_PALI: 99, // Exact Pali match is authoritative - user searched for the Pali term
	CATEGORY_EXACT_SLUG: 98,
	CATEGORY_EXACT_SYNONYM: 94,
	CATEGORY_WORD_EXACT_TITLE: 97, // Word in title exactly matches query
	CATEGORY_WORD_EXACT_SYNONYM: 93, // Word in synonym exactly matches query
	CATEGORY_PREFIX_TITLE: 92,
	CATEGORY_PREFIX_SLUG: 90,
	CATEGORY_PREFIX_PALI: 88,
	CATEGORY_PREFIX_SYNONYM: 86,
	CATEGORY_WORD_PREFIX: 80,
	CATEGORY_CROSS_FIELD_ALL: 70, // All query terms found across fields
	CATEGORY_CROSS_FIELD_WITH_TITLE_MATCH: 75, // Cross-field + one term exact in title
	CATEGORY_DESCRIPTION_WORD: 40, // Query found as whole word in description
	CATEGORY_INFIX: 35,
	CATEGORY_CROSS_FIELD_PARTIAL: 30, // At least one query term found across fields
	CATEGORY_DESCRIPTION_INFIX: 28, // Query found as substring in description
	CATEGORY_FUZZY_1: 25,
	CATEGORY_FUZZY_2: 18,

	// Discourse matches
	DISCOURSE_EXACT_TITLE: 95,
	DISCOURSE_WORD_EXACT_TITLE: 93, // Word in title exactly matches query
	DISCOURSE_PREFIX_TITLE: 90,
	DISCOURSE_WORD_PREFIX: 85,
	DISCOURSE_TERM_TITLE_MATCH: 82, // For multi-term: one term matches title word
	// Description matches - higher than content because description tells what discourse is ABOUT
	DISCOURSE_DESCRIPTION_WHOLE_WORD: 84, // Query as whole word in description
	DISCOURSE_DESCRIPTION_INFIX: 78, // Query as substring in description
	DISCOURSE_INFIX_WITH_CONTENT: 70,
	DISCOURSE_INFIX_NO_CONTENT: 40,
	DISCOURSE_CONTENT_WHOLE_WORD_BASE: 75, // Whole word match in content (lower than description)
	DISCOURSE_CONTENT_WHOLE_WORD_MIN: 55,
	DISCOURSE_CONTENT_EXACT_BASE: 60, // Substring match in content
	DISCOURSE_CONTENT_EXACT_MIN: 40,
	DISCOURSE_CONTENT_FUZZY_BASE: 30,
	DISCOURSE_CONTENT_FUZZY_MIN: 15,

	// Minimum score threshold
	MIN_SCORE: 15,
} as const;

// ==================== MULTI-TERM BOOST ====================

export interface MultiTermBoostParams {
	score: number;
	matchType: string;
	nonStopwordTerms: string[];
	nonStopwordMatches: number;
	termMatchScore: number;
	visibleAreaMatches: number;
	visibleTermMatchScore: number;
	// Optional phrase proximity boost (pre-calculated)
	phraseProximityBoost?: number;
	// Whether the item has any phrase proximity (terms appearing near each other in order)
	hasAnyProximity?: boolean;
}

/**
 * Apply multi-term boost to a discourse score.
 * This is shared between API (search.ts) and browser (ExploreWidget.astro)
 * to ensure consistent ranking.
 *
 * Rules:
 * - If ALL non-stopword terms are found, boost to 70-85 range
 * - Description matches get a quality bonus instead of replacement
 * - Visible area matches (title + desc + snippet) get extra boost
 * - Phrase proximity boost: extra points when terms appear close together in order
 * - Scattered penalty: if all terms found but not near each other, reduce score
 */
export function applyMultiTermBoost(params: MultiTermBoostParams): number {
	const {
		score: initialScore,
		matchType,
		nonStopwordTerms,
		nonStopwordMatches,
		termMatchScore,
		visibleAreaMatches,
		visibleTermMatchScore,
		phraseProximityBoost = 0,
		hasAnyProximity = false,
	} = params;

	let score = initialScore;

	// Only apply if we have multiple non-stopword terms and at least one match
	if (nonStopwordTerms.length <= 1 || nonStopwordMatches === 0) {
		return score;
	}

	const allNonStopTermsFound = nonStopwordMatches === nonStopwordTerms.length;
	const allInVisibleArea = visibleAreaMatches === nonStopwordTerms.length;

	if (allNonStopTermsFound) {
		// Base score uses quality-weighted term match score
		// Perfect score (all exact matches) = numTerms, giving base of 70 + bonus
		const perfectScore = nonStopwordTerms.length;
		const qualityRatio = termMatchScore / perfectScore; // 0.0 to 1.0
		let baseScore = 70 + qualityRatio * 8; // 70-78 based on match quality

		// Additional boost if ALL terms appear in visible area
		if (allInVisibleArea) {
			const visibleQualityRatio = visibleTermMatchScore / perfectScore;
			baseScore += 3 + visibleQualityRatio * 4; // 3-7 boost based on quality
		} else if (visibleAreaMatches > 0) {
			// Partial boost for some terms in visible area
			baseScore += visibleAreaMatches;
		}

		// Phrase proximity boost: terms appearing near each other in order
		// This helps "exhaust craving" rank results where those words appear together
		if (phraseProximityBoost > 0) {
			baseScore += phraseProximityBoost;
		}

		// Description matches should rank higher than content-only matches
		// If we already have a description match score (84+), boost it rather than override
		if (matchType.startsWith("description-") && score >= 78) {
			// Add quality bonus to description score
			score += qualityRatio * 5; // +0 to +5 based on match quality
			// Also add phrase proximity boost to description matches
			score += phraseProximityBoost;
		} else {
			score = Math.max(score, baseScore);
		}

		// Scattered penalty: when all terms found but NOT near each other
		// This is applied AFTER Math.max to ensure it always takes effect
		// e.g., "ending craving" - if document has both words but scattered, penalize it
		// This helps phrase-like queries rank proximity matches higher
		if (!hasAnyProximity && nonStopwordTerms.length >= 2) {
			score -= PHRASE_PROXIMITY_CONFIG.SCATTERED_PENALTY;
		}
	} else if (nonStopwordMatches > 1) {
		// Partial match: smaller boost, weighted by quality
		const qualityBonus = (termMatchScore - 1) * 4;
		score += qualityBonus;
	}

	return score;
}

// ==================== DISCOURSE SLUG PARSING ====================

/**
 * Parse a discourse slug into collection and numeric parts for ordering
 * e.g., "an6.73" → { collection: "an", chapter: 6, verse: 73, numericValue: 673 }
 * e.g., "mn119" → { collection: "mn", chapter: 119, verse: 0, numericValue: 11900 }
 * e.g., "sn12.23" → { collection: "sn", chapter: 12, verse: 23, numericValue: 1223 }
 */
export function parseDiscourseSlug(slug: string): {
	collection: string;
	chapter: number;
	verse: number;
	numericValue: number;
} | null {
	if (!slug) return null;

	// Match patterns like "an6.73", "mn119", "sn12.23", "dhp334-359"
	const match = slug.match(/^([a-z]+)(\d+)(?:\.(\d+))?/i);
	if (!match) return null;

	const collection = match[1].toLowerCase();
	const chapter = parseInt(match[2], 10);
	const verse = match[3] ? parseInt(match[3], 10) : 0;

	// Create a numeric value for comparison: chapter * 100 + verse
	// This ensures an6.73 (673) < an6.74 (674) and an6 (600) < an7 (700)
	const numericValue = chapter * 100 + verse;

	return { collection, chapter, verse, numericValue };
}

// ==================== STRATA-BASED DIVERSITY RANKING ====================

/**
 * Get the diversity group for a result type.
 * Groups similes with topics/qualities so only 2 diversity groups exist:
 * - "discourse" for discourses
 * - "card" for topics, qualities, and similes
 */
function getDiversityGroup(type: string): "discourse" | "card" {
	return type === "discourse" ? "discourse" : "card";
}

/**
 * Get the strata index for a given score
 */
function getStrata(score: number, config: SearchConfig): number {
	for (let i = 0; i < config.strataBoundaries.length; i++) {
		if (score >= config.strataBoundaries[i]) return i;
	}
	return config.strataBoundaries.length - 1;
}

/**
 * Apply strata-based diversity ranking to search results
 *
 * Rules:
 * - Results are grouped into score strata (e.g., 100-76, 75-51, etc.)
 * - After N results of the same type in a row, different types get a boost
 * - Won't show weak matches if there are still good matches of other types
 * - Within same strata & type, priority is used as a multiplier for tie-breaking
 * - Non-stopword term matches are prioritized over stopword-only matches
 * - Content snippet similarity: penalizes results with snippets similar to already-shown results
 */

/**
 * Extract signature n-grams from a content snippet for similarity detection.
 * Returns a set of normalized word sequences (3-grams) that can be compared.
 */
function extractSnippetSignatures(snippet: string | undefined): Set<string> {
	if (!snippet) return new Set();

	// Normalize: lowercase, remove punctuation except spaces, collapse whitespace
	const normalized = snippet
		.toLowerCase()
		.replace(/[^\w\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	const words = normalized.split(" ").filter((w) => w.length > 2);
	const signatures = new Set<string>();

	// Extract 4-grams (4 consecutive words) as signatures
	// This catches formulaic phrases like "first jhana... second jhana..."
	for (let i = 0; i <= words.length - 4; i++) {
		signatures.add(words.slice(i, i + 4).join(" "));
	}

	return signatures;
}

/**
 * Calculate similarity between a snippet and already-seen signatures.
 * Returns a value 0-1 indicating how much of the snippet overlaps with seen content.
 */
function calculateSnippetOverlap(
	snippetSignatures: Set<string>,
	seenSignatures: Set<string>,
): number {
	if (snippetSignatures.size === 0) return 0;

	let matchCount = 0;
	for (const sig of snippetSignatures) {
		if (seenSignatures.has(sig)) {
			matchCount++;
		}
	}

	return matchCount / snippetSignatures.size;
}

export function rankResultsWithDiversity(
	results: ScoredResult[],
	config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): ScoredResult[] {
	if (results.length === 0) return [];

	// Score already includes priority boost from the search logic
	// So we just use the raw score for ranking
	const getEffectiveScore = (r: ScoredResult): number => r.score;

	// Sort all results by effective score descending, with multiple tie-breakers
	const sorted = [...results].sort((a, b) => {
		// Primary: effective score
		const aEffective = getEffectiveScore(a);
		const bEffective = getEffectiveScore(b);
		if (bEffective !== aEffective) return bEffective - aEffective;

		// Secondary: non-stopword matches (more is better)
		const aNonStop = a.nonStopwordMatches ?? 0;
		const bNonStop = b.nonStopwordMatches ?? 0;
		if (bNonStop !== aNonStop) return bNonStop - aNonStop;

		// Tertiary: raw priority (higher is better, for exact ties)
		const aPriority = a.priority ?? 1;
		const bPriority = b.priority ?? 1;
		if (bPriority !== aPriority) return bPriority - aPriority;

		// Quaternary: synonym match position (lower index = more relevant)
		// Infinity for items without synonym match so they sort after synonym matches
		const aSynPos = a.synonymMatchPosition ?? Infinity;
		const bSynPos = b.synonymMatchPosition ?? Infinity;
		if (aSynPos !== bSynPos) return aSynPos - bSynPos;

		// Quinary: discourse numeric ordering within same collection
		// e.g., AN 6.73 should come before AN 6.74 when scores are equal
		if (a.type === "discourse" && b.type === "discourse") {
			const aSlug = a.item?.slug || a.item?.id || "";
			const bSlug = b.item?.slug || b.item?.id || "";
			const aParsed = parseDiscourseSlug(aSlug);
			const bParsed = parseDiscourseSlug(bSlug);

			if (
				aParsed &&
				bParsed &&
				aParsed.collection === bParsed.collection
			) {
				return aParsed.numericValue - bParsed.numericValue;
			}
		}

		return 0;
	});

	const finalOrder: ScoredResult[] = [];
	const used = new Set<number>();

	// Track consecutive same-type count and diversity phases
	// Use diversity groups: "discourse" vs "card" (topics, qualities, similes)
	let lastGroup: "discourse" | "card" | null = null;
	let sameGroupCount = 0;
	// Track diversity phase: after showing 3 of one group, we want to show up to 3 of another
	let inDiversityPhase = false;
	let diversityPhaseGroup: "discourse" | "card" | null = null;
	let diversityPhaseCount = 0;

	// Content snippet similarity tracking
	// Tracks n-gram signatures from already-shown content snippets
	// Used as a TIE-BREAKER only - does NOT override score differences
	const seenSnippetSignatures = new Set<string>();
	// Similarity penalty is medium (10 pts)
	const SNIPPET_SIMILARITY_PENALTY = 10;
	const SNIPPET_SIMILARITY_THRESHOLD = 0.7; // Start penalizing at 80% overlap
	const ENABLE_SNIPPET_SIMILARITY = true;
	// Priority threshold: only apply snippet similarity penalty to discourses at or below this priority
	// This protects important discourses (priority 2+) from being penalized for sharing formulaic passages
	const SNIPPET_SIMILARITY_PRIORITY_THRESHOLD = 1;

	while (finalOrder.length < sorted.length) {
		// Find next best item considering diversity
		let bestIdx = -1;
		let bestScore = -1;

		// First pass: find highest effective score among unused items
		let highestUnusedScore = -1;
		for (let i = 0; i < sorted.length; i++) {
			if (!used.has(i)) {
				const effectiveScore = getEffectiveScore(sorted[i]);
				if (effectiveScore > highestUnusedScore) {
					highestUnusedScore = effectiveScore;
				}
			}
		}

		const currentStrata = getStrata(highestUnusedScore, config);

		// Determine if we should prioritize diversity
		// needDiversity triggers when we've shown 3 of the same group
		// continueDiversityPhase means we're in a diversity phase and should continue showing the alternative group
		const needDiversity =
			lastGroup !== null && sameGroupCount >= config.maxSameTypeInRow;
		const continueDiversityPhase =
			inDiversityPhase && diversityPhaseCount < config.maxSameTypeInRow;

		for (let i = 0; i < sorted.length; i++) {
			if (used.has(i)) continue;

			const item = sorted[i];
			const itemGroup = getDiversityGroup(item.type);
			const itemEffectiveScore = getEffectiveScore(item);
			const itemStrata = getStrata(itemEffectiveScore, config);

			// Check if this item is within acceptable range
			let isAcceptable = false;

			// During diversity: boost items that are different from the group that triggered diversity
			// During diversity phase continuation: boost items matching the diversity phase group
			const shouldBoostForDiversity =
				(needDiversity && itemGroup !== lastGroup) ||
				(continueDiversityPhase && itemGroup === diversityPhaseGroup);

			if (shouldBoostForDiversity) {
				// Diversity mode: accept items within tolerance of highest effective score
				isAcceptable =
					itemEffectiveScore >=
					highestUnusedScore - config.diversityTolerance;
			} else if (!needDiversity && !continueDiversityPhase) {
				// Normal mode: only accept items in current or adjacent strata
				isAcceptable = itemStrata <= currentStrata + 1;
			} else {
				// Same group as last, but we need diversity - only accept if best in strata
				isAcceptable = itemStrata === currentStrata;
			}

			if (!isAcceptable) continue;

			// Score this candidate using effective score
			let candidateScore = itemEffectiveScore;

			// Diversity bonus: boost items during diversity phases
			if (shouldBoostForDiversity) {
				candidateScore += 10; // Boost to break ties in favor of diversity
			}

			// Content snippet similarity penalty (TIE-BREAKER only)
			// Only applies when candidate is in same strata as best - prevents demoting important results
			// Only applies to low-priority discourses - protects important discourses from formulaic passage penalties
			// This catches formulaic content like jhāna descriptions appearing in many discourses
			const itemPriority = item.priority ?? 1;
			if (
				ENABLE_SNIPPET_SIMILARITY &&
				item.type === "discourse" &&
				seenSnippetSignatures.size > 0 &&
				itemStrata === currentStrata && // Only apply within same quality tier
				itemPriority <= SNIPPET_SIMILARITY_PRIORITY_THRESHOLD // Only penalize low-priority discourses
			) {
				const snippet =
					item.item?.contentSnippet || item.contentSnippet;
				const itemSignatures = extractSnippetSignatures(snippet);
				const overlap = calculateSnippetOverlap(
					itemSignatures,
					seenSnippetSignatures,
				);

				if (overlap > SNIPPET_SIMILARITY_THRESHOLD) {
					// Small penalty for tie-breaking only
					const penaltyFactor =
						(overlap - SNIPPET_SIMILARITY_THRESHOLD) /
						(1 - SNIPPET_SIMILARITY_THRESHOLD);
					candidateScore -=
						penaltyFactor * SNIPPET_SIMILARITY_PENALTY;
				}
			}

			if (candidateScore > bestScore) {
				bestScore = candidateScore;
				bestIdx = i;
			}
		}

		// Fallback: if no acceptable item found (shouldn't happen), take highest unused
		if (bestIdx === -1) {
			for (let i = 0; i < sorted.length; i++) {
				if (!used.has(i)) {
					bestIdx = i;
					break;
				}
			}
		}

		if (bestIdx === -1) break; // No more items

		const selected = sorted[bestIdx];
		const selectedGroup = getDiversityGroup(selected.type);
		finalOrder.push(selected);
		used.add(bestIdx);

		// Track content snippet signatures for similarity detection
		if (selected.type === "discourse") {
			const snippet =
				selected.item?.contentSnippet || selected.contentSnippet;
			const signatures = extractSnippetSignatures(snippet);
			for (const sig of signatures) {
				seenSnippetSignatures.add(sig);
			}
		}

		// Update consecutive group tracking and diversity phase state
		if (selectedGroup === lastGroup) {
			sameGroupCount++;
			// If we're in a diversity phase and continuing with the alternative group
			if (inDiversityPhase && selectedGroup === diversityPhaseGroup) {
				diversityPhaseCount++;
				// End diversity phase after showing 3 of the alternative group
				if (diversityPhaseCount >= config.maxSameTypeInRow) {
					inDiversityPhase = false;
					diversityPhaseGroup = null;
					diversityPhaseCount = 0;
				}
			}
		} else {
			// Group changed
			if (needDiversity) {
				// Just triggered diversity, start diversity phase
				inDiversityPhase = true;
				diversityPhaseGroup = selectedGroup;
				diversityPhaseCount = 1;
			} else if (inDiversityPhase) {
				// Switched away from diversity phase group - end the phase
				inDiversityPhase = false;
				diversityPhaseGroup = null;
				diversityPhaseCount = 0;
			}
			lastGroup = selectedGroup;
			sameGroupCount = 1;
		}
	}

	return finalOrder;
}

// ==================== PAGINATION ====================

/**
 * Get page size based on viewport
 */
export function getPageSize(isMobile: boolean): number {
	return isMobile ? 20 : 100;
}

/**
 * Check if viewport is mobile
 */
export function isMobileViewport(): boolean {
	return typeof window !== "undefined" && window.innerWidth < 768;
}

/**
 * Count remaining results by type
 */
export function countRemainingByType(
	results: ScoredResult[],
	startIndex: number,
): { total: number; discourses: number; categories: number } {
	let discourses = 0;
	let categories = 0;
	for (let i = startIndex; i < results.length; i++) {
		if (results[i].type === "discourse") {
			discourses++;
		} else {
			categories++;
		}
	}
	return {
		total: results.length - startIndex,
		discourses,
		categories,
	};
}

/**
 * Format remaining count text for Show More button
 */
export function formatRemainingText(remaining: {
	total: number;
	discourses: number;
	categories: number;
}): string {
	if (remaining.discourses > 0 && remaining.categories > 0) {
		return `${remaining.total} remaining (${remaining.discourses} discourses, ${remaining.categories} topics/similes)`;
	} else if (remaining.discourses > 0) {
		return `${remaining.discourses} discourses remaining`;
	} else if (remaining.categories > 0) {
		return `${remaining.categories} topics/similes remaining`;
	}
	return `${remaining.total} remaining`;
}
