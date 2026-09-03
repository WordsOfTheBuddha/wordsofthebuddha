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

export type LinkHintKind = "navigate" | "click";

export type LinkHintAssignment = {
	label: string;
	element: HTMLElement;
	kind: LinkHintKind;
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

export function hasHiddenAncestor(el: Element | null): boolean {
	let node: Element | null = el;
	while (node) {
		if (node.classList.contains("hidden")) return true;
		if (node.hasAttribute("hidden")) return true;
		node = node.parentElement;
	}
	return false;
}

function isHintableElement(el: HTMLElement): boolean {
	if (hasHiddenAncestor(el)) return false;
	if (!isElementVisible(el)) return false;
	if (!isElementInViewport(el)) return false;
	return true;
}

function sortByVisualOrder(a: Element, b: Element): number {
	const ar = a.getBoundingClientRect();
	const br = b.getBoundingClientRect();
	if (Math.abs(ar.top - br.top) > 4) return ar.top - br.top;
	return ar.left - br.left;
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

export function getVisibleDictionaryShell(
	root: ParentNode = document,
): HTMLElement | null {
	const popover = root.querySelector<HTMLElement>(".bottom-popover.visible");
	if (!popover) return null;
	const shell = popover.querySelector<HTMLElement>(".dict-shell");
	if (!shell || !isElementVisible(shell)) return null;
	return shell;
}

/**
 * DPD/PED tabs (when both exist) plus multi-chip PED headword switchers.
 * Only meaningful while the dictionary drawer is open.
 */
export function collectDictionaryHintTargets(
	root: ParentNode = document,
): HTMLElement[] {
	const shell = getVisibleDictionaryShell(root);
	if (!shell) return [];

	const targets: HTMLElement[] = [];

	const tabs = (
		[...shell.querySelectorAll<HTMLElement>("[data-dict-panel]")] as HTMLElement[]
	)
		.filter(isHintableElement)
		.sort((a, b) => {
			const order = (panel: string | null) =>
				panel === "dpd" ? 0 : panel === "ped" ? 1 : 9;
			return (
				order(a.getAttribute("data-dict-panel")) -
				order(b.getAttribute("data-dict-panel"))
			);
		});
	// Rotation only matters when both dictionaries are available.
	if (tabs.length >= 2) targets.push(...tabs);

	if (shell.getAttribute("data-dict-active") === "ped") {
		const fallbackChips = (
			[
				...shell.querySelectorAll<HTMLElement>(
					".ped-part-chips [data-ped-part]",
				),
			] as HTMLElement[]
		)
			.filter(isHintableElement)
			.sort(sortByVisualOrder);

		const constructionChips = (
			[
				...shell.querySelectorAll<HTMLElement>(
					".construction--ped-switcher [data-ped-part]",
				),
			] as HTMLElement[]
		)
			.filter(isHintableElement)
			.sort(sortByVisualOrder);

		const chips =
			fallbackChips.length >= 2
				? fallbackChips
				: constructionChips.length >= 2
					? constructionChips
					: [];
		targets.push(...chips);
	}

	return targets.slice(0, LINK_HINT_LABELS.length);
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

	links.sort(sortByVisualOrder);
	return links.slice(0, LINK_HINT_LABELS.length);
}

export function assignLinkHintLabels(
	elements: HTMLElement[],
	kind: LinkHintKind,
): LinkHintAssignment[] {
	return elements.map((element, index) => ({
		label: LINK_HINT_LABELS[index]!,
		element,
		kind,
	}));
}

/** Dictionary chrome wins while the drawer is open; otherwise collection cards. */
export function collectActiveLinkHintAssignments(
	root: ParentNode = document,
): LinkHintAssignment[] {
	const dictionary = collectDictionaryHintTargets(root);
	if (dictionary.length > 0) {
		return assignLinkHintLabels(dictionary, "click");
	}
	return assignLinkHintLabels(
		collectViewportCollectionPostLinks(root),
		"navigate",
	);
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

function positionHintBadge(
	badge: HTMLElement,
	element: HTMLElement,
	root: HTMLElement,
): void {
	const rect = element.getBoundingClientRect();
	const isDictTab = element.hasAttribute("data-dict-panel");
	const isDictChip = element.hasAttribute("data-ped-part");

	if (isDictTab || isDictChip) {
		// Sit in the gutter just left of the control — never over its label.
		badge.classList.add(
			isDictTab
				? "collection-link-hint--dict-tab"
				: "collection-link-hint--dict-chip",
		);
		badge.style.visibility = "hidden";
		root.appendChild(badge);
		const badgeRect = badge.getBoundingClientRect();
		const gap = 8;
		badge.style.left = `${Math.max(4, rect.left - gap - badgeRect.width)}px`;
		badge.style.top = `${rect.top + (rect.height - badgeRect.height) / 2}px`;
		badge.style.transform = "";
		badge.style.visibility = "";
		return;
	}

	badge.style.top = `${Math.max(4, rect.top + 4)}px`;
	badge.style.left = `${Math.max(4, rect.left - 2)}px`;
	badge.style.transform = "";
	root.appendChild(badge);
}

function renderHints(assignments: LinkHintAssignment[]): void {
	const root = ensureHintsRoot();
	root.replaceChildren();

	if (assignments.length === 0) {
		document.documentElement.removeAttribute("data-collection-link-hints");
		return;
	}

	// Apply spacing CSS before measuring so left-of-label badges track the
	// padded chip/tab positions rather than the pre-hint layout.
	document.documentElement.setAttribute("data-collection-link-hints", "1");
	void document.body.offsetWidth;

	for (const { label, element } of assignments) {
		const badge = document.createElement("span");
		badge.className = "collection-link-hint";
		badge.textContent = label;
		positionHintBadge(badge, element, root);
	}
}

/**
 * Hold ⌘ (Mac) / Alt (elsewhere) to show numbered shortcuts on:
 * - dictionary DPD/PED tabs + multi-chip PED switchers (when drawer is open)
 * - otherwise viewport-visible collection/discourse cards
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
		assignments = collectActiveLinkHintAssignments();
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

		if (hit.kind === "navigate") {
			const href =
				hit.element instanceof HTMLAnchorElement
					? hit.element.getAttribute("href")
					: null;
			if (!href) return false;
			hide();
			window.location.assign(href);
			return true;
		}

		hit.element.click();
		// Keep hints up while the modifier is held so tab→chip rotation can continue.
		requestAnimationFrame(() => {
			if (active) refresh();
		});
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
