import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askAdminHref,
	filterAskAdminRows,
	filterAskUserReviewRows,
	joinAskTelemetryDocs,
	joinAskUserReviewDocs,
	parseAskAdminQuery,
	sinceCutoffIso,
	summarizeAskAdminRows,
} from "./aiAskTelemetryQuery";

describe("joinAskTelemetryDocs", () => {
	it("joins asks with feedback and review by requestId", () => {
		const rows = joinAskTelemetryDocs([
			{
				kind: "ask",
				requestId: "a1",
				question: "full moon",
				queries: ["SN 22.82"],
				resultSlugs: ["sn22.82"],
				reasoning: "Look up Puṇṇama",
				createdAt: "2026-09-03T10:00:00.000Z",
			},
			{
				kind: "feedback",
				requestId: "a1",
				rating: "up",
				createdAt: "2026-09-03T10:01:00.000Z",
			},
			{
				kind: "review",
				requestId: "a1",
				reviewed: true,
				reviewedBy: "admin@example.com",
				createdAt: "2026-09-03T10:02:00.000Z",
			},
			{
				kind: "ask",
				requestId: "a2",
				question: "anger",
				queries: ["kodha"],
				resultSlugs: ["iti4"],
				createdAt: "2026-09-03T11:00:00.000Z",
			},
		]);
		assert.equal(rows.length, 2);
		assert.equal(rows[0]?.requestId, "a2");
		assert.equal(rows[1]?.rating, "up");
		assert.equal(rows[1]?.reviewed, true);
		assert.equal(rows[1]?.reasoning, "Look up Puṇṇama");
		assert.equal(rows[0]?.reviewed, false);
		const summary = summarizeAskAdminRows(rows);
		assert.deepEqual(summary, {
			totalAsks: 2,
			withFeedback: 1,
			up: 1,
			down: 0,
			none: 1,
			needsReview: 1,
			reviewed: 1,
			userReviews: 0,
		});
		assert.equal(
			filterAskAdminRows(rows, {
				rating: "all",
				status: "needs",
				since: "all",
				view: "asks",
			}).length,
			1,
		);
		assert.equal(filterAskAdminRows(rows, "up").length, 1);
	});

	it("dedupes ask docs and keeps newest review", () => {
		const rows = joinAskTelemetryDocs([
			{
				kind: "ask",
				requestId: "a1",
				question: "old",
				createdAt: "2026-09-01T00:00:00.000Z",
			},
			{
				kind: "ask",
				requestId: "a1",
				question: "new",
				reasoning: "fresh",
				createdAt: "2026-09-02T00:00:00.000Z",
			},
			{
				kind: "review",
				requestId: "a1",
				reviewed: true,
				createdAt: "2026-09-02T01:00:00.000Z",
			},
			{
				kind: "review",
				requestId: "a1",
				reviewed: false,
				createdAt: "2026-09-02T02:00:00.000Z",
			},
		]);
		assert.equal(rows.length, 1);
		assert.equal(rows[0]?.question, "new");
		assert.equal(rows[0]?.reviewed, false);
	});
});

describe("joinAskUserReviewDocs", () => {
	it("collects written notes and ignores asks", () => {
		const notes = joinAskUserReviewDocs([
			{
				kind: "userReview",
				requestId: "n1",
				text: "The halfway prompt felt fair and the extra Asks helped.",
				email: "reader@example.com",
				uid: "uid-1",
				day: "2026-09-03",
				createdAt: "2026-09-03T12:00:00.000Z",
			},
			{
				kind: "ask",
				requestId: "a1",
				question: "anger",
				createdAt: "2026-09-03T11:00:00.000Z",
			},
		]);
		assert.equal(notes.length, 1);
		assert.equal(notes[0]?.email, "reader@example.com");
		assert.equal(
			filterAskUserReviewRows(notes, "all").length,
			1,
		);
		const summary = summarizeAskAdminRows([], notes);
		assert.equal(summary.userReviews, 1);
		assert.equal(summary.totalAsks, 0);
	});
});

describe("parseAskAdminQuery", () => {
	it("defaults to needs review and 30d", () => {
		assert.deepEqual(parseAskAdminQuery(new URLSearchParams()), {
			rating: "all",
			status: "needs",
			since: "30d",
			view: "asks",
		});
	});

	it("builds compact hrefs", () => {
		assert.equal(askAdminHref({}), "/admin/ask");
		assert.equal(
			askAdminHref({ rating: "down", status: "all", since: "7d" }),
			"/admin/ask?filter=down&status=all&since=7d",
		);
		assert.equal(
			askAdminHref({ view: "notes" }),
			"/admin/ask?view=notes",
		);
	});
});

describe("sinceCutoffIso", () => {
	it("returns null for all and a past ISO for windows", () => {
		assert.equal(sinceCutoffIso("all"), null);
		const now = Date.parse("2026-09-03T12:00:00.000Z");
		assert.equal(sinceCutoffIso("24h", now), "2026-09-02T12:00:00.000Z");
	});
});
