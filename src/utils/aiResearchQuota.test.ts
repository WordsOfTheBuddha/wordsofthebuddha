import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	RESEARCH_CREDIT_REFUND_AFTER_MS,
	RESEARCH_DAILY_LIMIT,
	consumeResearchQuotaState,
	emptyResearchQuotaState,
	refundResearchQuotaState,
	researchQuotaDocId,
	shouldRefundResearchCredit,
	toResearchQuotaView,
} from "./aiResearchQuota";

describe("research quota", () => {
	it("allows two researches then blocks the third", () => {
		let state = emptyResearchQuotaState({
			day: "2026-09-09",
			uid: "u1",
		});
		assert.equal(state.limit, RESEARCH_DAILY_LIMIT);
		assert.equal(toResearchQuotaView(state).allowed, true);

		const first = consumeResearchQuotaState(state);
		assert.equal(first.state.used, 1);
		assert.equal(first.view.remaining, 1);
		state = first.state;

		const second = consumeResearchQuotaState(state);
		assert.equal(second.state.used, 2);
		assert.equal(second.view.remaining, 0);
		assert.equal(second.view.allowed, false);

		const blocked = consumeResearchQuotaState(second.state);
		assert.equal(blocked.state.used, 2);
		assert.equal(blocked.view.allowed, false);
	});

	it("restores a credit on refund without going below zero", () => {
		const spent = consumeResearchQuotaState(
			emptyResearchQuotaState({ day: "2026-09-09", uid: "u1" }),
		);
		const back = refundResearchQuotaState(spent.state);
		assert.equal(back.state.used, 0);
		assert.equal(back.view.remaining, RESEARCH_DAILY_LIMIT);
		assert.equal(back.view.allowed, true);
		const empty = refundResearchQuotaState(back.state);
		assert.equal(empty.state.used, 0);
	});

	it("refunds a failed job and a stop after the refund window, not an early stop", () => {
		const t0 = Date.parse("2026-09-09T12:00:00.000Z");
		assert.equal(
			shouldRefundResearchCredit({ status: "failed", createdAt: t0, now: t0 }),
			true,
		);
		assert.equal(
			shouldRefundResearchCredit({
				status: "cancelled",
				createdAt: t0,
				now: t0 + 4 * 60 * 1000,
			}),
			false,
		);
		assert.equal(
			shouldRefundResearchCredit({
				status: "cancelled",
				createdAt: t0,
				now: t0 + RESEARCH_CREDIT_REFUND_AFTER_MS,
			}),
			true,
		);
		assert.equal(
			shouldRefundResearchCredit({ status: "complete", createdAt: t0, now: t0 }),
			false,
		);
		assert.equal(
			shouldRefundResearchCredit({
				status: "complete",
				resultCount: 0,
				createdAt: t0,
				now: t0,
			}),
			true,
		);
		assert.equal(
			shouldRefundResearchCredit({
				status: "complete",
				resultCount: 12,
				createdAt: t0,
				now: t0,
			}),
			false,
		);
		assert.equal(
			shouldRefundResearchCredit({ status: "cancelled", now: t0 }),
			true,
		);
	});

	it("builds a slash-free Firestore doc id", () => {
		assert.equal(
			researchQuotaDocId("2026-09-09", "abc"),
			"2026-09-09_user:abc",
		);
	});
});
