import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clipDiscourseSvgRequestSlugs,
	contentImageBasenameMatchesSlug,
	discourseHasIllustration,
	discourseHasSvgIllustration,
	DISCOURSE_SVG_AI_PER_FILE,
	loadDiscourseSvgMarkupForAi,
	loadDiscourseSvgSummaryForAi,
	withIllustrationFlags,
} from "./discourseSvgForAi";

describe("contentImageBasenameMatchesSlug", () => {
	it("matches exact and suffix files, not a longer id", () => {
		assert.equal(contentImageBasenameMatchesSlug("sn36.6.svg", "sn36.6"), true);
		assert.equal(
			contentImageBasenameMatchesSlug("sn36.6-alt.svg", "sn36.6"),
			true,
		);
		assert.equal(contentImageBasenameMatchesSlug("sn36.60.svg", "sn36.6"), false);
	});
});

describe("discourse SVG for Ask", () => {
	it("flags and loads the SN 36.6 site illustration", () => {
		assert.equal(discourseHasIllustration("sn36.6"), true);
		assert.equal(discourseHasIllustration("mn70"), false);
		const flagged = withIllustrationFlags([
			{ slug: "sn36.6" },
			{ slug: "mn70" },
		]);
		assert.equal(flagged[0]?.hasIllustration, true);
		assert.equal(flagged[1]?.hasIllustration, undefined);
		const svg = loadDiscourseSvgMarkupForAi("sn36.6", 4000);
		assert.ok(svg);
		assert.match(svg, /<svg/i);
		assert.match(svg, /truncated/);
	});

	it("summarizes labels instead of shipping coordinates", () => {
		const summary = loadDiscourseSvgSummaryForAi("sn36.6", 800);
		assert.ok(summary);
		assert.match(summary, /viewBox /);
		assert.match(summary, /The Dart/i);
		assert.doesNotMatch(summary, /<linearGradient/i);
		assert.ok((summary || "").length <= 802);
	});

	it("loads the full SN 36.6 SVG under the on-request cap", () => {
		const svg = loadDiscourseSvgMarkupForAi("sn36.6");
		assert.ok(svg);
		assert.ok(svg.length > 20_000);
		assert.ok(svg.length <= DISCOURSE_SVG_AI_PER_FILE);
		assert.doesNotMatch(svg, /truncated/);
	});

	it("treats raster-only discourses as illustrated without SVG markup", () => {
		assert.equal(discourseHasIllustration("an3.65"), true);
		assert.equal(discourseHasSvgIllustration("an3.65"), false);
		assert.equal(loadDiscourseSvgSummaryForAi("an3.65"), undefined);
	});

	it("clips illustration requests to two SVG discourses", () => {
		assert.deepEqual(
			clipDiscourseSvgRequestSlugs([
				"sn36.6",
				"an3.65",
				"mn10",
				"dn22",
				"mn70",
			]),
			["sn36.6", "mn10"],
		);
	});
});
