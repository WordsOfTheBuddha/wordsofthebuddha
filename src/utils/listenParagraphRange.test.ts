import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildListenHref,
	formatParagraphRangeParam,
	parseDiscourseExcerptPath,
	parseParagraphRangeParam,
	paragraphRangesEqual,
} from "./listenParagraphRange";

describe("listenParagraphRange", () => {
	it("parses single and range pp params", () => {
		assert.deepEqual(parseParagraphRangeParam("29"), { start: 29, end: 29 });
		assert.deepEqual(parseParagraphRangeParam("29-56"), { start: 29, end: 56 });
		assert.equal(parseParagraphRangeParam("56-29"), null);
		assert.equal(parseParagraphRangeParam(""), null);
	});

	it("formats pp params", () => {
		assert.equal(formatParagraphRangeParam({ start: 29, end: 29 }), "29");
		assert.equal(formatParagraphRangeParam({ start: 29, end: 56 }), "29-56");
	});

	it("parses discourse excerpt paths", () => {
		assert.deepEqual(parseDiscourseExcerptPath("dn15.29-56"), {
			slug: "dn15",
			href: "dn15.29-56",
			pp: { start: 29, end: 56 },
		});
		assert.deepEqual(parseDiscourseExcerptPath("sn3.3"), {
			slug: "sn3.3",
			href: "sn3.3",
			pp: null,
		});
		assert.deepEqual(parseDiscourseExcerptPath("mn26"), {
			slug: "mn26",
			href: "mn26",
			pp: null,
		});
	});

	it("builds listen hrefs with playlist and paragraph range", () => {
		assert.equal(
			buildListenHref("dn15", {
				pl: "in-the-buddhas-words",
				pp: { start: 29, end: 56 },
			}),
			"/listen/dn15?pl=in-the-buddhas-words&pp=29-56",
		);
	});

	it("compares paragraph ranges", () => {
		assert.equal(
			paragraphRangesEqual({ start: 1, end: 2 }, { start: 1, end: 2 }),
			true,
		);
		assert.equal(paragraphRangesEqual({ start: 1, end: 2 }, null), false);
		assert.equal(paragraphRangesEqual(null, null), true);
	});
});
