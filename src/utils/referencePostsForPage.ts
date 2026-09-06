import collectionReferenceIndex from "../data/collectionReferenceIndex";
import { slugMatchesCollectionPattern } from "./collectionPatterns";
import { discourseBookPrefix } from "./discourseNeighbors";
import { canonicalOnSlug } from "./discover-data";
import { getPtsDisplay } from "./ptsReferences";
import { referenceOnlyRouteSet } from "./referenceOnlyRoutes";

export type ReferencePostData = {
	slug: string;
	title: string;
	description: string;
	volpage?: string;
};

function toReferencePostData(
	entries: typeof collectionReferenceIndex,
): ReferencePostData[] {
	return entries.map(({ slug, title, description }) => {
		const volpage = getPtsDisplay(slug);
		return {
			slug,
			title,
			description,
			...(volpage ? { volpage } : {}),
		};
	});
}

function filterReferencePosts(
	matchesScope: (slug: string) => boolean,
	excludeSlugs: Set<string>,
): ReferencePostData[] {
	return toReferencePostData(
		collectionReferenceIndex.filter(
			(entry) =>
				matchesScope(entry.slug) && !excludeSlugs.has(entry.slug),
		),
	);
}

function entryHasTag(
	entry: (typeof collectionReferenceIndex)[number],
	tagSlug: string,
): boolean {
	if (!entry.qualities) return false;
	const tag = canonicalOnSlug(tagSlug);
	return entry.qualities
		.split(",")
		.map((quality) => canonicalOnSlug(quality.trim()))
		.includes(tag);
}

/** Reference-only discourses for a collection index slug (e.g. an1, sn12). */
export function getReferencePostsForCollection(
	collectionSlug: string,
	excludeSlugs: Iterable<string>,
): ReferencePostData[] {
	const excluded = new Set(excludeSlugs);
	return filterReferencePosts(
		(slug) => slugMatchesCollectionPattern(slug, collectionSlug),
		excluded,
	);
}

/** Reference-only discourses tagged with a quality or topic slug. */
export function getReferencePostsForTag(
	tagSlug: string,
	excludeSlugs: Iterable<string>,
): ReferencePostData[] {
	const excluded = new Set(excludeSlugs);
	return toReferencePostData(
		collectionReferenceIndex.filter(
			(entry) => entryHasTag(entry, tagSlug) && !excluded.has(entry.slug),
		),
	);
}

type PersonOnPageDiscourse = {
	id: string;
	title: string;
	description?: string;
};

function toPersonReferencePost(
	discourse: PersonOnPageDiscourse,
): ReferencePostData {
	const volpage = getPtsDisplay(discourse.id);
	return {
		slug: discourse.id,
		title: discourse.title,
		description: discourse.description || "",
		...(volpage ? { volpage } : {}),
	};
}

/**
 * Person `/on` pages union EN + Pali character tags. EN-mapped discourses
 * stay on the default list; reference-only (no EN MDX) go behind See Refs
 * and are marked `Ref`. Pali-only people still default the refs visible so
 * the page is not empty until a click.
 */
export function splitPersonOnPageDiscourses(
	discourses: PersonOnPageDiscourse[],
): {
	curated: PersonOnPageDiscourse[];
	referencePosts: ReferencePostData[];
} {
	const curated = discourses.filter(
		(discourse) => !referenceOnlyRouteSet.has(discourse.id),
	);
	const refs = discourses.filter((discourse) =>
		referenceOnlyRouteSet.has(discourse.id),
	);
	return {
		curated,
		referencePosts: refs.map(toPersonReferencePost),
	};
}

/** Pali-only person pages: show reference discourses until the reader turns refs off. */
export function personPageShowsRefsByDefault(
	curatedCount: number,
	referenceCount: number,
): boolean {
	return curatedCount === 0 && referenceCount > 0;
}

/**
 * PDF export: Pali-only person lists are the default selection (still
 * tagged as references on the page). Mixed lists keep refs behind Include Ref.
 */
export function personOnPagePdfSplit(discourses: PersonOnPageDiscourse[]): {
	curated: PersonOnPageDiscourse[];
	referencePosts: ReferencePostData[];
} {
	const split = splitPersonOnPageDiscourses(discourses);
	if (
		personPageShowsRefsByDefault(
			split.curated.length,
			split.referencePosts.length,
		)
	) {
		return { curated: discourses, referencePosts: [] };
	}
	return split;
}

/** Reference-only discourses scoped to book-level prefixes of listed discourse ids. */
export function getReferencePostsForDiscourseScopes(
	discourseIds: Iterable<string>,
	excludeSlugs?: Iterable<string>,
): ReferencePostData[] {
	const ids = [...discourseIds];
	const excluded = new Set(excludeSlugs ?? ids);
	const scopes = new Set(
		ids.map((id) => discourseBookPrefix(id)).filter(Boolean),
	);
	if (scopes.size === 0) return [];

	return filterReferencePosts(
		(slug) =>
			[...scopes].some((scope) =>
				slugMatchesCollectionPattern(slug, scope),
			),
		excluded,
	);
}
