// Shared Pali lookup utility (server + client)
// - Statically imports @sc-voice/ms-dpd dictionary and creates a singleton on first use
// - Provides compound handling via paliSandhi.json
// - Falls back to algorithmic sandhi splitting when manual lookup misses

import paliSandhi from "../data/paliSandhi.json";
import * as msdpd from "@sc-voice/ms-dpd/main.mjs";
import {
	trySandhiSplit,
	tryCommonSuffixSplit,
	type SandhiSplitResult,
} from "./algorithmicSandhi";

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

let dictionaryPromise: Promise<any> | null = null;

async function getDictionary() {
	if (!dictionaryPromise) {
		// Create the dictionary instance once (module is statically imported above)
		dictionaryPromise = (msdpd as any).Dictionary.create();
	}
	return dictionaryPromise;
}

// Warmup helper: initialize the dictionary (and optionally touch it) so
// bundler-created dynamic chunks are fetched while online and can be cached.
export async function warmupPaliDictionary(): Promise<void> {
	try {
		const dictionary = await getDictionary();
		// Light touch to trigger any lazy paths; ignore results
		if (dictionary && typeof dictionary.find === "function") {
			try {
				dictionary.find("a");
			} catch {}
		}
	} catch {}
}

/**
 * Build a LookupResponse from an algorithmic sandhi split result.
 * Looks up each constituent in the dictionary and assembles definitions.
 */
async function buildResponseFromSplit(
	word: string,
	splitResult: SandhiSplitResult
): Promise<LookupResponse | null> {
	const dictionary = await getDictionary();
	const definitions: WordDefinition[] = [];
	let compoundPos: string = "Sandhi (joining of words)";

	// Determine POS from the last constituent
	const lastPart = splitResult.parts[splitResult.parts.length - 1];
	try {
		const lastResults = dictionary.find(lastPart);
		if (lastResults?.data?.length) {
			const rawPos = lastResults.data[0].pos;
			compoundPos = rawPos
				? (paliPosMap as any)[rawPos] || rawPos
				: rawPos;
		}
	} catch {}

	const compoundConstruction = splitResult.parts.join(" + ");
	let isFirstDefinition = true;

	for (const part of splitResult.parts) {
		try {
			const results = dictionary.find(part);
			if (results?.data?.length) {
				results.data.forEach(
					(result: DictionaryResult, index: number) => {
						definitions.push({
							pos: compoundPos,
							pattern: result.pattern,
							construction: isFirstDefinition
								? compoundConstruction
								: undefined,
							meaning: `${part} ${index + 1}. ${
								result.meaning || result.meaning_1
							}`,
							meaning_lit: result.meaning_lit,
							lemma: result.lemma_1,
						});
						isFirstDefinition = false;
					}
				);
			}
		} catch (error) {
			console.error(
				`Error looking up algorithmic constituent "${part}":`,
				error
			);
		}
	}

	return definitions.length > 0 ? { word, definitions } : null;
}

/**
 * Attempt algorithmic sandhi splitting when the word is not in
 * paliSandhi.json and not found directly in the dictionary.
 */
async function lookupAlgorithmicSandhi(
	word: string,
	timeBudgetMs: number = 1300
): Promise<LookupResponse | null> {
	try {
		const dictionary = await getDictionary();
		const dictFind = (w: string) => dictionary.find(w);

		// Fast path: try common suffix patterns first
		const suffixResult = await tryCommonSuffixSplit(word, dictFind);
		if (suffixResult) {
			return buildResponseFromSplit(word, suffixResult);
		}

		// Full scan: try all reverse sandhi rules at every split point
		const splitResult = await trySandhiSplit(word, dictFind, 3, timeBudgetMs);
		if (splitResult) {
			return buildResponseFromSplit(word, splitResult);
		}
	} catch (error) {
		console.error(
			`Error in algorithmic sandhi for "${word}":`,
			error
		);
	}
	return null;
}

