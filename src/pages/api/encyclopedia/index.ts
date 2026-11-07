export const prerender = false;
import type { APIRoute } from "astro";
import {
	encyclopediaQueryFromUrl,
	queryEncyclopediaIndex,
} from "../../../utils/encyclopediaIndex";

export const GET: APIRoute = ({ url }) => {
	try {
		const result = queryEncyclopediaIndex(encyclopediaQueryFromUrl(url));
		return new Response(JSON.stringify({ success: true, ...result }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("Error in /api/encyclopedia:", error);
		return new Response(
			JSON.stringify({ success: false, error: "Internal server error" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
