/**
 * Discourse lists for `/on/{slug}`. The page renders the curated cards; the
 * reference toggle and the export dialog fetch the rest from `/on-data/…`
 * (see `onPageDataUrls`) so large topics do not ship them in every page view.
 */
import {
	buildAllContent,
	canonicalOnSlug,
	findContentBySlug,
	getStaticOnSlugs,
} from "./discover-data";
import { shouldShowOnPageChrome } from "./discourseListPreview";
import { buildOnPagePdfExportTree } from "./onPagePdfExportTree";
import {
	getReferencePostsForTag,
	personOnPagePdfSplit,
	personPageShowsRefsByDefault,
	splitPersonOnPageDiscourses,
	type ReferencePostData,
} from "./referencePostsForPage";
import type { PdfExportSelectionTree } from "./collectionPdfExportTree";

export type OnPageDiscourseItem = {
	id: string;
	title: string;
	description?: string;
	isFeatured?: boolean;
	note?: string;
	[key: string]: unknown;
};

export type OnPageLists = {
	primaryDiscourses: OnPageDiscourseItem[];
	additionalDiscourses: OnPageDiscourseItem[];
	referencePosts: ReferencePostData[];
	curatedDiscourseCount: number;
	personRefsDefaultOn: boolean;
	showOnPageChrome: boolean;
	/** Discourses the export covers by default (Pali-only people: all of them). */
	exportDiscourses: OnPageDiscourseItem[];
	exportTree: PdfExportSelectionTree | null;
};

function toLine(d: OnPageDiscourseItem) {
	return { id: d.id, title: d.title, description: d.description };
}

export function buildOnPageLists(
	slug: string,
	contentType: string,
	displayTitle: string,
	allDiscourses: OnPageDiscourseItem[],
): OnPageLists {
	const isTopic = contentType === "topic";
	const primaryDiscourses = isTopic
		? allDiscourses.filter((d) => d.isFeatured)
		: [];
	let additionalDiscourses = isTopic
		? allDiscourses.filter((d) => !d.isFeatured)
		: allDiscourses;

	let referencePosts: ReferencePostData[] =
		contentType === "quality" || isTopic
			? getReferencePostsForTag(
					slug,
					new Set(allDiscourses.map((d) => d.id)),
				)
			: [];

	if (contentType === "person") {
		const split = splitPersonOnPageDiscourses(allDiscourses.map(toLine));
		const curatedIds = new Set(split.curated.map((d) => d.id));
		additionalDiscourses = allDiscourses.filter((d) => curatedIds.has(d.id));
		referencePosts = split.referencePosts;
	}

	const curatedDiscourseCount =
		contentType === "person"
			? additionalDiscourses.length
			: allDiscourses.length;
	const personRefsDefaultOn =
		contentType === "person" &&
		personPageShowsRefsByDefault(
			curatedDiscourseCount,
			referencePosts.length,
		);
	const showOnPageChrome =
		(contentType === "topic" ||
			contentType === "quality" ||
			contentType === "person") &&
		(primaryDiscourses.length > 0 ||
			additionalDiscourses.length > 0 ||
			referencePosts.length > 0) &&
		shouldShowOnPageChrome(curatedDiscourseCount + referencePosts.length);

	const personPdfSplit =
		contentType === "person"
			? personOnPagePdfSplit(allDiscourses.map(toLine))
			: null;
	const exportIds = personPdfSplit
		? new Set(personPdfSplit.curated.map((d) => d.id))
		: null;
	const exportDiscourses = exportIds
		? allDiscourses.filter((d) => exportIds.has(d.id))
		: allDiscourses;
	const exportTree = showOnPageChrome
		? buildOnPagePdfExportTree(
				slug,
				displayTitle,
				exportDiscourses.map(toLine),
				personPdfSplit ? personPdfSplit.referencePosts : referencePosts,
			)
		: null;

	return {
		primaryDiscourses,
		additionalDiscourses,
		referencePosts,
		curatedDiscourseCount,
		personRefsDefaultOn,
		showOnPageChrome,
		exportDiscourses,
		exportTree,
	};
}

let allContent: ReturnType<typeof buildAllContent> | null = null;

/** Lists for a canonical `/on` slug; null for redirects and unknown slugs. */
export function getOnPageListsForSlug(slug: string): OnPageLists | null {
	allContent ??= buildAllContent();
	const { item, type } = findContentBySlug(slug, allContent);
	if (!item || !type || canonicalOnSlug(item.slug) !== slug) return null;
	return buildOnPageLists(
		slug,
		type,
		item.title,
		(item.discourses || []) as OnPageDiscourseItem[],
	);
}

/** Canonical `/on` slugs whose lists satisfy `predicate`. */
export function staticOnSlugsWhere(
	predicate: (lists: OnPageLists) => boolean,
): string[] {
	return getStaticOnSlugs().filter((slug) => {
		const lists = getOnPageListsForSlug(slug);
		return !!lists && predicate(lists);
	});
}

export function onPageDataUrls(slug: string) {
	return {
		referencePosts: `/on-data/refs/${slug}.json`,
		exportTree: `/on-data/export/${slug}.json`,
	};
}
