/**
 * Highlight documents are keyed by pathname only, so Pāli / layout toggles
 * share one highlight set per page.
 */
export function highlightSlugFromUrl(
	href: string,
	base = "https://www.wordsofthebuddha.org",
): string {
	return new URL(href, base).pathname || "/";
}

/** Firestore doc id for a highlight slug (`/` → `/home`). */
export function normalizeHighlightSlug(slug: string): string {
	return slug === "/" ? "/home" : slug;
}

/**
 * Keys older builds wrote for the same page: pathname plus the Pāli / layout
 * params in effect when the highlight was made.
 */
export function legacyHighlightSlugs(pathname: string): string[] {
	const path = pathname.split("?")[0] || "/";
	return [
		`${path}?pli=true&layout=interleaved`,
		`${path}?pli=true&layout=split`,
		`${path}?layout=interleaved`,
		`${path}?layout=split`,
	];
}
