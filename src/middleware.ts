import { defineMiddleware } from "astro:middleware";
import { getEnglishEntry } from "./utils/getContentEntry";
import { referenceOnlyRouteSet } from "./utils/referenceOnlyRoutes";
import { routes } from "./utils/routes";
import { canonicalOnSlug, resolveOnSlugFallback } from "./utils/discover-data";
import {
	isRootPostCandidate,
	parsePostSlugFromGlobPath,
} from "./utils/rootPostSlugs";
import { dispatchResearchApi } from "./utils/researchApiDispatch";

const englishRouteSet = new Set<string>(routes);

/** Raw glob so `draft: true` page files still count as root posts. */
const editorialPostFiles = import.meta.glob("./pages/posts/*.{md,mdx}", {
	eager: true,
	query: "?raw",
	import: "default",
});
const rootPostSlugSet = new Set(
	Object.keys(editorialPostFiles)
		.map(parsePostSlugFromGlobPath)
		.filter((postSlug) =>
			isRootPostCandidate(postSlug, {
				isDiscourse: englishRouteSet.has(postSlug),
			}),
		),
);

/** Top-level path with a single segment, e.g. /mn98 (not /sn1.1.1-2/foo). */
const TOP_LEVEL_SLUG = /^\/[^/]+$/;

/** Canonical Sujato reference URLs, e.g. /mn65/en/sujato. */
const SUJATO_REFERENCE_ROUTE = /^\/([^/]+)\/en\/sujato$/;

/** Subset/paragraph slugs like sn49.1 or sn1.1.1-2 (not collection indexes like sn12). */
const DISCOURSE_SLICE = /^[a-z]+\d[\d]*\.\d/i;

/** /on/:slug is prerendered with hyphenated slugs only; normalize spaced URLs. */
const ON_ROUTE = /^\/on\/([^/]+)$/;

/**
 * Literal garbage paths from client bugs/scanners (prod logs: `/ip` ~4.7k
 * 302 MISS, `/null` + `/on/null` ~4k). Exact-match only — never prefix — and
 * cacheable at the edge so repeats never invoke SSR again. If a real route
 * ever claims one of these paths, delete it from this set.
 */
const GONE_PATHS = new Set(["/ip", "/null", "/on/null"]);

function goneResponse(): Response {
	return new Response("Gone", {
		status: 410,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control":
				"public, s-maxage=86400, stale-while-revalidate=86400",
			"X-Robots-Tag": "noindex, nofollow",
		},
	});
}

/**
 * View-state and share params that create alternate URLs of the same page.
 * Prerendered discourses ship static HTML, so a <meta robots> set at build
 * time cannot see these — X-Robots-Tag must be applied on the request
 * (Vercel Edge Middleware in production).
 */
const NOINDEX_VIEW_PARAMS = new Set([
	"pli",
	"pl",
	"voice",
	"theme",
	"layout",
	"viz",
	"trans",
	"ref",
	"enablePaliLookup",
	"q",
]);

function hasNoindexViewParams(url: URL): boolean {
	return [...url.searchParams.keys()].some((key) =>
		NOINDEX_VIEW_PARAMS.has(key),
	);
}

function searchRedirectPath(location: string): string {
	if (!location) return "";
	try {
		const path = location.startsWith("http")
			? new URL(location).pathname
			: location.split("?")[0];
		return path.replace(/\/+$/, "") || "/";
	} catch {
		return location.split("?")[0] || "";
	}
}

/** Auth endpoints may redirect to `/search` after sign-in or sign-out. */
const API_SEARCH_REDIRECT_ALLOWLIST = new Set([
	"/api/auth/signin",
	"/api/auth/signout",
]);

/** `/api/*` must never 302 onto the discourse catch-all `/search` page. */
function jsonIfApiFellThroughToSearch(
	pathname: string,
	response: Response,
): Response {
	if (!pathname.startsWith("/api/")) return response;
	if (API_SEARCH_REDIRECT_ALLOWLIST.has(pathname)) return response;
	if (response.status < 300 || response.status >= 400) return response;
	if (searchRedirectPath(response.headers.get("Location") || "") !== "/search") {
		return response;
	}
	return new Response(
		JSON.stringify({
			success: false,
			code: "route_miss",
			error: "Not found.",
		}),
		{ status: 404, headers: { "Content-Type": "application/json" } },
	);
}

