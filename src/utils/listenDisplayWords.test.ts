import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	capitalizeFirstLetter,
	endsSentence,
	hasLeadingOpenBracket,
	isOpenBracketOnly,
	isOpeningPunctOnly,
	listenDisplayWords,
	shouldApplySentenceCap,
} from "./listenDisplayWords";

function words(...tokens: string[]) {
	return tokens.map((w) => ({ w }));
}

/** snp5.2-style verse line ending in ? before a parenthetical attribution. */
function verseThenAttribution(...attribution: string[]) {
	return words("“", "Who", "here", "is", "content", "in", "the", "world?", ...attribution);
}

describe("listenDisplayWords", () => {
	it("capitalizes the first word of a paragraph", () => {
		assert.deepEqual(listenDisplayWords(words("then", "the", "Buddha", "said")), [
			"Then",
			"the",
			"Buddha",
			"said",
		]);
	});

	it("capitalizes after a sentence-ending question mark", () => {
		assert.deepEqual(
			listenDisplayWords(words("He", "left.", "Then", "the", "Buddha", "said")),
			["He", "left.", "Then", "the", "Buddha", "said"],
		);
	});

	it("does not capitalize after ? when the next word follows a lone open paren (snp5.2)", () => {
		assert.deepEqual(
			listenDisplayWords(verseThenAttribution("(", "said", "the", "venerable", "Tissa")),
			["“", "Who", "here", "is", "content", "in", "the", "world?", "(", "said", "the", "venerable", "Tissa"],
		);
	});

	it("does not capitalize when open paren is glued to the word token", () => {
		assert.deepEqual(
			listenDisplayWords(verseThenAttribution("(said", "the", "venerable")),
			["“", "Who", "here", "is", "content", "in", "the", "world?", "(said", "the", "venerable"],
		);
	});

	it("does not capitalize after ? when the next word follows a lone open bracket", () => {
		assert.deepEqual(
			listenDisplayWords(verseThenAttribution("[", "said", "the", "editor")),
			["“", "Who", "here", "is", "content", "in", "the", "world?", "[", "said", "the", "editor"],
		);
	});

	it("does not capitalize after ? when the next word follows a lone open brace", () => {
		assert.deepEqual(
			listenDisplayWords(verseThenAttribution("{", "said", "the", "scribe")),
			["“", "Who", "here", "is", "content", "in", "the", "world?", "{", "said", "the", "scribe"],
		);
	});

	it("still capitalizes paragraph-start words after an opening quote token", () => {
		assert.deepEqual(listenDisplayWords(words("“", "who", "here", "is", "content?")), [
			"“",
			"Who",
			"here",
			"is",
			"content?",
		]);
	});

	it("does not capitalize said when it follows a comma inside a parenthetical", () => {
		assert.deepEqual(
			listenDisplayWords(words("(Metteyya,”", "said", "the", "Buddha)")),
			["(Metteyya,”", "said", "the", "Buddha)"],
		);
	});

	it("does not treat ellipses as sentence ends", () => {
		assert.deepEqual(listenDisplayWords(words("food...", "then", "he", "ate")), [
			"Food...",
			"then",
			"he",
			"ate",
		]);
	});
});

describe("shouldApplySentenceCap", () => {
	it("allows cap for a normal sentence continuation", () => {
		assert.equal(shouldApplySentenceCap("Then", "world?"), true);
	});

	it("blocks cap after a lone open paren token", () => {
		assert.equal(shouldApplySentenceCap("said", "("), false);
	});

	it("allows cap after an opening quote token", () => {
		assert.equal(shouldApplySentenceCap("who", "“"), true);
	});

	it("blocks cap when the word itself starts with an open bracket", () => {
		assert.equal(shouldApplySentenceCap("(said", "world?"), false);
	});
});

describe("helpers", () => {
	it("endsSentence recognises closing quote after ?", () => {
		assert.equal(endsSentence('world?”'), true);
	});

	it("isOpeningPunctOnly recognises bracket and quote openers", () => {
		assert.equal(isOpeningPunctOnly("("), true);
		assert.equal(isOpeningPunctOnly("["), true);
		assert.equal(isOpeningPunctOnly("{"), true);
		assert.equal(isOpeningPunctOnly("“"), true);
		assert.equal(isOpeningPunctOnly("said"), false);
	});

	it("isOpenBracketOnly recognises brackets but not quotes", () => {
		assert.equal(isOpenBracketOnly("("), true);
		assert.equal(isOpenBracketOnly("“"), false);
	});

	it("hasLeadingOpenBracket recognises glued openers", () => {
		assert.equal(hasLeadingOpenBracket("(said"), true);
		assert.equal(hasLeadingOpenBracket("said"), false);
	});

	it("capitalizeFirstLetter skips non-letters", () => {
		assert.equal(capitalizeFirstLetter("“who"), "“Who");
		assert.equal(capitalizeFirstLetter("(said"), "(Said");
	});
});
