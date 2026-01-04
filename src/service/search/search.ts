// Use the prebuilt static index so search can run server- and client-side (offline)
import searchIndex from "../../data/searchIndex";
import {
	buildFuseQuery,
	type HighlightTerm,
} from "../../utils/fuseQueryParser";
import {
	isStopword,
	findPhraseMatchPositions,
	calculatePhraseProximity,
	stripAnnotations,
} from "../../utils/searchRanking";
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
	let bestMatchIndex = -1;
	let currentLength = 0;

	// console.log(`Debug: Searching for query terms:`, queryTerms);

	// Process each paragraph
	for (
		let paragraphIndex = 0;
		paragraphIndex < paragraphs.length;
		paragraphIndex++
	) {
		const paragraph = paragraphs[paragraphIndex];
		const paragraphLower = paragraph.toLowerCase();
		// Strip annotations before matching - they contain text that shouldn't affect term matching
		const strippedParagraph = stripAnnotations(paragraphLower);
		const normalizedParagraph = normalizeText(strippedParagraph);
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

		// Always evaluate paragraphs for term matches, even if Fuse.js didn't find matches here
		// This is important because Fuse.js searches raw content with annotations,
		// but we search the stripped content for accurate term matching
		{
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

			// Skip paragraphs with no term matches at all
			if (uniqueTermsMatched === 0) {
				currentLength += paragraph.length + 2;
				continue;
			}

			// Check for phrase proximity in this paragraph
			// Get non-stopword query terms for phrase matching
			const nonStopwordQueryTerms = queryTerms.filter(
				(t) => !isStopword(t),
			);
			let phraseProximityBonus = 0;
			if (nonStopwordQueryTerms.length >= 2) {
				const proximity = calculatePhraseProximity(
					strippedParagraph, // Use stripped paragraph for phrase matching
					nonStopwordQueryTerms,
				);
				if (proximity.isAdjacent) {
					// Strong bonus for adjacent phrase match (e.g., "wrong effort" as a phrase)
					phraseProximityBonus = 500;
				} else if (proximity.isNear) {
					// Moderate bonus for near phrase match
					phraseProximityBonus = 200;
				}
			}

			// Calculate relevance score:
			// 1. Prioritize paragraphs with more UNIQUE terms matched (not same word multiple times)
			// 2. REQUIRE non-stopword matches when query has non-stopwords - stopword-only paragraphs should NOT be selected
			// 3. Use total match count as a tiebreaker
			// 4. For multi-term queries, heavily prioritize non-stopword matches
			// 5. Strongly prioritize paragraphs with phrase proximity (terms appearing together)
			const hasOnlyStopwordMatches =
				uniqueNonStopwordTermsMatched === 0 && uniqueTermsMatched > 0;

			// Check if the query has non-stopword terms
			const queryHasNonStopwords = nonStopwordQueryTerms.length > 0;

			// If query has non-stopwords but this paragraph only matches stopwords,
			// give it a very low score so it won't be selected unless nothing else matches
			const stopwordOnlyPenalty =
				queryHasNonStopwords && hasOnlyStopwordMatches ? -10000 : 0;

			// Small bonus for paragraphs that Fuse.js also matched (validation)
			const fuseMatchBonus = paragraphMatches.length > 0 ? 5 : 0;

			const relevanceScore =
				stopwordOnlyPenalty + // CRITICAL: paragraphs without non-stopword matches are almost never selected
				phraseProximityBonus + // Phrase proximity is highest priority
				uniqueNonStopwordTermsMatched * 100 + // Non-stopword unique terms (highest priority)
				uniqueTermsMatched * 10 + // All unique terms matched
				matchCounts.exact.size * 5 + // Exact match terms
				matchCounts.startsWith * 2 + // Start/end weighted medium
				matchCounts.endsWith * 2 +
				matchCounts.fuzzy * 1 + // Fuzzy matches weighted lowest
				fuseMatchBonus; // Small bonus for Fuse.js validation

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
				bestMatchIndex = paragraphIndex;
			}
		}

		currentLength += paragraph.length + 2;
	}

	if (!bestMatch) {
		console.log("Debug: No matches found in any paragraph");
		return null;
	}

	// If the best match is a section heading, include the next paragraph too
	let snippetText = bestMatch.text;
	const isHeading = /^#{2,6}\s+/.test(snippetText.trim());
	if (
		isHeading &&
		bestMatchIndex >= 0 &&
		bestMatchIndex < paragraphs.length - 1
	) {
		const nextParagraph = paragraphs[bestMatchIndex + 1];
		// Only include if next paragraph is not too long (avoid huge snippets)
		if (nextParagraph && nextParagraph.length < 500) {
			snippetText = snippetText + "\n\n" + nextParagraph;
		}
	}

	/* console.log("Debug: Best match found:", {
            preview: bestMatch.text.slice(0, 50) + "...",
            score: bestMatch.fullPhraseMatches * 2 + bestMatch.matchCount,
            debug: bestMatch.debug,
        }); */

	// Split text into segments, preserving tooltip boundaries using updated pattern
	const segments = snippetText.split(/(\|[^|]+::[^|]+\|)/g);

	// Extract non-stopword terms for phrase matching
	const nonStopwordTerms = termsToHighlight
		.filter(
			(ht) =>
				!["doesNotStartWith", "doesNotEndWith", "negation"].includes(
					ht.operation,
				) && !isStopword(ht.term),
		)
		.map((ht) => processTermForHighlight(ht));

	// Check if there's a phrase match anywhere in the snippet (using visible text)
	const hasPhraseMatch =
		nonStopwordTerms.length >= 2
			? findPhraseMatchPositions(snippetText, nonStopwordTerms) !== null
			: false;

	// Helper function to check if a segment contains all terms near each other
	function segmentHasPhraseMatch(segmentText: string): boolean {
		if (!hasPhraseMatch || nonStopwordTerms.length < 2) return false;
		const positions = findPhraseMatchPositions(
			segmentText,
			nonStopwordTerms,
		);
		return positions !== null;
	}

	// Pre-scan segments to find which one has the phrase match
	// This ensures we highlight in the phrase segment, not the first occurrence
	let phraseSegmentIndex = -1;
	if (hasPhraseMatch) {
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			// For tooltip segments, check the visible part
			const tooltipMatch = segment.match(/^\|([^|]+)::([^|]+)\|$/);
			const textToCheck = tooltipMatch ? tooltipMatch[1] : segment;
			if (segmentHasPhraseMatch(textToCheck)) {
				phraseSegmentIndex = i;
				break;
			}
		}
	}

	// Get the actual phrase match positions if we found a phrase segment
	// This tells us exactly WHERE in the text the phrase terms appear together
	let phrasePositions: Array<{
		term: string;
		startPos: number;
		endPos: number;
	}> | null = null;
	if (phraseSegmentIndex >= 0) {
		const segment = segments[phraseSegmentIndex];
		const tooltipMatch = segment.match(/^\|([^|]+)::([^|]+)\|$/);
		const textToCheck = tooltipMatch ? tooltipMatch[1] : segment;
		phrasePositions = findPhraseMatchPositions(
			textToCheck,
			nonStopwordTerms,
		);
	}

	// Track which terms have already been highlighted (for first-match-only)
	const highlightedTerms = new Set<string>();

	// Helper to apply highlighting to text
	// When we have a phrase match in this segment, highlight the phrase terms at their specific positions
	function applyHighlighting(
		text: string,
		currentSegmentIndex: number,
	): string {
		let highlighted = text;

		// Check if this is the segment with the phrase match
		const isPhraseSeg = currentSegmentIndex === phraseSegmentIndex;

		// If this is the phrase segment and we have positions, highlight at those specific positions
		// We need to process positions in reverse order to preserve character indices
		if (isPhraseSeg && phrasePositions && phrasePositions.length > 0) {
			console.log(
				"[applyHighlighting] Processing phrase segment:",
				currentSegmentIndex,
			);
			console.log("[applyHighlighting] text:", text.substring(0, 50));
			console.log(
				"[applyHighlighting] phrasePositions:",
				phrasePositions,
			);

			const markClass = "bg-yellow-100 dark:bg-yellow-900";

			// Sort positions in reverse order (rightmost first) to preserve indices while replacing
			const sortedPositions = [...phrasePositions].sort(
				(a, b) => b.startPos - a.startPos,
			);

			for (const pos of sortedPositions) {
				const termLower = pos.term.toLowerCase();
				// Get the actual text at this position
				const actualText = text.substring(pos.startPos, pos.endPos);
				console.log(
					"[applyHighlighting] pos:",
					pos,
					"actualText:",
					actualText,
				);

				// Replace at the specific position
				highlighted =
					highlighted.substring(0, pos.startPos) +
					`<mark class="${markClass} px-1 rounded">${actualText}</mark>` +
					highlighted.substring(pos.endPos);

				console.log(
					"[applyHighlighting] highlighted after replace:",
					highlighted.substring(0, 100),
				);

				highlightedTerms.add(termLower);
			}

			// Now handle any remaining non-phrase terms that haven't been highlighted
			termsToHighlight.forEach((ht) => {
				const cleanTerm = processTermForHighlight(ht);
				const termLower = cleanTerm.toLowerCase();

				// Skip phrase terms (already handled above)
				if (nonStopwordTerms.includes(cleanTerm)) return;
				// Skip if already highlighted
				if (highlightedTerms.has(termLower)) return;

				const pattern = createHighlightPattern(cleanTerm, ht.operation);
				if (!pattern) return;

				const regex = new RegExp(pattern, "u");
				const match = highlighted.match(regex);
				if (match) {
					const matchMarkClass =
						ht.operation === "exact"
							? "bg-yellow-200 dark:bg-yellow-800"
							: "bg-yellow-100 dark:bg-yellow-900";
					highlighted = highlighted.replace(
						regex,
						(m) =>
							`<mark class="${matchMarkClass} px-1 rounded">${m}</mark>`,
					);
					highlightedTerms.add(termLower);
				}
			});

			return highlighted;
		}

		termsToHighlight.forEach((ht) => {
			const cleanTerm = processTermForHighlight(ht);
			const termLower = cleanTerm.toLowerCase();

			// Skip if this term was already highlighted in a previous segment
			if (highlightedTerms.has(termLower)) return;

			const pattern = createHighlightPattern(cleanTerm, ht.operation);
			if (!pattern) return;

			const markClass =
				ht.operation === "exact"
					? "bg-yellow-200 dark:bg-yellow-800"
					: "bg-yellow-100 dark:bg-yellow-900";

			// If there's a phrase segment found but this isn't it, skip phrase terms
			// (we want to highlight phrase terms only in the phrase segment)
			if (
				phraseSegmentIndex >= 0 &&
				nonStopwordTerms.includes(cleanTerm)
			) {
				return;
			}

			const regex = new RegExp(pattern, "u"); // Single match only
			const match = highlighted.match(regex);

			if (match) {
				highlightedTerms.add(termLower);
				highlighted = highlighted.replace(
					regex,
					(m) =>
						`<mark class="${markClass} px-1 rounded">${m}</mark>`,
				);
			}
		});
		return highlighted;
	}

	// Process each segment separately
	const processed = segments.map((segment, segmentIndex) => {
		// Handle tooltip segments: |visible text::tooltip text|
		// We should highlight matches in the visible part but not the tooltip part
		const tooltipMatch = segment.match(/^\|([^|]+)::([^|]+)\|$/);
		if (tooltipMatch) {
			const visibleText = tooltipMatch[1];
			const tooltipText = tooltipMatch[2];
			// Apply highlighting only to visible text, preserve tooltip
			const highlightedVisible = applyHighlighting(
				visibleText,
				segmentIndex,
			);
			return `|${highlightedVisible}::${tooltipText}|`;
		}

		// Regular text segment - apply highlighting
		return applyHighlighting(segment, segmentIndex);
	});

	let result = processed.join("").trim();

	// Post-process: Convert section headings (###, ####, etc.) to bold text
	result = result.replace(/^(#{2,6})\s+(.+)$/gm, "<strong>$2</strong>");

	// Post-process: Convert markdown links [text](url) to HTML links
	result = result.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" class="text-link-color hover:underline">$1</a>',
	);

	return result;
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

/**
 * Find discourses that contain the query as a whole word in their content.
 * Used to supplement Fuse.js results which may miss documents with many content matches.
 * @param query - The search query
 * @param excludeSlugs - Set of slugs to exclude (already in Fuse results)
 */
export function findContentWholeWordMatches(
	query: string,
	excludeSlugs: Set<string>,
): SearchResult[] {
	const searchData: SearchData[] = searchIndex as unknown as SearchData[];
	const queryLower = query.toLowerCase().trim();
	const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 0);

	// Find the main non-stopword term to search for
	const mainTerm = queryTerms.find((t) => !isStopword(t)) || queryTerms[0];
	if (!mainTerm || mainTerm.length < 3) return [];

	const wordBoundaryRegex = new RegExp(`\\b${mainTerm}\\b`, "i");

	return searchData
		.filter((item) => {
			if (excludeSlugs.has(item.slug)) return false;
			const content = item.content || "";
			return wordBoundaryRegex.test(content);
		})
		.map((item) => ({
			slug: item.slug,
			title: item.title,
			description: item.description,
			contentSnippet: null,
			priority: item.priority,
		}));
}

/**
 * Get full content for a discourse by slug.
 * Used for client-side term matching where contentSnippet is insufficient.
 */
export function getFullContentBySlug(slug: string): string | null {
	const searchData: SearchData[] = searchIndex as unknown as SearchData[];
	const item = searchData.find((d) => d.slug === slug);
	return item?.content ?? null;
}

/**
 * Create a map of slug -> full content for efficient lookups.
 * Returns a function that retrieves full content by slug.
 */
export function getContentLookup(): (slug: string) => string | null {
	const searchData: SearchData[] = searchIndex as unknown as SearchData[];
	const contentMap = new Map<string, string>();
	for (const item of searchData) {
		contentMap.set(item.slug, item.content);
	}
	return (slug: string) => contentMap.get(slug) ?? null;
}
