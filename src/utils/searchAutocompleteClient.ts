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
import type { DiscourseSuggestHit } from "./discourseIdSuggest";
import { compactDiscourseIdQuery } from "./discourseIdSuggest";

const MIN_INDEX_SUGGEST_LEN = 2;

const PTS_QUERY_RE = /^(?:pts:|volpage:|ref:|PTS\b|pts-vp-pli)/i;

/** Skip Pali/corpus autocomplete for citation lookups and numeric tokens like `1.` */
export function shouldOfferIndexSuggestions(
	query: string,
	tokenRaw: string,
): boolean {
	if (PTS_QUERY_RE.test(query.trim())) return false;
	if (tokenRaw.length < MIN_INDEX_SUGGEST_LEN) return false;
	const letters = tokenRaw
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-zA-Z]/g, "");
	if (tokenRaw.length === 2) return letters.length === 2;
	return tokenRaw.length >= 3;
}

/** Visible suggestion text: drop |term::gloss| markup and leftover pipes. */
export function displaySuggestionText(text: string): string {
	let s = (text || "").replace(/\|(.+?)::[^|]+\|/g, "$1");
	s = s.replace(/\|([^|:]+):::+[^|]*\|/g, "$1");
	s = s.replace(/\|/g, "");
	const cut = s.indexOf("::");
	if (cut >= 0) s = s.slice(0, cut);
	return s.replace(/\s+/g, " ").trim();
}

/** Inline layout so suggestions stack even if component CSS fails to load. */
function applySuggestionListLayout(listEl: HTMLElement) {
	listEl.style.display = "flex";
	listEl.style.flexDirection = "column";
	listEl.style.width = "100%";
	listEl.style.textAlign = "left";
}

function createSuggestionItemButton(
	inputId: string,
	index: number,
	options?: { recent?: boolean },
): HTMLButtonElement {
	const item = document.createElement("button");
	item.type = "button";
	item.id = options?.recent
		? `${inputId}-recent-${index}`
		: `${inputId}-suggestion-${index}`;
	item.className = options?.recent
		? "search-suggest-item search-suggest-recent"
		: "search-suggest-item";
	item.setAttribute("role", "option");
	item.dataset.index = String(index);
	item.style.display = "block";
	item.style.width = "100%";
	item.style.boxSizing = "border-box";
	item.style.textAlign = "left";
	if (options?.recent) {
		item.dataset.kind = "recent";
	}
	return item;
}

function createRecentHeader(onClear?: () => void): HTMLElement {
	const header = document.createElement("div");
	header.className = "search-suggest-header";
	header.style.display = "flex";
	header.style.alignItems = "center";
	header.style.justifyContent = "space-between";
	header.style.gap = "0.75rem";

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
		onClear?.();
	});

	header.append(label, clearBtn);
	return header;
}

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
	matchDiscourses?: (query: string) => DiscourseSuggestHit[];
	onDiscourseSelect?: (hit: DiscourseSuggestHit) => void;
	/** Stretch to the input, or grow left from a compact navbar field. */
	alignDropdown?: "stretch" | "end";
}

/** Highlight the first hit for ID-shaped queries so Enter goes to that discourse. */
export function discourseSuggestionActiveIndex(
	isIdQuery: boolean,
	hitCount: number,
): number {
	if (!isIdQuery || hitCount <= 0) return -1;
	return 0;
}

export interface SearchAutocompleteController {
	destroy: () => void;
	close: () => void;
	isOpen: () => boolean;
	refresh: () => void;
}

