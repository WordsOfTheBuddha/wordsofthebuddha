import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isResearchJobStaleForRecovery,
	RESEARCH_STALE_RECOVERY_MS,
	researchJobStaleMs,
	researchJobUpdatedAtMs,
	shouldRecoverStuckResearchJob,
} from "./aiAskResearchRecovery";

describe("researchJobUpdatedAtMs", () => {
	it("prefers updatedAt over createdAt", () => {
		assert.equal(
			researchJobUpdatedAtMs({ updatedAt: 2_000, createdAt: 1_000 }),
			2_000,
		);
	});

	it("falls back to createdAt when updatedAt is missing", () => {
		assert.equal(researchJobUpdatedAtMs({ createdAt: 1_000 }), 1_000);
	});
});

describe("isResearchJobStaleForRecovery", () => {
	it("is false until the stale window passes", () => {
		const now = 1_000_000;
		const record = {
			updatedAt: now - RESEARCH_STALE_RECOVERY_MS + 1,
		};
		assert.equal(isResearchJobStaleForRecovery(record, now), false);
		assert.equal(
			isResearchJobStaleForRecovery(
				{ updatedAt: now - RESEARCH_STALE_RECOVERY_MS },
				now,
			),
			true,
		);
	});
});

describe("shouldRecoverStuckResearchJob", () => {
	const now = 10_000_000;
	const staleAt = now - RESEARCH_STALE_RECOVERY_MS;

	it("recovers stale in-flight research jobs", () => {
		assert.equal(
			shouldRecoverStuckResearchJob(
				{ status: "answering", updatedAt: staleAt },
				now,
			),
			true,
		);
	});

	it("does not recover terminal or revision jobs", () => {
		assert.equal(
			shouldRecoverStuckResearchJob(
				{ status: "complete", updatedAt: staleAt },
				now,
			),
			false,
		);
		assert.equal(
			shouldRecoverStuckResearchJob(
				{ status: "revising", updatedAt: staleAt },
				now,
			),
			false,
		);
		assert.equal(
			shouldRecoverStuckResearchJob(
				{ status: "revise-clarifying", updatedAt: staleAt },
				now,
			),
			false,
		);
	});

	it("does not recover jobs that are still being written", () => {
		assert.equal(
			shouldRecoverStuckResearchJob(
				{
					status: "searching",
					updatedAt: now - RESEARCH_STALE_RECOVERY_MS + 5_000,
				},
				now,
			),
			false,
		);
	});
});

describe("researchJobStaleMs", () => {
	it("returns elapsed time since the last write", () => {
		assert.equal(
			researchJobStaleMs({ updatedAt: 1_000 }, 61_000),
			60_000,
		);
	});
});
