import type {
	ActiveToken,
	SuggestionIndexEntry,
} from "../types/suggestions";
import { filterRecentSearches, highlightRecentSearchQuery, MAX_RECENT_SEARCHES_SHOWN } from "./searchHistoryClient";
import {
	applySuggestion,
	parseActiveToken,
} from "./suggestForToken";
import type { SuggestionSearcher } from "./suggestionSearcher";
import { highlightSuggestionText } from "./paliInflectionUtils";

const MIN_INDEX_SUGGEST_LEN = 2;

/** Visible left offset for the dropdown from the input wrapper (px). */
export function computeDropdownLeft(
	paddingLeft: number,
	textOffset: number,
	scrollLeft: number,
): number {
	return Math.max(paddingLeft, paddingLeft + textOffset - scrollLeft);
}

export interface SearchAutocompleteOptions {
	input: HTMLInputElement;
	dropdown: HTMLElement;
	list: HTMLElement;
	searcher: SuggestionSearcher;
	onValueChange?: (value: string) => void;
	getRecentSearches?: () => string[];
	onRecentSearchSelect?: (query: string) => void;
	onClearRecentSearches?: () => void;
}

export interface SearchAutocompleteController {
	destroy: () => void;
	close: () => void;
	isOpen: () => boolean;
	refresh: () => void;
}

type DropdownMode = "recent" | "index";

function highlightMatch(text: string, query: string): string {
	return highlightSuggestionText(text, query);
}

function createTextMeasurer(input: HTMLInputElement): {
	measure: (endIndex: number) => number;
	destroy: () => void;
} {
	const style = window.getComputedStyle(input);
	const mirror = document.createElement("span");
	mirror.setAttribute("aria-hidden", "true");
	mirror.style.cssText = [
		"position:absolute",
		"visibility:hidden",
		"white-space:pre",
		`font:${style.font}`,
		`letter-spacing:${style.letterSpacing}`,
	].join(";");
	document.body.appendChild(mirror);

	return {
		measure(endIndex: number) {
			if (endIndex <= 0) return 0;
			mirror.textContent = input.value.slice(0, endIndex);
			return mirror.getBoundingClientRect().width;
		},
		destroy() {
			mirror.remove();
		},
	};
}

