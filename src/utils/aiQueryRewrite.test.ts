import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AI_ASK_HISTORY_SUMMARY_MAX,
	AI_REWRITE_SYSTEM_PROMPT,
	buildRewriteMessages,
	clipAiHistorySummary,
	clipAiQuestion,
	extractJsonObject,
	looksLikeHardTeachingTopic,
	looksLikePersonalCrisis,
	parseAskExcludeSlugs,
	parseAskFollowUpIntent,
	parseAskHistory,
	parseRewritePlan,
	preferMinimalCorrectedQuestion,
	resolveRewriteExcludeSlugs,
	shouldHonorOffTopic,
	shouldRetryUnusableRewrite,
} from "./aiQueryRewrite";

describe("extractJsonObject", () => {
	it("reads JSON from reasoning wrappers and fences", () => {
		const raw = `<think>plan</think>\n\`\`\`json\n{"lookingFor":"anger","queries":["anger","kodha"],"offTopic":false}\n\`\`\``;
		assert.deepEqual(extractJsonObject(raw), {
			lookingFor: "anger",
			queries: ["anger", "kodha"],
			offTopic: false,
		});
	});

	it("returns null when there is no object", () => {
		assert.equal(extractJsonObject("no json here"), null);
	});
});

describe("parseRewritePlan", () => {
	it("uses the model JSON when valid", () => {
		const plan = parseRewritePlan(
			'{"lookingFor":"anger","queries":["anger","kodha"]}',
			"why am I angry",
		);
		assert.deepEqual(plan, {
			correctedQuestion: "why am I angry",
			lookingFor: "anger",
			queries: ["anger", "kodha"],
			fallbackQueries: [],
			offTopic: false,
		});
	});

	it("keeps rankingGuidance for the rescorer", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "mindfulness technique",
				queries: ["satipaṭṭhāna"],
				rankingGuidance:
					"  They want practice instructions;   favour SN 47 and MN 118 over verse. ",
			}),
			"how do I practice mindfulness",
		);
		assert.equal(
			plan.rankingGuidance,
			"They want practice instructions; favour SN 47 and MN 118 over verse.",
		);
	});

	it("keeps excludeSlugs only from already-shown IDs", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "other mindfulness",
				queries: ["kāyagatāsati"],
				followUpIntent: "diversify",
				excludeSlugs: ["MN 10", "sn47.19", "mn999", "invented"],
			}),
			"other discourses",
			["mn10", "sn47.19"],
		);
		assert.equal(plan.followUpIntent, "diversify");
		assert.deepEqual(plan.excludeSlugs, ["mn10", "sn47.19"]);
		assert.ok(!plan.excludeSlugs?.includes("mn999"));
	});

	it("parses a diversify follow-up plan with a blacklist", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "further satipaṭṭhāna",
				queries: ["kāyagatāsati", "sampajañña"],
				followUpIntent: "diversify",
				excludeSlugs: ["sn47.19", "mn10"],
				rankingGuidance:
					"Cover remaining SN 47 facets; do not repeat the prior shortlist.",
			}),
			"other discourses",
			["sn47.19", "mn10"],
		);
		assert.equal(plan.followUpIntent, "diversify");
		assert.deepEqual(plan.excludeSlugs, ["sn47.19", "mn10"]);
	});

	it("parses a refine follow-up with an empty blacklist", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "MN 131",
				queries: ["MN 131"],
				followUpIntent: "refine",
				excludeSlugs: [],
				rankingGuidance: "Stay with MN 131; they asked to go deeper on that hit.",
			}),
			"tell me more about MN 131",
			["sn47.19", "mn10", "mn131"],
		);
		assert.equal(plan.followUpIntent, "refine");
		assert.deepEqual(plan.excludeSlugs, []);
	});

	it("omits excludeSlugs when the planner did not set the field", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "anger",
				queries: ["kodha"],
			}),
			"why am I angry",
			["mn10"],
		);
		assert.equal(plan.excludeSlugs, undefined);
		assert.equal(plan.followUpIntent, undefined);
	});

	it("keeps survey coverage from the planner", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "satipatthana",
				queries: ["satipaṭṭhāna"],
				coverage: "survey",
			}),
			"search extensively for satipatthana",
		);
		assert.equal(plan.coverage, "survey");
	});

	it("keeps personSlugs from the model plan", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "Sakka",
				queries: ["sakka"],
				personSlugs: ["sakka-lord-of-the-gods", "Not A Slug!!"],
			}),
			"tell me about soccer",
		);
		assert.deepEqual(plan.personSlugs, [
			"sakka-lord-of-the-gods",
			"not-a-slug",
		]);
	});

	it("prefers correctedQuestion for display wording", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				correctedQuestion:
					"Is there a discourse on the full moon night where the Buddha takes questions from the bhikkhus?",
				lookingFor: "full moon night",
				queries: ["SN 22.82", "MN 109"],
			}),
			"is there a discourse on the full moon night where the Buddha takes questions from the weeknds",
		);
		assert.match(plan.correctedQuestion, /bhikkhus/i);
		assert.doesNotMatch(plan.correctedQuestion, /weeknds/i);
	});

	it("falls back to short topical queries when the model rambles", () => {
		const plan = parseRewritePlan(
			"I think you should meditate.",
			"mind fulless coins in these dis courses",
		);
		assert.equal(plan.degraded, true);
		assert.equal(plan.degradedReason, "no_json");
		assert.equal(shouldRetryUnusableRewrite(plan), true);
		assert.ok(plan.queries.length > 0);
		assert.ok(plan.queries.every((query) => query.split(/\s+/).length <= 8));
		assert.doesNotMatch(plan.queries.join(" | "), /I think you should/);
		assert.match(plan.correctedQuestion, /mindfulness/i);
	});

	it("rejects a full-sentence query chip from the model", () => {
		const long =
			"I would like for an enumeration of all the other mindfulness kinds that are not included in these discourses yet";
		const plan = parseRewritePlan(
			JSON.stringify({
				correctedQuestion: long,
				lookingFor: long,
				queries: [long],
				fallbackQueries: [],
			}),
			long,
		);
		assert.equal(plan.degraded, true);
		assert.equal(plan.degradedReason, "weak_queries");
		assert.ok(!plan.queries.includes(long));
		assert.ok(plan.queries.length > 0);
	});

	it("keeps usable chips without marking degraded when one chip is weak", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "sekha",
				queries: [
					"sekha",
					"I would like a very long full sentence query that should be dropped as weak",
				],
				fallbackQueries: [],
			}),
			"Who is a sekha?",
		);
		assert.equal(plan.degraded, undefined);
		assert.deepEqual(plan.queries, ["sekha"]);
	});

	it("honors off-topic with no queries", () => {
		const plan = parseRewritePlan(
			'{"lookingFor":"weather","queries":[],"offTopic":true}',
			"will it rain",
		);
		assert.equal(plan.offTopic, true);
		assert.deepEqual(plan.queries, []);
		assert.deepEqual(plan.fallbackQueries, []);
		assert.equal(plan.correctedQuestion, "will it rain");
		assert.equal(plan.lookingFor, "weather");
	});

	it("overrides a safety refusal on hard teaching topics", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "I can’t discuss violence.",
				queries: [],
				offTopic: true,
			}),
			"Does the Buddha condone killing? Be as detailed as possible.",
		);
		assert.equal(plan.offTopic, false);
		assert.ok(plan.queries.length > 0);
		assert.equal(plan.degraded, true);
		assert.equal(plan.degradedReason, "offtopic_override");
	});

	it("keeps a longer off-topic redirect for distress framing", () => {
		const redirect =
			"I’m not able to help with a crisis. Please reach out to a trusted person or local emergency / crisis services right away.";
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: redirect,
				queries: [],
				offTopic: true,
			}),
			"I want to hurt myself",
		);
		assert.equal(plan.offTopic, true);
		assert.deepEqual(plan.queries, []);
		assert.equal(plan.lookingFor, redirect);
	});

	it("keeps exact-phrase operators and fallback queries", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "letting go",
				queries: ['"letting go"', "nekkhamma"],
				fallbackQueries: ["renunciation"],
			}),
			"search exactly for letting go",
		);
		assert.deepEqual(plan.queries, ['"letting go"', "nekkhamma"]);
		assert.deepEqual(plan.fallbackQueries, ["renunciation"]);
	});
});

