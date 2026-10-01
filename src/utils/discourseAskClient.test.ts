import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DASK_MANUAL_RETRIES,
	daskPriorErrorCount,
	openDiscourseAskLinksInNewTab,
} from "./discourseAskClient";

describe("daskPriorErrorCount", () => {
	it("caps manual retries at two per question", () => {
		assert.equal(DASK_MANUAL_RETRIES, 2);
		const failed = (question: string) => ({ question, error: "Timed out." });
		const ok = (question: string) => ({ question });
		assert.equal(daskPriorErrorCount([failed("a")], 0), 0);
		assert.equal(
			daskPriorErrorCount([failed("a"), failed("a")], 1),
			1,
		);
		assert.equal(
			daskPriorErrorCount([failed("a"), failed("a"), failed("a")], 2),
			2,
		);
	});

	it("resets on success or a different question", () => {
		const failed = (question: string) => ({ question, error: "Timed out." });
		assert.equal(
			daskPriorErrorCount(
				[failed("a"), { question: "a" }, failed("a")],
				2,
			),
			0,
		);
		assert.equal(daskPriorErrorCount([failed("a"), failed("b")], 1), 0);
		assert.equal(daskPriorErrorCount([], 0), 0);
	});

	it("matches case-insensitively like history keys", () => {
		const failed = (question: string) => ({ question, error: "Timed out." });
		assert.equal(daskPriorErrorCount([failed("What is Sati?")], 0), 0);
		assert.equal(
			daskPriorErrorCount(
				[failed("What is sati?"), failed("WHAT IS SATI?")],
				1,
			),
			1,
		);
	});
});

describe("openDiscourseAskLinksInNewTab", () => {
	it("opens discourse, search, and history links in a new tab", () => {
		const html = openDiscourseAskLinksInNewTab(
			`<p><a class="ai-summary-ref" href="/sn10.8#3">SN 10.8</a></p>` +
				`<a class="ai-source-ref" href="/mn143">MN 143</a>` +
				`<a class="ai-query-chip" href="/search?q=sati">sati</a>`,
		);
		assert.equal(html.match(/target="_blank"/g)?.length, 3);
		assert.equal(html.match(/rel="noopener noreferrer"/g)?.length, 3);
		assert.ok(html.includes('href="/sn10.8#3"'));
	});

	it("leaves in-page fragments and existing targets alone", () => {
		const html = openDiscourseAskLinksInNewTab(
			`<a href="#note">note</a><a href="/mn1" target="_self" rel="nofollow">MN 1</a>`,
		);
		assert.equal(html, `<a href="#note">note</a><a href="/mn1" target="_self" rel="nofollow">MN 1</a>`);
	});
});
