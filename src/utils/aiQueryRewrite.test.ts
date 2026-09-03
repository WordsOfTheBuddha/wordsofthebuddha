import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clipAiQuestion,
	extractJsonObject,
	parseRewritePlan,
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
		assert.ok(!plan.queries.includes(long));
		assert.ok(plan.queries.length > 0);
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

describe("AI_REWRITE_SYSTEM_PROMPT", () => {
	it("documents the site search operators", async () => {
		const { AI_REWRITE_SYSTEM_PROMPT } = await import("./aiQueryRewrite");
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /pts:/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /\^SN/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /content:/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /exact phrase/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /correctedQuestion/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /shareSlug/);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /Satipaṭṭhāna Saṃyutta|SN 47/i);
		assert.match(AI_REWRITE_SYSTEM_PROMPT, /alreadyShown/);
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
