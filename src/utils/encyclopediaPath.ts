/** Path helpers with no filesystem imports. Safe for edge middleware. */

/** `encylopedia` is the one-letter misspelling that was landing on search. */
const ENCYCLOPEDIA_PREFIX = /^(?:encyclopedia|encylopedia)$/i;

export function encyclopediaPath(norm: string): string {
	return `/encyclopedia/${encodeURIComponent(norm)}`;
}

/**
 * Canonical `/encyclopedia` pathname, or null when `pathname` is unrelated.
 * Directory indexes (`/encyclopedia/chanda/index.html`), a mismatched
 * prefix (`/Encyclopedia/chanda`), and the misspelling `/encylopedia`
 * otherwise hit the discourse catch-all and land on `/search`.
 */
export function normalizeEncyclopediaPathname(pathname: string): string | null {
	const raw = pathname.split("?")[0]?.split("#")[0] ?? "";
	let path = raw.startsWith("/") ? raw : `/${raw}`;
	path = path.replace(/\/{2,}/g, "/");
	let bare = path.replace(/\/+$/, "") || "/";
	bare = bare.replace(/\/index\.html$/i, "");
	bare = bare.replace(/\.html$/i, "");
	bare = bare.replace(/\/+$/, "") || "/";
	const parts = bare.split("/").filter(Boolean);
	if (parts.length === 0 || !ENCYCLOPEDIA_PREFIX.test(parts[0])) {
		return null;
	}
	if (parts.length !== 2) return "/encyclopedia";
	let norm = parts[1];
	try {
		norm = decodeURIComponent(norm);
	} catch {
		/* keep the raw segment */
	}
	norm = norm.replace(/\.html$/i, "").trim();
	if (!norm || norm.toLowerCase() === "index.html") return "/encyclopedia";
	return encyclopediaPath(norm);
}
