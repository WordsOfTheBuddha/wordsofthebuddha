/** Normalize route for comparing with breadcrumb visibility rules. */
export function normalizePathForBreadcrumbs(p: string): string {
	if (!p) return p;
	let out = p;
	if (out.length > 1) out = out.replace(/\/$/, "");
	out = out.replace(/\/index\.html$/, "");
	return out || "/";
}

const HIDE_BREADCRUMBS_PATHS = new Set([
	"/",
	"/search",
	"/read-later",
	"/saves",
	"/register",
	"/signin",
	"/review-room",
	"/profile",
	"/qualities",
	"/simile",
	"/topic",
	"/discover",
	"/explorer",
	"/offline",
	"/privacy",
	"/public-domain",
	"/buddha-quotes",
	"/design-system",
]);

/** Matches `Breadcrumbs.astro` — routes that skip the breadcrumb strip. */
export function hideBreadcrumbsForPath(path: string): boolean {
	return HIDE_BREADCRUMBS_PATHS.has(normalizePathForBreadcrumbs(path));
}
