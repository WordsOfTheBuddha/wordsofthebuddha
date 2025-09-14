// Shared Pali lookup utility (server + client)
// - Lazy-loads @sc-voice/ms-dpd dictionary
// - Provides compound handling via paliSandhi.json

import paliSandhi from "../data/paliSandhi.json";

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
		dictionaryPromise = (async () => {
			const mod: any = await import("@sc-voice/ms-dpd/main.mjs");
			return await mod.Dictionary.create();
		})();
	}
	return dictionaryPromise;
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
	word: string
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

		if (!results?.data?.length) return null;
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
		console.error(`Lookup error for word ${word}:`, error);
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
			const defs = await lookupSingleWord(w);
			if (defs?.definitions) results[w] = defs.definitions;
			else results[w] = [];
		});
		await Promise.all(lookups);
	}
	return results;
}
