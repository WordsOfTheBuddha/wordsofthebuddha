import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatVerseRangeLabel,
	getDhpVerseRangeFromSlug,
	getSnpVerseRange,
} from "./verseRanges";

describe("getSnpVerseRange", () => {
	it("returns hosted Metta sutta span", () => {
		assert.deepEqual(getSnpVerseRange("snp1.8"), {
			start: 143,
			end: 152,
		});
	});

	it("returns null for unknown / unhosted slugs", () => {
		assert.equal(getSnpVerseRange("snp3.9"), null);
	});
});

describe("getDhpVerseRangeFromSlug", () => {
	it("parses range and single-form slugs", () => {
		assert.deepEqual(getDhpVerseRangeFromSlug("dhp100-115"), {
			start: 100,
			end: 115,
		});
		assert.deepEqual(getDhpVerseRangeFromSlug("dhp1-20"), {
			start: 1,
			end: 20,
		});
	});
});

describe("format labels", () => {
	it("formats a verse span", () => {
		assert.equal(
			formatVerseRangeLabel({ start: 143, end: 152 }),
			"vv. 143–152",
		);
	});
});