describe("clipAiQuestion", () => {
	it("trims and caps length", () => {
		assert.equal(clipAiQuestion("  hello   world  "), "hello world");
		assert.equal(clipAiQuestion("x".repeat(600)).length, 500);
	});
});

describe("preferMinimalCorrectedQuestion", () => {
	it("keeps clear typo fixes", () => {
		const original = "what did the budha teach about anger?";
		const fixed = "what did the Buddha teach about anger?";
		assert.equal(preferMinimalCorrectedQuestion(original, fixed), fixed);
	});

	it("rejects rewording of detailed instructions", () => {
		const original =
			"Please search exhaustively for discourses on anger. Write in detail, compare several angles, and do not summarize away the practical instructions.";
		const rewritten =
			"What do the early discourses say about anger and its practical remedies?";
		assert.equal(
			preferMinimalCorrectedQuestion(original, rewritten),
			original,
		);
	});
});

describe("parseAskHistory", () => {
	it("keeps turn 1 with result slugs instead of a tail-only slice", () => {
		const raw = Array.from({ length: 8 }, (_, i) => ({
			question: i === 0 ? "What is mindfulness?" : `Follow-up ${i}`,
			lookingFor: "theme",
			queries: ["sati"],
			resultSlugs: i === 0 ? ["sn47.19", "mn10"] : [`an${i}`],
			summary: i === 0 ? "Original sati briefing." : "",
		}));
		const turns = parseAskHistory(raw);
		assert.equal(turns.length, 6);
		assert.equal(turns[0]?.question, "What is mindfulness?");
		assert.deepEqual(turns[0]?.resultSlugs, ["sn47.19", "mn10"]);
		assert.match(turns[0]?.summary || "", /Original sati/);
		assert.equal(turns[turns.length - 1]?.question, "Follow-up 7");
	});
});

