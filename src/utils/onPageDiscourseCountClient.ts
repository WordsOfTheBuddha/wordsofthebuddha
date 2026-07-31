import { resolveRefMode } from "./refModeClient";

export function discourseCountForRefMode(
	curated: number,
	reference: number,
	refOn: boolean,
): number {
	return refOn ? curated + reference : curated;
}

export function formatDiscourseCountLabel(count: number): string {
	return `${count} ${count === 1 ? "discourse" : "discourses"}`;
}

/** Update the header badge on `/on/{slug}` pages when ref mode changes. */
export function syncOnPageDiscourseCount(refOn = resolveRefMode()): void {
	const badge = document.getElementById("on-discourse-count-badge");
	if (!badge) return;

	const curated = Number(badge.dataset.curatedCount ?? "0");
	const reference = Number(badge.dataset.referenceCount ?? "0");
	const count = discourseCountForRefMode(curated, reference, refOn);
	badge.textContent = formatDiscourseCountLabel(count);
}
