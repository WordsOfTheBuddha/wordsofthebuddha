/**
 * Discourse list for collection PDF export modal (checkbox tree).
 * Mirrors chapter / discourse grouping used in pdfRenderer.fetchCollectionPdfData.
 */
import { normalizeDiscourseIdForContentImages } from "./contentImage";
import { getChapterEntryListForPdf } from "./collectionPdfChapterEntries";
import { compareDiscourseIds } from "./discourseSort";
import { getReferencePostsForCollection } from "./referencePostsForPage";
import { determineRouteType } from "./routeHandler";

export type PdfExportDiscourseLine = {
	/** Normalized discourse id for API (e.g. sn12.3, dhp1). */
	slug: string;
	title: string;
	description?: string;
	/** Sujato reference translation (no curated EN file). */
	isReference?: boolean;
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
	/** Reference-only discourses merged into the tree. */
	referenceDiscourseCount: number;
	/** Curated EN + reference discourses in export scope. */
	totalDiscourseCount: number;
	/** Rounded share of reference discourses in the tree (0 when none). */
	referencePercent: number;
};

export function discourseSlugFromEntry(
	entry: { data?: unknown; slug?: string },
): string {
	const d = entry.data as { slug?: string } | undefined;
	const s = String(d?.slug || entry.slug || "").trim();
	return normalizeDiscourseIdForContentImages(s);
}

function curatedLinesFromEntries(
	entries: Awaited<ReturnType<typeof getChapterEntryListForPdf>>,
): PdfExportDiscourseLine[] {
	return entries.map((e) => {
		const slug = discourseSlugFromEntry(e);
		const title = String(
			(e.data as { title?: string })?.title || slug,
		).trim();
		const description = String(
			(e.data as { description?: string })?.description || "",
		).trim();
		return {
			slug,
			title,
			...(description ? { description } : {}),
		};
	});
}

/** Merge reference-only discourses into a chapter list (canonical slug order). */
export function mergeReferenceDiscoursesForChapter(
	curated: PdfExportDiscourseLine[],
	chapterSlug: string,
): PdfExportDiscourseLine[] {
	const curatedSlugs = new Set(curated.map((line) => line.slug));
	const refs = getReferencePostsForCollection(chapterSlug, curatedSlugs);
	if (refs.length === 0) return curated;

	const refLines: PdfExportDiscourseLine[] = refs.map((entry) => ({
		slug: entry.slug,
		title: entry.title,
		description: entry.description,
		isReference: true,
	}));

	const merged = [...curated, ...refLines];
	merged.sort((a, b) => compareDiscourseIds(a.slug, b.slug));
	return merged;
}

function computeReferenceStats(chapters: PdfExportChapterLine[]): {
	referenceDiscourseCount: number;
	totalDiscourseCount: number;
	referencePercent: number;
} {
	let referenceDiscourseCount = 0;
	let totalDiscourseCount = 0;
	for (const ch of chapters) {
		for (const d of ch.discourses) {
			totalDiscourseCount++;
			if (d.isReference) referenceDiscourseCount++;
		}
	}
	const referencePercent =
		totalDiscourseCount > 0
			? Math.round(
					(referenceDiscourseCount / totalDiscourseCount) * 100,
				)
			: 0;
	return {
		referenceDiscourseCount,
		totalDiscourseCount,
		referencePercent,
	};
}

/**
 * Discourse lines for one chapter / flat collection (curated EN + references).
 */
export async function getChapterDiscourseLinesForPdf(
	chapterSlug: string,
	range: { start: number; end: number } | undefined,
): Promise<PdfExportDiscourseLine[]> {
	const entries = await getChapterEntryListForPdf(chapterSlug, range);
	const curated = curatedLinesFromEntries(entries);
	return mergeReferenceDiscoursesForChapter(curated, chapterSlug);
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
		const discourses = await getChapterDiscourseLinesForPdf(
			collectionSlug,
			undefined,
		);
		if (discourses.length === 0) return null;
		const chapters: PdfExportChapterLine[] = [
			{
				id: collectionSlug,
				title: metadata.title || "",
				discourses,
			},
		];
		return {
			collectionSlug,
			chapters,
			...computeReferenceStats(chapters),
		};
	}

	const chapters: PdfExportChapterLine[] = [];
	for (const [childSlug, childMeta] of childEntries) {
		const discourses = await getChapterDiscourseLinesForPdf(
			childSlug,
			childMeta.range,
		);
		if (discourses.length === 0) continue;
		chapters.push({
			id: childSlug,
			title: childMeta.title,
			discourses,
		});
	}
	if (chapters.length === 0) return null;
	return {
		collectionSlug,
		chapters,
		...computeReferenceStats(chapters),
	};
}
