import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	IMAGE_OVERLAY_ZOOM_MAX,
	IMAGE_OVERLAY_ZOOM_MIN,
	researchContextImageDataUrl,
	researchContextImageFilename,
	stepImageOverlayZoom,
} from "./researchImageOverlay";

describe("researchImageOverlay", () => {
	it("builds a data URL from attached image bytes", () => {
		assert.equal(
			researchContextImageDataUrl({ mime: "image/png", data: "abc" }),
			"data:image/png;base64,abc",
		);
	});

	it("maps common mime types to download filenames", () => {
		assert.equal(
			researchContextImageFilename({ mime: "image/jpeg" }, 2),
			"research-image-3.jpg",
		);
		assert.equal(
			researchContextImageFilename({ mime: "image/unknown" }),
			"research-image-1.png",
		);
	});

	it("steps zoom within bounds", () => {
		assert.equal(stepImageOverlayZoom(1, "in"), 1.25);
		assert.equal(stepImageOverlayZoom(1.25, "out"), 1);
		assert.equal(stepImageOverlayZoom(IMAGE_OVERLAY_ZOOM_MAX, "in"), IMAGE_OVERLAY_ZOOM_MAX);
		assert.equal(stepImageOverlayZoom(IMAGE_OVERLAY_ZOOM_MIN, "out"), IMAGE_OVERLAY_ZOOM_MIN);
	});
});
