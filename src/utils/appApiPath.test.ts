import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isAppApiCatchAllId,
	researchApiFailureMessage,
	rewriteResearchApiPath,
} from "./appApiPath";

describe("isAppApiCatchAllId", () => {
	it("treats /api paths as app routes, not discourse slugs", () => {
		assert.equal(isAppApiCatchAllId("api/ai/research/revise"), true);
		assert.equal(
			isAppApiCatchAllId("api/ai/research/b6a24e6f-62f8-42e4-95cc-6f1d45991044"),
			true,
		);
		assert.equal(isAppApiCatchAllId("api"), true);
		assert.equal(isAppApiCatchAllId("/api/ai/research"), true);
		assert.equal(isAppApiCatchAllId("mn10"), false);
		assert.equal(isAppApiCatchAllId("research/some-share"), false);
	});
});

describe("rewriteResearchApiPath", () => {
	it("maps public Research URLs onto sibling endpoints Astro registers", () => {
		assert.equal(rewriteResearchApiPath("/api/ai/research"), "/api/ai/research-start");
		assert.equal(
			rewriteResearchApiPath("/api/ai/research/revise"),
			"/api/ai/research-revise",
		);
		assert.equal(rewriteResearchApiPath("/api/ai/research/run"), "/api/ai/research-run");
		assert.equal(
			rewriteResearchApiPath("/api/ai/research/revise-run"),
			"/api/ai/research-revise-run",
		);
		assert.equal(
			rewriteResearchApiPath("/api/ai/research/b6a24e6f-62f8-42e4-95cc-6f1d45991044"),
			"/api/ai/research-job/b6a24e6f-62f8-42e4-95cc-6f1d45991044",
		);
		assert.equal(rewriteResearchApiPath("/api/ai/research/clarify"), null);
		assert.equal(rewriteResearchApiPath("/api/ai/quota"), null);
	});
});

describe("researchApiFailureMessage", () => {
	it("keeps missing Firestore jobs distinct from a routing miss", () => {
		assert.equal(
			researchApiFailureMessage({
				status: 404,
				code: "not_found",
				error: "Research not found.",
			}),
			"Research not found.",
		);
		assert.equal(
			researchApiFailureMessage({
				status: 404,
				code: "route_miss",
				error: "Not found.",
			}),
			"Could not reach the research server. Refresh the page and try again.",
		);
		assert.equal(
			researchApiFailureMessage({ status: 404, error: "Not found." }),
			"Could not reach the research server. Refresh the page and try again.",
		);
	});
});
