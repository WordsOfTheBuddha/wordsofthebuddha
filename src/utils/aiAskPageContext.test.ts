import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_PAGE_TOTAL_MAX,
	formatAskPageContextBlock,
	pageContextGuidance,
	pageContextPlannerHint,
	parseAskPageContext,
} from "./aiAskPageContext";

describe("parseAskPageContext", () => {
	it("returns null for missing/invalid input", () => {
		assert.equal(parseAskPageContext(null), null);
		assert.equal(parseAskPageContext({}), null);
		assert.equal(parseAskPageContext({ slug: "mn1" }), null);
	});

	it("clips english + pali to the total budget", () => {
		const ctx = parseAskPageContext({
			slug: "MN1",
			title: "The Root of All Things",
			english: "e".repeat(8000),
			pali: "p".repeat(8000),
		});
		assert.ok(ctx);
		assert.equal(ctx?.slug, "mn1");
		assert.ok((ctx?.english?.length || 0) + (ctx?.pali?.length || 0) <= ASK_PAGE_TOTAL_MAX);
	});

	it("formats a planner block with both sides", () => {
		const block = formatAskPageContextBlock({
			slug: "mn1",
			title: "Roots",
			english: "Bhikkhus, ...",
			pali: "Bhikkhave, ...",
		});
		assert.ok(block.includes("Current discourse (mn1 — Roots)"));
		assert.ok(block.includes("English:"));
		assert.ok(block.includes("Pali:"));
	});

	it("guidance names the current page", () => {
		assert.ok(pageContextGuidance({ slug: "mn1" }).includes("mn1"));
		assert.equal(pageContextGuidance(null), "");
	});

	it("planner hint is short and names the page", () => {
		const hint = pageContextPlannerHint({
			slug: "an7.61",
			title: "Some title",
			english: "x".repeat(6000),
		});
		assert.ok(hint.includes("an7.61"));
		assert.ok(hint.length < 300);
		assert.equal(pageContextPlannerHint(null), "");
	});
});
