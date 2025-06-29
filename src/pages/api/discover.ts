export const prerender = false;
import type { APIRoute } from "astro";
import topicMappings from "../../data/topicMappings.json";
import qualityMappings from "../../data/qualityMappings.json";
import simileMappings from "../../data/simileMappings.json";
import qualities from "../../data/qualities.json";
import { toChicagoTitleCase } from "../../utils/toChicagoTitleCase";

interface UnifiedContentItem {
	id: string;
	slug: string;
	type: "topic" | "quality" | "simile";
	title: string;
	description?: string;
	synonyms?: string[];
	pali?: string[];
	redirects?: string[];
	qualityType?: "positive" | "negative" | "neutral";
	related?: string[];
	discourses: Array<{
		id: string;
		title: string;
		description: string;
		collection: string;
		note?: string;
	}>;
}

function getQualityType(
	qualitySlug: string,
): "positive" | "negative" | "neutral" {
	if (qualities.positive.includes(qualitySlug)) return "positive";
	if (qualities.negative.includes(qualitySlug)) return "negative";
	if (qualities.neutral.includes(qualitySlug)) return "neutral";
	return "neutral"; // default
}

function getQualitySynonyms(qualitySlug: string): string[] {
	const synonymsData = qualities.synonyms as any;
	if (synonymsData[qualitySlug]) {
		return synonymsData[qualitySlug].filter(
			(s: string) =>
				!s.startsWith("[") &&
				!s.startsWith("Related:") &&
				!s.startsWith("Context:"),
		);
	}
	return [];
}

function getQualityPali(qualitySlug: string): string[] {
	const synonymsData = qualities.synonyms as any;
	if (synonymsData[qualitySlug]) {
		return synonymsData[qualitySlug]
			.filter((s: string) => s.startsWith("["))
			.map((s: string) => s.slice(1, -1));
	}
	return [];
}

function getQualityContext(qualitySlug: string): string | undefined {
	const synonymsData = qualities.synonyms as any;
	if (synonymsData[qualitySlug]) {
		const contextItem = synonymsData[qualitySlug].find((s: string) =>
			s.startsWith("Context:"),
		);
		return contextItem ? contextItem.replace("Context: ", "") : undefined;
	}
	return undefined;
}

function getQualityRelated(qualitySlug: string): string[] {
	const synonymsData = qualities.synonyms as any;
	if (synonymsData[qualitySlug]) {
		const relatedItem = synonymsData[qualitySlug].find((s: string) =>
			s.startsWith("Related:"),
		);
		if (relatedItem) {
			const relatedString = relatedItem
				.replace("Related:", "")
				.replace(/[{}]/g, "");
			return relatedString
				.split(",")
				.map((s: string) => s.trim())
				.filter((s: string) => s.length > 0);
		}
	}
	return [];
}

// Helper function to create content items with conditional description
function createContentItem(
	base: Omit<UnifiedContentItem, "description">,
	description?: string,
): UnifiedContentItem {
	const item: UnifiedContentItem = { ...base };
	if (description && description.trim()) {
		item.description = description;
	}
	return item;
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const byParam =
			url.searchParams.get("by") || "topics,qualities,similes";
		const filterParam = url.searchParams.get("filter") || "";
		const requestedTypes = byParam.split(",").map((t) => t.trim());

		console.log("API Debug:", {
			byParam,
			filterParam,
			requestedTypes,
			fullUrl: url,
			searchParams: url.search,
		});

		let allContent: UnifiedContentItem[] = [];

		// Add topics if requested
		if (requestedTypes.includes("topics")) {
			Object.entries(topicMappings).forEach(([slug, topic]) => {
				allContent.push(
					createContentItem(
						{
							id: slug,
							slug: slug,
							type: "topic",
							title: topic.title,
							synonyms: topic.synonyms,
							pali: topic.pali,
							redirects: topic.redirects,
							discourses: topic.discourses,
						},
						topic.description,
					),
				);
			});
		}

		// Add qualities if requested
		if (requestedTypes.includes("qualities")) {
			Object.entries(qualityMappings as any).forEach(
				([slug, discourses]) => {
					const discoursesArray = discourses as any[];
					// Convert quality slug to title format
					const title = slug
						.split("-")
						.map(
							(word) =>
								word.charAt(0).toUpperCase() + word.slice(1),
						)
						.join(" ");

					const qualityType = getQualityType(slug);
					const synonyms = getQualitySynonyms(slug);
					const pali = getQualityPali(slug);
					const context = getQualityContext(slug);
					const related = getQualityRelated(slug);

					allContent.push(
						createContentItem(
							{
								id: slug,
								slug: slug,
								type: "quality",
								title: title,
								qualityType: qualityType,
								synonyms: synonyms,
								pali: pali,
								related: related,
								discourses: discoursesArray.map((d) => ({
									id: d.id,
									title: d.title,
									description: d.description,
									collection: d.collection,
								})),
							},
							context || "", // Use context as description if available
						),
					);
				},
			);
		}

		// Add similes if requested
		if (requestedTypes.includes("similes")) {
			Object.entries(simileMappings as any).forEach(
				([letter, simileGroup]) => {
					Object.entries(simileGroup as any).forEach(
						([slug, discourses]) => {
							const discoursesArray = discourses as any[];
							const title = toChicagoTitleCase(
								slug.split("-").join(" "),
							);

							allContent.push(
								createContentItem({
									id: slug,
									slug: slug,
									type: "simile",
									title: title,
									discourses: discoursesArray.map((d) => ({
										id: d.id,
										title: d.title,
										description: d.description,
										collection: d.collection,
									})),
								}),
							); // No description for similes
						},
					);
				},
			);
		}

		// Apply search filter if provided
		if (filterParam) {
			const filterLower = filterParam.toLowerCase();

			allContent = allContent
				.map((item) => {
					// Check if the match is at item level (topic/quality/simile level)
					const itemLevelMatch =
						item.title.toLowerCase().includes(filterLower) ||
						(item.description &&
							item.description
								.toLowerCase()
								.includes(filterLower)) ||
						(item.synonyms &&
							item.synonyms.some((s) =>
								s.toLowerCase().includes(filterLower),
							)) ||
						(item.pali &&
							item.pali.some((p) =>
								p.toLowerCase().includes(filterLower),
							)) ||
						(item.redirects &&
							item.redirects.some((r) =>
								r.toLowerCase().includes(filterLower),
							)) ||
						(item.related &&
							item.related.some((r) =>
								r.toLowerCase().includes(filterLower),
							));

					if (itemLevelMatch) {
						// Item-level match: return the item with ALL discourses
						return item;
					}

					// Check for discourse-level matches
					const matchingDiscourses = item.discourses.filter(
						(d) =>
							d.id.toLowerCase().includes(filterLower) ||
							d.collection.toLowerCase().includes(filterLower) ||
							d.title.toLowerCase().includes(filterLower) ||
							d.description.toLowerCase().includes(filterLower),
					);

					if (matchingDiscourses.length > 0) {
						// Discourse-level match: return the item with only matching discourses
						return {
							...item,
							discourses: matchingDiscourses,
						};
					}

					// No match at any level
					return null;
				})
				.filter((item): item is UnifiedContentItem => item !== null);
		}

		// Sort alphabetically by title
		allContent.sort((a: UnifiedContentItem, b: UnifiedContentItem) =>
			a.title.localeCompare(b.title),
		);

		return new Response(
			JSON.stringify({
				success: true,
				data: allContent,
				count: allContent.length,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	} catch (error) {
		console.error("Error in /api/discover:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal server error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
};
