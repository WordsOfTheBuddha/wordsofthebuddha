import { defineMiddleware } from "astro:middleware";
import { referenceOnlyRouteSet } from "./utils/referenceOnlyRoutes";
import { routes } from "./utils/routes";

const englishRouteSet = new Set<string>(routes);

/** Top-level path with a single segment, e.g. /mn98 (not /sn1.1.1-2/foo). */
const TOP_LEVEL_SLUG = /^\/[^/]+$/;

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	if (pathname.startsWith("/_discourse-ssr/")) {
		return next();
	}

	if (!TOP_LEVEL_SLUG.test(pathname)) {
		return next();
	}

	const slug = pathname.slice(1);

	if (englishRouteSet.has(slug) || !referenceOnlyRouteSet.has(slug)) {
		return next();
	}

	return context.rewrite(new URL(`/_discourse-ssr/${slug}`, context.url));
});
