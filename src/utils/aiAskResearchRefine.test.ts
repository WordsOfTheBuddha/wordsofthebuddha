import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	parseResearchRefinePlan,
	RESEARCH_REFINE_SYSTEM,
	shouldAttemptResearchRefine,
} from "./aiAskResearchRefine";

describe("parseResearchRefinePlan", () => {
	it("keeps new queries and drops ones already tried", () => {
		const plan = parseResearchRefinePlan(
			JSON.stringify({
				needed: true,
				queries: ["sekha paṭipadā", "MN 53", "sekkha"],
				fallbackQueries: ["trainee"],
				reason: "Need the practice sequence, not only the stock list.",
			}),
			["sekkha", "MN 53"],
		);
		assert.equal(plan.needed, true);
		assert.deepEqual(plan.queries, ["sekha paṭipadā"]);
		assert.deepEqual(plan.fallbackQueries, ["trainee"]);
	});

	it("is not needed when the model asks for a repeat-only search", () => {
		const plan = parseResearchRefinePlan(
			'{"needed":true,"queries":["sekkha"],"reason":"again"}',
			["sekkha"],
		);
		assert.equal(plan.needed, false);
		assert.equal(plan.queries.length, 0);
	});

	it("is needed for a fuller read when the excerpt is thin", () => {
		const plan = parseResearchRefinePlan(
			JSON.stringify({
				needed: true,
				queries: [],
				readFull: ["MN 70", "sn99.1"],
				reason: "The excerpt missed the follower definitions.",
			}),
			[],
			["mn70", "an3.85"],
		);
		assert.equal(plan.needed, true);
		assert.deepEqual(plan.readFull, ["mn70"]);
		assert.deepEqual(plan.queries, []);
	});

	it("is needed for a cross-reference search the passages point to", () => {
		const plan = parseResearchRefinePlan(
			JSON.stringify({
				needed: true,
				queries: ["AN 3.85", "sekha paṭipadā"],
				reason: "MN 70 points to the training sequence but it is not in this set.",
			}),
			[],
			["mn70"],
		);
		assert.equal(plan.needed, true);
		assert.deepEqual(plan.queries, ["an3.85", "sekha paṭipadā"]);
	});
});

describe("shouldAttemptResearchRefine", () => {
	it("waits until there is enough function time left", () => {
		assert.equal(shouldAttemptResearchRefine(89_000), false);
		assert.equal(shouldAttemptResearchRefine(90_000), true);
	});
});

describe("RESEARCH_REFINE_SYSTEM", () => {
	it("asks for a second search only when the thesis needs it", () => {
		assert.match(RESEARCH_REFINE_SYSTEM, /needed:true only if/);
		assert.match(RESEARCH_REFINE_SYSTEM, /cross-check/);
		assert.match(RESEARCH_REFINE_SYSTEM, /You have excerpts/);
		assert.match(RESEARCH_REFINE_SYSTEM, /readFull/);
	});
});
