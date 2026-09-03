/** Pure Ask metering helpers (no I/O). */

export const ASK_ANON_DAILY_LIMIT = 3;
export const ASK_SIGNED_IN_DAILY_LIMIT = 13;
export const ASK_FEEDBACK_BONUS = 5;
export const ASK_FEEDBACK_MIN_CHARS = 30;

export type AskQuotaSubjectKind = "anon" | "user";

export interface AskQuotaState {
	day: string;
	subjectKind: AskQuotaSubjectKind;
	subjectKey: string;
	used: number;
	baseLimit: number;
	feedbackBonus: number;
	feedbackClaimed: boolean;
	feedbackPromptDismissed: boolean;
}

export interface AskQuotaView {
	signedIn: boolean;
	used: number;
	limit: number;
	remaining: number;
	allowed: boolean;
	/** Show the “help us improve Ask” +5 prompt. */
	offerFeedback: boolean;
	feedbackClaimed: boolean;
	day: string;
	/**
	 * Session exists but email is not verified — Ask still uses the anonymous
	 * daily bucket until they verify.
	 */
	needsEmailVerification?: boolean;
}

export function utcAskDay(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 10);
}

export function askBaseLimit(signedIn: boolean): number {
	return signedIn ? ASK_SIGNED_IN_DAILY_LIMIT : ASK_ANON_DAILY_LIMIT;
}

export function askEffectiveLimit(state: Pick<AskQuotaState, "baseLimit" | "feedbackBonus">): number {
	return Math.max(0, state.baseLimit + state.feedbackBonus);
}

export function askQuotaSubjectKey(input: {
	signedIn: boolean;
	uid?: string | null;
	ip: string;
}): { subjectKind: AskQuotaSubjectKind; subjectKey: string } {
	if (input.signedIn && input.uid) {
		return { subjectKind: "user", subjectKey: `user:${input.uid}` };
	}
	const ip = (input.ip || "local").trim() || "local";
	return { subjectKind: "anon", subjectKey: `anon:${ip}` };
}

export function emptyAskQuotaState(input: {
	day: string;
	subjectKind: AskQuotaSubjectKind;
	subjectKey: string;
}): AskQuotaState {
	return {
		day: input.day,
		subjectKind: input.subjectKind,
		subjectKey: input.subjectKey,
		used: 0,
		baseLimit: input.subjectKind === "user" ? ASK_SIGNED_IN_DAILY_LIMIT : ASK_ANON_DAILY_LIMIT,
		feedbackBonus: 0,
		feedbackClaimed: false,
		feedbackPromptDismissed: false,
	};
}

export function toAskQuotaView(
	state: AskQuotaState,
	options?: { priorUsed?: number; needsEmailVerification?: boolean },
): AskQuotaView {
	const priorUsed = Math.max(0, Math.floor(options?.priorUsed ?? 0));
	const limit = askEffectiveLimit(state);
	const used = state.used + priorUsed;
	const remaining = Math.max(0, limit - used);
	const halfway = Math.ceil(state.baseLimit / 2);
	const offerFeedback =
		state.subjectKind === "user" &&
		!state.feedbackClaimed &&
		!state.feedbackPromptDismissed &&
		used >= halfway;
	return {
		signedIn: state.subjectKind === "user",
		used,
		limit,
		remaining,
		allowed: used < limit,
		offerFeedback,
		feedbackClaimed: state.feedbackClaimed,
		day: state.day,
		...(options?.needsEmailVerification
			? { needsEmailVerification: true }
			: {}),
	};
}

/** Signed-in Ask quota requires a verified email. */
export function isAskQuotaSignedIn(
	user: { uid?: string | null; emailVerified?: boolean } | null | undefined,
): boolean {
	return Boolean(user?.uid && user.emailVerified === true);
}

/** Apply one successful Ask consumption. */
export function consumeAskQuotaState(
	state: AskQuotaState,
	options?: { priorUsed?: number; needsEmailVerification?: boolean },
): {
	state: AskQuotaState;
	view: AskQuotaView;
} {
	const priorUsed = Math.max(0, Math.floor(options?.priorUsed ?? 0));
	const needsEmailVerification = options?.needsEmailVerification === true;
	const limit = askEffectiveLimit(state);
	if (state.used + priorUsed >= limit) {
		return {
			state,
			view: toAskQuotaView(state, { priorUsed, needsEmailVerification }),
		};
	}
	const next: AskQuotaState = { ...state, used: state.used + 1 };
	return {
		state: next,
		view: toAskQuotaView(next, { priorUsed, needsEmailVerification }),
	};
}

export function normalizeAskUserReview(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export function isValidAskUserReview(text: string): boolean {
	return normalizeAskUserReview(text).length >= ASK_FEEDBACK_MIN_CHARS;
}

export function applyAskFeedbackBonus(state: AskQuotaState): {
	state: AskQuotaState;
	view: AskQuotaView;
	granted: boolean;
} {
	if (state.subjectKind !== "user" || state.feedbackClaimed) {
		return { state, view: toAskQuotaView(state), granted: false };
	}
	const next: AskQuotaState = {
		...state,
		feedbackClaimed: true,
		feedbackBonus: ASK_FEEDBACK_BONUS,
		feedbackPromptDismissed: true,
	};
	return { state: next, view: toAskQuotaView(next), granted: true };
}

export function dismissAskFeedbackPrompt(state: AskQuotaState): AskQuotaState {
	return { ...state, feedbackPromptDismissed: true };
}

export function askQuotaDocId(day: string, subjectKey: string): string {
	// Firestore doc ids cannot contain slashes; subjectKey is already safe.
	return `${day}_${subjectKey.replace(/[^a-zA-Z0-9:_.-]/g, "_")}`;
}
