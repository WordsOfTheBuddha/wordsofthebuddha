import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJobWriteCoalescer } from "./aiAskResearchWriteCoalescer";

interface TestRecord {
	reasoning?: string;
	progressNote?: string;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function recorder() {
	const writes: Array<Partial<TestRecord>> = [];
	return {
		writes,
		write: async (_current: TestRecord, patch: Partial<TestRecord>) => {
			writes.push({ ...patch });
		},
	};
}

describe("research write coalescer", () => {
	it("coalesces a burst of reasoning deltas into one latest-value write", async () => {
		const state: TestRecord = { reasoning: "" };
		const { writes, write } = recorder();
		const coalescer = createJobWriteCoalescer<TestRecord>({
			getRecord: () => state,
			write,
			intervalMs: 20,
		});
		for (let i = 1; i <= 25; i++) {
			state.reasoning = `${state.reasoning}${i} `;
			coalescer.queueReasoning();
		}
		await delay(60);
		assert.equal(writes.length, 1);
		assert.equal(writes[0].reasoning, state.reasoning);
		assert.equal(writes[0].progressNote, undefined);
	});

	it("flush writes immediately and cancels the pending timer", async () => {
		const state: TestRecord = { reasoning: "partial" };
		const { writes, write } = recorder();
		const coalescer = createJobWriteCoalescer<TestRecord>({
			getRecord: () => state,
			write,
			intervalMs: 40,
		});
		coalescer.queueReasoning();
		await coalescer.flush();
		assert.equal(writes.length, 1);
		await delay(80);
		assert.equal(writes.length, 1);
	});

	it("merges reasoning and progress notes last-wins in a single write", async () => {
		const state: TestRecord = { reasoning: "final text", progressNote: "" };
		const { writes, write } = recorder();
		const coalescer = createJobWriteCoalescer<TestRecord>({
			getRecord: () => state,
			write,
			intervalMs: 40,
		});
		coalescer.queueProgressNote("first");
		coalescer.queueProgressNote("second");
		coalescer.queueReasoning();
		await coalescer.flush();
		assert.equal(writes.length, 1);
		assert.equal(writes[0].progressNote, "second");
		assert.equal(writes[0].reasoning, "final text");
	});

	it("skips empty reasoning and blank progress notes", async () => {
		const state: TestRecord = { reasoning: "" };
		const { writes, write } = recorder();
		const coalescer = createJobWriteCoalescer<TestRecord>({
			getRecord: () => state,
			write,
			intervalMs: 20,
		});
		coalescer.queueReasoning();
		coalescer.queueProgressNote("   ");
		await coalescer.flush();
		assert.equal(writes.length, 0);
	});

	it("dispose drops queued writes and blocks late scheduling", async () => {
		const state: TestRecord = { reasoning: "late" };
		const { writes, write } = recorder();
		const coalescer = createJobWriteCoalescer<TestRecord>({
			getRecord: () => state,
			write,
			intervalMs: 20,
		});
		coalescer.queueReasoning();
		coalescer.dispose();
		coalescer.queueProgressNote("after dispose");
		await delay(60);
		assert.equal(writes.length, 0);
	});

	it("serializes drains so writes never overlap", async () => {
		const state: TestRecord = { reasoning: "a" };
		let inFlight = 0;
		let maxInFlight = 0;
		const coalescer = createJobWriteCoalescer<TestRecord>({
			getRecord: () => state,
			write: async () => {
				inFlight += 1;
				maxInFlight = Math.max(maxInFlight, inFlight);
				await delay(25);
				inFlight -= 1;
			},
			intervalMs: 10,
		});
		coalescer.queueReasoning();
		await delay(30);
		state.reasoning = "b";
		coalescer.queueReasoning();
		await coalescer.flush();
		assert.equal(maxInFlight, 1);
	});

	it("surfaces write errors without rejecting flush", async () => {
		const errors: unknown[] = [];
		const coalescer = createJobWriteCoalescer<TestRecord>({
			getRecord: () => ({ reasoning: "x" }),
			write: async () => {
				throw new Error("boom");
			},
			onError: (error) => errors.push(error),
			intervalMs: 20,
		});
		coalescer.queueReasoning();
		await coalescer.flush();
		assert.equal(errors.length, 1);
	});
});