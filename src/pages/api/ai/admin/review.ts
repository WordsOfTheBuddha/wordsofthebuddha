export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../../middleware/auth";
import { isAskAdminEmail } from "../../../../utils/aiAskAdmin";
import { buildAiAskTelemetryReviewEvent } from "../../../../utils/aiAskTelemetry";
import { recordAiAskTelemetry } from "../../../../utils/aiAskTelemetryServer";

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	const email = user?.email || null;
	if (!user || !isAskAdminEmail(email)) {
		return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
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

	const requestId =
		typeof body.requestId === "string" ? body.requestId.trim() : "";
	if (!requestId) {
		return new Response(
			JSON.stringify({ success: false, error: "Send requestId." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const reviewed = body.reviewed !== false;
	const event = buildAiAskTelemetryReviewEvent({
		requestId,
		reviewed,
		reviewedBy: email || "",
	});
	const persisted = await recordAiAskTelemetry(event);
	return new Response(
		JSON.stringify({
			success: true,
			stored: persisted.stored,
			reviewed,
			requestId,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
