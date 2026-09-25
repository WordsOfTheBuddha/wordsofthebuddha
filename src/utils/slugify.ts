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

/** GitHub-style suffixes (`-2`, `-3`) when the same heading label appears twice. */
export function allocateUniqueSlug(
	raw: string,
	used: Set<string>,
	slugFn: (text: string) => string = slugify,
): string {
	const base = slugFn(raw);
	let id = base;
	if (used.has(id)) {
		let n = 2;
		while (used.has(`${base}-${n}`)) n++;
		id = `${base}-${n}`;
	}
	used.add(id);
	return id;
}
