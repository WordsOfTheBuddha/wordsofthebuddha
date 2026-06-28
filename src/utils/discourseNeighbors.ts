import { referenceOnlyRoutes } from "./referenceOnlyRoutes";
import { routes } from "./routes";
import { compareDiscourseIds } from "./discourseSort";
import { findNearestTranslatedNeighbors } from "./translatedNeighbors";

/** Book-level prefix for dotted discourses (an4.10 → an4, sn48.52 → sn48). */
export function discourseBookPrefix(slug: string): string {
	const book = slug.match(/^([a-z]+\d+)/i)?.[1];
	if (book) return book.toLowerCase();
	return (slug.match(/^[a-z]+/i)?.[0] || "").toLowerCase();
}

/** Dotted chapter.sutta slugs navigate within their book; others use global order. */
export function usesBookScopedNeighbors(slug: string): boolean {
	return /^[a-z]+\d+\./i.test(slug);
}

let cachedRoutableDiscourses: string[] | null = null;

/** Natural-sorted union of EN routes and reference-only slugs. */
export function getRoutableDiscourseSlugs(): readonly string[] {
	if (!cachedRoutableDiscourses) {
		const set = new Set<string>([...routes, ...referenceOnlyRoutes]);
		cachedRoutableDiscourses = [...set].sort(compareDiscourseIds);
	}
	return cachedRoutableDiscourses;
}

/**
 * Prev/next among all routable discourses (EN + reference-only).
 * Dotted slugs (an4.1, sn12.2) stay within the same book; others follow global order.
 */
export function findDiscourseNeighbors(
	id: string,
	routeList: readonly string[] = getRoutableDiscourseSlugs(),
): { prevId: string | null; nextId: string | null } {
	const bookScoped = usesBookScopedNeighbors(id);
	const bookPrefix = bookScoped ? discourseBookPrefix(id) : null;

	let prevId: string | null = null;
	let nextId: string | null = null;

	for (const route of routeList) {
		if (bookPrefix && discourseBookPrefix(route) !== bookPrefix) continue;

		const cmp = compareDiscourseIds(route, id);
		if (cmp < 0) {
			prevId = route;
		} else if (cmp > 0) {
			nextId = route;
			break;
		}
	}

	return { prevId, nextId };
}

/**
 * Prev/next for discourse pages: full routable list when `refMode`, else EN-only.
 */
export function findPageDiscourseNeighbors(
	id: string,
	refMode: boolean,
): { prevId: string | null; nextId: string | null } {
	if (refMode) {
		return findDiscourseNeighbors(id);
	}
	return findNearestTranslatedNeighbors(id, routes);
}
