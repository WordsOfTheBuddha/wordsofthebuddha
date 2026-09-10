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
	});
});
