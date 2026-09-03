import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyListenFlush,
	ensureMinListenSeconds,
	formatListenStat,
	isListenComplete,
	listenProgressDelta,
	mergeListenBySlug,
	recordListenSeconds,
	sanitizeListenActivity,
	shouldFlushListenActivity,
	sumListenSeconds,
} from "./listenActivity";

describe("recordListenSeconds", () => {
	it("accumulates per slug and marks pending", () => {
		const first = recordListenSeconds(
			{ bySlug: {}, totalSeconds: 0, pendingSync: false },
			"mn10",
			12.8,
		);
		assert.equal(first.added, 12.8);
		assert.equal(first.buffer.bySlug.mn10, 12.8);
		assert.equal(first.buffer.totalSeconds, 12.8);
		assert.equal(first.buffer.pendingSync, true);

		const second = recordListenSeconds(first.buffer, "mn10", 5);
		assert.equal(second.buffer.bySlug.mn10, 17.8);
		assert.equal(second.buffer.totalSeconds, 17.8);
	});

	it("keeps sub-second timeupdate deltas", () => {
		let buffer = { bySlug: {}, totalSeconds: 0, pendingSync: false };
		for (let i = 0; i < 240; i++) {
			buffer = recordListenSeconds(buffer, "mn10", 0.25).buffer;
		}
		assert.ok(buffer.totalSeconds >= 60);
		assert.ok(buffer.bySlug.mn10 >= 60);
	});

	it("rejects junk slugs and non-positive deltas", () => {
		const base = { bySlug: {}, totalSeconds: 0, pendingSync: false };
		assert.equal(recordListenSeconds(base, "../x", 10).added, 0);
		assert.equal(recordListenSeconds(base, "mn10", 0).added, 0);
	});
});

describe("ensureMinListenSeconds", () => {
	it("raises but never lowers a slug total", () => {
		const raised = ensureMinListenSeconds(
			{ bySlug: { mn10: 10 }, totalSeconds: 10, pendingSync: false },
			"mn10",
			90,
		);
		assert.equal(raised.raised, true);
		assert.equal(raised.buffer.bySlug.mn10, 90);
		const same = ensureMinListenSeconds(raised.buffer, "mn10", 40);
		assert.equal(same.raised, false);
		assert.equal(same.buffer.bySlug.mn10, 90);
	});
});

describe("listenProgressDelta", () => {
	it("counts small forward steps and drops seeks", () => {
		assert.ok(Math.abs(listenProgressDelta(10, 10.4) - 0.4) < 1e-9);
		assert.equal(listenProgressDelta(10, 40), 0);
		assert.equal(listenProgressDelta(10, 8), 0);
	});
});

describe("isListenComplete", () => {
	it("requires a full discourse (no paragraph range)", () => {
		assert.equal(
			isListenComplete({
				currentTime: 100,
				duration: 100,
				hasParagraphRange: true,
				ended: true,
			}),
			false,
		);
		assert.equal(
			isListenComplete({
				currentTime: 99,
				duration: 100,
				hasParagraphRange: false,
				ended: true,
			}),
			true,
		);
		assert.equal(
			isListenComplete({
				currentTime: 96,
				duration: 100,
				hasParagraphRange: false,
			}),
			true,
		);
		assert.equal(
			isListenComplete({
				currentTime: 50,
				duration: 100,
				hasParagraphRange: false,
			}),
			false,
		);
	});
});

describe("merge + flush", () => {
	it("takes the max seconds per slug", () => {
		const merged = mergeListenBySlug(
			{ mn10: 40, "sn12.1": 10 },
			{ mn10: 25, "an1.1": 5 },
		);
		assert.deepEqual(merged, { mn10: 40, "sn12.1": 10, "an1.1": 5 });
		assert.equal(sumListenSeconds(merged), 55);

		const after = applyListenFlush(
			{
				bySlug: { mn10: 40 },
				totalSeconds: 40,
				pendingSync: true,
			},
			{ bySlug: { mn10: 10, "sn1.1": 20 }, totalSeconds: 30 },
			"2026-09-03",
		);
		assert.equal(after.pendingSync, false);
		assert.equal(after.lastFlushedDay, "2026-09-03");
		assert.equal(after.bySlug.mn10, 40);
		assert.equal(after.bySlug["sn1.1"], 20);
		assert.equal(after.totalSeconds, 60);
	});
});

describe("shouldFlushListenActivity", () => {
	it("flushes when pending or not yet flushed today", () => {
		assert.equal(
			shouldFlushListenActivity(
				{ bySlug: { mn10: 10 }, totalSeconds: 10, pendingSync: true },
				"2026-09-03",
			),
			true,
		);
		assert.equal(
			shouldFlushListenActivity(
				{
					bySlug: { mn10: 10 },
					totalSeconds: 10,
					pendingSync: false,
					lastFlushedDay: "2026-09-02",
				},
				"2026-09-03",
			),
			true,
		);
		assert.equal(
			shouldFlushListenActivity(
				{
					bySlug: { mn10: 10 },
					totalSeconds: 10,
					pendingSync: false,
					lastFlushedDay: "2026-09-03",
				},
				"2026-09-03",
			),
			false,
		);
	});
});

describe("formatListenStat", () => {
	it("hides sub-minute totals and formats hours", () => {
		assert.equal(formatListenStat(40), null);
		assert.deepEqual(formatListenStat(60), {
			value: "1",
			label: "min listened",
		});
		assert.deepEqual(formatListenStat(125 * 60), {
			value: "2h 5m",
			label: "listened",
		});
		assert.deepEqual(formatListenStat(120 * 60), {
			value: "2h",
			label: "listened",
		});
	});
});

describe("sanitizeListenActivity", () => {
	it("rebuilds total from bySlug", () => {
		const clean = sanitizeListenActivity({
			bySlug: { mn10: 30.94, bad: -1 },
			totalSeconds: 999,
			pendingSync: true,
		});
		assert.deepEqual(clean.bySlug, { mn10: 30.9 });
		assert.equal(clean.totalSeconds, 30.9);
		assert.equal(clean.pendingSync, true);
	});
});
