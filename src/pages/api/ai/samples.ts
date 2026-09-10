export const prerender = false;
import type { APIRoute } from "astro";
import { loadAskSamples } from "../../../utils/aiAskSamplesServer";

export const GET: APIRoute = async () => {
	try {
		const samples = await loadAskSamples();
		return new Response(JSON.stringify({ success: true, samples }), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "public, max-age=30",
			},
		});
	} catch (error) {
		console.error("[ai/samples]", error);
		return new Response(JSON.stringify({ success: true, samples: [] }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}
};
