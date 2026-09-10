export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUserForAskQuota } from "../../../middleware/auth";
import { clipAiQuestion } from "../../../utils/aiQueryRewrite";
import { researchAuthFailure } from "../../../utils/aiAskResearchAuth";
import { consumeResearchQuota } from "../../../utils/aiResearchQuotaServer";
import { isAskQuotaSignedIn } from "../../../utils/aiAskQuota";
import {
	createResearchJob,
	listRecentResearchJobsForUser,
	startResearchJobWorker,
} from "../../../utils/aiAskResearchServer";
import {
	formatResearchClarifyBrief,
	parseResearchClarifyAnswers,
} from "../../../utils/aiAskResearchClarify";
import {
	markResearchClarifyUsed,
	readResearchClarifyDraft,
	validateResearchClarifyStart,
} from "../../../utils/aiAskResearchClarifyServer";
import { getOpenRouterApiKey } from "../../../utils/openrouter";
import { isAskResearchEnabled } from "../../../utils/aiAskResearchUi";

export const GET: APIRoute = async ({ cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
	if (!user || !isAskQuotaSignedIn(user)) {
		return new Response(
			JSON.stringify({ success: false, error: "Sign in required." }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}
	const jobs = await listRecentResearchJobsForUser(user.uid);
	return new Response(JSON.stringify({ success: true, jobs }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!getOpenRouterApiKey()) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Research is not configured on this server.",
			}),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	if (!isAskResearchEnabled()) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Research is not available.",
			}),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}

	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
	const auth = researchAuthFailure(user);
	if (auth || !user) {
		return new Response(
			JSON.stringify({
				success: false,
				code: auth?.code || "research_auth",
				error: auth?.error || "Sign in to use Research.",
			}),
			{ status: auth?.status || 401, headers: { "Content-Type": "application/json" } },
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

	const clarifyId =
		typeof body.clarifyId === "string" ? body.clarifyId.trim() : "";
	if (!clarifyId) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Answer the clarifying questions first.",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const draft = await readResearchClarifyDraft(user.uid, clarifyId);
	if (!draft) {
		return new Response(
			JSON.stringify({
				success: false,
				code: "clarify_expired",
				error: "Those questions expired. Send the topic again.",
			}),
			{ status: 410, headers: { "Content-Type": "application/json" } },
		);
	}

	const answers = parseResearchClarifyAnswers(body.answers);
	const check = validateResearchClarifyStart({ draft, answers });
	if (!check.ok) {
		if (check.code === "declined" && check.decline) {
			return new Response(
				JSON.stringify({
					success: true,
					declined: true,
					decline: check.decline,
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}
		if (check.code === "expired") {
			return new Response(
				JSON.stringify({
					success: false,
					code: "clarify_expired",
					error: "Those questions expired. Send the topic again.",
				}),
				{ status: 410, headers: { "Content-Type": "application/json" } },
			);
		}
		if (check.code === "used") {
			return new Response(
				JSON.stringify({
					success: false,
					error: "This research was already started.",
				}),
				{ status: 409, headers: { "Content-Type": "application/json" } },
			);
		}
		return new Response(
			JSON.stringify({
				success: false,
				error: "Answer each question before starting research.",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const quota = await consumeResearchQuota({ uid: user.uid });
	if (!quota.allowed) {
		return new Response(
			JSON.stringify({
				success: false,
				code: "research_quota",
				error: "You’ve used today’s Research. Come back tomorrow.",
				researchQuota: quota.view,
			}),
			{ status: 429, headers: { "Content-Type": "application/json" } },
		);
	}

	await markResearchClarifyUsed(user.uid, draft.id);

	const question = clipAiQuestion(draft.question);
	const clarifyBrief = formatResearchClarifyBrief(
		question,
		draft.questions,
		check.answers,
	);

	const created = await createResearchJob({
		user,
		question,
		history: draft.history,
		origin: new URL(request.url).origin,
		clarifyBrief,
	});
	void startResearchJobWorker({
		requestUrl: request.url,
		uid: user.uid,
		jobId: created.job.id,
		runToken: created.runToken,
	});

	return new Response(
		JSON.stringify({
			success: true,
			job: created.job,
			researchQuota: quota.view,
		}),
		{
			status: 202,
			headers: { "Content-Type": "application/json" },
		},
	);
};
