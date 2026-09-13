import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyResearchRevisePatch,
	clipEditsToWordBudget,
	clipResearchVersionIndex,
	countWords,
	currentResearchVersionN,
	nextResearchVersionN,
	normalizeReportHeading,
	parseResearchRevisePatch,
	researchReviseNeedsSearch,
	selectionQualifiesForRevise,
	splitReportSections,
	versionBodiesToKeep,
} from "./aiAskResearchRevise";

describe("selectionQualifiesForRevise", () => {
	it("ignores a single word, including a long Pāli term", () => {
		assert.equal(selectionQualifiesForRevise("yonisomanasikāra"), false);
		assert.equal(selectionQualifiesForRevise("attention"), false);
		assert.equal(selectionQualifiesForRevise("  "), false);
	});

	it("accepts two or more whitespace-separated tokens", () => {
		assert.equal(selectionQualifiesForRevise("radical attention"), true);
		assert.equal(selectionQualifiesForRevise("AN 10.47"), true);
	});
});

describe("splitReportSections and applyResearchRevisePatch", () => {
	const base = `Opening line.

## Intro

First section.

## Body as practice

Old body.

## Sources

- MN 10
`;

	it("splits preamble and headings and ignores Sources", () => {
		const sections = splitReportSections(base);
		assert.equal(sections[0]?.heading, "");
		assert.match(sections[0]?.markdown || "", /Opening/);
		assert.equal(sections[1]?.heading, "Intro");
		assert.equal(sections[2]?.heading, "Body as practice");
		assert.equal(sections.some((item) => /Sources/i.test(item.heading)), false);
	});

	it("replaces a named section and can insert after it", () => {
		const replaced = applyResearchRevisePatch(base, {
			changelog: "Rewrote the body.",
			edits: [
				{
					heading: "Body as practice",
					mode: "replace",
					markdown: "## Body as practice\n\nMN 10 in full.",
				},
			],
		});
		assert.match(replaced, /MN 10 in full/);
		assert.doesNotMatch(replaced, /Old body/);
		assert.match(replaced, /First section/);

		const inserted = applyResearchRevisePatch(replaced, {
			changelog: "Added death.",
			edits: [
				{
					heading: "Body as practice",
					mode: "insert-after",
					markdown: "## Death\n\nNew heading.",
				},
			],
		});
		assert.match(inserted, /## Death/);
		const bodyAt = inserted.indexOf("## Body as practice");
		const deathAt = inserted.indexOf("## Death");
		assert.ok(bodyAt >= 0 && deathAt > bodyAt);
	});

	it("appends when the heading is missing", () => {
		const next = applyResearchRevisePatch(base, {
			changelog: "Added a close.",
			edits: [
				{
					heading: "Not in the report",
					mode: "replace",
					markdown: "## Close\n\nDone.",
				},
			],
		});
		assert.match(next, /## Close/);
	});

	it("normalizes markdown links in headings", () => {
		assert.equal(
			normalizeReportHeading("Body: [MN 10](/mn10)"),
			"body: mn 10",
		);
	});
});

describe("parseResearchRevisePatch", () => {
	it("reads changelog and any number of edits", () => {
		const parsed = parseResearchRevisePatch(`{
			"changelog": "Three places.",
			"edits": [
				{"heading": "A", "mode": "replace", "markdown": "## A\\n\\none."},
				{"heading": "B", "mode": "insert-after", "markdown": "## C\\n\\ntwo."},
				{"heading": "D", "mode": "replace", "markdown": "## D\\n\\nthree."}
			]
		}`);
		assert.equal(parsed?.edits.length, 3);
		assert.equal(parsed?.changelog, "Three places.");
		assert.equal(parsed?.edits[1]?.mode, "insert-after");
	});
});

describe("clipEditsToWordBudget", () => {
	it("keeps earlier edits and clips the last to the remaining words", () => {
		const clipped = clipEditsToWordBudget(
			[
				{ heading: "A", mode: "replace", markdown: "one two three" },
				{ heading: "B", mode: "replace", markdown: "four five six seven" },
			],
			5,
		);
		assert.equal(clipped.length, 2);
		assert.equal(countWords(clipped[0]?.markdown || ""), 3);
		assert.equal(countWords(clipped[1]?.markdown || ""), 2);
	});
});

describe("version index", () => {
	it("assigns the next unused number and keeps the newest bodies", () => {
		const index = clipResearchVersionIndex([
			{ n: 1, at: 1, instruction: "", changelog: "First", from: null },
			{ n: 2, at: 2, instruction: "tone", changelog: "Softer", from: 1 },
		]);
		assert.equal(nextResearchVersionN(index), 3);
		assert.equal(currentResearchVersionN(index), 2);
		assert.deepEqual(versionBodiesToKeep(index, 1), [2]);
	});
});

describe("researchReviseNeedsSearch", () => {
	it("searches for named IDs or add/include language, not a tone pass", () => {
		assert.equal(researchReviseNeedsSearch("Make it a study guide."), false);
		assert.equal(researchReviseNeedsSearch("Add AN 10.60 to the body."), true);
		assert.equal(researchReviseNeedsSearch("Softer opening.", ["mn10"]), true);
	});
});
