import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	activityTime,
	buildRecentFeeds,
	collectionFromEnglishPath,
	filterRecentDiscourses,
	isEnglishDiscoursePath,
	parseRecentFilters,
	recentSummary,
	type RecentDiscourseRecord,
} from "./recentDiscourses";

const now = new Date("2026-09-01T12:00:00.000Z");

function record(
	partial: Partial<RecentDiscourseRecord> & Pick<RecentDiscourseRecord, "slug">,
): RecentDiscourseRecord {
	return {
		title: partial.title ?? partial.slug,
		description: partial.description ?? "A discourse.",
		collection: partial.collection ?? "sn",
		added: partial.added ?? now,
		modified: partial.modified ?? partial.added ?? now,
		volpage: partial.volpage,
		...partial,
		slug: partial.slug,
	};
}

describe("isEnglishDiscoursePath", () => {
	it("accepts nikāya mdx under src/content/en", () => {
		assert.equal(
			isEnglishDiscoursePath("src/content/en/sn/sn22.100.mdx"),
			true,
		);
	});

	it("rejects the homepage, anthologies, and non-mdx", () => {
		assert.equal(isEnglishDiscoursePath("src/content/en/index.mdx"), false);
		assert.equal(
			isEnglishDiscoursePath(
				"src/content/en/anthologies/in-the-buddhas-words.mdx",
			),
			false,
		);
		assert.equal(
			isEnglishDiscoursePath("src/content/en/dn/dn21.matches.json"),
			false,
		);
		assert.equal(isEnglishDiscoursePath("src/content/pli/sn/sn22.100.md"), false);
	});
});

describe("collectionFromEnglishPath", () => {
	it("reads the nikāya folder, falling back to the slug", () => {
		assert.equal(
			collectionFromEnglishPath("src/content/en/mn/mn115.mdx", "mn115"),
			"mn",
		);
		assert.equal(collectionFromEnglishPath("", "an4.189"), "an");
	});
});

describe("buildRecentFeeds", () => {
	it("lists newly added files separately from later updates", () => {
		const items = buildRecentFeeds(
			[
				record({
					slug: "sn22.100",
					added: new Date("2026-08-31T10:00:00.000Z"),
					modified: new Date("2026-08-31T11:00:00.000Z"),
				}),
				record({
					slug: "mn22",
					collection: "mn",
					added: new Date("2025-01-01T00:00:00.000Z"),
					modified: new Date("2026-08-20T00:00:00.000Z"),
				}),
			],
			now,
			{ newLimit: 1 },
		);
		assert.deepEqual(
			items.map((item) => `${item.kind}:${item.slug}`),
			["new:sn22.100", "updated:mn22"],
		);
	});

	it("keeps a recently added file in the new feed even after a same-day edit", () => {
		const items = buildRecentFeeds(
			[
				record({
					slug: "mn115",
					collection: "mn",
					added: new Date("2026-08-31T02:00:00.000Z"),
					modified: new Date("2026-08-31T18:00:00.000Z"),
				}),
			],
			now,
		);
		assert.deepEqual(
			items.map((item) => item.kind),
			["new"],
		);
	});

	it("treats files with no added date as updates", () => {
		const items = buildRecentFeeds(
			[
				record({
					slug: "dn16",
					collection: "dn",
					added: null,
					modified: new Date("2026-08-15T00:00:00.000Z"),
				}),
			],
			now,
		);
		assert.equal(items.length, 1);
		assert.equal(items[0]?.kind, "updated");
		assert.equal(items[0]?.slug, "dn16");
	});
});

describe("filterRecentDiscourses", () => {
	const feed = buildRecentFeeds(
		[
			record({
				slug: "sn47.42",
				added: new Date("2026-08-28T00:00:00.000Z"),
			}),
			record({
				slug: "an4.189",
				collection: "an",
				added: new Date("2026-08-20T00:00:00.000Z"),
			}),
			record({
				slug: "mn10",
				collection: "mn",
				added: new Date("2025-01-01T00:00:00.000Z"),
				modified: new Date("2026-08-25T00:00:00.000Z"),
			}),
			record({
				slug: "dn22",
				collection: "dn",
				added: new Date("2024-01-01T00:00:00.000Z"),
				modified: new Date("2026-07-01T00:00:00.000Z"),
			}),
		],
		now,
		{ newLimit: 2 },
	);

	it("defaults to a top-20 new feed", () => {
		const items = filterRecentDiscourses(
			feed,
			{ kind: "new", range: "20", collection: "all" },
			now,
		);
		assert.deepEqual(
			items.map((item) => item.slug),
			["sn47.42", "an4.189"],
		);
		assert.ok(activityTime(items[0]!) >= activityTime(items[1]!));
	});

	it("filters by collection and 30-day window", () => {
		const items = filterRecentDiscourses(
			feed,
			{ kind: "new", range: "30d", collection: "an" },
			now,
		);
		assert.deepEqual(
			items.map((item) => item.slug),
			["an4.189"],
		);
	});

	it("shows updates without mixing in newly added files", () => {
		const items = filterRecentDiscourses(
			feed,
			{ kind: "updated", range: "90d", collection: "all" },
			now,
		);
		assert.deepEqual(
			items.map((item) => item.slug),
			["mn10", "dn22"],
		);
	});
});

describe("parseRecentFilters", () => {
	it("reads kind, range, and collection from query params", () => {
		assert.deepEqual(
			parseRecentFilters(
				new URLSearchParams("kind=updated&range=30d&col=mn"),
			),
			{ kind: "updated", range: "30d", collection: "mn" },
		);
	});

	it("falls back to the default new / last-20 feed", () => {
		assert.deepEqual(parseRecentFilters(new URLSearchParams()), {
			kind: "new",
			range: "20",
			collection: "all",
		});
	});
});

describe("recentSummary", () => {
	it("names the active kind", () => {
		assert.equal(
			recentSummary(20, {
				kind: "new",
				range: "20",
				collection: "all",
			}),
			"20 newly added discourses",
		);
		assert.equal(
			recentSummary(1, {
				kind: "updated",
				range: "30d",
				collection: "sn",
			}),
			"1 recently updated discourse",
		);
	});
});
