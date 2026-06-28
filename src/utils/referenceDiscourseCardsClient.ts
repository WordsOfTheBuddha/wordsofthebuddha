import {
	deleteRefParam,
	initRefModeFromUrl,
	resolveRefMode,
	setRefParam,
	setStoredRefMode,
} from "./refModeClient";
import { compareDiscourseIds } from "./discourseSort";
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

function sortDiscourseGrid(grid: HTMLElement, mountId: string) {
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
		for (const entry of refs) {
			fragment.appendChild(renderReferenceCard(entry));
		}
		grid?.insertBefore(fragment, mount);
		sortDiscourseGrid(grid, mountId);
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
		for (const toggleRef of document.querySelectorAll("#toggle-ref")) {
			toggleRef.classList.toggle("font-medium", active);
			toggleRef.classList.toggle("text-[var(--link-color)]", active);
			toggleRef.classList.toggle("underline", active);
			toggleRef.classList.toggle("underline-offset-2", active);
			toggleRef.classList.toggle("text-[var(--text-muted)]", !active);
			toggleRef.setAttribute("aria-pressed", active ? "true" : "false");
		}
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
