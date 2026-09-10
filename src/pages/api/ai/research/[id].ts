export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUserForAskQuota } from "../../../../middleware/auth";
import { isAskQuotaSignedIn } from "../../../../utils/aiAskQuota";
import { isResearchJobTerminal } from "../../../../utils/aiAskResearchJob";
import {
	getResearchJobForUser,
	requestResearchJobCancel,
	retryResearchJob,
} from "../../../../utils/aiAskResearchServer";
import { getResearchQuotaView } from "../../../../utils/aiResearchQuotaServer";

export const GET: APIRoute = async ({ params, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
	if (!user || !isAskQuotaSignedIn(user)) {
		return new Response(
			JSON.stringify({ success: false, error: "Sign in required." }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}
	const jobId = typeof params.id === "string" ? params.id : "";
	const job = await getResearchJobForUser(user.uid, jobId);
	if (!job) {
		return new Response(
			JSON.stringify({ success: false, error: "Research not found." }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}
	const payload: {
		success: true;
		job: typeof job;
		researchQuota?: Awaited<ReturnType<typeof getResearchQuotaView>>;
	} = { success: true, job };
	if (isResearchJobTerminal(job.status)) {
		payload.researchQuota = await getResearchQuotaView({ uid: user.uid });
	}
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
	if (!user || !isAskQuotaSignedIn(user)) {
		return new Response(
			JSON.stringify({ success: false, error: "Sign in required." }),
			{ status: 401, headers: { "Content-Type": "application/json" } },
		);
	}
	let body: Record<string, unknown> = {};
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		body = {};
	}
	const jobId = typeof params.id === "string" ? params.id : "";
	if (body.action === "retry") {
		const retried = await retryResearchJob({
			uid: user.uid,
			jobId,
			requestUrl: request.url,
		});
		if (!retried.ok) {
			const status =
				retried.code === "not_found"
					? 404
					: retried.code === "research_quota"
						? 429
						: 409;
			return new Response(
				JSON.stringify({
					success: false,
					code: retried.code,
					error: retried.error,
					...(retried.job ? { job: retried.job } : {}),
					...(retried.researchQuota
						? { researchQuota: retried.researchQuota }
						: {}),
				}),
				{ status, headers: { "Content-Type": "application/json" } },
			);
		}
		const researchQuota = await getResearchQuotaView({ uid: user.uid });
		return new Response(
			JSON.stringify({
				success: true,
				job: retried.job,
				reusedCredit: retried.reusedCredit,
				researchQuota,
			}),
			{ status: 202, headers: { "Content-Type": "application/json" } },
		);
	}
	if (body.action !== "cancel") {
		return new Response(
			JSON.stringify({ success: false, error: "Unknown action." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}
	const job = await requestResearchJobCancel(user.uid, jobId);
	if (!job) {
		return new Response(
			JSON.stringify({ success: false, error: "Research not found." }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}
	const researchQuota = await getResearchQuotaView({ uid: user.uid });
	return new Response(JSON.stringify({ success: true, job, researchQuota }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
