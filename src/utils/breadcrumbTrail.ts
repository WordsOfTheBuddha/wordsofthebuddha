import { getBreadcrumbPath, type BreadcrumbItem } from "./getBreadcrumbPath";
import { transformId } from "./transformId";

/**
 * The breadcrumb trail rendered by `Breadcrumbs.astro` and mirrored into
 * BreadcrumbList JSON-LD. Shared so the structured data cannot drift from the
 * visible trail — Google requires the two to agree.
 */
export function buildBreadcrumbTrail(
	path: string,
	urlPathname: string,
): BreadcrumbItem[] {
	const urlPathSegments = urlPathname.split("/");
	const urlPath = urlPathSegments[urlPathSegments.length - 1];

	const segments = path.split("/").filter(Boolean);
	if (segments.length === 0) return [];

	const breadcrumbs = getBreadcrumbPath(segments);
	if (breadcrumbs.length === 0) return breadcrumbs;

	if (breadcrumbs[breadcrumbs.length - 1].path.substring(1) !== urlPath) {
		breadcrumbs.push({
			label: transformId(urlPath).replace(/-/g, " "),
			path: !path.startsWith("/qualities") ? `/${urlPath}` : ``,
		});
	}

	return breadcrumbs;
}
