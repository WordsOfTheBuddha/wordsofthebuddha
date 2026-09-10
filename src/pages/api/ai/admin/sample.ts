export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../../middleware/auth";
import { askAdminApiGate } from "../../../../utils/aiAskAdmin";
import { upsertAskSample } from "../../../../utils/aiAskSamplesServer";

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	const gate = askAdminApiGate(user?.email || null);
	if (!gate.ok) {
		return new Response(JSON.stringify({ success: false, error: gate.error }), {
			status: gate.status,
			headers: { "Content-Type": "application/json" },
		});
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(
			JSON.stringify({ success: false, error: "Invalid JSON body." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const result = await upsertAskSample({
		body,
		updatedBy: gate.email,
	});
	if (!result.ok) {
		const unavailable = result.error === "Ask samples are unavailable.";
		return new Response(
			JSON.stringify({ success: false, error: result.error }),
			{
				status: unavailable ? 503 : 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	return new Response(
		JSON.stringify({
			success: true,
			sample: result.sample,
			replaced: result.replaced,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
