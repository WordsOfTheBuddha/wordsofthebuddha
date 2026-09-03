export const ASK_SEARCH_MODE = "ai";

export function searchAskHref(query?: string | null): string {
	const params = new URLSearchParams();
	params.set("mode", ASK_SEARCH_MODE);
	const trimmed = query?.replace(/\s+/g, " ").trim();
	if (trimmed) params.set("q", trimmed);
	return `/search?${params.toString()}`;
}

/**
 * Reopen a past Ask from the reader's history without spending a credit.
 * The Ask UI matches `open` against the stored history and restores it;
 * if nothing matches it only prefills the question.
 */
export function openAskHistoryHref(question: string): string {
	const params = new URLSearchParams();
	params.set("mode", ASK_SEARCH_MODE);
	const trimmed = question.replace(/\s+/g, " ").trim();
	if (trimmed) params.set("open", trimmed);
	return `/search?${params.toString()}`;
}

export function isAskSearchMode(
	search: string | URLSearchParams | null | undefined,
): boolean {
	const params =
		typeof search === "string"
			? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
			: search || new URLSearchParams();
	return params.get("mode") === ASK_SEARCH_MODE;
}
