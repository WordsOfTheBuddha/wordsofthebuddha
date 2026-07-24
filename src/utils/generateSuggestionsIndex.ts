#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllContent } from "./discover-data";
import {
	buildSuggestionEntries,
	mergeSuggestionEntries,
} from "./suggestForToken";
import { buildCorpusPaliEntries, buildStockPhrasePaliEntries, collectCorpusStats } from "./buildCorpusPaliVocabulary";
import { buildTooltipPaliEntries } from "./extractTooltipPaliTerms";
import {
	buildCoveredNormSet,
	dedupeInflectionVariants,
} from "./paliInflectionUtils";
import type { SuggestionsIndexFile } from "../types/suggestions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const jsonOutFile = path.join(repoRoot, "generated", "suggestions-index.json");
const pliRoot = path.join(repoRoot, "src", "content", "pli");
const enRoot = path.join(repoRoot, "src", "content", "en");

async function main() {
	const start = Date.now();
	const items = buildAllContent(["topics", "qualities", "similes", "persons"]);
	const curated = buildSuggestionEntries(items);
	const curatedNorms = new Set(curated.map((entry) => entry.norm));

	const tooltip = buildTooltipPaliEntries(enRoot, curatedNorms);
	const coveredForCorpus = buildCoveredNormSet([...curated, ...tooltip]);
	const corpusStats = collectCorpusStats(pliRoot);
	const corpus = buildCorpusPaliEntries(pliRoot, coveredForCorpus);
	const coveredWithCorpus = buildCoveredNormSet([
		...curated,
		...tooltip,
		...corpus,
	]);
	const stockPhrase = buildStockPhrasePaliEntries(
		pliRoot,
		corpusStats,
		coveredWithCorpus,
	);

	const entries = dedupeInflectionVariants(
		mergeSuggestionEntries(curated, tooltip, corpus, stockPhrase),
	);
	const payload: SuggestionsIndexFile = { version: 1, entries };

	await mkdir(path.dirname(jsonOutFile), { recursive: true });
	const json = JSON.stringify(payload);
	await writeFile(jsonOutFile, json, "utf8");

	const kb = Buffer.byteLength(json, "utf8") / 1024;
	const ms = Date.now() - start;
	console.log(
		`suggestions-index: wrote ${entries.length} entries (curated ${curated.length}, tooltip ${tooltip.length}, corpus ${corpus.length}, stockPhrase ${stockPhrase.length}) to generated/suggestions-index.json (${kb.toFixed(1)} KB) in ${ms}ms`,
	);
}

const isDirectRun = process.argv[1]?.includes("generateSuggestionsIndex");
if (isDirectRun) {
	main().catch((err) => {
		console.error("suggestions-index generation failed:", err);
		process.exit(1);
	});
}

export { main as generateSuggestionsIndex };
