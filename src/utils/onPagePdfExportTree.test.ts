import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortDiscourseIds } from "./discourseSort";
import {
	buildOnPagePdfExportTree,
	flattenOnPageExportSlugs,
} from "./onPagePdfExportTree";

const editorialPageOrder = [
	{ id: "dn15", title: "Mahānidāna" },
	{ id: "mn2", title: "Sabbāsava" },
	{ id: "sn12.23", title: "Upanisa" },
	{ id: "mn43", title: "Mahāvedalla" },
	{ id: "an3.61", title: "Titthāyatana" },
];

describe("buildOnPagePdfExportTree", () => {
	it("keeps mapping/page order instead of collection-priority or alphabetic sort", () => {
		const tree = buildOnPagePdfExportTree(
			"radical-attention",
			"Radical Attention",
			editorialPageOrder,
			[],
		);
		assert.ok(tree);
		const slugs = flattenOnPageExportSlugs(tree);
		assert.deepEqual(
			slugs,
			["dn15", "mn2", "sn12.23", "mn43", "an3.61"],
			"export spine must follow the /on page mapping array",
		);
		assert.notDeepEqual(
			slugs,
			sortDiscourseIds(slugs),
			"collection-priority sort would put MN before DN before SN",
		);
		const alpha = [...slugs].sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true }),
		);
		assert.notDeepEqual(slugs, alpha);
	});

	it("appends reference discourses after curated, still without re-sorting", () => {
		const tree = buildOnPagePdfExportTree(
			"radical-attention",
			"Radical Attention",
			editorialPageOrder,
			[
				{
					slug: "mn1",
					title: "Mūlapariyāya",
					description: "reference",
				},
				{
					slug: "dn1",
					title: "Brahmajāla",
					description: "reference",
				},
			],
		);
		assert.ok(tree);
		assert.deepEqual(flattenOnPageExportSlugs(tree), [
			"dn15",
			"mn2",
			"sn12.23",
			"mn43",
			"an3.61",
			"mn1",
			"dn1",
		]);
		assert.equal(
			tree.chapters[0].discourses.find((d) => d.slug === "mn1")
				?.isReference,
			true,
		);
	});
});
