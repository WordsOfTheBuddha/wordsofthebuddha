export const prerender = false;
import type { APIRoute } from "astro";
import {
	buildAiAskTelemetryFeedbackEvent,
	parseAiAskFeedbackRating,
} from "../../../utils/aiAskTelemetry";
import { recordAiAskTelemetry } from "../../../utils/aiAskTelemetryServer";
import {
	clientIpFromRequest,
	consumeAiAskQuota,
} from "../../../utils/aiRateLimit";

/** Light daily cap so feedback spam cannot flood Firestore/logs. */
function feedbackDailyLimit(): number {
	return import.meta.env?.DEV ? 400 : 80;
}

export const POST: APIRoute = async ({ request }) => {
	const quota = consumeAiAskQuota(
		`feedback:${clientIpFromRequest(request)}`,
		feedbackDailyLimit(),
	);
	if (!quota.allowed) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Feedback limit reached for today.",
			}),
			{ status: 429, headers: { "Content-Type": "application/json" } },
		);
	}

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(
			JSON.stringify({ success: false, error: "Invalid JSON body." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const rating = parseAiAskFeedbackRating(body.rating);
	const requestId =
		typeof body.requestId === "string" ? body.requestId.trim() : "";
	if (!rating || !requestId) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Send requestId and rating (up or down).",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const event = buildAiAskTelemetryFeedbackEvent({
		requestId,
		rating,
		question: typeof body.question === "string" ? body.question : "",
		queries: Array.isArray(body.queries) ? body.queries : [],
		resultSlugs: Array.isArray(body.resultSlugs) ? body.resultSlugs : [],
	});
	const persisted = await recordAiAskTelemetry(event);
	return new Response(
		JSON.stringify({ success: true, stored: persisted.stored }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
