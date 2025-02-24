export const prerender = false;
import type { APIRoute } from "astro";
import { lookupSingleWord, type WordDefinition } from "./lookup";

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		const words: string[] = body.words;

		if (!Array.isArray(words) || words.length === 0) {
			return new Response(
				JSON.stringify({ error: "Invalid request format" }),
				{ status: 400 }
			);
		}

		if (words.length > 10000) {
			return new Response(JSON.stringify({ error: "Too many words" }), {
				status: 400,
			});
		}

		const results: Record<string, WordDefinition[]> = {};
		const batchSize = 50;

		for (let i = 0; i < words.length; i += batchSize) {
			const batch = words.slice(i, i + batchSize);
			const lookupPromises = batch.map(async (word) => {
				const result = await lookupSingleWord(word);
				if (result && result.definitions) {
					results[word] = result.definitions;
				}
			});
			await Promise.all(lookupPromises);
		}

		return new Response(JSON.stringify(results), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		console.error("Batch lookup error:", error);
		return new Response(
			JSON.stringify({ error: "Internal server error" }),
			{ status: 500 }
		);
	}
};
