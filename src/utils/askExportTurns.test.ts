import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_EXPORT_SITE_ORIGIN,
	askExportCitationHits,
	askExportSharePathFromTurns,
	askTurnsForExport,
	researchExportContentsCounts,
	researchExportContentsDescription,
	slugsForResearchExportContents,
} from "./askExportTurns";

const hit = {
	slug: "mn10",
	title: "Satipaṭṭhāna",
	description: "The establishments of mindfulness.",
	contentSnippet: null,
	referenceOnly: false,
	href: "/mn10",
};

describe("askTurnsForExport", () => {
	it("includes every successful turn, including references", () => {
		const turns = askTurnsForExport([
			{ question: "Pending", pending: true, results: [hit] },
			{
				question: "What is mindfulness?",
				summary: "MN 10 is the root text.",
				results: [hit],
			},
			{
				question: "A reference hit",
				results: [
					{
						...hit,
						slug: "dn1",
						title: "Brahmajāla",
						referenceOnly: true,
					},
				],
			},
			{ question: "Empty", results: [] },
			{ question: "Errored", error: "nope", results: [hit] },
		]);
		assert.equal(turns.length, 2);
		assert.equal(turns[0]?.question, "What is mindfulness?");
		assert.equal(turns[0]?.discourses[0]?.slug, "mn10");
		assert.equal(turns[1]?.discourses[0]?.isReference, true);
	});

	it("marks a research report turn", () => {
		const turns = askTurnsForExport([
			{
				question: "Who is a trainee?",
				report: "## Thesis\n\nMN 10.",
				research: true,
				results: [hit],
			},
		]);
		assert.equal(turns[0]?.research, true);
		assert.match(turns[0]?.summary || "", /## Thesis/);
		assert.equal(turns[0]?.discourses[0]?.cited, true);
	});

	it("keeps a research report with no discourses for report-only download", () => {
		const turns = askTurnsForExport([
			{
				question: "What is sati?",
				report: "## Thesis\n\nMindfulness is established.",
				research: true,
				results: [],
			},
		]);
		assert.equal(turns.length, 1);
		assert.equal(turns[0]?.research, true);
		assert.equal(turns[0]?.discourses.length, 0);
	});

	it("marks cited discourses from the write-up, not the Sources list", () => {
		const turns = askTurnsForExport([
			{
				question: "Mindfulness",
				report: `## Thesis

See MN 10 and DN 22.

## Sources

- SN 47.2 Sati sutta
`,
				research: true,
				results: [
					{ ...hit, slug: "mn10", title: "Satipaṭṭhāna" },
					{
						...hit,
						slug: "dn22",
						title: "Mahāsatipaṭṭhāna",
					},
					{
						...hit,
						slug: "sn47.2",
						title: "Sati",
					},
				],
			},
		]);
		assert.deepEqual(
			turns[0]?.discourses.map((d) => [d.slug, d.cited]),
			[
				["mn10", true],
				["dn22", true],
				["sn47.2", false],
			],
		);
		assert.deepEqual(
			slugsForResearchExportContents(turns[0]?.discourses || [], "cited"),
			["mn10", "dn22"],
		);
		assert.deepEqual(
			slugsForResearchExportContents(turns[0]?.discourses || [], "report"),
			[],
		);
		assert.deepEqual(
			slugsForResearchExportContents(turns[0]?.discourses || [], "all"),
			["mn10", "dn22", "sn47.2"],
		);
		const counts = researchExportContentsCounts(turns);
		assert.deepEqual(counts, {
			cited: 2,
			all: 3,
			additional: 1,
			showCited: true,
			showAll: true,
			defaultContents: "cited",
		});
		assert.equal(
			researchExportContentsDescription("cited", 2, 1),
			"2 discourses named in the report",
		);
		assert.equal(
			researchExportContentsDescription("cited", 1, 1),
			"1 discourse named in the report",
		);
		assert.equal(
			researchExportContentsDescription("all", 3, 1),
			"3 discourses gathered for this report",
		);
		assert.equal(
			researchExportContentsDescription("all", 4, 2),
			"4 discourses gathered for these reports",
		);
	});

	it("defaults to report only when nothing in the write-up is cited", () => {
		const turns = askTurnsForExport([
			{
				question: "Mindfulness",
				report: "## Thesis\n\nA general account.",
				research: true,
				results: [hit],
			},
		]);
		assert.deepEqual(researchExportContentsCounts(turns), {
			cited: 0,
			all: 1,
			additional: 1,
			showCited: false,
			showAll: true,
			defaultContents: "report",
		});
	});
});

describe("askExportCitationHits", () => {
	it("points named-but-omitted discourses at the site", () => {
		const hits = askExportCitationHits(
			"See MN 10 and SN 47.2.",
			[{ slug: "mn10", href: "#d-mn10" }],
			true,
		);
		assert.deepEqual(hits, [
			{ slug: "mn10", href: "#d-mn10" },
			{
				slug: "sn47.2",
				href: `${ASK_EXPORT_SITE_ORIGIN}/sn47.2`,
			},
		]);
	});
});

describe("askExportSharePathFromTurns", () => {
	it("prefers the current /ask/ URL, then a turn share path", () => {
		assert.equal(
			askExportSharePathFromTurns(
				[{ question: "Q", results: [hit], sharePath: "/ask/from-turn" }],
				"/ask/from-page",
			),
			"/ask/from-page",
		);
		assert.equal(
			askExportSharePathFromTurns([
				{ question: "Q", results: [hit], sharePath: "/ask/from-turn" },
			]),
			"/ask/from-turn",
		);
	});
});
