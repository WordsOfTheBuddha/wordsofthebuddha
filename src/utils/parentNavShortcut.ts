import { isEditableTarget } from "./searchFocusShortcut";

export const PARENT_NAV_SELECTOR = "[data-nav-up]";
export const TOP_SCROLL_THRESHOLD_PX = 8;

export type ParentNavAction = "scroll-top" | "go-parent" | "none";

export function isApplePlatform(
	platform = typeof navigator !== "undefined" ? navigator.platform : "",
): boolean {
	return /Mac|iPhone|iPad/i.test(platform);
}

export function isScrolledToTop(
	scrollY: number,
	threshold = TOP_SCROLL_THRESHOLD_PX,
): boolean {
	return scrollY <= threshold;
}

export function shouldHandleParentNavShortcut(
	event: Pick<
		KeyboardEvent,
		| "key"
		| "ctrlKey"
		| "metaKey"
		| "altKey"
		| "shiftKey"
		| "defaultPrevented"
	>,
	activeElement: Element | null,
	isMac = isApplePlatform(),
): boolean {
	if (event.defaultPrevented) return false;
	if (event.key !== "ArrowUp") return false;
	if (event.shiftKey || event.ctrlKey) return false;
	if (isEditableTarget(activeElement)) return false;
	// Finder: ⌘↑. Explorer: Alt+↑. Never Win+↑ (snaps/maximizes the window).
	if (isMac) return event.metaKey && !event.altKey;
	return event.altKey && !event.metaKey;
}

export function resolveParentNavAction(
	atTop: boolean,
	parentHref: string | null,
): ParentNavAction {
	if (!atTop) return "scroll-top";
	return parentHref ? "go-parent" : "none";
}

export function resolveParentNavHref(
	root: ParentNode = document,
): string | null {
	const link = root.querySelector(PARENT_NAV_SELECTOR);
	if (!link || link.tagName.toLowerCase() !== "a") return null;
	const href = link.getAttribute("href");
	if (!href) return null;
	return href;
}

function dialogBlocksParentNav(): boolean {
	return Boolean(document.querySelector("dialog[open]"));
}

function applyParentNavHints(isMac = isApplePlatform()): void {
	const hint = isMac ? "⌘↑" : "Alt+↑";
	const shortcuts = isMac ? "Meta+ArrowUp" : "Alt+ArrowUp";
	document.querySelectorAll(PARENT_NAV_SELECTOR).forEach((link) => {
		link.setAttribute("aria-keyshortcuts", shortcuts);
		const kbd = link.querySelector("[data-parent-nav-kbd]");
		if (kbd) kbd.textContent = hint;
	});
}

/**
 * ⌘↑ / Alt+↑: jump to the top of the page, then (if already at top) open
 * the breadcrumb parent. Hover on the parent crumb, prev, or next shows
 * the matching shortcut — no persistent chrome.
 */
export function installParentNavShortcut(): void {
	applyParentNavHints();

	const w = window as unknown as { __parentNavShortcut?: boolean };
	if (w.__parentNavShortcut) return;
	w.__parentNavShortcut = true;

	document.addEventListener("astro:page-load", () => applyParentNavHints());
	document.addEventListener("keydown", (event) => {
		if (
			!shouldHandleParentNavShortcut(
				event,
				document.activeElement,
				isApplePlatform(),
			)
		) {
			return;
		}
		if (dialogBlocksParentNav()) return;

		const href = resolveParentNavHref();
		const action = resolveParentNavAction(
			isScrolledToTop(window.scrollY),
			href,
		);
		if (action === "none") return;

		event.preventDefault();
		if (action === "scroll-top") {
			window.scrollTo({ top: 0, left: 0, behavior: "auto" });
			return;
		}

		window.location.assign(href!);
	});
}
