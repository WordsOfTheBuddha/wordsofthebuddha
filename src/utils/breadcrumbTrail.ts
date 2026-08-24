import { getBreadcrumbPath, type BreadcrumbItem } from "./getBreadcrumbPath";
import { normalizePathForBreadcrumbs } from "./breadcrumbVisibility";
import { transformId } from "./transformId";

/**
 * Last non-empty path segment, ignoring trailing slashes, hashes, and
 * `/index.html`. Production prerender often reports `/dn22/` or
 * `/dn22/index.html` while `astro dev` reports `/dn22`.
 */
export function slugFromPath(path: string): string {
	const withoutHash = path.split("#")[0] ?? path;
	const normalized = normalizePathForBreadcrumbs(withoutHash);
	const parts = normalized.split("/").filter(Boolean);
	return parts[parts.length - 1] ?? "";
}

export function currentBreadcrumbIndex(
	trail: BreadcrumbItem[],
	currentSlug: string,
): number {
	if (trail.length === 0) return -1;
	if (currentSlug) {
		for (let i = trail.length - 1; i >= 0; i--) {
			if (slugFromPath(trail[i].path) === currentSlug) return i;
		}
	}
	return trail.length - 1;
}

/**
 * The breadcrumb trail rendered by `Breadcrumbs.astro` and mirrored into
 * BreadcrumbList JSON-LD. Shared so the structured data cannot drift from the
 * visible trail — Google requires the two to agree.
 */
export function buildBreadcrumbTrail(
	path: string,
	urlPathname: string,
): BreadcrumbItem[] {
	const urlSlug = slugFromPath(urlPathname);
	const segments = path.split("/").filter(Boolean);
	if (segments.length === 0) return [];

	const breadcrumbs = getBreadcrumbPath(segments);
	if (breadcrumbs.length === 0) return breadcrumbs;

	const lastSlug = slugFromPath(
		breadcrumbs[breadcrumbs.length - 1].path,
	);
	if (urlSlug && lastSlug !== urlSlug) {
		breadcrumbs.push({
			label: transformId(urlSlug).replace(/-/g, " "),
			path: !path.startsWith("/qualities") ? `/${urlSlug}` : ``,
		});
	}

	return breadcrumbs.filter((crumb) => crumb.label.trim().length > 0);
}
