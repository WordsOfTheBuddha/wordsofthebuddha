export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";
import {
	ASK_FEEDBACK_BONUS,
	ASK_FEEDBACK_MIN_CHARS,
	isValidAskUserReview,
	normalizeAskUserReview,
	utcAskDay,
} from "../../../utils/aiAskQuota";
import { claimAskFeedbackBonus } from "../../../utils/aiAskQuotaServer";
import {
	buildAiAskTelemetryUserReviewEvent,
	newAiAskRequestId,
} from "../../../utils/aiAskTelemetry";
import { recordAiAskTelemetry } from "../../../utils/aiAskTelemetryServer";

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	if (!user) {
		return new Response(
			JSON.stringify({ success: false, error: "Sign in required." }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}
	if (!user.emailVerified) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Verify your email before claiming Ask feedback bonus.",
			}),
			{ status: 403, headers: { "Content-Type": "application/json" } },
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

	const text = normalizeAskUserReview(
		typeof body.text === "string" ? body.text : "",
	);
	if (!isValidAskUserReview(text)) {
		return new Response(
			JSON.stringify({
				success: false,
				error: `Please write at least ${ASK_FEEDBACK_MIN_CHARS} characters.`,
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const claimed = await claimAskFeedbackBonus({ request, user });
	if (!claimed.granted) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Feedback bonus already claimed today.",
				quota: claimed.view,
			}),
			{ status: 409, headers: { "Content-Type": "application/json" } },
		);
	}

	const event = buildAiAskTelemetryUserReviewEvent({
		requestId: newAiAskRequestId(),
		text,
		email: user.email || "",
		uid: user.uid,
		day: utcAskDay(),
	});
	await recordAiAskTelemetry(event);

	return new Response(
		JSON.stringify({
			success: true,
			granted: true,
			bonus: ASK_FEEDBACK_BONUS,
			quota: claimed.view,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
