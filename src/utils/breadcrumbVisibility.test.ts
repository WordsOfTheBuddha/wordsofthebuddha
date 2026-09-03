import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hideBreadcrumbsForPath } from "./breadcrumbVisibility";

describe("hideBreadcrumbsForPath", () => {
	it("hides search, ask home, and shared ask pages", () => {
		assert.equal(hideBreadcrumbsForPath("/search"), true);
		assert.equal(hideBreadcrumbsForPath("/ask"), true);
		assert.equal(hideBreadcrumbsForPath("/ask/mindfulness-of-the-body"), true);
		assert.equal(hideBreadcrumbsForPath("/shared-ask/auspiciousness-and-full-moon"), true);
		assert.equal(hideBreadcrumbsForPath("/mn10"), false);
	});
});
