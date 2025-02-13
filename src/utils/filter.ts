import type { SearchResult } from "../service/search/search";

export function filterResults(
	results: SearchResult[],
	query: string
): SearchResult[] {
	if (!query.trim()) return results;

	const searchTerms = query.toLowerCase().split(" ");
	return results.filter((result) => {
		const content =
			`${result.slug} ${result.title} ${result.description}`.toLowerCase();
		return searchTerms.every((term) => content.includes(term));
	});
}
