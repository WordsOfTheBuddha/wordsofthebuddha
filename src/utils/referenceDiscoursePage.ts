import {
	createCombinedMarkdown,
	hasPaliPairs,
	isViewFullTextFallbackOnly,
	PALI_ONLY_NOTICE,
	parseContent,
	parsePaliOnly,
	extractPaliParagraphsForTm,
	REFERENCE_TRANSLATION_CREDIT,
	toSmartQuotes,
	type ContentPair,
	type TmPaliParagraph,
} from "./contentParser";
import {
	hasSegmentMarkers,
	parseReferenceSegmentContent,
	filterReferenceSegmentPairs,
	type ReferenceSubsetFilter,
} from "./referenceSegmentParser";
import {
	getPaliEntry,
	getReferencePliMsEntry,
	getReferenceSujatoEntry,
	getDiscourseNeighborEntry,
	type ContentEntryLike,
} from "./getContentEntry";
import { getLastModified } from "./getLastModified";
import { findPageDiscourseNeighbors } from "./discourseNeighbors";

export type ReferenceDiscoursePage = {
	mainContent: string;
	/** Pāli exists for a second column; panels are built client-side. */
	splitAvailable: boolean;
	refPaliOnlyContent?: string;
	referenceFallbackPage: boolean;
	/** Paragraph pairs for PDF / polytext export. */
	contentPairs: ContentPair[];
	suttaProps: {
		fp: string;
		title: string;
		description?: string;
		qualities?: string[];
		prev: ContentEntryLike | null;
		next: ContentEntryLike | null;
		id: string;
		showReadLater: boolean;
		showSave: boolean;
		showRead: boolean;
		lastUpdated: Date;
		showAuth: boolean;
		showPali: boolean;
		paragraphRequest: null;
		discourseRange: { start: string; end: string } | null;
		contentImage: null;
		vizPrev: null;
		vizNext: null;
		viewSource: "pli" | "en" | "sujato-reference";
		referenceFallback: boolean;
		tmFullPaliParagraphs?: TmPaliParagraph[] | null;
	};
};

/** Build a Pāli-only or Sujato reference page for direct discourse URLs. */
export async function buildReferenceDiscoursePage(
	id: string,
	options: ReferenceSubsetFilter & {
		refMode?: boolean;
		/** Explicit /:slug/en/sujato route — requires Sujato content. */
		sujatoRoute?: boolean;
	} = {},
): Promise<ReferenceDiscoursePage | null> {
	const {
		refMode = false,
		sujatoRoute = false,
		sectionNumber,
		discourseRange,
		fullRef,
		hrf,
	} = options;
	const paliParagraphEntry = await getPaliEntry(id);
	if (!paliParagraphEntry) return null;

	const referenceEntry = await getReferenceSujatoEntry(id);
	if (sujatoRoute && !referenceEntry) return null;
	const paliSegmentEntry = await getReferencePliMsEntry(id);
	const useReferenceEnglish = Boolean(referenceEntry);

	const paliOnlyPairs = parsePaliOnly(paliParagraphEntry.body);
	const paliOnlyInterleaved = createCombinedMarkdown(
		paliOnlyPairs,
		true,
		"interleaved",
	);
	const refPaliOnlyContent =
		typeof paliOnlyInterleaved === "string"
			? paliOnlyInterleaved
			: undefined;

	let pairs;
	if (referenceEntry) {
		const paliForReference = paliSegmentEntry ?? paliParagraphEntry;
		const useSegmentKeys =
			paliSegmentEntry &&
			hasSegmentMarkers(paliSegmentEntry.body) &&
			hasSegmentMarkers(referenceEntry.body);
		pairs = useSegmentKeys
			? parseReferenceSegmentContent(
					paliForReference,
					referenceEntry,
					toSmartQuotes,
				)
			: await parseContent(
					paliForReference,
					referenceEntry,
					undefined,
					undefined,
					null,
					null,
				);
	} else {
		pairs = paliOnlyPairs;
	}

	const isPartialView = Boolean(sectionNumber || discourseRange);
	if (isPartialView && fullRef) {
		pairs = filterReferenceSegmentPairs(pairs, {
			sectionNumber,
			discourseRange: discourseRange ?? undefined,
			fullRef,
			hrf: hrf ?? id,
		});
	}

	const interleavedContent = createCombinedMarkdown(
		pairs,
		true,
		"interleaved",
	);

	const leadNotice = useReferenceEnglish
		? REFERENCE_TRANSLATION_CREDIT
		: PALI_ONLY_NOTICE;

	let mainContent =
		typeof interleavedContent === "string"
			? `${leadNotice}\n\n${interleavedContent}`
			: leadNotice;
	const splitAvailable = hasPaliPairs(pairs);

	const fpParts = (paliParagraphEntry.filePath ?? "").split("/");
	const folder = fpParts[fpParts.length - 2] || "";
	const fp = folder ? `${folder}/${id}` : id;
	const paliTitle =
		(paliParagraphEntry.data as { title?: string }).title || id;
	const displayTitle =
		(referenceEntry?.data as { title?: string } | undefined)?.title ||
		paliTitle;
	const refData = referenceEntry?.data as
		| {
				description?: string;
				qualities?: string;
				title?: string;
		  }
		| undefined;
	const description = refData?.description;
	const qualities = refData?.qualities
		?.split(",")
		.map((t: string) => t.trim())
		.filter(Boolean);
	const filePath = paliParagraphEntry.filePath || "";
	const lastUpdated = getLastModified(filePath);
	const subsetFallback =
		isPartialView && typeof interleavedContent === "string"
			? isViewFullTextFallbackOnly(interleavedContent)
			: false;

	let refPrev = null;
	let refNext = null;
	const neighborRefMode = refMode || sujatoRoute;
	const { prevId, nextId } = findPageDiscourseNeighbors(id, neighborRefMode);
	if (prevId) refPrev = await getDiscourseNeighborEntry(prevId);
	if (nextId) refNext = await getDiscourseNeighborEntry(nextId);

	return {
		mainContent,
		splitAvailable,
		refPaliOnlyContent,
		referenceFallbackPage: useReferenceEnglish,
		contentPairs: pairs,
		suttaProps: {
			fp,
			title: displayTitle,
			description,
			qualities,
			prev: refPrev,
			next: refNext,
			id,
			showReadLater: !subsetFallback,
			showSave: !subsetFallback,
			showRead: !subsetFallback,
			lastUpdated,
			showAuth: true,
			showPali: !subsetFallback,
			paragraphRequest: null,
			discourseRange: discourseRange ?? null,
			contentImage: null,
			vizPrev: null,
			vizNext: null,
			viewSource: sujatoRoute
				? "sujato-reference"
				: useReferenceEnglish
					? "pli"
					: "en",
			referenceFallback: useReferenceEnglish,
			tmFullPaliParagraphs: import.meta.env.DEV
				? extractPaliParagraphsForTm(paliParagraphEntry.body)
				: null,
		},
	};
}
