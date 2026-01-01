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
 * Split query into terms and classify them
 */
export function tokenizeQuery(
	query: string,
): { term: string; isStopword: boolean }[] {
	const terms = query
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 0);
	return terms.map((term) => ({
		term,
		isStopword: isStopword(term),
	}));
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

/**
 * Parse slug prefix filters from query.
 * Syntax: ^prefix filters results to slugs starting with "prefix" (case-insensitive)
 * Example: "^SN12 consciousness jhana" → { prefixes: ["sn12"], searchQuery: "consciousness jhana" }
 */
export function parseSlugPrefixes(query: string): {
	prefixes: string[];
	searchQuery: string;
} {
	const terms = query.trim().split(/\s+/);
	const prefixes: string[] = [];
	const searchTerms: string[] = [];

	for (const term of terms) {
		if (term.startsWith("^") && term.length > 1) {
			// Extract prefix (remove ^ and lowercase)
			prefixes.push(term.slice(1).toLowerCase());
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
 */
export function getMatchType(
	text: string,
	query: string,
	config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): MatchType {
	const textLower = text.toLowerCase();
	const queryLower = query.toLowerCase();
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
 * Used for content matching - always allowed regardless of query length
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
	return normalizedText.includes(normalizedQuery);
}

/**
 * Check if text contains query as a whole word (case-insensitive, diacritic-insensitive)
 * Returns true if query appears surrounded by word boundaries
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
	// Use word boundary regex
	const regex = new RegExp(
		`\\b${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
	);
	return regex.test(normalizedText);
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
	CATEGORY_EXACT_SLUG: 98,
	CATEGORY_EXACT_PALI: 96,
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
	DISCOURSE_INFIX_WITH_CONTENT: 70,
	DISCOURSE_INFIX_NO_CONTENT: 40,
	DISCOURSE_CONTENT_WHOLE_WORD_BASE: 80, // Whole word match in content (higher priority)
	DISCOURSE_CONTENT_WHOLE_WORD_MIN: 60,
	DISCOURSE_CONTENT_EXACT_BASE: 65, // Substring match in content
	DISCOURSE_CONTENT_EXACT_MIN: 45,
	DISCOURSE_CONTENT_FUZZY_BASE: 30,
	DISCOURSE_CONTENT_FUZZY_MIN: 15,

	// Minimum score threshold
	MIN_SCORE: 15,
} as const;

// ==================== STRATA-BASED DIVERSITY RANKING ====================

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
 */
export function rankResultsWithDiversity(
	results: ScoredResult[],
	config: SearchConfig = DEFAULT_SEARCH_CONFIG,
): ScoredResult[] {
	if (results.length === 0) return [];

	// Calculate effective score that incorporates priority
	// Priority adds a small bonus within the same score strata (up to +2 per priority level above 1)
	const getEffectiveScore = (r: ScoredResult): number => {
		const priority = r.priority ?? 1;
		// Add small bonus for higher priority (max +4 for priority 3)
		return r.score + (priority - 1) * 2;
	};

	// Sort all results by effective score descending, with nonStopwordMatches as secondary tiebreaker
	const sorted = [...results].sort((a, b) => {
		// Primary: effective score (score + priority bonus)
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
		return bPriority - aPriority;
	});

	const finalOrder: ScoredResult[] = [];
	const used = new Set<number>();

	// Track consecutive same-type count
	let lastType: string | null = null;
	let sameTypeCount = 0;

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
		const needDiversity =
			lastType !== null && sameTypeCount >= config.maxSameTypeInRow;

		for (let i = 0; i < sorted.length; i++) {
			if (used.has(i)) continue;

			const item = sorted[i];
			const itemEffectiveScore = getEffectiveScore(item);
			const itemStrata = getStrata(itemEffectiveScore, config);

			// Check if this item is within acceptable range
			let isAcceptable = false;

			if (needDiversity && item.type !== lastType) {
				// Diversity mode: accept items within tolerance of highest effective score
				isAcceptable =
					itemEffectiveScore >=
					highestUnusedScore - config.diversityTolerance;
			} else if (!needDiversity) {
				// Normal mode: only accept items in current or adjacent strata
				isAcceptable = itemStrata <= currentStrata + 1;
			} else {
				// Same type as last, but we need diversity - only accept if best in strata
				isAcceptable = itemStrata === currentStrata;
			}

			if (!isAcceptable) continue;

			// Score this candidate using effective score
			let candidateScore = itemEffectiveScore;

			// Diversity bonus: if we've had same type 3+ times, boost different types
			if (needDiversity && item.type !== lastType) {
				candidateScore += 10; // Boost to break ties in favor of diversity
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
		finalOrder.push(selected);
		used.add(bestIdx);

		// Update consecutive type tracking
		if (selected.type === lastType) {
			sameTypeCount++;
		} else {
			lastType = selected.type;
			sameTypeCount = 1;
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
