import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyLearningFlush,
	countLearningDays,
	currentLearningStreak,
	currentLearningStreakLabel,
	shouldShowLearningStreak,
	formatLearningDayDate,
	groupLearningDayStrip,
	learningDayDetailLabel,
	learningDayEmphasis,
	learningDayStripForDisplay,
	LEARNING_DAY_STRIP_LENGTH,
	learningDaysFromReadMinutes,
	learningDaysLabel,
	learningDaysStatKind,
	learningDaysStatUnit,
	localDayKey,
	mergeLearningDays,
	overviewLearningDayStrip,
	readsByDayFromReadMinutes,
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
		assert.equal(learningDaysLabel(1), "Learning on 1 day");
		assert.equal(learningDaysLabel(12), "Learning on 12 days");
		assert.equal(learningDaysStatKind(), "Learning");
		assert.equal(learningDaysStatUnit(), "days");
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

	it("defaults to 30 days grouped into even rows of 10", () => {
		const strip = recentLearningDayStrip({}, undefined, "2026-09-03");
		assert.equal(strip.length, LEARNING_DAY_STRIP_LENGTH);
		const rows = groupLearningDayStrip(strip);
		assert.equal(rows.length, 3);
		assert.ok(rows.every((row) => row.length === 10));
		assert.equal(rows[0]?.[0]?.key, "2026-08-05");
		assert.equal(rows[2]?.[9]?.key, "2026-09-03");
	});
});

describe("learningDayStripForDisplay", () => {
	it("left-aligns a suffix streak (new or returning reader)", () => {
		const strip = recentLearningDayStrip(
			{ "2026-09-02": true, "2026-09-03": true },
			7,
			"2026-09-03",
		);
		const display = learningDayStripForDisplay(strip);
		assert.equal(display[0]?.active, true);
		assert.equal(display[1]?.active, true);
		assert.equal(display[0]?.key, "2026-09-02");
		assert.equal(display[1]?.key, "2026-09-03");
		assert.ok(display.slice(2).every((dot) => !dot.active));
	});

	it("keeps chronological gaps when activity is not a trailing suffix", () => {
		const strip = recentLearningDayStrip(
			{ "2026-09-01": true, "2026-09-03": true },
			7,
			"2026-09-03",
		);
		const display = learningDayStripForDisplay(strip);
		assert.deepEqual(
			display.filter((dot) => dot.active).map((dot) => dot.key),
			["2026-09-01", "2026-09-03"],
		);
	});

	it("does not shift when the streak already starts at the beginning", () => {
		const strip = recentLearningDayStrip(
			{ "2026-08-28": true, "2026-08-30": true },
			7,
			"2026-09-03",
		);
		const display = learningDayStripForDisplay(strip);
		assert.deepEqual(display, strip);
	});
});

describe("readsByDayFromReadMinutes + emphasis", () => {
	it("counts discourses per local day", () => {
		const dayA = Date.UTC(2026, 0, 1, 12) / 60_000;
		const dayA2 = Date.UTC(2026, 0, 1, 18) / 60_000;
		const dayB = Date.UTC(2026, 0, 3, 18) / 60_000;
		const counts = readsByDayFromReadMinutes(
			{ mn10: dayA, mn11: dayA2, "sn12.1": dayB, bad: "x" },
			(ms) => new Date(ms).toISOString().slice(0, 10),
		);
		assert.equal(counts["2026-01-01"], 2);
		assert.equal(counts["2026-01-03"], 1);
	});

	it("counts each discourse once, using the earliest stamp", () => {
		const first = Date.UTC(2026, 0, 1, 12) / 60_000;
		const later = Date.UTC(2026, 0, 3, 12) / 60_000;
		const counts = readsByDayFromReadMinutes(
			{ mn10: first, "/mn10": later, MN10: later },
			(ms) => new Date(ms).toISOString().slice(0, 10),
		);
		assert.equal(counts["2026-01-01"], 1);
		assert.equal(counts["2026-01-03"], undefined);
	});

	it("expands a leftover range key into one count per discourse", () => {
		const day = Date.UTC(2026, 0, 1, 12) / 60_000;
		const counts = readsByDayFromReadMinutes(
			{ "dhp1-3": day, dhp2: day },
			(ms) => new Date(ms).toISOString().slice(0, 10),
		);
		assert.equal(counts["2026-01-01"], 3);
	});

	it("maps read counts onto emphasis levels", () => {
		assert.equal(learningDayEmphasis({ active: false, reads: 0 }), "none");
		assert.equal(learningDayEmphasis({ active: true, reads: 0 }), "some");
		assert.equal(learningDayEmphasis({ active: true, reads: 2 }), "some");
		assert.equal(learningDayEmphasis({ active: true, reads: 3 }), "more");
		assert.equal(learningDayEmphasis({ active: true, reads: 9 }), "more");
		assert.equal(learningDayEmphasis({ active: true, reads: 10 }), "most");
	});

	it("formats hover copy with reads and listen minutes", () => {
		const label = learningDayDetailLabel({
			key: "2026-09-03",
			active: true,
			reads: 6,
			listenSeconds: 15 * 60,
		});
		assert.match(label, /6 discourses read, 15 mins listened/);
		assert.match(formatLearningDayDate("2026-09-03"), /3 Sep/);

		assert.equal(
			learningDayDetailLabel({
				key: "2026-09-03",
				active: false,
				reads: 0,
				listenSeconds: 0,
			}),
			"",
		);
		assert.match(
			learningDayDetailLabel({
				key: "2026-09-03",
				active: true,
				reads: 0,
				listenSeconds: 40,
			}),
			/Engaged with the teachings/,
		);
	});

	it("attaches activity onto the overview strip", () => {
		const strip = overviewLearningDayStrip(
			{ "2026-09-03": true },
			{ "2026-09-03": 4 },
			{ "2026-09-03": 120 },
			"2026-09-03",
		);
		const today = strip.find((dot) => dot.key === "2026-09-03");
		assert.equal(today?.active, true);
		assert.equal(today?.reads, 4);
		assert.equal(today?.listenSeconds, 120);
		assert.equal(learningDayEmphasis(today!), "more");
	});
});

describe("currentLearningStreak", () => {
	it("counts consecutive days ending today", () => {
		assert.equal(
			currentLearningStreak(
				{
					"2026-09-03": true,
					"2026-09-04": true,
					"2026-09-05": true,
				},
				"2026-09-05",
			),
			3,
		);
		assert.equal(currentLearningStreakLabel(3), "3-day streak");
		assert.equal(currentLearningStreakLabel(1), "1-day streak");
		assert.equal(shouldShowLearningStreak(1), false);
		assert.equal(shouldShowLearningStreak(2), true);
	});

	it("keeps yesterday's streak when today is still empty", () => {
		assert.equal(
			currentLearningStreak(
				{ "2026-09-03": true, "2026-09-04": true },
				"2026-09-05",
			),
			2,
		);
	});

	it("breaks on a gap", () => {
		assert.equal(
			currentLearningStreak(
				{ "2026-09-03": true, "2026-09-05": true },
				"2026-09-05",
			),
			1,
		);
		assert.equal(
			currentLearningStreak({ "2026-09-03": true }, "2026-09-05"),
			0,
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
