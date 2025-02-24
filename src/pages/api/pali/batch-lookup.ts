export const prerender = false;
import type { APIRoute } from "astro";
import { Dictionary } from "@sc-voice/ms-dpd/main.mjs";

const dictionary = await Dictionary.create();

interface DictionaryResult {
	pos?: string;
	meaning?: string;
	meaning_1?: string;
	pattern?: string;
	construction?: string;
}

interface WordDefinition {
	pos?: string;
	pattern?: string;
	construction?: string;
	meaning?: string;
}

async function lookupWord(word: string): Promise<WordDefinition[] | null> {
	try {
		const results = dictionary.find(word);
		if (!results?.data?.length) return null;

		return results.data.map(
			(result: DictionaryResult): WordDefinition => ({
				pos: result.pos,
				pattern: result.pattern,
				construction: result.construction,
				meaning: result.meaning || result.meaning_1,
			})
		);
	} catch (error) {
		console.error(`Lookup error for word ${word}:`, error);
		return null;
	}
}

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
				const definitions = await lookupWord(word);
				if (definitions) {
					results[word] = definitions;
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
