import type { APIContext, APIRoute } from "astro";
import { rewriteResearchApiPath } from "./appApiPath";

/**
 * Astro’s file router often misses `/api/ai/research…` (folder + sibling
 * collision, and new page files with HMR off). Invoke the handlers here so
 * public URLs never fall through to the discourse catch-all.
 */
export async function dispatchResearchApi(
	context: APIContext,
): Promise<Response | null> {
	const target = rewriteResearchApiPath(context.url.pathname);
	if (!target) return null;
	const method = context.request.method.toUpperCase();
	const jobMatch = target.match(/^\/api\/ai\/research-job\/([^/]+)$/);
	try {
		const handler = await loadResearchApiHandler(target, method);
		if (!handler) {
			return new Response(
				JSON.stringify({
					success: false,
					code: "route_miss",
					error: "Not found.",
				}),
				{ status: 405, headers: { "Content-Type": "application/json" } },
			);
		}
		const params = jobMatch
			? { ...context.params, id: jobMatch[1] }
			: context.params;
		return await handler({ ...context, params });
	} catch (error) {
		console.error("[researchApiDispatch]", target, error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Could not reach the research server. Refresh the page and try again.",
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } },
		);
	}
}

async function loadResearchApiHandler(
	target: string,
	method: string,
): Promise<APIRoute | undefined> {
	if (target === "/api/ai/research-start") {
		const mod = await import("../pages/api/ai/research-start");
		return method === "GET" ? mod.GET : method === "POST" ? mod.POST : undefined;
	}
	if (target === "/api/ai/research-revise") {
		const mod = await import("../pages/api/ai/research-revise");
		return method === "POST" ? mod.POST : undefined;
	}
	if (target === "/api/ai/research-run") {
		const mod = await import("../pages/api/ai/research-run");
		return method === "POST" ? mod.POST : undefined;
	}
	if (target === "/api/ai/research-revise-run") {
		const mod = await import("../pages/api/ai/research-revise-run");
		return method === "POST" ? mod.POST : undefined;
	}
	if (target.startsWith("/api/ai/research-job/")) {
		const mod = await import("../pages/api/ai/research-job/[id]");
		return method === "GET" ? mod.GET : method === "POST" ? mod.POST : undefined;
	}
	return undefined;
}
