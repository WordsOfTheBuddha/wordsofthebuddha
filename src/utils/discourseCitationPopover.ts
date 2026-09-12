import { transformId } from "./transformId";

export type CitationPopoverHit = {
	slug: string;
	href?: string;
	title?: string;
	description?: string;
};

const BOUND_ROOTS = new WeakSet<EventTarget>();
const PANEL_ID = "ai-citation-popover";
const HIDE_MS = 200;

let hideActivePopover: (() => void) | null = null;

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Path slug from a report citation href (`/mn58`, `/mn58#p2`). */
export function slugFromCitationHref(href: string): string {
	const trimmed = (href || "").trim();
	if (!trimmed || trimmed.startsWith("#")) return "";
	const path = trimmed
		.split("#")[0]
		.split("?")[0]
		.replace(/^https?:\/\/[^/]+/i, "")
		.replace(/^\//, "")
		.replace(/\/$/, "");
	const slug = path.split("/")[0] || "";
	return slug.toLowerCase();
}

/**
 * Persons-index title line: `MN 58 - Abhayarājakumāra sutta - To Prince Abhaya`.
 */
export function formatDiscourseCitationTitle(
	slug: string,
	title: string,
): string {
	const id = transformId(slug) || slug.replace(/\s+/g, " ").trim();
	const label = (title || "").replace(/\s+/g, " ").trim();
	if (!id) return label;
	if (
		!label ||
		label.toLowerCase() === slug.toLowerCase() ||
		label.toLowerCase() === id.toLowerCase()
	) {
		return id;
	}
	if (label.toLowerCase().startsWith(`${id.toLowerCase()} -`)) return label;
	return `${id} - ${label}`;
}

export function citationPopoverMeta(
	hit: CitationPopoverHit,
): { title: string; description: string } | null {
	const slug = (hit.slug || "").trim().toLowerCase();
	if (!slug) return null;
	const title = formatDiscourseCitationTitle(slug, hit.title || "");
	const description = (hit.description || "").replace(/\s+/g, " ").trim();
	if (!title && !description) return null;
	return { title, description };
}

function citationPopoverLookup(
	results: readonly CitationPopoverHit[],
): Map<string, { title: string; description: string }> {
	const map = new Map<string, { title: string; description: string }>();
	for (const hit of results) {
		const meta = citationPopoverMeta(hit);
		if (!meta) continue;
		const slug = hit.slug.trim().toLowerCase();
		map.set(slug, meta);
		const hrefSlug = slugFromCitationHref(hit.href || `/${slug}`);
		if (hrefSlug) map.set(hrefSlug, meta);
	}
	return map;
}

function hasSummaryRefClass(attrs: string): boolean {
	const match = attrs.match(/\bclass\s*=\s*"([^"]*)"/i);
	return !!match && /\bai-summary-ref\b/.test(match[1] || "");
}

/**
 * Attach title/description data attributes to on-screen report citation links.
 * PDF and EPUB omit this pass so export HTML stays a plain link.
 */
export function annotateResearchCitationLinks(
	html: string,
	results: readonly CitationPopoverHit[],
): string {
	const lookup = citationPopoverLookup(results);
	if (lookup.size === 0) return html;
	return html.replace(/<a\b([^>]*?)>/gi, (open, attrs: string) => {
		if (!hasSummaryRefClass(attrs) || /\bdata-cite-title\s*=/.test(attrs)) {
			return open;
		}
		const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
		const slug = slugFromCitationHref(hrefMatch?.[1] || "");
		const meta = slug ? lookup.get(slug) : undefined;
		if (!meta) return open;
		const titleAttr = ` data-cite-title="${escapeAttr(meta.title)}"`;
		const descAttr = meta.description
			? ` data-cite-desc="${escapeAttr(meta.description)}"`
			: "";
		return `<a${attrs}${titleAttr}${descAttr}>`;
	});
}

function citationLinkFromEvent(target: EventTarget | null): HTMLAnchorElement | null {
	if (!(target instanceof Element)) return null;
	const link = target.closest("a.ai-summary-ref[data-cite-title]");
	if (!(link instanceof HTMLAnchorElement)) return null;
	if (!link.closest(".ai-report")) return null;
	return link;
}

function ensurePanel(): HTMLElement {
	let panel = document.getElementById(PANEL_ID);
	if (!panel) {
		panel = document.createElement("div");
		panel.id = PANEL_ID;
		panel.className = "ai-citation-popover";
		panel.setAttribute("aria-hidden", "true");
		document.body.appendChild(panel);
	}
	if (!panel.querySelector(".ai-citation-popover-body")) {
		panel.innerHTML =
			'<div class="ai-citation-popover-body">' +
			'<p class="ai-citation-popover-title"></p>' +
			'<p class="ai-citation-popover-desc"></p>' +
			"</div>" +
			'<div class="ai-citation-popover-arrow" aria-hidden="true"></div>';
	}
	if (panel.parentElement !== document.body) {
		document.body.appendChild(panel);
	}
	return panel;
}

