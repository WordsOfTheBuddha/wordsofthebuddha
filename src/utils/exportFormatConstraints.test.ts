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
	it("disables images and viz for EPUB even if the client requested them", () => {
		const out = applyFormatConstraints("epub", withViz);
		assert.equal(out.imageMode, "none");
		assert.equal(out.vizImageMode, undefined);
		assert.equal(out.pdfContentOptions.keepSvgIntact, true);
		assert.deepEqual(out.pdfContentOptions.paliOptions, {
			enabled: true,
			layout: "interleaved",
		});
	});

	it("leaves PDF params unchanged", () => {
		const out = applyFormatConstraints("pdf", withViz);
		assert.equal(out, withViz);
		assert.equal(out.imageMode, "svgAll");
		assert.equal(out.vizImageMode, "dark");
	});
});
