import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AI_RERANK_DEFAULT_LIMIT,
	AI_RERANK_HARD_LIMIT,
	AI_RERANK_MAX_LIMIT,
	AI_RERANK_SUMMARY_MAX,
	AI_RERANK_SNIPPET_CANDIDATES,
	RERANK_SYSTEM,
	applyRerankOrder,
	askRerankCap,
	buildRerankUserPrompt,
	clampAskResultLimit,
	clipPlanningNotes,
	clipRerankSummary,
	formatRerankExcludeBlock,
	formatRerankHistoryBlock,
	namedTermHitDebugRows,
	parseRerankResponse,
	parseRerankSlugs,
	resolveAskResultLimit,
} from "./aiResultRerank";
import { candidatesForAskFollowUp } from "./aiAskHistory";

/*
 * Live Ask count check (dev server, anonymous daily quota):
 *   curl -sN -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
 *     --data '{"question":"Research extensively, with citations, what the early discourses teach about feeling (vedanā)."}' \
 *     http://localhost:4321/api/ai/ask
 * Then a brief control:
 *   curl -sN -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
 *     --data '{"question":"What is MN 10?"}' \
 *     http://localhost:4321/api/ai/ask
 * Parse SSE `data:` JSON where type==="results": results.length and showCount.
 * Cookie `__session` is optional; unsigned requests use the anonymous quota.
 */

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

	it("can keep a small survey overshoot up to the hard cap", () => {
		const slugs = Array.from(
			{ length: AI_RERANK_HARD_LIMIT + 3 },
			(_, index) => `mn${index + 1}`,
		);
		const allowed = new Set(slugs);
		const parsed = parseRerankResponse(
			JSON.stringify({ slugs, summary: "ok", count: slugs.length }),
			allowed,
		);
		assert.equal(parsed.slugs.length, AI_RERANK_HARD_LIMIT);
		assert.equal(
			parsed.slugs[AI_RERANK_HARD_LIMIT - 1],
			`mn${AI_RERANK_HARD_LIMIT}`,
		);
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

	it("does not pad an ordinary shortlist", () => {
		const candidates = ["a", "b", "c", "d", "e"].map((slug) => ({ slug }));
		assert.deepEqual(
			applyRerankOrder(candidates, ["c", "a"], 10).map((item) => item.slug),
			["c", "a"],
		);
	});

	it("does not pad a survey to the typical ceiling", () => {
		const candidates = Array.from({ length: 8 }, (_, index) => ({
			slug: String.fromCharCode(97 + index),
		}));
		assert.deepEqual(
			applyRerankOrder(candidates, ["c"], AI_RERANK_MAX_LIMIT).map(
				(item) => item.slug,
			),
			["c"],
		);
		assert.deepEqual(
			applyRerankOrder(
				candidates,
				["c"],
				askRerankCap(AI_RERANK_MAX_LIMIT),
			).map((item) => item.slug),
			["c"],
		);
	});

	it("keeps a small survey overshoot instead of clipping at 50", () => {
		const candidates = Array.from({ length: 60 }, (_, index) => ({
			slug: `mn${index + 1}`,
		}));
		const slugs = candidates.slice(0, 53).map((item) => item.slug);
		assert.equal(
			applyRerankOrder(
				candidates,
				slugs,
				askRerankCap(AI_RERANK_MAX_LIMIT),
			).length,
			53,
		);
		assert.equal(
			applyRerankOrder(
				candidates,
				candidates.map((item) => item.slug),
				AI_RERANK_HARD_LIMIT + 10,
			).length,
			AI_RERANK_HARD_LIMIT,
		);
	});
});