describe("clipAiHistorySummary", () => {
	it("trims and caps prior-turn briefing length", () => {
		assert.equal(clipAiHistorySummary("  a   b  "), "a b");
		assert.equal(
			clipAiHistorySummary("x".repeat(AI_ASK_HISTORY_SUMMARY_MAX + 50))
				.length,
			AI_ASK_HISTORY_SUMMARY_MAX,
		);
	});
});

describe("buildRewriteMessages", () => {
	it("includes prior summaries for conversational follow-ups", () => {
		const messages = buildRewriteMessages(
			"What about the second one?",
			[
				{
					question: "What is mindfulness?",
					lookingFor: "mindfulness",
					queries: ["sati"],
					resultSlugs: ["sn47.19", "mn10"],
					summary: "These discourses develop satipaṭṭhāna in practice.",
				},
			],
			"",
		);
		const user = messages.find((message) => message.role === "user");
		assert.ok(user);
		assert.match(String(user.content), /Earlier turns/);
		assert.match(String(user.content), /alreadyShown: sn47\.19, mn10/);
		assert.match(String(user.content), /summary: These discourses develop/);
		assert.match(String(user.content), /What about the second one\?/);
		assert.match(String(user.content), /Already shown IDs/);
		assert.match(String(user.content), /excludeSlugs/);
	});

	it("keeps the original question and shown IDs when history is longer than the cap", () => {
		const history = Array.from({ length: 8 }, (_, i) => ({
			question: i === 0 ? "What is mindfulness?" : `Follow-up ${i}`,
			lookingFor: "mindfulness",
			queries: ["sati"],
			resultSlugs: i === 0 ? ["sn47.19", "mn10"] : [`mn${i + 20}`],
			summary: i === 0 ? "Original briefing on sati." : "",
		}));
		const messages = buildRewriteMessages("other discourses", history, "");
		const user = messages.find((message) => message.role === "user");
		assert.ok(user);
		assert.match(String(user.content), /What is mindfulness\?/);
		assert.match(String(user.content), /alreadyShown: sn47\.19, mn10/);
		assert.match(String(user.content), /Follow-up 7/);
		assert.doesNotMatch(String(user.content), /Follow-up 1\n/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /never drop the first question/i);
	});
});

