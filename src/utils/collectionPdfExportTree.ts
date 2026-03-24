/**
 * Discourse list for collection PDF export modal (checkbox tree).
 * Mirrors chapter / discourse grouping used in pdfRenderer.fetchCollectionPdfData.
 */
import type { DirectoryStructure } from "../types/directory";
import { normalizeDiscourseIdForContentImages } from "./contentImage";
import { getChapterEntryListForPdf } from "./collectionPdfChapterEntries";
import { determineRouteType } from "./routeHandler";

export type PdfExportDiscourseLine = {
	/** Normalized discourse id for API (e.g. sn12.3, dhp1). */
	slug: string;
	title: string;
};

export type PdfExportChapterLine = {
	/** Chapter / sub-collection slug (e.g. sn12-21, sn12, or flat collection slug). */
	id: string;
	title: string;
	discourses: PdfExportDiscourseLine[];
};

export type PdfExportSelectionTree = {
	collectionSlug: string;
	chapters: PdfExportChapterLine[];
};

export function discourseSlugFromEntry(
	entry: { data?: unknown; slug?: string },
): string {
	const d = entry.data as { slug?: string } | undefined;
	const s = String(d?.slug || entry.slug || "").trim();
	return normalizeDiscourseIdForContentImages(s);
}

/**
 * Flat list of discourse slugs in export order (for default “select all”).
 */
export function flattenExportTreeSlugs(tree: PdfExportSelectionTree): string[] {
	const out: string[] = [];
	for (const ch of tree.chapters) {
		for (const d of ch.discourses) {
			out.push(d.slug);
		}
	}
	return out;
}

export async function buildPdfExportSelectionTree(
	collectionSlug: string,
): Promise<PdfExportSelectionTree | null> {
	const route = determineRouteType(collectionSlug);
	if (route.type !== "collection" || !route.metadata) return null;
	const metadata = route.metadata;
	const childEntries = metadata.children
		? Object.entries(metadata.children)
		: [];

	if (childEntries.length === 0) {
		const entries = await getChapterEntryListForPdf(collectionSlug, undefined);
		const discourses: PdfExportDiscourseLine[] = entries.map((e) => {
			const slug = discourseSlugFromEntry(e);
			const title = String(
				(e.data as { title?: string })?.title || slug,
			).trim();
			return { slug, title };
		});
		if (discourses.length === 0) return null;
		return {
			collectionSlug,
			chapters: [
				{
					id: collectionSlug,
					title: metadata.title || "",
					discourses,
				},
			],
		};
	}

	const chapters: PdfExportChapterLine[] = [];
	for (const [childSlug, childMeta] of childEntries) {
		const entries = await getChapterEntryListForPdf(
			childSlug,
			childMeta.range,
		);
		const discourses: PdfExportDiscourseLine[] = entries.map((e) => {
			const slug = discourseSlugFromEntry(e);
			const title = String(
				(e.data as { title?: string })?.title || slug,
			).trim();
			return { slug, title };
		});
		if (discourses.length === 0) continue;
		chapters.push({
			id: childSlug,
			title: childMeta.title,
			discourses,
		});
	}
	if (chapters.length === 0) return null;
	return { collectionSlug, chapters };
}
