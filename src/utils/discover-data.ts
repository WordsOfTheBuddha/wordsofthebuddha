import topicMappings from "../data/topicMappings.json";
import qualityMappings from "../data/qualityMappings.json";
import simileMappings from "../data/simileMappings.json";
import qualities from "../data/qualities.json";
import { toChicagoTitleCase } from "./toChicagoTitleCase";
import type { UnifiedContentItem } from "../types/discover";

type Kind = "topics" | "qualities" | "similes";

export interface BuildOptions {
	include?: Kind[]; // defaults to all
	filter?: string | null; // optional filter like the API supports
}

// Ordering fallback among collections for stable sort
const collectionPriority: Record<string, number> = {
	mn: 1,
	iti: 2,
	sn: 3,
	snp: 4,
	an: 5,
	ud: 6,
	dhp: 7,
};

function getQualityType(
	qualitySlug: string
): "positive" | "negative" | "neutral" {
	if ((qualities as any).positive.includes(qualitySlug)) return "positive";
	if ((qualities as any).negative.includes(qualitySlug)) return "negative";
	if ((qualities as any).neutral.includes(qualitySlug)) return "neutral";
	return "neutral";
}

function getQualitySynonyms(qualitySlug: string): string[] {
	const syn = (qualities as any).qualities || {};
	return Array.isArray(syn[qualitySlug])
		? syn[qualitySlug].filter(
				(s: string) =>
					!s.startsWith("[") &&
					!s.startsWith("Related:") &&
					!s.startsWith("Supported by:") &&
					!s.startsWith("Leads to:") &&
					!s.startsWith("Guarded by:") &&
					!s.startsWith("Opposite:") &&
					!s.startsWith("Context:")
		  )
		: [];
}

function getQualityPali(qualitySlug: string): string[] {
	const syn = (qualities as any).qualities || {};
	return Array.isArray(syn[qualitySlug])
		? syn[qualitySlug]
				.filter((s: string) => s.startsWith("["))
				.map((s: string) => s.slice(1, -1))
		: [];
}

function getQualityContext(qualitySlug: string): string | undefined {
	const syn = (qualities as any).qualities || {};
	if (!Array.isArray(syn[qualitySlug])) return undefined;
	const ctx = syn[qualitySlug].find((s: string) => s.startsWith("Context:"));
	return ctx ? ctx.replace("Context: ", "") : undefined;
}