async function lookupCompoundWord(
	word: string
): Promise<LookupResponse | null> {
	const lowerWord = word.toLowerCase();
	const compounds = paliSandhi as Record<string, string[]>;
	if (!compounds[lowerWord]) return null;

	const constituents = compounds[lowerWord];
	const definitions: WordDefinition[] = [];
	let compoundPos: string = "Sandhi (joining of words)";

	const parsedConstituents = constituents.map((constituent) => {
		if (constituent.includes(":")) {
			const [w, meaning] = constituent.split(":");
			return { word: w.trim(), inlineMeaning: meaning.trim() } as any;
		}
		return { word: constituent.trim(), inlineMeaning: null } as any;
	});

	const lastConstituent = parsedConstituents[parsedConstituents.length - 1];
	try {
		const dictionary = await getDictionary();
		const lastResults = dictionary.find(lastConstituent.word);
		if (lastResults?.data?.length) {
			const rawPos = lastResults.data[0].pos;
			compoundPos = rawPos
				? (paliPosMap as any)[rawPos] || rawPos
				: rawPos;
		}
	} catch (error) {
		console.error(`Error getting POS for compound "${word}":`, error);
	}

	const compoundConstruction = parsedConstituents
		.map((p: any) => p.word)
		.join(" + ");
	let isFirstDefinition = true;

	for (const { word: constituent, inlineMeaning } of parsedConstituents) {
		if (inlineMeaning) {
			definitions.push({
				pos: compoundPos,
				pattern: undefined,
				construction: isFirstDefinition
					? compoundConstruction
					: undefined,
				meaning: `${constituent} 1. ${inlineMeaning}`,
				meaning_lit: undefined,
				lemma: constituent,
			});
			isFirstDefinition = false;
		} else {
			try {
				const dictionary = await getDictionary();
				const results = dictionary.find(constituent);
				if (results?.data?.length) {
					results.data.forEach(
						(result: DictionaryResult, index: number) => {
							definitions.push({
								pos: compoundPos,
								pattern: result.pattern,
								construction: isFirstDefinition
									? compoundConstruction
									: undefined,
								meaning: `${constituent} ${index + 1}. ${
									result.meaning || result.meaning_1
								}`,
								meaning_lit: result.meaning_lit,
								lemma: result.lemma_1,
							});
							isFirstDefinition = false;
						}
					);
				}
			} catch (error) {
				console.error(
					`Error looking up constituent "${constituent}":`,
					error
				);
			}
		}
	}

	return definitions.length > 0 ? { word, definitions } : null;
}

export async function lookupSingleWord(
	word: string,
	timeBudgetMs: number = 1300
): Promise<LookupResponse | null> {
	try {
		// Normalize to NFC to handle composed/ decomposed diacritics from URLs
		word = (word || "").trim().normalize("NFC");
		// Try compound lookup first
		const compoundResult = await lookupCompoundWord(word);
		if (compoundResult) return compoundResult;

		const dictionary = await getDictionary();
		let results = dictionary.find(word);

		if (!results?.data?.length) {
			const hasApostrophe =
				word.includes(RIGHT_SINGLE_QUOTE) || word.includes(APOSTROPHE);
			if (hasApostrophe) {
				const basePart = word.split(
					new RegExp(`[${RIGHT_SINGLE_QUOTE}${APOSTROPHE}]`)
				)[0];
				if (basePart) {
					const pluralMap: Record<string, string> = {
						ā: "a",
						ī: "i",
						ū: "u",
					};
					let singularBase = basePart;
					const lastChar = basePart.slice(-1);
					if (lastChar in pluralMap)
						singularBase =
							basePart.slice(0, -1) + pluralMap[lastChar];
					results = dictionary.find(singularBase);
					if (!results?.data?.length && basePart.length > 1) {
						const shortenedBase = basePart.slice(0, -1);
						results = dictionary.find(shortenedBase);
					}
				}
			}
		}

		if (!results?.data?.length) {
			// Algorithmic sandhi fallback
			const algorithmicResult = await lookupAlgorithmicSandhi(word, timeBudgetMs);
			if (algorithmicResult) return algorithmicResult;
			return null;
		}
		return {
			word,
			definitions: results.data.map(
				(result: DictionaryResult): WordDefinition => ({
					pos: result.pos
						? (paliPosMap as any)[result.pos] || result.pos
						: result.pos,
					pattern: result.pattern,
					construction: result.construction,
					meaning: result.meaning || result.meaning_1,
					meaning_lit: result.meaning_lit,
					lemma: result.lemma_1,
				})
			),
		};
	} catch (error) {
		// Provide extra context to help diagnose offline/dynamic import issues
		try {
			const ctx = {
				word,
				online:
					typeof navigator !== "undefined"
						? navigator.onLine
						: undefined,
				hasMsDpd: !!(msdpd as any),
			};
			console.error(`Lookup error for word ${word}:`, error, ctx);
		} catch (_) {
			// fallback
			console.error(`Lookup error for word ${word}:`, error);
		}
		return null;
	}
}

export async function batchLookup(
	words: string[]
): Promise<Record<string, WordDefinition[]>> {
	const results: Record<string, WordDefinition[]> = {};
	const normalized = words.map((w) => (w ?? "").trim().normalize("NFC"));
	const batchSize = 50;
	for (let i = 0; i < normalized.length; i += batchSize) {
		const batch = normalized.slice(i, i + batchSize);
		const lookups = batch.map(async (w) => {
			// Use a short per-word budget in batch mode: algorithmic sandhi can
			// take up to timeBudgetMs per word on the single-threaded JS event
			// loop, so 50 words × 1300ms would be unacceptable. 200ms gives a
			// reasonable chance for common suffix patterns while keeping the
			// batch response bounded.
			const defs = await lookupSingleWord(w, 200);
			if (defs?.definitions) results[w] = defs.definitions;
			else results[w] = [];
		});
		await Promise.all(lookups);
	}
	return results;
}
