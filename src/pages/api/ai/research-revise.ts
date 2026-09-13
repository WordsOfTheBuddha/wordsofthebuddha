export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUserForAskQuota } from "../../../middleware/auth";
import { isAskQuotaSignedIn } from "../../../utils/aiAskQuota";
import {
	clipResearchReviseHeading,
	clipResearchReviseInstruction,
	clipResearchReviseQuote,
} from "../../../utils/aiAskResearchRevise";
import {
	answerResearchReviseClarify,
	applyResearchRevise,
	beginResearchRevise,
	startResearchReviseWorker,
} from "../../../utils/aiAskResearchReviseServer";
import { getAskQuotaView } from "../../../utils/aiAskQuotaServer";
import { getOpenRouterApiKey } from "../../../utils/openrouter";

function errorStatus(code: string): number {
	if (code === "unauthorized") return 401;
	if (code === "ask_quota") return 429;
	if (code === "not_found") return 404;
	if (code === "invalid") return 400;
	if (code === "too_long") return 422;
	return 502;
}

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
	if (!user || !isAskQuotaSignedIn(user)) {
		return new Response(
			JSON.stringify({
				success: false,
				code: "unauthorized",
				error: "Sign in required.",
			}),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}

	let body: Record<string, unknown> = {};
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		body = {};
	}

	const action =
		body.action === "restore"
			? "restore"
			: body.action === "answer"
				? "answer"
				: "revise";
	if (action !== "restore" && !getOpenRouterApiKey()) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Revise is not configured on this server.",
			}),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	const fromRaw = body.fromVersion;
	const fromVersion =
		typeof fromRaw === "number"
			? fromRaw
			: typeof fromRaw === "string"
				? Number(fromRaw)
				: null;
	const shared = {
		request,
		user,
		instruction: clipResearchReviseInstruction(
			typeof body.instruction === "string" ? body.instruction : "",
		),
		heading: clipResearchReviseHeading(
			typeof body.heading === "string" ? body.heading : "",
		),
		quote: clipResearchReviseQuote(
			typeof body.quote === "string" ? body.quote : "",
		),
		jobId: typeof body.jobId === "string" ? body.jobId : "",
		shareSlug: typeof body.shareSlug === "string" ? body.shareSlug : "",
		fromVersion:
			typeof fromVersion === "number" && Number.isFinite(fromVersion)
				? fromVersion
				: null,
	};

	if (action === "answer") {
		// Resume a revision the planner paused on its questions. No new credit:
		// the revise that asked already paid.
		const answered = await answerResearchReviseClarify({
			uid: user.uid,
			jobId: shared.jobId,
			clarifyId: typeof body.clarifyId === "string" ? body.clarifyId : "",
			answers: body.answers,
		});
		if (!answered.ok) {
			return new Response(
				JSON.stringify({
					success: false,
					code: answered.code,
					error: answered.error,
				}),
				{
					status: errorStatus(answered.code),
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		void startResearchReviseWorker({
			requestUrl: request.url,
			uid: user.uid,
			jobId: answered.job.id,
			runToken: answered.runToken || "",
		});
		return new Response(
			JSON.stringify({ success: true, job: answered.job }),
			{ status: 202, headers: { "Content-Type": "application/json" } },
		);
	}

	if (action === "restore") {
		const result = await applyResearchRevise({ ...shared, action: "restore" });
		if (!result.ok) {
			return new Response(
				JSON.stringify({
					success: false,
					code: result.code,
					error: result.error,
					...(result.quota ? { quota: result.quota } : {}),
				}),
				{
					status: errorStatus(result.code),
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		const quota = result.quota || (await getAskQuotaView({ request, user }));
		return new Response(
			JSON.stringify({
				success: true,
				job: result.job,
				forked: result.forked,
				quota,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	const started = await beginResearchRevise(shared);
	if (!started.ok) {
		return new Response(
			JSON.stringify({
				success: false,
				code: started.code,
				error: started.error,
				...(started.quota ? { quota: started.quota } : {}),
			}),
			{
				status: errorStatus(started.code),
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	void startResearchReviseWorker({
		requestUrl: request.url,
		uid: user.uid,
		jobId: started.job.id,
		runToken: started.runToken || "",
	});

	const quota = started.quota || (await getAskQuotaView({ request, user }));
	return new Response(
		JSON.stringify({
			success: true,
			job: started.job,
			forked: started.forked,
			quota,
		}),
		{ status: 202, headers: { "Content-Type": "application/json" } },
	);
};
