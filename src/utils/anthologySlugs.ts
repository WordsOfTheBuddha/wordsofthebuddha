/** Anthology landing pages live under /anthologies/; bare slugs redirect there. */
export const ANTHOLOGY_SLUGS = [
	"in-the-buddhas-words",
	"noble-truths-noble-path",
] as const;

export const anthologySlugSet = new Set<string>(ANTHOLOGY_SLUGS);

export function isAnthologySlug(slug: string): boolean {
	return anthologySlugSet.has(slug);
}
