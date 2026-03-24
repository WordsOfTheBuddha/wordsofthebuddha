/**
 * Collection PDF export scope (text file counts, diagram detection) for UI.
 * Kept separate from pdfRenderer so layouts can import without pulling PDF render deps.
 */
import {
	collectionHasSvgVizAssetByRootPrefix,
	discourseHasSvgAssetForExport,
	discourseHasSvgViz,
} from "./contentImage";
import { getChapterEntryListForPdf } from "./collectionPdfChapterEntries";
import { estimatePdfExportTextFileCount } from "./collectionPdfPreviewMeta";
import { determineRouteType } from "./routeHandler";

function discourseHasAnyPdfViz(
	slug: string,
	data: Record<string, unknown> | undefined,
	title: string | undefined,
): boolean {
	return (
		discourseHasSvgViz(slug, data, title) ||
		discourseHasSvgAssetForExport(slug)
	);
}

/**
 * Whether the collection PDF would include at least one discourse with an SVG diagram
 * (primary viz path — matches export behavior).
 */
export async function collectionExportHasSvgViz(
	collectionSlug: string,
): Promise<boolean> {
	const route = determineRouteType(collectionSlug);
	if (route.type !== "collection" || !route.metadata) return false;
	const metadata = route.metadata;

	const childEntries = metadata.children
		? Object.entries(metadata.children)
		: [];

	if (childEntries.length === 0) {
		const entries = await getChapterEntryListForPdf(collectionSlug, undefined);
		for (const entry of entries) {
			const d = entry.data as any;
			const s = String(d?.slug || (entry as any).slug || "").trim();
			if (discourseHasAnyPdfViz(s, d, d?.title)) return true;
		}
		return collectionHasSvgVizAssetByRootPrefix(collectionSlug);
	}

	for (const [childSlug, childMeta] of childEntries) {
		const entries = await getChapterEntryListForPdf(
			childSlug,
			childMeta.range,
		);
		for (const entry of entries) {
			const d = entry.data as any;
			const s = String(d?.slug || (entry as any).slug || "").trim();
			if (discourseHasAnyPdfViz(s, d, d?.title)) return true;
		}
	}
	return collectionHasSvgVizAssetByRootPrefix(collectionSlug);
}

/**
 * Count of English MDX text files included in the export (same entry list / caps as PDF generation).
 */
export async function collectionExportTextFileCount(
	collectionSlug: string,
): Promise<number> {
	const route = determineRouteType(collectionSlug);
	if (route.type !== "collection" || !route.metadata) return 0;
	const metadata = route.metadata;
	const childEntries = metadata.children
		? Object.entries(metadata.children)
		: [];

	const fallback = estimatePdfExportTextFileCount(collectionSlug);

	if (childEntries.length === 0) {
		const entries = await getChapterEntryListForPdf(
			collectionSlug,
			undefined,
		);
		return Math.max(entries.length, fallback);
	}

	let total = 0;
	for (const [childSlug, childMeta] of childEntries) {
		const entries = await getChapterEntryListForPdf(
			childSlug,
			childMeta.range,
		);
		total += entries.length;
	}
	return Math.max(total, fallback);
}
