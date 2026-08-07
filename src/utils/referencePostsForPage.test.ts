import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getReferencePostsForDiscourseScopes,
	getReferencePostsForTag,
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
});
