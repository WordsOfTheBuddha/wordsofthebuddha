import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DISCOURSE_LIST_PREVIEW_COUNT,
	MIN_THRESHOLD,
	discourseShowMoreLabel,
	shouldShowOnPageChrome,
} from "./discourseListPreview";

describe("discourse list chrome", () => {
	it("keeps filter and download off below MIN_THRESHOLD", () => {
		assert.equal(MIN_THRESHOLD, 5);
		assert.equal(shouldShowOnPageChrome(4), false);
		assert.equal(shouldShowOnPageChrome(5), true);
	});

	it("matches the explore Show More copy", () => {
		assert.equal(DISCOURSE_LIST_PREVIEW_COUNT, 3);
		assert.equal(discourseShowMoreLabel(3), "[+ Show More]");
		assert.equal(discourseShowMoreLabel(4), "[+ 1 discourse - Show More]");
		assert.equal(discourseShowMoreLabel(9), "[+ 6 discourses - Show More]");
	});
});
