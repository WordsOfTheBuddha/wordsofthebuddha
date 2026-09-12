import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hideBreadcrumbsForPath } from "./breadcrumbVisibility";

describe("hideBreadcrumbsForPath", () => {
	it("hides search, ask home, and shared ask pages", () => {
		assert.equal(hideBreadcrumbsForPath("/search"), true);
		assert.equal(hideBreadcrumbsForPath("/ask"), true);
		assert.equal(hideBreadcrumbsForPath("/research"), true);
		assert.equal(hideBreadcrumbsForPath("/ask/mindfulness-of-the-body"), true);
		assert.equal(hideBreadcrumbsForPath("/research/yonisomanasikara"), true);
		assert.equal(hideBreadcrumbsForPath("/shared-ask/auspiciousness-and-full-moon"), true);
		assert.equal(hideBreadcrumbsForPath("/mn10"), false);
		assert.equal(hideBreadcrumbsForPath("/person"), true);
		assert.equal(hideBreadcrumbsForPath("/on/sariputta"), false);
	});
});
