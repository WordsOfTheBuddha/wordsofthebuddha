export const prerender = false;
import type { APIRoute } from "astro";
import { entrySenses } from "../../../utils/encyclopedia";
import { getEncyclopediaEntry } from "../../../utils/encyclopediaIndex";

export const GET: APIRoute = ({ params }) => {
	try {
		const raw = params.norm ?? "";
		const found = getEncyclopediaEntry(raw);
		if (!found) {
			return new Response(
				JSON.stringify({ success: false, error: "Not found", norm: raw }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		return new Response(
			JSON.stringify({
				success: true,
				entry: {
					...found.entry,
					senses: entrySenses(found.entry),
				},
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error in /api/encyclopedia/[norm]:", error);
		return new Response(
			JSON.stringify({ success: false, error: "Internal server error" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
