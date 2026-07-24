import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import type { SuggestionIndexEntry } from "../types/suggestions";
import { inflectionStemKey } from "./paliInflectionUtils";
import { normalizeForComparison } from "./searchRanking";

/** Pali token in sutta source files (letters + diacritics). */
const PALI_TOKEN_RE = /[a-zA-Zāīūṃṁṅñṭḍṇḷ]+/g;

const MIN_TOKEN_LEN = 3;
export const CORPUS_MIN_DOCS = 10;
export const CORPUS_MAX_ENTRIES = 3000;

/** Recurring multi-word Pali stock phrases — companion terms bypass the corpus cap. */
const STOCK_PHRASE_RE =
	/bhāvit[āa]\s+bahulīkat[āa]\s+yānīkat[āa]\s+vatthukat[āa](?:\s+anuṭṭhit[āa]\s+paricit[āa]\s+susamāraddh[āa])?/gi;

type CorpusStats = {
	forms: Map<string, number>;
	docs: Set<string>;
};

function pickCanonicalForm(forms: Map<string, number>): string {
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

	const candidates: Array<{ entry: SuggestionIndexEntry; docCount: number }> =
		[];

	for (const [norm, data] of stats) {
		if (existingNorms.has(norm) || existingNorms.has(inflectionStemKey(norm))) {
			continue;
		}
		if (data.docs.size < minDocs) continue;

		candidates.push({
			entry: {
				text: pickCanonicalForm(data.forms),
				norm,
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
