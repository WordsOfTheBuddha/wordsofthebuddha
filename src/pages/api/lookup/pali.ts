export const prerender = false;
import type { APIRoute } from "astro";
import { lookupSingleWord, batchLookup } from "../../../utils/paliLookup";

export const GET: APIRoute = async ({ url }) => {
	const wordParam = url.searchParams.get("word");
	const query = url.searchParams.get("q");
	console.log("query", query);

	const getWords = (param: string | null) =>
		(param || "")
			.split(",")
			.map((w) => w.trim())
			.filter((w) => w.length > 0);

	if (wordParam && !query) {
		try {
			const result = await lookupSingleWord(wordParam);
			if (!result) {
				return new Response(
					JSON.stringify({
						error: "Word not found",
						word: wordParam,
					}),
					{ status: 404 }
				);
			}
			return new Response(JSON.stringify(result), {
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
			});
		} catch (error) {
			console.error("Lookup error:", error);
			return new Response(
				JSON.stringify({
					error: "Dictionary lookup error",
					word: wordParam,
				}),
				{ status: 500 }
			);
		}
	}

	const words = query ? getWords(query) : getWords(wordParam);
	if (words.length === 0) {
		return new Response(
			JSON.stringify({ error: "No valid words provided" }),
			{
				status: 400,
			}
		);
	}

	try {
		const results = await batchLookup(words);
		return new Response(JSON.stringify(results), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		console.error("Lookup error:", error);
		return new Response(
			JSON.stringify({ error: "Dictionary lookup error", words }),
			{ status: 500 }
		);
	}
};
