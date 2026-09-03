import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeDiscourseHits } from "./aiDiscourseHits";
import {
	isPrefixedAiDiscourseIdQuery,
	isWeakAiSearchQuery,
	normalizeAiSearchQuery,
	relaxSearchQuery,
	topicalFallbackQueries,
} from "./aiSearchQuery";

function hit(slug: string): { slug: string; title: string; description: string; contentSnippet: string | null } {
	return {
		slug,
		title: slug,
		description: "",
		contentSnippet: null,
	};
}

describe("AI_SEARCH_CANDIDATE_LIMIT", () => {
	it("is wide enough for Gemini rerank pools", async () => {
		const { AI_SEARCH_CANDIDATE_LIMIT } = await import("./aiDiscourseSearch");
		assert.ok(AI_SEARCH_CANDIDATE_LIMIT >= 500);
	});
});

describe("mergeDiscourseHits", () => {
	it("ranks multi-batch hits above single-batch ones (RRF)", () => {
		const merged = mergeDiscourseHits(
			[
				{ query: "anger", hits: [hit("mn2"), hit("sn1.71")] },
				{ query: "kodha", hits: [hit("mn2"), hit("an4.184")] },
			],
			12,
		);
		assert.equal(merged[0]?.slug, "mn2");
		assert.deepEqual(
			new Set(merged.map((item) => item.slug)),
			new Set(["mn2", "sn1.71", "an4.184"]),
		);
	});

	it("breaks score ties by earlier first-seen order", () => {
		const merged = mergeDiscourseHits(
			[
				{ query: "a", hits: [hit("sn1.71")] },
				{ query: "b", hits: [hit("an4.184")] },
			],
			12,
		);
		assert.deepEqual(
			merged.map((item) => item.slug),
			["sn1.71", "an4.184"],
		);
	});

	it("respects the merged limit", () => {
		const merged = mergeDiscourseHits(
			[{ query: "a", hits: [hit("a"), hit("b"), hit("c")] }],
			2,
		);
		assert.deepEqual(
			merged.map((item) => item.slug),
			["a", "b"],
		);
	});
});

describe("normalizeAiSearchQuery", () => {
	it("compacts spaced discourse IDs from the catalog", () => {
		assert.equal(normalizeAiSearchQuery("MN 109"), "mn109");
		assert.equal(normalizeAiSearchQuery("SN 22.82"), "sn22.82");
		assert.equal(normalizeAiSearchQuery("Puṇṇama"), "Puṇṇama");
		assert.equal(isPrefixedAiDiscourseIdQuery("MN 109"), true);
		assert.equal(isPrefixedAiDiscourseIdQuery("full moon night"), false);
	});
});

describe("isWeakAiSearchQuery", () => {
	it("flags full sentences but not short topical queries", () => {
		assert.equal(isWeakAiSearchQuery("mindfulness"), false);
		assert.equal(isWeakAiSearchQuery("SN 22.82"), false);
		assert.equal(
			isWeakAiSearchQuery(
				"I would like for an enumeration of all the other mind fulless coins there are not included",
			),
			true,
		);
	});
});

describe("topicalFallbackQueries", () => {
	it("extracts short terms and repairs common typos", () => {
		const terms = topicalFallbackQueries(
			"mind fulless coins in these dis courses about technique",
		);
		assert.ok(terms.some((term) => /mindfulness|satipa/i.test(term)));
		assert.ok(terms.every((term) => term.split(/\s+/).length <= 3));
	});

	it("seeds satipaṭṭhāna cluster for mindfulness questions", () => {
		const terms = topicalFallbackQueries(
			"I would like an enumeration of other mindfulness kinds and techniques",
		);
		assert.ok(terms.some((term) => /satipa/i.test(term)));
	});
});

describe("relaxSearchQuery", () => {
	it("strips exact quotes and collection prefixes", () => {
		assert.equal(relaxSearchQuery('"letting go"'), "letting go");
		assert.equal(relaxSearchQuery("^SN anger"), "anger");
		assert.equal(relaxSearchQuery("'sammāsati"), "sammāsati");
		assert.equal(relaxSearchQuery("illusion | ignorance"), "illusion ignorance");
		assert.equal(
			relaxSearchQuery("^AN urgency !mindfulness"),
			"urgency mindfulness",
		);
	});
});
