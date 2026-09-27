import { attachSearchAutocomplete } from "./searchAutocompleteClient";
import type { SearchAutocompleteController } from "./searchAutocompleteClient";
import {
	clearSearchHistory,
	getRecentSearchQueries,
} from "./searchHistoryClient";
import { createSuggestionSearcher } from "./suggestionSearcher";
import type { SuggestionSearcher } from "./suggestionSearcher";
import {
	discourseSuggestLimit,
	suggestDiscourses,
	uniqueExactDiscourse,
	type DiscourseSuggestEntry,
} from "./discourseIdSuggest";
import type { PageSuggestEntry } from "./pageSuggest";

export interface SearchGatewayOptions {
	form: HTMLFormElement;
	input: HTMLInputElement;
	dropdown: HTMLElement;
	list: HTMLElement;
	onEmptyQuery?: () => void;
	alignDropdown?: "stretch" | "end";
}

function navigateTo(href: string): void {
	const location =
		(typeof window !== "undefined" ? window.location : undefined) ??
		globalThis.location;
	location.assign(href);
}

export function goToSearchQuery(
	query: string,
	discourseEntries: readonly DiscourseSuggestEntry[],
	onEmptyQuery?: () => void,
): void {
	const q = query.trim();
	if (!q) {
		onEmptyQuery?.();
		return;
	}
	const exact = uniqueExactDiscourse(discourseEntries, q);
	if (exact) {
		navigateTo(exact.href);
		return;
	}
	navigateTo(`/search?q=${encodeURIComponent(q)}`);
}

/** Homepage-style gateway: unique ID navigates; otherwise /search. */
export function attachSearchGateway(options: SearchGatewayOptions): void {
	const { form, input, dropdown, list, onEmptyQuery, alignDropdown } = options;

	let suggestionSearcher: SuggestionSearcher | null = null;
	let discourseEntries: DiscourseSuggestEntry[] = [];
	let pageEntries: PageSuggestEntry[] = [];
	let autocomplete: SearchAutocompleteController | null = null;
	let loadPromise: Promise<void> | null = null;

	function goToHref(href: string) {
		navigateTo(href);
	}

	function goToSearch(query: string) {
		goToSearchQuery(query, discourseEntries, onEmptyQuery);
	}

	async function ensureAutocomplete() {
		if (autocomplete) return;
		if (loadPromise) {
			await loadPromise;
			return;
		}

		loadPromise = (async () => {
			try {
				const [termsRes, discourseRes] = await Promise.all([
					fetch("/suggestions-index.json"),
					fetch("/discourse-suggest-index.json"),
				]);
				if (termsRes.ok) {
					const data = await termsRes.json();
					suggestionSearcher = createSuggestionSearcher(
						Array.isArray(data?.entries) ? data.entries : [],
					);
				}
				if (discourseRes.ok) {
					const data = await discourseRes.json();
					discourseEntries = Array.isArray(data?.entries)
						? data.entries
						: [];
					pageEntries = Array.isArray(data?.pages) ? data.pages : [];
				}
			} catch (error) {
				console.warn("Search gateway: failed to load suggestion indexes", error);
			}

			if (
				!suggestionSearcher &&
				discourseEntries.length === 0 &&
				pageEntries.length === 0
			) {
				return;
			}

			autocomplete = attachSearchAutocomplete({
				input,
				dropdown,
				list,
				searcher: suggestionSearcher ?? createSuggestionSearcher([]),
				alignDropdown,
				getRecentSearches: () => getRecentSearchQueries(),
				onClearRecentSearches: () => {
					clearSearchHistory();
				},
				onRecentSearchSelect: (query) => {
					goToSearch(query);
				},
				matchDiscourses: (query) =>
					suggestDiscourses(
						discourseEntries,
						query,
						discourseSuggestLimit(),
					),
				onDiscourseSelect: (hit) => {
					goToHref(hit.href);
				},
				pageEntries,
				onPageSelect: (hit) => {
					goToHref(hit.href);
				},
			});
			// Indexes load on focus, so the user may already be in the box.
			if (document.activeElement === input) autocomplete.refresh();
		})();

		await loadPromise;
	}

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		void (async () => {
			await ensureAutocomplete();
			goToSearch(input.value);
		})();
	});

	// The indexes (~214 KB compressed) load on the first sign of intent rather
	// than at idle on every page: hover/touch land just before focus, so
	// suggestions are usually ready by the first keystroke.
	const load = () => {
		void ensureAutocomplete();
	};
	form.addEventListener("pointerenter", load, { once: true });
	input.addEventListener("pointerdown", load, { once: true });
	input.addEventListener("focus", load, { once: true });
	if (document.activeElement === input) load();
}
