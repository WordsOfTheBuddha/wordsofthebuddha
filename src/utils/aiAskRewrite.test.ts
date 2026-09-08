import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	MAX_PLANNER_OPENROUTER_ATTEMPTS,
	formatPlannerRoutingLine,
	plannerModelAttempts,
	shouldTryAnotherPlannerModel,
} from "./aiAskRewrite";
import { ASK_PLANNER_FALLBACK_ORDER, ASK_PLANNER_PAID_FALLBACK_MODEL } from "./openrouter";

function httpError(status: number): Error & { status: number } {
	const error = new Error(`status ${status}`) as Error & { status: number };
	error.status = status;
	return error;
}

describe("plannerModelAttempts", () => {
	it("tries the requested model, then stronger→lighter fallbacks, max 3", () => {
		const order = ["ultra", "laguna", "lightning", "other"];
		assert.deepEqual(plannerModelAttempts("lightning", order, 3), [
			"lightning",
			"ultra",
			"laguna",
		]);
		assert.deepEqual(plannerModelAttempts("ultra", order, 3), [
			"ultra",
			"laguna",
			"lightning",
		]);
		assert.deepEqual(plannerModelAttempts("zzz", order, 3), [
			"zzz",
			"ultra",
			"laguna",
		]);
	});

	it("uses the product fallback order and caps OpenRouter attempts", () => {
		assert.equal(MAX_PLANNER_OPENROUTER_ATTEMPTS, 3);
		assert.deepEqual(ASK_PLANNER_FALLBACK_ORDER, [
			"nvidia/nemotron-3-ultra-550b-a55b:free",
			"poolside/laguna-s-2.1:free",
			ASK_PLANNER_PAID_FALLBACK_MODEL,
		]);
		assert.deepEqual(
			plannerModelAttempts("nvidia/nemotron-3-ultra-550b-a55b:free"),
			[
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				"poolside/laguna-s-2.1:free",
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			],
		);
		assert.deepEqual(
			plannerModelAttempts("nvidia/nemotron-3.5-lightning:free"),
			[
				"nvidia/nemotron-3.5-lightning:free",
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			],
		);
		assert.deepEqual(
			plannerModelAttempts("poolside/laguna-s-2.1:free"),
			[
				"poolside/laguna-s-2.1:free",
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			],
		);
	});

	it("skips cooled-down models and fills from healthier ones", () => {
		const order = ["ultra", "laguna", "lightning", "other"];
		assert.deepEqual(
			plannerModelAttempts("ultra", order, 3, {
				isExcluded: (id) => id === "ultra" || id === "lightning",
			}),
			["laguna", "other"],
		);
		assert.deepEqual(
			plannerModelAttempts("glm", order, 3, {
				isExcluded: () => true,
			}),
			[],
		);
	});

	it("keeps paid GLM in the last slot when a free model is cooled down", () => {
		assert.deepEqual(
			plannerModelAttempts("nvidia/nemotron-3-ultra-550b-a55b:free", undefined, 3, {
				isExcluded: (id) => id === "nvidia/nemotron-3-ultra-550b-a55b:free",
			}),
			["poolside/laguna-s-2.1:free", ASK_PLANNER_PAID_FALLBACK_MODEL],
		);
	});
});

describe("formatPlannerRoutingLine", () => {
	it("summarizes models actually called, failures, and the model that answered", () => {
		const line = formatPlannerRoutingLine({
			requested: "nvidia/nemotron-3.5-lightning:free",
			queue: [
				"poolside/laguna-s-2.1:free",
				"nvidia/nemotron-3.5-lightning:free",
				"nvidia/nemotron-3-ultra-550b-a55b:free",
			],
			attempts: [
				"poolside/laguna-s-2.1:free",
				"nvidia/nemotron-3.5-lightning:free",
			],
			skippedCooldown: ["nvidia/nemotron-3-ultra-550b-a55b:free"],
			failed: [
				{ model: "poolside/laguna-s-2.1:free", status: 429, message: "rate" },
			],
			used: "nvidia/nemotron-3.5-lightning:free",
			provider: "openrouter",
			degraded: true,
			degradedReason: "no_json",
			reranker: "gemini-3.5-flash-lite",
			writer: "nvidia/nemotron-3-ultra-550b-a55b:free",
		});
		assert.match(line, /requested=nvidia\/nemotron-3\.5-lightning:free/);
		assert.match(
			line,
			/called=poolside\/laguna-s-2\.1:free → nvidia\/nemotron-3\.5-lightning:free/,
		);
		assert.match(line, /skipped cooldown: nvidia\/nemotron-3-ultra/);
		assert.match(line, /failed: poolside\/laguna-s-2\.1:free \(429\)/);
		assert.match(line, /used=nvidia\/nemotron-3\.5-lightning:free \(openrouter\)/);
		assert.match(line, /rerank=gemini-3\.5-flash-lite/);
		assert.match(line, /write=nvidia\/nemotron-3-ultra-550b-a55b:free/);
		assert.match(line, /degraded:no_json/);
	});
});

describe("shouldTryAnotherPlannerModel", () => {
	it("moves on for rate limits, outages and unavailable models", () => {
		assert.equal(shouldTryAnotherPlannerModel(httpError(429)), true);
		assert.equal(shouldTryAnotherPlannerModel(httpError(403)), true);
		assert.equal(shouldTryAnotherPlannerModel(httpError(404)), true);
		assert.equal(shouldTryAnotherPlannerModel(httpError(503)), true);
	});

	it("moves on when a single attempt times out", () => {
		assert.equal(
			shouldTryAnotherPlannerModel(new DOMException("Timed out", "TimeoutError")),
			true,
		);
		assert.equal(
			shouldTryAnotherPlannerModel(new Error("The operation was aborted due to timeout")),
			true,
		);
	});

	it("moves on when a provider rejects request params (e.g. json_mode)", () => {
		assert.equal(shouldTryAnotherPlannerModel(httpError(400)), true);
	});

	it("does not mask real failures", () => {
		assert.equal(shouldTryAnotherPlannerModel(httpError(401)), false);
		assert.equal(shouldTryAnotherPlannerModel(new Error("bad json")), false);
	});
});
