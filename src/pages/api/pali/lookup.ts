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

interface LookupResponse {
	word: string;
	definitions: WordDefinition[];
}

// Separate function for single word lookup with original format
async function lookupSingleWord(word: string): Promise<LookupResponse | null> {
	try {
		const results = dictionary.find(word);
		if (!results?.data?.length) return null;

		return {
			word,
			definitions: results.data.map(
				(result: DictionaryResult): WordDefinition => ({
					pos: result.pos,
					pattern: result.pattern,
					construction: result.construction,
					meaning: result.meaning || result.meaning_1,
				})
			),
		};
	} catch (error) {
		console.error(`Lookup error for word ${word}:`, error);
		return null;
	}
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

async function batchLookup(
	words: string[]
): Promise<Record<string, WordDefinition[]>> {
	const results: Record<string, WordDefinition[]> = {};

	// Process in batches of 50 for better performance
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

	return results;
}

export const GET: APIRoute = async ({ url }) => {
	const wordParam = url.searchParams.get("word");
	const query = url.searchParams.get("q");

	// Helper to get words from parameter
	const getWords = (param: string | null) =>
		(param || "")
			.split(",")
			.map((w) => w.trim())
			.filter((w) => w.length > 0);

	// Single word lookup with original response format
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

	// Batch lookup with new response format
	const words = query ? getWords(query) : getWords(wordParam);

	if (words.length === 0) {
		return new Response(
			JSON.stringify({ error: "No valid words provided" }),
			{ status: 400 }
		);
	}

	try {
		// Use batchLookup for both single and multiple words
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
			JSON.stringify({
				error: "Dictionary lookup error",
				words,
			}),
			{ status: 500 }
		);
	}
};
