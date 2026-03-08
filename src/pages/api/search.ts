export const prerender = false;
import type { APIRoute } from "astro";
import { performSearch as searchDiscourses } from "../../service/search/search";
import searchIndex from "../../data/searchIndex";

// Pre-build slug→doc map for O(1) lookups (avoids O(n) .find() per discourse result)
const searchIndexBySlug = new Map(
	(searchIndex as any[]).map((doc) => [doc.slug, doc]),
);
import { buildUnifiedContent } from "../../utils/discover-data";

// Cache category data and Fuse index at module level (data is static JSON)
let cachedAllCategories: ReturnType<typeof buildUnifiedContent> | null = null;
let cachedCategoryFuse: Fuse<ReturnType<typeof buildUnifiedContent>[number]> | null = null;

function getCategoryFuse() {
	if (!cachedCategoryFuse) {
		cachedAllCategories = buildUnifiedContent({
			include: ["topics", "qualities", "similes"],
		});
		cachedCategoryFuse = new Fuse(cachedAllCategories, {
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
	}
	return { allCategories: cachedAllCategories!, categoryFuse: cachedCategoryFuse };
}
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
	stripAnnotations,
	countTermMatches,
	countTermMatchesWithQuality,
	getTitleCoverageRatio,
	applyMultiTermBoost,
	textContainsQuery,
	textContainsWholeWord,
	textContainsPaliWholeWord,
	countWholeWordOccurrences,
	countPaliWholeWordOccurrences,
	getPaliMatchType,
	slugMatchesQuery,
	isStopword,
	calculatePhraseProximityBoost,
	type MatchType,
	type ScoredResult,
} from "../../utils/searchRanking";

// Deduplicate topics/qualities that share the same primary pali term
// Also deduplicate discourses by slug (in case of Fuse/supplemental overlap)
// Keeps the result with the higher score
function deduplicateByPali(results: ScoredResult[]): ScoredResult[] {
	// Deduplicate discourses by slug (keep highest scoring)
	const discourseMap = new Map<string, ScoredResult>();
	for (const r of results.filter((r) => r.type === "discourse")) {
		const slug = r.item.slug || r.item.id || "";
		const existing = discourseMap.get(slug);
		if (!existing || r.score > existing.score) {
			discourseMap.set(slug, r);
		}
	}
	const discourses = Array.from(discourseMap.values());

	const categories = results.filter(
		(r) => r.type === "topic-quality" || r.type === "simile",
	);

	// Group categories by their first/primary pali term (normalized)
	const paliGroups = new Map<string, ScoredResult[]>();
	const noPaliItems: ScoredResult[] = [];

	for (const item of categories) {
		const paliTerms = item.item.pali || [];
		if (paliTerms.length === 0) {
			noPaliItems.push(item);
			continue;
		}

		// Get the primary pali term (first one, normalized, split by comma)
		const firstPali = paliTerms[0];
		const primaryTerm = normalizeForComparison(
			firstPali.split(/[,\s]+/)[0],
		);

		if (!paliGroups.has(primaryTerm)) {
			paliGroups.set(primaryTerm, []);
		}
		paliGroups.get(primaryTerm)!.push(item);
	}

	// For each group, keep only the highest-scoring item
	const dedupedCategories: ScoredResult[] = [];
	for (const [_, group] of paliGroups) {
		if (group.length === 1) {
			dedupedCategories.push(group[0]);
		} else {
			// Sort by score descending and keep the best one
			group.sort((a, b) => b.score - a.score);
			dedupedCategories.push(group[0]);
		}
	}

	// Add items with no pali terms
	dedupedCategories.push(...noPaliItems);

	// Return discourses + deduplicated categories
	return [...discourses, ...dedupedCategories];
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const t0 = performance.now();
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

		const tParse = performance.now();

		// Search categories (skip if slug filter is active - categories don't have discourse-style slugs)
		if (includeCategories && !hasSlugFilter && effectiveQuery.trim()) {
			const { allCategories, categoryFuse } = getCategoryFuse();

			// For category search, use only non-stopword terms if there are stopwords in the query
			// This ensures "craving that" still finds "Craving" (since "that" is a stopword)
			const categoryNonStopTerms = getNonStopwordTerms(effectiveQuery);
			const categorySearchQuery =
				categoryNonStopTerms.length > 0 &&
				categoryNonStopTerms.length <
					effectiveQuery.trim().split(/\s+/).length
					? categoryNonStopTerms.join(" ")
					: effectiveQuery;
			const categoryResults = categoryFuse.search(categorySearchQuery);
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
				// Track synonym position for term-level matches (used as tie-breaker)
				let termSynonymMatchPosition: number | undefined = undefined;
				// Track if a term is an EXACT match for the ENTIRE title (not just word-exact)
				// This handles "craving that" where "craving" exactly matches title "Craving"
				let hasTermExactTitleMatch = false;
				if (isMultiWord) {
					const titleLower = (item.title || "").toLowerCase();
					const slugLower = (item.slug || "").toLowerCase();

					for (const term of nonStopTerms) {
						const termMatch = getMatchType(titleLower, term);
						if (termMatch === "exact") {
							// Term exactly matches the entire title
							hasTermExactTitleMatch = true;
							bestTermTitleMatch = "word-exact";
							break;
						} else if (termMatch === "word-exact") {
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
						if (slugMatch === "exact") {
							hasTermExactTitleMatch = true;
							bestTermTitleMatch = "word-exact";
							break;
						} else if (slugMatch === "word-exact") {
							bestTermTitleMatch = "word-exact";
							break;
						}
					}

					if (item.synonyms) {
						console.log(
							`[DEBUG] Checking ${item.title} synonyms, nonStopTerms:`,
							nonStopTerms,
						);
						for (
							let synIdx = 0;
							synIdx < item.synonyms.length;
							synIdx++
						) {
							const syn = item.synonyms[synIdx];
							for (const term of nonStopTerms) {
								const match = getMatchType(syn, term);
								if (
									match === "exact" ||
									match === "word-exact"
								) {
									bestTermSynonymMatch = "exact";
									// Track synonym position for term-level matches (for tie-breaking)
									if (
										termSynonymMatchPosition === undefined
									) {
										termSynonymMatchPosition = synIdx;
									}
									break;
								} else if (
									match === "prefix" ||
									match === "word-prefix"
								) {
									if (bestTermSynonymMatch === "none")
										bestTermSynonymMatch = "word-prefix";
									// Track synonym position for term-level matches
									if (
										termSynonymMatchPosition === undefined
									) {
										termSynonymMatchPosition = synIdx;
									}
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
						// Split by whitespace AND commas to handle "taṇha, abhijjhā" format
						const paliWords = pNorm
							.split(/[\s,]+/)
							.filter((w) => w.length > 0);
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

				// Track synonym match and its position (index in the synonyms array)
				let synonymMatch = "none";
				let synonymMatchPosition: number | undefined = undefined;
				if (item.synonyms) {
					for (let i = 0; i < item.synonyms.length; i++) {
						const s = item.synonyms[i];
						const match = getMatchType(s, queryLower);
						if (match === "exact" || match === "word-exact") {
							synonymMatch = "exact";
							synonymMatchPosition = i;
							break; // Best possible match, stop searching
						}
						if (
							match === "prefix" &&
							synonymMatch !== "exact" &&
							canPrefix
						) {
							synonymMatch = "prefix";
							if (synonymMatchPosition === undefined)
								synonymMatchPosition = i;
						}
						if (
							match === "word-prefix" &&
							synonymMatch !== "exact" &&
							synonymMatch !== "prefix" &&
							canPrefix
						) {
							synonymMatch = "word-prefix";
							if (synonymMatchPosition === undefined)
								synonymMatchPosition = i;
						}
					}
				}

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
					// If a term exactly matches the full title, score it like an exact title match
					// This handles "craving that" where "craving" exactly matches title "Craving"
					if (hasTermExactTitleMatch) {
						score = SCORE.CATEGORY_EXACT_TITLE;
						matchType = "term-title-exact";
					} else {
						score =
							SCORE.CATEGORY_CROSS_FIELD_WITH_TITLE_MATCH || 75;
						matchType = "term-title-exact";
					}
				} else if (bestTermSynonymMatch === "exact") {
					// Synonym exact match - slightly below description match
					// since synonyms tell what the concept IS (like description tells what discourse is ABOUT)
					score = 75;
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

				// Apply phrase proximity boost for multi-word queries
				// This rewards categories where the query phrase appears intact in title/description/synonyms
				if (isMultiWord && nonStopTerms.length >= 2) {
					// Check each synonym individually for phrase proximity
					// (don't join them - that could create false matches across synonyms)
					let bestSynonymPhraseBoost = 0;
					for (const synonym of item.synonyms || []) {
						const synBoost = calculatePhraseProximityBoost(
							"", // no title
							synonym, // treat synonym as description (gets 1.3x multiplier)
							"", // no content
							nonStopTerms,
						);
						if (synBoost.boost > bestSynonymPhraseBoost) {
							bestSynonymPhraseBoost = synBoost.boost;
						}
					}

					// Check title and description separately
					const phraseBoost = calculatePhraseProximityBoost(
						item.title || "",
						item.description || "",
						"", // don't pass synonyms as content anymore
						nonStopTerms,
					);

					// Use the best boost from synonyms or title/description
					const totalPhraseBoost = Math.max(
						phraseBoost.boost,
						bestSynonymPhraseBoost,
					);
					if (totalPhraseBoost > 0) {
						score += totalPhraseBoost;
						// Update match type to indicate phrase match
						if (phraseBoost.titleMatch && matchType !== "exact") {
							matchType = "phrase-title";
						} else if (phraseBoost.descriptionMatch) {
							matchType = "phrase-description";
						} else if (bestSynonymPhraseBoost > 0) {
							matchType = "phrase-synonym";
						}
					}
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
					// Use term-level synonym position if full-query synonym position not set
					synonymMatchPosition:
						synonymMatchPosition ?? termSynonymMatchPosition,
				});
			});
		}

		const tCategories = performance.now();

		// Search discourses
		let tDiscFuse = tCategories; // will be updated after Fuse search
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
				// Pass full query so slug prefix (e.g. ^AN) is in the search and OR counts are correct
				discourseResults = await searchDiscourses(query.trim(), {
					highlight: true,
				});
			}

			tDiscFuse = performance.now();

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
				// Check both raw slug match and normalized slug match (handles "mn 38" → "mn38")
				const rawIdMatch = getMatchType(itemSlug, queryLower);
				const normalizedSlugMatch = slugMatchesQuery(
					itemSlug,
					queryLower,
				);
				// Use the better of the two matches
				const idMatch: MatchType =
					normalizedSlugMatch === "exact"
						? "exact"
						: normalizedSlugMatch === "prefix"
							? "prefix"
							: rawIdMatch;

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

				// Look up full content from search index (used for multi-term matching and occurrence counting)
				const indexedDoc = searchIndexBySlug.get(itemSlug);
				const fullContent = indexedDoc?.content || "";
				const fullContentPali = indexedDoc?.contentPali || "";

				// Check content for whole word match using the raw indexed text
				// (not the snippet, which has <mark> HTML tags that create false word boundaries)
				const contentWholeWord = textContainsWholeWord(
					fullContent || item.contentSnippet?.replace(/<[^>]*>/g, "") || "",
					queryLower,
				);
				const paliWholeWord = fullContentPali
					? textContainsPaliWholeWord(fullContentPali, queryLower)
					: false;
				const hasWholeWordMatch =
					descriptionWholeWord || contentWholeWord || paliWholeWord;

				// Count non-stopword term matches for multi-term queries
				// Use FULL indexed content (from searchIndex), stripped of annotation text
				// Also include Pali content so Pali terms get counted for multi-term boost
				let nonStopwordMatches = 0;
				let visibleAreaMatches = 0; // Matches in title + description + snippet (what user sees)
				let termMatchScore = 0; // Quality-weighted score (exact > prefix > infix)
				let visibleTermMatchScore = 0;

				if (hasMultipleTerms && nonStopwordTerms.length > 0) {
					// English text only — standard diacritic-normalised matching
					const englishText = `${item.title || ""} ${item.description || ""} ${fullContent}`;
					const visibleText = `${item.title || ""} ${item.description || ""} ${item.contentSnippet || ""}`;

					// Use quality-aware term matching (exact > prefix > infix)
					const fullMatch = countTermMatchesWithQuality(
						englishText,
						nonStopwordTerms,
					);
					const visibleMatch = countTermMatchesWithQuality(
						visibleText,
						nonStopwordTerms,
					);

					let adjustedCount = fullMatch.count;
					let adjustedScore = fullMatch.score;
					let visibleAdjustedCount = visibleMatch.count;
					let visibleAdjustedScore = visibleMatch.score;

					// Pali stem-aware fallback: for any term not matched in English text,
					// check Pali content using textContainsPaliWholeWord which allows final
					// vowel variation (a→o, i, u, e) to handle declension differences.
					// This only touches fullContentPali, so English ranking is unaffected.
					if (fullContentPali && adjustedCount < nonStopwordTerms.length) {
						for (let ti = 0; ti < nonStopwordTerms.length; ti++) {
							if (fullMatch.qualities[ti] !== "none") continue;
							if (textContainsPaliWholeWord(fullContentPali, nonStopwordTerms[ti])) {
								adjustedCount++;
								adjustedScore += 0.8; // treat as prefix quality
							}
						}
					}

					// Same fallback for the visible-area count (snippet may be Pali)
					if (visibleAdjustedCount < nonStopwordTerms.length) {
						const snippetPali = item.contentSnippet?.replace(/<[^>]*>/g, "") || "";
						if (snippetPali) {
							for (let ti = 0; ti < nonStopwordTerms.length; ti++) {
								if (visibleMatch.qualities[ti] !== "none") continue;
								if (textContainsPaliWholeWord(snippetPali, nonStopwordTerms[ti])) {
									visibleAdjustedCount++;
									visibleAdjustedScore += 0.8;
								}
							}
						}
					}

					nonStopwordMatches = adjustedCount;
					visibleAreaMatches = visibleAdjustedCount;
					termMatchScore = adjustedScore;
					visibleTermMatchScore = visibleAdjustedScore;
				}

				const allNonStopTermsFound =
					nonStopwordMatches === nonStopwordTerms.length;
				const allTermsInVisibleArea =
					visibleAreaMatches === nonStopwordTerms.length;
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
				} else if (descriptionWholeWord) {
					// Description match ranks higher than term-title-match - it tells what the discourse is ABOUT
					score = SCORE.DISCOURSE_DESCRIPTION_WHOLE_WORD;
					matchType = "description-whole-word";
					// Add minor content occurrence boost as tiebreaker
					const contentOccurrences = countWholeWordOccurrences(
						fullContent,
						queryLower,
					);
					if (contentOccurrences >= 2) {
						score += Math.min(1, contentOccurrences * 0.1); // Up to +1 for content matches
					}
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
				// Pali compound title infixes (e.g. "Pañcapubbanimitta" for query "animitta")
				// without an English whole-word content match are low-quality matches —
				// cap below content-whole-word-min so genuine whole-word matches rank higher
				if (hasContentMatch && !contentWholeWord && !descriptionWholeWord) {
					score = Math.min(score, SCORE.DISCOURSE_CONTENT_WHOLE_WORD_MIN - 3);
				}
				} else if (descriptionContains && canInfix) {
					// Description substring match
					score = SCORE.DISCOURSE_DESCRIPTION_INFIX;
					matchType = "description-infix";
				} else if (contentWholeWord || paliWholeWord) {
					// Content whole word match - count occurrences for relevance boost
					// Use Pali-aware counting for contentPali (handles inflectional endings)
					const englishOccurrences = countWholeWordOccurrences(fullContent, queryLower);
					const paliOccurrences = fullContentPali
						? countPaliWholeWordOccurrences(fullContentPali, queryLower)
						: 0;
					const occurrences = englishOccurrences + paliOccurrences;
					// Tiered occurrence boost - high occurrence count indicates significant topic
					// 1 occurrence: 0, 2-3: +3, 4-6: +8, 7-10: +15, 11+: +20
					// NOTE: For multi-term queries, this boost will be reduced by scattered penalty
					// if terms don't appear near each other
					let occurrenceBoost = 0;
					if (occurrences >= 11) {
						occurrenceBoost = 20;
					} else if (occurrences >= 7) {
						occurrenceBoost = 15;
					} else if (occurrences >= 4) {
						occurrenceBoost = 8;
					} else if (occurrences >= 2) {
						occurrenceBoost = 3;
					}
					// Content-whole-word should never exceed description-whole-word base score.
					// Occurrence boost differentiates within content results.
					const contentCap = SCORE.DISCOURSE_DESCRIPTION_WHOLE_WORD - 1;
					score = Math.min(
						contentCap,
						Math.max(
							SCORE.DISCOURSE_CONTENT_WHOLE_WORD_MIN,
							SCORE.DISCOURSE_CONTENT_WHOLE_WORD_BASE +
								occurrenceBoost,
						),
					);
					matchType = "content-whole-word";
				} else if (hasMultipleTerms && allNonStopTermsFound) {
					// Multi-term query with all non-stopword terms found in content
					// Base score depends on phrase proximity
					score = SCORE.DISCOURSE_CONTENT_WHOLE_WORD_BASE;
					matchType = "multi-term-content";
			} else if (contentContains) {
				// Content substring match — differentiate Pali prefix vs infix
				score = SCORE.DISCOURSE_CONTENT_EXACT_BASE;
				matchType = "content-substring";

				if (fullContentPali) {
					const paliQuality = getPaliMatchType(fullContentPali, queryLower);
					if (paliQuality === "prefix") {
						score += 3;
						matchType = "content-prefix";
					} else if (paliQuality === "infix") {
						score -= 3;
						matchType = "content-infix";
					}
				}
				} else {
					if (maxEditDistance === 0) return;
					score = SCORE.DISCOURSE_CONTENT_FUZZY_BASE;
					matchType = "content-fuzzy";
				}

				// Apply multi-term boost using shared function
				if (hasMultipleTerms) {
					// Calculate phrase proximity boost - terms appearing close together in order
					// helps queries like "exhaust craving" rank results with those words adjacent
					// Include Pali content so Pali phrases like "akuppā cetovimutti" get proximity boost
					const phraseBoost = calculatePhraseProximityBoost(
						item.title,
						item.description,
						`${fullContent} ${fullContentPali}`,
						nonStopwordTerms,
					);

					score = applyMultiTermBoost({
						score,
						matchType,
						nonStopwordTerms,
						nonStopwordMatches,
						termMatchScore,
						visibleAreaMatches,
						visibleTermMatchScore,
						phraseProximityBoost: phraseBoost.boost,
						hasAnyProximity: phraseBoost.hasAnyProximity,
					});

					// Penalize results that only match stopwords when query has non-stopwords
					// e.g., "craving in" - if result only matches "in", penalize it
					if (
						nonStopwordTerms.length > 0 &&
						nonStopwordMatches === 0
					) {
						score -= 15; // Heavy penalty for stopword-only matches
					}
				}

				// Title coverage boost for title matches
				// "Suffering" (100% coverage) should rank above "Destined for Suffering" (33%)
				if (titleMatch !== "none" && titleMatch !== "infix") {
					const titleCoverage = getTitleCoverageRatio(
						item.title || "",
						queryLower,
					);
					// Add up to 3 points for high title coverage
					score += titleCoverage * 3;
				}

				// Cross-field bonus: query found in multiple fields signals stronger relevance
				let fieldHits = 0;
				{
					if (titleMatch !== "none") fieldHits++;
					if (descriptionWholeWord || descriptionContains) fieldHits++;
					if (contentWholeWord || paliWholeWord) fieldHits++;
					// For multi-term queries, also check per-term field presence.
					// e.g. "dependent origination" — "dependent" appears in SN 12.1's title
					// even though the full phrase doesn't.
					if (hasMultipleTerms && fieldHits < 2) {
						const titleStr = (item.title || "").toLowerCase();
						const descStr = (item.description || "").toLowerCase();
						let titleTermHit = fieldHits > 0 && titleMatch !== "none";
						let descTermHit = fieldHits > 0 && (descriptionWholeWord || descriptionContains);
						for (const term of nonStopwordTerms) {
							if (!titleTermHit && textContainsWholeWord(titleStr, term)) titleTermHit = true;
							if (!descTermHit && textContainsWholeWord(descStr, term)) descTermHit = true;
							if (titleTermHit && descTermHit) break;
						}
						fieldHits = 0;
						if (titleTermHit) fieldHits++;
						if (descTermHit) fieldHits++;
						if (contentWholeWord || paliWholeWord) fieldHits++;
					}
					if (fieldHits >= 2) {
						// Multi-term queries get a larger bonus: per-term field presence
						// is a strong relevance signal. Single-term gets +2 baseline since
						// a title word naturally appears in description/content too.
						score += hasMultipleTerms ? 4 : 2;
					}
				}

				// Apply priority as additive boost (not multiplicative)
				// Priority ranges from 1 to 3, so boost is 0 to 6 points
				// Content-only matches get half the priority boost — priority should
				// differentiate within a match tier, not jump content above description
				const isContentOnly = fieldHits === 1 && (contentWholeWord || paliWholeWord);
				const priorityMultiplier = isContentOnly ? 1.5 : 3;
				score = score + (priority - 1) * priorityMultiplier;

				if (score < SCORE.MIN_SCORE) return;

				counts.discourses++;

				results.push({
					type: "discourse",
					score,
					item,
					matchType,
					priority,
					nonStopwordMatches,
					// Include contentSnippet at top level for snippet similarity detection
					contentSnippet: item.contentSnippet,
				});
			});
		}

		const tDiscourses = performance.now();

		// Discourse sub-phase timing
		const discFuseMs = Math.round(tDiscFuse - tCategories);
		const discScoringMs = Math.round(tDiscourses - tDiscFuse);

		// Deduplicate topics/qualities that share the same primary pali term
		// This handles cases like "Jhana" (topic) and "Collectedness" (quality)
		// which both have "jhāna" as their primary pali term
		const deduplicatedResults = deduplicateByPali(results);

		// Apply diversity ranking
		const rankedResults = rankResultsWithDiversity(
			deduplicatedResults,
			undefined,
		);

		const tRanking = performance.now();

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
			synonymMatchPosition: r.synonymMatchPosition,
		}));

		const tFormat = performance.now();

		// Build timing data
		const timing: Record<string, number> = {
			parse: Math.round(tParse - t0),
			categories: Math.round(tCategories - tParse),
			discourses: Math.round(tDiscourses - tCategories),
			discFuse: discFuseMs,
			discScoring: discScoringMs,
			ranking: Math.round(tRanking - tDiscourses),
			format: Math.round(tFormat - tRanking),
			total: Math.round(tFormat - t0),
		};
		console.log(
			`[search-perf] q=${JSON.stringify(query)} | parse=${timing.parse}ms categories=${timing.categories}ms discourses=${timing.discourses}ms (fuse=${discFuseMs}ms scoring=${discScoringMs}ms) ranking=${timing.ranking}ms format=${timing.format}ms TOTAL=${timing.total}ms`,
		);

		const serverTiming = Object.entries(timing)
			.map(([k, v]) => `${k};dur=${v}`)
			.join(", ");

		return new Response(
			JSON.stringify({
				success: true,
				query,
				results: formattedResults,
				counts,
				total: rankedResults.length,
				timing,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Server-Timing": serverTiming,
				},
			},
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
