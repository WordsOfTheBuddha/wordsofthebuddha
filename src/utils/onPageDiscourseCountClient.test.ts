import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	discourseCountForRefMode,
	formatDiscourseCountLabel,
} from "./onPageDiscourseCountClient";

describe("onPageDiscourseCountClient", () => {
	it("includes reference discourses only when ref mode is on", () => {
		assert.equal(discourseCountForRefMode(26, 90, false), 26);
		assert.equal(discourseCountForRefMode(26, 90, true), 116);
	});

	it("formats singular and plural labels", () => {
		assert.equal(formatDiscourseCountLabel(1), "1 discourse");
		assert.equal(formatDiscourseCountLabel(26), "26 discourses");
	});
});
