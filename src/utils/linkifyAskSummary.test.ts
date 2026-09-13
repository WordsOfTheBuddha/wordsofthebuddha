import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	discourseIdAliases,
	joinAskSummaryParagraphs,
	linkifyAskSummaryHtml,
	linkifyDiscourseIdsInHtml,
	looksLikeAskMarkdown,
	normalizeAskSummaryProse,
} from "./linkifyAskSummary";

describe("discourseIdAliases", () => {
	it("includes compact and display forms", () => {
		const aliases = discourseIdAliases("sn22.82");
		assert.ok(aliases.some((alias) => /sn22\.82/i.test(alias)));
		assert.ok(aliases.some((alias) => /SN 22\.82/i.test(alias)));
	});
});

describe("linkifyAskSummaryHtml", () => {
	it("links known discourse IDs and escapes other text", () => {
		const html = linkifyAskSummaryHtml(
			'Start with MN 10, then SN 47.19. Ignore <script>.',
			[
				{ slug: "mn10", href: "/mn10" },
				{ slug: "sn47.19", href: "/sn47.19" },
			],
		);
		assert.match(html, /<p>/);
		assert.match(html, /href="\/mn10"/);
		assert.match(html, />MN 10</);
		assert.match(html, /href="\/sn47\.19"/);
		assert.match(html, />SN 47\.19</);
		assert.match(html, /&lt;script&gt;/);
		assert.doesNotMatch(html, /<script>/);
	});

	it("links a discourse only once in a briefing paragraph", () => {
		const html = linkifyAskSummaryHtml(
			"MN 10 opens the body, and MN 10 returns to it.",
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.equal([...html.matchAll(/href="\/mn10"/g)].length, 1);
		assert.match(html, /and MN 10 returns/);
	});

	it("does not link IDs that are not in the result set", () => {
		const html = linkifyAskSummaryHtml("See DN 22 as well as MN 10.", [
			{ slug: "mn10", href: "/mn10" },
		]);
		assert.match(html, /href="\/mn10"/);
		assert.doesNotMatch(html, /href="\/dn22"/);
		assert.match(html, /DN 22/);
	});

	it("renders blank lines as separate paragraphs", () => {
		const html = linkifyAskSummaryHtml(
			"First paragraph mentions MN 10.\n\nSecond paragraph.",
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.equal([...html.matchAll(/<p>/g)].length, 2);
		assert.match(html, /href="\/mn10"/);
		assert.match(html, /Second paragraph/);
	});

	it("repairs glued sentences and infers paragraphs before discourse IDs", () => {
		const wall =
			"Daily-life mindfulness is trained through satisampajañña, not as a stand-alone technique.AN 6.29 gives a compact version of the same practice. Relatedly, AN 10.51 makes self-monitoring a daily review.AN 4.41 locates this in feelings and thoughts as they arise. A caveat: most of these passages address bhikkhus.";
		const html = linkifyAskSummaryHtml(wall, [
			{ slug: "an6.29", href: "/an6.29" },
			{ slug: "an4.41", href: "/an4.41" },
		]);
		assert.match(html, /stand-alone technique\.<\/p><p>/);
		assert.match(html, /href="\/an6\.29"/);
		assert.match(html, /href="\/an4\.41"/);
		assert.ok([...html.matchAll(/<p>/g)].length >= 4);
		assert.match(html, /<p>A caveat:/);
	});
});

describe("normalizeAskSummaryProse", () => {
	it("keeps paragraphs and clips length", () => {
		assert.equal(
			normalizeAskSummaryProse("  First. \n\n  Second.  "),
			"First.\n\nSecond.",
		);
		assert.equal(normalizeAskSummaryProse("abcdefghij", 6), "abcdef");
	});

	it("keeps markdown tables and lists intact", () => {
		const table = `| Discourse | Facet |\n| --- | --- |\n| MN 10 | body |`;
		assert.equal(looksLikeAskMarkdown(table), true);
		assert.match(normalizeAskSummaryProse(table), /\| MN 10 \| body \|/);
		const fromParas = joinAskSummaryParagraphs([
			"| Discourse | Facet |",
			"| --- | --- |",
			"| MN 10 | body |",
		]);
		assert.match(fromParas, /\| --- \| --- \|/);
		assert.doesNotMatch(fromParas, /\n\n\| ---/);
	});

	it("does not treat ordinary prose as markdown", () => {
		assert.equal(
			looksLikeAskMarkdown("MN 10 sets out the four establishments of mindfulness."),
			false,
		);
	});

	it("treats #### headings as markdown", () => {
		assert.equal(looksLikeAskMarkdown("#### 1. Higher virtue"), true);
	});

	it("does not break i.e. or discourse-ID decimals", () => {
		const text = normalizeAskSummaryProse(
			"Feelings arise known (viditā) — i.e., tracking ordinary mental events as in AN 4.41.",
		);
		assert.match(text, /i\.e\., tracking/);
		assert.match(text, /AN 4\.41/);
		assert.doesNotMatch(text, /i\. e\./);
		assert.doesNotMatch(text, /4\. 41/);
	});
});

describe("linkifyDiscourseIdsInHtml", () => {
	it("leaves discourse IDs in headings as plain text", () => {
		const html = linkifyDiscourseIdsInHtml(
			`<h2>Chapter 6 — SN 47.42's analysis</h2><p>SN 47.42 teaches it.</p>`,
			[{ slug: "sn47.42", href: "/sn47.42" }],
		);
		assert.match(html, /<h2>Chapter 6 — SN 47\.42's analysis<\/h2>/);
		assert.doesNotMatch(html, /<h2>[^<]*<a\b/);
		assert.match(
			html,
			/<p><a class="ai-summary-ref" href="\/sn47\.42">SN 47\.42<\/a> teaches it\.<\/p>/,
		);
	});

	it("does not link discourse IDs inside SVG or mermaid listings", () => {
		const html = linkifyDiscourseIdsInHtml(
			`<p>MN 10 in prose.</p><svg><text>MN 10</text></svg><pre class="ai-report-mermaid">MN 10</pre>`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(
			html,
			/<p><a class="ai-summary-ref" href="\/mn10">MN 10<\/a> in prose\.<\/p>/,
		);
		assert.match(html, /<svg><text>MN 10<\/text><\/svg>/);
		assert.match(html, /<pre class="ai-report-mermaid">MN 10<\/pre>/);
		assert.equal([...html.matchAll(/href="\/mn10"/g)].length, 1);
	});

	it("unwraps markdown links already inside a heading", () => {
		const html = linkifyDiscourseIdsInHtml(
			`<h3>Body: <a class="ai-summary-ref" href="/mn10">MN 10</a></h3><p>Keep going.</p>`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(html, /<h3>Body: MN 10<\/h3>/);
		assert.doesNotMatch(html, /<h3>[^<]*<a\b/);
	});

	it("links a paragraph range cite", () => {
		const html = linkifyDiscourseIdsInHtml(
			`<p>See MN 10 ¶6 - ¶50 for the body.</p>`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(
			html,
			/<a class="ai-summary-ref" href="\/mn10#6-50">MN 10 ¶6 - ¶50<\/a>/,
		);
	});

	it("links a paragraph cite and only the first mention in a paragraph", () => {
		const html = linkifyDiscourseIdsInHtml(
			`<p>MN 21 ¶21 then MN 21 again.</p><p>MN 21 later.</p><td>MN 21</td>`,
			[{ slug: "mn21", href: "/mn21" }],
		);
		assert.match(
			html,
			/<p><a class="ai-summary-ref" href="\/mn21#21">MN 21 ¶21<\/a> then MN 21 again\.<\/p>/,
		);
		assert.match(
			html,
			/<p><a class="ai-summary-ref" href="\/mn21">MN 21<\/a> later\.<\/p>/,
		);
		assert.match(html, /<td><a class="ai-summary-ref" href="\/mn21">MN 21<\/a><\/td>/);
		assert.equal([...html.matchAll(/href="\/mn21(?:#21)?"/g)].length, 3);
	});

	it("does not auto-link a discourse already linked in that paragraph", () => {
		const html = linkifyDiscourseIdsInHtml(
			`<p><a class="ai-summary-ref" href="/mn21#21">MN 21 ¶21</a> and MN 21 later.</p>`,
			[{ slug: "mn21", href: "/mn21" }],
		);
		assert.match(html, /href="\/mn21#21"/);
		assert.match(html, /and MN 21 later/);
		assert.equal([...html.matchAll(/<a\b/g)].length, 1);
	});
});
