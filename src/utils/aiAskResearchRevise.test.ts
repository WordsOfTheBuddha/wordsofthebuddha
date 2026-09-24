import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyResearchRevisePatch,
	changedReportBlockKeys,
	auditResearchRevisePatchConstraints,
	constrainResearchRevisePatch,
	rejectResearchReviseOpReason,
	diffReportBlockChanges,
	enumerateReportBlocks,
	reportBlockDiffCount,
	clipEditsToWordBudget,
	clipResearchVersionIndex,
	countWords,
	formatResearchVersionLabelForTurn,
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
	normalizeResearchDiscourseLinks,
	openingResearchVersionMeta,
	parseResearchRevisePatch,
	researchRevisionStartedNote,
	RESEARCH_REVISE_MAX_OUTPUT_WORDS,
	researchReviseFailedAsTooLong,
	researchReviseVersionChangelog,
	researchReviseWriterFailureMessage,
	RESEARCH_REVISE_UNPARSEABLE_ERROR,
	RESEARCH_REVISE_EMPTY_PATCH_ERROR,
	selectionQualifiesForRevise,
	splitReportSections,
	mergeResearchHits,
	versionBodiesToKeep,
	applyResearchReviseOps,
	clipResearchRevisePlan,
	clipResearchReviseInstruction,
	normalizeResearchReviseInstructionInput,
	clipResearchChangelog,
	RESEARCH_REVISE_CHANGELOG_MAX,
	numberedReportForModel,
	reportBlocksContainingText,
	researchRevisePatchIsEmpty,
	normalizeReportBlockId,
	splitReportBlocks,
	splitBlockIdForEnumeratedKey,
	formatResearchReviseQuoteForModel,
	stripReportBlockTags,
	expandReportBlockIdRange,
	REPORT_BLOCK_RANGE_MAX,
	ensureResearchReviseMermaidFences,
	fenceMermaidInOpMarkdown,
	fenceMermaidMarkdown,
	isUnfencedMermaidMarkdown,
	resolveResearchReviseTargets,
	researchRevisePlanNote,
	reviseEvidenceRequestedIds,
	researchRevisePlanSummary,
	researchReviseClarifyBaseLabel,
	sanitizeResearchReviseClarify,
	isResearchReviseClarifyExpired,
	RESEARCH_REVISE_PLAN_SUMMARY_MAX,
} from "./aiAskResearchRevise";
import {
	buildReviseWriterMessage,
	planReviseEvidence,
	reviseClarificationsBlock,
	reviseSlugsForDiscourseIds,
	formatReviseEvidenceDebugLog,
	hitMatchesDiscourseId,
	RESEARCH_REVISE_PLAN_SYSTEM,
	RESEARCH_REVISE_PLANNER_BUDGET_MS,
	RESEARCH_REVISE_WRITER_BASE_MS,
	RESEARCH_REVISE_WRITER_MAX_TOKENS,
	resolveResearchReviseWriterBudgetMs,
	resolveResearchReviseWriterMaxTokens,
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

	it("numbers p-blocks the way the reader sees ¶ N; headings get h ids", () => {
		const blocks = splitReportBlocks(report);
		assert.deepEqual(
			blocks.map((b) => `${b.id}:${b.kind}`),
			["p1:paragraph", "h1:heading", "p2:paragraph", "p3:paragraph", "p4:list", "p5:quote"],
		);
		assert.equal(blocks[4]?.markdown, "- one\n- two");
		assert.equal(blocks[3]?.section, "Mindfulness");
		const numbered = numberedReportForModel(blocks);
		assert.match(numbered, /^\[\[p1\]\]\nOpening line\./);
		assert.match(numbered, /\[\[h1\]\]\n## Mindfulness/);
		assert.match(numbered, /\[\[p4\]\]\n- one\n- two/);
		assert.doesNotMatch(numbered, /## Sources/);
	});

	it("keeps ids aligned with rendered ¶ numbers across headings, tables, fences, glued headings and loose lists", () => {
		const md = [
			"# Title",
			"## 1. First",
			"Lead paragraph.",
			"",
			"| A | B |",
			"|---|---|",
			"| 1 | 2 |",
			"",
			"```mermaid",
			"flowchart LR",
			" A --> B",
			"```",
			"",
			"### Glued heading",
			"Text right under the heading.",
			"> quote interrupting the paragraph",
			"",
			"- one",
			"",
			"- two",
			"",
			"---",
			"",
			"mermaid",
			"flowchart LR",
			" C --> D",
		].join("\n");
		const blocks = splitReportBlocks(md);
		assert.deepEqual(
			blocks.map((b) => `${b.id}:${b.kind}`),
			[
				"h1:heading",
				"h2:heading",
				"p1:paragraph",
				"t1:other",
				"c1:code",
				"h3:heading",
				"p2:paragraph",
				"p3:quote",
				"p4:list",
				"t2:other",
				"p5:paragraph",
			],
		);
		assert.equal(blocks[8]?.markdown, "- one\n\n- two");
		// p5 is the broken (unfenced) diagram — a plain paragraph the reader sees as ¶ 5.
		assert.match(blocks[10]?.markdown || "", /^mermaid\nflowchart/);
	});

	it("update splits a paragraph into prose + blockquote + prose, touching nothing else", () => {
		const next = applyResearchReviseOps(report, [
			{
				op: "update",
				id: "p2",
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
			{ op: "delete", id: "p3", markdown: "" },
			{ op: "insert-after", id: "p5", markdown: "## New section\n\nNew text." },
			{ op: "insert-before", id: "h1", markdown: "Lead-in." },
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

	it("rewrites a hyphenated discourse link to the dotted site slug", () => {
		const report = "Opening.\n\nSee the chain.";
		const next = applyResearchRevisePatch(report, {
			changelog: "",
			edits: [],
			ops: [
				{
					op: "update",
					id: "p2",
					markdown:
						'The chain is [SN 12.67 ¶3](/sn12-67#3), beside [Dhp 1–20](/dhp1-20) and [SN 17.13–20](/sn17.13-20#1).',
				},
			],
		});
		assert.match(next, /\/sn12\.67#3/);
		assert.match(next, /\/dhp1-20/);
		assert.match(next, /\/sn17\.13-20#1/);
		assert.equal(
			normalizeResearchDiscourseLinks("[SNP 4.11](/SNP4-11)"),
			"[SNP 4.11](/snp4.11)",
		);
	});

	it("strips echoed [[pN]] / [[hN]] tags from new markdown", () => {
		assert.equal(stripReportBlockTags("[[p3]]\nBody here [[p4]] tail"), "Body here tail");
		assert.equal(stripReportBlockTags("[[h2]]\n## Heading"), "## Heading");
	});

	it("normalizes reader and model block references to ids", () => {
		assert.equal(normalizeReportBlockId("P12"), "p12");
		assert.equal(normalizeReportBlockId("¶ 12"), "p12");
		assert.equal(normalizeReportBlockId("paragraph 12"), "p12");
		assert.equal(normalizeReportBlockId(12), "p12");
		assert.equal(normalizeReportBlockId("[[h3]]"), "h3");
		assert.equal(normalizeReportBlockId("C1"), "c1");
		assert.equal(normalizeReportBlockId("junk7"), "");
		assert.equal(normalizeReportBlockId("sn48.42"), "");
	});

	it("parses ops JSON (and block-addressed rows that landed in edits)", () => {
		const patch = parseResearchRevisePatch(
			JSON.stringify({
				changelog: "Set the quotation off.",
				ops: [
					{ op: "replace", id: "p3", markdown: "[[p3]]\nNew p3" },
					{ op: "remove", block: "4" },
					{ op: "insert-after", id: "p6", markdown: "" },
					{ op: "update", id: "h2", markdown: "## Renamed" },
				],
				edits: [{ mode: "update", id: "p1", markdown: "New opening" }],
			}),
		);
		assert.ok(patch);
		assert.deepEqual(patch?.ops, [
			{ op: "update", id: "p3", markdown: "New p3" },
			{ op: "delete", id: "p4", markdown: "" },
			{ op: "update", id: "h2", markdown: "## Renamed" },
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
			["p2"],
		);
		// A selection spanning two paragraphs names both.
		const span = `${blocks[2]?.markdown}\n\n${blocks[3]?.markdown}`;
		assert.deepEqual(reportBlocksContainingText(blocks, span), ["p2", "p3"]);
		assert.deepEqual(reportBlocksContainingText(blocks, "nothing like this at all here"), []);
	});

	it("clips a planner answer", () => {
		assert.equal(clipResearchRevisePlan({}), null);
		const plan = clipResearchRevisePlan({
			targets: ["p3", "3", "P3", "junk", "p7", "h1"],
			intent: "  Split p3 around the quotation.  ",
			searchQueries: ["mindfulness faculties", "mindfulness faculties", "x", "y", "z"],
			readFull: ["SN 48.42", "mn10", "not an id"],
		});
		assert.deepEqual(plan?.targets, ["p3", "p7", "h1"]);
		assert.equal(plan?.intent, "Split p3 around the quotation.");
		assert.deepEqual(plan?.searchQueries, ["mindfulness faculties", "x", "y"]);
		assert.deepEqual(plan?.readFull, ["sn48.42", "mn10"]);
		assert.deepEqual(plan?.readPali, []);
		assert.deepEqual(plan?.readIllustration, []);
		const svgPlan = clipResearchRevisePlan({
			targets: ["p20"],
			intent: "Embed the AN 10.61 chain diagram after ¶20.",
			readIllustration: ["an10.61", "sn36.6", "mn70", "an3.65"],
		});
		assert.deepEqual(svgPlan?.readIllustration, ["an10.61", "sn36.6"]);
		const ranged = clipResearchRevisePlan({
			targets: ["p3"],
			intent: "Quote AN 1.485–494 and SnP 1.8.",
			readFull: ["an1.485-494", "SNP 1.8", "an1.485–494"],
			readPali: ["SNP 1.8", "snp1.8"],
		});
		assert.deepEqual(ranged?.readFull, ["an1.485-494", "snp1.8"]);
		assert.deepEqual(ranged?.readPali, ["snp1.8"]);
	});

	it("expands range targets and keeps a whole section move in scope", () => {
		assert.deepEqual(expandReportBlockIdRange("p31-p38"), [
			"p31", "p32", "p33", "p34", "p35", "p36", "p37", "p38",
		]);
		assert.deepEqual(expandReportBlockIdRange("¶31–33"), ["p31", "p32", "p33"]);
		assert.deepEqual(expandReportBlockIdRange("P31 to 33"), ["p31", "p32", "p33"]);
		assert.deepEqual(expandReportBlockIdRange("h2-h3"), ["h2", "h3"]);
		assert.deepEqual(expandReportBlockIdRange("p3-h5"), []);
		assert.deepEqual(expandReportBlockIdRange("p9-p3"), []);
		assert.deepEqual(expandReportBlockIdRange("p12"), ["p12"]);
		assert.deepEqual(expandReportBlockIdRange("junk"), []);
		assert.equal(expandReportBlockIdRange("p1-p999").length, REPORT_BLOCK_RANGE_MAX);
		// The v11 case: section 2, the moved run, its anchor, and the diagram —
		// twenty-odd blocks that the old 12-target cap silently truncated.
		const plan = clipResearchRevisePlan({
			targets: ["h2", "p21-p30", "p31-p38", "p52", "p79"],
			intent: "Move p31–p38 after p52 (end of the Cook sub-section); tighten section 2; fence p79.",
		});
		assert.equal(plan?.targets.length, 21);
		assert.ok(plan?.targets.includes("p38"));
		assert.ok(plan?.targets.includes("p52"));
		assert.ok(plan?.targets.includes("p79"));
	});

	it("keeps kind aliases on the plan and expands them against the report", () => {
		const plan = clipResearchRevisePlan({
			targets: ["quotes", "diagrams", "p3"],
			intent: "Add Pāli beside every English quote and fence diagrams.",
		});
		assert.deepEqual(plan?.targets, ["quotes", "diagrams", "p3"]);
		const blocks = splitReportBlocks(
			[
				"## Section",
				"Lead.",
				"",
				"> \"English only.\" SN 47.8",
				"",
				"mermaid",
				"flowchart LR",
				" A --> B",
				"",
				"Close.",
			].join("\n"),
		);
		assert.deepEqual(resolveResearchReviseTargets(plan?.targets || [], blocks), [
			"p2",
			"p3",
		]);
		assert.equal(blocks.find((b) => b.id === "p2")?.kind, "quote");
		assert.equal(isUnfencedMermaidMarkdown(blocks.find((b) => b.id === "p3")?.markdown || ""), true);
	});

	it("parseResearchRevisePatch keeps svg fences inside writer JSON", () => {
		const raw = JSON.stringify({
			changelog: "Added diagram.",
			ops: [
				{
					op: "insert-after",
					id: "p1",
					markdown:
						"Caption intro.\n\n```svg\n<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n```\n\n*Figure.*",
				},
			],
		});
		const patch = parseResearchRevisePatch(raw);
		const insert = patch?.ops?.[0];
		assert.match(insert?.markdown || "", /^Caption intro\.\n\n```svg\n<svg/);
		assert.match(insert?.markdown || "", /<\/svg>\n```\n\n\*Figure\.\*$/);
	});

	it("closes an opened mermaid fence before caption prose in an insert-after op", () => {
		const markdown = [
			"```mermaid",
			"flowchart TB",
			'subgraph descent["The descent into ignorance — AN 10.61/10.62"]',
			'D1["Association with the immature"] --> D2["Not hearing the good Dhamma"]',
			'D4["SUPERFICIAL ATTENTION"] --> D5["Superficial comprehension"]',
			"end",
			'subgraph ascent["The ascent to freedom — AN 10.61/10.62"]',
			'A4["RADICAL ATTENTION"] --> A5["Mindfulness-and-clear-comprehension"]',
			"end",
			'D4 -.- R1["Causes unarisen unwholesome states to arise"]',
			'A4 -.- R2["Forerunner like dawn before the sun"]',
			"",
			"The chart gathers the threads of the whole report into one picture.",
		].join("\n");
		const fenced = fenceMermaidInOpMarkdown(markdown);
		assert.match(fenced, /^```mermaid\nflowchart TB/);
		assert.match(fenced, /A4 -\.- R2\[[^\n]+\n```\n\nThe chart gathers/);
	});

	it("fences mermaid inside a new insert-after op", () => {
		const blocks = splitReportBlocks("## Close\n\nClosing paragraph stays here.");
		const patched = ensureResearchReviseMermaidFences({
			blocks,
			patch: {
				changelog: "Added a summary chart.",
				edits: [],
				ops: [
					{
						op: "insert-after",
						id: "p1",
						markdown:
							'mermaid flowchart TD subgraph Descent["The descending chain"] A --> B',
					},
				],
			},
			targets: ["p1"],
			instruction: "Include a visual chart after the conclusion.",
			planText: "add summary flowchart after ¶58",
		});
		const insert = patched?.ops?.find((op) => op.op === "insert-after");
		assert.match(insert?.markdown || "", /^```mermaid\nflowchart TD/);
		assert.match(insert?.markdown || "", /```$/);
	});

	it("fences a skipped mermaid paragraph even when the writer omitted the op", () => {
		const blocks = splitReportBlocks(
			"## Chains\n\nIntro.\n\nmermaid flowchart LR subgraph descent[\"The descending chain\"] A2[\"Association\"] --> B2\n\nAfter.",
		);
		const mermaid = blocks.find((block) => isUnfencedMermaidMarkdown(block.markdown));
		assert.ok(mermaid);
		const patched = ensureResearchReviseMermaidFences({
			blocks,
			patch: {
				changelog: "Tightened section 2.",
				edits: [],
				ops: [{ op: "update", id: "p1", markdown: "Shorter intro." }],
			},
			targets: ["p1", mermaid.id],
			instruction: "Fix mermaid diagram in P79.",
			planText: "fence the ¶79 mermaid diagram",
		});
		const fenceOp = patched?.ops?.find((op) => op.id === mermaid.id);
		assert.equal(fenceOp?.op, "update");
		assert.equal(fenceMermaidMarkdown(mermaid.markdown).startsWith("```mermaid"), true);
		assert.match(fenceOp?.markdown || "", /^```mermaid\nflowchart LR/);
		assert.match(fenceOp?.markdown || "", /```$/);
	});

	const hit = (slug: string): AiDiscourseHit =>
		({ slug, title: slug, snippet: "", score: 1 }) as unknown as AiDiscourseHit;

	it("planReviseEvidence follows the plan: re-reads known ids, searches for unknown ones", () => {
		const out = planReviseEvidence({
			instruction: "Make the quoted part a sutta quote.",
			existingHits: [hit("sn48.42"), hit("mn10")],
			plan: {
				targets: ["p3"],
				intent: "",
				searchQueries: [],
				readFull: ["sn48.42", "an4.41"],
				readPali: [],
			},
		});
		assert.deepEqual(out.reread.map((h) => h.slug), ["sn48.42"]);
		assert.deepEqual(out.queries, ["AN 4.41"]);
		assert.equal(out.needsSearch, true);
		const quiet = planReviseEvidence({
			instruction: "Add more discourses on this.",
			existingHits: [],
			plan: {
				targets: ["p3"],
				intent: "wording only",
				searchQueries: [],
				readFull: [],
				readPali: [],
			},
		});
		assert.equal(quiet.needsSearch, false);
		assert.deepEqual(quiet.queries, []);
	});

	it("resolves a constituent AN id to the range file already in the report", () => {
		assert.equal(hitMatchesDiscourseId({ slug: "an1.394-574" }, "an1.485"), true);
		assert.equal(hitMatchesDiscourseId({ slug: "an1.394-574" }, "an1.485-494"), true);
		assert.equal(hitMatchesDiscourseId({ slug: "an1.41-50" }, "an1.485"), false);
		assert.deepEqual(
			reviseEvidenceRequestedIds({
				instruction: "Quote SnP 1.8 sati verse.",
				plan: { targets: ["p3"], intent: "", searchQueries: [], readFull: ["snp1.8"], readPali: ["snp1.8"] },
			}),
			["snp1.8"],
		);
		assert.deepEqual(
			reviseSlugsForDiscourseIds(["snp1.8"], [hit("snp1.8")]),
			["snp1.8"],
		);
		assert.match(
			formatReviseEvidenceDebugLog({
				planReadFull: ["snp1.8"],
				planReadPali: ["snp1.8"],
				planReadIllustration: ["an10.61"],
				requestedIds: ["snp1.8"],
				readFull: ["snp1.8"],
				readPali: ["snp1.8"],
				readIllustration: ["an10.61"],
				readFullLabels: ["SNP 1.8"],
				rereadSlugs: [],
				newHitSlugs: ["snp1.8"],
				evidenceChars: 1200,
				evidenceHasPaliPassage: true,
				evidenceHasSvgMarkup: true,
			}),
			/hasPaliPassage=true/,
		);
		assert.match(
			formatReviseEvidenceDebugLog({
				planReadFull: [],
				planReadPali: [],
				planReadIllustration: ["an10.61"],
				requestedIds: ["an10.61"],
				readFull: [],
				readPali: [],
				readIllustration: ["an10.61"],
				rereadSlugs: [],
				newHitSlugs: [],
				evidenceChars: 900,
				evidenceHasPaliPassage: false,
				evidenceHasSvgMarkup: true,
			}),
			/readIllustration=\[an10\.61\]/,
		);
		const out = planReviseEvidence({
			instruction:
				"Add SnP 1.8 in Pali + English. Include AN 1.485-494 as a quoted block.",
			existingHits: [hit("an1.394-574"), hit("mn10")],
			plan: {
				targets: ["p3"],
				intent: "Quote diversity passages.",
				searchQueries: [],
				readFull: ["snp1.8", "an1.485-494"],
				readPali: ["snp1.8"],
			},
		});
		assert.deepEqual(out.reread.map((h) => h.slug), ["an1.394-574"]);
		assert.deepEqual(out.queries, ["SNP 1.8"]);
		assert.equal(out.needsSearch, true);
	});

	it("planReviseEvidence without a plan only searches for named discourse ids", () => {
		const out = planReviseEvidence({
			instruction: "Add more discourses on the faculties.",
			existingHits: [],
		});
		assert.equal(out.needsSearch, false);
		assert.deepEqual(out.queries, []);
		const named = planReviseEvidence({
			instruction: "Add AN 10.60 to the body.",
			existingHits: [],
		});
		assert.equal(named.needsSearch, true);
		assert.deepEqual(named.queries, ["AN 10.60"]);
	});

	it("writer message carries the numbered report, plan and target blocks", () => {
		const blocks = splitReportBlocks(report);
		const message = buildReviseWriterMessage({
			blocks,
			instruction: "Make the quoted part a sutta quote.",
			originalQuestion: "Explain mindfulness with practical emphasis.",
			clarifyBrief:
				"How should quotations be used? → Prefer direct quotations\nTone → Technical",
			quote: "Uṇṇābha's faith is settled.",
			plan: {
				targets: ["p3"],
				intent: "Split p2 around the quotation.",
				searchQueries: [],
				readFull: [],
				readPali: [],
			},
		});
		assert.match(message, /Plan \(from a first pass over the report\): Split p2/);
		assert.match(message, /Original research request.*Explain mindfulness/);
		assert.match(message, /Original research preferences and emphasis choices/);
		assert.match(message, /Prefer direct quotations/);
		assert.match(message, /it sits in p2/);
		assert.match(message, /Allowed target blocks: p2, p3 —/);
		assert.match(message, /Target blocks as they stand now:\n\[\[p2\]\]\nAnother text/);
		assert.match(message, /Current report, with block ids:\n\[\[p1\]\]/);
		assert.match(message, /No passages supplied/);
	});

	it("audits why each op fails constraints", () => {
		const blocks = splitReportBlocks(
			"## Diagram\n\n```mermaid\nflowchart LR\n A --> B\n```\n\nClosing.",
		);
		const audit = auditResearchRevisePatchConstraints({
			blocks,
			targets: ["p1"],
			patch: {
				changelog: "x",
				edits: [{ heading: "Diagram", mode: "replace", markdown: "legacy" }],
				ops: [
					{ op: "update", id: "p1", markdown: "ok" },
					{ op: "update", id: "p99", markdown: "ghost" },
					{ op: "update", id: "c1", markdown: "```mermaid\nflowchart LR\n A --> B" },
				],
			},
		});
		assert.equal(audit.kept.length, 1);
		assert.equal(audit.kept[0]?.id, "p1");
		assert.equal(audit.legacyEditsDropped, 1);
		assert.deepEqual(
			audit.rejected.map((r) => `${r.op.id}:${r.reason}`),
			["p99:unknown_block_id", "c1:outside_targets"],
		);
		assert.equal(
			rejectResearchReviseOpReason(
				{ op: "update", id: "p1", markdown: "```mermaid\nflowchart LR\n A --> B" },
				{ blocks, targets: ["p1"] },
			)?.reason,
			"unclosed_fence",
		);
	});

	it("enforces planner targets and drops legacy whole-section edits", () => {
		const blocks = splitReportBlocks(report);
		const constrained = constrainResearchRevisePatch({
			blocks,
			targets: ["p2"],
			patch: {
				changelog: "Changed too much.",
				ops: [
					{ op: "update", id: "p2", markdown: "Targeted replacement." },
					{ op: "update", id: "p3", markdown: "Unrelated replacement." },
				],
				edits: [
					{
						heading: "Mindfulness",
						mode: "replace",
						markdown: "A whole rewritten section.",
					},
				],
			},
		});
		assert.deepEqual(constrained?.ops, [
			{ op: "update", id: "p2", markdown: "Targeted replacement." },
		]);
		assert.deepEqual(constrained?.edits, []);
	});

	it("rejects malformed Mermaid updates but accepts a complete matching fence", () => {
		const blocks = splitReportBlocks(
			"## Diagram\n\n```mermaid\nflowchart LR\n A --> B\n```\n\nClosing paragraph stays exactly the same.",
		);
		assert.equal(blocks[1]?.id, "c1");
		const malformed = constrainResearchRevisePatch({
			blocks,
			targets: ["c1"],
			patch: {
				changelog: "Broke it.",
				ops: [
					{ op: "update", id: "c1", markdown: "mermaid\nflowchart LR\n A --> B" },
				],
				edits: [],
			},
		});
		assert.equal(malformed, null);
		const valid = constrainResearchRevisePatch({
			blocks,
			targets: ["c1"],
			patch: {
				changelog: "Fixed labels.",
				ops: [
					{
						op: "update",
						id: "c1",
						markdown: '```mermaid\nflowchart LR\n A["Quoted label"] --> B\n```',
					},
				],
				edits: [],
			},
		});
		assert.equal(valid?.ops?.length, 1);
	});

	it("lets a broken unfenced diagram paragraph be fenced, but drops half-open fences", () => {
		const blocks = splitReportBlocks(
			"## Chains\n\nIntro paragraph.\n\nmermaid\nflowchart LR\n A --> B\n\nAfter.",
		);
		assert.equal(blocks[2]?.id, "p2");
		assert.equal(blocks[2]?.kind, "paragraph");
		const fixed = constrainResearchRevisePatch({
			blocks,
			targets: ["p2"],
			patch: {
				changelog: "Fenced the diagram.",
				ops: [
					{ op: "update", id: "p2", markdown: "```mermaid\nflowchart LR\n A --> B\n```" },
				],
				edits: [],
			},
		});
		assert.equal(fixed?.ops?.length, 1);
		const halfOpen = constrainResearchRevisePatch({
			blocks,
			targets: ["p2"],
			patch: {
				changelog: "Forgot to close.",
				ops: [{ op: "update", id: "p2", markdown: "```mermaid\nflowchart LR\n A --> B" }],
				edits: [],
			},
		});
		assert.equal(halfOpen, null);
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
	it("resumes block enumeration after a complete fenced Mermaid diagram", () => {
		const report =
			"## Before\n\nOpening paragraph remains here.\n\n```mermaid\nflowchart LR\n A --> B\n```\n\n## After\n\nClosing paragraph stays exactly the same.";
		const blocks = enumerateReportBlocks(report);
		assert.equal(
			blocks.some(
				(block) =>
					block.key ===
					"paragraph:closingparagraphstaysexactlythesame",
			),
			true,
		);
		assert.deepEqual(diffReportBlockChanges(report, report), {
			added: [],
			edited: [],
			removed: [],
		});
	});

	it("lists paragraphs and list items the new version added or rewrote", () => {
		const base = "## A\n\nSame paragraph stays right here.\n\n- item one stays here\n- item two changes here";
		const next =
			"## A\n\nSame paragraph stays right here.\n\n- item one stays here\n- item two is rewritten now\n\nNew paragraph with [SN 1.1](/sn1.1).";
		assert.deepEqual(reportBlockKeys("Short.\n\nA long enough paragraph here."), [
			"alongenoughparagraphhere",
		]);
		assert.deepEqual(new Set(changedReportBlockKeys(base, next)), new Set([
			"list:itemtwoisrewrittennow",
			"paragraph:newparagraphwithsn11",
		]));
		assert.deepEqual(changedReportBlockKeys(base, base), []);
	});

	it("classifies additions, edits, and removals separately", () => {
		const base =
			"## A\n\nSame paragraph stays right here.\n\nDropped paragraph goes away now.\n\n- item one stays here\n- item two changes here";
		const next =
			"## A\n\nSame paragraph stays right here.\n\n- item one stays here\n- item two is rewritten now\n\nNew paragraph with [SN 1.1](/sn1.1).";
		const diff = diffReportBlockChanges(base, next);
		assert.deepEqual(diff.added, [
			"list:itemtwoisrewrittennow",
			"paragraph:newparagraphwithsn11",
		]);
		assert.deepEqual(diff.edited, []);
		assert.equal(diff.removed.length, 2);
		assert.match(diff.removed[0].markdown, /Dropped paragraph/);
		assert.match(diff.removed[1].markdown, /item two changes here/);
		assert.equal(reportBlockDiffCount(diff), 4);
	});

	it("positions removals against the next surviving block after earlier inserts", () => {
		const base =
			"## Section\n\nAlpha paragraph remains in place.\n\n**Removed emphasis stays markdown.**\n\nBeta paragraph remains in place.\n\nGamma paragraph remains in place.";
		const next =
			"## Section\n\nA new opening paragraph was inserted.\n\nAlpha paragraph remains in place.\n\nBeta paragraph remains in place.\n\nGamma paragraph remains in place.";
		const diff = diffReportBlockChanges(base, next);
		assert.deepEqual(diff.added, ["paragraph:anewopeningparagraphwasinserted"]);
		assert.equal(diff.edited.length, 0);
		assert.equal(diff.removed.length, 1);
		assert.equal(diff.removed[0].beforeNextIndex, 3);
		assert.match(diff.removed[0].markdown, /^\*\*Removed emphasis/);
	});

	it("includes tables in the stream so removal anchors stay aligned with the DOM", () => {
		const base =
			"## Section\n\nAlpha paragraph remains in place.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n**Removed emphasis stays markdown.**\n\nBeta paragraph remains in place.";
		const next =
			"## Section\n\nAlpha paragraph remains in place.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nBeta paragraph remains in place.";
		const diff = diffReportBlockChanges(base, next);
		assert.equal(diff.removed.length, 1);
		assert.equal(diff.removed[0].beforeNextKey, "paragraph:betaparagraphremainsinplace");
	});

	it("treats heavy rewrites as removals plus additions, not a single edit", () => {
		const base =
			"## A\n\nAnother text traces the chain of dependency from the five sense faculties to Nibbāna, situating mindfulness as the indispensable bridge. The brahmin Uṇṇābha asks what the five faculties take recourse in.";
		const next =
			'## A\n\n> "For these five faculties that have distinct fields" SN 48.42\n\n> "The mind, brahmin, takes recourse in mindfulness." SN 48.42';
		const diff = diffReportBlockChanges(base, next);
		assert.equal(diff.edited.length, 0);
		assert.equal(diff.removed.length, 1);
		assert.equal(diff.added.length, 2);
	});

	it("detects list-to-paragraph reformats as remove plus add", () => {
		const base =
			"## 1. Why\n\nLead paragraph long enough for the diff algorithm here.\n\n- **All Buddhas awaken this way.** Sāriputta gatekeeper simile makes the point about fortress and gatekeeper patrolling walls.";
		const next =
			"## 1. Why\n\nLead paragraph long enough for the diff algorithm here.\n\n**All Buddhas awaken this way.** Sāriputta gatekeeper simile makes the point about fortress and gatekeeper patrolling walls.";
		const diff = diffReportBlockChanges(base, next);
		assert.equal(diff.edited.length, 0);
		assert.equal(diff.removed.length, 1);
		assert.equal(diff.added.length, 1);
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
			"120 words (+20) · 3 cited (−1) · 2 sources",
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
	it("keeps the version chip on the current head while a revise is in flight", () => {
		const index = clipResearchVersionIndex([
			{ n: 1, at: 1, instruction: "", changelog: "First", from: null },
			{ n: 2, at: 2, instruction: "tone", changelog: "Softer", from: 1 },
		]);
		assert.equal(
			formatResearchVersionLabelForTurn(index, { revising: true }),
			"v2",
		);
		assert.equal(
			formatResearchVersionLabelForTurn(index, { previewN: 1 }),
			"v1 · preview",
		);
	});

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
			processNotes: [
				"Started v2 revision",
				"Considered the revision",
				"Revised the report · v2",
			],
			createdAt: 1,
		});
		assert.equal(healed[1]?.n, 2);
		assert.equal(healed[1]?.changelog, "Revised the report.");
		const healedV16 = healedResearchVersionIndex({
			versionIndex: [],
			processNotes: [
				"Started v16 revision",
				"Considered the revision",
				"Revised the report · v16",
			],
			createdAt: 1,
			stats: { words: 6376, cited: 56, additional: 113 },
		});
		assert.equal(currentResearchVersionN(healedV16), 16);
		assert.deepEqual(healedV16[15]?.stats, {
			words: 6376,
			cited: 56,
			additional: 113,
		});
		const inFlight = healedResearchVersionIndex({
			versionIndex: [
				{ n: 1, at: 1, instruction: "", changelog: "Original report.", from: null },
			],
			processNotes: [
				"Started v2 revision",
				"Considered the revision",
				"Revising the report…",
			],
			createdAt: 1,
		});
		assert.equal(inFlight.length, 1);
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
	it("sizes the writer completion to the time and speed it has", () => {
		assert.equal(RESEARCH_REVISE_WRITER_MAX_TOKENS, 16_384);
		assert.equal(RESEARCH_REVISE_PLANNER_BUDGET_MS, 120_000);
		assert.equal(RESEARCH_REVISE_WRITER_BASE_MS, 150_000);
		assert.equal(resolveResearchReviseWriterBudgetMs(0), 270_000);
		assert.equal(resolveResearchReviseWriterBudgetMs(12_500), 257_500);
		assert.equal(resolveResearchReviseWriterBudgetMs(120_000), 150_000);
		assert.equal(resolveResearchReviseWriterBudgetMs(180_000), 150_000);
		assert.equal(resolveResearchReviseWriterMaxTokens(227_495, 59), 9_181);
		assert.equal(resolveResearchReviseWriterMaxTokens(150_000, 59), 5_752);
		assert.equal(resolveResearchReviseWriterMaxTokens(270_000, 200), 16_384);
		assert.equal(resolveResearchReviseWriterMaxTokens(150_000, 24), 2_340);
		const message = buildReviseWriterMessage({
			blocks: splitReportBlocks("Alpha."),
			instruction: "Tighten the opening.",
			maxTokens: 9_181,
		});
		assert.match(message, /within 9181 tokens/);
		assert.match(message, /finished partial patch/);
		assert.ok(RESEARCH_REVISE_MAX_OUTPUT_WORDS >= 30_000);
		assert.ok(RESEARCH_REVISE_CHANGELOG_MAX >= 2_000);
		assert.equal(
			clipResearchChangelog(`${"x".repeat(3_000)}`).length,
			RESEARCH_REVISE_CHANGELOG_MAX,
		);
		assert.equal(RESEARCH_REPORT_MAX_CHARS, 100_000);
	});
});

describe("researchReviseVersionChangelog", () => {
	it("notes reference images in the version changelog", () => {
		assert.equal(
			researchReviseVersionChangelog({
				instruction: "Fix the diagram labels.",
				imageCount: 2,
			}),
			"Fix the diagram labels. 2 reference images attached.",
		);
	});
});

describe("researchReviseWriterFailureMessage", () => {
	it("distinguishes unparseable output from dropped ops and empty patches", () => {
		assert.equal(
			researchReviseWriterFailureMessage({ unparseable: true }),
			RESEARCH_REVISE_UNPARSEABLE_ERROR,
		);
		assert.equal(
			researchReviseWriterFailureMessage({ emptyPatch: true }),
			RESEARCH_REVISE_EMPTY_PATCH_ERROR,
		);
		assert.match(
			researchReviseWriterFailureMessage({ opsDropped: 2 }),
			/2 edits fell outside the plan/,
		);
		assert.match(
			researchReviseWriterFailureMessage({}),
			/Try again with a clearer or smaller change/,
		);
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

describe("revise plan: reader summary and clarifying questions", () => {
	it("parses summary and questions; choices keep block ids and gain only Other", () => {
		const plan = clipResearchRevisePlan({
			targets: ["p11", "p12"],
			intent: "Delete p12, which repeats p11.",
			summary: "delete p12 (duplicate of p11) · fence the diagram in p72",
			questions: [
				{
					id: "which",
					prompt: "Which paragraph repeats the other?",
					choices: [
						{ id: "a", label: "¶11 “The claim that mindfulness…”", blockId: "P11" },
						{ id: "b", label: "¶12 “Three further texts…”", blockId: "p12" },
						{ id: "c", label: "junk", blockId: "nope" },
					],
					suggestedChoiceId: "b",
				},
				{ id: "q2", prompt: "Second", choices: [{ id: "x", label: "X" }] },
				{ id: "q3", prompt: "Third — over the cap", choices: [{ id: "y", label: "Y" }] },
			],
		});
		assert.ok(plan);
		assert.equal(plan.summary, "delete p12 (duplicate of p11) · fence the diagram in p72");
		assert.equal(plan.questions?.length, 2);
		const first = plan.questions![0];
		assert.deepEqual(
			first.choices.map((c) => c.id),
			["a", "b", "c", "other"],
		);
		assert.equal(first.choices[0].blockId, "p11");
		assert.equal(first.choices[2].blockId, undefined);
		assert.equal(first.suggestedChoiceId, "b");
		assert.ok(!first.choices.some((c) => c.id === "no_preference"));
	});

	it("drops questions the model returns empty or malformed", () => {
		const plan = clipResearchRevisePlan({ targets: ["p3"], intent: "x", questions: [] });
		assert.equal(plan?.questions, undefined);
		const junk = clipResearchRevisePlan({ targets: ["p3"], intent: "x", questions: "no" });
		assert.equal(junk?.questions, undefined);
	});

	it("turns the plan into a reader-facing hop with ¶ numbers", () => {
		assert.equal(
			researchRevisePlanNote({ summary: "delete p12 (duplicate of p11) · add SN 47.42 after p35" }),
			"Plan: delete ¶12 (duplicate of ¶11) · add SN 47.42 after ¶35",
		);
		// Falls back to the intent and does not touch words that merely start with p.
		assert.equal(
			researchRevisePlanNote({ intent: "Update [[p7]]; keep the passage in p8 as is." }),
			"Plan: Update ¶7; keep the passage in ¶8 as is.",
		);
		assert.equal(researchRevisePlanNote({}), "");
		assert.equal(
			researchRevisePlanNote({ searchQueries: ["AN 1.485-494 sati"] }),
			"Plan: look up: AN 1.485-494 sati",
		);
		assert.match(
			researchRevisePlanNote({
				readFull: ["snp1.8", "an4.189"],
				readPali: ["snp1.8"],
			}),
			/^Plan: read SNP 1\.8, AN 4\.189/,
		);
		const long = researchRevisePlanSummary({ summary: "x".repeat(400) });
		assert.ok(long.length <= RESEARCH_REVISE_PLAN_SUMMARY_MAX);
		assert.ok(long.endsWith("…"));
	});

	it("sanitizes a stored clarify record and knows when it has expired", () => {
		const clarify = sanitizeResearchReviseClarify({
			id: "rc_1",
			questions: [
				{ id: "which", prompt: "Which one?", choices: [{ id: "a", label: "A", blockId: "p2" }] },
			],
			interpretation: "delete p12",
			fromVersion: 8,
			expiresAt: 1_000,
		});
		assert.ok(clarify);
		assert.equal(clarify.id, "rc_1");
		assert.equal(clarify.interpretation, "delete ¶12");
		assert.equal(clarify.fromVersion, 8);
		assert.equal(clarify.questions[0].choices[0].blockId, "p2");
		assert.equal(isResearchReviseClarifyExpired(clarify, 999), false);
		assert.equal(isResearchReviseClarifyExpired(clarify, 1_000), true);
		assert.equal(isResearchReviseClarifyExpired(null), false);
		assert.equal(sanitizeResearchReviseClarify({ id: "x", questions: [] }), null);
		assert.equal(researchReviseClarifyBaseLabel(8), "Revising from v8");
		assert.equal(researchReviseClarifyBaseLabel(null), "");
	});

	it("passes the reader's answers to the writer and planner as their own block", () => {
		const blocks = splitReportBlocks("Alpha.\n\nBeta.");
		const message = buildReviseWriterMessage({
			blocks,
			instruction: "Delete the duplicate.",
			clarifications: "Which paragraph repeats? → ¶2 “Beta.” (block p2)",
			plan: {
				targets: ["p2"],
				intent: "Delete p2.",
				searchQueries: [],
				readFull: [],
				readPali: [],
			},
		});
		assert.match(message, /Reader's answers to the planner's questions/);
		assert.match(message, /→ ¶2 “Beta\.” \(block p2\)/);
		assert.equal(reviseClarificationsBlock(""), "");
		assert.equal(reviseClarificationsBlock("  "), "");
	});
});

describe("formatResearchReviseQuoteForModel", () => {
	it("keeps short selections verbatim", () => {
		const text = "Two things follow immediately from this formula.";
		assert.equal(formatResearchReviseQuoteForModel(text), text);
	});

	it("uses head and tail for long selections", () => {
		const text = `${"Alpha beta gamma. ".repeat(40)}Omega final sentence.`;
		const out = formatResearchReviseQuoteForModel(text);
		assert.match(out, /^Alpha beta/);
		assert.match(out, /Omega final sentence\.$/);
		assert.match(out, / … /);
		assert.ok(out.length <= 800);
	});
});

describe("splitBlockIdForEnumeratedKey", () => {
	it("maps a rendered table block to tN even when list items shifted the index", () => {
		const markdown = [
			"Intro paragraph.",
			"",
			"- one",
			"- two",
			"",
			"| A | B |",
			"|---|---|",
			"| 1 | 2 |",
		].join("\n");
		const enumerated = enumerateReportBlocks(markdown);
		const tableBlock = enumerated.find((block) => block.markdown.includes("| A |"));
		assert.ok(tableBlock);
		assert.equal(
			splitBlockIdForEnumeratedKey(
				markdown,
				tableBlock.key,
				tableBlock.markdown,
			),
			"t1",
		);
	});

	it("maps fenced mermaid to cN", () => {
		const markdown = [
			"Lead-in.",
			"",
			"```mermaid",
			"flowchart LR",
			"A --> B",
			"```",
		].join("\n");
		const enumerated = enumerateReportBlocks(markdown);
		const diagram = enumerated.find((block) => block.markdown.includes("flowchart"));
		assert.ok(diagram);
		assert.equal(
			splitBlockIdForEnumeratedKey(
				markdown,
				diagram.key,
				diagram.markdown,
			),
			"c1",
		);
	});
});

describe("normalizeResearchReviseInstructionInput", () => {
	it("keeps a trailing space while the reader is still typing", () => {
		assert.equal(normalizeResearchReviseInstructionInput("Add "), "Add ");
		assert.equal(
			clipResearchReviseInstruction("Add the section"),
			"Add the section",
		);
	});

	it("collapses internal whitespace on submit", () => {
		assert.equal(
			clipResearchReviseInstruction("Add   the   section"),
			"Add the section",
		);
	});

	it("keeps paragraph breaks for longer revise instructions", () => {
		const text = "Add SN 48.42 here.\n\nThen synthesize the five faculties.";
		assert.equal(normalizeResearchReviseInstructionInput(text), text);
		assert.equal(clipResearchReviseInstruction(text), text);
		assert.equal(
			normalizeResearchReviseInstructionInput("Line one\nLine two"),
			"Line one\nLine two",
		);
	});
});
