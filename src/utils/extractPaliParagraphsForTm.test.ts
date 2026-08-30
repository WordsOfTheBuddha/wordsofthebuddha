import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPaliParagraphsForTm } from "./contentParser";

describe("extractPaliParagraphsForTm", () => {
	it("numbers plain paragraphs and skips headings and end markers", () => {
		const pali = [
			"Sāvatthinidānaṁ.",
			"“Attadīpā, bhikkhave, viharatha.",
			"# Heading",
			"Rūpaṁ attato samanupassati.",
			"Dutiyaṁ.", // corpus end marker (ṁ before period)
		].join("\n\n");

		const paragraphs = extractPaliParagraphsForTm(pali);

		assert.deepEqual(
			paragraphs.map((p) => p.num),
			[1, 2, 3],
		);
		assert.equal(paragraphs[0].text, "Sāvatthinidānaṁ.");
		assert.equal(paragraphs[1].text, "“Attadīpā, bhikkhave, viharatha.");
		assert.equal(paragraphs[2].text, "Rūpaṁ attato samanupassati.");
	});

	it("normalizes whitespace and returns empty for blank input", () => {
		assert.deepEqual(extractPaliParagraphsForTm(""), []);
		assert.deepEqual(extractPaliParagraphsForTm("   \n\n  "), []);

		const paragraphs = extractPaliParagraphsForTm("Foo\n\n  Bar   baz  ");
		assert.equal(paragraphs.length, 2);
		assert.equal(paragraphs[1].text, "Bar baz");
	});
});
