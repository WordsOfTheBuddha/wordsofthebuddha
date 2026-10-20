import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContentPair } from "./contentParser";
import { selectPassage } from "./passageSelect";

function pair(
	english: string,
	actualParagraphNumber?: number,
): ContentPair {
	return { type: "paragraph", english, actualParagraphNumber };
}

const dhp = [
	pair("#### 146"),
	pair("What is the laughter", 1),
	pair("#### 147"),
	pair("Behold this form", 2),
	pair("#### 148"),
	pair("This body is worn out", 3),
	pair("#### 149"),
	pair("Like discarded bottle gourds", 4),
];

describe("selectPassage", () => {
	it("keeps the verse title that introduces the first paragraph of a range", () => {
		const selected = selectPassage(dhp, 1, 3).map((item) => item.english);
		assert.deepEqual(selected, [
			"#### 146",
			"What is the laughter",
			"#### 147",
			"Behold this form",
			"#### 148",
			"This body is worn out",
		]);
	});

	it("keeps the verse title when the range starts after earlier verses", () => {
		const selected = selectPassage(dhp, 3, 4).map((item) => item.english);
		assert.deepEqual(selected, [
			"#### 148",
			"This body is worn out",
			"#### 149",
			"Like discarded bottle gourds",
		]);
	});

	it("does not carry a section title across an earlier paragraph", () => {
		const pairs = [
			pair("## Old Age"),
			pair("#### 146"),
			pair("What is the laughter", 1),
			pair("#### 147"),
			pair("Behold this form", 2),
		];
		const selected = selectPassage(pairs, 2, 2).map((item) => item.english);
		assert.deepEqual(selected, ["#### 147", "Behold this form"]);
	});
});
