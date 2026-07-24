import { resolveRefMode } from "./refModeClient";

export type CollectionCountEntry = {
	translated: number;
	readable: number;
};

export function countForRefMode(
	entry: CollectionCountEntry,
	refOn: boolean,
): number {
	return refOn ? entry.readable : entry.translated;
}

export function syncCollectionCountBadges(
	counts: Record<string, CollectionCountEntry>,
	refOn = resolveRefMode(),
): void {
	const grid = document.getElementById("collections-grid");
	if (!grid) return;

	for (const item of grid.querySelectorAll<HTMLElement>(".post-item")) {
		const slug =
			item
				.querySelector("a.post-link")
				?.getAttribute("data-base-href")
				?.replace(/^\//, "") ?? "";
		const entry = counts[slug];
		if (!entry) continue;

		const count = countForRefMode(entry, refOn);
		const badgeWrap = item.querySelector<HTMLElement>(
			".collection-count-badge-wrap",
		);
		const badge = item.querySelector<HTMLElement>(
			".collection-count-badge",
		);
		if (!badgeWrap || !badge) continue;

		badge.textContent = String(count);
		badgeWrap.classList.toggle("hidden", count <= 0);
	}
}
