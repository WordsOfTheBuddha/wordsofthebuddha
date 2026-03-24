/**
 * Discourse counts for collection PDF preview (matches export caps in pdfRenderer).
 */
import { directoryStructureWithCounts } from "../data/directoryStructureWithCounts";
import type { DirectoryStructure } from "../types/directory";
import { determineRouteType } from "./routeHandler";

/** Kept in sync with MAX_DISCOURSES in pdfRenderer.fetchChapterDiscourses */
export const MAX_PDF_DISCOURSES_PER_CHAPTER = 150;

/** English Dhammapada files (one MDX per section); used for export scope copy. */
const dhpMdxGlob = import.meta.glob("../content/en/dhp/*.mdx");
const DHP_TEXT_FILE_COUNT = Object.keys(dhpMdxGlob).length;

export type CollectionPdfPreviewChapter = {
	/** Child collection slug (for future per-section export UI). */
	slug: string;
	title: string;
	count: number;
};

export type CollectionPdfPreviewMeta = {
	title: string;
	description: string;
	/** Uncapped total for messaging and “large export” threshold. */
	totalUnits: number;
	/** Single paragraph for the Scope / Contents section. */
	scopeSummary: string;
	hasChapters: boolean;
	chapters: CollectionPdfPreviewChapter[];
	maxDiscoursesPerChapter: number;
};

function findNodeBySlug(
	tree: Record<string, DirectoryStructure>,
	target: string,
): DirectoryStructure | null {
	for (const [key, node] of Object.entries(tree)) {
		if (key === target) return node;
		if (node.children) {
			const found = findNodeBySlug(node.children, target);
			if (found) return found;
		}
	}
	return null;
}

/** Plural unit label for top-level collection scope (aligned with ProjectStatus naming). */
function getUnitSuffix(slug: string): string {
	const first = slug.split(/[-/]/)[0]?.toLowerCase() ?? "";
	const map: Record<string, string> = {
		dhp: "verses",
		iti: "sayings",
		ud: "utterances",
		mn: "discourses",
		snp: "teachings",
		sn: "discourses",
		an: "discourses",
		dn: "discourses",
		kp: "passages",
	};
	return map[first] ?? "discourses";
}

/**
 * Preview-only counts from directoryStructureWithCounts (same tree shape as directoryStructure).
 * Display totals are not capped; PDF export may still apply per-chapter limits server-side.
 */
export function getCollectionPdfPreviewMeta(
	slug: string,
): CollectionPdfPreviewMeta | null {
	const route = determineRouteType(slug);
	if (route.type !== "collection" || !route.metadata) return null;

	const meta = route.metadata;
	const counted = findNodeBySlug(directoryStructureWithCounts, slug);

	if (!meta.children) {
		const raw = counted?.contentCount ?? 0;
		const suffix = getUnitSuffix(slug);

		if (slug === "dhp") {
			const files = DHP_TEXT_FILE_COUNT;
			return {
				title: meta.title,
				description: meta.description ?? "",
				totalUnits: raw,
				scopeSummary: `This export includes ${raw} verses from ${files} text files (one file per section on the site).`,
				hasChapters: false,
				chapters: [],
				maxDiscoursesPerChapter: MAX_PDF_DISCOURSES_PER_CHAPTER,
			};
		}

		return {
			title: meta.title,
			description: meta.description ?? "",
			totalUnits: raw,
			scopeSummary: `This export includes ${raw} ${suffix}.`,
			hasChapters: false,
			chapters: [],
			maxDiscoursesPerChapter: MAX_PDF_DISCOURSES_PER_CHAPTER,
		};
	}

	const chapters: CollectionPdfPreviewChapter[] = [];
	let total = 0;
	const suffix = getUnitSuffix(slug);

	for (const [childSlug, childMeta] of Object.entries(meta.children)) {
		const childCounted = counted?.children?.[childSlug];
		const raw = childCounted?.contentCount ?? 0;
		total += raw;
		chapters.push({ slug: childSlug, title: childMeta.title, count: raw });
	}

	return {
		title: meta.title,
		description: meta.description ?? "",
		totalUnits: total,
		scopeSummary: `This export includes ${total} ${suffix} across the sub-collections listed below.`,
		hasChapters: true,
		chapters,
		maxDiscoursesPerChapter: MAX_PDF_DISCOURSES_PER_CHAPTER,
	};
}

/**
 * Rough count of MDX files in export scope from directory counts (sync).
 * Used when astro:content entry scans return 0 during prerender.
 */
export function estimatePdfExportTextFileCount(slug: string): number {
	const meta = getCollectionPdfPreviewMeta(slug);
	if (!meta) return 0;
	if (meta.hasChapters) {
		return meta.chapters.reduce((s, ch) => s + ch.count, 0);
	}
	if (slug === "dhp") {
		return DHP_TEXT_FILE_COUNT;
	}
	return meta.totalUnits;
}
