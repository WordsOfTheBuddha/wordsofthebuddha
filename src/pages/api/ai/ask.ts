export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUserForAskQuota } from "../../../middleware/auth";
import {
	formatPlannerRoutingLine,
	rewriteAskQuestion,
} from "../../../utils/aiAskRewrite";
import { resolveAskShareSlug } from "../../../utils/aiAskShare";
import { consumeAskQuota } from "../../../utils/aiAskQuotaServer";
import { resolveAskPersonHits } from "../../../utils/aiAskPersons";
import {
	AI_SEARCH_CANDIDATE_LIMIT,
	queriesForResultSlugs,
	searchDiscoursesForQueries,
} from "../../../utils/aiDiscourseSearch";
import {
	rerankDiscourseHits,
	resolveAskResultLimit,
} from "../../../utils/aiResultRerank";
import {
	clipAiHistorySummary,
	clipAiQuestion,
	type AiRewriteHistoryTurn,
} from "../../../utils/aiQueryRewrite";
import {
	buildAiAskTelemetryAskEvent,
	newAiAskRequestId,
} from "../../../utils/aiAskTelemetry";
import { recordAiAskTelemetry } from "../../../utils/aiAskTelemetryServer";
import { isGeminiConfigured } from "../../../utils/gemini";
import {
	getOpenRouterApiKey,
	resolveRequestedOpenRouterModel,
} from "../../../utils/openrouter";

const MAX_HISTORY = 6;

function parseHistory(raw: unknown): AiRewriteHistoryTurn[] {
	if (!Array.isArray(raw)) return [];
	const turns: AiRewriteHistoryTurn[] = [];
	for (const item of raw.slice(-MAX_HISTORY)) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const question =
			typeof record.question === "string" ? clipAiQuestion(record.question) : "";
		if (!question) continue;
		const lookingFor =
			typeof record.lookingFor === "string"
				? record.lookingFor.replace(/\s+/g, " ").trim().slice(0, 160)
				: "";
		const queries = Array.isArray(record.queries)
			? record.queries
					.filter((query): query is string => typeof query === "string")
					.map((query) => query.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 4)
			: [];
		// Follow-ups (“more like this”, “not already shown”) need every shown
		// slug, and a research turn can now show up to 50.
		const resultSlugs = Array.isArray(record.resultSlugs)
			? record.resultSlugs
					.filter((slug): slug is string => typeof slug === "string")
					.map((slug) => slug.replace(/\s+/g, " ").trim().toLowerCase())
					.filter(Boolean)
					.slice(0, 50)
			: [];
		const summary =
			typeof record.summary === "string"
				? clipAiHistorySummary(record.summary)
				: "";
		turns.push({
			question,
			lookingFor,
			queries,
			...(resultSlugs.length > 0 ? { resultSlugs } : {}),
			...(summary ? { summary } : {}),
		});
	}
	return turns;
}

function sse(data: unknown): string {
	return `data: ${JSON.stringify(data)}\n\n`;
}

