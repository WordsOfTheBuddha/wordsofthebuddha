export const prerender = false;
import type { APIRoute } from "astro";
import dictionaryData from "../../../data/pli2en_dpd.json" assert { type: "json" };
const dictArray = dictionaryData as DictionaryEntry[];

interface DictionaryEntry {
	entry: string;
	definition: string[];
}

const dictionaryMap = new Map<string, DictionaryEntry>();
dictArray.forEach((entry: DictionaryEntry) => {
	dictionaryMap.set(entry.entry.toLowerCase(), entry);
});

function lookupWord(word: string): string | null {
	const entry = dictionaryMap.get(word.toLowerCase());
	return entry ? entry.definition.join("\n") : null;
}

export const GET: APIRoute = async ({ url }) => {
	const word = url.searchParams.get("word");
	const query = url.searchParams.get("q");

	// Handle batch lookup
	if (query) {
		const words = query
			.split(",")
			.map((w) => w.trim())
			.filter((w) => w.length > 0)
			.slice(0, 10);

		if (words.length === 0) {
			return new Response("No valid words provided", { status: 400 });
		}

		try {
			const results = Object.fromEntries(
				words
					.map((w) => {
						const definition = lookupWord(w.toLowerCase());
						return [w, definition];
					})
					.filter(([_, def]) => def !== null)
			);

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
				JSON.stringify({ error: "Batch lookup failed" }),
				{ status: 500 }
			);
		}
	}

	// Handle single word lookup
	if (!word) {
		return new Response("Word parameter is required", { status: 400 });
	}

	try {
		const definition = lookupWord(word);
		if (!definition) {
			return new Response(
				JSON.stringify({
					error: "Word not found",
					word: word,
				}),
				{ status: 404 }
			);
		}

		return new Response(JSON.stringify({ definition }), {
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
				word: word,
			}),
			{ status: 500 }
		);
	}
};
