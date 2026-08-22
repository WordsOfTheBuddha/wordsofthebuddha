/**
 * PDF export selection tree for topic/quality/simile `/on/{slug}` pages.
 *
 * Discourse order must match the web page: mapping-array order from
 * `content.discourses` (YAML for topics; qualityMappings / simileMappings
 * as assembled by discover-data). Do not sort by collection weight
 * (`compareDiscourseIds`: MN before DN before SN…) or title.
 * Reference-only discourses stay after curated, in caller order.
 */
import type {
	PdfExportDiscourseLine,
	PdfExportSelectionTree,
} from "./collectionPdfExportTree";
import type { ReferencePostData } from "./referencePostsForPage";

export type OnPageDiscourse = {
	id: string;
	title: string;
	description?: string;
};

function normalizeOnPageSlug(id: string): string {
	const t = id.trim().toLowerCase();
	if (!t.includes("/")) return t;
	return t.split("/").filter(Boolean).pop() ?? t;
}

export function buildOnPagePdfExportTree(
	pageSlug: string,
	pageTitle: string,
	discourses: OnPageDiscourse[],
	referencePosts: ReferencePostData[],
): PdfExportSelectionTree | null {
	const curatedSlugs = new Set(
		discourses.map((d) => normalizeOnPageSlug(d.id)),
	);

	const curated: PdfExportDiscourseLine[] = discourses.map((d) => ({
		slug: normalizeOnPageSlug(d.id),
		title: d.title.trim(),
		...(d.description?.trim()
			? { description: d.description.trim() }
			: {}),
	}));

	const refLines: PdfExportDiscourseLine[] = referencePosts
		.filter((entry) => !curatedSlugs.has(entry.slug))
		.map((entry) => ({
			slug: entry.slug,
			title: entry.title,
			description: entry.description,
			isReference: true,
		}));

	const merged = [...curated, ...refLines];
	if (merged.length === 0) return null;

	const referenceDiscourseCount = refLines.length;
	const totalDiscourseCount = merged.length;
	const referencePercent =
		totalDiscourseCount > 0
			? Math.round(
					(referenceDiscourseCount / totalDiscourseCount) * 100,
				)
			: 0;

	return {
		collectionSlug: pageSlug,
		chapters: [
			{
				id: pageSlug,
				title: pageTitle,
				discourses: merged,
			},
		],
		referenceDiscourseCount,
		totalDiscourseCount,
		referencePercent,
	};
}

export function flattenOnPageExportSlugs(
	tree: PdfExportSelectionTree,
): string[] {
	return tree.chapters.flatMap((ch) => ch.discourses.map((d) => d.slug));
}
