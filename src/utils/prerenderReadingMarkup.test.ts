import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COLLAPSE_MARK, prerenderReadingMarkup } from "./prerenderReadingMarkup";

describe("prerenderReadingMarkup", () => {
	it("leaves markup-free HTML untouched", () => {
		const html = "<p>Thus have I heard.</p>";
		assert.deepEqual(prerenderReadingMarkup(html), { html, ok: true });
	});

	it("renders glosses the way BottomDrawer does", () => {
		const { html, ok } = prerenderReadingMarkup(
			"<p>many |aeon::a [kappa](/on/aeon) &amp; more|s of time</p>",
		);
		assert.equal(ok, true);
		assert.equal(
			html,
			'<p>many <span class="tooltip-text" data-tooltip-content="a &lt;a href=&quot;/on/aeon&quot; class=&quot;tooltip-link&quot;&gt;kappa&lt;/a&gt; &amp; more">aeon</span>s of time</p>',
		);
	});

	it("omits empty-TTS vocatives and capitalizes the next word", () => {
		const { html } = prerenderReadingMarkup(
			"<p>|Bhikkhus,::::| there are these two.</p>",
		);
		assert.equal(html, "<p>There are these two.</p>");
	});

	it("skips text inside .pali-word spans", () => {
		const input = '<p><span class="pali-word">|a::b|</span></p>';
		assert.equal(prerenderReadingMarkup(input).html, input);
	});

	it("collapses <collapse> and keeps raw gloss markup for expand", () => {
		const { html, ok } = prerenderReadingMarkup(
			"<p>one, <collapse>two <em>|three::3|</em>,</collapse> four</p>",
		);
		assert.equal(ok, true);
		assert.equal(
			html,
			`<p>one, <span class="collapse-toggle collapsed" data-content="two |three::3|," title="Click to expand">${COLLAPSE_MARK}</span> four</p>`,
		);
	});

	it("falls back when a collapse is misnested across spans", () => {
		const input =
			'<p><span class="pali-word"><collapse>tissopi</span> <span class="pali-word">jātiyo</collapse></span></p>';
		assert.deepEqual(prerenderReadingMarkup(input), { html: input, ok: false });
	});

	it("falls back on block markup inside a collapse", () => {
		const input = "<collapse><p>a</p></collapse>";
		assert.equal(prerenderReadingMarkup(input).ok, false);
	});

	it("falls back on unknown named entities", () => {
		const input = "<p>|a::b| &frac12;</p>";
		assert.equal(prerenderReadingMarkup(input).ok, false);
	});
});
