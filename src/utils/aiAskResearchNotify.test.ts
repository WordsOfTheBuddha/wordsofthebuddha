import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	researchHistoryStatusLabel,
	researchNotifyBody,
	researchNotifyUrl,
	RESEARCH_NOTIFY_TITLE,
} from "./aiAskResearchNotify";

describe("research notify helpers", () => {
	it("builds a relative result URL", () => {
		assert.equal(
			researchNotifyUrl("job-1"),
			"/search?mode=ai&research=job-1",
		);
	});

	it("clips the notification body", () => {
		assert.equal(researchNotifyBody("  sekkha  "), "sekkha");
		assert.equal(researchNotifyBody("x".repeat(200)).length, 140);
		assert.equal(RESEARCH_NOTIFY_TITLE, "Your research is ready");
	});
});

describe("researchHistoryStatusLabel", () => {
	it("names pending, unread, and finished research", () => {
		assert.equal(researchHistoryStatusLabel({ research: true, researchPending: true }), "Researching…");
		assert.equal(researchHistoryStatusLabel({ research: true, researchUnread: true }), "Research ready");
		assert.equal(researchHistoryStatusLabel({ research: true }), "Research");
		assert.equal(researchHistoryStatusLabel({}), "");
	});
});
