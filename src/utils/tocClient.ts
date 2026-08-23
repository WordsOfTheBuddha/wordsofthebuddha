/**
 * Shared table-of-contents helpers for long posts and sectioned discourses.
 *
 * Discourses use ### / #### / ##### headings. Unexpected # / ## are shown
 * as top-level, same as ###. Verse numbers (Dhp “179”) and AN range ids
 * (“1.268”) are omitted so a ToC only appears when there are named
 * sections to navigate — typically MN and DN, and some longer SN/AN suttas.
 */

import { slugify } from "./slugify";

export const DISCOURSE_TOC_MIN_HEADINGS = 2;
export const DISCOURSE_TOC_HEADING_SELECTOR = "h1, h2, h3, h4, h5";

const LETTER_RE = /\p{L}/u;
const GLOSS_RE = /\|([^:|]+)::[^|]*\|/g;

export function headingLabel(text: string): string {
	return text.replace(GLOSS_RE, "$1").replace(/\s+/g, " ").trim();
}

/** True when a heading is a named section, not a verse number or sutta id. */
export function isNamedSectionHeading(text: string): boolean {
	return LETTER_RE.test(headingLabel(text));
}

export function slugifyHeading(text: string): string {
	return slugify(headingLabel(text));
}

export function namedSectionHeadingsFromMarkdown(markdown: string): string[] {
	const headings: string[] = [];
	for (const match of markdown.matchAll(/^#{1,5}\s+(.+)$/gm)) {
		const label = headingLabel(match[1] ?? "");
		if (isNamedSectionHeading(label)) headings.push(label);
	}
	return headings;
}

export function shouldShowDiscourseToc(
	markdown: string,
	minHeadings: number = DISCOURSE_TOC_MIN_HEADINGS,
): boolean {
	return namedSectionHeadingsFromMarkdown(markdown).length >= minHeadings;
}

export interface AttachTableOfContentsOptions {
	contentSelector: string;
	headingSelector: string;
	nestedTag: string;
	minHeadings: number;
	requireNamed: boolean;
	placement?: "grid" | "fixed";
	desktopNavId: string;
	mobileNavId: string;
	mobileToggleId: string;
	mobileOverlayId: string;
	mobileCloseId: string;
	activeClass?: string;
}

function expectsSplitView(): boolean {
	if (!document.documentElement.classList.contains("pali-on")) return false;
	if (window.innerWidth < 768) return false;
	return (
		document.documentElement.classList.contains("split") ||
		localStorage.getItem("layout") === "split"
	);
}

function isElementVisible(el: HTMLElement): boolean {
	if (el.closest('[aria-hidden="true"]')) return false;
	if (typeof el.checkVisibility === "function") {
		return el.checkVisibility({ checkOpacity: false });
	}
	return el.getClientRects().length > 0;
}

function resolveContentRoot(selector: string): HTMLElement | null {
	const nodes = document.querySelectorAll<HTMLElement>(selector);
	for (const node of nodes) {
		if (isElementVisible(node)) return node;
	}
	return document.querySelector<HTMLElement>(selector);
}

function findById(root: ParentNode, id: string): HTMLElement | null {
	if (root instanceof HTMLElement && root.id === id) return root;
	const escaped = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return root.querySelector<HTMLElement>(`[id="${escaped}"]`);
}

/**
 * Heading ids are duplicated in split view (interleaved source + English
 * panel). `getElementById` / native hash scroll hit the hidden copy first.
 */
export function findVisibleElementById(id: string): HTMLElement | null {
	if (!id) return null;
	const escaped = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	const matches = document.querySelectorAll<HTMLElement>(`[id="${escaped}"]`);
	for (const el of matches) {
		if (isElementVisible(el)) return el;
	}
	return null;
}

function visibleHeadingForId(id: string): HTMLElement | null {
	if (expectsSplitView()) {
		const panel = document.getElementById("panel1");
		if (!panel) return null;
		const inPanel = findById(panel, id);
		if (inPanel && isElementVisible(inPanel)) return inPanel;
		return null;
	}

	return findVisibleElementById(id);
}

/** Reading line used for ToC scroll-spy and hash scroll, in viewport pixels. */
export const TOC_SCROLL_OFFSET_PX = 100;

/**
 * Headings this far below the reading line still count as current.
 * Smooth-scroll and subpixel rounding often land a few pixels short.
 */
export const TOC_ACTIVE_SLACK_PX = 8;

/** Extra pixels past the reading line when jumping to a heading. */
const TOC_SCROLL_NUDGE_PX = 4;

/**
 * The current section is the last heading whose top has passed `anchorY`
 * (optionally plus `slackPx`). Until the next title reaches that line, the
 * previous section stays active. If no title has reached the line yet —
 * a prologue before the first section — there is no active item.
 */
export function pickActiveHeadingId(
	headings: ReadonlyArray<{ id: string; top: number }>,
	anchorY: number,
	slackPx: number = 0,
): string | null {
	let activeId: string | null = null;
	for (const heading of headings) {
		if (heading.top <= anchorY + slackPx) activeId = heading.id;
	}
	return activeId;
}

export function scrollYToAlignHeading(
	headingTop: number,
	pageYOffset: number,
): number {
	return Math.max(
		0,
		Math.ceil(
			headingTop + pageYOffset - TOC_SCROLL_OFFSET_PX + TOC_SCROLL_NUDGE_PX,
		),
	);
}

export function scrollToVisibleId(id: string): boolean {
	const heading = visibleHeadingForId(id);
	if (!heading) return false;
	const rect = heading.getBoundingClientRect();
	window.scrollTo({
		top: scrollYToAlignHeading(rect.top, window.scrollY),
		behavior: "smooth",
	});
	return true;
}

function ensureHeadingId(heading: HTMLElement): string {
	if (heading.id) return heading.id;
	heading.id = slugifyHeading(heading.textContent || "");
	return heading.id;
}

function headingLevel(tagName: string): number {
	const level = Number.parseInt(tagName.replace(/^H/i, ""), 10);
	return Number.isFinite(level) ? level : 0;
}

/** Top section level: H3 on discourses (nestedTag H4), H2 on essays (nestedTag H3). */
export function tocBaseLevel(nestedTag: string): number {
	const nested = headingLevel(nestedTag);
	return nested > 1 ? nested - 1 : 2;
}

/**
 * H1/H2 fold into the top section level. Depth is 0 for that level, 1 for the
 * next (h4 / essay h3), 2 for h5.
 */
export function tocDepth(tagName: string, baseLevel: number): number {
	const level = headingLevel(tagName);
	if (level <= 0) return 0;
	return Math.max(0, Math.max(level, baseLevel) - baseLevel);
}

export function tocLinkClass(
	tagName: string,
	baseLevel: number,
	minDepth: number,
): string {
	const depth = Math.max(0, tocDepth(tagName, baseLevel) - minDepth);
	if (depth <= 0) return "";
	if (depth === 1) return "toc-h3";
	return "toc-h5";
}

function collectHeadings(
	root: HTMLElement,
	headingSelector: string,
	requireNamed: boolean,
): HTMLElement[] {
	const headings = Array.from(
		root.querySelectorAll<HTMLElement>(headingSelector),
	);
	if (!requireNamed) return headings;
	return headings.filter((heading) =>
		isNamedSectionHeading(heading.textContent || ""),
	);
}

function createTocLink(heading: HTMLElement, className: string): HTMLAnchorElement {
	const id = ensureHeadingId(heading);
	const link = document.createElement("a");
	link.href = `#${id}`;
	link.textContent = headingLabel(heading.textContent || "");
	if (className) link.className = className;
	return link;
}

export function attachTableOfContents(
	options: AttachTableOfContentsOptions,
): boolean {
	const nav = document.getElementById(options.desktopNavId);
	if (!nav) return false;

	const contentRoot = resolveContentRoot(options.contentSelector);
	if (!contentRoot) return false;

	const headings = collectHeadings(
		contentRoot,
		options.headingSelector,
		options.requireNamed,
	);
	if (headings.length < options.minHeadings) return false;

	const baseLevel = tocBaseLevel(options.nestedTag);
	const minDepth = Math.min(
		...headings.map((heading) => tocDepth(heading.tagName, baseLevel)),
	);

	nav.replaceChildren();
	for (const heading of headings) {
		nav.appendChild(
			createTocLink(
				heading,
				tocLinkClass(heading.tagName, baseLevel, minDepth),
			),
		);
	}

	const mobileNav = document.getElementById(options.mobileNavId);
	const mobileToggle = document.getElementById(options.mobileToggleId);
	const mobileOverlay = document.getElementById(options.mobileOverlayId);
	const mobileClose = document.getElementById(options.mobileCloseId);

	if (mobileNav) {
		mobileNav.replaceChildren();
		for (const heading of headings) {
			mobileNav.appendChild(
				createTocLink(
					heading,
					tocLinkClass(heading.tagName, baseLevel, minDepth),
				),
			);
		}
	}

	if (options.activeClass) {
		document.documentElement.classList.add(options.activeClass);
	}
	if (options.placement !== "fixed") {
		document.querySelector(".toc-shell")?.classList.add("toc-reserve");
	}

	const navs = [nav, mobileNav];
	let pinnedHeadingId: string | null = null;

	function setActiveTocLink(headingId: string | null) {
		const href = headingId ? `#${headingId}` : null;
		for (const toc of navs) {
			if (!toc) continue;
			for (const link of toc.querySelectorAll("a")) {
				link.classList.toggle(
					"active",
					href !== null && link.getAttribute("href") === href,
				);
			}
		}
	}

	function updateActiveFromScroll() {
		if (pinnedHeadingId) {
			setActiveTocLink(pinnedHeadingId);
			return;
		}
		const tops = [];
		for (const heading of headings) {
			const visible = visibleHeadingForId(heading.id);
			if (!visible) continue;
			tops.push({
				id: heading.id,
				top: visible.getBoundingClientRect().top,
			});
		}
		if (tops.length === 0) return;
		setActiveTocLink(
			pickActiveHeadingId(tops, TOC_SCROLL_OFFSET_PX, TOC_ACTIVE_SLACK_PX),
		);
	}

	function scrollToHeading(event: Event) {
		const link = (event.target as HTMLElement | null)?.closest("a");
		if (!link) return;
		const href = link.getAttribute("href") || "";
		if (!href.startsWith("#") || href.length < 2) return;
		let id = href.slice(1);
		try {
			id = decodeURIComponent(id);
		} catch {
			/* keep raw id */
		}
		event.preventDefault();
		pinnedHeadingId = id;
		setActiveTocLink(id);
		window.setTimeout(() => {
			if (pinnedHeadingId !== id) return;
			pinnedHeadingId = null;
			updateActiveFromScroll();
		}, 1000);
		const tryScroll = (attempt = 0) => {
			if (scrollToVisibleId(id) || attempt >= 12) return;
			setTimeout(() => tryScroll(attempt + 1), 50);
		};
		tryScroll();
	}

	nav.addEventListener("click", scrollToHeading);

	if (mobileNav && mobileToggle && mobileOverlay) {
		mobileToggle.classList.remove("opacity-0", "invisible");
		mobileToggle.classList.add("opacity-100", "visible");

		const openMobileToc = () => {
			mobileOverlay.classList.add("open");
			document.body.style.overflow = "hidden";
		};
		const closeMobileToc = () => {
			mobileOverlay.classList.remove("open");
			document.body.style.overflow = "";
		};

		mobileToggle.addEventListener("click", openMobileToc);
		mobileClose?.addEventListener("click", closeMobileToc);
		mobileOverlay.addEventListener("click", (event) => {
			if (event.target === mobileOverlay) closeMobileToc();
		});
		mobileNav.addEventListener("click", (event) => {
			scrollToHeading(event);
			closeMobileToc();
		});
	}

	let ticking = false;
	function onScrollOrResize() {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			ticking = false;
			updateActiveFromScroll();
		});
	}

	function onScrollEnd() {
		pinnedHeadingId = null;
		updateActiveFromScroll();
	}

	window.addEventListener("scroll", onScrollOrResize, { passive: true });
	window.addEventListener("scrollend", onScrollEnd);
	window.addEventListener("resize", onScrollOrResize);
	document.addEventListener("layoutChanged", updateActiveFromScroll);
	document.addEventListener("paliModeChanged", updateActiveFromScroll);
	updateActiveFromScroll();

	return true;
}
