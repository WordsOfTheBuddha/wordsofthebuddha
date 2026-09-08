import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCorpusPaliEntries, buildStockPhrasePaliEntries, collectCorpusStats } from "./buildCorpusPaliVocabulary";
import { buildTooltipPaliEntries } from "./extractTooltipPaliTerms";
import { inflectionStemKey } from "./paliInflectionUtils";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const pliRoot = path.join(repoRoot, "src", "content", "pli");
const enRoot = path.join(repoRoot, "src", "content", "en");

describe("buildCorpusPaliEntries", () => {
	it("includes frequent Pali tokens missing from curated data", () => {
		const entries = buildCorpusPaliEntries(pliRoot, new Set(), {
			minDocs: 10,
			maxEntries: 5000,
		});
		const norms = new Set(entries.map((e) => e.norm));
		assert.ok(norms.has("etam"));
		assert.ok(norms.has("santam"));
		assert.ok(norms.has("panitam"));
		const etam = entries.find((e) => e.norm === "etam");
		assert.equal(etam?.text, "etaṁ");
		assert.equal(etam?.source, "corpus");
	});

	it("counts inflected forms of a long compound as one lemma", () => {
		const entries = buildCorpusPaliEntries(pliRoot, new Set());
		const lemma = inflectionStemKey("vimuttikkhandha");
		const hit = entries.find(
			(entry) => inflectionStemKey(entry.norm) === lemma,
		);
		assert.ok(hit, "expected vimuttikkhandha- lemma in corpus suggestions");
		assert.ok(
			hit!.norm === "vimuttikkhandha" || hit!.norm === "vimuttikkhandho",
			`canonical form should be a- or o-stem, got ${hit!.text}`,
		);
		assert.equal(
			entries.filter((entry) => inflectionStemKey(entry.norm) === lemma)
				.length,
			1,
		);
	});

	it("skips a corpus lemma already covered by a citation stem", () => {
		const lemma = inflectionStemKey("vimuttikkhandha");
		const covered = new Set(["vimuttikkhandha", lemma]);
		const entries = buildCorpusPaliEntries(pliRoot, covered);
		assert.ok(
			!entries.some((entry) => inflectionStemKey(entry.norm) === lemma),
		);
	});
});

describe("buildStockPhrasePaliEntries", () => {
	it("includes iddhipāda formula companions below the corpus cap", () => {
		const stats = collectCorpusStats(pliRoot);
		const entries = buildStockPhrasePaliEntries(pliRoot, stats, new Set());
		const norms = new Set(entries.map((e) => e.norm));
		assert.ok(norms.has("yanikata"), "yānīkatā");
		assert.ok(norms.has("vatthukata"), "vatthukatā");
		assert.ok(norms.has("anutthita"), "anuṭṭhitā");
	});
});

describe("buildTooltipPaliEntries", () => {
	it("extracts bracketed Pali from MDX glosses", () => {
		const entries = buildTooltipPaliEntries(enRoot, new Set());
		const norms = new Set(entries.map((e) => e.norm));
		assert.ok(norms.has("sakkayaditthi"));
		assert.ok(entries.some((e) => e.source === "tooltip"));
	});
});
