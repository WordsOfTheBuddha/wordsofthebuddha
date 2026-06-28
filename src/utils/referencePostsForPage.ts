import collectionReferenceIndex from "../data/collectionReferenceIndex";
import { slugMatchesCollectionPattern } from "./collectionPatterns";
import { discourseBookPrefix } from "./discourseNeighbors";

export type ReferencePostData = {
	slug: string;
	title: string;
	description: string;
};

function toReferencePostData(
	entries: typeof collectionReferenceIndex,
): ReferencePostData[] {
	return entries.map(({ slug, title, description }) => ({
		slug,
		title,
		description,
	}));
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
	const tag = tagSlug.toLowerCase();
	return entry.qualities
		.split(",")
		.map((quality) => quality.trim().toLowerCase())
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
