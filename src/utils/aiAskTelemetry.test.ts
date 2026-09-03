import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAiAskTelemetryAskEvent,
	buildAiAskTelemetryFeedbackEvent,
	buildAiAskTelemetryReviewEvent,
	buildAiAskTelemetryUserReviewEvent,
	parseAiAskFeedbackRating,
} from "./aiAskTelemetry";

describe("buildAiAskTelemetryAskEvent", () => {
	it("clips fields and counts result slugs", () => {
		const event = buildAiAskTelemetryAskEvent({
			requestId: "req-1",
			question: "  full moon  ",
			lookingFor: "Puṇṇama",
			queries: ["SN 22.82", "MN 109"],
			fallbackQueries: ["full moon night"],
			resultSlugs: ["sn22.82", "mn109", "mn110"],
			model: "nvidia/nemotron-3-ultra-550b-a55b:free",
			reasoning: "Use SN 22.82 from the catalog.\n\nThen search.",
			ms: 1234.6,
		});
		assert.equal(event.kind, "ask");
		assert.equal(event.question, "full moon");
		assert.deepEqual(event.queries, ["SN 22.82", "MN 109"]);
		assert.equal(event.resultCount, 3);
		assert.equal(event.ms, 1235);
		assert.match(event.reasoning, /SN 22\.82/);
	});
});

describe("buildAiAskTelemetryReviewEvent", () => {
	it("stores reviewed flag and admin email", () => {
		const event = buildAiAskTelemetryReviewEvent({
			requestId: "req-1",
			reviewed: true,
			reviewedBy: "admin@example.com",
		});
		assert.equal(event.kind, "review");
		assert.equal(event.reviewed, true);
		assert.equal(event.reviewedBy, "admin@example.com");
	});
});

describe("parseAiAskFeedbackRating", () => {
	it("accepts up/down only", () => {
		assert.equal(parseAiAskFeedbackRating("up"), "up");
		assert.equal(parseAiAskFeedbackRating("down"), "down");
		assert.equal(parseAiAskFeedbackRating("ok"), null);
	});
});

describe("buildAiAskTelemetryFeedbackEvent", () => {
	it("keeps rating and request id", () => {
		const event = buildAiAskTelemetryFeedbackEvent({
			requestId: "req-1",
			rating: "up",
			question: "full moon",
			queries: ["sn22.82"],
			resultSlugs: ["sn22.82"],
		});
		assert.equal(event.kind, "feedback");
		assert.equal(event.rating, "up");
		assert.equal(event.requestId, "req-1");
	});
});

describe("buildAiAskTelemetryUserReviewEvent", () => {
	it("clips written feedback", () => {
		const event = buildAiAskTelemetryUserReviewEvent({
			requestId: "rev-1",
			text: "  The halfway prompt was clear and the extra Asks were useful.  ",
			email: "reader@example.com",
			uid: "uid-1",
			day: "2026-09-03",
		});
		assert.equal(event.kind, "userReview");
		assert.match(event.text, /halfway prompt/);
		assert.equal(event.uid, "uid-1");
		assert.equal(event.day, "2026-09-03");
	});
});
