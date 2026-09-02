import { isApplePlatform } from "./parentNavShortcut";
import { isEditableTarget, isElementVisible } from "./searchFocusShortcut";

/** Digits first (viewport is usually ≤9 cards), then a–z for overflow. */
export const LINK_HINT_LABELS = [
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	..."abcdefghijklmnopqrstuvwxyz",
] as const;

export const COLLECTION_LINK_HINT_ROOT_IDS = [
	"collections-grid",
	"discourses-grid",
] as const;

export const COLLECTION_LINK_HINTS_ROOT_ID = "collection-link-hints-root";

export type LinkHintAssignment = {
	label: string;
	link: HTMLAnchorElement;
};

export function isLinkHintModifierHeld(
	event: Pick<KeyboardEvent, "metaKey" | "altKey" | "ctrlKey">,
	isMac = isApplePlatform(),
): boolean {
	if (event.ctrlKey) return false;
	if (isMac) return event.metaKey && !event.altKey;
	return event.altKey && !event.metaKey;
}

export function isLinkHintModifierKey(
	event: Pick<KeyboardEvent, "key">,
	isMac = isApplePlatform(),
): boolean {
	if (isMac) return event.key === "Meta";
	return event.key === "Alt";
}

/** Normalize digit/letter activation keys to a hint label, or null. */
export function resolveLinkHintLabelKey(
	event: Pick<KeyboardEvent, "key">,
): string | null {
	const key = event.key.length === 1 ? event.key.toLowerCase() : "";
	if (/^[1-9]$/.test(key)) return key;
	if (/^[a-z]$/.test(key)) return key;
	return null;
}

export function isElementInViewport(
	el: Element,
	viewport: Pick<DOMRect, "top" | "right" | "bottom" | "left"> = {
		top: 0,
		left: 0,
		right: typeof window !== "undefined" ? window.innerWidth : 0,
		bottom: typeof window !== "undefined" ? window.innerHeight : 0,
	},
): boolean {
	const rect = el.getBoundingClientRect();
	return (
		rect.bottom > viewport.top &&
		rect.top < viewport.bottom &&
		rect.right > viewport.left &&
		rect.left < viewport.right &&
		rect.width > 0 &&
		rect.height > 0
	);
}

function hasHiddenAncestor(el: Element | null): boolean {
	let node: Element | null = el;
	while (node) {
		if (node.classList.contains("hidden")) return true;
		if (node.hasAttribute("hidden")) return true;
		node = node.parentElement;
	}
	return false;
}

function isGridAcceptingHints(grid: HTMLElement): boolean {
	if (grid.id === "collections-grid") {
		return !grid.classList.contains("hidden") && isElementVisible(grid);
	}
	// Discourses: panel may use display:contents while class "hidden" is
	// overridden by data-collection-view; trust visible post links instead.
	const panel = document.getElementById("discourses-panel");
	if (panel?.classList.contains("hidden")) {
		const forced =
			document.documentElement.getAttribute("data-collection-view") ===
			"discourses";
		if (!forced) return false;
	}
	return true;
}

export function collectViewportCollectionPostLinks(
	root: ParentNode = document,
): HTMLAnchorElement[] {
	const links: HTMLAnchorElement[] = [];
	for (const id of COLLECTION_LINK_HINT_ROOT_IDS) {
		const grid = root.querySelector<HTMLElement>(`#${id}`);
		if (!grid || !isGridAcceptingHints(grid)) continue;
		grid.querySelectorAll<HTMLAnchorElement>("a.post-link").forEach((link) => {
			const item = link.closest(".post-item");
			if (!item || hasHiddenAncestor(item)) return;
			if (!isElementVisible(link)) return;
			if (!isElementInViewport(link)) return;
			links.push(link);
		});
	}

	links.sort((a, b) => {
		const ar = a.getBoundingClientRect();
		const br = b.getBoundingClientRect();
		if (Math.abs(ar.top - br.top) > 4) return ar.top - br.top;
		return ar.left - br.left;
	});

	return links.slice(0, LINK_HINT_LABELS.length);
}

