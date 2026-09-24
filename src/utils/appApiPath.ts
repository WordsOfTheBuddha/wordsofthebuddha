/** Root `[...id]` must never treat `/api/*` as a discourse slug. */
export function isAppApiCatchAllId(id: string | undefined): boolean {
	const path = (id || "").replace(/^\/+/, "");
	return path === "api" || path.startsWith("api/");
}

const RESEARCH_API_STATIC = new Set(["clarify", "revise", "run", "revise-run"]);

/**
 * Public Research URLs stay `/api/ai/research…`. Astro does not register
 * most files under `pages/api/ai/research/` (only `clarify.ts` matches), so
 * rewrite onto sibling endpoints that do.
 */
export function rewriteResearchApiPath(pathname: string): string | null {
	const path = pathname.replace(/\/+$/, "") || "/";
	if (path === "/api/ai/research") return "/api/ai/research-start";
	const match = path.match(/^\/api\/ai\/research\/([^/]+)$/);
	if (!match) return null;
	const seg = match[1];
	if (seg === "clarify") return null;
	if (seg === "revise") return "/api/ai/research-revise";
	if (seg === "run") return "/api/ai/research-run";
	if (seg === "revise-run") return "/api/ai/research-revise-run";
	if (RESEARCH_API_STATIC.has(seg)) return null;
	return `/api/ai/research-job/${seg}`;
}

export function researchApiFailureMessage(input: {
	status: number;
	code?: string;
	error?: string;
	fallback?: string;
}): string {
	if (input.code === "not_found" || input.error === "Research not found.") {
		return "Research not found.";
	}
	if (input.code === "timeout") {
		return (
			input.error ||
			"The server did not respond. It may be down or unreachable — try again in a moment."
		);
	}
	if (
		input.code === "route_miss" ||
		input.error === "Not found." ||
		input.status === 0
	) {
		return "Could not reach the research server. Refresh the page and try again.";
	}
	return input.error || input.fallback || "Could not revise the report.";
}

/**
 * A job status read failed because the network or host was briefly unreachable.
 * The job itself is unchanged; the caller should retry.
 */
export function isTransientResearchFetchFailure(
	status: number,
	code?: string,
): boolean {
	if (status === 0 || code === "timeout") return true;
	return status === 502 || status === 503 || status === 504;
}