describe("shouldHonorOffTopic", () => {
	it("refuses only personal crisis; keeps hard teaching searchable", () => {
		assert.equal(looksLikePersonalCrisis("I want to kill myself"), true);
		assert.equal(
			looksLikeHardTeachingTopic("Does the Buddha condone killing?"),
			true,
		);
		assert.equal(
			shouldHonorOffTopic("Does the Buddha condone killing?", true),
			false,
		);
		assert.equal(shouldHonorOffTopic("I want to kill myself", true), true);
		assert.equal(shouldHonorOffTopic("will it rain tomorrow", true), true);
		assert.equal(shouldHonorOffTopic("what is mindfulness", false), false);
	});
});

describe("AI_REWRITE_SYSTEM_PROMPT", () => {
	it("documents the site search operators", async () => {
		const { AI_REWRITE_SYSTEM_PROMPT } = await import("./aiQueryRewrite");
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /pts:/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /\^SN/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /content:/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /exact phrase/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /correctedQuestion/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /verbatim|do not reword/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /shareSlug/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /Satipaṭṭhāna Saṃyutta|SN 47/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /alreadyShown/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /Classify the intent/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /excludeSlugs/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /followUpIntent/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /non-thinking/);
	});

	it("keeps hard ethics in-library and refuses only personal crisis", async () => {
		const { AI_REWRITE_SYSTEM_PROMPT } = await import("./aiQueryRewrite");
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /keep offTopic false and search normally/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /Do NOT refuse/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /undeclared|avyākata/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /Personal distress \/ crisis only/i);
	});
});

describe("parseRewritePlan shareSlug", () => {
	it("keeps a valid model shareSlug", () => {
		const plan = parseRewritePlan(
			JSON.stringify({
				lookingFor: "mindfulness of the body",
				queries: ["kāyagatāsati"],
				shareSlug: "Mindfulness of the Body!",
			}),
			"what is mindfulness of the body?",
		);
		assert.equal(plan.shareSlug, "mindfulness-of-the-body");
	});
});

describe("parseAskExcludeSlugs", () => {
	it("keeps only allowed shown slugs", () => {
		assert.deepEqual(
			parseAskExcludeSlugs(
				["MN 10", "sn47.19", "mn999", "an3.1"],
				["mn10", "sn47.19"],
			),
			["mn10", "sn47.19"],
		);
		assert.deepEqual(parseAskExcludeSlugs(["mn10"], []), []);
		assert.equal(parseAskFollowUpIntent("diversify"), "diversify");
		assert.equal(parseAskFollowUpIntent("refine"), "refine");
		assert.equal(parseAskFollowUpIntent("new topic"), undefined);
		assert.equal(parseAskFollowUpIntent("new"), "new");
	});
});

describe("resolveRewriteExcludeSlugs", () => {
	const shown = ["sn47.19", "mn10"];

	it("uses the planner list when present", () => {
		assert.deepEqual(
			resolveRewriteExcludeSlugs(
				{ excludeSlugs: ["mn10"], followUpIntent: "diversify" },
				shown,
				"other discourses",
			),
			["mn10"],
		);
	});

	it("fills already-shown IDs for a diversify plan that omitted the list", () => {
		assert.deepEqual(
			resolveRewriteExcludeSlugs(
				{ followUpIntent: "diversify" },
				shown,
				"give me a fresh set",
			),
			shown,
		);
	});

	it("does not blacklist on refine even if the question looks like 'more'", () => {
		assert.deepEqual(
			resolveRewriteExcludeSlugs(
				{ excludeSlugs: [], followUpIntent: "refine" },
				shown,
				"tell me more about MN 131",
			),
			[],
		);
	});

	it("falls back to the question-text heuristic only when the planner omitted both fields", () => {
		assert.deepEqual(
			resolveRewriteExcludeSlugs({}, shown, "other discourses"),
			shown,
		);
		assert.deepEqual(
			resolveRewriteExcludeSlugs({}, shown, "give me a fresh set"),
			[],
		);
		assert.deepEqual(
			resolveRewriteExcludeSlugs({}, shown, "tell me more about MN 131"),
			[],
		);
		assert.deepEqual(resolveRewriteExcludeSlugs({}, [], "other discourses"), []);
	});
});
