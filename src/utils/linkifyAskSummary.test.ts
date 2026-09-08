import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	discourseIdAliases,
	linkifyAskSummaryHtml,
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
