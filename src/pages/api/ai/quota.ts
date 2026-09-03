export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUserForAskQuota } from "../../../middleware/auth";
import {
	dismissAskFeedbackOffer,
	getAskQuotaView,
} from "../../../utils/aiAskQuotaServer";

export const GET: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
	const view = await getAskQuotaView({ request, user });
	return new Response(JSON.stringify({ success: true, quota: view }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
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
				error: "Verify your email to unlock signed-in Ask benefits.",
			}),
			{ status: 403, headers: { "Content-Type": "application/json" } },
		);
	}

	let body: Record<string, unknown> = {};
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		body = {};
	}

	if (body.action === "dismissFeedback") {
		const view = await dismissAskFeedbackOffer({ request, user });
		return new Response(JSON.stringify({ success: true, quota: view }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(
		JSON.stringify({ success: false, error: "Unknown action." }),
		{ status: 400, headers: { "Content-Type": "application/json" } },
	);
};
