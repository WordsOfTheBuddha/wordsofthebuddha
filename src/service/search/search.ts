// Use the prebuilt static index so search can run server- and client-side (offline)
import searchIndex from "../../data/searchIndex";
import {
	buildFuseQuery,
	type HighlightTerm,
} from "../../utils/fuseQueryParser";
import { isStopword } from "../../utils/searchRanking";
import Fuse from "fuse.js";

export interface SearchResult {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
	priority?: number;
}

export interface SearchData {
	slug: string;
	title: string;
	description: string;
	content: string;
	priority?: number;
}

let fuseIndex: Fuse<SearchData> | null = null;

async function getSearchIndex() {
	if (fuseIndex) {
		return fuseIndex;
	}

	// The generated module exports an array of {slug,title,description,content}
	const searchData: SearchData[] = searchIndex as unknown as SearchData[];

	fuseIndex = new Fuse(searchData, {
		keys: [
			{ name: "slug", weight: 3 },
			{ name: "title", weight: 2 },
			{ name: "description", weight: 1.5 },
			{ name: "content", weight: 1 },
		],
		sortFn: (a: any, b: any) => {
			// Round scores to 3 decimal points for comparison
			const scoreA = Math.round(a.score * 10e10) / 10e10;
			const scoreB = Math.round(b.score * 10e10) / 10e10;

			// If scores are different, sort by score
			if (scoreA !== scoreB) {
				return scoreA - scoreB;
			}

			// Extract slugs with proper type checking
			const getSlug = (item: any) => {
				if (!item?.item?.[0]) return "";
				const slug = item.item[0];
				return typeof slug === "object" && "v" in slug ? slug.v : "";
			};

			const slugA = getSlug(a);
			const slugB = getSlug(b);

			// If scores are equal, use natural sort on slug
			return String(slugA).localeCompare(String(slugB), undefined, {
				numeric: true,
				sensitivity: "base",
			});
		},
		includeMatches: true,
		threshold: 0.3,
		ignoreLocation: true,
		ignoreDiacritics: true,
		useExtendedSearch: true,
	});

	return fuseIndex;
}

export interface SearchOptions {
	fields?: Array<keyof SearchData>;
	highlight?: boolean;
}

interface ParagraphMatch {
	text: string;
	matchCount: number;
	fullPhraseMatches: number;
	indices: [number, number][];
	debug?: {
		terms: string[];
		termMatches: Record<string, number>;
		fullPhraseCount: number;
	};
}

interface MatchCounts {
	exact: Set<string>;
	fuzzy: number;
	startsWith: number;
	endsWith: number;
	doesNotStartWith: number;
	doesNotEndWith: number;
	negation: number;
	[key: string]: number | Set<string>; // Add index signature
}

