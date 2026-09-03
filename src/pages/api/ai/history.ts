export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";
import {
	loadUserAskHistory,
	syncUserAskHistory,
	upsertUserAskHistoryEntry,
} from "../../../utils/aiAskHistoryServer";
import {
	sanitizeAskHistoryEntries,
	sanitizeAskHistoryEntry,
} from "../../../utils/aiAskSession";

export const GET: APIRoute = async ({ cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });
	if (!user) {
		return new Response(
			JSON.stringify({ success: true, signedIn: false, entries: [] }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}
	const entries = await loadUserAskHistory(user);
	return new Response(
		JSON.stringify({ success: true, signedIn: true, entries }),
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

	if (body.action === "sync") {
		const local = sanitizeAskHistoryEntries(body.entries);
		const entries = await syncUserAskHistory(user, local);
		return new Response(
			JSON.stringify({ success: true, signedIn: true, entries }),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	const entry = sanitizeAskHistoryEntry(body.entry);
	if (!entry) {
		return new Response(
			JSON.stringify({ success: false, error: "Invalid history entry." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const replaceQuestions = Array.isArray(body.replaceQuestions)
		? body.replaceQuestions.filter(
				(item): item is string => typeof item === "string",
			)
		: [];
	const entries = await upsertUserAskHistoryEntry(
		user,
		entry,
		replaceQuestions,
	);
	return new Response(
		JSON.stringify({ success: true, signedIn: true, entries }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
