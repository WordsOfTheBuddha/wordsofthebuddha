import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import type { SuggestionIndexEntry } from "../types/suggestions";
import { inflectionStemKey } from "./paliInflectionUtils";
import { normalizeForComparison } from "./searchRanking";

/** Pali token in sutta source files (letters + diacritics). */
const PALI_TOKEN_RE = /[a-zA-Zāīūṃṁṅñṭḍṇḷ]+/g;

const MIN_TOKEN_LEN = 3;
/** Minimum Pali files a lemma must appear in to enter the corpus suggestion layer. */
export const CORPUS_MIN_DOCS = 5;
/**
 * Max corpus-layer entries after frequency sort (curated/tooltip layers are separate).
 * 10k admits ~6-file lemmas; 5k cut off at ~12 files of a single spelling.
 */
export const CORPUS_MAX_ENTRIES = 10000;

/** Recurring multi-word Pali stock phrases — companion terms bypass the corpus cap. */
const STOCK_PHRASE_RE =
	/bhāvit[āa]\s+bahulīkat[āa]\s+yānīkat[āa]\s+vatthukat[āa](?:\s+anuṭṭhit[āa]\s+paricit[āa]\s+susamāraddh[āa])?/gi;

type CorpusStats = {
	forms: Map<string, number>;
	docs: Set<string>;
};

function pickCanonicalForm(
	forms: Map<string, number>,
	lemma?: string,
): string {
	if (lemma) {
		const preferred = pickPreferredLemmaForm(forms, lemma);
		if (preferred) return preferred;
	}
	let best = "";
	let count = 0;
	for (const [form, n] of forms) {
		if (n > count) {
			count = n;
			best = form;
		}
	}
	return best;
}

/** Prefer an observed a-stem, then nominative -o, else the most frequent spelling. */
function pickPreferredLemmaForm(
	forms: Map<string, number>,
	lemma: string,
): string | null {
	const wantA = `${lemma}a`;
	const wantO = `${lemma}o`;
	let aForm: string | null = null;
	let aCount = 0;
	let oForm: string | null = null;
	let oCount = 0;
	for (const [form, n] of forms) {
		const nrm = normalizeForComparison(form);
		if (nrm === wantA && n >= aCount) {
			aForm = form;
			aCount = n;
		} else if (nrm === wantO && n >= oCount) {
			oForm = form;
			oCount = n;
		}
	}
	return aForm ?? oForm;
}

function mergeStatsByLemma(
	byNorm: Map<string, CorpusStats>,
	existingNorms: Set<string>,
): Map<string, CorpusStats> {
	const grouped = new Map<string, CorpusStats>();

	for (const [norm, data] of byNorm) {
		const lemma = inflectionStemKey(norm);
		if (existingNorms.has(norm) || existingNorms.has(lemma)) continue;

		let stats = grouped.get(lemma);
		if (!stats) {
			stats = { forms: new Map(), docs: new Set() };
			grouped.set(lemma, stats);
		}
		for (const [form, n] of data.forms) {
			stats.forms.set(form, (stats.forms.get(form) ?? 0) + n);
		}
		for (const doc of data.docs) {
			stats.docs.add(doc);
		}
	}

	return grouped;
}

function collectCorpusStats(pliRoot: string): Map<string, CorpusStats> {
	const files = globSync("**/*.md", { cwd: pliRoot });
	const byNorm = new Map<string, CorpusStats>();

	for (const rel of files) {
		const text = readFileSync(join(pliRoot, rel), "utf8");
		for (const match of text.matchAll(PALI_TOKEN_RE)) {
			const token = match[0];
			const norm = normalizeForComparison(token);
			if (norm.length < MIN_TOKEN_LEN) continue;

			let stats = byNorm.get(norm);
			if (!stats) {
				stats = { forms: new Map(), docs: new Set() };
				byNorm.set(norm, stats);
			}
			stats.forms.set(token, (stats.forms.get(token) ?? 0) + 1);
			stats.docs.add(rel);
		}
	}

	return byNorm;
}

/** High-frequency Pali tokens from parallel pli/*.md (not already curated). */
export function buildCorpusPaliEntries(
	pliRoot: string,
	existingNorms: Set<string>,
	options?: { minDocs?: number; maxEntries?: number },
): SuggestionIndexEntry[] {
	const minDocs = options?.minDocs ?? CORPUS_MIN_DOCS;
	const maxEntries = options?.maxEntries ?? CORPUS_MAX_ENTRIES;
	const stats = collectCorpusStats(pliRoot);
	const grouped = mergeStatsByLemma(stats, existingNorms);

	const candidates: Array<{ entry: SuggestionIndexEntry; docCount: number }> =
		[];

	for (const [lemma, data] of grouped) {
		if (data.docs.size < minDocs) continue;

		const text = pickCanonicalForm(data.forms, lemma);
		candidates.push({
			entry: {
				text,
				norm: normalizeForComparison(text),
				source: "corpus",
				entityType: "topic",
			},
			docCount: data.docs.size,
		});
	}

	candidates.sort((a, b) => {
		if (b.docCount !== a.docCount) return b.docCount - a.docCount;
		return a.entry.text.localeCompare(b.entry.text);
	});

	return candidates.slice(0, maxEntries).map((c) => c.entry);
}

/** Terms from recurring stock phrases (e.g. iddhipāda formula) that miss the corpus cap. */
export function buildStockPhrasePaliEntries(
	pliRoot: string,
	stats: Map<string, CorpusStats>,
	existingNorms: Set<string>,
	options?: { minDocs?: number },
): SuggestionIndexEntry[] {
	const minDocs = options?.minDocs ?? CORPUS_MIN_DOCS;
	const companionNorms = new Set<string>();
	const files = globSync("**/*.md", { cwd: pliRoot });

	for (const rel of files) {
		const text = readFileSync(join(pliRoot, rel), "utf8");
		for (const match of text.matchAll(STOCK_PHRASE_RE)) {
			const phrase = match[0];
			for (const token of phrase.matchAll(PALI_TOKEN_RE)) {
				const norm = normalizeForComparison(token[0]);
				if (norm.length >= MIN_TOKEN_LEN) {
					companionNorms.add(norm);
				}
			}
		}
	}

	const entries: SuggestionIndexEntry[] = [];
	for (const norm of companionNorms) {
		if (
			existingNorms.has(norm) ||
			existingNorms.has(inflectionStemKey(norm))
		) {
			continue;
		}
		const data = stats.get(norm);
		if (!data || data.docs.size < minDocs) continue;

		entries.push({
			text: pickCanonicalForm(data.forms),
			norm,
			source: "corpus",
			entityType: "topic",
		});
	}

	return entries.sort((a, b) => a.text.localeCompare(b.text));
}

export { collectCorpusStats, pickCanonicalForm };
