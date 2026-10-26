/** Public slug for The Word of the Buddha, and the slug it replaced. */
export const WOTB_SLUG = "the-word-of-the-buddha";
export const WOTB_LEGACY_SLUG = "word-of-the-buddha";

/** Anthology landing pages live under /anthologies/; bare slugs redirect there. */
export const ANTHOLOGY_SLUGS = [
	"in-the-buddhas-words",
	"noble-truths-noble-path",
	WOTB_SLUG,
	"inquisitive-mind",
] as const;

export const anthologySlugSet = new Set<string>(ANTHOLOGY_SLUGS);

export function isAnthologySlug(slug: string): boolean {
	return anthologySlugSet.has(slug);
}
