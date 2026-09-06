import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAddedItems,
	collectionFromEnglishPath,
	filterRecentDiscourses,
	isEnglishDiscourseEntry,
	isEnglishDiscoursePath,
	mergeDiscourseAdditions,
	parseDiscourseAdditions,
	parseRecentFilters,
	recentSummary,
	serializeDiscourseAdditions,
	slugFromEnglishPath,
	type DiscourseMeta,
} from "./recentDiscourses";

const now = new Date("2026-09-01T12:00:00.000Z");

function meta(
	partial: Partial<DiscourseMeta> & Pick<DiscourseMeta, "slug">,
): DiscourseMeta {
	return {
		title: partial.title ?? partial.slug,
		description: partial.description ?? "A discourse.",
		collection: partial.collection ?? "sn",
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

describe("isEnglishDiscourseEntry", () => {
	it("uses filePath when present", () => {
		assert.equal(
			isEnglishDiscourseEntry({
				filePath: "src/content/en/sn/sn22.100.mdx",
				id: "sn/sn22.100",
			}),
			true,
		);
		assert.equal(
			isEnglishDiscourseEntry({
				filePath: "src/content/en/index.mdx",
				id: "index",
			}),
			false,
		);
	});

	it("falls back to glob-loader ids when filePath is missing", () => {
		assert.equal(isEnglishDiscourseEntry({ id: "sn/sn22.100" }), true);
		assert.equal(isEnglishDiscourseEntry({ id: "index" }), false);
		assert.equal(
			isEnglishDiscourseEntry({ id: "anthologies/in-the-buddhas-words" }),
			false,
		);
		assert.equal(isEnglishDiscourseEntry({ id: "books/some-book" }), false);
		assert.equal(isEnglishDiscourseEntry({}), false);
	});
});

describe("parseDiscourseAdditions", () => {
	it("keeps string dates and drops junk", () => {
		assert.deepEqual(
			parseDiscourseAdditions({
				mn10: "2026-08-20T00:00:00.000Z",
				bad: 1,
				empty: "",
			}),
			{ mn10: "2026-08-20T00:00:00.000Z" },
		);
		assert.deepEqual(parseDiscourseAdditions(null), {});
		assert.deepEqual(parseDiscourseAdditions([]), {});
	});
});

describe("slugFromEnglishPath", () => {
	it("uses the mdx filename", () => {
		assert.equal(
			slugFromEnglishPath("src/content/en/mn/mn115.mdx"),
			"mn115",
		);
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

describe("mergeDiscourseAdditions", () => {
	it("keeps existing dates and only records dates for new slugs", () => {
		const merged = mergeDiscourseAdditions(
			{ mn10: "2024-01-01T00:00:00.000Z" },
			["mn10", "sn22.100"],
			{
				mn10: "2026-08-01T00:00:00.000Z",
				"sn22.100": "2026-08-31T10:00:00.000Z",
			},
			"2026-09-01T12:00:00.000Z",
		);
		assert.deepEqual(merged, {
			mn10: "2024-01-01T00:00:00.000Z",
			"sn22.100": "2026-08-31T10:00:00.000Z",
		});
	});

	it("drops slugs whose files are gone and falls back when undiscovered", () => {
		const merged = mergeDiscourseAdditions(
			{ old: "2024-01-01T00:00:00.000Z" },
			["dn21"],
			{},
			"2026-09-01T12:00:00.000Z",
		);
		assert.deepEqual(merged, {
			dn21: "2026-09-01T12:00:00.000Z",
		});
	});
});

describe("serializeDiscourseAdditions", () => {
	it("writes slug-sorted UTC JSON with a trailing newline", () => {
		assert.equal(
			serializeDiscourseAdditions({
				sn1: "2026-02-01T00:00:00+05:30",
				an1: "2026-01-01T00:00:00.000Z",
			}),
			`${JSON.stringify(
				{
					an1: "2026-01-01T00:00:00.000Z",
					sn1: "2026-01-31T18:30:00.000Z",
				},
				null,
				2,
			)}\n`,
		);
	});
});

describe("buildAddedItems", () => {
	it("joins additions to discourse metadata and sorts newest first", () => {
		const items = buildAddedItems(
			[
				meta({ slug: "mn10", collection: "mn" }),
				meta({ slug: "sn22.100" }),
				meta({ slug: "dn16", collection: "dn" }),
			],
			{
				mn10: "2026-08-20T00:00:00.000Z",
				"sn22.100": "2026-08-31T10:00:00.000Z",
			},
		);
		assert.deepEqual(
			items.map((item) => item.slug),
			["sn22.100", "mn10"],
		);
		assert.equal(items[0]?.added, "2026-08-31T10:00:00.000Z");
	});
});

describe("filterRecentDiscourses", () => {
	const feed = buildAddedItems(
		[
			meta({ slug: "sn47.42" }),
			meta({ slug: "an4.189", collection: "an" }),
			meta({ slug: "mn10", collection: "mn" }),
			meta({ slug: "dn22", collection: "dn" }),
		],
		{
			"sn47.42": "2026-08-28T00:00:00.000Z",
			"an4.189": "2026-08-20T00:00:00.000Z",
			mn10: "2026-07-15T00:00:00.000Z",
			dn22: "2025-01-01T00:00:00.000Z",
		},
	);

	it("defaults to a top-20 feed", () => {
		const items = filterRecentDiscourses(
			feed,
			{ range: "20", collection: "all" },
			now,
		);
		assert.deepEqual(
			items.map((item) => item.slug),
			["sn47.42", "an4.189", "mn10", "dn22"],
		);
	});

	it("filters by collection and 30-day window", () => {
		const items = filterRecentDiscourses(
			feed,
			{ range: "30d", collection: "an" },
			now,
		);
		assert.deepEqual(
			items.map((item) => item.slug),
			["an4.189"],
		);
	});

	it("does not treat later edits as additions", () => {
		assert.equal(
			feed.some((item) => item.slug === "dn22" && item.added.startsWith("2026")),
			false,
		);
	});
});

describe("parseRecentFilters", () => {
	it("reads range and collection from query params", () => {
		assert.deepEqual(
			parseRecentFilters(new URLSearchParams("range=30d&col=mn")),
			{ range: "30d", collection: "mn" },
		);
	});

	it("falls back to the default last-20 feed", () => {
		assert.deepEqual(parseRecentFilters(new URLSearchParams("kind=updated")), {
			range: "20",
			collection: "all",
		});
	});
});

describe("recentSummary", () => {
	it("names the collection when filtered", () => {
		assert.equal(
			recentSummary(20, {
				range: "20",
				collection: "all",
			}),
			"20 newly added discourses",
		);
		assert.equal(
			recentSummary(1, {
				range: "30d",
				collection: "sn",
			}),
			"1 newly added SN discourse",
		);
	});
});
