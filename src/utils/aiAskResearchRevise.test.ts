import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyResearchRevisePatch,
	changedReportBlockKeys,
	clipEditsToWordBudget,
	clipResearchVersionIndex,
	countWords,
	formatResearchVersionStats,
	isResearchRevisionStartedLabel,
	locateReviseParagraph,
	reportBlockKeys,
	reportSectionContainingText,
	reportSectionMarkdown,
	sanitizeResearchVersionMeta,
	currentResearchVersionN,
	healedResearchVersionIndex,
	nextResearchRevisionN,
	nextResearchVersionN,
	normalizeReportHeading,
	openingResearchVersionMeta,
	parseResearchRevisePatch,
	researchRevisionStartedNote,
	RESEARCH_REVISE_MAX_OUTPUT_WORDS,
	researchReviseFailedAsTooLong,
	researchReviseNeedsSearch,
	selectionQualifiesForRevise,
	splitReportSections,
	mergeResearchHits,
	versionBodiesToKeep,
	applyResearchReviseOps,
	clipResearchRevisePlan,
	numberedReportForModel,
	reportBlocksContainingText,
	researchRevisePatchIsEmpty,
	splitReportBlocks,
	stripReportBlockTags,
} from "./aiAskResearchRevise";
import {
	buildReviseWriterMessage,
	planReviseEvidence,
	RESEARCH_REVISE_WRITER_MAX_TOKENS,
} from "./aiAskResearchReviseWrite";
import type { AiDiscourseHit } from "./aiDiscourseHits";

