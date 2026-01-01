export const prerender = false;
import type { APIRoute } from "astro";
import { performSearch as searchDiscourses } from "../../service/search/search";
import searchIndex from "../../data/searchIndex";
import { buildUnifiedContent } from "../../utils/discover-data";
import Fuse from "fuse.js";
import {
	getMatchType as getMatchTypeUtil,
	DEFAULT_SEARCH_CONFIG,
	SCORE,
	rankResultsWithDiversity,
	getNonStopwordTerms,
	getMaxAllowedEditDistance,
	allowPrefixMatch,
	allowInfixMatch,
	normalizeForComparison,
	minEditDistance,
	parseSlugPrefixes,
	slugMatchesPrefixes,
	type MatchType,
	type ScoredResult,
} from "../../utils/searchRanking";

// Helper functions
function textContainsQuery(text: string, query: string): boolean {
	return text.toLowerCase().includes(query.toLowerCase());
}

function textContainsWholeWord(text: string, query: string): boolean {
	const regex = new RegExp(`\\b${query}\\b`, "i");
	return regex.test(text);
}

// Strip annotation/gloss syntax: |visible::tooltip| → visible
function stripAnnotations(text: string): string {
	return (text || "").replace(/\|(.+?)::[^|]+\|/g, "$1");
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const query = url.searchParams.get("q") || "";
		const limit = parseInt(url.searchParams.get("limit") || "50");
		const includeCategories =
			url.searchParams.get("categories") !== "false";
		const includeDiscourses =
			url.searchParams.get("discourses") !== "false";

		if (!query.trim()) {
			return new Response(
				JSON.stringify({
					success: true,
					query: "",
					results: [],
					counts: { discourses: 0, topicsQualities: 0, similes: 0 },
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Parse slug prefix filters (e.g., "^SN12 consciousness" → filter to sn12.* slugs)
		const { prefixes: slugPrefixes, searchQuery } =
			parseSlugPrefixes(query);
		const hasSlugFilter = slugPrefixes.length > 0;

		// Use the search query (without ^prefix terms) for actual matching
		const effectiveQuery = searchQuery || query; // Fallback to original if only prefixes
		const queryLower = effectiveQuery.toLowerCase().trim();
		const queryLength = queryLower.length;

		const results: ScoredResult[] = [];
		const counts = { discourses: 0, topicsQualities: 0, similes: 0 };

		// If query is only slug prefixes with no search terms, we still need to return filtered results
		const isFilterOnly = hasSlugFilter && !searchQuery.trim();

		const maxEditDistance = getMaxAllowedEditDistance(queryLength);
		const canPrefix = allowPrefixMatch(queryLength);
		const canInfix = allowInfixMatch(queryLength);

		function getMatchType(text: string, q: string): MatchType {
			return getMatchTypeUtil(text, q, DEFAULT_SEARCH_CONFIG);
		}

		// Search categories (skip if slug filter is active - categories don't have discourse-style slugs)
		if (includeCategories && !hasSlugFilter && effectiveQuery.trim()) {
			const allCategories = buildUnifiedContent({
				include: ["topics", "qualities", "similes"],
			});
			const categoryFuse = new Fuse(allCategories, {
				keys: [
					{ name: "title", weight: 2 },
					{ name: "slug", weight: 1.5 },
					{ name: "description", weight: 1 },
					{ name: "pali", weight: 1.2 },
					{ name: "synonyms", weight: 1.3 },
				],
				threshold: 0.4,
				includeScore: true,
				ignoreLocation: true,
			});

			const categoryResults = categoryFuse.search(effectiveQuery);
			const queryNormalized = normalizeForComparison(effectiveQuery);
			const queryTerms = queryLower
				.split(/\s+/)
				.filter((t) => t.length > 0);
			const nonStopTerms = getNonStopwordTerms(effectiveQuery);
			const isMultiWord = queryTerms.length > 1;

			categoryResults.forEach((result) => {
				const item = result.item;

				const searchableFields = [
					item.title || "",
					item.slug || "",
					item.description || "",
					...(item.synonyms || []),
					...(item.pali || []),
				];
				const combinedText = searchableFields.join(" ").toLowerCase();

				// Strip annotation text before counting matches
				const cleanedText = stripAnnotations(combinedText);
				let categoryNonStopMatches = 0;
				const matchedNonStopTerms: string[] = [];
				for (const term of nonStopTerms) {
					const termLower = term.toLowerCase();
					const wordBoundaryRegex = new RegExp(
						`\\b${termLower}`,
						"i",
					);
					if (wordBoundaryRegex.test(cleanedText)) {
						categoryNonStopMatches++;
						matchedNonStopTerms.push(termLower);
					}
				}

				let bestTermTitleMatch: MatchType = "none";
				let bestTermSynonymMatch = "none";
				if (isMultiWord) {
					const titleLower = (item.title || "").toLowerCase();
					const slugLower = (item.slug || "").toLowerCase();

					for (const term of nonStopTerms) {
						const termMatch = getMatchType(titleLower, term);
						if (
							termMatch === "exact" ||
							termMatch === "word-exact"
						) {
							bestTermTitleMatch = "word-exact";
							break;
						} else if (
							termMatch === "prefix" ||
							termMatch === "word-prefix"
						) {
							if (bestTermTitleMatch === "none")
								bestTermTitleMatch = "word-prefix";
						}

						const slugMatch = getMatchType(slugLower, term);
						if (
							slugMatch === "exact" ||
							slugMatch === "word-exact"
						) {
							bestTermTitleMatch = "word-exact";
							break;
						}
					}

					if (item.synonyms) {
						for (const syn of item.synonyms) {
							for (const term of nonStopTerms) {
								const match = getMatchType(syn, term);
								if (
									match === "exact" ||
									match === "word-exact"
								) {
									bestTermSynonymMatch = "exact";
									break;
								} else if (
									match === "prefix" ||
									match === "word-prefix"
								) {
									if (bestTermSynonymMatch === "none")
										bestTermSynonymMatch = "word-prefix";
								}
							}
							if (bestTermSynonymMatch === "exact") break;
						}
					}
				}

				const titleMatch = getMatchType(item.title, queryLower);
				const slugMatch = getMatchType(item.slug, queryLower);

				const descriptionMatch = item.description
					? textContainsWholeWord(item.description, queryLower)
						? "word-exact"
						: textContainsQuery(item.description, queryLower)
							? "infix"
							: "none"
					: "none";

				const paliMatch =
					item.pali?.reduce((best: string, p: string) => {
						const pNorm = normalizeForComparison(p);
						if (pNorm === queryNormalized) return "exact";
						const paliWords = pNorm.split(/\s+/);
						if (
							paliWords.some((word) => word === queryNormalized)
						) {
							if (best !== "exact") return "exact";
						}
						if (canPrefix) {
							if (
								paliWords.some((word) =>
									word.startsWith(queryNormalized),
								)
							) {
								if (best !== "exact") return "prefix";
							}
							if (
								pNorm.startsWith(queryNormalized) &&
								best !== "exact" &&
								best !== "prefix"
							)
								return "prefix";
						}
						return best;
					}, "none") || "none";

				const synonymMatch =
					item.synonyms?.reduce((best: string, s: string) => {
						const match = getMatchType(s, queryLower);
						if (match === "exact" || match === "word-exact")
							return "exact";
						if (match === "prefix" && best !== "exact" && canPrefix)
							return "prefix";
						if (
							match === "word-prefix" &&
							best !== "exact" &&
							best !== "prefix" &&
							canPrefix
						)
							return "word-prefix";
						return best;
					}, "none") || "none";

				let crossFieldScore = 0;
				let crossFieldMatchType = "";
				if (isMultiWord && categoryNonStopMatches >= 1) {
					const titleWords = (item.title || "")
						.toLowerCase()
						.split(/[\s\-_]+/);
					const hasExactTitleTermMatch = matchedNonStopTerms.some(
						(term) => titleWords.some((word) => word === term),
					);

					if (
						categoryNonStopMatches === nonStopTerms.length &&
						nonStopTerms.length > 1
					) {
						if (hasExactTitleTermMatch) {
							crossFieldScore =
								SCORE.CATEGORY_CROSS_FIELD_WITH_TITLE_MATCH ||
								75;
							crossFieldMatchType = "cross-field-title";
						} else {
							crossFieldScore =
								SCORE.CATEGORY_CROSS_FIELD_ALL || 70;
							crossFieldMatchType = "cross-field-all";
						}
					} else if (hasExactTitleTermMatch) {
						crossFieldScore =
							SCORE.CATEGORY_CROSS_FIELD_WITH_TITLE_MATCH || 75;
						crossFieldMatchType = "cross-field-title";
					} else if (categoryNonStopMatches >= 1) {
						crossFieldScore =
							SCORE.CATEGORY_CROSS_FIELD_PARTIAL || 30;
						crossFieldMatchType = "cross-field-partial";
					}
				}

				let score = 0;
				let matchType = "fuzzy";

				if (titleMatch === "exact") {
					score = SCORE.CATEGORY_EXACT_TITLE;
					matchType = "exact";
				} else if (titleMatch === "word-exact") {
					score = SCORE.CATEGORY_WORD_EXACT_TITLE;
					matchType = "word-exact";
				} else if (slugMatch === "exact") {
					score = SCORE.CATEGORY_EXACT_SLUG;
					matchType = "exact";
				} else if (paliMatch === "exact") {
					score = SCORE.CATEGORY_EXACT_PALI;
					matchType = "exact";
				} else if (synonymMatch === "exact") {
					score = SCORE.CATEGORY_EXACT_SYNONYM;
					matchType = "exact";
				} else if (synonymMatch === "word-exact") {
					score = SCORE.CATEGORY_WORD_EXACT_SYNONYM;
					matchType = "word-exact";
				} else if (bestTermTitleMatch === "word-exact") {
					score = SCORE.CATEGORY_CROSS_FIELD_WITH_TITLE_MATCH || 75;
					matchType = "term-title-exact";
				} else if (bestTermSynonymMatch === "exact") {
					// Synonym match scores slightly lower than title match
					score =
						(SCORE.CATEGORY_CROSS_FIELD_WITH_TITLE_MATCH || 75) - 2;
					matchType = "term-synonym-exact";
				} else if (titleMatch === "prefix" && canPrefix) {
					score = SCORE.CATEGORY_PREFIX_TITLE;
					matchType = "prefix";
				} else if (slugMatch === "prefix" && canPrefix) {
					score = SCORE.CATEGORY_PREFIX_SLUG;
					matchType = "prefix";
				} else if (paliMatch === "prefix" && canPrefix) {
					score = SCORE.CATEGORY_PREFIX_PALI;
					matchType = "prefix";
				} else if (synonymMatch === "prefix" && canPrefix) {
					score = SCORE.CATEGORY_PREFIX_SYNONYM;
					matchType = "prefix";
				} else if (crossFieldScore > 0) {
					score = crossFieldScore;
					matchType = crossFieldMatchType;
				} else if (
					(titleMatch === "word-prefix" ||
						synonymMatch === "word-prefix") &&
					canPrefix
				) {
					score = SCORE.CATEGORY_WORD_PREFIX;
					matchType = "word-prefix";
				} else if (
					(titleMatch === "infix" || slugMatch === "infix") &&
					canInfix
				) {
					score = SCORE.CATEGORY_INFIX;
					matchType = "infix";
				} else if (descriptionMatch === "word-exact") {
					score = SCORE.CATEGORY_DESCRIPTION_WORD || 40;
					matchType = "description-word";
				} else if (descriptionMatch === "infix" && canInfix) {
					score = SCORE.CATEGORY_DESCRIPTION_INFIX || 28;
					matchType = "description-infix";
				} else {
					if (maxEditDistance === 0) return;
					let bestEditDist = Infinity;
					bestEditDist = Math.min(
						bestEditDist,
						minEditDistance(item.title, queryLower),
					);
					bestEditDist = Math.min(
						bestEditDist,
						minEditDistance(item.slug, queryLower),
					);
					if (item.synonyms) {
						for (const syn of item.synonyms) {
							bestEditDist = Math.min(
								bestEditDist,
								minEditDistance(syn, queryLower),
							);
						}
					}
					if (bestEditDist > maxEditDistance) return;
					if (bestEditDist === 1) {
						score = SCORE.CATEGORY_FUZZY_1;
						matchType = "fuzzy-1";
					} else if (bestEditDist === 2) {
						score = SCORE.CATEGORY_FUZZY_2;
						matchType = "fuzzy-2";
					} else {
						return;
					}
				}

				// Boost for multi-term queries when more non-stopword terms match
				if (
					isMultiWord &&
					nonStopTerms.length > 1 &&
					categoryNonStopMatches > 1
				) {
					score += (categoryNonStopMatches - 1) * 5;
				}

				if (score < SCORE.MIN_SCORE) return;

				const isSimile = item.type === "simile";
				const type: "topic-quality" | "simile" = isSimile
					? "simile"
					: "topic-quality";

				if (isSimile) {
					counts.similes++;
				} else {
					counts.topicsQualities++;
				}

				results.push({
					type,
					score,
					item,
					matchType,
					nonStopwordMatches: categoryNonStopMatches,
				});
			});
		}

		// Search discourses
		if (includeDiscourses) {
			// For filter-only queries (e.g., just "^SN12"), get all discourses from index
			// For queries with search terms, use the search function
			let discourseResults: any[];

			if (isFilterOnly) {
				// Filter-only: return all discourses that match the slug prefix
				discourseResults = (searchIndex as any[])
					.filter((item) =>
						slugMatchesPrefixes(item.slug, slugPrefixes),
					)
					.map((item) => ({
						slug: item.slug,
						title: item.title,
						description: item.description,
						contentSnippet: null,
						priority: item.priority,
					}));
			} else {
				// Normal search with query terms
				discourseResults = await searchDiscourses(effectiveQuery, {
					highlight: true,
				});
			}

			const nonStopwordTerms = getNonStopwordTerms(effectiveQuery);
			const hasMultipleTerms = queryLower.split(/\s+/).length > 1;

			discourseResults.forEach((item, index) => {
				const itemSlug = (item as any).slug || (item as any).id || "";

				// Apply slug prefix filter (for non-filter-only queries that may have both ^prefix and search terms)
				if (
					hasSlugFilter &&
					!isFilterOnly &&
					!slugMatchesPrefixes(itemSlug, slugPrefixes)
				) {
					return; // Skip items that don't match the prefix filter
				}

				const titleMatch = getMatchType(item.title || "", queryLower);
				const idMatch = getMatchType(itemSlug, queryLower);

				let termTitleMatch: MatchType = "none";
				if (hasMultipleTerms && nonStopwordTerms.length > 0) {
					const titleLower = (item.title || "").toLowerCase();
					for (const term of nonStopwordTerms) {
						const termMatch = getMatchType(titleLower, term);
						if (
							termMatch === "exact" ||
							termMatch === "word-exact"
						) {
							termTitleMatch = "word-exact";
							break;
						} else if (
							(termMatch === "prefix" ||
								termMatch === "word-prefix") &&
							termTitleMatch === "none"
						) {
							termTitleMatch = "word-prefix";
						}
					}
				}

				const descriptionContains = textContainsQuery(
					item.description || "",
					queryLower,
				);
				const contentContains = item.contentSnippet
					? textContainsQuery(item.contentSnippet, queryLower)
					: false;
				const hasContentMatch = descriptionContains || contentContains;

				const descriptionWholeWord = textContainsWholeWord(
					item.description || "",
					queryLower,
				);
				const contentWholeWord = item.contentSnippet
					? textContainsWholeWord(item.contentSnippet, queryLower)
					: false;
				const hasWholeWordMatch =
					descriptionWholeWord || contentWholeWord;

				// Count non-stopword term matches for multi-term queries
				// Strip annotation text (|visible::tooltip|) before counting
				let nonStopwordMatches = 0;
				if (hasMultipleTerms && nonStopwordTerms.length > 0) {
					const rawText = `${item.title || ""} ${item.description || ""} ${item.contentSnippet || ""}`;
					const combinedText =
						stripAnnotations(rawText).toLowerCase();
					nonStopwordMatches = nonStopwordTerms.filter((term) => {
						// Word boundary at start (prefix match: experience matches experiences)
						const wordPrefixRegex = new RegExp(
							`\\b${term.toLowerCase()}`,
							"i",
						);
						return wordPrefixRegex.test(combinedText);
					}).length;
				}

				const allNonStopTermsFound =
					nonStopwordMatches === nonStopwordTerms.length;
				const priority = (item as any).priority ?? 1;

				let score: number;
				let matchType = "content";

				// For filter-only queries, assign a base score based on priority
				if (isFilterOnly) {
					score = SCORE.DISCOURSE_PREFIX_TITLE || 80; // Base score for filtered results
					matchType = "slug-filter";
				} else if (titleMatch === "exact" || idMatch === "exact") {
					score = SCORE.DISCOURSE_EXACT_TITLE;
					matchType = "exact";
				} else if (titleMatch === "word-exact") {
					score = SCORE.DISCOURSE_WORD_EXACT_TITLE;
					matchType = "word-exact";
				} else if (
					(titleMatch === "prefix" || idMatch === "prefix") &&
					canPrefix
				) {
					score = SCORE.DISCOURSE_PREFIX_TITLE;
					matchType = "prefix";
				} else if (titleMatch === "word-prefix" && canPrefix) {
					score = SCORE.DISCOURSE_WORD_PREFIX;
					matchType = "word-prefix";
				} else if (
					(termTitleMatch === "word-exact" ||
						termTitleMatch === "word-prefix") &&
					allNonStopTermsFound
				) {
					score = SCORE.DISCOURSE_TERM_TITLE_MATCH;
					matchType = "term-title-match";
				} else if (titleMatch === "infix" && canInfix) {
					score = hasContentMatch
						? SCORE.DISCOURSE_INFIX_WITH_CONTENT
						: SCORE.DISCOURSE_INFIX_NO_CONTENT;
					matchType = "infix";
				} else if (hasWholeWordMatch) {
					score = Math.max(
						SCORE.DISCOURSE_CONTENT_WHOLE_WORD_MIN,
						SCORE.DISCOURSE_CONTENT_WHOLE_WORD_BASE - index * 0.5,
					);
					matchType = "content-whole-word";
				} else if (hasContentMatch) {
					score = Math.max(
						SCORE.DISCOURSE_CONTENT_EXACT_MIN,
						SCORE.DISCOURSE_CONTENT_EXACT_BASE - index * 0.5,
					);
					matchType = "content-substring";
				} else {
					if (maxEditDistance === 0) return;
					score = Math.max(
						SCORE.DISCOURSE_CONTENT_FUZZY_MIN,
						SCORE.DISCOURSE_CONTENT_FUZZY_BASE - index * 0.5,
					);
					matchType = "content-fuzzy";
				}

				// Boost for multi-term queries when non-stopword terms match
				if (
					hasMultipleTerms &&
					nonStopwordTerms.length > 1 &&
					nonStopwordMatches > 0
				) {
					// If ALL non-stopword terms are found, big boost to 70-75 range
					if (allNonStopTermsFound) {
						// Ensure score is at least 70 (like CATEGORY_CROSS_FIELD_ALL)
						score = Math.max(
							score,
							70 + (nonStopwordMatches - 2) * 2,
						);
					} else if (nonStopwordMatches > 1) {
						// Partial match: smaller boost
						score += (nonStopwordMatches - 1) * 5;
					}
				}

				if (score < SCORE.MIN_SCORE) return;

				counts.discourses++;

				results.push({
					type: "discourse",
					score,
					item,
					matchType,
					priority,
					nonStopwordMatches,
				});
			});
		}

		// Apply diversity ranking
		const rankedResults = rankResultsWithDiversity(results);

		// Format response
		const formattedResults = rankedResults.slice(0, limit).map((r, i) => ({
			rank: i + 1,
			type: r.type,
			slug: r.item.slug || r.item.id,
			title: r.item.title || r.item.name,
			description: r.item.description?.substring(0, 200),
			pali: r.item.pali,
			synonyms: r.item.synonyms,
			contentSnippet: r.item.contentSnippet?.substring(0, 200),
			score: r.score,
			matchType: r.matchType,
			priority: r.priority || 1,
			nonStopwordMatches: r.nonStopwordMatches || 0,
		}));

		return new Response(
			JSON.stringify({
				success: true,
				query,
				results: formattedResults,
				counts,
				total: rankedResults.length,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("Error in /api/search:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Internal server error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
};
