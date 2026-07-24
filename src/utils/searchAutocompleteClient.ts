import type {
	ActiveToken,
	SuggestionIndexEntry,
} from "../types/suggestions";
import {
	applySuggestion,
	parseActiveToken,
} from "./suggestForToken";
import type { SuggestionSearcher } from "./suggestionSearcher";
import { highlightSuggestionText } from "./paliInflectionUtils";

const MIN_QUERY_LEN = 2;

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
}

export interface SearchAutocompleteController {
	destroy: () => void;
	close: () => void;
	isOpen: () => boolean;
}

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
	const { input, dropdown, list, searcher, onValueChange } = options;

	let open = false;
	let activeIndex = -1;
	let currentSuggestions: SuggestionIndexEntry[] = [];
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

	function close() {
		open = false;
		activeIndex = -1;
		currentSuggestions = [];
		currentToken = null;
		dropdown.classList.add("hidden");
		list.replaceChildren();
		setExpanded(false);
		input.removeAttribute("aria-activedescendant");
	}

	function positionDropdown(token: ActiveToken) {
		const offset = textMeasurer.measure(token.matchStart);
		dropdown.style.left = `${computeDropdownLeft(
			paddingLeft,
			offset,
			input.scrollLeft,
		)}px`;
	}

	function updateActiveOption() {
		const items = list.querySelectorAll<HTMLButtonElement>(".search-suggest-item");
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

	function renderSuggestions() {
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

		positionDropdown(currentToken);
		dropdown.classList.remove("hidden");
		open = true;
		setExpanded(true);
	}

	function refreshSuggestions() {
		const cursor = input.selectionStart ?? input.value.length;
		const token = parseActiveToken(input.value, cursor);
		currentToken = token;

		if (!token?.suggestable || token.raw.length < MIN_QUERY_LEN) {
			close();
			return;
		}

		const next = searcher.suggest(token.raw);
		if (next.length === 0) {
			close();
			return;
		}

		currentSuggestions = next;
		activeIndex = -1;
		renderSuggestions();
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

	function onInput() {
		refreshSuggestions();
	}

	function onClick() {
		refreshSuggestions();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!open || currentSuggestions.length === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			event.stopPropagation();
			activeIndex = (activeIndex + 1) % currentSuggestions.length;
			updateActiveOption();
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			event.stopPropagation();
			activeIndex =
				activeIndex <= 0
					? currentSuggestions.length - 1
					: activeIndex - 1;
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
			acceptSuggestion(activeIndex);
			return;
		}

		if (event.key === "Tab" && activeIndex >= 0) {
			event.preventDefault();
			event.stopPropagation();
			acceptSuggestion(activeIndex);
		}
	}

	function onListMouseDown(event: MouseEvent) {
		event.preventDefault();
		listMouseDown = true;
	}

	function onListClick(event: MouseEvent) {
		const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
			".search-suggest-item",
		);
		if (!target) return;
		const index = Number.parseInt(target.dataset.index ?? "", 10);
		if (!Number.isNaN(index)) {
			acceptSuggestion(index);
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
		if (open && currentToken) {
			positionDropdown(currentToken);
		}
	}

	input.addEventListener("input", onInput);
	input.addEventListener("click", onClick);
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
	};
}
