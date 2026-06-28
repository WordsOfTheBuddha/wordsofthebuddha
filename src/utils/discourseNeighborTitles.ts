import { discourseReferenceTitles } from "../data/discourseReferenceTitles.generated";

const runtimeTitles = new Map<string, string>();

/** Seed titles from SSR footer chips (EN neighbors, etc.). */
export function seedDiscourseNeighborTitles(
	entries: Iterable<[string, string]>,
): void {
	for (const [slug, title] of entries) {
		if (slug && title) runtimeTitles.set(slug, title);
	}
}

/** Title for ref-mode footer prev/next (runtime seed + reference catalog). */
export function getDiscourseNeighborTitle(slug: string): string {
	return runtimeTitles.get(slug) ?? discourseReferenceTitles[slug] ?? "";
}