function friendlyAskError(error: unknown): { status: number; message: string } {
	const status =
		typeof error === "object" &&
		error &&
		"status" in error &&
		typeof (error as { status?: unknown }).status === "number"
			? (error as { status: number }).status
			: 502;
	const message =
		error instanceof Error ? error.message : "Ask could not complete.";
	const friendly =
		status === 429
			? "The free model is rate-limited right now. Wait a minute, or pick another free model."
			: status === 401
				? "The API key was rejected. Check OPENROUTER_API_KEY or GEMINI_API_KEY."
				: message.includes("timeout")
					? "The model timed out. Try again, or pick another free model."
					: "Could not reach the model. Try again shortly.";
	return { status, message: friendly };
}

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!getOpenRouterApiKey() && !isGeminiConfigured()) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Ask is not configured on this server.",
			}),
			{ status: 503, headers: { "Content-Type": "application/json" } },
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

	const question = clipAiQuestion(
		typeof body.question === "string" ? body.question : "",
	);
	if (!question) {
		return new Response(
			JSON.stringify({ success: false, error: "Ask a question first." }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const session = cookies.get("__session")?.value;
	const user = await verifyUserForAskQuota(session, { cookies });
	const quotaResult = await consumeAskQuota({ request, user });
	if (!quotaResult.allowed) {
		const view = quotaResult.view;
		const error = view.signedIn
			? "You’ve used today’s Asks. Come back tomorrow."
			: view.needsEmailVerification
				? "You’ve used today’s free Asks. Verify your email for more Asks today."
				: "You’ve used today’s free Asks. Sign in for more Asks today.";
		return new Response(
			JSON.stringify({
				success: false,
				code: "ask_quota",
				error,
				quota: view,
			}),
			{ status: 429, headers: { "Content-Type": "application/json" } },
		);
	}
	const quota = quotaResult.view;

	const model = resolveRequestedOpenRouterModel(
		typeof body.model === "string" ? body.model : undefined,
	);
	const history = parseHistory(body.history);
	const requestId = newAiAskRequestId();
	const startedAt = Date.now();
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: unknown) => {
				controller.enqueue(encoder.encode(sse(event)));
			};
			const persistAsk = async (input: {
				displayQuestion: string;
				lookingFor: string;
				queries: string[];
				fallbackQueries: string[];
				offTopic: boolean;
				results: { slug?: string }[];
				model: string;
				reasoning: string;
				summary?: string;
			}) => {
				const event = buildAiAskTelemetryAskEvent({
					requestId,
					question: input.displayQuestion || question,
					lookingFor: input.lookingFor,
					queries: input.queries,
					fallbackQueries: input.fallbackQueries,
					resultSlugs: input.results
						.map((item) => item.slug || "")
						.filter(Boolean),
					model: input.model,
					reasoning: input.reasoning,
					summary: input.summary,
					offTopic: input.offTopic,
					ms: Date.now() - startedAt,
				});
				void recordAiAskTelemetry(event);
			};
			try {
				// Meter should drop as soon as the Ask is accepted, before rewrite work.
				send({ type: "quota", quota, requestId });
				send({ type: "status", phase: "rewrite", requestId });
				const rewrite = await rewriteAskQuestion({
					question,
					history,
					model,
					onReasoning: (delta) => send({ type: "reasoning", delta }),
				});
				const plan = rewrite.plan;
				let usedModel = rewrite.model;
				// Gemini has no reasoning stream — don’t invent status text for
				// “How it searched”. OpenRouter deltas already stream when present.
				let reasoning = rewrite.reasoning;
				const routing = rewrite.routing;
				if (import.meta.env.DEV) {
					console.info(formatPlannerRoutingLine(routing));
				}
				let shareSlug = resolveAskShareSlug(
					plan.shareSlug,
					plan.lookingFor,
					plan.correctedQuestion || question,
				);
				const persons = plan.offTopic
					? []
					: resolveAskPersonHits({
							correctedQuestion: plan.correctedQuestion,
							lookingFor: plan.lookingFor,
							queries: plan.queries,
							fallbackQueries: plan.fallbackQueries,
							personSlugs: plan.personSlugs,
						});
				send({
					type: "plan",
					requestId,
					correctedQuestion: plan.correctedQuestion,
					lookingFor: plan.lookingFor,
					queries: plan.queries,
					fallbackQueries: plan.fallbackQueries,
					offTopic: plan.offTopic,
					degraded: plan.degraded === true,
					shareSlug,
					persons,
					...(rewrite.plannerNote ? { plannerNote: rewrite.plannerNote } : {}),
					// DEV only — which planner models were tried / used.
					...(import.meta.env.DEV ? { routing } : {}),
				});
				if (plan.offTopic || plan.queries.length === 0) {
					await persistAsk({
						displayQuestion: plan.correctedQuestion,
						lookingFor: plan.lookingFor,
						queries: plan.queries,
						fallbackQueries: plan.fallbackQueries,
						offTopic: plan.offTopic,
						results: [],
						model: usedModel,
						reasoning,
					});
					send({
						type: "results",
						requestId,
						question: plan.correctedQuestion,
						correctedQuestion: plan.correctedQuestion,
						lookingFor: plan.lookingFor,
						queries: plan.queries,
						fallbackQueries: plan.fallbackQueries,
						offTopic: plan.offTopic,
						degraded: plan.degraded === true,
						shareSlug,
						persons,
						results: [],
						model: usedModel,
						quota,
						...(import.meta.env.DEV ? { routing } : {}),
					});
					send({ type: "done" });
					return;
				}
				send({ type: "status", phase: "search", requestId });
				const searched = await searchDiscoursesForQueries(
					plan.queries,
					plan.fallbackQueries,
					{ mergeLimit: AI_SEARCH_CANDIDATE_LIMIT },
				);
				const candidates = searched.hits;
				const showCount = resolveAskResultLimit(
					plan.correctedQuestion || question,
				);
				send({
					type: "status",
					phase: "rerank",
					requestId,
					candidateCount: candidates.length,
					showCount,
				});
				const ranked = await rerankDiscourseHits({
					question: plan.correctedQuestion || question,
					candidates,
					fallbackQueries: plan.fallbackQueries,
					history,
					limit: showCount,
					openRouterModel: model,
					// The planning model is the stronger one; hand its read of the
					// question to the rescorer instead of making it start cold.
					guidance: plan.rankingGuidance,
					planningNotes: reasoning,
				});
				const results = ranked.results;
				const summary = ranked.summary || "";
				if (ranked.shareSlug) {
					shareSlug = resolveAskShareSlug(
						ranked.shareSlug,
						plan.lookingFor,
						plan.correctedQuestion || question,
					);
				}
				if (ranked.reranked) {
					// Track rerank in the model label; don’t pollute “How it searched”.
					const rerankLabel =
						ranked.provider === "openrouter"
							? ranked.model || "openrouter-rerank"
							: ranked.model || "gemini-rerank";
					usedModel = `${usedModel} + ${rerankLabel}`;
				}
				const resultSlugs = results.map((hit) => hit.slug);
				// Rescorer can drop useless “Also tried” chips; else keep fallbacks
				// that actually surfaced a final result slug.
				const usefulFallbacks = ranked.usefulFallbackQueriesSpecified
					? ranked.usefulFallbackQueries
					: queriesForResultSlugs(
							plan.fallbackQueries,
							searched.batches,
							resultSlugs,
						);
				// Same rule for the primary chips: a search that found nothing the
				// rescorer kept (e.g. a stray “AN 8.41”) shouldn’t be shown as if it
				// explained the answer. Keep the full plan when nothing qualifies.
				const contributingQueries = queriesForResultSlugs(
					plan.queries,
					searched.batches,
					resultSlugs,
				);
				const shownQueries =
					contributingQueries.length > 0 ? contributingQueries : plan.queries;
				await persistAsk({
					displayQuestion: plan.correctedQuestion,
					lookingFor: plan.lookingFor,
					queries: plan.queries,
					fallbackQueries: usefulFallbacks,
					offTopic: plan.offTopic,
					results,
					model: usedModel,
					reasoning,
					summary,
				});
				send({
					type: "results",
					requestId,
					question: plan.correctedQuestion,
					correctedQuestion: plan.correctedQuestion,
					lookingFor: plan.lookingFor,
					queries: shownQueries,
					fallbackQueries: usefulFallbacks,
					offTopic: plan.offTopic,
					degraded: plan.degraded === true,
					reranked: ranked.reranked,
					summary,
					shareSlug,
					persons,
					results,
					candidateCount:
						ranked.candidateCount > 0
							? ranked.candidateCount
							: candidates.length,
					showCount: results.length,
					model: usedModel,
					quota,
					...(import.meta.env.DEV
						? {
								routing: {
									...routing,
									degraded: plan.degraded === true,
									...(ranked.reranked
										? {
												reranker:
													ranked.provider === "openrouter"
														? ranked.model || "openrouter-rerank"
														: ranked.model || "gemini-rerank",
											}
										: {}),
								},
							}
						: {}),
				});
				send({ type: "done" });
			} catch (error) {
				const { status, message } = friendlyAskError(error);
				console.error("[ai/ask]", status, error);
				send({ type: "error", error: message, requestId });
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		status: 200,
		headers: {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
};
