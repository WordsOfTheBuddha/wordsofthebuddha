// Use the prebuilt static index so search can run server- and client-side (offline)
import searchIndex from "../../data/searchIndex";
import {
	buildFuseQuery,
	type HighlightTerm,
} from "../../utils/fuseQueryParser";
import Fuse from "fuse.js";

export interface SearchResult {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
}

export interface SearchData {
	slug: string;
	title: string;
	description: string;
	content: string;
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

function createHighlightPattern(
	term: string,
	operation: HighlightTerm["operation"],
	context: string = "" // For startsWith/endsWith checks
): string {
	const normalized = normalizeText(term);
	const escaped = escapeRegExp(normalized);
	const diacriticPattern = escaped.replace(
		/[aeiou]/g,
		(letter) => `[${letter}\\u0100-\\u017f]`
	);

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
			return diacriticPattern; // Infix match (can be part of another word)
	}
}

function findBestMatchingParagraph(
	text: string,
	indices: [number, number][],
	highlightTerms: HighlightTerm[]
): string | null {
	const termsToHighlight = highlightTerms.filter(
		(ht) =>
			(!ht.field || ht.field === "content") &&
			!["doesNotStartWith", "doesNotEndWith", "negation"].includes(
				ht.operation
			)
	);

	const queryTerms = termsToHighlight.map((ht) =>
		processTermForHighlight(ht)
	);
	const normalizedTerms = queryTerms.map((term) =>
		normalizeText(term.toLowerCase())
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

			// Track individual term matches
			const termMatches: Record<
				string,
				{ count: number; operation: HighlightTerm["operation"] }
			> = {};
			let totalTermMatches = 0;

			normalizedTerms.forEach((term, index) => {
				const highlightTerm = termsToHighlight[index];
				const pattern = createHighlightPattern(
					term,
					highlightTerm.operation,
					normalizedParagraph
				);
				if (!pattern) return; // Skip negated terms

				let matches = 0;
				if (
					highlightTerm.operation === "startsWith" ||
					highlightTerm.operation === "endsWith"
				) {
					// For start/end, check against full paragraph
					matches = new RegExp(pattern, "iu").test(
						normalizedParagraph
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

				termMatches[queryTerms[index]] = {
					count: matches,
					operation: highlightTerm.operation,
				};

				// For exact matches, add the term to Set if there's a match
				if (highlightTerm.operation === "exact" && matches > 0) {
					matchCounts.exact.add(term);
				} else if (highlightTerm.operation !== "exact") {
					// Only increment number counters for non-exact operations
					(matchCounts[highlightTerm.operation] as number) += matches;
				}
			});

			// Weight different types of matches
			const relevanceScore =
				matchCounts.exact.size * 10 + // Number of unique exact terms matched
				matchCounts.startsWith * 3 + // Start/end weighted medium
				matchCounts.endsWith * 3 +
				matchCounts.fuzzy * 1; // Fuzzy matches weighted lowest

			const debug = {
				terms: queryTerms,
				termMatches: Object.fromEntries(
					Object.entries(termMatches).map(([key, value]) => [
						key,
						value.count,
					])
				),
				fullPhraseCount: matchCounts.exact.size,
				uniqueExactMatches: Array.from(matchCounts.exact),
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

	// Process each segment separately
	const processed = segments.map((segment) => {
		// Skip highlighting if segment is a Pāli term (matches |text::translation| pattern)
		if (/^\|[^|]+::[^|]+\|$/.test(segment)) {
			// console.log("Debug: Skipping Pāli term:", segment);
			return segment;
		}

		let highlighted = segment;
		termsToHighlight.forEach((ht) => {
			const cleanTerm = processTermForHighlight(ht);
			// Don't use word boundary for startsWith/endsWith anymore since it's handled in pattern
			const pattern = createHighlightPattern(cleanTerm, ht.operation);

			if (!pattern) return;

			highlighted = highlighted.replace(
				new RegExp(pattern, "giu"),
				(match) =>
					`<mark class="${
						ht.operation === "exact"
							? "bg-yellow-200 dark:bg-yellow-800"
							: "bg-yellow-100 dark:bg-yellow-900"
					} px-1 rounded">${match}</mark>`
			);
		});

		return highlighted;
	});

	return processed.join("").trim();
}

export async function performSearch(
	query: string,
	options: SearchOptions = {}
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
		};
		if (options.highlight && matches) {
			const contentMatches = matches?.filter((m) => m.key === "content");
			let contentSnippet = null;

			if (contentMatches?.length) {
				contentSnippet = findBestMatchingParagraph(
					item.content,
					contentMatches.flatMap((match) => match.indices),
					highlightTerms
				);
				result.contentSnippet = contentSnippet;
			}
		}

		return result;
	});
}
