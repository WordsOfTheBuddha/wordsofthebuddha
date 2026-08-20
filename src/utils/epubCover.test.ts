import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEpubCoverModel, renderEpubCoverPng, renderEpubCoverSvg } from "./epubCover";

describe("buildEpubCoverModel", () => {
	it("uses the Discover collection accent and names", () => {
		const model = buildEpubCoverModel({
			slug: "mn",
			title: "Majjhima Nikāya - Middle Length Discourses",
			kind: "collection",
			discourseCount: 152,
		});
		assert.equal(model.kind, "collection");
		assert.equal(model.accent, "#d47445");
		assert.equal(model.kicker, "MN");
		assert.equal(model.title, "Majjhima Nikāya");
		assert.equal(model.footerLeft, "");
		assert.equal(model.footerRight, "Words of the Buddha");
	});

	it("marks a nested range as a section of the parent collection", () => {
		const model = buildEpubCoverModel({
			slug: "dn14-23",
			title: "Mahāvagga - The Great Division",
			parentTitle: "Dīgha Nikāya - Long Discourses",
			kind: "section",
			discourseCount: 3,
		});
		assert.equal(model.kind, "section");
		assert.equal(model.accent, "#8b5a6b");
		assert.equal(model.ribbon, undefined);
		assert.equal(model.title, "Mahāvagga");
		assert.match(model.relation ?? "", /Dīgha Nikāya/);
	});

	it("uses topic accent for /on pages", () => {
		const model = buildEpubCoverModel({
			slug: "radical-attention",
			title: "Radical Attention",
			kind: "topic",
			accentRole: "topic",
			discourseCount: 12,
		});
		assert.equal(model.kind, "topic");
		assert.equal(model.accent, "#2563eb");
		assert.equal(model.kicker, "");
		assert.equal(model.ribbon, undefined);
		assert.equal(model.subtitle, "");
		assert.equal(model.title, "Radical Attention");
		assert.equal(model.footerLeft, "");
	});

	it("renders a PNG library thumbnail", async () => {
		const model = buildEpubCoverModel({
			slug: "radical-attention",
			title: "Radical Attention",
			kind: "topic",
			accentRole: "topic",
			discourseCount: 51,
		});
		const png = await renderEpubCoverPng(model);
		assert.equal(png[0], 0x89);
		assert.equal(png.toString("ascii", 1, 4), "PNG");
		assert.ok(png.length > 10_000);
	});

	it("keeps topic covers to title and brand", () => {
		const model = buildEpubCoverModel({
			slug: "perceiving-drawback",
			title: "Perceiving Drawback",
			kind: "topic",
			accentRole: "positive",
			discourseCount: 22,
		});
		const svg = renderEpubCoverSvg(model);
		assert.match(svg, /Perceiving/);
		assert.match(svg, /Drawback/);
		assert.match(svg, /Words of the Buddha/);
		assert.doesNotMatch(svg, />ON</);
		assert.doesNotMatch(svg, />QUALITY</);
		assert.doesNotMatch(svg, />Quality</);
		assert.doesNotMatch(svg, /discourses/);
		assert.match(svg, /font-size="56"/);
		assert.match(
			svg,
			/<text x="400" y="1130"[^>]*font-family="Georgia, serif"[^>]*font-size="56" font-weight="500">Words of the Buddha<\/text>/,
		);
		assert.doesNotMatch(
			svg,
			/y="1130"[^>]*font-weight="600"/,
		);
		const titleY = svg.match(
			/<text x="400" y="(\d+)"[^>]*font-size="64"/,
		);
		assert.ok(titleY);
		const y = Number(titleY[1]);
		assert.ok(y >= 540 && y <= 760, `title y ${y} should be vertically centered`);
	});

	it("drops the Section badge and uses dark readable secondary type", () => {
		const model = buildEpubCoverModel({
			slug: "snp4",
			title: "Aṭṭhakavagga - The Chapter of Eights",
			parentTitle: "Sutta Nipāta - The Sutta Collection",
			kind: "section",
			discourseCount: 16,
		});
		assert.equal(model.ribbon, undefined);
		const svg = renderEpubCoverSvg(model);
		assert.doesNotMatch(svg, />SECTION</);
		assert.match(svg, /SNP 4/);
		assert.match(svg, /The Chapter of Eights/);
		assert.match(svg, /from Sutta Nipāta/);
		assert.match(svg, /font-size="52"/);
		assert.match(svg, /font-size="56"/);
		assert.match(svg, /font-size="50"/);
		assert.match(svg, /font-size="56"/);
		assert.doesNotMatch(
			svg,
			/fill="#6f675e" font-family="Georgia, serif" font-size="24"/,
		);
	});
});
