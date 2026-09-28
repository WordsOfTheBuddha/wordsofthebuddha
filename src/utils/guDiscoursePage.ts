import {
	createCombinedMarkdown,
	extractPaliParagraphsForTm,
	hasPaliPairs,
	parseContent,
	type TmPaliParagraph,
} from "./contentParser";
import {
	getGuEntry,
	getPaliEntry,
	type ContentEntryLike,
} from "./getContentEntry";
import { getLastModified } from "./getLastModified";
import {
	blocksAlign,
	guReviewNeighbors,
	listGuReviewFiles,
} from "./guReviewFiles";

/** Shown above the paired Pali and sample Gujarati. */
export const GU_SAMPLE_CREDIT =
	'<p class="english-paragraph reference-translation-credit">Sample Gujarati translation for review.</p>';

export type GuDiscoursePage = {
	mainContent: string;
	splitAvailable: boolean;
	suttaProps: {
		fp: string;
		title: string;
		description?: string;
		qualities?: string[];
		prev: ContentEntryLike | null;
		next: ContentEntryLike | null;
		id: string;
		requestedSlug: string;
		showReadLater: boolean;
		showSave: boolean;
		showRead: boolean;
		lastUpdated: Date;
		showAuth: boolean;
		showPali: boolean;
		paragraphRequest: null;
		discourseRange: null;
		contentImage: null;
		vizPrev: null;
		vizNext: null;
		viewSource: "gu";
		referenceFallback: false;
		tmFullPaliParagraphs?: TmPaliParagraph[] | null;
	};
};

/** Pali beside the sample Gujarati for `/:slug/gu`. */
export async function buildGuDiscoursePage(
	id: string,
): Promise<GuDiscoursePage | null> {
	const paliEntry = await getPaliEntry(id);
	const guEntry = await getGuEntry(id);
	if (!paliEntry || !guEntry) return null;
	if (!blocksAlign(paliEntry.body, guEntry.body)) return null;

	const { pairs } = parseContent(paliEntry, guEntry);
	const interleaved = createCombinedMarkdown(pairs, true, "interleaved");
	const mainContent =
		typeof interleaved === "string"
			? `${GU_SAMPLE_CREDIT}\n\n${interleaved}`
			: GU_SAMPLE_CREDIT;

	const files = listGuReviewFiles();
	const { prevId, nextId } = guReviewNeighbors(id, files);
	const bySlug = new Map(files.map((file) => [file.slug, file]));
	const neighbor = (slug: string | null): ContentEntryLike | null => {
		if (!slug) return null;
		const file = bySlug.get(slug);
		if (!file) return null;
		return {
			id: slug,
			slug,
			body: "",
			data: { title: file.title, slug },
			filePath: file.filePath,
		};
	};

	const fpParts = (paliEntry.filePath ?? "").split("/");
	const folder = fpParts[fpParts.length - 2] || "";
	const fp = folder ? `${folder}/${id}` : id;
	const paliData = paliEntry.data;
	const title =
		(typeof guEntry.data.title === "string" && guEntry.data.title) ||
		(typeof paliData.title === "string" && paliData.title) ||
		id;
	const description =
		(typeof guEntry.data.description === "string" &&
			guEntry.data.description) ||
		(typeof paliData.description === "string"
			? paliData.description
			: undefined);
	const qualities =
		typeof paliData.qualities === "string"
			? paliData.qualities
					.split(",")
					.map((term) => term.trim())
					.filter(Boolean)
			: undefined;

	return {
		mainContent,
		splitAvailable: hasPaliPairs(pairs),
		suttaProps: {
			fp,
			title,
			description,
			qualities,
			prev: neighbor(prevId),
			next: neighbor(nextId),
			id,
			requestedSlug: id,
			showReadLater: true,
			showSave: true,
			showRead: true,
			lastUpdated: getLastModified(
				guEntry.filePath || paliEntry.filePath || "",
			),
			showAuth: true,
			showPali: true,
			paragraphRequest: null,
			discourseRange: null,
			contentImage: null,
			vizPrev: null,
			vizNext: null,
			viewSource: "gu",
			referenceFallback: false,
			tmFullPaliParagraphs: import.meta.env.DEV
				? extractPaliParagraphsForTm(paliEntry.body)
				: null,
		},
	};
}