function extractBracketed(list: string[], label: string): string[] {
	const item = list.find((s) => s.startsWith(label));
	if (!item) return [];
	return item
		.replace(label, "")
		.replace(/[{}]/g, "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function createContentItem(
	base: Omit<UnifiedContentItem, "description">,
	description?: string
): UnifiedContentItem {
	const item: UnifiedContentItem = { ...(base as any) };
	if (description && description.trim())
		(item as any).description = description;
	return item;
}

function buildPriorityMap(): Map<string, number> {
	const priorityMap: Map<string, number> = new Map();
	try {
		Object.values(qualityMappings as any).forEach((discourses: any) => {
			(discourses as any[]).forEach((d) => {
				if (typeof (d as any)?.priority === "number") {
					const id = (d as any).id;
					const current = priorityMap.get(id);
					// Keep the maximum priority value seen for a discourse
					if (current === undefined || (d as any).priority > current) {
						priorityMap.set(id, (d as any).priority);
					}
				}
			});
		});
	} catch {
		// ignore
	}
	return priorityMap;
}

function sortDiscoursesInPlace(arr: any[]) {
	arr.sort((a, b) => {
		const fa = a.isFeatured ? 0 : 1;
		const fb = b.isFeatured ? 0 : 1;
		if (fa !== fb) return fa - fb;
		// Priority: higher numeric priority first; undefined goes last
		const aHasPriority = typeof a.priority === "number";
		const bHasPriority = typeof b.priority === "number";
		if (aHasPriority && bHasPriority) {
			if (a.priority !== b.priority) {
				return (b.priority as number) - (a.priority as number);
			}
		} else if (aHasPriority !== bHasPriority) {
			return aHasPriority ? -1 : 1;
		}
		const cpa = collectionPriority[a.collection] ?? 999;
		const cpb = collectionPriority[b.collection] ?? 999;
		if (cpa !== cpb) return cpa - cpb;
		return a.id.localeCompare(b.id, undefined, {
			numeric: true,
			sensitivity: "base",
		});
	});
}

/**
 * Build the unified content list without search filtering.
 */
export function buildAllContent(
	include: Kind[] = ["topics", "qualities", "similes"]
): UnifiedContentItem[] {
	const priorityMap = buildPriorityMap();
	const items: UnifiedContentItem[] = [];

	if (include.includes("topics")) {
		Object.entries(topicMappings as any).forEach(([slug, topic]: any) => {
			const topicDiscourses = (topic.discourses as any[]).map((d) => ({
				id: d.id,
				title: d.title,
				description: d.description,
				collection: d.collection,
				note: d.note,
				isFeatured: !!d.isFeatured,
				priority: priorityMap.get(d.id),
			}));
			items.push(
				createContentItem(
					{
						id: slug,
						slug,
						type: "topic",
						title: topic.title,
						synonyms: topic.synonyms,
						pali: topic.pali,
						redirects: topic.redirects,
						related: topic.related,
						opposite: (topic as any).opposite,
						discourses: topicDiscourses,
					},
					topic.description
				)
			);
		});
	}

	if (include.includes("qualities")) {
		Object.entries(qualityMappings as any).forEach(([slug, discourses]) => {
			const list = discourses as any[];
			const title = slug
				.split("-")
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(" ");
			const synonymsList = (qualities as any).qualities?.[slug] || [];
			const qualityType = getQualityType(slug);
			const synonyms = getQualitySynonyms(slug);
			const pali = getQualityPali(slug);
			const context = getQualityContext(slug);
			const related = extractBracketed(synonymsList, "Related:");
			const supportedBy = extractBracketed(synonymsList, "Supported by:");
			const leadsTo = extractBracketed(synonymsList, "Leads to:");
			const opposite = extractBracketed(synonymsList, "Opposite:");
			items.push(
				createContentItem(
					{
						id: slug,
						slug,
						type: "quality",
						title,
						qualityType,
						synonyms,
						supportedBy,
						leadsTo,
						pali,
						related,
						opposite,
						discourses: list.map((d) => ({
							id: d.id,
							title: d.title,
							description: d.description,
							collection: d.collection,
							isFeatured: false,
							priority:
								typeof d.priority === "number"
									? d.priority
									: priorityMap.get(d.id),
						})),
					},
					context || ""
				)
			);
		});
	}

	if (include.includes("similes")) {
		Object.entries(simileMappings as any).forEach(
			([letter, group]: any) => {
				Object.entries(group as any).forEach(
					([key, discourses]: any) => {
						const slug = key
							.toLowerCase()
							.replace(/\s+/g, "-")
							.replace(/[^a-z0-9-]/g, "");
						const title = toChicagoTitleCase(key);
						const list = discourses as any[];
						items.push(
							createContentItem({
								id: slug,
								slug,
								type: "simile",
								title,
								discourses: list.map((d) => ({
									id: d.id,
									title: d.title,
									description: d.description,
									collection: d.collection,
									isFeatured: false,
									priority: undefined,
								})),
							})
						);
					}
				);
			}
		);
	}

	// Sort discourses inside each item, but avoid re-sorting qualities (sorted at build time)
	items.forEach((it) => {
		if (Array.isArray(it.discourses) && it.type !== "quality") {
			sortDiscoursesInPlace(it.discourses);
		}
	});

	// Sort items alphabetically by title
	items.sort((a, b) => a.title.localeCompare(b.title));
	return items;
}

/**
 * Build content similarly to the API (supports include + filter).
 */
export function buildUnifiedContent(
	options: BuildOptions = {}
): UnifiedContentItem[] {
	const include = options.include ?? ["topics", "qualities", "similes"];
	const filterParam = options.filter?.trim() ?? "";

	let allContent = buildAllContent(include);

	if (filterParam) {
		const filterLower = filterParam.toLowerCase();
		const filterWithSpaces = filterLower.replace(/-/g, " ");
		const matchesFilter = (text: string): boolean => {
			const textLower = text.toLowerCase();
			return (
				textLower.includes(filterLower) ||
				textLower.includes(filterWithSpaces)
			);
		};

		allContent = allContent
			.map((item) => {
				const itemLevelMatch =
					matchesFilter(item.title) ||
					(item.description && matchesFilter(item.description)) ||
					(item.synonyms &&
						item.synonyms.some((s) => matchesFilter(s))) ||
					(item.pali && item.pali.some((p) => matchesFilter(p))) ||
					(item.redirects &&
						item.redirects.some((r) => matchesFilter(r))) ||
					(item.related &&
						item.related.some((r) => matchesFilter(r)));

				if (itemLevelMatch) return item;

				const matchingDiscourses = item.discourses.filter(
					(d) =>
						matchesFilter(d.id) ||
						matchesFilter(d.collection) ||
						matchesFilter(d.title) ||
						matchesFilter(d.description)
				);

				if (matchingDiscourses.length > 0) {
					return {
						...item,
						discourses: matchingDiscourses,
					} as UnifiedContentItem;
				}
				return null;
			})
			.filter((it): it is UnifiedContentItem => it !== null);
	}

	// Items are already sorted in buildAllContent
	return allContent;
}

/**
 * Helper for /on/[...slug].astro: find an item by slug with priority
 * Topic slug -> topic redirects -> quality -> simile.
 */
export function findContentBySlug(
	slug: string,
	items?: UnifiedContentItem[]
): {
	item: UnifiedContentItem | null;
	type: UnifiedContentItem["type"] | null;
} {
	const all = items ?? buildAllContent();
	const normSlug = slug.toLowerCase();
	const filterValue = normSlug.replace(/-/g, " ");

	let content: UnifiedContentItem | undefined;
	content = all.find(
		(i) =>
			i.type === "topic" &&
			(i.slug === normSlug || i.slug === filterValue)
	);
	if (content) return { item: content, type: content.type };

	content = all.find(
		(i) =>
			i.type === "topic" &&
			Array.isArray(i.redirects) &&
			(i.redirects as string[]).includes(normSlug)
	);
	if (content) return { item: content, type: content.type };

	content = all.find(
		(i) =>
			i.type === "quality" &&
			(i.slug === normSlug || i.slug === filterValue)
	);
	if (content) return { item: content, type: content.type };

	content = all.find(
		(i) =>
			i.type === "simile" &&
			(i.slug === normSlug || i.slug === filterValue)
	);
	if (content) return { item: content, type: content.type };

	return { item: null, type: null };
}

/**
 * Static slugs for /on pages (topics + redirects + qualities + similes).
 */
export function getStaticOnSlugs(): string[] {
	const paths = new Set<string>();
	Object.entries(topicMappings as any).forEach(([slug, topic]: any) => {
		paths.add(slug);
		if (Array.isArray(topic.redirects)) {
			(topic.redirects as string[]).forEach((r) => paths.add(r));
		}
	});
	Object.keys(qualityMappings as any).forEach((slug) => paths.add(slug));
	Object.values(simileMappings as any).forEach((group: any) => {
		Object.keys(group).forEach((k) => {
			const slug = k
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^a-z0-9-]/g, "");
			paths.add(slug);
		});
	});
	return Array.from(paths);
}
