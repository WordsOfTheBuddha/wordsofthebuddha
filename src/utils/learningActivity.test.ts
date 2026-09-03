import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyLearningFlush,
	countLearningDays,
	learningDaysFromReadMinutes,
	learningDaysLabel,
	localDayKey,
	mergeLearningDays,
	recentLearningDayStrip,
	recordLearningDay,
	sanitizeLearningActivity,
	seedLearningDaysFromReads,
	shouldFlushLearningActivity,
} from "./learningActivity";

describe("localDayKey", () => {
	it("formats a local calendar day", () => {
		assert.equal(localDayKey(new Date(2026, 8, 3, 23, 59)), "2026-09-03");
	});
});

describe("recordLearningDay", () => {
	it("sets the day once and marks pending sync", () => {
		const first = recordLearningDay(
			{ days: {}, pendingSync: false },
			"2026-09-03",
		);
		assert.equal(first.newlyRecorded, true);
		assert.equal(first.buffer.pendingSync, true);
		assert.deepEqual(first.buffer.days, { "2026-09-03": true });

		const second = recordLearningDay(first.buffer, "2026-09-03");
		assert.equal(second.newlyRecorded, false);
		assert.equal(second.buffer.pendingSync, true);
	});
});

describe("merge + flush", () => {
	it("unions days and clears pending on flush", () => {
		const merged = mergeLearningDays(
			{ "2026-09-01": true },
			{ "2026-09-03": true },
		);
		assert.deepEqual(merged, {
			"2026-09-01": true,
			"2026-09-03": true,
		});
		assert.equal(countLearningDays(merged), 2);

		const after = applyLearningFlush(
			{
				days: { "2026-09-01": true, "2026-09-02": true },
				pendingSync: true,
			},
			{ "2026-09-03": true },
			"2026-09-03",
		);
		assert.equal(after.pendingSync, false);
		assert.equal(after.lastFlushedDay, "2026-09-03");
		assert.equal(countLearningDays(after.days), 3);
	});
});

describe("shouldFlushLearningActivity", () => {
	it("flushes when pending or not yet flushed today", () => {
		assert.equal(
			shouldFlushLearningActivity(
				{ days: { "2026-09-03": true }, pendingSync: true },
				"2026-09-03",
			),
			true,
		);
		assert.equal(
			shouldFlushLearningActivity(
				{
					days: { "2026-09-03": true },
					pendingSync: false,
					lastFlushedDay: "2026-09-02",
				},
				"2026-09-03",
			),
			true,
		);
		assert.equal(
			shouldFlushLearningActivity(
				{
					days: { "2026-09-03": true },
					pendingSync: false,
					lastFlushedDay: "2026-09-03",
				},
				"2026-09-03",
			),
			false,
		);
		assert.equal(
			shouldFlushLearningActivity(
				{ days: {}, pendingSync: true },
				"2026-09-03",
			),
			false,
		);
	});
});

describe("sanitizeLearningActivity", () => {
	it("drops junk keys", () => {
		const clean = sanitizeLearningActivity({
			days: { "2026-09-03": true, nope: true, "2026-13-40": 1 },
			pendingSync: "yes",
			lastFlushedDay: "bad",
		});
		assert.deepEqual(clean.days, { "2026-09-03": true });
		assert.equal(clean.pendingSync, false);
		assert.equal(clean.lastFlushedDay, undefined);
	});
});

describe("learningDaysLabel", () => {
	it("uses singular and plural forms", () => {
		assert.equal(learningDaysLabel(0), "");
		assert.equal(learningDaysLabel(1), "Reading on 1 day");
		assert.equal(learningDaysLabel(12), "Reading on 12 days");
	});
});

describe("recentLearningDayStrip", () => {
	it("marks active days across the last N days, oldest first", () => {
		const strip = recentLearningDayStrip(
			{ "2026-09-01": true, "2026-09-03": true },
			7,
			"2026-09-03",
		);
		assert.equal(strip.length, 7);
		assert.equal(strip[0]?.key, "2026-08-28");
		assert.equal(strip[strip.length - 1]?.key, "2026-09-03");
		assert.deepEqual(
			strip.filter((dot) => dot.active).map((dot) => dot.key),
			["2026-09-01", "2026-09-03"],
		);
	});
});

describe("learningDaysFromReadMinutes", () => {
	it("turns mark-as-read timestamps into day keys", () => {
		const dayA = Date.UTC(2026, 0, 1, 12) / 60_000;
		const dayB = Date.UTC(2026, 0, 3, 18) / 60_000;
		const days = learningDaysFromReadMinutes(
			{ mn10: dayA, "sn12.1": dayB, bad: "x" },
			(ms) => new Date(ms).toISOString().slice(0, 10),
		);
		assert.deepEqual(days, {
			"2026-01-01": true,
			"2026-01-03": true,
		});
	});

	it("seeds a buffer and marks pending sync when new days appear", () => {
		const minutes = Date.UTC(2026, 5, 10, 8) / 60_000;
		const seeded = seedLearningDaysFromReads(
			{ days: { "2026-06-01": true }, pendingSync: false },
			{ mn1: minutes },
			(ms) => new Date(ms).toISOString().slice(0, 10),
		);
		assert.equal(seeded.pendingSync, true);
		assert.deepEqual(seeded.days, {
			"2026-06-01": true,
			"2026-06-10": true,
		});
	});
});
