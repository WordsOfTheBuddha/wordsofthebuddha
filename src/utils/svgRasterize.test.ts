import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ensureSvgHasPixelSize,
	htmlForSvgRaster,
	parseSvgPixelSize,
	rasterizeSvgWithResvg,
	stripXmlDeclaration,
	wrapSvgForVizMode,
} from "./svgRasterize";

describe("parseSvgPixelSize", () => {
	it("prefers width/height on the root svg over viewBox", () => {
		const svg = `<svg viewBox="0 0 100 50" width="920" height="1490"></svg>`;
		assert.deepEqual(parseSvgPixelSize(svg), { width: 920, height: 1490 });
	});

	it("uses viewBox when width/height were stripped", () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 4050"></svg>`;
		assert.deepEqual(parseSvgPixelSize(svg), { width: 920, height: 4050 });
	});

	it("derives the missing side from viewBox when only width is set", () => {
		const svg = `<svg width="460" viewBox="0 0 920 1490"></svg>`;
		assert.deepEqual(parseSvgPixelSize(svg), { width: 460, height: 745 });
	});
});

describe("ensureSvgHasPixelSize", () => {
	it("writes width and height on the root svg", () => {
		const out = ensureSvgHasPixelSize(
			`<svg viewBox="0 0 10 20"><rect /></svg>`,
			80,
			160,
		);
		assert.match(out, /<svg width="80" height="160"/);
		assert.match(out, /viewBox="0 0 10 20"/);
	});
});

describe("htmlForSvgRaster", () => {
	it("drops the XML declaration and sizes the page to the SVG", () => {
		const html = htmlForSvgRaster(
			`<?xml version="1.0"?><svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#0b1528" opacity="0.4"/></svg>`,
			10,
			10,
		);
		assert.doesNotMatch(html, /<\?xml/);
		assert.match(html, /width: 10px/);
		assert.match(html, /height: 10px/);
		assert.match(html, /<svg width="10" height="10"/);
		assert.doesNotMatch(html, /epub-viz-light/);
	});

	it("applies the site light-mode CSS filter", () => {
		const html = htmlForSvgRaster(
			`<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#0b1528"/></svg>`,
			10,
			10,
			"light",
		);
		assert.match(html, /id="epub-viz-light"/);
		assert.match(html, /hueRotate/);
		assert.match(html, /background: #ffffff/);
	});

	it("applies the e-ink paper filter and warm page", () => {
		const html = htmlForSvgRaster(
			`<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#0b1528"/></svg>`,
			10,
			10,
			"eink",
		);
		assert.match(html, /id="epub-viz-eink"/);
		assert.match(html, /saturate" values="0"/);
		assert.doesNotMatch(html, /hueRotate/);
		assert.match(html, /background: #f4f1ea/);
	});
});

describe("wrapSvgForVizMode", () => {
	it("leaves dark diagrams unchanged", () => {
		const svg = `<svg viewBox="0 0 10 10"><rect /></svg>`;
		assert.equal(wrapSvgForVizMode(svg, "dark"), svg);
	});

	it("wraps light diagrams in the invert/hue-rotate filter", () => {
		const out = wrapSvgForVizMode(
			`<svg width="10" height="10" viewBox="0 0 10 10"><rect /></svg>`,
			"light",
		);
		assert.match(out, /id="epub-viz-light"/);
		assert.match(out, /<g filter="url\(#epub-viz-light\)">/);
		assert.match(out, /<\/g><\/svg>/);
	});

	it("wraps e-ink diagrams in invert/grayscale without thermal brightness", () => {
		const out = wrapSvgForVizMode(
			`<svg width="10" height="10" viewBox="0 0 10 10"><rect /></svg>`,
			"eink",
		);
		assert.match(out, /id="epub-viz-eink"/);
		assert.match(out, /saturate" values="0"/);
		assert.match(out, /slope="1.2"/);
		assert.doesNotMatch(out, /slope="1.368"/);
		assert.doesNotMatch(out, /hueRotate/);
	});
});

describe("stripXmlDeclaration", () => {
	it("removes a leading XML declaration", () => {
		assert.equal(
			stripXmlDeclaration(`<?xml version="1.0" encoding="UTF-8"?>\n<svg/>`),
			`<svg/>`,
		);
	});
});

describe("rasterizeSvgWithResvg", () => {
	it("emits a PNG at the SVG's own pixel size", async () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><rect width="80" height="40" fill="#0b1528"/><rect x="4" y="4" width="8" height="8" fill="#c8a040" opacity="0.35"/></svg>`;
		const png = await rasterizeSvgWithResvg(svg);
		assert.equal(png[0], 0x89);
		assert.equal(png.toString("ascii", 1, 4), "PNG");
		assert.equal(png.readUInt32BE(16), 80);
		assert.equal(png.readUInt32BE(20), 40);
	});

	it("emits a different PNG for light vs dark", async () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><rect width="80" height="40" fill="#0b1528"/></svg>`;
		const dark = await rasterizeSvgWithResvg(svg, { vizMode: "dark" });
		const light = await rasterizeSvgWithResvg(svg, { vizMode: "light" });
		assert.equal(dark.equals(light), false);
	});

	it("emits a different PNG for e-ink vs light vs thermal", async () => {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><rect width="80" height="40" fill="#0b1528"/></svg>`;
		const light = await rasterizeSvgWithResvg(svg, { vizMode: "light" });
		const eink = await rasterizeSvgWithResvg(svg, { vizMode: "eink" });
		const thermal = await rasterizeSvgWithResvg(svg, { vizMode: "thermal" });
		assert.equal(light.equals(eink), false);
		assert.equal(eink.equals(thermal), false);
	});
});
