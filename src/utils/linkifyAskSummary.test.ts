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
});

describe("normalizeAskSummaryProse", () => {
	it("keeps paragraphs and clips length", () => {
		assert.equal(
			normalizeAskSummaryProse("  First. \n\n  Second.  "),
			"First.\n\nSecond.",
		);
		assert.equal(normalizeAskSummaryProse("abcdefghij", 6), "abcdef");
	});
});