// Add utility for diacritic normalization
function normalizeText(text: string): string {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeRegExp(string: string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function processTermForHighlight(highlightTerm: HighlightTerm): string {
	// Return just the clean term - word boundaries will be added in the pattern creation
	return highlightTerm.term;
}

// Minimum term length for infix (partial word) highlighting
const MIN_LENGTH_FOR_INFIX_HIGHLIGHT = 4;

// Create diacritic-insensitive pattern for a vowel (both lower and upper case)
function vowelPattern(vowel: string): string {
	const patterns: Record<string, string> = {
		a: "[aAáÁàÀâÂäÄãÃåÅāĀăĂąĄ]",
		e: "[eEéÉèÈêÊëËēĒĕĔėĖ]",
		i: "[iIíÍìÌîÎïÏīĪĭĬįĮ]",
		o: "[oOóÓòÒôÔöÖõÕōŌŏŎőŐ]",
		u: "[uUúÚùÙûÛüÜūŪŭŬůŮ]",
	};
	return patterns[vowel.toLowerCase()] || vowel;
}

// Create case-insensitive pattern for a consonant
function consonantPattern(char: string): string {
	const lower = char.toLowerCase();
	const upper = char.toUpperCase();
	if (lower === upper) return escapeRegExp(char);
	return `[${lower}${upper}]`;
}

function createHighlightPattern(
	term: string,
	operation: HighlightTerm["operation"],
	context: string = "", // For startsWith/endsWith checks
): string {
	const normalized = normalizeText(term);

	// Build case-insensitive pattern character by character
	let diacriticPattern = "";
	for (const char of normalized) {
		if (/[aeiou]/i.test(char)) {
			diacriticPattern += vowelPattern(char);
		} else if (/[a-z]/i.test(char)) {
			diacriticPattern += consonantPattern(char);
		} else {
			diacriticPattern += escapeRegExp(char);
		}
	}

	switch (operation) {
		case "doesNotStartWith":
		case "doesNotEndWith":
		case "negation":
			return "";
		case "exact":
			return `\\b${diacriticPattern}\\b`; // Full word match only
		case "startsWith":
			// For highlighting, we should only highlight if it's at start of paragraph
			return `^[^\\S\\r\\n]*${diacriticPattern}`; // Match start of content with optional whitespace
		case "endsWith":
			return `${diacriticPattern}$`; // Must be at end of content
		default:
			// For fuzzy/infix, check term length
			// Short terms (< 4 chars) only match whole words to avoid over-highlighting
			if (term.length < MIN_LENGTH_FOR_INFIX_HIGHLIGHT) {
				return `\\b${diacriticPattern}\\b`;
			}
			return diacriticPattern; // Infix match (can be part of another word)
	}
}

function findBestMatchingParagraph(
	text: string,
	indices: [number, number][],
	highlightTerms: HighlightTerm[],
): string | null {
	const termsToHighlight = highlightTerms.filter(
		(ht) =>
			(!ht.field || ht.field === "content") &&
			!["doesNotStartWith", "doesNotEndWith", "negation"].includes(
				ht.operation,
			),
	);

	const queryTerms = termsToHighlight.map((ht) =>
		processTermForHighlight(ht),
	);
	const normalizedTerms = queryTerms.map((term) =>
		normalizeText(term.toLowerCase()),
	);

	const fullQuery = queryTerms.join(" ").toLowerCase();

	const paragraphs = text.split(/\n\n+/);
	let bestMatch: ParagraphMatch | null = null;
	let currentLength = 0;

	// console.log(`Debug: Searching for query terms:`, queryTerms);

	// Process each paragraph
	for (const paragraph of paragraphs) {
		const paragraphLower = paragraph.toLowerCase();
		const normalizedParagraph = normalizeText(paragraphLower);
		const paragraphEnd = currentLength + paragraph.length;
		const paragraphMatches: [number, number][] = [];

		// Find matches that fall within this paragraph
		for (const [start, end] of indices) {
			if (start >= currentLength && start <= paragraphEnd) {
				paragraphMatches.push([
					start - currentLength,
					Math.min(end - currentLength, paragraph.length),
				]);
			}
		}

		if (paragraphMatches.length > 0) {
			// Track unique exact matches and total matches by operation
			const matchCounts: MatchCounts = {
				exact: new Set<string>(),
				fuzzy: 0,
				startsWith: 0,
				endsWith: 0,
				doesNotStartWith: 0,
				doesNotEndWith: 0,
				negation: 0,
			};

			// Track individual term matches and stopword status
			const termMatches: Record<
				string,
				{
					count: number;
					operation: HighlightTerm["operation"];
					isStopword: boolean;
				}
			> = {};
			let uniqueTermsMatched = 0;
			let uniqueNonStopwordTermsMatched = 0;

			normalizedTerms.forEach((term, index) => {
				const highlightTerm = termsToHighlight[index];
				const originalTerm = queryTerms[index];
				const termIsStopword = isStopword(originalTerm);
				const pattern = createHighlightPattern(
					term,
					highlightTerm.operation,
					normalizedParagraph,
				);
				if (!pattern) return; // Skip negated terms

				let matches = 0;
				if (
					highlightTerm.operation === "startsWith" ||
					highlightTerm.operation === "endsWith"
				) {
					// For start/end, check against full paragraph
					matches = new RegExp(pattern, "iu").test(
						normalizedParagraph,
					)
						? 1
						: 0;
				} else {
					// For exact/fuzzy, find all matches
					matches = (
						normalizedParagraph.match(new RegExp(pattern, "giu")) ||
						[]
					).length;
				}

				termMatches[originalTerm] = {
					count: matches,
					operation: highlightTerm.operation,
					isStopword: termIsStopword,
				};

				// Track unique terms matched (regardless of how many times)
				if (matches > 0) {
					uniqueTermsMatched++;
					if (!termIsStopword) {
						uniqueNonStopwordTermsMatched++;
					}
				}

				// For exact matches, add the term to Set if there's a match
				if (highlightTerm.operation === "exact" && matches > 0) {
					matchCounts.exact.add(term);
				} else if (highlightTerm.operation !== "exact") {
					// Only increment number counters for non-exact operations
					(matchCounts[highlightTerm.operation] as number) += matches;
				}
			});

			// Calculate relevance score:
			// 1. Prioritize paragraphs with more UNIQUE terms matched (not same word multiple times)
			// 2. Prioritize paragraphs with non-stopword matches over stopword-only matches
			// 3. Use total match count as a tiebreaker
			const relevanceScore =
				uniqueNonStopwordTermsMatched * 100 + // Non-stopword unique terms (highest priority)
				uniqueTermsMatched * 10 + // All unique terms matched
				matchCounts.exact.size * 5 + // Exact match terms
				matchCounts.startsWith * 2 + // Start/end weighted medium
				matchCounts.endsWith * 2 +
				matchCounts.fuzzy * 1; // Fuzzy matches weighted lowest

			const debug = {
				terms: queryTerms,
				termMatches: Object.fromEntries(
					Object.entries(termMatches).map(([key, value]) => [
						key,
						value.count,
					]),
				),
				fullPhraseCount: matchCounts.exact.size,
				uniqueExactMatches: Array.from(matchCounts.exact),
				uniqueTermsMatched,
				uniqueNonStopwordTermsMatched,
			};

			if (!bestMatch || relevanceScore > bestMatch.matchCount) {
				bestMatch = {
					text: paragraph,
					matchCount: relevanceScore,
					fullPhraseMatches: matchCounts.exact.size, // Update to use exact matches
					indices: paragraphMatches,
					debug,
				};
			}
		}

		currentLength += paragraph.length + 2;
	}

	if (!bestMatch) {
		console.log("Debug: No matches found in any paragraph");
		return null;
	}

	/* console.log("Debug: Best match found:", {
            preview: bestMatch.text.slice(0, 50) + "...",
            score: bestMatch.fullPhraseMatches * 2 + bestMatch.matchCount,
            debug: bestMatch.debug,
        }); */

	// Split text into segments, preserving tooltip boundaries using updated pattern
	const segments = bestMatch.text.split(/(\|[^|]+::[^|]+\|)/g);

	// console.log("Debug: Segments found:", segments.length, segments);

	// Track which terms have already been highlighted (for first-match-only)
	const highlightedTerms = new Set<string>();

	// Helper to apply highlighting to text (only first occurrence per term globally)
	function applyHighlighting(text: string): string {
		let highlighted = text;
		termsToHighlight.forEach((ht) => {
			const cleanTerm = processTermForHighlight(ht);

			// Skip if this term was already highlighted in a previous segment
			if (highlightedTerms.has(cleanTerm.toLowerCase())) return;

			const pattern = createHighlightPattern(cleanTerm, ht.operation);

			if (!pattern) return;

			const regex = new RegExp(pattern, "u"); // Single match only
			const match = highlighted.match(regex);

			if (match) {
				// Mark this term as highlighted so we skip it in future segments
				highlightedTerms.add(cleanTerm.toLowerCase());

				highlighted = highlighted.replace(
					regex,
					(m) =>
						`<mark class="${ht.operation === "exact" ? "bg-yellow-200 dark:bg-yellow-800" : "bg-yellow-100 dark:bg-yellow-900"} px-1 rounded">${m}</mark>`,
				);
			}
		});
		return highlighted;
	}

	// Process each segment separately
	const processed = segments.map((segment) => {
		// Handle tooltip segments: |visible text::tooltip text|
		// We should highlight matches in the visible part but not the tooltip part
		const tooltipMatch = segment.match(/^\|([^|]+)::([^|]+)\|$/);
		if (tooltipMatch) {
			const visibleText = tooltipMatch[1];
			const tooltipText = tooltipMatch[2];
			// Apply highlighting only to visible text, preserve tooltip
			const highlightedVisible = applyHighlighting(visibleText);
			return `|${highlightedVisible}::${tooltipText}|`;
		}

		// Regular text segment - apply highlighting
		return applyHighlighting(segment);
	});

	return processed.join("").trim();
}

export async function performSearch(
	query: string,
	options: SearchOptions = {},
): Promise<SearchResult[]> {
	if (import.meta.env?.DEV) {
		console.log("[search] query:", query);
	}
	const { query: fuseQuery, highlightTerms } = buildFuseQuery(query);
	if (import.meta.env?.DEV) {
		console.log("[search] parsed:", JSON.stringify(fuseQuery));
	}
	const fuse = await getSearchIndex();

	if (!query) return [];

	const searchResults = fuse.search(fuseQuery);
	if (import.meta.env?.DEV) {
		console.log("[search] results:", searchResults.length);
	}

	return searchResults.map(({ item, matches }) => {
		const result: SearchResult = {
			slug: item.slug,
			title: item.title,
			description: item.description,
			contentSnippet: null,
			priority: item.priority,
		};
		if (options.highlight && matches) {
			const contentMatches = matches?.filter((m) => m.key === "content");

			if (contentMatches?.length) {
				const contentSnippet = findBestMatchingParagraph(
					item.content,
					contentMatches.flatMap((match) => match.indices),
					highlightTerms,
				);
				// Only include snippet if it actually contains highlighted text
				if (contentSnippet && contentSnippet.includes("<mark")) {
					result.contentSnippet = contentSnippet;
				}
			}
		}

		return result;
	});
}

/**
 * Get all discourses that match the given slug prefixes.
 * Used for filter-only queries like "^SN12" to return all SN12.* discourses.
 */
export async function getFilteredDiscourses(
	slugPrefixes: string[],
): Promise<SearchResult[]> {
	const searchData: SearchData[] = searchIndex as unknown as SearchData[];

	return searchData
		.filter((item) => {
			if (slugPrefixes.length === 0) return true;
			const slugLower = item.slug.toLowerCase();
			return slugPrefixes.some((prefix) => slugLower.startsWith(prefix));
		})
		.map((item) => ({
			slug: item.slug,
			title: item.title,
			description: item.description,
			contentSnippet: null,
			priority: item.priority,
		}));
}
