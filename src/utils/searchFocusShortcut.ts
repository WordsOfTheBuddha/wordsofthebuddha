export const SEARCH_FOCUS_SELECTOR = "[data-search-focus]";
export const SEARCH_FOCUS_FALLBACK_HREF = "/search";

export function isEditableTarget(el: Element | null): boolean {
	if (!el) return false;
	const tag = el.tagName?.toLowerCase();
	if (!tag) return false;
	if ((el as HTMLElement).isContentEditable) return true;
	if (tag === "textarea" || tag === "select") return true;
	if (tag === "input") {
		const type = (el as HTMLInputElement).type?.toLowerCase() ?? "text";
		if (type === "range") return false;
		return true;
	}
	return false;
}

export function isElementVisible(el: HTMLElement): boolean {
	if (el.hasAttribute("hidden")) return false;
	if (typeof window === "undefined") return false;
	const style = window.getComputedStyle(el);
	if (style.display === "none" || style.visibility === "hidden") return false;
	return el.getClientRects().length > 0;
}

export function shouldHandleSearchFocusShortcut(
	event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "defaultPrevented">,
	activeElement: Element | null,
): boolean {
	if (event.defaultPrevented) return false;
	if (event.key !== "/") return false;
	if (event.ctrlKey || event.metaKey || event.altKey) return false;
	if (isEditableTarget(activeElement)) return false;
	return true;
}

function isSearchFocusField(el: Element): el is HTMLInputElement {
	return el.tagName.toLowerCase() === "input" || el.tagName.toLowerCase() === "textarea";
}

export function resolveSearchFocusTarget(
	candidates: Iterable<Element | null | undefined>,
	isVisible: (el: HTMLElement) => boolean = isElementVisible,
): HTMLInputElement | null {
	for (const candidate of candidates) {
		if (!candidate || !isSearchFocusField(candidate)) continue;
		if (!isVisible(candidate)) continue;
		return candidate;
	}
	return null;
}

function dialogBlocksSearchFocus(): boolean {
	return Boolean(document.querySelector("dialog[open]"));
}

function focusSearchInput(input: HTMLInputElement): void {
	input.focus();
	if (typeof input.select === "function") input.select();
}

/** `/` focuses the visible search field, or goes to /search when only the icon is shown. */
export function installSearchFocusShortcut(): void {
	const w = window as unknown as { __searchFocusShortcut?: boolean };
	if (w.__searchFocusShortcut) return;
	w.__searchFocusShortcut = true;

	document.addEventListener("keydown", (event) => {
		if (!shouldHandleSearchFocusShortcut(event, document.activeElement)) {
			return;
		}
		if (dialogBlocksSearchFocus()) return;

		const input = resolveSearchFocusTarget(
			document.querySelectorAll(SEARCH_FOCUS_SELECTOR),
		);
		event.preventDefault();
		if (input) {
			focusSearchInput(input);
			return;
		}
		window.location.assign(SEARCH_FOCUS_FALLBACK_HREF);
	});
}
