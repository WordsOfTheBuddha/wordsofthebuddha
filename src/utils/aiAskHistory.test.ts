import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_HISTORY_MAX_TURNS,
	buildAskFollowUpHistory,
	candidatesForAskFollowUp,
	clipAskHistoryTurns,
	collectAskHistoryShownSlugs,
	isDiversifyingAskFollowUp,
	isRefiningAskFollowUp,
	shouldExcludeAlreadyShownAskHits,
} from "./aiAskHistory";

describe("clipAskHistoryTurns", () => {
	it("keeps the first turn plus the newest when clipping", () => {
		const turns = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
		assert.deepEqual(clipAskHistoryTurns(turns, 6), [
			"t1",
			"t4",
			"t5",
			"t6",
			"t7",
			"t8",
		]);
		assert.equal(clipAskHistoryTurns(turns, 6)[0], "t1");
		assert.notEqual(clipAskHistoryTurns(turns, 6)[0], turns.slice(-6)[0]);
	});

	it("returns a copy when under the cap", () => {
		assert.deepEqual(clipAskHistoryTurns(["a", "b"], 6), ["a", "b"]);
	});
});

describe("buildAskFollowUpHistory", () => {
	it("includes turn 1 question, summary, and result slugs", () => {
		const history = buildAskFollowUpHistory([
			{
				question: "What is mindfulness?",
				lookingFor: "mindfulness",
				queries: ["sati"],
				results: [{ slug: "sn47.19" }, { slug: "mn10" }],
				summary: "SN 47.19 and MN 10 develop satipaṭṭhāna in practice.",
			},
			{
				question: "And anger?",
				lookingFor: "anger",
				queries: ["kodha"],
				results: [{ slug: "mn21" }],
			},
		]);
		assert.equal(history[0]?.question, "What is mindfulness?");
		assert.deepEqual(history[0]?.resultSlugs, ["sn47.19", "mn10"]);
		assert.match(history[0]?.summary || "", /satipaṭṭhāna/);
		assert.equal(history[1]?.question, "And anger?");
	});

	it("does not drop the original question when the thread is long", () => {
		const prior = Array.from({ length: ASK_HISTORY_MAX_TURNS + 2 }, (_, i) => ({
			question: i === 0 ? "Original theme?" : `Follow-up ${i}`,
			lookingFor: `t${i}`,
			queries: [`q${i}`],
			results: [{ slug: `mn${i + 1}` }],
		}));
		const history = buildAskFollowUpHistory(prior);
		assert.equal(history.length, ASK_HISTORY_MAX_TURNS);
		assert.equal(history[0]?.question, "Original theme?");
		assert.deepEqual(history[0]?.resultSlugs, ["mn1"]);
		assert.equal(
			history[history.length - 1]?.question,
			`Follow-up ${ASK_HISTORY_MAX_TURNS + 1}`,
		);
	});
});

describe("follow-up diversity vs refine", () => {
	const history = [
		{
			question: "What is mindfulness?",
			resultSlugs: ["sn47.19", "mn10"],
		},
	];
	const candidates = [
		{ slug: "sn47.19" },
		{ slug: "mn10" },
		{ slug: "mn118" },
		{ slug: "sn47.35" },
	];

	it("treats other/more/not-those as diversifying", () => {
		assert.equal(isDiversifyingAskFollowUp("other discourses"), true);
		assert.equal(isDiversifyingAskFollowUp("more like this"), true);
		assert.equal(isDiversifyingAskFollowUp("not those"), true);
		assert.equal(isDiversifyingAskFollowUp("what else?"), true);
		assert.equal(shouldExcludeAlreadyShownAskHits("other discourses", history), true);
	});

	it("does not exclude when they refine a named hit", () => {
		assert.equal(
			isRefiningAskFollowUp("tell me more about the second one"),
			true,
		);
		assert.equal(isRefiningAskFollowUp("tell me more about MN 131"), true);
		assert.equal(
			shouldExcludeAlreadyShownAskHits(
				"tell me more about MN 131",
				history,
			),
			false,
		);
		assert.equal(
			shouldExcludeAlreadyShownAskHits(
				"tell me more about the second one",
				history,
			),
			false,
		);
	});

	it("drops already-shown slugs for other discourses", () => {
		const next = candidatesForAskFollowUp(
			candidates,
			"other discourses",
			history,
		);
		assert.deepEqual(
			next.map((hit) => hit.slug),
			["mn118", "sn47.35"],
		);
		assert.notDeepEqual(
			next.map((hit) => hit.slug),
			["sn47.19", "mn10"],
		);
	});

	it("keeps already-shown slugs when they ask about MN 131 / the second one", () => {
		assert.deepEqual(
			candidatesForAskFollowUp(
				candidates,
				"tell me more about MN 131",
				history,
			).map((hit) => hit.slug),
			["sn47.19", "mn10", "mn118", "sn47.35"],
		);
		assert.deepEqual(
			collectAskHistoryShownSlugs(history),
			["sn47.19", "mn10"],
		);
	});

	it("uses a planner exclude list instead of the question-text heuristic", () => {
		assert.deepEqual(
			candidatesForAskFollowUp(
				candidates,
				"give me a fresh set",
				history,
				["sn47.19", "mn10"],
			).map((hit) => hit.slug),
			["mn118", "sn47.35"],
		);
		assert.deepEqual(
			candidatesForAskFollowUp(
				candidates,
				"other discourses",
				history,
				[],
			).map((hit) => hit.slug),
			["sn47.19", "mn10", "mn118", "sn47.35"],
		);
	});
});
