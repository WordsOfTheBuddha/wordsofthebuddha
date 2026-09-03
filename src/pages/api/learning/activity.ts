export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";
import { sanitizeDayKey } from "../../../utils/learningActivity";
import {
	loadUserLearningActivity,
	mergeUserLearningActivity,
} from "../../../utils/learningActivityServer";

export const GET: APIRoute = async ({ cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	if (!user) {
		return new Response(
			JSON.stringify({ success: true, signedIn: false, dayCount: 0, days: {} }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}
	const summary = await loadUserLearningActivity(user);
	return new Response(
		JSON.stringify({
			success: true,
			signedIn: true,
			dayCount: summary.dayCount,
			days: summary.days,
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

	const daysRaw = Array.isArray(body.days) ? body.days : [];
	const days = daysRaw
		.map((item) => sanitizeDayKey(item))
		.filter((item): item is string => Boolean(item));

	const summary = await mergeUserLearningActivity(user, days);
	return new Response(
		JSON.stringify({
			success: true,
			signedIn: true,
			dayCount: summary.dayCount,
			days: summary.days,
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
