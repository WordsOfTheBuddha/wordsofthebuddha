import { getCollection, type CollectionEntry } from "astro:content";

export type AnthologyEntry = CollectionEntry<"anthologies">;

/** Anthology listings sort by `order`; entries without one fall to the end. */
function byOrder(a: AnthologyEntry, b: AnthologyEntry): number {
	const ao = a.data.order ?? Number.MAX_SAFE_INTEGER;
	const bo = b.data.order ?? Number.MAX_SAFE_INTEGER;
	return ao - bo || a.data.title.localeCompare(b.data.title);
}

/**
 * Anthologies that are ready to be surfaced (home, /discover, /anthologies,
 * sitemap). Entries marked `draft: true` are excluded; their pages still
 * render at /anthologies/:slug so they can be previewed.
 */
export async function getPublishedAnthologies(): Promise<AnthologyEntry[]> {
	const all = await getCollection("anthologies");
	return all.filter((entry) => entry.data.draft !== true).sort(byOrder);
}

/** Slugs of anthologies still marked `draft: true`. */
export async function getDraftAnthologySlugs(): Promise<Set<string>> {
	const all = await getCollection("anthologies");
	return new Set(
		all.filter((entry) => entry.data.draft === true).map((e) => e.data.slug),
	);
}
