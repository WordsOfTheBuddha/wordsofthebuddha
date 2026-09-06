import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getReferencePostsForDiscourseScopes,
	getReferencePostsForTag,
	personOnPagePdfSplit,
	personPageShowsRefsByDefault,
	splitPersonOnPageDiscourses,
} from "./referencePostsForPage";

describe("referencePostsForPage", () => {
	it("book scope expands reference discourses within the same book", () => {
		const refs = getReferencePostsForDiscourseScopes(
			["sn47.29"],
			new Set(["sn47.29"]),
		);
		assert.ok(refs.length > 0);
		assert.ok(refs.every((entry) => entry.slug.startsWith("sn47.")));
	});

	it("attaches SC-style PTS volpage for reference card payloads", () => {
		const refs = getReferencePostsForDiscourseScopes(
			["sn47.29"],
			new Set(["sn47.29"]),
		);
		const withVol = refs.filter((entry) => entry.volpage);
		assert.ok(withVol.length > 0, "expected PTS citations on reference posts");
		assert.match(withVol[0].volpage!, /^PTS \d/);
		const parsed = JSON.parse(JSON.stringify(refs)) as typeof refs;
		assert.equal(
			parsed.find((entry) => entry.slug === withVol[0].slug)?.volpage,
			withVol[0].volpage,
		);
		assert.ok(
			parsed.some((entry) => entry.volpage),
			"collection JSON must keep volpage for dashed reference cards",
		);
	});

	it("matches hyphenated tag slugs to spaced quality labels", () => {
		const enIllWill = new Set([
			"mn2",
			"mn19",
			"mn39",
			"mn40",
			"mn41",
			"mn42",
			"mn46",
			"mn64",
			"mn106",
			"mn107",
			"sn42.6",
		]);
		const spaced = getReferencePostsForTag("ill will", enIllWill);
		const hyphenated = getReferencePostsForTag("ill-will", enIllWill);
		assert.equal(
			hyphenated.length,
			spaced.length,
			"ill-will and ill will should resolve the same refs",
		);
		assert.ok(hyphenated.length > 0, "expected reference discourses for ill will");
	});

	it("puts reference-only person discourses behind See Refs when EN exists", () => {
		const split = splitPersonOnPageDiscourses([
			{ id: "sn21.1", title: "Kolita sutta - Kolita" },
			{ id: "sn21.2", title: "Upatissa sutta - With Upatissa" },
		]);
		assert.deepEqual(
			split.curated.map((discourse) => discourse.id),
			["sn21.1"],
		);
		assert.deepEqual(
			split.referencePosts.map((post) => post.slug),
			["sn21.2"],
		);
		assert.equal(
			personPageShowsRefsByDefault(
				split.curated.length,
				split.referencePosts.length,
			),
			false,
		);
	});

	it("classifies Pali-only person discourses as references, including MN 35", () => {
		const split = splitPersonOnPageDiscourses([
			{
				id: "mn35",
				title: "Cūḷasaccaka sutta - The Shorter Discourse With Saccaka",
			},
			{ id: "sn22.88", title: "Assaji sutta - With Assaji" },
		]);
		assert.deepEqual(
			split.curated.map((discourse) => discourse.id),
			[],
		);
		assert.deepEqual(
			split.referencePosts.map((post) => post.slug),
			["mn35", "sn22.88"],
		);
		assert.equal(
			personPageShowsRefsByDefault(0, split.referencePosts.length),
			true,
		);
	});

	it("exports Pali-only person lists as the default PDF selection", () => {
		const pdf = personOnPagePdfSplit([
			{
				id: "mn35",
				title: "Cūḷasaccaka sutta - The Shorter Discourse With Saccaka",
			},
		]);
		assert.deepEqual(
			pdf.curated.map((discourse) => discourse.id),
			["mn35"],
		);
		assert.equal(pdf.referencePosts.length, 0);
	});
});
