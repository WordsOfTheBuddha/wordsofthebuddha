import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
	contentImageBasenameMatchesSlug,
	DISCOURSE_SVG_AI_MAX_REQUESTED,
	normalizeDiscourseSvgRequestSlugs,
	normalizeDiscourseSvgSlug,
} from "./discourseSvgForAiPure";

describe("discourseSvgForAiPure", () => {
	it("stays free of node: imports so client bundles can use it", () => {
		const src = readFileSync(
			fileURLToPath(new URL("./discourseSvgForAiPure.ts", import.meta.url)),
			"utf8",
		);
		assert.doesNotMatch(src, /from\s+["']node:/);
		assert.doesNotMatch(src, /import\s*\(\s*["']node:/);
	});

	it("normalizes slugs like the site discovery rule", () => {
		assert.equal(normalizeDiscourseSvgSlug("  /SN36.6/ "), "sn36.6");
		assert.equal(contentImageBasenameMatchesSlug("sn36.6-alt.svg", "sn36.6"), true);
		assert.equal(contentImageBasenameMatchesSlug("sn36.60.svg", "sn36.6"), false);
	});

	it("normalizes, dedupes, and caps without touching disk", () => {
		assert.deepEqual(
			normalizeDiscourseSvgRequestSlugs([" SN36.6 ", "sn36.6", "mn1", "dn2", "sn3"]),
			["sn36.6", "mn1"],
		);
		assert.equal(
			normalizeDiscourseSvgRequestSlugs(["a1", "b2"], 1).length,
			1,
		);
		assert.deepEqual(normalizeDiscourseSvgRequestSlugs([]), []);
		assert.equal(DISCOURSE_SVG_AI_MAX_REQUESTED, 2);
	});
});
