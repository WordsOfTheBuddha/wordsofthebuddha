import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAskPlannerNote,
	classifyPlannerFailure,
	plannerDisplayName,
} from "./aiAskPlannerNote";

const M3 = "minimax/minimax-m3:free";
const ULTRA = "nvidia/nemotron-3-ultra-550b-a55b:free";
const GLM = "z-ai/glm-5.2:free";
const GEMINI = "gemini-3.5-flash-lite";

describe("plannerDisplayName", () => {
	it("uses the short picker name", () => {
		assert.equal(plannerDisplayName(M3), "M3");
		assert.equal(plannerDisplayName(ULTRA), "Nemotron 3 Ultra");
		assert.equal(plannerDisplayName(GLM), "GLM 5.2");
		assert.equal(plannerDisplayName(GEMINI), "Gemini");
	});
});

describe("classifyPlannerFailure", () => {
	it("distinguishes unusable plans, 404, busy, timeout, and quota", () => {
		assert.equal(
			classifyPlannerFailure({
				model: M3,
				message: "unusable rewrite (no_json)",
			}),
			"unusable",
		);
		assert.equal(
			classifyPlannerFailure({
				model: GLM,
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
				model: M3,
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
			requested: M3,
			used: GEMINI,
			provider: "gemini" as const,
			failed: [
				{ model: M3, message: "unusable rewrite (no_json)" },
				{ model: ULTRA, message: "provider error" },
				{ model: GLM, status: 404, message: "Not Found" },
			],
			skippedCooldown: [] as string[],
			acceptedHasReasoning: false,
		};
		const note = buildAskPlannerNote(input);
		assert.match(note || "", /M3 didn’t produce a usable search plan/i);
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
			requested: M3,
			used: GEMINI,
			provider: "gemini",
			failed: [
				{ model: M3, status: 429, message: "rate limited" },
				{ model: ULTRA, status: 503, message: "unavailable" },
				{ model: GLM, status: 429, message: "too many requests" },
			],
			skippedCooldown: [],
			acceptedHasReasoning: false,
		});
		assert.equal(
			note,
			"M3 and the other free models were busy — planned with Gemini instead, which does not share its thinking.",
		);
	});

	it("names 404 as not on this key", () => {
		const note = buildAskPlannerNote({
			requested: GLM,
			used: GEMINI,
			provider: "gemini",
			failed: [{ model: GLM, status: 404, message: "Not Found" }],
			skippedCooldown: [],
			acceptedHasReasoning: false,
		});
		assert.match(note || "", /GLM 5\.2 isn’t available on this key/);
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
				requested: M3,
				used: GEMINI,
				provider: "gemini",
				failed: [
					{
						model: M3,
						status: 429,
						message: "You exceeded your current quota",
					},
				],
				skippedCooldown: [],
				acceptedHasReasoning: false,
			}) || "",
			/M3 hit its quota/,
		);
	});

	it("uses cooldown copy when free models were skipped, not “busy”", () => {
		const note = buildAskPlannerNote({
			requested: M3,
			used: GEMINI,
			provider: "gemini",
			failed: [],
			skippedCooldown: [M3, ULTRA, GLM],
			acceptedHasReasoning: false,
		});
		assert.match(note || "", /recently unavailable/);
		assert.doesNotMatch(note || "", /busy/i);
	});

	it("explains an OpenRouter fallback from an unusable plan without saying busy", () => {
		const note = buildAskPlannerNote({
			requested: M3,
			used: ULTRA,
			provider: "openrouter",
			failed: [{ model: M3, message: "unusable rewrite (weak_queries)" }],
			skippedCooldown: [],
			acceptedHasReasoning: true,
		});
		assert.equal(
			note,
			"M3 didn’t produce a usable search plan — planned with Nemotron 3 Ultra instead.",
		);
	});

	it("omits a note when the requested OpenRouter model succeeded or Gemini was the only planner", () => {
		assert.equal(
			buildAskPlannerNote({
				requested: M3,
				used: M3,
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
