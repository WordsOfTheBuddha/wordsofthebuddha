import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	categoryMatchesAllNonStopwordTerms,
	countCategoryNonStopwordTermMatches,
	getCategoryCombinedSearchText,
	supplementCategoryFuseResults,
} from "./searchRanking";

const cloudSimiles = [
	{
		slug: "rainless-cloud",
		title: "Rainless Cloud",
		type: "simile" as const,
	},
	{
		slug: "cloud-that-rains-everywhere",
		title: "Cloud That Rains Everywhere",
		type: "simile" as const,
	},
	{
		slug: "cloud-that-rains-in-a-certain-area",
		title: "Cloud That Rains in a Certain Area",
		type: "simile" as const,
	},
];

describe("category multi-term matching", () => {
	it("matches rain and cloud in each cloud simile title regardless of order", () => {
		for (const item of cloudSimiles) {
			assert.ok(
				categoryMatchesAllNonStopwordTerms(item, "rain cloud"),
				item.title,
			);
			assert.ok(
				categoryMatchesAllNonStopwordTerms(item, "cloud rain"),
				item.title,
			);
		}
	});

	it("counts prefix boundary matches (rain in rainless / rains)", () => {
		const text = getCategoryCombinedSearchText(cloudSimiles[0]);
		const rainCloud = countCategoryNonStopwordTermMatches(text, [
			"rain",
			"cloud",
		]);
		assert.equal(rainCloud.count, 2);

		const rainsText = getCategoryCombinedSearchText(cloudSimiles[1]);
		const cloudRain = countCategoryNonStopwordTermMatches(rainsText, [
			"cloud",
			"rain",
		]);
		assert.equal(cloudRain.count, 2);
	});

	it("supplements Fuse results with order-agnostic all-term hits", () => {
		const fuseOnlyRainless = supplementCategoryFuseResults(
			[
				{
					item: cloudSimiles[0],
					score: 0.27,
					refIndex: 0,
				},
			],
			cloudSimiles,
			"rain cloud",
		);
		assert.equal(fuseOnlyRainless.length, 3);
		assert.deepEqual(
			fuseOnlyRainless.map((r) => r.item.slug).sort(),
			cloudSimiles.map((s) => s.slug).sort(),
		);

		const fuseOnlyRaining = supplementCategoryFuseResults(
			[
				{
					item: cloudSimiles[1],
					score: 0.4,
					refIndex: 0,
				},
				{
					item: cloudSimiles[2],
					score: 0.5,
					refIndex: 1,
				},
			],
			cloudSimiles,
			"cloud rain",
		);
		assert.equal(fuseOnlyRaining.length, 3);
		assert.ok(
			fuseOnlyRaining.some((r) => r.item.slug === "rainless-cloud"),
		);
	});
});
