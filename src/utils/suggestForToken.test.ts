import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SuggestionIndexEntry } from "../types/suggestions";
import {
	applySuggestion,
	parseActiveToken,
	suggestForToken,
} from "./suggestForToken";

const sampleIndex: SuggestionIndexEntry[] = [
	{
		text: "sati",
		norm: "sati",
		source: "pali",
		entityType: "quality",
	},
	{
		text: "Satisfaction",
		norm: "satisfaction",
		source: "title",
		entityType: "topic",
	},
	{
		text: "sampajāna",
		norm: "sampajana",
		source: "pali",
		entityType: "quality",
	},
];

describe("parseActiveToken", () => {
	it("returns the token under the cursor", () => {
		const value = "mindfulness sati rest";
		const token = parseActiveToken(value, 15);
		assert.equal(token?.raw, "sati");
		assert.equal(token?.suggestable, true);
	});

	it("skips caret and negation tokens", () => {
		const token = parseActiveToken("^SN sati", 3);
		assert.equal(token?.suggestable, false);
	});

	it("matches inside a quoted exact token", () => {
		const token = parseActiveToken("'sat", 4);
		assert.equal(token?.quotePrefix, "'");
		assert.equal(token?.raw, "sat");
		assert.equal(token?.suggestable, true);
	});
});

describe("suggestForToken", () => {
	it("ranks Pali prefix above English", () => {
		const results = suggestForToken("sat", sampleIndex, 5);
		assert.equal(results[0]?.text, "sati");
	});

	it("is diacritic-insensitive for exact matches", () => {
		const index: SuggestionIndexEntry[] = [
			{
				text: "sampajāna",
				norm: "sampajana",
				source: "pali",
				entityType: "quality",
			},
		];
		const results = suggestForToken("sampajana", index, 5);
		assert.equal(results[0]?.text, "sampajāna");
	});

	it("deduplicates by normalized form", () => {
		const index: SuggestionIndexEntry[] = [
			{
				text: "sati",
				norm: "sati",
				source: "pali",
				entityType: "quality",
			},
			{
				text: "Sati",
				norm: "sati",
				source: "title",
				entityType: "topic",
			},
		];
		const results = suggestForToken("sati", index, 5);
		assert.equal(results.length, 1);
	});
});

describe("applySuggestion", () => {
	it("preserves a leading quote on accept", () => {
		const value = "'sat";
		const token = parseActiveToken(value, value.length)!;
		const next = applySuggestion(value, token, "sati");
		assert.equal(next.value, "'sati");
		assert.equal(next.cursor, next.value.length);
	});

	it("replaces only the active token in a multi-word query", () => {
		const value = "mindfulness sat";
		const token = parseActiveToken(value, value.length)!;
		const next = applySuggestion(value, token, "sati");
		assert.equal(next.value, "mindfulness sati");
	});
});
