import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import type { HighlightTerm } from "./fuseQueryParser";
import {
	clipSnippetAroundHighlight,
	countSnippetHighlightTerms,
	formatSearchCardSnippet,
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

describe("formatSearchCardSnippet", () => {
	it("keeps markdown link text and does not emit nested anchors", () => {
		const html = formatSearchCardSnippet(
			"The chapter gets its name from the [AN 2.36](/an2.36) discourse.",
		);
		assert.equal(
			html,
			"The chapter gets its name from the AN 2.36 discourse.",
		);
		assert.equal(html.includes("<a"), false);
	});

	it("unwraps existing anchors, including highlighted link text", () => {
		const html = formatSearchCardSnippet(
			'See <a href="/an8.21" class="text-link-color hover:underline"><mark>AN 8.21</mark></a>.',
		);
		assert.equal(html, "See <mark>AN 8.21</mark>.");
	});

	it("turns section headings into bold text", () => {
		assert.equal(
			formatSearchCardSnippet("#### 2.36\n\nNext line"),
			"<strong>2.36</strong>\n\nNext line",
		);
	});

	it("keeps the search card in one piece in the HTML parser", () => {
		const card = (inner: string) =>
			new JSDOM(`<a href="/an2.32-41" class="search-discourse-card">
				<h2>AN 2.32-41</h2>
				<p>The chapter gets its name from the ${inner} discourse.</p>
				<p>sekho ca asekho ca</p>
			</a>`).window.document;

		const broken = card('<a href="/an2.36">AN 2.36</a>');
		assert.equal(
			broken.querySelectorAll("a.search-discourse-card").length,
			2,
		);
		assert.equal(
			broken
				.querySelector("a.search-discourse-card")
				?.textContent?.includes("sekho"),
			false,
		);

		const fixed = card(formatSearchCardSnippet("[AN 2.36](/an2.36)"));
		const el = fixed.querySelector("a.search-discourse-card");
		assert.equal(fixed.querySelectorAll("a.search-discourse-card").length, 1);
		assert.match(el?.textContent || "", /AN 2\.36 discourse/);
		assert.match(el?.textContent || "", /sekho/);
	});
});
