import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_ANON_DAILY_LIMIT,
	ASK_FEEDBACK_BONUS,
	ASK_SIGNED_IN_DAILY_LIMIT,
	applyAskFeedbackBonus,
	askQuotaSubjectKey,
	consumeAskQuotaState,
	dismissAskFeedbackPrompt,
	emptyAskQuotaState,
	isAskQuotaSignedIn,
	isValidAskUserReview,
	toAskQuotaView,
} from "./aiAskQuota";

describe("askQuotaSubjectKey", () => {
	it("uses user id when signed in", () => {
		assert.deepEqual(
			askQuotaSubjectKey({ signedIn: true, uid: "abc", ip: "1.1.1.1" }),
			{ subjectKind: "user", subjectKey: "user:abc" },
		);
	});

	it("falls back to anon IP", () => {
		assert.deepEqual(
			askQuotaSubjectKey({ signedIn: false, uid: null, ip: "9.9.9.9" }),
			{ subjectKind: "anon", subjectKey: "anon:9.9.9.9" },
		);
	});
});

describe("isAskQuotaSignedIn", () => {
	it("requires a verified email", () => {
		assert.equal(isAskQuotaSignedIn({ uid: "u1", emailVerified: true }), true);
		assert.equal(isAskQuotaSignedIn({ uid: "u1", emailVerified: false }), false);
		assert.equal(isAskQuotaSignedIn(null), false);
	});
});

describe("toAskQuotaView needsEmailVerification", () => {
	it("flags pending verification on the anon bucket view", () => {
		const state = emptyAskQuotaState({
			day: "2026-09-03",
			subjectKind: "anon",
			subjectKey: "anon:1.1.1.1",
		});
		const view = toAskQuotaView(state, { needsEmailVerification: true });
		assert.equal(view.signedIn, false);
		assert.equal(view.needsEmailVerification, true);
		assert.equal(view.limit, ASK_ANON_DAILY_LIMIT);
	});
});

describe("consumeAskQuotaState", () => {
	it("enforces anonymous daily limit", () => {
		let state = emptyAskQuotaState({
			day: "2026-09-03",
			subjectKind: "anon",
			subjectKey: "anon:1.1.1.1",
		});
		assert.equal(state.baseLimit, ASK_ANON_DAILY_LIMIT);
		for (let i = 0; i < ASK_ANON_DAILY_LIMIT; i++) {
			const next = consumeAskQuotaState(state);
			assert.equal(next.state.used, i + 1);
			state = next.state;
		}
		assert.equal(state.used, ASK_ANON_DAILY_LIMIT);
		assert.equal(toAskQuotaView(state).remaining, 0);
		const blocked = consumeAskQuotaState(state);
		assert.equal(blocked.view.allowed, false);
		assert.equal(blocked.state.used, ASK_ANON_DAILY_LIMIT);
	});

	it("counts prior anonymous usage against a signed-in quota", () => {
		const state = emptyAskQuotaState({
			day: "2026-09-03",
			subjectKind: "user",
			subjectKey: "user:u1",
		});
		const priorUsed = ASK_ANON_DAILY_LIMIT;
		const view = toAskQuotaView(state, { priorUsed });
		assert.equal(view.used, priorUsed);
		assert.equal(view.remaining, ASK_SIGNED_IN_DAILY_LIMIT - priorUsed);
		assert.equal(view.allowed, true);

		const first = consumeAskQuotaState(state, { priorUsed });
		assert.equal(first.state.used, 1);
		assert.equal(first.view.used, priorUsed + 1);

		// 3 anon + 10 signed-in = 13 → next Ask blocked.
		let cursor = state;
		for (let i = 0; i < ASK_SIGNED_IN_DAILY_LIMIT - priorUsed; i++) {
			cursor = consumeAskQuotaState(cursor, { priorUsed }).state;
		}
		const blocked = consumeAskQuotaState(cursor, { priorUsed });
		assert.equal(blocked.view.allowed, false);
		assert.equal(blocked.view.used, ASK_SIGNED_IN_DAILY_LIMIT);
		assert.equal(blocked.state.used, ASK_SIGNED_IN_DAILY_LIMIT - priorUsed);
	});
});

describe("toAskQuotaView offerFeedback", () => {
	it("offers feedback at halfway for signed-in users", () => {
		const halfway = Math.ceil(ASK_SIGNED_IN_DAILY_LIMIT / 2);
		const state = {
			...emptyAskQuotaState({
				day: "2026-09-03",
				subjectKind: "user",
				subjectKey: "user:u1",
			}),
			used: halfway,
		};
		assert.equal(toAskQuotaView(state).offerFeedback, true);
		assert.equal(
			toAskQuotaView({ ...state, feedbackPromptDismissed: true }).offerFeedback,
			false,
		);
	});

	it("does not offer feedback for anonymous users", () => {
		const state = {
			...emptyAskQuotaState({
				day: "2026-09-03",
				subjectKind: "anon",
				subjectKey: "anon:1.1.1.1",
			}),
			used: ASK_ANON_DAILY_LIMIT,
		};
		assert.equal(toAskQuotaView(state).offerFeedback, false);
	});
});

describe("applyAskFeedbackBonus", () => {
	it("grants +5 once", () => {
		const state = emptyAskQuotaState({
			day: "2026-09-03",
			subjectKind: "user",
			subjectKey: "user:u1",
		});
		const first = applyAskFeedbackBonus(state);
		assert.equal(first.granted, true);
		assert.equal(first.view.limit, ASK_SIGNED_IN_DAILY_LIMIT + ASK_FEEDBACK_BONUS);
		const second = applyAskFeedbackBonus(first.state);
		assert.equal(second.granted, false);
	});
});

describe("isValidAskUserReview", () => {
	it("requires 30 characters", () => {
		assert.equal(isValidAskUserReview("too short"), false);
		assert.equal(
			isValidAskUserReview(
				"Ask helped me find satipaṭṭhāna discourses more easily today.",
			),
			true,
		);
	});
});

describe("dismissAskFeedbackPrompt", () => {
	it("stops offering feedback", () => {
		const halfway = Math.ceil(ASK_SIGNED_IN_DAILY_LIMIT / 2);
		const state = {
			...emptyAskQuotaState({
				day: "2026-09-03",
				subjectKind: "user",
				subjectKey: "user:u1",
			}),
			used: halfway,
		};
		assert.equal(toAskQuotaView(state).offerFeedback, true);
		assert.equal(
			toAskQuotaView(dismissAskFeedbackPrompt(state)).offerFeedback,
			false,
		);
	});
});
