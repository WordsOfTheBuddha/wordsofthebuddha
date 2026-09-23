import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_PLANNER_SLOW_CODE,
	MAX_PLANNER_OPENROUTER_ATTEMPTS,
	PLANNER_ATTEMPT_MS,
	PLANNER_TIMEOUT_RETRIES,
	formatPlannerRoutingLine,
	isPlannerTimeoutError,
	nextUnusableRewriteAction,
	plannerModelAttempts,
	plannerSlowError,
	shouldTryAnotherPlannerModel,
} from "./aiAskRewrite";
import {
	ASK_PLANNER_FALLBACK_ORDER,
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	askPlannerChatOptions,
} from "./openrouter";

function httpError(status: number): Error & { status: number } {
	const error = new Error(`status ${status}`) as Error & { status: number };
	error.status = status;
	return error;
}

describe("plannerModelAttempts", () => {
	it("tries the requested model, then stronger→lighter fallbacks, max 3", () => {
		const order = ["ultra", "flash", "other"];
		assert.deepEqual(plannerModelAttempts("flash", order, 3), [
			"flash",
			"ultra",
			"other",
		]);
		assert.deepEqual(plannerModelAttempts("ultra", order, 3), [
			"ultra",
			"flash",
			"other",
		]);
		assert.deepEqual(plannerModelAttempts("zzz", order, 3), [
			"zzz",
			"ultra",
			"flash",
		]);
	});

	it("uses GLM only in the automatic queue", () => {
		assert.equal(MAX_PLANNER_OPENROUTER_ATTEMPTS, 3);
		assert.deepEqual(ASK_PLANNER_FALLBACK_ORDER, [
			ASK_PLANNER_PAID_FALLBACK_MODEL,
		]);
		assert.deepEqual(
			plannerModelAttempts(ASK_PLANNER_PAID_FALLBACK_MODEL),
			[ASK_PLANNER_PAID_FALLBACK_MODEL],
		);
		assert.deepEqual(
			plannerModelAttempts("nvidia/nemotron-3-ultra-550b-a55b:free"),
			[
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			],
		);
		assert.deepEqual(
			plannerModelAttempts("nvidia/nemotron-3.5-lightning:free"),
			[
				"nvidia/nemotron-3.5-lightning:free",
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			],
		);
	});

	it("skips cooled-down models and fills from healthier ones", () => {
		const order = ["ultra", "flash", "other"];
		assert.deepEqual(
			plannerModelAttempts("ultra", order, 3, {
				isExcluded: (id) => id === "ultra" || id === "flash",
			}),
			["other"],
		);
		assert.deepEqual(
			plannerModelAttempts("glm", order, 3, {
				isExcluded: () => true,
			}),
			[],
		);
	});

	it("plans paid GLM without json_object so the reasoning channel can stream", () => {
		assert.equal(askPlannerChatOptions(ASK_PLANNER_PAID_FALLBACK_MODEL).jsonMode, false);
		assert.equal(
			askPlannerChatOptions(ASK_PLANNER_PAID_FALLBACK_MODEL).reasoningEffort,
			"high",
		);
		assert.equal(
			askPlannerChatOptions("nvidia/nemotron-3-ultra-550b-a55b:free").jsonMode,
			true,
		);
	});

	it("keeps paid GLM in the last slot when a free model is cooled down", () => {
		assert.deepEqual(
			plannerModelAttempts("nvidia/nemotron-3-ultra-550b-a55b:free", undefined, 3, {
				isExcluded: (id) => id === "nvidia/nemotron-3-ultra-550b-a55b:free",
			}),
			[ASK_PLANNER_PAID_FALLBACK_MODEL],
		);
	});
});

describe("nextUnusableRewriteAction", () => {
	it("moves on when a fallback exists; last model retries once then degrades", () => {
		assert.equal(
			nextUnusableRewriteAction({
				alreadyRetriedSameModel: false,
				hasNextOpenRouter: true,
			}),
			"try_next",
		);
		assert.equal(
			nextUnusableRewriteAction({
				alreadyRetriedSameModel: true,
				hasNextOpenRouter: true,
			}),
			"try_next",
		);
		assert.equal(
			nextUnusableRewriteAction({
				alreadyRetriedSameModel: false,
				hasNextOpenRouter: false,
			}),
			"retry_same",
		);
		assert.equal(
			nextUnusableRewriteAction({
				alreadyRetriedSameModel: true,
				hasNextOpenRouter: false,
			}),
			"use_degraded",
		);
	});
});

describe("formatPlannerRoutingLine", () => {
	it("summarizes models actually called, failures, and the model that answered", () => {
		const line = formatPlannerRoutingLine({
			requested: "nvidia/nemotron-3.5-lightning:free",
			queue: [
				"nvidia/nemotron-3.5-lightning:free",
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			],
			attempts: [
				"nvidia/nemotron-3.5-lightning:free",
				"nvidia/nemotron-3-ultra-550b-a55b:free",
			],
			skippedCooldown: [ASK_PLANNER_PAID_FALLBACK_MODEL],
			failed: [
				{ model: "nvidia/nemotron-3.5-lightning:free", status: 429, message: "rate" },
			],
			used: "nvidia/nemotron-3-ultra-550b-a55b:free",
			provider: "openrouter",
			degraded: true,
			degradedReason: "no_json",
			reranker: "gemini-3.5-flash-lite",
			writer: "nvidia/nemotron-3-ultra-550b-a55b:free",
		});
		assert.match(line, /requested=nvidia\/nemotron-3\.5-lightning:free/);
		assert.match(
			line,
			/called=nvidia\/nemotron-3\.5-lightning:free → nvidia\/nemotron-3-ultra-550b-a55b:free/,
		);
		assert.match(
			line,
			new RegExp(
				`skipped cooldown: ${ASK_PLANNER_PAID_FALLBACK_MODEL.replace(
					/[.*+?^${}()|[\]\\]/g,
					"\\$&",
				)}`,
			),
		);
		assert.match(line, /failed: nvidia\/nemotron-3\.5-lightning:free \(429\)/);
		assert.match(line, /used=nvidia\/nemotron-3-ultra-550b-a55b:free \(openrouter\)/);
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

describe("planner timeout stepdown", () => {
	it("caps single attempts at 60s with up to 2 low-effort retries", () => {
		assert.equal(PLANNER_ATTEMPT_MS, 60_000);
		assert.equal(PLANNER_TIMEOUT_RETRIES, 2);
	});

	it("detects only our attempt-timeout abort, not user disconnects", () => {
		assert.equal(
			isPlannerTimeoutError(new DOMException("Timed out", "TimeoutError")),
			true,
		);
		assert.equal(
			isPlannerTimeoutError(
				new Error("The operation was aborted due to timeout"),
			),
			true,
		);
		assert.equal(
			isPlannerTimeoutError(new DOMException("Aborted", "AbortError")),
			false,
		);
		assert.equal(isPlannerTimeoutError(new Error("boom")), false);
		assert.equal(isPlannerTimeoutError(httpError(429)), false);
	});

	it("exhausted timeouts report slow with try-another-prompt copy", () => {
		const error = plannerSlowError();
		assert.equal(error.status, 502);
		assert.equal(error.code, ASK_PLANNER_SLOW_CODE);
		assert.match(error.message, /shorter question/);
	});
});
