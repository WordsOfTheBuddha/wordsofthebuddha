export const prerender = false;
import type { APIRoute } from "astro";
import { verifyUserForAskQuota } from "../../../middleware/auth";
import { rewriteAskQuestion } from "../../../utils/aiAskRewrite";
import { resolveAskShareSlug } from "../../../utils/aiAskShare";
import { consumeAskQuota } from "../../../utils/aiAskQuotaServer";
import { resolveAskPersonHits } from "../../../utils/aiAskPersons";
import {
	AI_SEARCH_CANDIDATE_LIMIT,
	queriesForResultSlugs,
	searchDiscoursesForQueries,
} from "../../../utils/aiDiscourseSearch";
import { toPublicAskHit } from "../../../utils/aiDiscourseHits";
import { buildAskDebugView } from "../../../utils/aiAskDebug";
import {
	resolveAskWriterBudgetMs,
	writeAskAnswer,
} from "../../../utils/aiAskAnswer";
import {
	clipPlanningNotes,
	namedTermHitDebugRows,
	rerankDiscourseHits,
	resolveAskResultLimit,
} from "../../../utils/aiResultRerank";
import {
	clipAiQuestion,
	parseAskHistory,
	resolveRewriteExcludeSlugs,
} from "../../../utils/aiQueryRewrite";
import { collectAskHistoryShownSlugs } from "../../../utils/aiAskHistory";
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
	const searchIndexFailed =
		/Failed to load (?:search-|reference-search-)|got HTML instead of JSON/i.test(
			message,
		);
	const friendly =
		status === 429
			? "The free model is rate-limited right now. Wait a minute, or pick another free model."
			: status === 401
				? "The API key was rejected. Check OPENROUTER_API_KEY or GEMINI_API_KEY."
				: searchIndexFailed
					? "Could not load the discourse library. Try again shortly."
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
	const history = parseAskHistory(body.history);
	const requestId = newAiAskRequestId();
	const startedAt = Date.now();
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			let streamOpen = true;
			const send = (event: unknown) => {
				if (!streamOpen) return;
				try {
					controller.enqueue(encoder.encode(sse(event)));
				} catch {
					streamOpen = false;
				}
			};
			const heartbeat = setInterval(() => {
				send({ type: "ping" });
			}, 10_000);
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
					onReasoningReset: () => send({ type: "reasoning", reset: true }),
				});
				const plan = rewrite.plan;
				let usedModel = rewrite.model;
				// Accepted planner only — discarded OpenRouter thinking is reset
				// above and replaced here so the process box matches the search.
				let reasoning = rewrite.reasoning;
				const routing = rewrite.routing;
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
					reasoning,
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
					{
						mergeLimit: AI_SEARCH_CANDIDATE_LIMIT,
						question: plan.correctedQuestion || question,
						termQueries: plan.termQueries,
					},
				);
				const candidates = searched.hits;
				// Prompt target (10 brief / 50 survey). The rescorer owns the
				// final count — results.length is sent as showCount below.
				const showCount = resolveAskResultLimit(
					`${question} ${plan.correctedQuestion || ""}`,
					plan.coverage,
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
					primaryQueries: plan.queries,
					termQueries: plan.termQueries,
					// Planner-owned blacklist (not a Flash inference from history).
					excludeSlugs: resolveRewriteExcludeSlugs(
						plan,
						collectAskHistoryShownSlugs(history),
						plan.correctedQuestion || question,
					),
				});
				const results = ranked.results;
				let summary = ranked.summary || "";
				let writerModel = "";
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
				const publicResults = results.map(toPublicAskHit);
				const namedDebug = namedTermHitDebugRows(
					candidates,
					plan.correctedQuestion || question,
					plan.queries,
					resultSlugs,
					plan.termQueries,
				);
				const debug = buildAskDebugView({
					coverage: plan.coverage,
					limit: showCount,
					reasoning,
					planningNotes: clipPlanningNotes(reasoning),
					rankingGuidance: plan.rankingGuidance,
					namedTermQueries: namedDebug.namedTermQueries,
					namedTermHits: namedDebug.hits,
				});
				if (import.meta.env.DEV) {
					console.info("[ai/ask] rerank debug", debug);
				}
				const candidateCount =
					ranked.candidateCount > 0
						? ranked.candidateCount
						: candidates.length;
				const sendResults = (partial: boolean) => {
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
						results: publicResults,
						candidateCount,
						showCount: results.length,
						model: usedModel,
						quota,
						partial,
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
										...(writerModel ? { writer: writerModel } : {}),
									},
									debug,
								}
							: {}),
					});
				};
				const writerBudget = resolveAskWriterBudgetMs(Date.now() - startedAt);
				if (
					results.length > 0 &&
					getOpenRouterApiKey() &&
					writerBudget > 0
				) {
					send({
						type: "status",
						phase: "answer",
						requestId,
						candidateCount,
						showCount: results.length,
					});
					// Ranked hits + ranker briefing first. If the writer or the
					// SSE later dies, the client already has a usable answer.
					sendResults(true);
					let writerStarted = false;
					try {
						const written = await writeAskAnswer({
							question: plan.correctedQuestion || question,
							hits: results,
							model: rewrite.model,
							termQueries: plan.termQueries,
							guidance: plan.rankingGuidance,
							history,
							timeoutMs: writerBudget,
							signal: request.signal,
							onReasoning: (delta) => {
								if (!writerStarted) {
									send({ type: "reasoning", reset: true });
									writerStarted = true;
								}
								send({ type: "reasoning", delta });
							},
						});
						if (written.summary) {
							summary = written.summary;
							writerModel = written.model || rewrite.model;
							usedModel = `${usedModel} + ${writerModel}`;
						} else if (writerStarted && reasoning.trim()) {
							send({ type: "reasoning", reset: true });
							send({ type: "reasoning", delta: reasoning });
						}
					} catch (error) {
						console.warn(
							"[ai/ask] thinking writer failed — keeping ranker briefing",
							error instanceof Error ? error.message : error,
						);
						if (writerStarted && reasoning.trim()) {
							send({ type: "reasoning", reset: true });
							send({ type: "reasoning", delta: reasoning });
						}
					}
				}
				await persistAsk({
					displayQuestion: plan.correctedQuestion,
					lookingFor: plan.lookingFor,
					queries: plan.queries,
					fallbackQueries: usefulFallbacks,
					offTopic: plan.offTopic,
					results: publicResults,
					model: usedModel,
					reasoning,
					summary,
				});
				sendResults(false);
				send({ type: "done" });
			} catch (error) {
				const { status, message } = friendlyAskError(error);
				console.error("[ai/ask]", status, error);
				send({ type: "error", error: message, requestId });
			} finally {
				clearInterval(heartbeat);
				streamOpen = false;
				try {
					controller.close();
				} catch {
					/* already closed */
				}
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
