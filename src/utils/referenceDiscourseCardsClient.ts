import { collectionLayoutDebugLog } from "./collectionLayoutDebug";
import {
	deleteRefParam,
	initRefModeFromUrl,
	resolveRefMode,
	setRefParam,
	setStoredRefMode,
} from "./refModeClient";
import { compareDiscourseIds } from "./discourseSort";
import { slugMatchesCollectionPattern } from "./collectionPatterns";
import { transformId } from "./transformId";

export interface ReferenceDiscourseCardsInitOptions {
	gridId?: string;
	mountId?: string;
	dataScriptId?: string;
	/** Re-apply client filter after ref cards change (CollectionLayout). */
	onAfterSync?: () => void;
	getActiveFilter?: () => string;
	applyFilter?: (filter: string) => void;
	syncRefToggleVisibility?: (visible: boolean) => void;
}

const isDev = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
	if (isDev) console.log("[ref-discourse-cards]", ...args);
}

function discourseLinkParams(refOn: boolean) {
	const params = new URLSearchParams();
	if (refOn) params.set("ref", "true");
	const paliMode = localStorage.getItem("paliMode") === "true";
	const layout = localStorage.getItem("layout") || "interleaved";
	if (paliMode) params.set("pli", "true");
	if (layout === "split") params.set("layout", layout);
	return params;
}

function discourseLinkHref(slug: string, refOn = true) {
	const base = `/${slug}`;
	const params = discourseLinkParams(refOn);
	const qs = params.toString();
	return qs ? `${base}?${qs}` : base;
}