export function attachSearchAutocomplete(
	options: SearchAutocompleteOptions,
): SearchAutocompleteController {
	const {
		input,
		dropdown,
		list,
		searcher,
		onValueChange,
		getRecentSearches,
		onRecentSearchSelect,
		onClearRecentSearches,
	} = options;

	let open = false;
	let activeIndex = -1;
	let mode: DropdownMode | null = null;
	let currentSuggestions: SuggestionIndexEntry[] = [];
	let currentRecentItems: string[] = [];
	let currentToken: ActiveToken | null = null;
	let listMouseDown = false;
	const textMeasurer = createTextMeasurer(input);
	const paddingLeft = Number.parseFloat(window.getComputedStyle(input).paddingLeft) || 0;

	const inputId = input.id || "search-input";
	const listId = `${inputId}-suggestions`;
	list.id = listId;
	list.setAttribute("role", "listbox");
	list.setAttribute("aria-label", "Search suggestions");
	input.setAttribute("role", "combobox");
	input.setAttribute("aria-autocomplete", "list");
	input.setAttribute("aria-expanded", "false");
	input.setAttribute("aria-controls", listId);

	function setExpanded(expanded: boolean) {
		input.setAttribute("aria-expanded", expanded ? "true" : "false");
	}

	function resetDropdownPosition() {
		dropdown.style.left = "";
		dropdown.style.right = "";
		dropdown.style.width = "";
	}

	function close() {
		open = false;
		activeIndex = -1;
		mode = null;
		currentSuggestions = [];
		currentRecentItems = [];
		currentToken = null;
		dropdown.classList.add("hidden");
		list.replaceChildren();
		resetDropdownPosition();
		setExpanded(false);
		input.removeAttribute("aria-activedescendant");
	}

	function positionDropdownAtToken(token: ActiveToken) {
		const offset = textMeasurer.measure(token.matchStart);
		dropdown.style.left = `${computeDropdownLeft(
			paddingLeft,
			offset,
			input.scrollLeft,
		)}px`;
		dropdown.style.right = "";
		dropdown.style.width = "";
	}

	function positionDropdownFullWidth() {
		dropdown.style.left = "0";
		dropdown.style.right = "0";
		dropdown.style.width = "100%";
	}

	function getActiveItemCount(): number {
		return mode === "recent"
			? currentRecentItems.length
			: currentSuggestions.length;
	}

	function updateActiveOption() {
		const items = list.querySelectorAll<HTMLButtonElement>(
			".search-suggest-item",
		);
		items.forEach((item, index) => {
			const isActive = index === activeIndex;
			item.classList.toggle("is-active", isActive);
			item.setAttribute("aria-selected", isActive ? "true" : "false");
			if (isActive) {
				input.setAttribute("aria-activedescendant", item.id);
			}
		});
		if (activeIndex < 0) {
			input.removeAttribute("aria-activedescendant");
		}
	}

	function renderIndexSuggestions() {
		list.replaceChildren();
		if (!currentToken || currentSuggestions.length === 0) {
			close();
			return;
		}

		currentSuggestions.forEach((entry, index) => {
			const item = document.createElement("button");
			item.type = "button";
			item.id = `${inputId}-suggestion-${index}`;
			item.className = "search-suggest-item";
			item.setAttribute("role", "option");
			item.dataset.index = String(index);
			item.innerHTML = highlightMatch(entry.text, currentToken!.raw);
			if (index === activeIndex) {
				item.classList.add("is-active");
				item.setAttribute("aria-selected", "true");
				input.setAttribute("aria-activedescendant", item.id);
			} else {
				item.setAttribute("aria-selected", "false");
			}
			list.appendChild(item);
		});

		positionDropdownAtToken(currentToken);
		dropdown.classList.remove("hidden");
		open = true;
		setExpanded(true);
	}

	function renderRecentSearches() {
		list.replaceChildren();
		if (currentRecentItems.length === 0) {
			close();
			return;
		}

		const header = document.createElement("div");
		header.className = "search-suggest-header";

		const label = document.createElement("span");
		label.className = "search-suggest-header-label";
		label.textContent = "Recent";

		const clearBtn = document.createElement("button");
		clearBtn.type = "button";
		clearBtn.className = "search-suggest-clear";
		clearBtn.textContent = "Clear all";
		clearBtn.addEventListener("mousedown", (event) => {
			event.preventDefault();
		});
		clearBtn.addEventListener("click", (event) => {
			event.stopPropagation();
			onClearRecentSearches?.();
			close();
		});

		header.append(label, clearBtn);
		list.appendChild(header);

		const prefix = input.value;
		currentRecentItems.forEach((query, index) => {
			const item = document.createElement("button");
			item.type = "button";
			item.id = `${inputId}-recent-${index}`;
			item.className = "search-suggest-item search-suggest-recent";
			item.setAttribute("role", "option");
			item.dataset.index = String(index);
			item.dataset.kind = "recent";
			item.innerHTML =
				prefix.trim().length > 0
					? highlightRecentSearchQuery(query, prefix.trim())
					: query.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			if (index === activeIndex) {
				item.classList.add("is-active");
				item.setAttribute("aria-selected", "true");
				input.setAttribute("aria-activedescendant", item.id);
			} else {
				item.setAttribute("aria-selected", "false");
			}
			list.appendChild(item);
		});

		positionDropdownFullWidth();
		dropdown.classList.remove("hidden");
		open = true;
		setExpanded(true);
	}

	function refreshIndexSuggestions() {
		const cursor = input.selectionStart ?? input.value.length;
		const token = parseActiveToken(input.value, cursor);
		currentToken = token;

		if (!token?.suggestable || token.raw.length < MIN_INDEX_SUGGEST_LEN) {
			close();
			return;
		}

		const next = searcher.suggest(token.raw);
		if (next.length === 0) {
			close();
			return;
		}

		mode = "index";
		currentRecentItems = [];
		currentSuggestions = next;
		activeIndex = -1;
		renderIndexSuggestions();
	}

	function refreshRecentSearches() {
		const all = getRecentSearches?.() ?? [];
		const filtered = filterRecentSearches(
			all,
			input.value,
			MAX_RECENT_SEARCHES_SHOWN,
		);

		if (filtered.length === 0) {
			close();
			return;
		}

		mode = "recent";
		currentSuggestions = [];
		currentToken = null;
		currentRecentItems = filtered;
		activeIndex = -1;
		renderRecentSearches();
	}

	function refresh() {
		if (input.value.length >= MIN_INDEX_SUGGEST_LEN) {
			refreshIndexSuggestions();
			return;
		}
		refreshRecentSearches();
	}

	function acceptSuggestion(index: number) {
		const entry = currentSuggestions[index];
		const token = currentToken;
		if (!entry || !token) return;

		const next = applySuggestion(input.value, token, entry.text);
		input.value = next.value;
		input.setSelectionRange(next.cursor, next.cursor);
		onValueChange?.(next.value);
		close();
	}

	function acceptRecentSearch(index: number) {
		const query = currentRecentItems[index];
		if (!query) return;
		input.value = query;
		onRecentSearchSelect?.(query);
		close();
	}

	function acceptActive(index: number) {
		if (mode === "recent") {
			acceptRecentSearch(index);
			return;
		}
		acceptSuggestion(index);
	}

	function onInput() {
		refresh();
	}

	function onClick() {
		refresh();
	}

	function onFocus() {
		if (input.value.length < MIN_INDEX_SUGGEST_LEN) {
			refreshRecentSearches();
		}
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!open || getActiveItemCount() === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			event.stopPropagation();
			const count = getActiveItemCount();
			activeIndex = (activeIndex + 1) % count;
			updateActiveOption();
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			event.stopPropagation();
			const count = getActiveItemCount();
			activeIndex =
				activeIndex <= 0 ? count - 1 : activeIndex - 1;
			updateActiveOption();
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			close();
			return;
		}

		if (event.key === "Enter" && activeIndex >= 0) {
			event.preventDefault();
			event.stopPropagation();
			acceptActive(activeIndex);
			return;
		}

		if (event.key === "Tab" && activeIndex >= 0) {
			event.preventDefault();
			event.stopPropagation();
			acceptActive(activeIndex);
		}
	}

	function onListMouseDown(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.closest(".search-suggest-clear")) return;
		event.preventDefault();
		listMouseDown = true;
	}

	function onListClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.closest(".search-suggest-clear")) return;

		const item = target.closest<HTMLButtonElement>(".search-suggest-item");
		if (!item) return;

		const index = Number.parseInt(item.dataset.index ?? "", 10);
		if (!Number.isNaN(index)) {
			acceptActive(index);
		}
		listMouseDown = false;
	}

	function onBlur() {
		if (listMouseDown) return;
		close();
	}

	function onDocumentMouseDown(event: MouseEvent) {
		const target = event.target as Node;
		if (dropdown.contains(target) || input.contains(target)) return;
		close();
	}

	function onScroll() {
		if (open && mode === "index" && currentToken) {
			positionDropdownAtToken(currentToken);
		}
	}

	input.addEventListener("input", onInput);
	input.addEventListener("click", onClick);
	input.addEventListener("focus", onFocus);
	input.addEventListener("scroll", onScroll);
	input.addEventListener("keydown", onKeyDown, true);
	input.addEventListener("blur", onBlur);
	list.addEventListener("mousedown", onListMouseDown);
	list.addEventListener("click", onListClick);
	document.addEventListener("mousedown", onDocumentMouseDown);

	return {
		destroy() {
			textMeasurer.destroy();
			input.removeEventListener("input", onInput);
			input.removeEventListener("click", onClick);
			input.removeEventListener("focus", onFocus);
			input.removeEventListener("scroll", onScroll);
			input.removeEventListener("keydown", onKeyDown, true);
			input.removeEventListener("blur", onBlur);
			list.removeEventListener("mousedown", onListMouseDown);
			list.removeEventListener("click", onListClick);
			document.removeEventListener("mousedown", onDocumentMouseDown);
			close();
		},
		close,
		isOpen: () => open,
		refresh,
	};
}
