import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	RESEARCH_ENQUEUE_TIMEOUT_MS,
	RESEARCH_HANDOFF_MARGIN_MS,
	researchWriterBudgetWithMargin,
	shouldChainResearchPass,
	shouldRetryResearchWriter,
	shouldRunResearchPaliReread,
	shouldYieldResearchFirstPass,
} from "./aiAskResearchHandoff";
import { ASK_WRITER_MIN_MS } from "./aiAskAnswer";

const RETRY_THRESHOLD = RESEARCH_HANDOFF_MARGIN_MS + ASK_WRITER_MIN_MS;

describe("research handoff guards", () => {
	it("yields the first pass when the writer cannot fit before the handoff", () => {
		assert.equal(shouldYieldResearchFirstPass(RETRY_THRESHOLD), true);
		assert.equal(shouldYieldResearchFirstPass(RETRY_THRESHOLD - 1), true);
		assert.equal(shouldYieldResearchFirstPass(0), true);
		assert.equal(shouldYieldResearchFirstPass(RETRY_THRESHOLD + 1), false);
		assert.equal(shouldYieldResearchFirstPass(120_000), false);
	});

	it("skips the writer retry once the handoff margin is at risk", () => {
		assert.equal(shouldRetryResearchWriter(RETRY_THRESHOLD), false);
		assert.equal(shouldRetryResearchWriter(RETRY_THRESHOLD - 1), false);
		assert.equal(shouldRetryResearchWriter(RETRY_THRESHOLD + 1), true);
		assert.equal(shouldRetryResearchWriter(120_000), true);
	});

	it("skips the pali reread once the handoff margin is gone", () => {
		assert.equal(shouldRunResearchPaliReread(RESEARCH_HANDOFF_MARGIN_MS), false);
		assert.equal(shouldRunResearchPaliReread(RESEARCH_HANDOFF_MARGIN_MS - 1), false);
		assert.equal(shouldRunResearchPaliReread(RESEARCH_HANDOFF_MARGIN_MS + 1), true);
	});

	it("bounds the enqueue fetch so a hung handoff cannot eat the pass", () => {
		assert.ok(RESEARCH_ENQUEUE_TIMEOUT_MS > 0);
		assert.ok(RESEARCH_ENQUEUE_TIMEOUT_MS <= RESEARCH_HANDOFF_MARGIN_MS);
	});
});

describe("researchWriterBudgetWithMargin", () => {
	it("returns 0 when the writer cannot fit before the handoff", () => {
		// 40s left: below the 50s retry threshold.
		assert.equal(researchWriterBudgetWithMargin(270_000 - 40_000), 0);
		assert.equal(researchWriterBudgetWithMargin(270_000 - RETRY_THRESHOLD), 0);
	});

	it("leaves the handoff margin on the table", () => {
		// 60s left: 60s writer budget capped to 60s - 30s margin = 30s.
		assert.equal(researchWriterBudgetWithMargin(270_000 - 60_000), 30_000);
	});

	it("caps a fresh pass at the writer max", () => {
		assert.equal(researchWriterBudgetWithMargin(0), 150_000);
	});
});

describe("shouldChainResearchPass", () => {
	it("chains when the first write never happened, even with nothing unread", () => {
		// The prod fallback case: writer failed, everything pre-marked read,
		// continue-eval skipped — the fallback must not ship as final.
		assert.equal(
			shouldChainResearchPass({
				batchSize: 0,
				extraQueryCount: 0,
				extraPaliCount: 0,
				needsFirstWrite: true,
				resultCount: 7,
			}),
			true,
		);
	});

	it("does not chain an empty result set even when the write failed", () => {
		assert.equal(
			shouldChainResearchPass({
				batchSize: 0,
				extraQueryCount: 0,
				extraPaliCount: 0,
				needsFirstWrite: true,
				resultCount: 0,
			}),
			false,
		);
	});

	it("does not chain a finished report with nothing left to do", () => {
		assert.equal(
			shouldChainResearchPass({
				batchSize: 0,
				extraQueryCount: 0,
				extraPaliCount: 0,
				needsFirstWrite: false,
				resultCount: 7,
			}),
			false,
		);
	});

	it("keeps chaining on unread batches and extra queries or pali reads", () => {
		const base = {
			extraQueryCount: 0,
			extraPaliCount: 0,
			needsFirstWrite: false,
			resultCount: 7,
		};
		assert.equal(shouldChainResearchPass({ ...base, batchSize: 3 }), true);
		assert.equal(
			shouldChainResearchPass({ ...base, batchSize: 0, extraQueryCount: 2 }),
			true,
		);
		assert.equal(
			shouldChainResearchPass({ ...base, batchSize: 0, extraPaliCount: 1 }),
			true,
		);
	});
});
