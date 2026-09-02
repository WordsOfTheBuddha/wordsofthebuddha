import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	categoryMatchesAllNonStopwordTerms,
	countCategoryNonStopwordTermMatches,
	getCategoryCombinedSearchText,
	getNonStopwordTerms,
	rankResultsWithDiversity,
	SCORE,
	slugMatchesQuery,
	sortPtsMatchResults,
	supplementCategoryFuseResults,
	tokenizeQuery,
	type ScoredResult,
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

describe("slugMatchesQuery numeric ID tokens", () => {
	it("treats MN 10 as exact mn10, not a prefix of mn100", () => {
		assert.equal(slugMatchesQuery("mn10", "MN 10"), "exact");
		assert.equal(slugMatchesQuery("mn10", "mn10"), "exact");
		assert.equal(slugMatchesQuery("mn100", "MN 10"), "none");
		assert.equal(slugMatchesQuery("mn101", "mn10"), "none");
		assert.equal(slugMatchesQuery("mn11", "mn1"), "none");
	});

	it("keeps collection+number prefixes at segment boundaries", () => {
		assert.equal(slugMatchesQuery("an6.1", "AN6"), "prefix");
		assert.equal(slugMatchesQuery("an6.12", "an6.1"), "prefix");
		assert.equal(slugMatchesQuery("an60", "an6"), "none");
		assert.equal(slugMatchesQuery("an6.2", "an6.1"), "none");
	});

	it("matches numeral-only IDs against the numeric tail", () => {
		assert.equal(slugMatchesQuery("sn36.3", "36.3"), "exact");
		assert.equal(slugMatchesQuery("sn36.31", "36.3"), "prefix");
		assert.equal(slugMatchesQuery("mn10", "10"), "exact");
		assert.equal(slugMatchesQuery("sn10.1", "10"), "prefix");
		assert.equal(slugMatchesQuery("mn100", "10"), "none");
		assert.equal(slugMatchesQuery("an4.41", "4.41"), "exact");
	});

	it("treats range discourse files as exact for values inside the span", () => {
		assert.equal(slugMatchesQuery("an1.1-10", "1.1"), "exact");
		assert.equal(slugMatchesQuery("an1.1-10", "1.8"), "exact");
		assert.equal(slugMatchesQuery("an1.1-10", "1.10"), "exact");
		assert.equal(slugMatchesQuery("an1.1-10", "an1.8"), "exact");
		assert.equal(slugMatchesQuery("an1.1-10", "1.11"), "none");
		assert.equal(slugMatchesQuery("an1.1-10", "sn1.8"), "none");
	});
});

describe("tokenizeQuery discourse IDs", () => {
	it("collapses spaced IDs to a single token", () => {
		assert.deepEqual(tokenizeQuery("MN 10"), [
			{ term: "mn10", isStopword: false },
		]);
		assert.deepEqual(getNonStopwordTerms("mn 10"), ["mn10"]);
		assert.deepEqual(tokenizeQuery("36. 3"), [
			{ term: "36.3", isStopword: false },
		]);
	});

	it("does not collapse non-ID phrases", () => {
		assert.deepEqual(getNonStopwordTerms("radical attention"), [
			"radical",
			"attention",
		]);
	});
});

function ptsResult(
	slug: string,
	priority: number,
): ScoredResult {
	return {
		type: "discourse",
		score: 100,
		item: { slug, ptsMatch: true },
		priority,
		nonStopwordMatches: 1,
	};
}

describe("PTS citation ranking", () => {
	it("sorts ptsMatch hits by discourse ID, not lexicographic or priority", () => {
		const shuffled = [
			ptsResult("mn10", 5),
			ptsResult("mn1", 1),
			ptsResult("mn2", 9),
		];
		assert.deepEqual(
			sortPtsMatchResults(shuffled).map((r) => r.item.slug),
			["mn1", "mn2", "mn10"],
		);
	});

	it("skips diversity ranking so PTS volume listings stay in ID order", () => {
		const shuffled = [
			ptsResult("mn10", 5),
			ptsResult("mn1", 1),
			ptsResult("mn2", 9),
			{
				type: "topic-quality" as const,
				score: 90,
				item: { slug: "mindfulness", title: "Mindfulness" },
			},
		];
		const ranked = rankResultsWithDiversity(shuffled);
		assert.deepEqual(
			ranked.map((r) => r.item.slug),
			["mn1", "mn2", "mn10", "mindfulness"],
		);
	});
});

describe("reference-only penalty", () => {
	it("is less than a tier and more than a tiebreak", () => {
		assert.equal(SCORE.DISCOURSE_REFERENCE_ONLY_PENALTY, 8);
		const exactNative = SCORE.DISCOURSE_EXACT_TITLE;
		const exactRef =
			SCORE.DISCOURSE_EXACT_TITLE - SCORE.DISCOURSE_REFERENCE_ONLY_PENALTY;
		assert.ok(exactNative - exactRef < 20);
		assert.ok(exactRef > SCORE.DISCOURSE_CONTENT_WHOLE_WORD_BASE);
		assert.ok(exactRef > SCORE.MIN_SCORE);
	});

	it("keeps similar-match references below native category exacts", () => {
		const similarRef =
			SCORE.DISCOURSE_PREFIX_TITLE - SCORE.DISCOURSE_REFERENCE_ONLY_PENALTY;
		assert.ok(similarRef < SCORE.CATEGORY_EXACT_TITLE);
		assert.ok(similarRef < SCORE.CATEGORY_WORD_EXACT_TITLE);
	});
});
