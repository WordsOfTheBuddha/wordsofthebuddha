import qualities from "../data/qualities.json";

// Export the shared configurations for content types
export const contentTypeConfigs = {
	"bright-quality": {
		emoji: "☀️",
		label: "bright quality",
		tooltip:
			"When a bright quality is cultivated, it brings benefit, clarity of vision, and leads to growth in wisdom.",
		cssClass:
			"text-xs border border-amber-300 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-full px-2 py-0.5 whitespace-nowrap",
	},
	"negative-quality": {
		emoji: "☁️",
		label: "dark quality",
		tooltip:
			"When a dark quality is maintained or not abandoned, it brings harm, obscured vision, and the decline of wisdom.",
		cssClass:
			"text-xs border border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/20 rounded-full px-2 py-0.5 whitespace-nowrap",
	},
	"neutral-quality": {
		emoji: "💠",
		label: "neutral quality",
		tooltip:
			"This quality can be either skillful or unskillful depending on how it is applied and the context in which it arises.",
		cssClass:
			"text-xs border border-cyan-300 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 rounded-full px-2 py-0.5 whitespace-nowrap",
	},
	simile: {
		emoji: "🌱",
		label: "simile",
		tooltip:
			"A teaching illustration that uses comparison to make the Dhamma easier to understand.",
		cssClass:
			"text-xs bg-green-200 dark:bg-green-900 text-gray-600 dark:text-green-200 rounded-full px-2 py-0.5 whitespace-nowrap",
	},
	topic: {
		emoji: "",
		label: "topic",
		tooltip:
			"A curated collection of discourses on a specific theme or subject.",
		cssClass:
			"text-xs bg-blue-200 dark:bg-blue-500 text-gray-600 dark:text-gray-300 rounded-full px-2 py-0.5 whitespace-nowrap",
	},
	person: {
		emoji: "👤",
		label: "person",
		tooltip:
			"A person mentioned in the discourses, often a student or interlocutor of the Buddha.",
		cssClass:
			"text-xs border border-purple-300 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 rounded-full px-2 py-0.5 whitespace-nowrap",
	},
};

export function getQualityContentType(
	qualitySlug: string
): "bright-quality" | "negative-quality" | "neutral-quality" {
	if (qualities.positive.includes(qualitySlug)) return "bright-quality";
	if (qualities.negative.includes(qualitySlug)) return "negative-quality";
	return "neutral-quality";
}

export function getContentTypeFromApiData(
	item: any
):
	| "bright-quality"
	| "negative-quality"
	| "neutral-quality"
	| "simile"
	| "topic"
	| "person" {
	if (item.type === "quality") {
		return getQualityContentType(item.slug);
	}
	return item.type as "simile" | "topic" | "person";
}

// Server-side HTML generation for ContentTag
export function generateContentTagHtml(
	contentType:
		| "bright-quality"
		| "negative-quality"
		| "neutral-quality"
		| "simile"
		| "topic"
		| "person",
	options?: { tooltipPos?: "top" | "bottom" }
): string {
	const config = contentTypeConfigs[contentType];
	const posAttr = options?.tooltipPos ? options.tooltipPos : "top";

	return `<span class="content-tag ${config.cssClass}" data-tooltip="${config.tooltip}" data-tooltip-pos="${posAttr}">
    ${config.emoji} ${config.label}
  </span>`;
}
