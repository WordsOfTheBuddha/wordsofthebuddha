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
const LIGHTNING = "nvidia/nemotron-3.5-lightning:free";
const GEMINI = "gemini-3.5-flash-lite";

describe("plannerDisplayName", () => {
	it("uses the short picker name", () => {
		assert.equal(plannerDisplayName(ULTRA), "Nemotron 3 Ultra");
		assert.equal(plannerDisplayName(LIGHTNING), "Nemotron 3.5 Lightning");
		assert.equal(plannerDisplayName(ASK_PLANNER_PAID_FALLBACK_MODEL), "GLM 5.3 Flash");
		assert.equal(plannerDisplayName(GEMINI), "Gemini");
	});
});

describe("classifyPlannerFailure", () => {
	it("distinguishes unusable plans, 404, busy, timeout, and quota", () => {
		assert.equal(
			classifyPlannerFailure({
				model: LIGHTNING,
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
				model: LIGHTNING,
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
			requested: LIGHTNING,
			used: GEMINI,
			provider: "gemini" as const,
			failed: [
				{ model: LIGHTNING, message: "unusable rewrite (no_json)" },
				{ model: ULTRA, message: "provider error" },
			],
			skippedCooldown: [] as string[],
			acceptedHasReasoning: false,
		};
		const note = buildAskPlannerNote(input);
		assert.match(note || "", /Nemotron 3\.5 Lightning didn’t produce a usable search plan/i);
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
			requested: LIGHTNING,
			used: GEMINI,
			provider: "gemini",
			failed: [
				{ model: LIGHTNING, status: 429, message: "rate limited" },
				{ model: ULTRA, status: 503, message: "unavailable" },
			],
			skippedCooldown: [],
			acceptedHasReasoning: false,
		});
		assert.equal(
			note,
			"Nemotron 3.5 Lightning and the other free models were busy — planned with Gemini instead, which does not share its thinking.",
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
				requested: LIGHTNING,
				used: GEMINI,
				provider: "gemini",
				failed: [
					{
						model: LIGHTNING,
						status: 429,
						message: "You exceeded your current quota",
					},
				],
				skippedCooldown: [],
				acceptedHasReasoning: false,
			}) || "",
			/Nemotron 3\.5 Lightning hit its quota/,
		);
	});

	it("uses cooldown copy when free models were skipped, not “busy”", () => {
		const note = buildAskPlannerNote({
			requested: LIGHTNING,
			used: GEMINI,
			provider: "gemini",
			failed: [],
			skippedCooldown: [LIGHTNING, ULTRA],
			acceptedHasReasoning: false,
		});
		assert.match(note || "", /recently unavailable/);
		assert.doesNotMatch(note || "", /busy/i);
	});

	it("omits OpenRouter→OpenRouter fallbacks from the reader-facing note", () => {
		const timeout = {
			requested: ULTRA,
			used: ASK_PLANNER_PAID_FALLBACK_MODEL,
			provider: "openrouter" as const,
			failed: [
				{
					model: ULTRA,
					message: "The operation was aborted due to timeout",
				},
			],
			skippedCooldown: [] as string[],
			acceptedHasReasoning: true,
		};
		assert.equal(buildAskPlannerNote(timeout), undefined);
		assert.equal(
			buildAskPlannerNote({
				...timeout,
				failed: [],
				skippedCooldown: [ULTRA],
			}),
			undefined,
		);
		assert.equal(
			buildAskPlannerNote({
				requested: LIGHTNING,
				used: ULTRA,
				provider: "openrouter",
				failed: [{ model: LIGHTNING, message: "unusable rewrite (weak_queries)" }],
				skippedCooldown: [],
				acceptedHasReasoning: true,
			}),
			undefined,
		);
	});

	it("keeps OpenRouter fallback copy for server logs / DEV", () => {
		assert.equal(
			buildAskPlannerNote({
				requested: LIGHTNING,
				used: ULTRA,
				provider: "openrouter",
				failed: [{ model: LIGHTNING, message: "unusable rewrite (weak_queries)" }],
				skippedCooldown: [],
				acceptedHasReasoning: true,
				audience: "log",
			}),
			"Nemotron 3.5 Lightning didn’t produce a usable search plan — planned with Nemotron 3 Ultra instead.",
		);
		assert.equal(
			buildAskPlannerNote({
				requested: ULTRA,
				used: ASK_PLANNER_PAID_FALLBACK_MODEL,
				provider: "openrouter",
				failed: [{ model: ULTRA, status: 429, message: "rate limited" }],
				skippedCooldown: [],
				acceptedHasReasoning: true,
				audience: "log",
			}),
			"Nemotron 3 Ultra was busy — planned with GLM 5.3 Flash instead.",
		);
		assert.match(
			buildAskPlannerNote({
				requested: ULTRA,
				used: ASK_PLANNER_PAID_FALLBACK_MODEL,
				provider: "openrouter",
				failed: [
					{
						model: ULTRA,
						message: "The operation was aborted due to timeout",
					},
				],
				skippedCooldown: [],
				acceptedHasReasoning: false,
				audience: "log",
			}) || "",
			/Nemotron 3 Ultra timed out — planned with GLM 5\.3 Flash instead/,
		);
		assert.match(
			buildAskPlannerNote({
				requested: ULTRA,
				used: ASK_PLANNER_PAID_FALLBACK_MODEL,
				provider: "openrouter",
				failed: [],
				skippedCooldown: [ULTRA],
				acceptedHasReasoning: false,
				audience: "log",
			}) || "",
			/Nemotron 3 Ultra was recently unavailable — planned with GLM 5\.3 Flash instead/,
		);
	});

	it("omits a note when the requested OpenRouter model succeeded or Gemini was the only planner", () => {
		assert.equal(
			buildAskPlannerNote({
				requested: LIGHTNING,
				used: LIGHTNING,
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
