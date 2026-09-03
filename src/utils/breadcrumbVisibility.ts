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
	"/recent",
	"/ai",
	"/ask",
	"/admin/ask",
	"/explorer",
	"/offline",
	"/privacy",
	"/public-domain",
	"/support",
	"/success",
	"/buddha-quotes",
	"/design-system",
	"/404",
]);

/** Matches `Breadcrumbs.astro` — routes that skip the breadcrumb strip. */
export function hideBreadcrumbsForPath(path: string): boolean {
	const normalized = normalizePathForBreadcrumbs(path);
	if (HIDE_BREADCRUMBS_PATHS.has(normalized)) return true;
	// Shared Ask pages: /ask/:slug and internal /shared-ask/:slug
	if (normalized.startsWith("/ask/") || normalized.startsWith("/shared-ask/")) {
		return true;
	}
	return false;
}
