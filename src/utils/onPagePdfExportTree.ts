/**
 * PDF export selection tree for topic/quality `/on/{slug}` pages.
 */
import { compareDiscourseIds } from "./discourseSort";
import { normalizeDiscourseIdForContentImages } from "./contentImage";
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

export function buildOnPagePdfExportTree(
	pageSlug: string,
	pageTitle: string,
	discourses: OnPageDiscourse[],
	referencePosts: ReferencePostData[],
): PdfExportSelectionTree | null {
	const curatedSlugs = new Set(
		discourses.map((d) =>
			normalizeDiscourseIdForContentImages(d.id.trim()),
		),
	);

	const curated: PdfExportDiscourseLine[] = discourses.map((d) => ({
		slug: normalizeDiscourseIdForContentImages(d.id.trim()),
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
	merged.sort((a, b) => compareDiscourseIds(a.slug, b.slug));
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
