/** Same-origin post-auth redirect. Preserves query (e.g. `/search?mode=ai`). */
export function safeAuthReturnUrl(
	returnTo: string | null | undefined,
	requestUrl: string,
	fallbackPath = "/review-room",
): URL {
	const fallback = new URL(fallbackPath, requestUrl);
	if (!returnTo) return fallback;
	try {
		const request = new URL(requestUrl);
		const parsed = new URL(returnTo, requestUrl);
		if (parsed.origin !== request.origin) return fallback;
		if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
			return fallback;
		}
		parsed.hash = "";
		return parsed;
	} catch {
		return fallback;
	}
}
