import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	PLANNER_COOLDOWN_MS,
	PLANNER_FAILURE_WINDOW_MS,
	PlannerModelHealth,
	createMemoryHealthStore,
	shouldRecordPlannerFailure,
} from "./aiPlannerHealth";

function httpError(status: number): Error & { status: number } {
	const error = new Error(`status ${status}`) as Error & { status: number };
	error.status = status;
	return error;
}

describe("shouldRecordPlannerFailure", () => {
	it("records rate limits, outages and timeouts — not auth errors", () => {
		assert.equal(shouldRecordPlannerFailure(httpError(429)), true);
		assert.equal(shouldRecordPlannerFailure(httpError(503)), true);
		assert.equal(
			shouldRecordPlannerFailure(new DOMException("Timed out", "TimeoutError")),
			true,
		);
		assert.equal(shouldRecordPlannerFailure(httpError(401)), false);
		assert.equal(shouldRecordPlannerFailure(httpError(400)), false);
	});
});

describe("PlannerModelHealth", () => {
	it("excludes a model after two failures inside the window", () => {
		let now = 1_000_000;
		const health = new PlannerModelHealth({
			store: createMemoryHealthStore(),
			now: () => now,
		});
		const model = "z-ai/glm-5.2:free";
		health.recordFailure(model, httpError(429));
		assert.equal(health.isExcluded(model), false);
		health.recordFailure(model, httpError(429));
		assert.equal(health.isExcluded(model), true);
		assert.ok(health.cooldownRemainingMs(model) > 0);
		assert.ok(health.cooldownRemainingMs(model) <= PLANNER_COOLDOWN_MS);
	});

	it("clears on success and after cooldown expires", () => {
		let now = 1_000_000;
		const health = new PlannerModelHealth({
			store: createMemoryHealthStore(),
			now: () => now,
		});
		const model = "minimax/minimax-m3:free";
		health.recordFailure(model, httpError(429));
		health.recordFailure(model, httpError(503));
		assert.equal(health.isExcluded(model), true);
		health.recordSuccess(model);
		assert.equal(health.isExcluded(model), false);

		health.recordFailure(model, httpError(429));
		health.recordFailure(model, httpError(429));
		assert.equal(health.isExcluded(model), true);
		now += PLANNER_COOLDOWN_MS + 1;
		assert.equal(health.isExcluded(model), false);
	});

	it("ignores failures outside the sliding window", () => {
		let now = 1_000_000;
		const health = new PlannerModelHealth({
			store: createMemoryHealthStore(),
			now: () => now,
		});
		const model = "nvidia/nemotron-3-ultra-550b-a55b:free";
		health.recordFailure(model, httpError(429));
		now += PLANNER_FAILURE_WINDOW_MS + 1;
		health.recordFailure(model, httpError(429));
		assert.equal(health.isExcluded(model), false);
	});
});