function withNoindexIfNeeded(requestUrl: URL, response: Response): Response {
	if (!hasNoindexViewParams(requestUrl) || response.status >= 300) {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.set("X-Robots-Tag", "noindex, follow");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

/** Rewrite target keeps the original query string (view-state params). */
function rewriteURL(path: string, from: URL): URL {
	const target = new URL(path, from);
	target.search = from.search;
	return target;
}

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;
	// Exact-match garbage paths → cheap cacheable 410 before any other work.
	// Trailing-slash variants normalized; query strings ignored (pathname only).
	if (GONE_PATHS.has(pathname.replace(/\/+$/, "") || "/")) {
		return goneResponse();
	}

	const researchApi = await dispatchResearchApi(context);
	if (researchApi) {
		return withNoindexIfNeeded(context.url, researchApi);
	}
	const noindexViewState = hasNoindexViewParams(context.url);
	// SSR layouts can read this when a rewrite hides the original query string.
	(context.locals as { wotbNoindexViewState?: boolean }).wotbNoindexViewState =
		noindexViewState;

	const onMatch = pathname.match(ON_ROUTE);
	if (onMatch) {
		const rawSlug = onMatch[1];
		let decoded = rawSlug;
		try {
			decoded = decodeURIComponent(rawSlug);
		} catch {
			/* pathname may already be decoded */
		}
		const canonical = canonicalOnSlug(decoded);
		// Compare against rawSlug too: pathname may keep %20 while decoded has spaces.
		if (rawSlug !== canonical) {
			return context.redirect(
				new URL(`/on/${canonical}`, context.url),
				301,
			);
		}
	}

	if (
		pathname.startsWith("/discourse-ssr/") ||
		pathname.startsWith("/discourse-dynamic/") ||
		pathname.startsWith("/discourse-sujato/") ||
		pathname.startsWith("/listen-dynamic/") ||
		pathname.startsWith("/shared-ask/")
	) {
		return withNoindexIfNeeded(context.url, await next());
	}

	// Bare /ask → Ask mode (same as /ai). Bare /research → Research.
	if (pathname === "/ask" || pathname === "/ask/") {
		return context.redirect("/search?mode=ask");
	}
	if (pathname === "/research" || pathname === "/research/") {
		const next = new URL("/search", context.url);
		next.search = context.url.search;
		next.searchParams.set("mode", "research");
		return context.redirect(next.pathname + next.search + next.hash);
	}

	if (pathname === "/search" || pathname === "/search/") {
		if (context.url.searchParams.get("mode") === "ai") {
			const canonical = new URL(context.url);
			canonical.searchParams.set("mode", "ask");
			return context.redirect(
				canonical.pathname + canonical.search + canonical.hash,
			);
		}
	}

	// Public share URLs are /ask/:slug and /research/:slug. The root [...id]
	// catch-all steals nested paths and drops Vite CSS, so rewrite to a
	// dedicated SSR segment. Bare /research is redirected above.
	if (pathname.startsWith("/ask/") || pathname.startsWith("/research/")) {
		const prefix = pathname.startsWith("/research/") ? "/research/" : "/ask/";
		const slug = pathname.slice(prefix.length).replace(/\/+$/, "");
		if (slug && !slug.includes("/")) {
			const target = rewriteURL(`/shared-ask/${slug}`, context.url);
			target.searchParams.set(
				"shareFrom",
				prefix === "/research/" ? "research" : "ask",
			);
			(
				context.locals as { wotbSharePublicPath?: string }
			).wotbSharePublicPath = pathname;
			return withNoindexIfNeeded(context.url, await context.rewrite(target));
		}
	}

	// Prerendered /listen/[discourse] only exists for file slugs. Excerpt URLs
	// (`/listen/dhp2`) would otherwise fall through to the catch-all search page.
	if (pathname.startsWith("/listen/")) {
		const slug = pathname.slice("/listen/".length).replace(/\/+$/, "");
		if (slug && !slug.includes("/") && !englishRouteSet.has(slug)) {
			return withNoindexIfNeeded(
				context.url,
				await context.rewrite(
					rewriteURL(`/listen-dynamic/${slug}`, context.url),
				),
			);
		}
	}

	const sujatoMatch = pathname.match(SUJATO_REFERENCE_ROUTE);
	if (sujatoMatch) {
		return withNoindexIfNeeded(
			context.url,
			await context.rewrite(
				rewriteURL(`/discourse-sujato/${sujatoMatch[1]}`, context.url),
			),
		);
	}

	if (!TOP_LEVEL_SLUG.test(pathname)) {
		const response = await next();
		return withNoindexIfNeeded(
			context.url,
			jsonIfApiFellThroughToSearch(pathname, response),
		);
	}

	const slug = pathname.slice(1);

	if (englishRouteSet.has(slug)) {
		return withNoindexIfNeeded(context.url, await next());
	}

	// Bare quality/topic slugs 301/302 to /on/:slug in the catch-all. If an
	// editorial post claims that slug, rewrite to the post renderer instead
	// (URL stays /mindfulness; /on/mindfulness is unchanged).
	if (rootPostSlugSet.has(slug)) {
		const onPage = resolveOnSlugFallback(slug);
		if (onPage.kind === "on") {
			return withNoindexIfNeeded(
				context.url,
				await context.rewrite(
					rewriteURL(`/editorial/${slug}`, context.url),
				),
			);
		}
	}

	if (referenceOnlyRouteSet.has(slug)) {
		// Route lists are regenerated by contentWatcher but middleware may keep stale
		// imports until restart; confirm on disk / content store before SSR fallback.
		const english = await getEnglishEntry(slug);
		if (english) {
			return withNoindexIfNeeded(context.url, await next());
		}

		return withNoindexIfNeeded(
			context.url,
			await context.rewrite(rewriteURL(`/discourse-ssr/${slug}`, context.url)),
		);
	}

	if (DISCOURSE_SLICE.test(slug)) {
		// Prerendered [discourse].astro outranks SSR [...id].astro in production;
		// rewrite to a dedicated SSR segment so partial routes resolve.
		return withNoindexIfNeeded(
			context.url,
			await context.rewrite(
				rewriteURL(`/discourse-dynamic/${slug}`, context.url),
			),
		);
	}

	return withNoindexIfNeeded(context.url, await next());
});
