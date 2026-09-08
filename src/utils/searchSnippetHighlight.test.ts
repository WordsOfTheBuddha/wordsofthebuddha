import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { HighlightTerm } from "./fuseQueryParser";
import {
	clipSnippetAroundHighlight,
	countSnippetHighlightTerms,
	highlightSnippetText,
	mergeAdjacentMarks,
} from "./searchSnippetHighlight";

function exact(term: string): HighlightTerm {
	return { field: "content", term, operation: "exact" };
}

function fuzzy(term: string): HighlightTerm {
	return { field: "content", term, operation: "fuzzy" };
}

function stripGloss(html: string): string {
	return html.replace(/\|(.+?)::[^|]+\|/g, "$1");
}

function markedPhrases(html: string): string[] {
	return [...stripGloss(html).matchAll(/<mark[^>]*>([\s\S]*?)<\/mark>/g)].map(
		(match) => match[1],
	);
}

const SN47_13_PARAGRAPH =
	"Why, Ānanda, when Sāriputta attained final Nibbāna, did he take away your aggregate of |virtue::moral conduct, ethical behavior [sīla]|, your aggregate of |collectedness::stability of mind [samādhi]|, your aggregate of |wisdom::distinctive knowledge [paññā]|, your aggregate of |liberation::release, deliverance, freedom, emancipation [vimutti]|, or your aggregate of the |knowledge and vision of liberation::understanding of emancipation [vimuttiñāṇadassana]|?";

describe("highlightSnippetText", () => {
	it("wraps an exact in-order phrase as one mark, not first occurrences", () => {
		const text =
			"liberation comes later. Then one's aggregate of liberation, and one's knowledge.";
		const html = highlightSnippetText(text, [
			exact("aggregate"),
			exact("of"),
			exact("liberation"),
		]);
		assert.deepEqual(markedPhrases(html), ["aggregate of liberation"]);
		assert.equal(countSnippetHighlightTerms(html), 3);
		assert.equal((html.match(/liberation/g) || []).length, 2);
		assert.ok(!stripGloss(html).startsWith("<mark"));
	});

	it("highlights a phrase that spans a gloss annotation", () => {
		const html = highlightSnippetText(SN47_13_PARAGRAPH, [
			exact("aggregate"),
			exact("of"),
			exact("liberation"),
		]);
		assert.deepEqual(markedPhrases(html), ["aggregate of liberation"]);
		assert.ok(
			html.includes(
				'<mark class="bg-yellow-100 dark:bg-yellow-900 rounded box-decoration-clone"',
			),
		);
		assert.ok(html.includes("</mark>"));
		assert.ok(!html.includes("|"));
		assert.ok(!html.includes("::::"));
		// First "aggregate of virtue" must stay unmarked
		assert.match(stripGloss(html), /your aggregate of virtue/);
		assert.ok(!stripGloss(html).includes("<mark>aggregate of virtue"));
	});

	it("wraps unquoted in-order terms the same way", () => {
		const text = "They spoke of the aggregate of liberation here.";
		const html = highlightSnippetText(text, [
			fuzzy("aggregate"),
			fuzzy("of"),
			fuzzy("liberation"),
		]);
		assert.deepEqual(markedPhrases(html), ["aggregate of liberation"]);
	});

	it("wraps non-stopword in-order terms across a stopword gap", () => {
		const text = "This aggregate of liberation is mentioned.";
		const html = highlightSnippetText(text, [
			fuzzy("aggregate"),
			fuzzy("liberation"),
		]);
		assert.deepEqual(markedPhrases(html), ["aggregate of liberation"]);
	});

	it("falls back to first-match when terms are not in order", () => {
		const text = "liberation first, then an aggregate of virtue remains.";
		const html = highlightSnippetText(text, [
			exact("aggregate"),
			exact("of"),
			exact("liberation"),
		]);
		const phrases = markedPhrases(html);
		assert.ok(phrases.includes("liberation"));
		assert.ok(!phrases.some((p) => p.includes("aggregate of liberation")));
	});

	it("does not wrap a huge in-order span across a content word", () => {
		const text = "wrong livelihood is called an effort here.";
		const html = highlightSnippetText(text, [
			fuzzy("wrong"),
			fuzzy("effort"),
		]);
		const phrases = markedPhrases(html);
		assert.deepEqual(phrases, ["wrong", "effort"]);
	});

	it("renders TTS-only glosses as the visible term", () => {
		const html = highlightSnippetText(
			"progressing through the |jhānas::::jah-naas|.",
			[fuzzy("jhanas")],
		);
		assert.ok(!html.includes("|"));
		assert.ok(!html.includes("::::"));
		assert.match(html, /jhānas/);
	});

	it("highlights a single term", () => {
		const html = highlightSnippetText("The Dhamma is near.", [
			fuzzy("dhamma"),
		]);
		assert.deepEqual(markedPhrases(html), ["Dhamma"]);
	});

	it("skips stopwords in title fallback when terms are not in order", () => {
		const html = highlightSnippetText(
			"Dhamma is the island",
			[fuzzy("the"), fuzzy("dhamma")],
			{ fallbackSkipStopwords: true },
		);
		assert.deepEqual(markedPhrases(html), ["Dhamma"]);
	});
});

describe("clipSnippetAroundHighlight", () => {
	it("keeps a late phrase mark in view", () => {
		const prefix = "x ".repeat(200);
		const html = `${prefix}<mark data-hl-count="3">aggregate of liberation</mark> and more text here.`;
		const clipped = clipSnippetAroundHighlight(html, 120);
		assert.ok(clipped.includes("aggregate of liberation"));
		assert.ok(clipped.startsWith("..."));
		assert.ok(clipped.length < html.length);
	});
});

describe("mergeAdjacentMarks", () => {
	it("joins neighboring marks into one span", () => {
		const html = mergeAdjacentMarks(
			'<mark class="x" data-hl-count="1">aggregate</mark> <mark class="x" data-hl-count="1">of</mark>',
		);
		assert.equal(
			html,
			'<mark class="x" data-hl-count="2">aggregate of</mark>',
		);
	});
});
