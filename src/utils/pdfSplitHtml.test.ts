import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import { createCombinedMarkdown } from "./contentParser";
import { buildSplitPdfHtmlFromPairs } from "./splitPdfHtml";

describe("buildSplitPdfHtmlFromPairs", () => {
	it("wraps each English/Pāli pair in a side-by-side row", () => {
		const html = buildSplitPdfHtmlFromPairs([
			{
				type: "paragraph",
				english: "Thus have I heard.",
				pali: "Evaṃ me sutaṃ.",
			},
			{
				type: "paragraph",
				english: "On one occasion.",
				pali: "Ekaṃ samayaṃ.",
			},
		]);

		assert.match(html, /class="pdf-poly-split"/);
		const dom = new JSDOM(html);
		const rows = [
			...dom.window.document.querySelectorAll(".pdf-poly-row"),
		];
		assert.equal(rows.length, 2);

		const firstEn = rows[0]?.querySelector(".pdf-poly-en")?.textContent ?? "";
		const firstPi = rows[0]?.querySelector(".pdf-poly-pi")?.textContent ?? "";
		assert.match(firstEn, /Thus have I heard/);
		assert.match(firstPi, /Evaṃ me sutaṃ/);

		const secondEn = rows[1]?.querySelector(".pdf-poly-en")?.textContent ?? "";
		const secondPi = rows[1]?.querySelector(".pdf-poly-pi")?.textContent ?? "";
		assert.match(secondEn, /On one occasion/);
		assert.match(secondPi, /Ekaṃ samayaṃ/);
	});
});

describe("createCombinedMarkdown interleaved", () => {
	it("still emits sequential Pāli-then-English blocks", () => {
		const combined = createCombinedMarkdown(
			[
				{
					type: "paragraph",
					english: "Thus have I heard.",
					pali: "Evaṃ me sutaṃ.",
				},
			],
			true,
			"interleaved",
		);
		assert.equal(typeof combined, "string");
		assert.match(String(combined), /pali-paragraph/);
		assert.match(String(combined), /english-paragraph/);
		assert.doesNotMatch(String(combined), /pdf-poly-row/);
	});
});
