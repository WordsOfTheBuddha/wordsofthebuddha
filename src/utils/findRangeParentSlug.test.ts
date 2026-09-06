import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findRangeParentSlug } from "./referenceSegmentParser";

const routes = ["dhp1-20", "dhp21-32", "an1.1-10", "an1.11-20", "mn10", "dn15"];

describe("findRangeParentSlug", () => {
	it("maps a Dhp verse to its chapter file", () => {
		assert.equal(findRangeParentSlug("dhp2", routes), "dhp1-20");
		assert.equal(findRangeParentSlug("dhp21", routes), "dhp21-32");
	});

	it("maps an AN sutta to its grouped file", () => {
		assert.equal(findRangeParentSlug("an1.1", routes), "an1.1-10");
		assert.equal(findRangeParentSlug("an1.15", routes), "an1.11-20");
	});

	it("returns undefined for a file slug or a miss", () => {
		assert.equal(findRangeParentSlug("dhp1-20", routes), undefined);
		assert.equal(findRangeParentSlug("mn10", routes), undefined);
		assert.equal(findRangeParentSlug("mn999", routes), undefined);
	});
});
