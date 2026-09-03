export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUser } from "../../../middleware/auth";
import {
	askSharePath,
	sanitizeAskShareResults,
	sanitizeAskShareSnapshot,
} from "../../../utils/aiAskShare";
import { loadAskShare, publishAskShare } from "../../../utils/aiAskShareServer";
import { clientIpFromRequest } from "../../../utils/aiRateLimit";

const shareBuckets = new Map<string, { day: string; count: number }>();
const SHARE_DAILY_LIMIT = 40;

function utcDay(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 10);
}

function consumeShareQuota(ip: string): boolean {
	const day = utcDay();
	const current = shareBuckets.get(ip);
	if (!current || current.day !== day) {
		shareBuckets.set(ip, { day, count: 1 });
		return true;
	}
	if (current.count >= SHARE_DAILY_LIMIT) return false;
	current.count += 1;
	return true;
}

export const GET: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get("slug") || "";
	const snapshot = await loadAskShare(slug);
	if (!snapshot) {
		return new Response(
			JSON.stringify({ success: false, error: "Share not found." }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}
	return new Response(JSON.stringify({ success: true, share: snapshot }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request, cookies }) => {
	const ip = clientIpFromRequest(request);
	if (!consumeShareQuota(ip)) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Too many share links created today.",
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

	const question =
		typeof body.question === "string" ? body.question.trim() : "";
	const results = sanitizeAskShareResults(body.results);
	if (!question || results.length === 0) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "A question with discourse results is required to share.",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const session = cookies.get("__session")?.value;
	const user = await verifyUser(session, { cookies });

	try {
		const thread = Array.isArray(body.thread) ? body.thread : undefined;
		const published = await publishAskShare({
			preferredSlug:
				typeof body.shareSlug === "string" ? body.shareSlug : undefined,
			question,
			lookingFor:
				typeof body.lookingFor === "string" ? body.lookingFor : "",
			queries: Array.isArray(body.queries)
				? body.queries.filter(
						(item): item is string => typeof item === "string",
					)
				: [],
			fallbackQueries: Array.isArray(body.fallbackQueries)
				? body.fallbackQueries.filter(
						(item): item is string => typeof item === "string",
					)
				: [],
			summary: typeof body.summary === "string" ? body.summary : "",
			results,
			model: typeof body.model === "string" ? body.model : "",
			requestId:
				typeof body.requestId === "string" ? body.requestId : undefined,
			...(thread ? { thread } : {}),
			user,
		});
		const share = sanitizeAskShareSnapshot({
			slug: published.slug,
			question,
			lookingFor: body.lookingFor,
			queries: body.queries,
			fallbackQueries: body.fallbackQueries,
			summary: body.summary,
			results,
			model: body.model,
			requestId: body.requestId,
			createdAt: Date.now(),
			...(thread ? { thread } : {}),
		});
		return new Response(
			JSON.stringify({
				success: true,
				slug: published.slug,
				path: published.path || askSharePath(published.slug),
				created: published.created,
				share,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("[ai/share]", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Could not create a share link.",
			}),
			{ status: 502, headers: { "Content-Type": "application/json" } },
		);
	}
};
