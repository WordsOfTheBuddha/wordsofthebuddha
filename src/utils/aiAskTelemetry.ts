import { randomUUID } from "node:crypto";

export type AiAskFeedbackRating = "up" | "down";

export interface AiAskTelemetryAskEvent {
	kind: "ask";
	requestId: string;
	question: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	resultSlugs: string[];
	resultCount: number;
	model: string;
	/** Model reasoning / thinking text (clipped). */
	reasoning: string;
	/** Gemini (or similar) summary of how results align with the question. */
	summary: string;
	offTopic: boolean;
	ms: number;
}

export interface AiAskTelemetryFeedbackEvent {
	kind: "feedback";
	requestId: string;
	rating: AiAskFeedbackRating;
	question: string;
	queries: string[];
	resultSlugs: string[];
}

export interface AiAskTelemetryReviewEvent {
	kind: "review";
	requestId: string;
	/** true = admin marked reviewed; false = send back to inbox */
	reviewed: boolean;
	reviewedBy: string;
}

/** Written product feedback from a signed-in user (quota bonus). */
export interface AiAskTelemetryUserReviewEvent {
	kind: "userReview";
	requestId: string;
	text: string;
	email: string;
	uid: string;
	day: string;
}

const MAX_QUESTION = 500;
const MAX_LOOKING = 160;
const MAX_QUERY = 100;
const MAX_QUERIES = 6;
const MAX_SLUGS = 12;
const MAX_REASONING = 6000;
const MAX_SUMMARY = 700;
const MAX_EMAIL = 120;
const MAX_USER_REVIEW = 2000;

export function newAiAskRequestId(): string {
	try {
		return randomUUID();
	} catch {
		return `ask_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
	}
}

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Keep newlines in reasoning; only collapse runs of spaces/tabs per line. */
function clipReasoning(value: string, max = MAX_REASONING): string {
	return value
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim()
		.slice(0, max);
}

function stringList(value: unknown, maxItems: number, maxChars: number): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const item of value) {
		if (typeof item !== "string") continue;
		const next = clip(item, maxChars);
		if (!next) continue;
		out.push(next);
		if (out.length >= maxItems) break;
	}
	return out;
}

export function buildAiAskTelemetryAskEvent(input: {
	requestId: string;
	question: string;
	lookingFor?: string;
	queries?: readonly string[];
	fallbackQueries?: readonly string[];
	resultSlugs?: readonly string[];
	model?: string;
	reasoning?: string;
	summary?: string;
	offTopic?: boolean;
	ms?: number;
}): AiAskTelemetryAskEvent {
	const slugs = stringList(input.resultSlugs, MAX_SLUGS, 64);
	return {
		kind: "ask",
		requestId: clip(input.requestId, 80) || newAiAskRequestId(),
		question: clip(input.question, MAX_QUESTION),
		lookingFor: clip(input.lookingFor || "", MAX_LOOKING),
		queries: stringList(input.queries, MAX_QUERIES, MAX_QUERY),
		fallbackQueries: stringList(input.fallbackQueries, MAX_QUERIES, MAX_QUERY),
		resultSlugs: slugs,
		resultCount: slugs.length,
		model: clip(input.model || "", 120),
		reasoning: clipReasoning(input.reasoning || ""),
		summary: clip(input.summary || "", MAX_SUMMARY),
		offTopic: input.offTopic === true,
		ms: Math.max(0, Math.round(input.ms || 0)),
	};
}

export function parseAiAskFeedbackRating(value: unknown): AiAskFeedbackRating | null {
	return value === "up" || value === "down" ? value : null;
}

export function buildAiAskTelemetryFeedbackEvent(input: {
	requestId: string;
	rating: AiAskFeedbackRating;
	question?: string;
	queries?: readonly string[];
	resultSlugs?: readonly string[];
}): AiAskTelemetryFeedbackEvent {
	return {
		kind: "feedback",
		requestId: clip(input.requestId, 80),
		rating: input.rating,
		question: clip(input.question || "", MAX_QUESTION),
		queries: stringList(input.queries, MAX_QUERIES, MAX_QUERY),
		resultSlugs: stringList(input.resultSlugs, MAX_SLUGS, 64),
	};
}

export function buildAiAskTelemetryReviewEvent(input: {
	requestId: string;
	reviewed: boolean;
	reviewedBy: string;
}): AiAskTelemetryReviewEvent {
	return {
		kind: "review",
		requestId: clip(input.requestId, 80),
		reviewed: input.reviewed === true,
		reviewedBy: clip(input.reviewedBy || "", MAX_EMAIL),
	};
}

export function buildAiAskTelemetryUserReviewEvent(input: {
	requestId?: string;
	text: string;
	email?: string;
	uid: string;
	day: string;
}): AiAskTelemetryUserReviewEvent {
	return {
		kind: "userReview",
		requestId: clip(input.requestId || newAiAskRequestId(), 80),
		text: clip(input.text, MAX_USER_REVIEW),
		email: clip(input.email || "", MAX_EMAIL),
		uid: clip(input.uid, 128),
		day: clip(input.day, 16),
	};
}

/** Structured line for Vercel/server logs — easy to filter with `[ai-ask]`. */
export function logAiAskTelemetry(
	event:
		| AiAskTelemetryAskEvent
		| AiAskTelemetryFeedbackEvent
		| AiAskTelemetryReviewEvent
		| AiAskTelemetryUserReviewEvent,
): void {
	console.log(`[ai-ask] ${JSON.stringify(event)}`);
}
