export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../../middleware/auth";
import { askAdminApiGate } from "../../../../utils/aiAskAdmin";
import {
	deleteAskSample,
	upsertAskSample,
} from "../../../../utils/aiAskSamplesServer";

async function adminFromCookies(
	cookies: Parameters<APIRoute>[0]["cookies"],
) {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	return askAdminApiGate(user?.email || null);
}

function jsonError(error: string, status: number) {
	return new Response(JSON.stringify({ success: false, error }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function slugFromBody(body: unknown): string {
	if (!body || typeof body !== "object" || !("slug" in body)) return "";
	const slug = (body as { slug?: unknown }).slug;
	return typeof slug === "string" ? slug : "";
}

export const POST: APIRoute = async ({ request, cookies }) => {
	const gate = await adminFromCookies(cookies);
	if (!gate.ok) return jsonError(gate.error, gate.status);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonError("Invalid JSON body.", 400);
	}

	const result = await upsertAskSample({
		body,
		updatedBy: gate.email,
	});
	if (!result.ok) {
		const unavailable = result.error === "Ask samples are unavailable.";
		return jsonError(result.error, unavailable ? 503 : 400);
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

export const DELETE: APIRoute = async ({ request, cookies }) => {
	const gate = await adminFromCookies(cookies);
	if (!gate.ok) return jsonError(gate.error, gate.status);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonError("Invalid JSON body.", 400);
	}
	const result = await deleteAskSample({ slug: slugFromBody(body) });
	if (!result.ok) {
		const unavailable = result.error === "Ask samples are unavailable.";
		const missing = result.error === "That example is no longer published.";
		return jsonError(
			result.error,
			unavailable ? 503 : missing ? 404 : 400,
		);
	}

	return new Response(
		JSON.stringify({ success: true, slug: result.slug }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
