export const prerender = false;
import type { APIRoute } from "astro";
import { Dictionary } from "@sc-voice/ms-dpd/main.mjs";

const dictionary = await Dictionary.create();

export interface DictionaryResult {
	pos?: string;
	meaning?: string;
	meaning_1?: string;
	pattern?: string;
	construction?: string;
	meaning_lit?: string;
	lemma_1?: string;
}

export interface WordDefinition {
	pos?: string;
	pattern?: string;
	construction?: string;
	meaning?: string;
	lemma?: string;
	meaning_lit?: string;
}

export interface LookupResponse {
	word: string;
	definitions: WordDefinition[];
}

export const paliPosMap: Record<string, string> = {
	adj: "Adjective",
	nt: "Neuter Noun",
	prefix: "Prefix",
	pron: "Pronoun",
	masc: "Masculine Noun",
	fem: "Feminine Noun",
	ind: "Indeclinable",
	abbrev: "Abbreviation",
	aor: "Aorist",
	ptp: "Participle",
	prp: "Preposition",
	card: "Cardinal Number",
	cs: "Conjunctional Suffix",
	cond: "Conditional",
	fut: "Future",
	ger: "Gerund",
	idiom: "Idiom",
	imp: "Imperative",
	imperf: "Imperfect",
	inf: "Infinitive",
	letter: "Letter",
	opt: "Optative",
	ordin: "Ordinal Number",
	perf: "Perfect",
	pp: "Past Participle",
	pr: "Conjugation (Pronoun/Verb modification)",
	sandhi: "Sandhi (joining of words)",
	suffix: "Suffix",
	root: "Root",
	ve: "Verb Ending",
};

const RIGHT_SINGLE_QUOTE = "\u2019"; // '
const APOSTROPHE = "\u0027"; // '

// Separate function for single word lookup with original format
export async function lookupSingleWord(
	word: string
): Promise<LookupResponse | null> {
	try {
		let results = dictionary.find(word);
		console.log(
			`Initial lookup for "${word}": found ${
				results?.data?.length || 0
			} results`
		);

		// If no results and word contains apostrophe, try variations
		if (!results?.data?.length) {
			const hasApostrophe =
				word.includes(RIGHT_SINGLE_QUOTE) || word.includes(APOSTROPHE);
			if (hasApostrophe) {
				console.log(
					`Word "${word}" contains apostrophe (${
						word.includes(RIGHT_SINGLE_QUOTE)
							? "RIGHT_SINGLE_QUOTE"
							: "APOSTROPHE"
					})`
				);

				const basePart = word.split(
					new RegExp(`[${RIGHT_SINGLE_QUOTE}${APOSTROPHE}]`)
				)[0];
				if (basePart) {
					// Try full base part
					const pluralMap: Record<string, string> = {
						ā: "a",
						ī: "i",
						ū: "u",
					};

					let singularBase = basePart;
					const lastChar = basePart.slice(-1);
					if (lastChar in pluralMap) {
						singularBase =
							basePart.slice(0, -1) + pluralMap[lastChar];
					}
					console.log(`Trying base part: "${singularBase}"`);
					results = dictionary.find(singularBase);
					console.log(
						`Fallback lookup found ${
							results?.data?.length || 0
						} results`
					);

					// If still no results, try base part minus last character
					if (!results?.data?.length && basePart.length > 1) {
						const shortenedBase = basePart.slice(0, -1);
						console.log(
							`Trying shortened base part: "${shortenedBase}"`
						);
						results = dictionary.find(shortenedBase);
						console.log(
							`Second fallback lookup found ${
								results?.data?.length || 0
							} results`
						);
					}
				}
			}
		}

		if (!results?.data?.length) return null;

		return {
			word,
			definitions: results.data.map(
				(result: DictionaryResult): WordDefinition => ({
					pos: result.pos ? paliPosMap[result.pos] : result.pos,
					pattern: result.pattern,
					construction: result.construction,
					meaning: result.meaning || result.meaning_1,
					meaning_lit: result.meaning_lit,
					lemma: result.lemma_1,
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
		const lookupResponse = await lookupSingleWord(word);
		return lookupResponse?.definitions || null;
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
	console.log("query", query);

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
