import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderInlineDescription, splitDescriptionParagraphs } from "./renderInlineDescription";

describe("renderInlineDescription", () => {
	it("renders discourse links", () => {
		assert.equal(
			renderInlineDescription("first journeys ([SN 10.8](/sn10.8))."),
			'first journeys (<a href="/sn10.8">SN 10.8</a>).',
		);
	});

	it("renders bold and italics", () => {
		assert.equal(
			renderInlineDescription("the **donor** of *Jeta's* Grove"),
			'the <strong>donor</strong> of <em>Jeta&#39;s</em> Grove',
		);
	});

	it("renders underscore italics but not mid-word underscores", () => {
		assert.equal(
			renderInlineDescription("a _layman_ with some_thing here"),
			"a <em>layman</em> with some_thing here",
		);
	});

	it("escapes HTML and rejects unsafe URLs", () => {
		assert.equal(
			renderInlineDescription('<script>alert("x")</script>'),
			"&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
		);
		assert.equal(
			renderInlineDescription("[click](javascript:alert(1))"),
			"[click](javascript:alert(1))",
		);
	});

	it("leaves plain prose untouched", () => {
		const prose =
			"Householder Anāthapiṇḍika, the donor of Jeta's Grove (SN55.26–28).";
		assert.equal(renderInlineDescription(prose), prose.replace("'", "&#39;"));
	});

	it("returns empty for empty input", () => {
		assert.equal(renderInlineDescription(""), "");
	});
});

describe("splitDescriptionParagraphs", () => {
	it("keeps a single-paragraph description whole", () => {
		assert.deepEqual(splitDescriptionParagraphs("One paragraph only."), [
			"One paragraph only.",
		]);
	});

	it("splits two paragraphs on a blank line and trims them", () => {
		assert.deepEqual(
			splitDescriptionParagraphs("First paragraph.  \nSecond line. \n\n  Second paragraph."),
			["First paragraph. Second line.", "Second paragraph."],
		);
	});

	it("allows at most the paragraphs present, ignoring extra blanks", () => {
		assert.deepEqual(
			splitDescriptionParagraphs("One.\n\n\n\nTwo.\n\n\nThree."),
			["One.", "Two.", "Three."],
		);
	});

	it("returns empty for empty input", () => {
		assert.deepEqual(splitDescriptionParagraphs(""), []);
	});
});
