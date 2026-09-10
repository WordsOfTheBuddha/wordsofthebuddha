export const prerender = false;
import type { APIRoute } from "astro";
import { runResearchJobAndMaybeChain } from "../../../../utils/aiAskResearchServer";

export const POST: APIRoute = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(
			JSON.stringify({ success: false, error: "Invalid JSON body." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}
	const uid = typeof body.uid === "string" ? body.uid.trim() : "";
	const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
	const runToken = typeof body.runToken === "string" ? body.runToken.trim() : "";
	if (!uid || !jobId || !runToken) {
		return new Response(
			JSON.stringify({ success: false, error: "Missing job." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}
	const work = runResearchJobAndMaybeChain({
		uid,
		jobId,
		runToken,
		requestUrl: request.url,
	}).catch((error) => {
		console.error("[ai/research/run]", error);
	});
	try {
		const vercel = await import("@vercel/functions");
		vercel.waitUntil(work);
	} catch {
		void work;
	}
	return new Response(JSON.stringify({ success: true, accepted: true }), {
		status: 202,
		headers: { "Content-Type": "application/json" },
	});
};
