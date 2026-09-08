import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SuggestionIndexEntry } from "../types/suggestions";
import { createSuggestionSearcher } from "./suggestionSearcher";
import {
	applyStemVowelToHighlightPattern,
	computeHighlightEnd,
	dedupeInflectionVariants,
	highlightSuggestionText,
	inflectionStemKey,
} from "./paliInflectionUtils";

describe("applyStemVowelToHighlightPattern", () => {
	it("allows o ending when query stem ends in a", () => {
		const basePattern =
			"samath[aAáÁàÀâÂäÄãÃåÅāĀăĂąĄ]";
		const flexible = applyStemVowelToHighlightPattern(
			basePattern,
			"sabbasankharasamatha",
		);
		const regex = new RegExp(flexible, "iu");
		assert.ok(regex.test("samatho"));
		assert.ok(regex.test("samatha"));
	});

	it("leaves short terms unchanged", () => {
		const base = "sati[aA]";
		assert.equal(applyStemVowelToHighlightPattern(base, "sati"), base);
	});
});

describe("inflectionStemKey", () => {
	it("collapses a/o endings on long tokens", () => {
		assert.equal(
			inflectionStemKey("sabbasankharasamatha"),
			inflectionStemKey("sabbasankharasamatho"),
		);
	});

	it("does not collapse short tokens", () => {
		assert.notEqual(inflectionStemKey("sati"), inflectionStemKey("sato"));
	});

	it("groups long technical terms across case endings", () => {
		const lemma = inflectionStemKey("vimuttikkhandha");
		assert.equal(inflectionStemKey("vimuttikkhandho"), lemma);
		assert.equal(inflectionStemKey("vimuttikkhandhena"), lemma);
		assert.equal(inflectionStemKey("vimuttikkhandham"), lemma);
		assert.equal(inflectionStemKey("vimuttikkhandhassa"), lemma);
	});

	it("does not merge bhikkhu with bhikkhussa", () => {
		assert.notEqual(
			inflectionStemKey("bhikkhu"),
			inflectionStemKey("bhikkhussa"),
		);
	});

	it("keeps prefix-distinct stems apart", () => {
		assert.notEqual(
			inflectionStemKey("animitta"),
			inflectionStemKey("nimitta"),
		);
	});
});

describe("highlightSuggestionText", () => {
	it("highlights when query uses a different inflection ending", () => {
		const html = highlightSuggestionText(
			"sabbasaṅkhārasamatha",
			"sabbasankharasamatho",
		);
		assert.match(html, /<mark class="search-suggest-mark">/);
		assert.match(html, /sabbasaṅkhārasamatha/);
	});

	it("highlights diacritic-insensitive prefix", () => {
		const html = highlightSuggestionText("sampajāna", "sampajana");
		assert.match(html, /<mark class="search-suggest-mark">sampajāna<\/mark>/);
	});
});

describe("dedupeInflectionVariants", () => {
	it("keeps tooltip base over corpus inflected form", () => {
		const entries: SuggestionIndexEntry[] = [
			{
				text: "sabbasaṅkhārasamatha",
				norm: "sabbasankharasamatha",
				source: "tooltip",
				entityType: "topic",
			},
			{
				text: "sabbasaṅkhārasamatho",
				norm: "sabbasankharasamatho",
				source: "corpus",
				entityType: "topic",
			},
		];
		const deduped = dedupeInflectionVariants(entries);
		assert.equal(deduped.length, 1);
		assert.equal(deduped[0]?.text, "sabbasaṅkhārasamatha");
	});
});

describe("createSuggestionSearcher inflection matching", () => {
	it("matches samatho query to samatha entry", () => {
		const searcher = createSuggestionSearcher([
			{
				text: "sabbasaṅkhārasamatha",
				norm: "sabbasankharasamatha",
				source: "tooltip",
				entityType: "topic",
			},
		]);
		const results = searcher.suggest("sabbasankharasamatho");
		assert.equal(results[0]?.text, "sabbasaṅkhārasamatha");
		assert.ok(computeHighlightEnd(results[0]!.text, "sabbasankharasamatho") > 0);
	});

	it("matches an instrumental query to the a-stem entry", () => {
		const searcher = createSuggestionSearcher([
			{
				text: "vimuttikkhandha",
				norm: "vimuttikkhandha",
				source: "tooltip",
				entityType: "topic",
			},
		]);
		const results = searcher.suggest("vimuttikkhandhena");
		assert.equal(results[0]?.text, "vimuttikkhandha");
	});
});
