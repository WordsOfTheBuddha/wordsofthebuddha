import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AI_ASK_HISTORY_SUMMARY_MAX,
	buildRewriteMessages,
	clipAiHistorySummary,
	clipAiQuestion,
	extractJsonObject,
	looksLikeHardTeachingTopic,
	looksLikePersonalCrisis,
	parseRewritePlan,
	preferMinimalCorrectedQuestion,
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