function positionPanel(link: HTMLElement, panel: HTMLElement): void {
	const rect = link.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const spaceAbove = rect.top;
	const spaceBelow = viewportHeight - rect.bottom;
	const openDown = spaceAbove < 150 && spaceBelow > spaceAbove;
	panel.classList.toggle("opens-down", openDown);

	const maxHeight = Math.min((openDown ? spaceBelow : spaceAbove) - 20, 400);
	panel.style.setProperty(
		"--popover-max-height",
		`${Math.max(80, maxHeight)}px`,
	);

	const panelWidth = panel.offsetWidth;
	const panelHeight = panel.offsetHeight;
	const centerX = rect.left + rect.width / 2;
	const left = Math.max(
		10,
		Math.min(centerX - panelWidth / 2, viewportWidth - panelWidth - 10),
	);
	const gap = 10;
	const top = openDown
		? rect.bottom + gap
		: Math.max(10, rect.top - panelHeight - gap);
	panel.style.left = `${left}px`;
	panel.style.top = `${top}px`;

	const arrow = panel.querySelector(".ai-citation-popover-arrow");
	if (arrow instanceof HTMLElement) {
		arrow.style.left = `${centerX - left}px`;
	}
}

/** Hover/focus popover for research-report citations; one listener per thread. */
export function installDiscourseCitationPopovers(root: EventTarget): void {
	if (typeof document === "undefined") return;
	if (BOUND_ROOTS.has(root)) return;
	BOUND_ROOTS.add(root);

	let activeLink: HTMLAnchorElement | null = null;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	const clearHide = () => {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	};

	const hide = () => {
		clearHide();
		activeLink = null;
		const panel = document.getElementById(PANEL_ID);
		if (!panel) return;
		panel.classList.remove("is-shown", "opens-down");
		panel.setAttribute("aria-hidden", "true");
	};
	hideActivePopover = hide;

	const scheduleHide = () => {
		clearHide();
		hideTimer = setTimeout(() => {
			if (activeLink && !activeLink.isConnected) {
				hide();
				return;
			}
			hide();
		}, HIDE_MS);
	};

	const show = (link: HTMLAnchorElement) => {
		const title = (link.getAttribute("data-cite-title") || "").trim();
		const description = (link.getAttribute("data-cite-desc") || "").trim();
		if (!title && !description) return;
		clearHide();
		activeLink = link;
		const panel = ensurePanel();
		const titleEl = panel.querySelector(".ai-citation-popover-title");
		const descEl = panel.querySelector(".ai-citation-popover-desc");
		if (titleEl instanceof HTMLElement) {
			titleEl.textContent = title;
			titleEl.hidden = !title;
		}
		if (descEl instanceof HTMLElement) {
			descEl.textContent = description;
			descEl.hidden = !description;
		}
		panel.classList.add("is-shown");
		panel.setAttribute("aria-hidden", "false");
		positionPanel(link, panel);
	};

	root.addEventListener("mouseover", (event) => {
		const link = citationLinkFromEvent(event.target);
		if (!link) return;
		show(link);
	});

	root.addEventListener("mouseout", (event) => {
		const from = citationLinkFromEvent(event.target);
		if (!from || from !== activeLink) return;
		const to = citationLinkFromEvent(
			"relatedTarget" in event ? event.relatedTarget : null,
		);
		if (to === from) return;
		scheduleHide();
	});

	root.addEventListener("focusin", (event) => {
		const link = citationLinkFromEvent(event.target);
		if (link) show(link);
	});

	root.addEventListener("focusout", (event) => {
		const from = citationLinkFromEvent(event.target);
		if (!from || from !== activeLink) return;
		const to = citationLinkFromEvent(
			"relatedTarget" in event ? event.relatedTarget : null,
		);
		if (to === from) return;
		scheduleHide();
	});

	window.addEventListener(
		"scroll",
		() => {
			if (!activeLink) return;
			if (!activeLink.isConnected) {
				hide();
				return;
			}
			positionPanel(activeLink, ensurePanel());
		},
		true,
	);

	window.addEventListener("resize", () => {
		if (activeLink?.isConnected) positionPanel(activeLink, ensurePanel());
		else if (activeLink) hide();
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && activeLink) hide();
	});
}

/** Drop a lingering hover when the report thread is rewritten. */
export function hideDiscourseCitationPopover(): void {
	hideActivePopover?.();
}
