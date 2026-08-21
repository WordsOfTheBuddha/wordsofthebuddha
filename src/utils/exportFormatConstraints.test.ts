import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyFormatConstraints } from "./exportFormatConstraints";
import type { PdfExportParams } from "./exportFormatConstraints";

const withViz: PdfExportParams = {
	downloadDate: "20 August 2026",
	imageMode: "svgAll",
	vizImageMode: "dark",
	pdfContentOptions: {
		includeKeyTermsSection: true,
		paliOptions: { enabled: true, layout: "split" },
	},
};

describe("applyFormatConstraints", () => {
	it("keeps images and light/dark viz for EPUB, and forces interleaved Pāli", () => {
		const out = applyFormatConstraints("epub", withViz);
		assert.equal(out.imageMode, "svgAll");
		assert.equal(out.vizImageMode, "dark");
		assert.equal(out.pdfContentOptions.keepSvgIntact, true);
		assert.deepEqual(out.pdfContentOptions.paliOptions, {
			enabled: true,
			layout: "interleaved",
		});
	});

	it("coerces thermal viz to e-ink for EPUB", () => {
		const out = applyFormatConstraints("epub", {
			...withViz,
			vizImageMode: "thermal",
		});
		assert.equal(out.vizImageMode, "eink");
	});

	it("keeps an explicit e-ink viz for EPUB", () => {
		const out = applyFormatConstraints("epub", {
			...withViz,
			vizImageMode: "eink",
		});
		assert.equal(out.vizImageMode, "eink");
	});

	it("coerces e-ink viz to light for PDF", () => {
		const out = applyFormatConstraints("pdf", {
			...withViz,
			vizImageMode: "eink",
		});
		assert.equal(out.vizImageMode, "light");
	});

	it("leaves PDF params unchanged", () => {
		const out = applyFormatConstraints("pdf", withViz);
		assert.equal(out, withViz);
		assert.equal(out.imageMode, "svgAll");
		assert.equal(out.vizImageMode, "dark");
	});
});
