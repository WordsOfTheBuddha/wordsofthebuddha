import type { Firestore } from "firebase-admin/firestore";

export type AskAdminRatingFilter = "all" | "up" | "down" | "none";
export type AskAdminStatusFilter = "needs" | "reviewed" | "all";
export type AskAdminSinceFilter = "24h" | "7d" | "30d" | "all";
export type AskAdminViewFilter = "asks" | "notes";

/** @deprecated use AskAdminRatingFilter — kept for older imports/tests */
export type AskAdminFilter = AskAdminRatingFilter;

export interface AskAdminQuery {
	rating: AskAdminRatingFilter;
	status: AskAdminStatusFilter;
	since: AskAdminSinceFilter;
	view: AskAdminViewFilter;
}

export interface AskAdminRow {
	requestId: string;
	question: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	resultSlugs: string[];
	resultCount: number;
	model: string;
	reasoning: string;
	summary: string;
	offTopic: boolean;
	ms: number;
	rating: "up" | "down" | null;
	askedAt: string | null;
	feedbackAt: string | null;
	reviewed: boolean;
	reviewedAt: string | null;
	reviewedBy: string;
}

export interface AskAdminUserReviewRow {
	requestId: string;
	text: string;
	email: string;
	uid: string;
	day: string;
	createdAt: string | null;
}

export interface AskAdminSummary {
	totalAsks: number;
	withFeedback: number;
	up: number;
	down: number;
	none: number;
	needsReview: number;
	reviewed: number;
	userReviews: number;
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === "string");
}

function timestampToIso(value: unknown): string | null {
	if (
		value &&
		typeof value === "object" &&
		"toDate" in value &&
		typeof (value as { toDate: () => Date }).toDate === "function"
	) {
		return (value as { toDate: () => Date }).toDate().toISOString();
	}
	if (typeof value === "string" && value) return value;
	return null;
}

export function joinAskTelemetryDocs(
	docs: readonly Record<string, unknown>[],
): AskAdminRow[] {
	const asks = new Map<string, AskAdminRow>();
	const feedback = new Map<
		string,
		{ rating: "up" | "down"; feedbackAt: string | null }
	>();
	const reviews = new Map<
		string,
		{ reviewed: boolean; reviewedAt: string | null; reviewedBy: string }
	>();

	for (const doc of docs) {
		const requestId = asString(doc.requestId);
		if (!requestId) continue;
		if (doc.kind === "feedback") {
			const rating = doc.rating === "up" || doc.rating === "down" ? doc.rating : null;
			if (!rating) continue;
			const at = timestampToIso(doc.createdAt);
			const prev = feedback.get(requestId);
			if (!prev || (at && (!prev.feedbackAt || at > prev.feedbackAt))) {
				feedback.set(requestId, { rating, feedbackAt: at });
			}
			continue;
		}
		if (doc.kind === "review") {
			const at = timestampToIso(doc.createdAt);
			const prev = reviews.get(requestId);
			if (!prev || (at && (!prev.reviewedAt || at > prev.reviewedAt))) {
				reviews.set(requestId, {
					reviewed: doc.reviewed === true,
					reviewedAt: at,
					reviewedBy: asString(doc.reviewedBy),
				});
			}
			continue;
		}
		if (doc.kind !== "ask") continue;
		const askedAt = timestampToIso(doc.createdAt);
		const existing = asks.get(requestId);
		// Prefer the newest ask doc if duplicates share a requestId.
		if (
			existing?.askedAt &&
			askedAt &&
			existing.askedAt.localeCompare(askedAt) > 0
		) {
			continue;
		}
		asks.set(requestId, {
			requestId,
			question: asString(doc.question),
			lookingFor: asString(doc.lookingFor),
			queries: asStringArray(doc.queries),
			fallbackQueries: asStringArray(doc.fallbackQueries),
			resultSlugs: asStringArray(doc.resultSlugs),
			resultCount:
				typeof doc.resultCount === "number"
					? doc.resultCount
					: asStringArray(doc.resultSlugs).length,
			model: asString(doc.model),
			reasoning: asString(doc.reasoning),
			summary: asString(doc.summary),
			offTopic: doc.offTopic === true,
			ms: typeof doc.ms === "number" ? doc.ms : 0,
			rating: null,
			askedAt,
			feedbackAt: null,
			reviewed: false,
			reviewedAt: null,
			reviewedBy: "",
		});
	}

	for (const [requestId, row] of asks) {
		const fb = feedback.get(requestId);
		if (fb) {
			row.rating = fb.rating;
			row.feedbackAt = fb.feedbackAt;
		}
		const rev = reviews.get(requestId);
		if (rev) {
			row.reviewed = rev.reviewed;
			row.reviewedAt = rev.reviewedAt;
			row.reviewedBy = rev.reviewedBy;
		}
	}

	return [...asks.values()].sort((a, b) => {
		const ta = a.askedAt || "";
		const tb = b.askedAt || "";
		return tb.localeCompare(ta);
	});
}

