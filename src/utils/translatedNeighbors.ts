const LOCALE_COMPARE_OPTIONS: Intl.CollatorOptions = {
	numeric: true,
	sensitivity: "base",
};

export function collectionPrefix(slug: string): string {
	return (slug.match(/^[a-z]+/i)?.[0] || "").toLowerCase();
}

/**
 * For a discourse not in `routes`, find the nearest translated prev/next
 * within the same collection (e.g. sn48.52 → sn48.50 / sn48.53).
 */
export function findNearestTranslatedNeighbors(
	id: string,
	routeList: readonly string[],
): { prevId: string | null; nextId: string | null } {
	const prefix = collectionPrefix(id);
	if (!prefix) {
		return { prevId: null, nextId: null };
	}

	let prevId: string | null = null;
	let nextId: string | null = null;

	for (const route of routeList) {
		if (collectionPrefix(route) !== prefix) continue;

		const cmp = route.localeCompare(id, undefined, LOCALE_COMPARE_OPTIONS);
		if (cmp < 0) {
			prevId = route;
		} else if (cmp > 0) {
			nextId = route;
			break;
		}
	}

	return { prevId, nextId };
}