type DropdownMode = "recent" | "index" | "discourse";

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
		matchDiscourses,
		onDiscourseSelect,
		alignDropdown = "stretch",
	} = options;

	let open = false;
	let activeIndex = -1;
	let mode: DropdownMode | null = null;
	let currentSuggestions: SuggestionIndexEntry[] = [];
	let currentRecentItems: string[] = [];
	let currentDiscourseHits: DiscourseSuggestHit[] = [];
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
	applySuggestionListLayout(list);

	function setExpanded(expanded: boolean) {
		input.setAttribute("aria-expanded", expanded ? "true" : "false");
	}

	function resetDropdownPosition() {
		dropdown.style.left = "";
		dropdown.style.right = "";
		dropdown.style.width = "";
		dropdown.style.minWidth = "";
		dropdown.style.maxWidth = "";
	}

	function close() {
		open = false;
		activeIndex = -1;
		mode = null;
		currentSuggestions = [];
		currentRecentItems = [];
		currentDiscourseHits = [];
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
		dropdown.style.right = "auto";
		dropdown.style.width = "max-content";
		dropdown.style.minWidth = "10rem";
		dropdown.style.maxWidth = "min(24rem, 100%)";
	}

	function positionDropdownFullWidth() {
		if (alignDropdown === "end") {
			dropdown.style.left = "auto";
			dropdown.style.right = "0";
			dropdown.style.width = "min(24rem, calc(100vw - 2rem))";
			dropdown.style.minWidth = "100%";
			dropdown.style.maxWidth = "min(24rem, calc(100vw - 2rem))";
			return;
		}
		dropdown.style.left = "0";
		dropdown.style.right = "0";
		dropdown.style.width = "100%";
		dropdown.style.minWidth = "";
		dropdown.style.maxWidth = "none";
	}

	function getActiveItemCount(): number {
		if (mode === "recent") return currentRecentItems.length;
		if (mode === "discourse") return currentDiscourseHits.length;
		return currentSuggestions.length;
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
			const item = createSuggestionItemButton(inputId, index);
			item.innerHTML = highlightMatch(
				displaySuggestionText(entry.text),
				currentToken!.raw,
			);
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

		const header = createRecentHeader(() => {
			onClearRecentSearches?.();
			close();
		});
		list.appendChild(header);

		const prefix = input.value;
		currentRecentItems.forEach((query, index) => {
			const item = createSuggestionItemButton(inputId, index, { recent: true });
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

	function renderDiscourseSuggestions() {
		list.replaceChildren();
		if (currentDiscourseHits.length === 0) {
			close();
			return;
		}

		currentDiscourseHits.forEach((hit, index) => {
			const item = createSuggestionItemButton(inputId, index);
			item.classList.add("search-suggest-discourse");
			item.dataset.kind = "discourse";
			item.style.removeProperty("display");
			item.style.minWidth = "0";

			const metaEl = document.createElement("span");
			metaEl.className = "search-suggest-discourse-meta";

			const idEl = document.createElement("span");
			idEl.className = "search-suggest-id";
			idEl.textContent = hit.idLabel;
			metaEl.append(idEl);

			if (hit.referenceOnly) {
				const badge = document.createElement("span");
				badge.className = "search-suggest-ref";
				badge.textContent = "Ref";
				metaEl.append(" ", badge);
			}

			const titlesEl = document.createElement("span");
			titlesEl.className = "search-suggest-discourse-titles";

			if (hit.paliTitle) {
				const paliEl = document.createElement("span");
				paliEl.className = "search-suggest-pali";
				paliEl.textContent = hit.paliTitle;
				titlesEl.append(paliEl);
			}
			if (hit.paliTitle && hit.englishTitle) {
				const sep = document.createElement("span");
				sep.className = "search-suggest-title-sep";
				sep.textContent = " · ";
				titlesEl.append(sep);
			}
			if (hit.englishTitle) {
				const enEl = document.createElement("span");
				enEl.className = "search-suggest-en";
				enEl.textContent = hit.englishTitle;
				titlesEl.append(enEl);
			}

			const inner = document.createElement("span");
			inner.className = "search-suggest-discourse-inner";
			inner.append(metaEl, titlesEl);
			item.append(inner);

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

		if (
			!token?.suggestable ||
			!shouldOfferIndexSuggestions(input.value, token.raw)
		) {
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
		currentDiscourseHits = [];
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
		currentDiscourseHits = [];
		currentToken = null;
		currentRecentItems = filtered;
		activeIndex = -1;
		renderRecentSearches();
	}

	function refreshDiscourseSuggestions() {
		if (!matchDiscourses) return false;
		const isIdQuery = Boolean(compactDiscourseIdQuery(input.value));
		const next = matchDiscourses(input.value);
		if (next.length === 0) {
			if (isIdQuery) {
				close();
				return true;
			}
			return false;
		}

		mode = "discourse";
		currentSuggestions = [];
		currentRecentItems = [];
		currentToken = null;
		currentDiscourseHits = next;
		activeIndex = discourseSuggestionActiveIndex(isIdQuery, next.length);
		renderDiscourseSuggestions();
		return true;
	}

	function refresh() {
		if (PTS_QUERY_RE.test(input.value.trim())) {
			close();
			return;
		}
		if (refreshDiscourseSuggestions()) return;
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

		const next = applySuggestion(
			input.value,
			token,
			displaySuggestionText(entry.text) || entry.text,
		);
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

	function acceptDiscourse(index: number) {
		const hit = currentDiscourseHits[index];
		if (!hit) return;
		onDiscourseSelect?.(hit);
		close();
	}

	function acceptActive(index: number) {
		if (mode === "recent") {
			acceptRecentSearch(index);
			return;
		}
		if (mode === "discourse") {
			acceptDiscourse(index);
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
		refresh();
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
