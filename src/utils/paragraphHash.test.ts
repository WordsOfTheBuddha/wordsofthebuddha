import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseHashRange } from "./paragraphHash";

describe("parseHashRange", () => {
	it("parses a single paragraph id", () => {
		assert.deepEqual(parseHashRange("#1"), {
			paragraphs: [1],
			scrollTo: 1,
		});
	});

	it("parses comma-separated paragraphs and numeric ranges", () => {
		assert.deepEqual(parseHashRange("#1,2,4-6"), {
			paragraphs: [1, 2, 4, 5, 6],
			scrollTo: 1,
		});
	});

	it("parses a plain start-end range", () => {
		assert.deepEqual(parseHashRange("4-6"), {
			paragraphs: [4, 5, 6],
			scrollTo: 4,
		});
	});

	it("does not treat a numbered section slug as a paragraph range", () => {
		assert.deepEqual(
			parseHashRange("#1-3-perception-and-the-self"),
			{ paragraphs: [], scrollTo: null },
		);
		assert.deepEqual(
			parseHashRange("#1-with-the-wanderer-potthapada"),
			{ paragraphs: [], scrollTo: null },
		);
	});

	it("ignores empty hashes", () => {
		assert.deepEqual(parseHashRange(""), {
			paragraphs: [],
			scrollTo: null,
		});
	});
});
