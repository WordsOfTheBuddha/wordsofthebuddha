import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createSuggestionSearcher,
	MIN_FUZZY_QUERY_LEN,
	neighborsAtEditDistance1,
} from "./suggestionSearcher";
import type { SuggestionIndexEntry } from "../types/suggestions";
import d from "../../generated/suggestions-index.json" with { type: "json" };

describe("createSuggestionSearcher fuzzy matching", () => {
	const index: SuggestionIndexEntry[] = [
		{
			text: "virāga",
			norm: "viraga",
			source: "tooltip",
			entityType: "topic",
		},
		{
			text: "vīriya",
			norm: "viriya",
			source: "corpus",
			entityType: "topic",
		},
	];

	it("does not fuzzy-match tokens shorter than four characters", () => {
		const searcher = createSuggestionSearcher(index);
		assert.equal(searcher.suggest("vir").length, 2);
		assert.equal(searcher.suggest("viri")[0]?.text, "vīriya");
	});

	it("suggests one-edit typos from four characters onward", () => {
		const searcher = createSuggestionSearcher(index);
		const results = searcher.suggest("virago");
		assert.ok(results.some((e) => e.text === "virāga"));
	});

	it("skips fuzzy when the query is an exact normalized match", () => {
		const searcher = createSuggestionSearcher(index);
		const results = searcher.suggest("viraga");
		assert.equal(results[0]?.text, "virāga");
		assert.equal(results.length, 1);
	});
});

describe("neighborsAtEditDistance1", () => {
	it("includes insertions for missing characters", () => {
		assert.ok(neighborsAtEditDistance1("samata").includes("samatha"));
	});
});

describe("createSuggestionSearcher performance", () => {
	it("answers short prefix queries quickly on the full index", () => {
		const searcher = createSuggestionSearcher(d.entries);
		const queries = ["sa", "sat", "etam", "panitam"];

		for (const query of queries) {
			const t0 = performance.now();
			for (let i = 0; i < 100; i++) {
				searcher.suggest(query);
			}
			const ms = (performance.now() - t0) / 100;
			assert.ok(
				ms < 3,
				`expected <3ms per query for "${query}", got ${ms.toFixed(2)}ms`,
			);
		}
	});

	it("answers fuzzy typo queries quickly on the full index", () => {
		const searcher = createSuggestionSearcher(d.entries);
		const queries = ["samata", "viraco", "yanikato", "nibano"];

		for (const query of queries) {
			assert.ok(
				query.length >= MIN_FUZZY_QUERY_LEN,
				`test query "${query}" should be fuzzy-eligible`,
			);
			const t0 = performance.now();
			for (let i = 0; i < 100; i++) {
				searcher.suggest(query);
			}
			const ms = (performance.now() - t0) / 100;
			assert.ok(
				ms < 3,
				`expected <3ms per fuzzy query for "${query}", got ${ms.toFixed(2)}ms`,
			);
		}
	});
});
