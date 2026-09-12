/** Pure Deep Research metering (no I/O). Separate from daily Ask credits. */

export const RESEARCH_DAILY_LIMIT = 2;

export interface ResearchQuotaState {
	day: string;
	uid: string;
	used: number;
	limit: number;
}

export interface ResearchQuotaView {
	used: number;
	limit: number;
	remaining: number;
	allowed: boolean;
	day: string;
}

export function utcResearchDay(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 10);
}

export function emptyResearchQuotaState(input: {
	day: string;
	uid: string;
}): ResearchQuotaState {
	return {
		day: input.day,
		uid: input.uid,
		used: 0,
		limit: RESEARCH_DAILY_LIMIT,
	};
}

export function toResearchQuotaView(state: ResearchQuotaState): ResearchQuotaView {
	const limit = Math.max(0, Math.floor(state.limit || RESEARCH_DAILY_LIMIT));
	const used = Math.max(0, Math.floor(state.used));
	const remaining = Math.max(0, limit - used);
	return {
		used,
		limit,
		remaining,
		allowed: used < limit,
		day: state.day,
	};
}

export function consumeResearchQuotaState(state: ResearchQuotaState): {
	state: ResearchQuotaState;
	view: ResearchQuotaView;
} {
	const view = toResearchQuotaView(state);
	if (!view.allowed) {
		return { state, view };
	}
	const next: ResearchQuotaState = { ...state, used: state.used + 1 };
	return { state: next, view: toResearchQuotaView(next) };
}

/** Failed jobs and stale stops restore a credit; used never goes below 0. */
export function refundResearchQuotaState(state: ResearchQuotaState): {
	state: ResearchQuotaState;
	view: ResearchQuotaView;
} {
	const used = Math.max(0, Math.floor(state.used) - 1);
	const next: ResearchQuotaState = { ...state, used };
	return { state: next, view: toResearchQuotaView(next) };
}

/** A stop after this long is treated as a failed run, not a spent credit. */
export const RESEARCH_CREDIT_REFUND_AFTER_MS = 12 * 60 * 1000;

export function shouldRefundResearchCredit(input: {
	status: string;
	createdAt?: number;
	now?: number;
}): boolean {
	if (input.status === "failed") return true;
	if (input.status !== "cancelled") return false;
	const createdAt = input.createdAt || 0;
	if (createdAt <= 0) return true;
	// Callers must evaluate this at stop time. Re-checking later would refund
	// an early stop once the job is simply older than five minutes.
	return (input.now ?? Date.now()) - createdAt >= RESEARCH_CREDIT_REFUND_AFTER_MS;
}

export function researchQuotaDocId(day: string, uid: string): string {
	const safeUid = uid.replace(/[^a-zA-Z0-9:_.-]/g, "_");
	return `${day}_user:${safeUid}`;
}
