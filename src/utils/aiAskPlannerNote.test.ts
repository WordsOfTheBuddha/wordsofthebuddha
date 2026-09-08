import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
} from "./openrouter";
import {
	buildAskPlannerNote,
	classifyPlannerFailure,
	plannerDisplayName,
} from "./aiAskPlannerNote";

const ULTRA = "nvidia/nemotron-3-ultra-550b-a55b:free";
const LAGUNA = "poolside/laguna-s-2.1:free";
const LIGHTNING = "nvidia/nemotron-3.5-lightning:free";
const GEMINI = "gemini-3.5-flash-lite";

describe("plannerDisplayName", () => {
	it("uses the short picker name", () => {
		assert.equal(plannerDisplayName(ULTRA), "Nemotron 3 Ultra");
		assert.equal(plannerDisplayName(LAGUNA), "Laguna S 2.1");
		assert.equal(plannerDisplayName(LIGHTNING), "Nemotron 3.5 Lightning");
		assert.equal(plannerDisplayName(ASK_PLANNER_PAID_FALLBACK_MODEL), "GLM 5.3 Flash");
		assert.equal(plannerDisplayName(GEMINI), "Gemini");
	});
});

describe("classifyPlannerFailure", () => {
	it("distinguishes unusable plans, 404, busy, timeout, and quota", () => {
		assert.equal(
			classifyPlannerFailure({
				model: LAGUNA,
				message: "unusable rewrite (no_json)",
			}),
			"unusable",
		);
		assert.equal(
			classifyPlannerFailure({
				model: LIGHTNING,
				status: 404,
				message: "Not Found",
			}),
			"not_available",
		);
		assert.equal(
			classifyPlannerFailure({
				model: ULTRA,
				status: 429,
				message: "rate limited",
			}),
			"busy",
		);
		assert.equal(
			classifyPlannerFailure({
				model: ULTRA,
				message: "The operation was aborted due to timeout",
			}),
			"timeout",
		);
		assert.equal(
			classifyPlannerFailure({
				model: LAGUNA,
				status: 429,
				message: "RESOURCE_EXHAUSTED: Quota exceeded",
			}),
			"quota",
		);
	});
});

describe("buildAskPlannerNote", () => {
	it("does not call mixed unusable/404 failures “busy”, and mentions Gemini-no-think only without accepted reasoning", () => {
		const input = {
			requested: LAGUNA,
			used: GEMINI,
			provider: "gemini" as const,
			failed: [
				{ model: LAGUNA, message: "unusable rewrite (no_json)" },
				{ model: ULTRA, message: "provider error" },
				{ model: LIGHTNING, status: 404, message: "Not Found" },
			],
			skippedCooldown: [] as string[],
			acceptedHasReasoning: false,
		};
		const note = buildAskPlannerNote(input);
		assert.match(note || "", /Laguna S 2\.1 didn’t produce a usable search plan/i);
		assert.match(note || "", /other free models couldn’t complete the plan/i);
		assert.match(note || "", /planned with Gemini instead/i);
		assert.match(note || "", /does not share its thinking/i);
		assert.doesNotMatch(note || "", /busy/i);

		const withThinking = buildAskPlannerNote({
			...input,
			acceptedHasReasoning: true,
		});
		assert.match(withThinking || "", /planned with Gemini instead/i);
		assert.doesNotMatch(withThinking || "", /does not share its thinking/i);
		assert.doesNotMatch(withThinking || "", /busy/i);
	});

	it("says busy only for rate-limits / outages", () => {
		const note = buildAskPlannerNote({
			requested: LAGUNA,
			used: GEMINI,
			provider: "gemini",
			failed: [
				{ model: LAGUNA, status: 429, message: "rate limited" },
				{ model: ULTRA, status: 503, message: "unavailable" },
				{ model: LIGHTNING, status: 429, message: "too many requests" },
			],
			skippedCooldown: [],
			acceptedHasReasoning: false,
		});
		assert.equal(
			note,
			"Laguna S 2.1 and the other free models were busy — planned with Gemini instead, which does not share its thinking.",
		);
	});

	it("names 404 as not on this key", () => {
		const note = buildAskPlannerNote({
			requested: LIGHTNING,
			used: GEMINI,
			provider: "gemini",
			failed: [{ model: LIGHTNING, status: 404, message: "Not Found" }],
			skippedCooldown: [],
			acceptedHasReasoning: false,
		});
		assert.match(note || "", /Nemotron 3\.5 Lightning isn’t available on this key/);
		assert.doesNotMatch(note || "", /busy/i);
	});

	it("names timeouts and quota separately", () => {
		assert.match(
			buildAskPlannerNote({
				requested: ULTRA,
				used: GEMINI,
				provider: "gemini",
				failed: [
					{
						model: ULTRA,
						message: "The operation was aborted due to timeout",
					},
				],
				skippedCooldown: [],
				acceptedHasReasoning: false,
			}) || "",
			/Nemotron 3 Ultra timed out/,
		);
		assert.match(
			buildAskPlannerNote({
				requested: LAGUNA,
				used: GEMINI,
				provider: "gemini",
				failed: [
					{
						model: LAGUNA,
						status: 429,
						message: "You exceeded your current quota",
					},
				],
				skippedCooldown: [],
				acceptedHasReasoning: false,
			}) || "",
			/Laguna S 2\.1 hit its quota/,
		);
	});

	it("uses cooldown copy when free models were skipped, not “busy”", () => {
		const note = buildAskPlannerNote({
			requested: LAGUNA,
			used: GEMINI,
			provider: "gemini",
			failed: [],
			skippedCooldown: [LAGUNA, ULTRA, LIGHTNING],
			acceptedHasReasoning: false,
		});
		assert.match(note || "", /recently unavailable/);
		assert.doesNotMatch(note || "", /busy/i);
	});

	it("explains an OpenRouter fallback from an unusable plan without saying busy", () => {
		const note = buildAskPlannerNote({
			requested: LAGUNA,
			used: ULTRA,
			provider: "openrouter",
			failed: [{ model: LAGUNA, message: "unusable rewrite (weak_queries)" }],
			skippedCooldown: [],
			acceptedHasReasoning: true,
		});
		assert.equal(
			note,
			"Laguna S 2.1 didn’t produce a usable search plan — planned with Nemotron 3 Ultra instead.",
		);
	});

	it("explains a fallback to paid GLM without calling it a free model", () => {
		const note = buildAskPlannerNote({
			requested: ULTRA,
			used: ASK_PLANNER_PAID_FALLBACK_MODEL,
			provider: "openrouter",
			failed: [
				{ model: ULTRA, status: 429, message: "rate limited" },
				{ model: LAGUNA, status: 503, message: "unavailable" },
			],
			skippedCooldown: [],
			acceptedHasReasoning: true,
		});
		assert.equal(
			note,
			"Nemotron 3 Ultra was busy — planned with GLM 5.3 Flash instead.",
		);
	});

	it("omits a note when the requested OpenRouter model succeeded or Gemini was the only planner", () => {
		assert.equal(
			buildAskPlannerNote({
				requested: LAGUNA,
				used: LAGUNA,
				provider: "openrouter",
				failed: [],
				skippedCooldown: [],
				acceptedHasReasoning: true,
			}),
			undefined,
		);
		assert.equal(
			buildAskPlannerNote({
				requested: GEMINI,
				used: GEMINI,
				provider: "gemini",
				failed: [],
				skippedCooldown: [],
				acceptedHasReasoning: false,
			}),
			undefined,
		);
	});
});