export function joinAskUserReviewDocs(
	docs: readonly Record<string, unknown>[],
): AskAdminUserReviewRow[] {
	const rows: AskAdminUserReviewRow[] = [];
	for (const doc of docs) {
		if (doc.kind !== "userReview") continue;
		const text = asString(doc.text);
		if (!text) continue;
		rows.push({
			requestId: asString(doc.requestId),
			text,
			email: asString(doc.email),
			uid: asString(doc.uid),
			day: asString(doc.day),
			createdAt: timestampToIso(doc.createdAt),
		});
	}
	return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function summarizeAskAdminRows(
	rows: readonly AskAdminRow[],
	userReviews: readonly AskAdminUserReviewRow[] = [],
): AskAdminSummary {
	let up = 0;
	let down = 0;
	let none = 0;
	let needsReview = 0;
	let reviewed = 0;
	for (const row of rows) {
		if (row.rating === "up") up += 1;
		else if (row.rating === "down") down += 1;
		else none += 1;
		if (row.reviewed) reviewed += 1;
		else needsReview += 1;
	}
	return {
		totalAsks: rows.length,
		withFeedback: up + down,
		up,
		down,
		none,
		needsReview,
		reviewed,
		userReviews: userReviews.length,
	};
}

export function sinceCutoffIso(
	since: AskAdminSinceFilter,
	nowMs = Date.now(),
): string | null {
	if (since === "all") return null;
	const ms =
		since === "24h"
			? 24 * 60 * 60 * 1000
			: since === "7d"
				? 7 * 24 * 60 * 60 * 1000
				: 30 * 24 * 60 * 60 * 1000;
	return new Date(nowMs - ms).toISOString();
}

export function filterAskAdminRows(
	rows: readonly AskAdminRow[],
	query: AskAdminQuery | AskAdminRatingFilter,
): AskAdminRow[] {
	const q: AskAdminQuery =
		typeof query === "string"
			? { rating: query, status: "all", since: "all", view: "asks" }
			: query;
	const cutoff = sinceCutoffIso(q.since);
	return rows.filter((row) => {
		if (cutoff && (row.askedAt || "") < cutoff) return false;
		if (q.status === "needs" && row.reviewed) return false;
		if (q.status === "reviewed" && !row.reviewed) return false;
		if (q.rating === "up") return row.rating === "up";
		if (q.rating === "down") return row.rating === "down";
		if (q.rating === "none") return row.rating == null;
		return true;
	});
}

export function filterAskUserReviewRows(
	rows: readonly AskAdminUserReviewRow[],
	since: AskAdminSinceFilter,
): AskAdminUserReviewRow[] {
	const cutoff = sinceCutoffIso(since);
	if (!cutoff) return [...rows];
	return rows.filter((row) => (row.createdAt || "") >= cutoff);
}

export function parseAskAdminFilter(value: string | null): AskAdminRatingFilter {
	if (value === "up" || value === "down" || value === "none") return value;
	return "all";
}

export function parseAskAdminStatus(value: string | null): AskAdminStatusFilter {
	if (value === "reviewed" || value === "all") return value;
	if (value === "needs") return "needs";
	// Default inbox: only what still needs attention.
	return "needs";
}

export function parseAskAdminSince(value: string | null): AskAdminSinceFilter {
	if (value === "24h" || value === "7d" || value === "30d" || value === "all") {
		return value;
	}
	return "30d";
}

export function parseAskAdminView(value: string | null): AskAdminViewFilter {
	return value === "notes" ? "notes" : "asks";
}

export function parseAskAdminQuery(params: URLSearchParams): AskAdminQuery {
	return {
		rating: parseAskAdminFilter(params.get("filter")),
		status: parseAskAdminStatus(params.get("status")),
		since: parseAskAdminSince(params.get("since")),
		view: parseAskAdminView(params.get("view")),
	};
}

export function askAdminHref(query: Partial<AskAdminQuery> & {
	rating?: AskAdminRatingFilter;
	status?: AskAdminStatusFilter;
	since?: AskAdminSinceFilter;
	view?: AskAdminViewFilter;
}): string {
	const rating = query.rating ?? "all";
	const status = query.status ?? "needs";
	const since = query.since ?? "30d";
	const view = query.view ?? "asks";
	const params = new URLSearchParams();
	if (rating !== "all") params.set("filter", rating);
	if (status !== "needs") params.set("status", status);
	if (since !== "30d") params.set("since", since);
	if (view !== "asks") params.set("view", view);
	const qs = params.toString();
	return qs ? `/admin/ask?${qs}` : "/admin/ask";
}

export async function loadAskTelemetryInbox(
	db: Firestore,
	limit = 400,
): Promise<{ rows: AskAdminRow[]; userReviews: AskAdminUserReviewRow[] }> {
	const snap = await db
		.collection("askTelemetry")
		.orderBy("createdAt", "desc")
		.limit(limit)
		.get();
	const docs = snap.docs.map((doc) => doc.data() as Record<string, unknown>);
	return {
		rows: joinAskTelemetryDocs(docs),
		userReviews: joinAskUserReviewDocs(docs),
	};
}

export async function loadAskTelemetryRows(
	db: Firestore,
	limit = 400,
): Promise<AskAdminRow[]> {
	return (await loadAskTelemetryInbox(db, limit)).rows;
}
