import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatResearchReadFullProgress,
	formatResearchReadPaliProgress,
	formatResearchReadProgress,
	parseResearchContinueDecision,
	resolveResearchReadFullSlugs,
	RESEARCH_CONTINUE_SYSTEM,
	shouldEvaluateResearchContinue,
} from "./aiAskResearchContinue";

describe("parseResearchContinueDecision", () => {
	it("continues only when the model supplies new queries", () => {
		const decision = parseResearchContinueDecision(
			JSON.stringify({
				continue: true,
				queries: ["sekha paṭipadā", "MN 53", "sekkha"],
				fallbackQueries: ["trainee"],
				guidance: "Find the training sequence, not only the stock list.",
				reason: "The draft cites lists without the path.",
			}),
			["sekkha", "MN 53"],
		);
		assert.equal(decision.continue, true);
		assert.deepEqual(decision.queries, ["sekha paṭipadā"]);
		assert.deepEqual(decision.fallbackQueries, ["trainee"]);
		assert.match(decision.guidance, /training sequence/);
	});

	it("continues for a fuller read of an already selected discourse", () => {
		const decision = parseResearchContinueDecision(
			JSON.stringify({
				continue: true,
				queries: [],
				readFull: ["MN 70", "sn99.1", "mn70"],
				reason: "The excerpt missed a later section of MN 70.",
			}),
			[],
			["mn70", "an3.85"],
		);
		assert.equal(decision.continue, true);
		assert.deepEqual(decision.readFull, ["mn70"]);
	});

	it("continues for a Pali and English reread of a selected discourse", () => {
		const decision = parseResearchContinueDecision(
			JSON.stringify({
				continue: true,
				queries: [],
				readPali: ["MN 70", "sn99.1"],
				reason: "The claim turns on the Pāli compound.",
			}),
			[],
			["mn70", "an3.85"],
		);
		assert.equal(decision.continue, true);
		assert.deepEqual(decision.readPali, ["mn70"]);
		assert.deepEqual(decision.readFull, []);
	});

	it("does not continue when readFull IDs are not in the selected set", () => {
		const decision = parseResearchContinueDecision(
			'{"continue":true,"readFull":["MN 70"],"reason":"more"}',
			[],
			["an3.85"],
		);
		assert.equal(decision.continue, false);
		assert.deepEqual(decision.readFull, []);
	});

	it("does not continue when the model asks with no new queries", () => {
		const decision = parseResearchContinueDecision(
			'{"continue":true,"queries":["sekkha"],"reason":"again"}',
			["sekkha"],
		);
		assert.equal(decision.continue, false);
		assert.equal(decision.queries.length, 0);
	});

	it("does not continue when the model is confident", () => {
		const decision = parseResearchContinueDecision(
			'{"continue":false,"queries":["an extra search"],"reason":"already covered"}',
		);
		assert.equal(decision.continue, false);
	});

	it("treats unusable output as no continue", () => {
		const decision = parseResearchContinueDecision("not json");
		assert.equal(decision.continue, false);
		assert.deepEqual(decision.queries, []);
	});
});

describe("resolveResearchReadFullSlugs", () => {
	it("maps named search IDs onto the selected set", () => {
		assert.deepEqual(
			resolveResearchReadFullSlugs(
				["MN 70", "sekkha", "AN 3.85"],
				["mn70", "an3.85", "sn12.33"],
				["sn12.33", "mn99"],
			),
			["mn70", "an3.85", "sn12.33"],
		);
	});

	it("splits OR’d named IDs into individual full reads", () => {
		assert.deepEqual(
			resolveResearchReadFullSlugs(
				["SN 12.49 | SN 48.9", "nibbedhika"],
				["sn12.49", "sn48.9", "sn48.53"],
			),
			["sn12.49", "sn48.9"],
		);
	});
});

describe("formatResearchReadFullProgress", () => {
	it("names the discourses being opened in full", () => {
		assert.equal(
			formatResearchReadFullProgress([]),
			"Reading selected discourses in full…",
		);
		assert.equal(
			formatResearchReadFullProgress(["mn70", "sn12.49"]),
			"Reading MN 70, SN 12.49 in full…",
		);
	});
});

describe("formatResearchReadPaliProgress", () => {
	it("names the discourses being opened in Pāli and English", () => {
		assert.equal(
			formatResearchReadPaliProgress([]),
			"Reading Pāli with the English…",
		);
		assert.equal(
			formatResearchReadPaliProgress(["mn70", "sn12.49"]),
			"Reading MN 70, SN 12.49 in Pāli and English…",
		);
		assert.equal(
			formatResearchReadProgress({
				readFull: ["an3.85"],
				readPali: ["mn70"],
			}),
			"Reading MN 70 in Pāli and English…",
		);
	});
});

describe("shouldEvaluateResearchContinue", () => {
	it("needs enough function time left to review and enqueue", () => {
		assert.equal(shouldEvaluateResearchContinue(24_000), false);
		assert.equal(shouldEvaluateResearchContinue(25_000), true);
	});
});

describe("RESEARCH_CONTINUE_SYSTEM", () => {
	it("asks the model for a concrete gap before continuing", () => {
		assert.match(RESEARCH_CONTINUE_SYSTEM, /continue:true only if/);
		assert.match(RESEARCH_CONTINUE_SYSTEM, /readFull/);
		assert.match(RESEARCH_CONTINUE_SYSTEM, /readPali/);
		assert.match(RESEARCH_CONTINUE_SYSTEM, /Do not ask for a second pass only to polish prose/);
	});
});
