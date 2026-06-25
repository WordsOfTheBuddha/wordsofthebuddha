import { getEntry } from "astro:content";
import {
	createCombinedMarkdown,
	PALI_ONLY_NOTICE,
	parseContent,
	parsePaliOnly,
	REFERENCE_TRANSLATION_CREDIT,
} from "./contentParser";
import { getEnglishEntry, getPaliEntry } from "./getContentEntry";
import { getLastModified } from "./getLastModified";
import { routes } from "./routes";
import { findNearestTranslatedNeighbors } from "./translatedNeighbors";

export type ReferenceDiscoursePage = {
	mainContent: string;
	splitEnglish?: string;
	splitPali?: string;
	refPaliOnlyContent?: string;
	referenceFallbackPage: boolean;
	suttaProps: {
		fp: string;
		title: string;
		description?: string;
		prev: Awaited<ReturnType<typeof getEnglishEntry>>;
		next: Awaited<ReturnType<typeof getEnglishEntry>>;
		id: string;
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
		viewSource: "pli" | "en";
		referenceFallback: boolean;
	};
};

/** Build a Pāli-only or Sujato reference page for direct discourse URLs. */
export async function buildReferenceDiscoursePage(
	id: string,
): Promise<ReferenceDiscoursePage | null> {
	const paliParagraphEntry = await getPaliEntry(id);
	if (!paliParagraphEntry) return null;

	const referenceEntry = await getEntry("referenceSujato", id);
	const paliSegmentEntry = await getEntry("referencePliMs", id);
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
		pairs = await parseContent(
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

	const interleavedContent = createCombinedMarkdown(
		pairs,
		true,
		"interleaved",
	);
	const splitContent = createCombinedMarkdown(pairs, true, "split");

	const leadNotice = useReferenceEnglish
		? REFERENCE_TRANSLATION_CREDIT
		: PALI_ONLY_NOTICE;

	let mainContent =
		typeof interleavedContent === "string"
			? `${leadNotice}\n\n${interleavedContent}`
			: leadNotice;
	let splitEnglish: string | undefined;
	let splitPali: string | undefined;
	if (typeof splitContent !== "string") {
		splitEnglish = `${leadNotice}${splitContent.english ? `\n\n${splitContent.english}` : ""}`;
		splitPali = splitContent.pali;
	}

	const fpParts = (paliParagraphEntry.filePath ?? "").split("/");
	const folder = fpParts[fpParts.length - 2] || "";
	const fp = folder ? `${folder}/${id}` : id;
	const paliTitle =
		(paliParagraphEntry.data as { title?: string }).title || id;
	const displayTitle =
		(referenceEntry?.data as { title?: string } | undefined)?.title ||
		paliTitle;
	const filePath = paliParagraphEntry.filePath || "";
	const lastUpdated = getLastModified(filePath);

	let refPrev = null;
	let refNext = null;
	if (useReferenceEnglish) {
		const { prevId, nextId } = findNearestTranslatedNeighbors(id, routes);
		if (prevId) refPrev = await getEnglishEntry(prevId);
		if (nextId) refNext = await getEnglishEntry(nextId);
	}

	return {
		mainContent,
		splitEnglish,
		splitPali,
		refPaliOnlyContent,
		referenceFallbackPage: useReferenceEnglish,
		suttaProps: {
			fp,
			title: displayTitle,
			description: undefined,
			prev: refPrev,
			next: refNext,
			id,
			showReadLater: false,
			showSave: false,
			showRead: false,
			lastUpdated,
			showAuth: true,
			showPali: true,
			paragraphRequest: null,
			discourseRange: null,
			contentImage: null,
			vizPrev: null,
			vizNext: null,
			viewSource: useReferenceEnglish ? "pli" : "en",
			referenceFallback: useReferenceEnglish,
		},
	};
}
