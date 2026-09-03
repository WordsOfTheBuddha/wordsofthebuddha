import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AI_RERANK_SUMMARY_MAX,
	applyRerankOrder,
	buildRerankUserPrompt,
	clipRerankSummary,
	parseRerankResponse,
	parseRerankSlugs,
} from "./aiResultRerank";

describe("parseRerankSlugs", () => {
	it("keeps only allowed slugs in order", () => {
		const allowed = new Set(["sn47.19", "sn47.10", "mn119"]);
		assert.deepEqual(
			parseRerankSlugs(
				'{"slugs":["SN 47.19","missing","sn47.10","sn47.19"]}',
				allowed,
			),
			["sn47.19", "sn47.10"],
		);
	});
});

describe("parseRerankResponse", () => {
	it("reads summary alongside slugs", () => {
		const allowed = new Set(["sn47.19", "mn10"]);
		const parsed = parseRerankResponse(
			JSON.stringify({
				slugs: ["sn47.19", "mn10"],
				summary:
					"These discourses focus on satipaṭṭhāna technique and practical application.",
			}),
			allowed,
		);
		assert.deepEqual(parsed.slugs, ["sn47.19", "mn10"]);
		assert.match(parsed.summary, /satipaṭṭhāna/i);
	});

	it("allows longer framing summaries for related-outside topics", () => {
		const framing = "A".repeat(900);
		assert.equal(clipRerankSummary(framing).length, 900);
		assert.ok(AI_RERANK_SUMMARY_MAX >= 1200);
		const allowed = new Set(["mn10"]);
		const parsed = parseRerankResponse(
			JSON.stringify({ slugs: ["mn10"], summary: framing }),
			allowed,
		);
		assert.equal(parsed.summary.length, 900);
	});
});

describe("applyRerankOrder", () => {
	it("reorders candidates and falls back when empty", () => {
		const candidates = [
			{ slug: "a", title: "A" },
			{ slug: "b", title: "B" },
			{ slug: "c", title: "C" },
		];
		assert.deepEqual(
			applyRerankOrder(candidates, ["c", "a"], 2).map((item) => item.slug),
			["c", "a"],
		);
		assert.deepEqual(
			applyRerankOrder(candidates, [], 2).map((item) => item.slug),
			["a", "b"],
		);
	});
});

describe("buildRerankUserPrompt", () => {
	it("includes id title and description", () => {
		const prompt = buildRerankUserPrompt("mindfulness technique", [
			{
				slug: "sn47.19",
				title: "At Sedaka",
				description: "Protecting oneself through mindfulness.",
			},
		]);
		assert.match(prompt, /SN 47\.19/i);
		assert.match(prompt, /At Sedaka/);
		assert.match(prompt, /Protecting oneself/);
		assert.match(prompt, /mindfulness technique/);
	});
});