describe("askRerankCap", () => {
	it("keeps brief at 10 and lets survey overshoot to 55", () => {
		assert.equal(askRerankCap(AI_RERANK_DEFAULT_LIMIT), AI_RERANK_DEFAULT_LIMIT);
		assert.equal(askRerankCap(AI_RERANK_MAX_LIMIT), AI_RERANK_HARD_LIMIT);
		assert.equal(clampAskResultLimit(AI_RERANK_HARD_LIMIT), AI_RERANK_HARD_LIMIT);
		assert.equal(clampAskResultLimit(80), AI_RERANK_HARD_LIMIT);
		assert.equal(
			resolveAskResultLimit("what is mindfulness?", "survey"),
			AI_RERANK_MAX_LIMIT,
		);
		assert.notEqual(
			resolveAskResultLimit("what is mindfulness?", "survey"),
			askRerankCap(AI_RERANK_MAX_LIMIT),
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
		assert.equal(
			resolveAskResultLimit("do an extensive search on feeling"),
			AI_RERANK_MAX_LIMIT,
		);
		assert.equal(
			resolveAskResultLimit("what is mindfulness?", "survey"),
			AI_RERANK_MAX_LIMIT,
		);
		assert.equal(
			resolveAskResultLimit("what is mindfulness?", "brief"),
			AI_RERANK_DEFAULT_LIMIT,
		);
		assert.equal(
			resolveAskResultLimit("I want to research this topic with citations", "brief"),
			AI_RERANK_DEFAULT_LIMIT,
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
		assert.match(prompt, /only as many as are needed/);
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
		assert.match(prompt, /Target result count: typically 20–50/);
		assert.match(prompt, /hard cap 55/);
		assert.match(prompt, /research \/ survey \/ cite thoroughly/);
		assert.match(prompt, /do not pad to a round number/);
		assert.match(prompt, /Already shown IDs/);
	});

	it("keeps the original question when rerank history is longer than the cap", () => {
		const history = Array.from({ length: 8 }, (_, i) => ({
			question: i === 0 ? "What is mindfulness?" : `Follow-up ${i}`,
			lookingFor: "mindfulness",
			queries: ["sati"],
			resultSlugs: i === 0 ? ["sn47.19", "mn118"] : [`mn${i + 30}`],
			summary: i === 0 ? "Original sati briefing." : "",
		}));
		const prompt = buildRerankUserPrompt(
			"other discourses",
			[{ slug: "mn1", title: "Mindfulness", description: "" }],
			{ history, limit: 10 },
		);
		assert.match(prompt, /What is mindfulness\?/);
		assert.match(prompt, /SN 47\.19/i);
		assert.match(prompt, /Follow-up 7/);
		assert.match(RERANK_SYSTEM, /planner blacklist/);
		assert.match(RERANK_SYSTEM, /Do not infer a blacklist/);
	});

	it("tells survey asks not to pad to a quota of 50", () => {
		const prompt = buildRerankUserPrompt(
			"research feeling with citations",
			[{ slug: "sn36.1", title: "Concentration", description: "" }],
			{ limit: AI_RERANK_MAX_LIMIT },
		);
		assert.match(prompt, /typically 20–50/);
		assert.match(prompt, /hard cap 55/);
		assert.match(prompt, /do not pad to a round number/);
		assert.match(prompt, /stretch to 50 for quota/);
		assert.doesNotMatch(prompt, /the full target, not a top-10/);
		assert.match(RERANK_SYSTEM, /Typical size is 20–50/);
		assert.match(RERANK_SYSTEM, /Do not stretch to 50 to fill a round number/);
		assert.match(RERANK_SYSTEM, /hard cap about 55/);
		assert.doesNotMatch(
			RERANK_SYSTEM,
			/If the pool has 50 relevant discourses, return 50/,
		);
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

	it("tags named-term hits, lists them first, and keeps their passage past the top of the pool", () => {
		const question =
			"Share a gloss for vimuttikkhandho based on all the discourses this term appears in";
		const buried = {
			slug: "sn47.13",
			title: "Cunda",
			description: "When Sāriputta attains final Nibbāna, Ānanda grieves.",
			contentSnippet:
				"did he take away your aggregate of liberation [vimuttikkhandha]",
			matchedQueries: ["vimuttikkhandho", "liberation"],
		};
		const famous = {
			slug: "sn22.56",
			title: "Upādānaparipavattasutta",
			description: "The arising and fading of the five aggregates.",
			contentSnippet: "form feeling perception",
			matchedQueries: ["liberation"],
		};
		const prompt = buildRerankUserPrompt(question, [famous, buried], {
			primaryQueries: ["vimuttikkhandho", "vimutti khandha", "liberation"],
			limit: 10,
		});
		assert.match(prompt, /Named-term matches \(retrieved by vimuttikkhandho\)/);
		assert.match(prompt, /SN 47\.13/);
		assert.match(prompt, /\[term: vimuttikkhandho\]/);
		assert.match(prompt, /passage: did he take away your aggregate of liberation/);
		assert.doesNotMatch(prompt, /SN 22\.56[^\n]*\[term:/);
		const namedAt = prompt.indexOf("SN 47.13");
		const famousAt = prompt.indexOf("SN 22.56");
		assert.ok(namedAt > 0 && famousAt > namedAt);
		assert.match(RERANK_SYSTEM, /\[term:/);
		assert.match(RERANK_SYSTEM, /Named-term matches are listed first/);
		assert.match(RERANK_SYSTEM, /Match the form they asked for/);
		assert.match(RERANK_SYSTEM, /termQueries/);
		assert.match(RERANK_SYSTEM, /later thinking step/);
		assert.match(RERANK_SYSTEM, /\[reference\] card/);
		assert.match(RERANK_SYSTEM, /passage does not contain/);
	});

	it("tags planner termQueries on a follow-up even when the question used English", () => {
		const question =
			"what should be the gloss for aggregate of wisdom. And likewise, what should be a gloss for aggregate of collectedness. |aggregate of liberation::freedom. [vimuttikkhandha]|";
		const prompt = buildRerankUserPrompt(
			question,
			[
				{
					slug: "dn10",
					title: "Subha",
					description: "The noble aggregates of virtue, immersion, and wisdom.",
					contentSnippet: "ariyo samādhikkhandho ariyo paññākkhandho",
					matchedQueries: ["samadikkhandho", "pannakkhandho"],
				},
				{
					slug: "mn141",
					title: "Saccavibhanga",
					description: "An analysis of the four noble truths.",
					contentSnippet: "right view is wisdom",
					matchedQueries: ["^AN"],
				},
			],
			{
				primaryQueries: [
					"samadikkhandho",
					"pannakkhandho",
					"vimuttikkhandho",
					"^AN",
				],
				termQueries: [
					"samadikkhandho",
					"pannakkhandho",
					"vimuttikkhandho",
				],
				limit: 50,
			},
		);
		assert.match(
			prompt,
			/Named-term matches \(retrieved by samadikkhandho, pannakkhandho, vimuttikkhandho\)/,
		);
		assert.match(prompt, /\[term: samadikkhandho; pannakkhandho\]/);
		assert.doesNotMatch(prompt, /MN 141[^\n]*\[term:/);
	});
});

describe("namedTermHitDebugRows", () => {
	it("records fused rank and whether a named-term hit was kept", () => {
		const rows = namedTermHitDebugRows(
			[
				{
					slug: "sn22.56",
					title: "",
					description: "",
					matchedQueries: ["liberation"],
				},
				{
					slug: "sn47.13",
					title: "",
					description: "",
					contentSnippet: "vimuttikkhandha",
					matchedQueries: ["vimuttikkhandho"],
				},
			],
			"Share a gloss for vimuttikkhandho",
			["vimuttikkhandho", "liberation"],
			["sn22.56"],
		);
		assert.deepEqual(rows.namedTermQueries, ["vimuttikkhandho"]);
		assert.equal(rows.hits.length, 1);
		assert.equal(rows.hits[0]?.slug, "sn47.13");
		assert.equal(rows.hits[0]?.rank, 2);
		assert.equal(rows.hits[0]?.snippet, true);
		assert.equal(rows.hits[0]?.kept, false);
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

describe("follow-up already-shown exclude", () => {
	it("does not keep the same slug list as the only results for other discourses", () => {
		const history = [
			{
				question: "What is mindfulness?",
				lookingFor: "mindfulness",
				queries: ["sati"],
				resultSlugs: ["sn47.19", "mn10"],
			},
		];
		const pool = [
			{ slug: "sn47.19" },
			{ slug: "mn10" },
			{ slug: "mn118" },
			{ slug: "sn47.35" },
		];
		assert.deepEqual(
			candidatesForAskFollowUp(pool, "other discourses", history).map(
				(hit) => hit.slug,
			),
			["mn118", "sn47.35"],
		);
		assert.deepEqual(
			candidatesForAskFollowUp(
				pool,
				"tell me more about MN 131",
				history,
			).map((hit) => hit.slug),
			["sn47.19", "mn10", "mn118", "sn47.35"],
		);
	});

	it("filters the candidate pool from the planner blacklist", () => {
		const history = [
			{
				question: "What is mindfulness?",
				lookingFor: "mindfulness",
				queries: ["sati"],
				resultSlugs: ["sn47.19", "mn10"],
			},
		];
		const pool = [
			{ slug: "sn47.19" },
			{ slug: "mn10" },
			{ slug: "mn118" },
			{ slug: "sn47.35" },
		];
		assert.deepEqual(
			candidatesForAskFollowUp(
				pool,
				"give me a fresh set",
				history,
				["sn47.19", "mn10"],
			).map((hit) => hit.slug),
			["mn118", "sn47.35"],
		);
	});
});

describe("formatRerankExcludeBlock", () => {
	it("puts the planner blacklist in the rescorer prompt", () => {
		assert.equal(formatRerankExcludeBlock(["mn10"], false), "");
		assert.match(
			formatRerankExcludeBlock(["mn10", "sn47.19"], true),
			/Do not include these IDs \(planner blacklist\): MN 10, SN 47\.19/,
		);
		assert.match(
			formatRerankExcludeBlock([], true),
			/planner blacklist\): \(none\)/,
		);
	});

	it("includes the blacklist when building a follow-up rerank prompt", () => {
		const prompt = buildRerankUserPrompt(
			"other discourses",
			[{ slug: "mn118", title: "Mindfulness", description: "" }],
			{
				history: [
					{
						question: "What is mindfulness?",
						lookingFor: "mindfulness",
						queries: ["sati"],
						resultSlugs: ["sn47.19", "mn10"],
					},
				],
				excludeSlugs: ["sn47.19", "mn10"],
				limit: 10,
			},
		);
		assert.match(
			prompt,
			/Do not include these IDs \(planner blacklist\): SN 47\.19, MN 10/,
		);
		assert.match(prompt, /context for pronouns only/);
	});
});
