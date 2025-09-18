export const prerender = false;
import type { APIRoute } from "astro";
import { buildUnifiedContent } from "../../utils/discover-data";

export const GET: APIRoute = async ({ url }) => {
	try {
		const byParam =
			url.searchParams.get("by") || "topics,qualities,similes";
		const filterParam = url.searchParams.get("filter") || "";
		const requestedTypes = byParam.split(",").map((t) => t.trim()) as any;
		const allContent = buildUnifiedContent({
			include: requestedTypes,
			filter: filterParam,
		});

		return new Response(
			JSON.stringify({
				success: true,
				data: allContent,
				count: allContent.length,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			}
		);
	} catch (error) {
		console.error("Error in /api/discover:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Internal server error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			}
		);
	}
};
