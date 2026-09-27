// Keep this module import-free: reading-page scripts (Read / Save / Read later,
// listen activity) pull it in, and any catalog import here ships to every page.

/** Routable discourse slugs only (excludes home, anthologies, etc.). */
export function isDiscourseSlug(slug: string): boolean {
	return /^[a-z]+\d/.test(slug);
}

/**
 * Strip internal rewrite prefixes / nested paths so mark-as-read keys align
 * with public discourse slugs (`mn10`, `an3.1`).
 */
export function normalizeDiscourseSlug(raw: string): string {
	let slug = raw.replace(/^\/+/, "").split("?")[0].split("#")[0].trim();
	if (!slug) return "";
	slug = slug.replace(
		/^(discourse-ssr|discourse-sujato|discourse-dynamic)\//i,
		"",
	);
	if (slug.includes("/")) {
		const last = slug.split("/").filter(Boolean).pop() || slug;
		if (isDiscourseSlug(last)) slug = last;
	}
	return slug;
}
