import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyResearchVerifyToPlan,
	parseResearchVerify,
} from "./aiAskResearch";
import type { AiRewritePlan } from "./aiQueryRewrite";

const plan: AiRewritePlan = {
	correctedQuestion: "What do the discourses teach about feeling?",
	lookingFor: "feeling",
	queries: ["vedana", "feeling"],
	fallbackQueries: ["sensation"],
	offTopic: false,
	coverage: "brief",
};

describe("parseResearchVerify", () => {
	it("reads onTrack and a one-line note", () => {
		const parsed = parseResearchVerify(
			'{"onTrack":true,"note":"On track · vedanā","revisedQueries":[]}',
		);
		assert.equal(parsed.onTrack, true);
		assert.equal(parsed.note, "On track · vedanā");
		assert.deepEqual(parsed.revisedQueries, []);
	});

	it("treats missing JSON as on-track so research still proceeds", () => {
		const parsed = parseResearchVerify("not json");
		assert.equal(parsed.onTrack, true);
		assert.deepEqual(parsed.revisedQueries, []);
	});

	it("caps and normalizes revised queries", () => {
		const parsed = parseResearchVerify(
			JSON.stringify({
				onTrack: false,
				note: "Adjusted searches · added SN 36",
				revisedQueries: [
					"  vedanā  ",
					"vedana",
					"^SN vedana",
					"feeling tone",
					"extra pad",
					"too many",
				],
				lookingFor: "feeling (vedanā)",
			}),
		);
		assert.equal(parsed.onTrack, false);
		assert.equal(parsed.revisedQueries.length, 4);
		assert.equal(parsed.lookingFor, "feeling (vedanā)");
	});
});

describe("applyResearchVerifyToPlan", () => {
	it("forces survey coverage and keeps queries when on track", () => {
		const next = applyResearchVerifyToPlan(plan, {
			onTrack: true,
			note: "On track",
			revisedQueries: [],
		});
		assert.equal(next.coverage, "survey");
		assert.deepEqual(next.queries, plan.queries);
	});

	it("replaces queries once when off-track", () => {
		const next = applyResearchVerifyToPlan(plan, {
			onTrack: false,
			note: "Adjusted",
			revisedQueries: ["^SN vedana", "feeling"],
			lookingFor: "vedanā",
		});
		assert.deepEqual(next.queries, ["^SN vedana", "feeling"]);
		assert.equal(next.lookingFor, "vedanā");
		assert.equal(next.coverage, "survey");
	});

	it("keeps original queries when off-track but no revisions", () => {
		const next = applyResearchVerifyToPlan(plan, {
			onTrack: false,
			note: "Thin scout",
			revisedQueries: [],
		});
		assert.deepEqual(next.queries, plan.queries);
	});
});
