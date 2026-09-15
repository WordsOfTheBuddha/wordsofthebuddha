export const prerender = false;
import type { APIRoute } from "astro";
import { isAskSampleSlug } from "../../../utils/aiAskSamples";
import { loadAskSampleVersion } from "../../../utils/aiAskSamplesServer";

export const GET: APIRoute = async ({ url }) => {
	const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
	const versionRaw = url.searchParams.get("version");
	if (!slug || !isAskSampleSlug(slug)) {
		return new Response(
			JSON.stringify({ success: false, error: "Sample not found." }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}
	const n = Math.floor(Number(versionRaw));
	if (!Number.isFinite(n) || n < 1) {
		return new Response(
			JSON.stringify({ success: false, error: "Version not found." }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}
	const report = await loadAskSampleVersion(slug, n);
	if (!report) {
		return new Response(
			JSON.stringify({ success: false, error: "Version not found." }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}
	return new Response(JSON.stringify({ success: true, n, report }), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
		},
	});
};
