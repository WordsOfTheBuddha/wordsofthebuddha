export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";
import { sanitizeBySlug } from "../../../utils/listenActivity";
import {
	loadUserListenActivity,
	mergeUserListenActivity,
} from "../../../utils/listenActivityServer";

export const GET: APIRoute = async ({ cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	if (!user) {
		return new Response(
			JSON.stringify({
				success: true,
				signedIn: false,
				totalSeconds: 0,
				bySlug: {},
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}
	const summary = await loadUserListenActivity(user);
	return new Response(
		JSON.stringify({
			success: true,
			signedIn: true,
			totalSeconds: summary.totalSeconds,
			bySlug: summary.bySlug,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	if (!user) {
		return new Response(
			JSON.stringify({ success: false, error: "Sign in required." }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
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

	const bySlug = sanitizeBySlug(body.bySlug);
	const summary = await mergeUserListenActivity(user, bySlug);
	return new Response(
		JSON.stringify({
			success: true,
			signedIn: true,
			totalSeconds: summary.totalSeconds,
			bySlug: summary.bySlug,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
