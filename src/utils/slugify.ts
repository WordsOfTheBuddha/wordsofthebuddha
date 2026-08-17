/**
 * URL fragment ids for headings. Pāli diacritics fold to ASCII (ā→a, ṭ→t)
 * instead of becoming extra hyphens.
 */

const GLOSS_RE = /\|([^:|]+)::[^|]*\|/g;

export function foldDiacritics(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "");
}

export function slugify(text: string): string {
	return foldDiacritics(text.replace(GLOSS_RE, "$1"))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/(^-|-$)/g, "");
}
