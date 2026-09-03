import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AI_RERANK_DEFAULT_LIMIT,
	AI_RERANK_MAX_LIMIT,
	AI_RERANK_SUMMARY_MAX,
	AI_RERANK_SNIPPET_CANDIDATES,
	applyRerankOrder,
	buildRerankUserPrompt,
	clipPlanningNotes,
	clipRerankSummary,
	formatRerankHistoryBlock,
	parseRerankResponse,
	parseRerankSlugs,
	resolveAskResultLimit,
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
		assert.equal(parsed.usefulFallbackQueriesSpecified, false);
	});

	it("keeps useful fallback queries from the allowed list", () => {
		const allowed = new Set(["mn10"]);
		const parsed = parseRerankResponse(
			JSON.stringify({
				slugs: ["mn10"],
				summary: "ok",
				usefulFallbackQueries: ["self after death", "invented", "anatta"],
			}),
			allowed,
			20,
			["self after death", "anatta"],
		);
		assert.deepEqual(parsed.usefulFallbackQueries, [
			"self after death",
			"anatta",
		]);
		assert.equal(parsed.usefulFallbackQueriesSpecified, true);
	});

	it("treats an empty usefulFallbackQueries array as specified", () => {
		const allowed = new Set(["mn10"]);
		const parsed = parseRerankResponse(
			JSON.stringify({
				slugs: ["mn10"],
				usefulFallbackQueries: [],
			}),
			allowed,
			20,
			["broader term"],
		);
		assert.deepEqual(parsed.usefulFallbackQueries, []);
		assert.equal(parsed.usefulFallbackQueriesSpecified, true);
	});

	it("allows longer framing summaries for related-outside topics", () => {
		const framing = "A".repeat(900);
		assert.equal(clipRerankSummary(framing).length, 900);
		assert.ok(AI_RERANK_SUMMARY_MAX >= 4800);
		const allowed = new Set(["mn10"]);
		const parsed = parseRerankResponse(
			JSON.stringify({ slugs: ["mn10"], summary: framing }),
			allowed,
		);
		assert.equal(parsed.summary.length, 900);
	});

	it("keeps paragraph breaks in the briefing", () => {
		assert.equal(
			clipRerankSummary("First point.\n\nSecond point."),
			"First point.\n\nSecond point.",
		);
	});

	it("can keep up to the max number of slugs", () => {
		const slugs = Array.from(
			{ length: AI_RERANK_MAX_LIMIT },
			(_, index) => `mn${index + 1}`,
		);
		const allowed = new Set(slugs);
		const parsed = parseRerankResponse(
			JSON.stringify({ slugs, summary: "ok" }),
			allowed,
		);
		assert.equal(parsed.slugs.length, AI_RERANK_MAX_LIMIT);
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

describe("resolveAskResultLimit", () => {
	it("defaults to 10 and raises the ceiling for exhaustive / research asks", () => {
		assert.equal(resolveAskResultLimit("what is mindfulness?"), AI_RERANK_DEFAULT_LIMIT);
		assert.equal(
			resolveAskResultLimit("search exhaustively for satipatthana techniques"),
			AI_RERANK_MAX_LIMIT,
		);
		assert.equal(
			resolveAskResultLimit("write in detail about discourses on anger"),
			AI_RERANK_MAX_LIMIT,
		);
		assert.equal(
			resolveAskResultLimit("show me more discourses on craving"),
			AI_RERANK_MAX_LIMIT,
		);
		assert.equal(
			resolveAskResultLimit("I want to research this topic with citations"),
			AI_RERANK_MAX_LIMIT,
		);
		assert.equal(
			resolveAskResultLimit("give me 30 discourses on feeling"),
			AI_RERANK_MAX_LIMIT,
		);
	});
});

describe("buildRerankUserPrompt", () => {
	it("includes id title description and fallback searches", () => {
		const prompt = buildRerankUserPrompt(
			"mindfulness technique",
			[
				{
					slug: "sn47.19",
					title: "At Sedaka",
					description: "Protecting oneself through mindfulness.",
				},
			],
			["satipatthana"],
		);
		assert.match(prompt, /SN 47\.19/i);
		assert.match(prompt, /At Sedaka/);
		assert.match(prompt, /Protecting oneself/);
		assert.match(prompt, /mindfulness technique/);
		assert.match(prompt, /Target result count: up to 10/);
		assert.match(prompt, /tight, high-quality set/);
		assert.match(prompt, /Fallback searches also tried/);
		assert.match(prompt, /satipatthana/);
		assert.doesNotMatch(prompt, /Earlier in this Ask/);
	});

	it("includes earlier conversation context for follow-ups", () => {
		const prompt = buildRerankUserPrompt(
			"What about the second one?",
			[
				{
					slug: "mn10",
					title: "Satipatthana",
					description: "Foundations of mindfulness.",
				},
			],
			[],
			[
				{
					question: "What is mindfulness?",
					lookingFor: "mindfulness",
					queries: ["sati"],
					resultSlugs: ["sn47.19", "mn118"],
					summary:
						"SN 47.19 and MN 118 develop satipaṭṭhāna and ānāpānasati in practice.",
				},
			],
			20,
		);
		assert.match(prompt, /Earlier in this Ask/);
		assert.match(prompt, /What is mindfulness\?/);
		assert.match(prompt, /SN 47\.19/i);
		assert.match(prompt, /MN 118/i);
		assert.match(prompt, /satipaṭṭhāna/);
		assert.match(prompt, /What about the second one\?/);
		assert.match(prompt, /Target result count: up to 20/);
		assert.match(prompt, /research-style coverage/);
	});

	it("forwards planning guidance and notes to the rescorer", () => {
		const prompt = buildRerankUserPrompt(
			"how do I practice mindfulness?",
			[{ slug: "mn10", title: "Satipatthana", description: "" }],
			{
				guidance: "They want technique, not doctrine. Represent SN 47 broadly.",
				planningNotes:
					'Practical ask.\n"queries": ["sati"]\n{\nThey want how-to, so prefer SN 47.',
				limit: 10,
			},
		);
		assert.match(prompt, /Guidance from the planning step: They want technique/);
		assert.match(prompt, /Planning notes \(raw, may be partial\):/);
		assert.match(prompt, /prefer SN 47/);
		assert.doesNotMatch(prompt, /"queries"/);
		assert.doesNotMatch(prompt, /^\{$/m);
	});

	it("adds matched passages for the top of the pool only", () => {
		const candidates = Array.from(
			{ length: AI_RERANK_SNIPPET_CANDIDATES + 5 },
			(_, index) => ({
				slug: `mn${index + 1}`,
				title: `Discourse ${index + 1}`,
				description: "",
				contentSnippet: `passage number ${index + 1}`,
			}),
		);
		const prompt = buildRerankUserPrompt("anger", candidates, { limit: 10 });
		assert.match(prompt, /passage: passage number 1\b/);
		assert.match(prompt, new RegExp(`passage: passage number ${AI_RERANK_SNIPPET_CANDIDATES}\\b`));
		assert.doesNotMatch(
			prompt,
			new RegExp(`passage: passage number ${AI_RERANK_SNIPPET_CANDIDATES + 1}\\b`),
		);
	});
});

describe("clipPlanningNotes", () => {
	it("keeps the tail of long reasoning and drops JSON drafting", () => {
		const notes = clipPlanningNotes(
			`${"early thinking. ".repeat(200)}\nqueries: sati\nfinal: prefer SN 47.`,
			120,
		);
		assert.ok(notes.startsWith("…"));
		assert.ok(notes.length <= 121);
		assert.match(notes, /prefer SN 47/);
		assert.doesNotMatch(notes, /queries: sati/);
	});
});

describe("formatRerankHistoryBlock", () => {
	it("returns empty when there is no history", () => {
		assert.equal(formatRerankHistoryBlock([]), "");
	});
});
