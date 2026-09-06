/**
 * Highlight documents are keyed by the public pathname plus Pāli layout params.
 * Matches the historical `highlightService.getSlug()` URL.
 */
export function highlightSlugFromUrl(
	href: string,
	base = "https://www.wordsofthebuddha.org",
): string {
	const url = new URL(href, base);
	const params = new URLSearchParams();
	const pliParam = url.searchParams.get("pli");
	const layoutParam = url.searchParams.get("layout");
	if (pliParam) params.append("pli", "true");
	if (layoutParam) {
		params.append("layout", layoutParam);
	} else if (pliParam) {
		params.append("layout", "interleaved");
	}
	const queryString = params.toString();
	return queryString ? `${url.pathname}?${queryString}` : url.pathname;
}

/** Firestore doc id for a highlight slug (`/` → `/home`). */
export function normalizeHighlightSlug(slug: string): string {
	return slug === "/" ? "/home" : slug;
}
