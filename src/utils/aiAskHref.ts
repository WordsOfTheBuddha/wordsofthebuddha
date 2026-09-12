export const ASK_SEARCH_MODE = "ask";
/** Old Ask URL. Incoming `mode=ai` still opens Ask and is rewritten to `ask`. */
export const ASK_SEARCH_MODE_LEGACY = "ai";
export const RESEARCH_SEARCH_MODE = "research";

function modeParams(
	search: string | URLSearchParams | null | undefined,
): URLSearchParams {
	if (search instanceof URLSearchParams) return new URLSearchParams(search);
	const raw = (search || "").trim();
	if (!raw) return new URLSearchParams();
	const query = raw.startsWith("?")
		? raw.slice(1)
		: raw.includes("?")
			? raw.slice(raw.indexOf("?") + 1)
			: raw.startsWith("/")
				? ""
				: raw;
	return new URLSearchParams(query);
}

export function searchAskHref(query?: string | null): string {
	const params = new URLSearchParams();
	params.set("mode", ASK_SEARCH_MODE);
	const trimmed = query?.replace(/\s+/g, " ").trim();
	if (trimmed) params.set("q", trimmed);
	return `/search?${params.toString()}`;
}

export function searchResearchHref(query?: string | null): string {
	const params = new URLSearchParams();
	params.set("mode", RESEARCH_SEARCH_MODE);
	const trimmed = query?.replace(/\s+/g, " ").trim();
	if (trimmed) params.set("q", trimmed);
	return `/search?${params.toString()}`;
}

/**
 * Post-auth landing for Ask or Research. A pending question becomes `?q=` so
 * the composer prefills; otherwise keep the current page (or Ask home).
 */
export function askAuthReturnTo(
	question?: string | null,
	fallback = "",
): string {
	const trimmed = question?.replace(/\s+/g, " ").trim();
	const research = isResearchSearchMode(fallback);
	if (trimmed) {
		return research ? searchResearchHref(trimmed) : searchAskHref(trimmed);
	}
	return canonicalizeAskSearchHref(fallback) || searchAskHref();
}

export function askAuthPageHref(
	page: "/signin" | "/register",
	question?: string | null,
	fallbackReturnTo = "",
): string {
	return `${page}?returnTo=${encodeURIComponent(
		askAuthReturnTo(question, fallbackReturnTo),
	)}`;
}

/**
 * Reopen a past Ask from the reader's history without spending a credit.
 * The Ask UI matches `open` against the stored history and restores it;
 * if nothing matches it only prefills the question.
 */
export function withAskResearchParam(
	search: string | URLSearchParams | null | undefined,
	jobId: string | null,
): URLSearchParams {
	const params = modeParams(search);
	const id = (jobId || "").replace(/\s+/g, "").trim();
	if (id) {
		params.set("mode", RESEARCH_SEARCH_MODE);
		params.set("research", id);
	} else {
		params.delete("research");
	}
	return params;
}

export function openAskResearchHref(jobId: string): string {
	const params = withAskResearchParam("", jobId);
	return `/search?${params.toString()}`;
}

/** Job id from `?research=` on an Ask/Research URL, or empty. */
export function askResearchJobParam(
	search: string | URLSearchParams | null | undefined,
): string {
	return (modeParams(search).get("research") || "").replace(/\s+/g, "").trim();
}

export function openAskHistoryHref(question: string): string {
	const params = new URLSearchParams();
	params.set("mode", ASK_SEARCH_MODE);
	const trimmed = question.replace(/\s+/g, " ").trim();
	if (trimmed) params.set("open", trimmed);
	return `/search?${params.toString()}`;
}

export function openResearchHistoryHref(question: string): string {
	const params = new URLSearchParams();
	params.set("mode", RESEARCH_SEARCH_MODE);
	const trimmed = question.replace(/\s+/g, " ").trim();
	if (trimmed) params.set("open", trimmed);
	return `/search?${params.toString()}`;
}

export function isAskSearchMode(
	search: string | URLSearchParams | null | undefined,
): boolean {
	const mode = modeParams(search).get("mode");
	return mode === ASK_SEARCH_MODE || mode === ASK_SEARCH_MODE_LEGACY;
}

export function isResearchSearchMode(
	search: string | URLSearchParams | null | undefined,
): boolean {
	return modeParams(search).get("mode") === RESEARCH_SEARCH_MODE;
}

/** Ask or Research composer (not keyword Search). */
export function isAskSurfaceMode(
	search: string | URLSearchParams | null | undefined,
): boolean {
	const mode = modeParams(search).get("mode");
	return (
		mode === ASK_SEARCH_MODE ||
		mode === ASK_SEARCH_MODE_LEGACY ||
		mode === RESEARCH_SEARCH_MODE
	);
}

/** Rewrite leftover `mode=ai` bookmarks onto `mode=ask`. */
export function canonicalizeAskSearchMode(
	search: string | URLSearchParams | null | undefined,
): URLSearchParams {
	const params = modeParams(search);
	if (params.get("mode") === ASK_SEARCH_MODE_LEGACY) {
		params.set("mode", ASK_SEARCH_MODE);
	}
	return params;
}

export function canonicalizeAskSearchHref(href: string): string {
	const hashIndex = href.indexOf("#");
	const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
	const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
	const qIndex = withoutHash.indexOf("?");
	const path = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash;
	const search = qIndex >= 0 ? withoutHash.slice(qIndex) : "";
	if (!search && !path) return href;
	const params = canonicalizeAskSearchMode(search);
	const qs = params.toString();
	if (!qs && !search) return withoutHash + hash;
	return `${path}${qs ? `?${qs}` : ""}${hash}`;
}
