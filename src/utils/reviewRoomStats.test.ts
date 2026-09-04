import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AiAskSessionEntry } from "./aiAskSession";
import {
	computeCanonCoverage,
	discoursesReadLabel,
	expandReadSlugs,
	formatMinutesAgo,
	normalizeDiscourseSlug,
	oldestPending,
	orderAsksForReview,
} from "./reviewRoomStats";

const catalog = [
	{ slug: "dn1", collection: "dn" },
	{ slug: "dn2", collection: "dn" },
	{ slug: "mn1", collection: "mn" },
	{ slug: "mn10", collection: "mn" },
	{ slug: "mn22", collection: "mn" },
	{ slug: "sn12.1", collection: "sn" },
	{ slug: "dhp1", collection: "dhp" },
	{ slug: "dhp2", collection: "dhp" },
	{ slug: "dhp3", collection: "dhp" },
];

describe("normalizeDiscourseSlug", () => {
	it("strips rewrite prefixes and query strings", () => {
		assert.equal(normalizeDiscourseSlug("/discourse-ssr/an3.1"), "an3.1");
		assert.equal(
			normalizeDiscourseSlug("discourse-sujato/mn10?ref=true"),
			"mn10",
		);
		assert.equal(normalizeDiscourseSlug("mn10"), "mn10");
	});
});

describe("expandReadSlugs", () => {
	it("expands range files and rewrite paths", () => {
		assert.deepEqual(expandReadSlugs(["dhp1-3", "discourse-ssr/mn10"]).sort(), [
			"dhp1",
			"dhp2",
			"dhp3",
			"mn10",
		]);
	});
});

describe("discoursesReadLabel", () => {
	it("formats the total-read stat", () => {
		assert.equal(discoursesReadLabel(0), "");
		assert.equal(discoursesReadLabel(1), "1 discourse read");
		assert.equal(discoursesReadLabel(33), "33 discourses read");
	});
});

describe("computeCanonCoverage", () => {
	it("counts read discourses per collection in Review Room order", () => {
		const coverage = computeCanonCoverage(
			["sn12.1", "mn10", "mn1"],
			catalog,
		);
		assert.deepEqual(
			coverage.rows.map((row) => [row.label, row.read, row.total]),
			[
				["Dhp", 0, 3],
				["DN", 0, 2],
				["MN", 2, 3],
				["SN", 1, 1],
			],
		);
		assert.equal(coverage.rows[2]?.href, "/mn");
		assert.equal(coverage.rows[2]?.title, "Middle Length Discourses");
		assert.equal(coverage.rows[2]?.percent, 67);
		assert.equal(coverage.rows[3]?.percent, 100);
		assert.equal(coverage.rows[0]?.percent, 0);
		assert.equal(coverage.totalRead, 3);
		assert.equal(coverage.totalAvailable, 9);
	});

	it("counts expanded range reads against expanded catalog ids", () => {
		const coverage = computeCanonCoverage(["dhp1-3"], catalog);
		assert.equal(coverage.totalRead, 3);
		assert.equal(coverage.rows[0]?.label, "Dhp");
		assert.equal(coverage.rows[0]?.read, 3);
		assert.equal(coverage.rows[0]?.total, 3);
	});

	it("ignores slugs that are not discourses in the catalog", () => {
		const coverage = computeCanonCoverage(
			["in-the-buddhas-words", "mn999", "dn1"],
			catalog,
		);
		assert.equal(coverage.totalRead, 1);
		assert.deepEqual(
			coverage.rows
				.filter((row) => row.read > 0)
				.map((row) => row.collection),
			["dn"],
		);
	});

	it("never shows an empty bar for a collection with at least one read", () => {
		const big = Array.from({ length: 1000 }, (_, i) => ({
			slug: `an${i}`,
			collection: "an",
		}));
		const coverage = computeCanonCoverage(["an1"], big);
		const anRow = coverage.rows.find((row) => row.collection === "an");
		assert.equal(anRow?.percent, 1);
	});

	it("lists every readable collection, including those with no reads yet", () => {
		const coverage = computeCanonCoverage([], catalog);
		assert.deepEqual(
			coverage.rows.map((row) => [row.collection, row.read, row.total]),
			[
				["dhp", 0, 3],
				["dn", 0, 2],
				["mn", 0, 3],
				["sn", 0, 1],
			],
		);
		assert.equal(coverage.totalRead, 0);
		assert.equal(coverage.totalAvailable, 9);
	});
});

describe("oldestPending", () => {
	it("picks the smallest timestamp and skips junk", () => {
		assert.deepEqual(
			oldestPending({ mn1: 500, "sn12.1": 120, bad: "x", dn1: 300 }),
			{ slug: "sn12.1", minutes: 120 },
		);
	});

	it("handles empty maps", () => {
		assert.equal(oldestPending({}), null);
		assert.equal(oldestPending(undefined), null);
	});
});

describe("formatMinutesAgo", () => {
	const now = Date.UTC(2026, 8, 3, 12, 0, 0);
	const minutesAt = (daysAgo: number) =>
		Math.floor((now - daysAgo * 24 * 60 * 60_000) / 60_000);

	it("uses coarse day-based buckets", () => {
		assert.equal(formatMinutesAgo(minutesAt(0), now), "today");
		assert.equal(formatMinutesAgo(minutesAt(1), now), "yesterday");
		assert.equal(formatMinutesAgo(minutesAt(5), now), "5 days ago");
		assert.equal(formatMinutesAgo(minutesAt(13), now), "13 days ago");
		assert.equal(formatMinutesAgo(minutesAt(14), now), "2 weeks ago");
		assert.equal(formatMinutesAgo(minutesAt(45), now), "6 weeks ago");
		assert.equal(formatMinutesAgo(minutesAt(70), now), "2 months ago");
		assert.equal(formatMinutesAgo(minutesAt(400), now), "1 year ago");
	});

	it("returns empty for invalid input", () => {
		assert.equal(formatMinutesAgo(0, now), "");
		assert.equal(formatMinutesAgo(Number.NaN, now), "");
	});
});

describe("orderAsksForReview", () => {
	const entry = (
		question: string,
		at: number,
		saved = false,
	): AiAskSessionEntry => ({
		question,
		lookingFor: "",
		queries: [],
		fallbackQueries: [],
		offTopic: false,
		results: [],
		model: "",
		reasoning: "",
		at,
		saved,
	});

	it("puts pinned asks first, then newest first", () => {
		const ordered = orderAsksForReview([
			entry("old", 1),
			entry("new", 3),
			entry("pinned-old", 2, true),
		]);
		assert.deepEqual(
			ordered.map((item) => item.question),
			["pinned-old", "new", "old"],
		);
	});
});
