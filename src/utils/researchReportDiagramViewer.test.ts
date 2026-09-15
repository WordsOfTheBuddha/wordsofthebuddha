import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	clampDiagramZoom,
	computeDiagramFitScale,
	enhanceResearchReportDiagrams,
	readSvgNaturalSize,
} from "./researchReportDiagramViewer";

describe("researchReportDiagramViewer helpers", () => {
	it("clamps zoom to configured bounds", () => {
		assert.equal(clampDiagramZoom(0.05), 0.2);
		assert.equal(clampDiagramZoom(10), 5);
		assert.equal(clampDiagramZoom(1.5), 1.5);
	});

	it("computes fit scale from natural and viewport width", () => {
		assert.equal(computeDiagramFitScale(1000, 500, 0), 0.5);
		assert.equal(computeDiagramFitScale(400, 500, 0), 1);
	});

	it("reads svg size from viewBox", () => {
		const dom = new JSDOM('<!DOCTYPE html><svg viewBox="0 0 1200 800"></svg>');
		const svg = dom.window.document.querySelector("svg")!;
		assert.deepEqual(readSvgNaturalSize(svg as SVGSVGElement), {
			width: 1200,
			height: 800,
		});
	});
});

describe("enhanceResearchReportDiagrams", () => {
	it("wraps a diagram svg with viewer controls", () => {
		const dom = new JSDOM(
			`<!DOCTYPE html><body><div class="ai-report-diagram"><svg viewBox="0 0 200 100"></svg></div></body></html>`,
		);
		const { document, HTMLElement, SVGElement } = dom.window;
		globalThis.document = document;
		globalThis.HTMLElement = HTMLElement as typeof globalThis.HTMLElement;
		globalThis.SVGElement = SVGElement as typeof globalThis.SVGElement;
		globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
			cb(0);
			return 0;
		};

		enhanceResearchReportDiagrams(document.body);

		const diagram = document.querySelector(".ai-report-diagram")!;
		assert.equal(diagram.getAttribute("data-diagram-viewer"), "1");
		assert.ok(diagram.querySelector(".ai-diagram-toolbar"));
		assert.ok(diagram.querySelector(".ai-diagram-viewport"));
		assert.ok(diagram.querySelector(".ai-diagram-scroll"));
		assert.ok(diagram.querySelector(".ai-diagram-canvas svg"));
		assert.equal(
			diagram.querySelectorAll("[data-diagram-action]").length,
			3,
		);
	});
});
