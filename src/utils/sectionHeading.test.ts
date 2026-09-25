import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isRangeDiscourseSlug,
	parseSectionHeadingSource,
	subsectionDiscourseHref,
	stripSectionTocTitleSuffix,
} from "./sectionHeading";

describe("parseSectionHeadingSource", () => {
	it("parses numeric id with optional ToC title", () => {
		assert.deepEqual(parseSectionHeadingSource("2.11 {Two powers}"), {
			display: "2.11",
			tocTitle: "Two powers",
			sectionId: "2.11",
		});
	});

	it("leaves named headings unchanged", () => {
		assert.deepEqual(
			parseSectionHeadingSource("Before Acting"),
			{
				display: "Before Acting",
				tocTitle: null,
				sectionId: null,
			},
		);
	});
});

describe("subsectionDiscourseHref", () => {
	it("builds AN subsection URLs from a range parent", () => {
		assert.equal(subsectionDiscourseHref("an2.11-20", "2.16"), "/an2.16");
		assert.equal(subsectionDiscourseHref("an1.98-139", "1.99"), "/an1.99");
	});

	it("returns null for single-discourse parents", () => {
		assert.equal(subsectionDiscourseHref("mn61", "2.11"), null);
	});
});

describe("stripSectionTocTitleSuffix", () => {
	it("strips markdown heading markers and brace titles", () => {
		assert.equal(
			stripSectionTocTitleSuffix("#### 2.16 {A brahmin on rebirth}"),
			"2.16",
		);
	});
});

describe("isRangeDiscourseSlug", () => {
	it("detects compilation slugs", () => {
		assert.equal(isRangeDiscourseSlug("an2.11-20"), true);
		assert.equal(isRangeDiscourseSlug("mn10"), false);
	});
});