export function assignLinkHintLabels(
	links: HTMLAnchorElement[],
): LinkHintAssignment[] {
	return links.map((link, index) => ({
		label: LINK_HINT_LABELS[index]!,
		link,
	}));
}

function dialogBlocksLinkHints(): boolean {
	return Boolean(document.querySelector("dialog[open]"));
}

function ensureHintsRoot(): HTMLElement {
	let root = document.getElementById(COLLECTION_LINK_HINTS_ROOT_ID);
	if (root) return root;
	root = document.createElement("div");
	root.id = COLLECTION_LINK_HINTS_ROOT_ID;
	root.className = "collection-link-hints";
	root.setAttribute("aria-hidden", "true");
	document.body.appendChild(root);
	return root;
}

function clearHintsUi(): void {
	const root = document.getElementById(COLLECTION_LINK_HINTS_ROOT_ID);
	if (root) root.replaceChildren();
	document.documentElement.removeAttribute("data-collection-link-hints");
}

function renderHints(assignments: LinkHintAssignment[]): void {
	const root = ensureHintsRoot();
	root.replaceChildren();
	for (const { label, link } of assignments) {
		const rect = link.getBoundingClientRect();
		const badge = document.createElement("span");
		badge.className = "collection-link-hint";
		badge.textContent = label;
		badge.style.top = `${Math.max(4, rect.top + 4)}px`;
		badge.style.left = `${Math.max(4, rect.left - 2)}px`;
		root.appendChild(badge);
	}
	if (assignments.length > 0) {
		document.documentElement.setAttribute("data-collection-link-hints", "1");
	} else {
		document.documentElement.removeAttribute("data-collection-link-hints");
	}
}

/**
 * Hold ⌘ (Mac) / Alt (elsewhere) to show numbered shortcuts on viewport-visible
 * collection/discourse cards; press the label key while held to open the link.
 */
export function installCollectionLinkHints(): void {
	const w = window as unknown as { __collectionLinkHints?: boolean };
	if (w.__collectionLinkHints) return;
	w.__collectionLinkHints = true;

	let active = false;
	let assignments: LinkHintAssignment[] = [];
	let scrollRaf = 0;

	const hide = () => {
		active = false;
		assignments = [];
		clearHintsUi();
	};

	const refresh = () => {
		if (!active) return;
		assignments = assignLinkHintLabels(collectViewportCollectionPostLinks());
		if (assignments.length === 0) {
			clearHintsUi();
			return;
		}
		renderHints(assignments);
	};

	const show = () => {
		if (dialogBlocksLinkHints()) return;
		if (isEditableTarget(document.activeElement)) return;
		active = true;
		refresh();
	};

	const scheduleRefresh = () => {
		if (!active || scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			refresh();
		});
	};

	const activate = (label: string): boolean => {
		const hit = assignments.find((entry) => entry.label === label);
		if (!hit) return false;
		const href = hit.link.getAttribute("href");
		if (!href) return false;
		hide();
		window.location.assign(href);
		return true;
	};

	document.addEventListener(
		"keydown",
		(event) => {
			const isMac = isApplePlatform();

			if (isLinkHintModifierKey(event, isMac) && !event.repeat) {
				if (
					!dialogBlocksLinkHints() &&
					!isEditableTarget(document.activeElement)
				) {
					show();
				}
				return;
			}

			if (!isLinkHintModifierHeld(event, isMac)) return;

			const label = resolveLinkHintLabelKey(event);
			if (!label) return;

			if (!active) show();
			if (activate(label)) {
				event.preventDefault();
				event.stopPropagation();
			}
		},
		true,
	);

	document.addEventListener(
		"keyup",
		(event) => {
			if (!active) return;
			if (isLinkHintModifierKey(event, isApplePlatform())) {
				hide();
			}
		},
		true,
	);

	window.addEventListener(
		"blur",
		() => {
			if (active) hide();
		},
		true,
	);

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState !== "visible" && active) hide();
	});

	window.addEventListener("scroll", scheduleRefresh, { passive: true });
	window.addEventListener("resize", scheduleRefresh, { passive: true });

	document.addEventListener("astro:page-load", () => {
		if (active) hide();
	});
}
