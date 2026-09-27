/**
 * Shared CDN caching for on-demand pages whose HTML is a pure function of the
 * URL (path + query) and the deployed build. Vercel's CDN cache key includes
 * the deployment URL, so a new deploy never serves a previous build's HTML and
 * content edits need no purge. Browsers get `max-age=0` and always revalidate;
 * Vercel strips `s-maxage` / `stale-while-revalidate` before the browser.
 */
export const PUBLIC_PAGE_CACHE_CONTROL =
	"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

/**
 * On-demand routes (Astro `routePattern`) that never read cookies, auth, or
 * Firestore. Anything signed-in or per-user (profile, signin, dashboard,
 * review-room, admin, shared-ask, /api/*) must stay out of this set.
 */
export const PUBLIC_SSR_ROUTE_PATTERNS: ReadonlySet<string> = new Set([
	"/[...id]",
	"/discourse-ssr/[id]",
	"/discourse-dynamic/[...id]",
	"/discourse-sujato/[id]",
	"/listen-dynamic/[discourse]",
	"/editorial/[slug]",
	"/anthologies/[...id]",
	"/topic",
	"/topic/[...slug]",
	"/qualities/[...id]",
	"/person/[...id]",
	"/simile/[...id]",
]);

/** Statuses Vercel's CDN will store. */
const CACHEABLE_STATUS = new Set([200, 301, 302, 307, 308, 404, 410]);

const ASTRO_RESPONSE_COOKIES = Symbol.for("astro.cookies");

interface PendingCookies {
	headers(): Iterable<string>;
}

function hasPendingCookies(cookies: PendingCookies | undefined): boolean {
	if (!cookies) return false;
	for (const _ of cookies.headers()) return true;
	return false;
}

function hasHeaderCaseInsensitive(headers: Headers, name: string): boolean {
	const lowerName = name.toLowerCase();
	for (const headerName of headers.keys()) {
		if (headerName.toLowerCase() === lowerName) return true;
	}
	return false;
}

export interface PublicEdgeCacheInput {
	request: Request;
	url: URL;
	/** `context.cookies`; Astro appends these as Set-Cookie after middleware. */
	cookies?: PendingCookies;
}

/**
 * Adds {@link PUBLIC_PAGE_CACHE_CONTROL} when the response is safe to share
 * between visitors. Leaves the response untouched if the route already chose
 * a Cache-Control (e.g. `no-store` 302s), or if any cookie is being set.
 * Callers decide the route is public; this only enforces the response side.
 */
export function withPublicEdgeCache(
	{ request, url, cookies }: PublicEdgeCacheInput,
	response: Response,
): Response {
	const method = request.method.toUpperCase();
	if (method !== "GET" && method !== "HEAD") return response;
	if (url.pathname.startsWith("/api/")) return response;
	if (hasHeaderCaseInsensitive(request.headers, "authorization")) return response;
	if (!CACHEABLE_STATUS.has(response.status)) return response;
	if (hasHeaderCaseInsensitive(response.headers, "cache-control")) return response;
	if (hasHeaderCaseInsensitive(response.headers, "set-cookie")) return response;
	if (hasPendingCookies(cookies)) return response;
	if (
		hasPendingCookies(
			Reflect.get(response, ASTRO_RESPONSE_COOKIES) as
				| PendingCookies
				| undefined,
		)
	) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set("Cache-Control", PUBLIC_PAGE_CACHE_CONTROL);
	const cached = new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
	const astroCookies = Reflect.get(response, ASTRO_RESPONSE_COOKIES);
	if (astroCookies) Reflect.set(cached, ASTRO_RESPONSE_COOKIES, astroCookies);
	return cached;
}
