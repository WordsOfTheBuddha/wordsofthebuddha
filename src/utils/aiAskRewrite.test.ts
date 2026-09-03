import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	MAX_PLANNER_OPENROUTER_ATTEMPTS,
	formatPlannerRoutingLine,
	plannerModelAttempts,
	shouldTryAnotherPlannerModel,
} from "./aiAskRewrite";
import { ASK_PLANNER_FALLBACK_ORDER } from "./openrouter";

function httpError(status: number): Error & { status: number } {
	const error = new Error(`status ${status}`) as Error & { status: number };
	error.status = status;
	return error;
}

describe("plannerModelAttempts", () => {
	it("tries the requested model, then stronger→lighter fallbacks, max 3", () => {
		const order = ["ultra", "minimax", "glm", "lightning"];
		assert.deepEqual(plannerModelAttempts("glm", order, 3), [
			"glm",
			"ultra",
			"minimax",
		]);
		assert.deepEqual(plannerModelAttempts("ultra", order, 3), [
			"ultra",
			"minimax",
			"glm",
		]);
		assert.deepEqual(plannerModelAttempts("zzz", order, 3), [
			"zzz",
			"ultra",
			"minimax",
		]);
	});

	it("uses the product fallback order and caps OpenRouter attempts", () => {
		assert.equal(MAX_PLANNER_OPENROUTER_ATTEMPTS, 3);
		assert.deepEqual(ASK_PLANNER_FALLBACK_ORDER, [
			"nvidia/nemotron-3-ultra-550b-a55b:free",
			"minimax/minimax-m3:free",
			"z-ai/glm-5.2:free",
			"nvidia/nemotron-3.5-lightning:free",
		]);
		assert.deepEqual(
			plannerModelAttempts("nvidia/nemotron-3-ultra-550b-a55b:free"),
			[
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				"minimax/minimax-m3:free",
				"z-ai/glm-5.2:free",
			],
		);
		assert.deepEqual(plannerModelAttempts("z-ai/glm-5.2:free"), [
			"z-ai/glm-5.2:free",
			"nvidia/nemotron-3-ultra-550b-a55b:free",
			"minimax/minimax-m3:free",
		]);
	});

	it("skips cooled-down models and fills from healthier ones", () => {
		const order = ["ultra", "minimax", "glm", "lightning"];
		assert.deepEqual(
			plannerModelAttempts("ultra", order, 3, {
				isExcluded: (id) => id === "ultra" || id === "glm",
			}),
			["minimax", "lightning"],
		);
		assert.deepEqual(
			plannerModelAttempts("glm", order, 3, {
				isExcluded: () => true,
			}),
			[],
		);
	});
});

describe("formatPlannerRoutingLine", () => {
	it("summarizes models actually called, failures, and the model that answered", () => {
		const line = formatPlannerRoutingLine({
			requested: "z-ai/glm-5.2:free",
			queue: [
				"minimax/minimax-m3:free",
				"z-ai/glm-5.2:free",
				"nvidia/nemotron-3.5-lightning:free",
			],
			attempts: ["minimax/minimax-m3:free", "z-ai/glm-5.2:free"],
			skippedCooldown: ["nvidia/nemotron-3-ultra-550b-a55b:free"],
			failed: [
				{ model: "minimax/minimax-m3:free", status: 429, message: "rate" },
			],
			used: "z-ai/glm-5.2:free",
			provider: "openrouter",
			degraded: true,
			degradedReason: "no_json",
			reranker: "gemini-3.5-flash-lite",
		});
		assert.match(line, /requested=z-ai\/glm-5\.2:free/);
		assert.match(line, /called=minimax\/minimax-m3:free → z-ai\/glm-5\.2:free/);
		assert.match(line, /skipped cooldown: nvidia\/nemotron-3-ultra/);
		assert.match(line, /failed: minimax\/minimax-m3:free \(429\)/);
		assert.match(line, /used=z-ai\/glm-5\.2:free \(openrouter\)/);
		assert.match(line, /rerank=gemini-3\.5-flash-lite/);
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
