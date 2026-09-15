export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUserForAskQuota } from "../../../../middleware/auth";
import {
	countContextWords,
	hasResearchCompositionContent,
	parseResearchCompositionPayload,
	researchContextPreview,
} from "../../../../utils/aiAskComposition";
import { clipAiQuestion } from "../../../../utils/aiQueryRewrite";
import { researchAuthFailure } from "../../../../utils/aiAskResearchAuth";
import { runResearchClarify } from "../../../../utils/aiAskResearchClarifyServer";
import { getOpenRouterApiKey } from "../../../../utils/openrouter";
import { isAskResearchEnabled } from "../../../../utils/aiAskResearchUi";

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

	const composition = parseResearchCompositionPayload(body);
	if (!hasResearchCompositionContent(composition)) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Ask a question or attach notes first.",
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}
	const question = clipAiQuestion(composition.question);

	const clarify = await runResearchClarify({
		user,
		question,
		history: body.history,
		attachedContext: composition.context,
		attachedImages: composition.images,
		contextPreview: composition.context
			? researchContextPreview(composition.context)
			: undefined,
		contextWordCount: composition.context
			? countContextWords(composition.context)
			: undefined,
		imageCount: composition.images.length || undefined,
	});

	return new Response(JSON.stringify({ success: true, ...clarify }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