describe("block-addressed revise ops", () => {
	const report = `Opening line.

## Mindfulness

Another text traces the chain from the faculties to Nibbāna. The Buddha replies: "the spiritual life is lived grounded upon Nibbāna" SN 48.42. Uṇṇābha's faith is settled.

The discourse then declares the faculties easy to grasp.

- one
- two

> "old quote" MN 10

## Sources

1. SN 48.42`;

	it("splits into labelled blocks, keeps lists whole, drops Sources", () => {
		const blocks = splitReportBlocks(report);
		assert.deepEqual(
			blocks.map((b) => `${b.id}:${b.kind}`),
			["p1:paragraph", "p2:heading", "p3:paragraph", "p4:paragraph", "p5:list", "p6:quote"],
		);
		assert.equal(blocks[4]?.markdown, "- one\n- two");
		assert.equal(blocks[3]?.section, "Mindfulness");
		const numbered = numberedReportForModel(blocks);
		assert.match(numbered, /^\[\[p1\]\]\nOpening line\./);
		assert.match(numbered, /\[\[p5\]\]\n- one\n- two/);
		assert.doesNotMatch(numbered, /## Sources/);
	});

	it("update splits a paragraph into prose + blockquote + prose, touching nothing else", () => {
		const next = applyResearchReviseOps(report, [
			{
				op: "update",
				id: "p3",
				markdown:
					'Another text traces the chain from the faculties to Nibbāna. The Buddha replies:\n\n> "the spiritual life is lived grounded upon Nibbāna" SN 48.42\n\nUṇṇābha\'s faith is settled.',
			},
		]);
		const blocks = splitReportBlocks(next);
		assert.equal(blocks.length, 8);
		assert.equal(blocks[3]?.kind, "quote");
		assert.equal(blocks[5]?.markdown, "The discourse then declares the faculties easy to grasp.");
		assert.equal(blocks[7]?.markdown, '> "old quote" MN 10');
	});

	it("delete / insert-after / insert-before land on the named block; unknown ids are ignored", () => {
		const next = applyResearchReviseOps(report, [
			{ op: "delete", id: "p4", markdown: "" },
			{ op: "insert-after", id: "p6", markdown: "## New section\n\nNew text." },
			{ op: "insert-before", id: "p2", markdown: "Lead-in." },
			{ op: "update", id: "p99", markdown: "should vanish" },
		]);
		const bodies = splitReportBlocks(next).map((b) => b.markdown);
		assert.deepEqual(bodies, [
			"Opening line.",
			"Lead-in.",
			"## Mindfulness",
			"Another text traces the chain from the faculties to Nibbāna. The Buddha replies: \"the spiritual life is lived grounded upon Nibbāna\" SN 48.42. Uṇṇābha's faith is settled.",
			"- one\n- two",
			'> "old quote" MN 10',
			"## New section",
			"New text.",
		]);
		assert.doesNotMatch(next, /should vanish/);
	});

	it("strips echoed [[pN]] tags from new markdown", () => {
		assert.equal(stripReportBlockTags("[[p3]]\nBody here [[p4]] tail"), "Body here tail");
	});

	it("parses ops JSON (and block-addressed rows that landed in edits)", () => {
		const patch = parseResearchRevisePatch(
			JSON.stringify({
				changelog: "Set the quotation off.",
				ops: [
					{ op: "replace", id: "p3", markdown: "[[p3]]\nNew p3" },
					{ op: "remove", block: "4" },
					{ op: "insert-after", id: "p6", markdown: "" },
				],
				edits: [{ mode: "update", id: "p1", markdown: "New opening" }],
			}),
		);
		assert.ok(patch);
		assert.deepEqual(patch?.ops, [
			{ op: "update", id: "p3", markdown: "New p3" },
			{ op: "delete", id: "p4", markdown: "" },
			{ op: "update", id: "p1", markdown: "New opening" },
		]);
		assert.equal(patch?.edits.length, 0);
		assert.equal(researchRevisePatchIsEmpty(patch), false);
		assert.equal(researchRevisePatchIsEmpty({ changelog: "x", edits: [] }), true);
		assert.equal(
			researchReviseFailedAsTooLong({ patch, truncated: true }),
			false,
		);
	});

	it("applyResearchRevisePatch prefers ops, then layers legacy edits", () => {
		const next = applyResearchRevisePatch(report, {
			changelog: "",
			ops: [{ op: "update", id: "p1", markdown: "Fresh opening." }],
			edits: [{ heading: "Mindfulness", mode: "insert-after", markdown: "## After\n\nMore." }],
		});
		assert.match(next, /^Fresh opening\./);
		assert.match(next, /## After\n\nMore\./);
	});

	it("finds the block(s) a pinned selection sits in", () => {
		const blocks = splitReportBlocks(report);
		assert.deepEqual(
			reportBlocksContainingText(blocks, "Uṇṇābha's faith is settled"),
			["p3"],
		);
		// A selection spanning two paragraphs names both.
		const span = `${blocks[2]?.markdown}\n\n${blocks[3]?.markdown}`;
		assert.deepEqual(reportBlocksContainingText(blocks, span), ["p3", "p4"]);
		assert.deepEqual(reportBlocksContainingText(blocks, "nothing like this at all here"), []);
	});

	it("clips a planner answer", () => {
		assert.equal(clipResearchRevisePlan({}), null);
		const plan = clipResearchRevisePlan({
			targets: ["p3", "3", "P3", "junk", "p7"],
			intent: "  Split p3 around the quotation.  ",
			searchQueries: ["mindfulness faculties", "mindfulness faculties", "x", "y", "z"],
			readFull: ["SN 48.42", "mn10", "not an id"],
		});
		assert.deepEqual(plan?.targets, ["p3", "p7"]);
		assert.equal(plan?.intent, "Split p3 around the quotation.");
		assert.deepEqual(plan?.searchQueries, ["mindfulness faculties", "x", "y"]);
		assert.deepEqual(plan?.readFull, ["sn48.42", "mn10"]);
	});

	const hit = (slug: string): AiDiscourseHit =>
		({ slug, title: slug, snippet: "", score: 1 }) as unknown as AiDiscourseHit;

	it("planReviseEvidence follows the plan: re-reads known ids, searches for unknown ones", () => {
		const out = planReviseEvidence({
			instruction: "Make the quoted part a sutta quote.",
			existingHits: [hit("sn48.42"), hit("mn10")],
			plan: { targets: ["p3"], intent: "", searchQueries: [], readFull: ["sn48.42", "an4.41"] },
		});
		assert.deepEqual(out.reread.map((h) => h.slug), ["sn48.42"]);
		assert.deepEqual(out.queries, ["AN 4.41"]);
		assert.equal(out.needsSearch, true);
		const quiet = planReviseEvidence({
			instruction: "Add more discourses on this.",
			existingHits: [],
			plan: { targets: ["p3"], intent: "wording only", searchQueries: [], readFull: [] },
		});
		assert.equal(quiet.needsSearch, false);
		assert.deepEqual(quiet.queries, []);
	});

	it("planReviseEvidence without a plan keeps the instruction heuristics", () => {
		const out = planReviseEvidence({
			instruction: "Add more discourses on the faculties.",
			existingHits: [],
		});
		assert.equal(out.needsSearch, true);
		assert.deepEqual(out.queries, ["Add more discourses on the faculties."]);
	});

	it("writer message carries the numbered report, plan and target blocks", () => {
		const blocks = splitReportBlocks(report);
		const message = buildReviseWriterMessage({
			blocks,
			instruction: "Make the quoted part a sutta quote.",
			quote: "Uṇṇābha's faith is settled.",
			plan: { targets: ["p4"], intent: "Split p3 around the quotation.", searchQueries: [], readFull: [] },
		});
		assert.match(message, /Plan \(from a first pass over the report\): Split p3/);
		assert.match(message, /it sits in p3/);
		assert.match(message, /Target blocks: p3, p4 —/);
		assert.match(message, /Target blocks as they stand now:\n\[\[p3\]\]\nAnother text/);
		assert.match(message, /Current report, with block ids:\n\[\[p1\]\]/);
		assert.match(message, /No passages supplied/);
	});
});
import { RESEARCH_REPORT_MAX_CHARS } from "./aiAskResearchReport";

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

describe("replace-text edits", () => {
	const report = `## Faculties

The five sense faculties are easy to grasp, as they are enumerated and their fields are known. Yet without mindfulness they lead to hindrances.

Another text traces the chain of dependency from the faculties to Nibbāna, situating mindfulness as the bridge [SN 48.42](/sn48.42).

## Close

Done.`;

	it("rewrites the paragraph containing the excerpt in place, keeping neighbours", () => {
		const next = applyResearchRevisePatch(report, {
			changelog: "Quoted SN 48.42.",
			edits: [
				{
					heading: "Faculties",
					mode: "replace-text",
					find: "Another text traces the chain of dependency",
					markdown:
						'Another text traces the chain: "the mind takes recourse in mindfulness" (SN 48.42).',
				},
			],
		});
		assert.match(next, /"the mind takes recourse in mindfulness"/);
		assert.doesNotMatch(next, /situating mindfulness as the bridge/);
		assert.match(next, /The five sense faculties are easy to grasp/);
		assert.match(next, /## Close\n\nDone\./);
		assert.equal(next.match(/## Faculties/g)?.length, 1);
	});

	it("finds the paragraph by token overlap when the excerpt is lightly paraphrased", () => {
		const paragraphs = [
			"The five sense faculties are easy to grasp, as they are enumerated and their fields are known.",
			"Another text traces the chain of dependency from the faculties to Nibbāna.",
		];
		assert.equal(
			locateReviseParagraph(
				paragraphs,
				"Another text traces the chain of dependency from the sense faculties to Nibbana",
			),
			1,
		);
		assert.equal(locateReviseParagraph(paragraphs, "completely unrelated words"), -1);
	});

	it("deletes a paragraph when markdown is empty and drops unfound excerpts", () => {
		const deleted = applyResearchRevisePatch(report, {
			changelog: "Cut.",
			edits: [
				{
					heading: "",
					mode: "replace-text",
					find: "The five sense faculties are easy to grasp",
					markdown: "",
				},
			],
		});
		assert.doesNotMatch(deleted, /easy to grasp/);
		assert.match(deleted, /Another text traces/);
		const untouched = applyResearchRevisePatch(report, {
			changelog: "Nothing.",
			edits: [
				{
					heading: "Faculties",
					mode: "replace-text",
					find: "this excerpt is nowhere in the report at all",
					markdown: "Loose paragraph that must not be appended.",
				},
			],
		});
		assert.doesNotMatch(untouched, /must not be appended/);
	});

	it("parses find + mode synonyms into replace-text", () => {
		const parsed = parseResearchRevisePatch(`{
			"changelog": "Edited.",
			"edits": [
				{"heading": "A", "mode": "replace-text", "find": "old words here", "markdown": "new words"},
				{"heading": "A", "mode": "edit", "find": "other words", "markdown": "changed"},
				{"heading": "B", "find": "third", "markdown": ""}
			]
		}`);
		assert.equal(parsed?.edits.length, 3);
		assert.equal(parsed?.edits[0]?.mode, "replace-text");
		assert.equal(parsed?.edits[0]?.find, "old words here");
		assert.equal(parsed?.edits[1]?.mode, "replace-text");
		assert.equal(parsed?.edits[2]?.mode, "replace-text");
		assert.equal(parsed?.edits[2]?.markdown, "");
	});

	it("exposes section markdown for evidence context", () => {
		assert.match(reportSectionMarkdown(report, "Faculties"), /^## Faculties/);
		assert.equal(reportSectionMarkdown(report, "Missing"), "");
		assert.match(
			reportSectionContainingText(report, "chain of dependency from the faculties"),
			/^## Faculties/,
		);
	});
});

describe("changed block keys", () => {
	it("lists paragraphs and list items the new version added or rewrote", () => {
		const base = "## A\n\nSame paragraph stays right here.\n\n- item one stays here\n- item two changes here";
		const next =
			"## A\n\nSame paragraph stays right here.\n\n- item one stays here\n- item two is rewritten now\n\nNew paragraph with [SN 1.1](/sn1.1).";
		assert.deepEqual(reportBlockKeys("Short.\n\nA long enough paragraph here."), [
			"alongenoughparagraphhere",
		]);
		assert.deepEqual(changedReportBlockKeys(base, next), [
			"itemtwoisrewrittennow",
			"newparagraphwithsn11",
		]);
		assert.deepEqual(changedReportBlockKeys(base, base), []);
	});
});

describe("version stats", () => {
	it("keeps stats through sanitize and formats deltas", () => {
		const meta = sanitizeResearchVersionMeta({
			n: 2,
			at: 5,
			instruction: "x",
			changelog: "y",
			from: 1,
			stats: { words: 120, cited: 3, additional: 0 },
		});
		assert.deepEqual(meta?.stats, { words: 120, cited: 3, additional: 0 });
		assert.equal(
			formatResearchVersionStats(
				{ words: 120, cited: 3, additional: 2 },
				{ words: 100, cited: 4, additional: 2 },
			),
			"120 words (+20) · 3 cited (−1) · 2 additional sources",
		);
		assert.equal(formatResearchVersionStats(undefined), "");
		assert.equal(openingResearchVersionMeta(1, { words: 5, cited: 0, additional: 0 }).stats?.words, 5);
	});

	it("recognizes the divider label", () => {
		assert.equal(isResearchRevisionStartedLabel("Started v2 revision"), true);
		assert.equal(isResearchRevisionStartedLabel("Started v2 revision…"), true);
		assert.equal(isResearchRevisionStartedLabel("Revised the report"), false);
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

	it("starts at v1 and unions hits by slug", () => {
		assert.equal(openingResearchVersionMeta(1).n, 1);
		assert.equal(openingResearchVersionMeta(1).changelog, "Original report.");
		assert.equal(nextResearchRevisionN([]), 2);
		assert.equal(researchRevisionStartedNote(2), "Started v2 revision…");
		const healed = healedResearchVersionIndex({
			versionIndex: [
				{ n: 1, at: 1, instruction: "", changelog: "Original report.", from: null },
			],
			processNotes: ["Considering the revision…", "Revising the report…"],
			createdAt: 1,
		});
		assert.equal(healed[1]?.n, 2);
		assert.equal(healed[1]?.changelog, "Revised the report.");
		assert.deepEqual(
			mergeResearchHits(
				[{ slug: "mn10" }, { slug: "sn47.19" }],
				[{ slug: "MN10" }, { slug: "an10.60" }],
			).map((hit) => hit.slug),
			["mn10", "sn47.19", "an10.60"],
		);
	});
});

describe("revise output budget", () => {
	it("raises the writer completion cap without moving the 100k ingest cap", () => {
		assert.equal(RESEARCH_REVISE_WRITER_MAX_TOKENS, 50_000);
		assert.ok(RESEARCH_REVISE_MAX_OUTPUT_WORDS >= 30_000);
		assert.equal(RESEARCH_REPORT_MAX_CHARS, 100_000);
	});
});

describe("researchReviseFailedAsTooLong", () => {
	it("treats truncated JSON without edits as too long", () => {
		assert.equal(
			researchReviseFailedAsTooLong({
				patch: null,
				truncated: true,
				content: '{"changelog":"x","edits":[{"heading":"A","markdown":"',
			}),
			true,
		);
		assert.equal(
			researchReviseFailedAsTooLong({
				patch: {
					changelog: "ok",
					edits: [{ heading: "A", mode: "replace", markdown: "## A\n\nDone." }],
				},
				truncated: true,
			}),
			false,
		);
		assert.equal(
			researchReviseFailedAsTooLong({
				patch: null,
				content: "Could not edit.",
			}),
			false,
		);
	});
});

describe("researchReviseNeedsSearch", () => {
	it("searches for named IDs or add/include language, not a tone pass", () => {
		assert.equal(researchReviseNeedsSearch("Make it a study guide."), false);
		assert.equal(researchReviseNeedsSearch("Add AN 10.60 to the body."), true);
		assert.equal(researchReviseNeedsSearch("Softer opening.", ["mn10"]), true);
	});
});