function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function slugFromPostItem(post: Element) {
	const href =
		post.querySelector("a.post-link")?.getAttribute("data-base-href") ||
		"";
	return href.replace(/^\//, "");
}

function getReferencePostsData(dataScriptId: string) {
	const el = document.getElementById(dataScriptId);
	if (!el?.textContent?.trim()) {
		debugLog("reference-posts-data element missing or empty");
		return [] as Array<{
			slug: string;
			title: string;
			description: string;
		}>;
	}
	try {
		const data = JSON.parse(el.textContent);
		debugLog("parsed referencePostsData", { count: data.length });
		return data;
	} catch (err) {
		console.error("[ref-discourse-cards] JSON parse failed", err);
		return [];
	}
}

function renderReferenceCard(entry: {
	slug: string;
	title: string;
	description: string;
}) {
	const href = discourseLinkHref(entry.slug);
	const card = document.createElement("div");
	card.className =
		"post-item post-item--reference not-prose relative flex flex-col w-full p-3 mt-[1em] mb-[0.8em] rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--surface-border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--surface-elevated)_85%,transparent)] opacity-80 hover:opacity-100 shadow-none hover:shadow-sm text-[var(--surface-ink)] transition-shadow duration-200";
	card.dataset.slug = entry.slug;
	card.innerHTML = `
			<div class="flex items-start justify-between">
				<div class="flex items-start flex-grow">
					<div class="min-w-0 pr-4">
						<h2 class="my-0 text-base sm:text-lg font-semibold text-text leading-snug">
							<a href="${escapeHtml(href)}" class="post-link text-[var(--text-muted)] hover:text-[var(--link-color)] id font-normal" data-base-href="/${escapeHtml(entry.slug)}">
								${escapeHtml(transformId(entry.slug))}&nbsp;<span style="color:var(--text-color)">${escapeHtml(entry.title)}</span>
							</a>
						</h2>
					</div>
				</div>
			</div>
			<p class="mt-2 text-text line-clamp-3 md:line-clamp-2 text-sm sm:text-base">${escapeHtml(entry.description || "")}</p>
		`;
	return card;
}

function sortPostsGrid(grid: HTMLElement) {
	const items = [...grid.querySelectorAll(":scope > .post-item")];
	items.sort((a, b) =>
		compareDiscourseIds(slugFromPostItem(a), slugFromPostItem(b)),
	);
	for (const item of items) {
		grid.appendChild(item);
	}
}

function revealVaggaSection(section: HTMLElement | null) {
	section?.classList.remove("hidden");
	section?.closest(".book-section")?.classList.remove("hidden");
}

function hideEmptyVaggaSections(grid: HTMLElement) {
	for (const section of grid.querySelectorAll<HTMLElement>(
		".vagga-section[id]",
	)) {
		const postsGrid = section.querySelector(":scope > .posts-grid");
		const hasPosts = postsGrid?.querySelector(":scope > .post-item");
		section.classList.toggle("hidden", !hasPosts);
	}
}

function isSectionedLayout(grid: HTMLElement): boolean {
	return !!(
		grid.querySelector(":scope > .book-section") ||
		grid.querySelector(":scope > .vagga-section")
	);
}

function findFlatBookPostsGrid(
	grid: HTMLElement,
	bookSlug: string,
): HTMLElement | null {
	const book = grid.querySelector<HTMLElement>(
		`:scope > .book-section#${CSS.escape(bookSlug)}`,
	);
	if (!book) return null;
	return book.querySelector<HTMLElement>(
		":scope .book-flat-section > .posts-grid",
	);
}

function findVaggaSectionElement(
	grid: HTMLElement,
	slug: string,
): HTMLElement | null {
	for (const section of grid.querySelectorAll<HTMLElement>(
		":scope > .book-section .vagga-section[id], :scope > .vagga-section[id]",
	)) {
		if (slugMatchesCollectionPattern(slug, section.id)) {
			return section;
		}
	}
	return null;
}

function findTargetPostsGrid(
	grid: HTMLElement,
	slug: string,
): HTMLElement | null {
	const vaggaSection = findVaggaSectionElement(grid, slug);
	const vaggaGrid = vaggaSection?.querySelector<HTMLElement>(
		":scope > .posts-grid",
	);
	if (vaggaGrid) return vaggaGrid;

	const bookMatch = slug.match(/^([a-z]+\d+)/);
	if (bookMatch) {
		return findFlatBookPostsGrid(grid, bookMatch[1]);
	}
	return null;
}

function sortDiscourseGrid(grid: HTMLElement, mountId: string) {
	const bookScoped = grid.querySelector(":scope > .book-section");
	if (bookScoped) {
		for (const postsGrid of grid.querySelectorAll<HTMLElement>(
			".book-section .posts-grid",
		)) {
			sortPostsGrid(postsGrid);
		}
		return;
	}

	const sectioned = grid.querySelector(":scope > .vagga-section");
	if (sectioned) {
		for (const postsGrid of grid.querySelectorAll<HTMLElement>(
			":scope > .vagga-section .posts-grid",
		)) {
			sortPostsGrid(postsGrid);
		}
		return;
	}

	const mount = document.getElementById(mountId);
	const items = [...grid.querySelectorAll(":scope > .post-item")];
	items.sort((a, b) =>
		compareDiscourseIds(slugFromPostItem(a), slugFromPostItem(b)),
	);
	for (const item of items) {
		grid.insertBefore(item, mount);
	}
	debugLog("sorted discourse grid", { total: items.length });
}

export function initReferenceDiscourseCards(
	options: ReferenceDiscourseCardsInitOptions = {},
) {
	const gridId = options.gridId ?? "discourses-grid";
	const mountId = options.mountId ?? "reference-cards-mount";
	const dataScriptId = options.dataScriptId ?? "reference-posts-data";

	const grid = document.getElementById(gridId);
	if (!grid) return;

	const mount = document.getElementById(mountId);
	if (!mount) return;

	function updateDiscoursePostLinks() {
		const refOn = resolveRefMode();
		const params = discourseLinkParams(refOn);
		const qs = params.toString();
		document.querySelectorAll("a.post-link").forEach((link) => {
			const baseHref = link.getAttribute("data-base-href");
			if (!baseHref) return;
			(link as HTMLAnchorElement).href = qs
				? `${baseHref}?${qs}`
				: baseHref;
		});
	}

	function removeReferenceCards() {
		grid
			?.querySelectorAll(".post-item--reference")
			.forEach((el) => el.remove());
		if (grid) hideEmptyVaggaSections(grid);
		debugLog("removed reference cards");
	}

	function loadReferenceCards() {
		const existingSlugs = new Set(
			[...(grid?.querySelectorAll("a.post-link") ?? [])].map(
				(a) =>
					a.getAttribute("data-base-href")?.replace(/^\//, "") || "",
			),
		);
		debugLog("existing EN slugs on page", existingSlugs.size);

		const referencePostsData = getReferencePostsData(dataScriptId);
		const refs = referencePostsData.filter(
			(entry) => !existingSlugs.has(entry.slug),
		);
		debugLog("refs to append", {
			total: referencePostsData.length,
			afterDedup: refs.length,
		});

		grid
			?.querySelectorAll(".post-item--reference")
			.forEach((el) => el.remove());

		if (!refs.length) {
			debugLog("no reference cards to append");
			return;
		}

		const fragment = document.createDocumentFragment();
		const sectioned = isSectionedLayout(grid);
		const unmatched: HTMLElement[] = [];

		for (const entry of refs) {
			const card = renderReferenceCard(entry);
			if (sectioned) {
				const postsGrid = findTargetPostsGrid(grid, entry.slug);
				if (postsGrid) {
					const section = postsGrid.closest<HTMLElement>(
						".vagga-section, .book-flat-section",
					);
					revealVaggaSection(section);
					postsGrid.appendChild(card);
				} else {
					unmatched.push(card);
				}
			} else {
				fragment.appendChild(card);
			}
		}

		if (sectioned) {
			for (const card of unmatched) {
				const otherSection = grid.querySelector<HTMLElement>(
					":scope > .vagga-section:not([id]) .posts-grid, .book-section .book-flat-section .posts-grid",
				);
				(otherSection ?? grid).appendChild(card);
			}
		} else if (fragment.childNodes.length) {
			grid?.insertBefore(fragment, mount);
		}

		sortDiscourseGrid(grid, mountId);
		hideEmptyVaggaSections(grid);
		debugLog("appended reference cards", {
			count: refs.length,
			postItems: grid?.querySelectorAll(".post-item").length,
		});
	}

	function syncReferenceDiscourseCards() {
		const refOn = resolveRefMode();
		debugLog("syncReferenceDiscourseCards", {
			refOn,
			search: window.location.search,
		});

		if (!refOn) {
			removeReferenceCards();
		} else {
			loadReferenceCards();
		}

		if (options.applyFilter && options.getActiveFilter) {
			options.applyFilter(options.getActiveFilter());
		}
		options.onAfterSync?.();
	}

	function syncRefToggleState(active: boolean) {
		const toggles = document.querySelectorAll("#toggle-ref");
		for (const toggleRef of toggles) {
			toggleRef.classList.toggle("filter-toolbar-btn--active", active);
			toggleRef.setAttribute("aria-pressed", active ? "true" : "false");
		}
		collectionLayoutDebugLog("syncRefToggleState", {
			active,
			refParam: new URLSearchParams(window.location.search).get("ref"),
			toggleCount: toggles.length,
			toggles: [...toggles].map((el) => ({
				ariaPressed: el.getAttribute("aria-pressed"),
				hasActiveClass: el.classList.contains("filter-toolbar-btn--active"),
			})),
		});
	}

	function syncRefToggleVisibility(visible: boolean) {
		const hasRefData = !!document.getElementById(dataScriptId);
		const show = visible && hasRefData;
		for (const toggleRef of document.querySelectorAll("#toggle-ref")) {
			toggleRef.classList.toggle("hidden", !show);
		}
		options.syncRefToggleVisibility?.(show);
	}

	const showRef = initRefModeFromUrl();
	syncRefToggleVisibility(true);
	syncRefToggleState(showRef);
	syncReferenceDiscourseCards();
	updateDiscoursePostLinks();

	for (const toggleRef of document.querySelectorAll("#toggle-ref")) {
		toggleRef.addEventListener("click", (e) => {
			e.preventDefault();
			const url = new URL(window.location.href);
			const wasOn = resolveRefMode(url.searchParams);
			debugLog("toggle clicked", { wasOn });

			if (wasOn) {
				deleteRefParam(url);
				setStoredRefMode(false);
				syncRefToggleState(false);
				window.history.replaceState({}, "", url);
				syncReferenceDiscourseCards();
				updateDiscoursePostLinks();
				return;
			}

			setRefParam(url);
			setStoredRefMode(true);
			syncRefToggleState(true);
			window.history.replaceState({}, "", url);
			syncReferenceDiscourseCards();
			updateDiscoursePostLinks();
		});
	}

	return {
		syncRefToggleVisibility,
		syncReferenceDiscourseCards,
		updateDiscoursePostLinks,
	};
}
