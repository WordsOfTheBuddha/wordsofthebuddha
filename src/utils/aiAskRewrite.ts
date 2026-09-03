import {
	buildRewriteMessages,
	parseRewritePlan,
	shouldRetryUnusableRewrite,
	type AiRewriteHistoryTurn,
	type AiRewritePlan,
} from "./aiQueryRewrite";
import {
	geminiGenerate,
	getConfiguredGeminiModel,
	isGeminiConfigured,
	shouldFallbackRewriteToGemini,
	type GeminiChatMessage,
} from "./gemini";
import { plannerModelHealth } from "./aiPlannerHealth";
import {
	ASK_PLANNER_FALLBACK_ORDER,
	ASK_PLANNER_MAX_TOKENS,
	ASK_PLANNER_REASONING_EFFORT,
	curatedAskModelLabel,
	getOpenRouterApiKey,
	openRouterChatStream,
	splitThinkTags,
	type OpenRouterChatMessage,
} from "./openrouter";

/** Trace of which planner models were considered / used (DEV + logs). */
export interface AiAskPlannerRouting {
	requested: string;
	/** Planned OpenRouter attempt order after cooldown filtering (queue, not calls). */
	queue: string[];
	/** Models actually invoked for this Ask (in order). */
	attempts: string[];
	/** Requested/fallback models skipped because they are in cooldown. */
	skippedCooldown: string[];
	/** Models that failed or returned an unusable rewrite before a later success. */
	failed: Array<{ model: string; status?: number; message: string }>;
	/** Model that produced the accepted plan (OpenRouter id or Gemini id). */
	used: string;
	provider: "openrouter" | "gemini";
	/** True when search queries were synthesized because the rewrite was unusable. */
	degraded: boolean;
	/** Why the accepted plan is degraded (if any). */
	degradedReason?: AiRewritePlan["degradedReason"];
	/** Rescorer / summary model when separate from the planner (results event). */
	reranker?: string;
}

export interface AiAskRewriteResult {
	plan: AiRewritePlan;
	reasoning: string;
	model: string;
	provider: "openrouter" | "gemini";
	/** Model the reader picked (or the default) before any fallback. */
	requestedModel: string;
	/**
	 * Reader-facing note when the plan did not come from the requested model
	 * (e.g. “GLM 5.2 was busy — planned with Nemotron 3 Ultra instead”).
	 */
	plannerNote?: string;
	routing: AiAskPlannerRouting;
}

/** One-line summary for terminal / on-page DEV output. */
export function formatPlannerRoutingLine(routing: AiAskPlannerRouting): string {
	const called = routing.attempts.join(" → ") || "(none)";
	const skipped =
		routing.skippedCooldown.length > 0
			? ` | skipped cooldown: ${routing.skippedCooldown.join(", ")}`
			: "";
	const failed =
		routing.failed.length > 0
			? ` | failed: ${routing.failed
					.map((item) =>
						item.status
							? `${item.model} (${item.status})`
							: `${item.model} (${item.message.slice(0, 40)})`,
					)
					.join(", ")}`
			: "";
	const degraded = routing.degraded
		? ` | degraded${routing.degradedReason ? `:${routing.degradedReason}` : ""}`
		: "";
	const reranker = routing.reranker ? ` | rerank=${routing.reranker}` : "";
	return `[ai/ask] planner requested=${routing.requested} called=${called}${skipped}${failed} → used=${routing.used} (${routing.provider})${reranker}${degraded}`;
}

/** OpenRouter planner attempts (requested + fallbacks) before Gemini. */
export const MAX_PLANNER_OPENROUTER_ATTEMPTS = 3;

function openRouterMessagesToGemini(
	messages: readonly OpenRouterChatMessage[],
): { system: string; messages: GeminiChatMessage[] } {
	let system = "";
	const out: GeminiChatMessage[] = [];
	for (const message of messages) {
		if (message.role === "system") {
			system = [system, message.content].filter(Boolean).join("\n\n");
			continue;
		}
		out.push({
			role: message.role === "assistant" ? "model" : "user",
			content: message.content,
		});
	}
	return { system, messages: out };
}

function errorStatus(error: unknown): number {
	return typeof error === "object" &&
		error &&
		"status" in error &&
		typeof (error as { status?: unknown }).status === "number"
		? (error as { status: number }).status
		: 0;
}

/**
 * Rate limits and outages, plus “this model isn’t available to this key”
 * (403/404) — all reasons to try the next curated model rather than fail.
 */
export function shouldTryAnotherPlannerModel(error: unknown): boolean {
	const status = errorStatus(error);
	if (status === 403 || status === 404 || status === 408) return true;
	const message = error instanceof Error ? error.message : String(error || "");
	// Per-attempt AbortSignal.timeout — try the next curated model.
	if (error instanceof DOMException && error.name === "TimeoutError") return true;
	if (/timeout|aborted|AbortError/i.test(message) && status !== 401) return true;
	// Unsupported response_format / params — try next without failing the Ask.
	if (status === 400) return true;
	return shouldFallbackRewriteToGemini(error);
}

export interface PlannerModelAttemptsOptions {
	/** Skip models currently in cooldown (recent repeated failures). */
	isExcluded?: (modelId: string) => boolean;
}

/**
 * Requested/default model first, then stronger→lighter fallbacks.
 * Caps at `maxAttempts` OpenRouter models; Gemini is separate after that.
 * Models in cooldown are skipped so the list still fills up to `maxAttempts`
 * from healthier options when possible.
 *
 * Example (requested = Ultra): Ultra → MiniMax → GLM
 * Example (requested = GLM): GLM → Ultra → MiniMax
 */
export function plannerModelAttempts(
	requested: string,
	fallbackOrder: readonly string[] = ASK_PLANNER_FALLBACK_ORDER,
	maxAttempts = MAX_PLANNER_OPENROUTER_ATTEMPTS,
	options: PlannerModelAttemptsOptions = {},
): string[] {
	const isExcluded = options.isExcluded ?? (() => false);
	const out: string[] = [];
	const push = (id: string) => {
		const trimmed = id.trim();
		if (!trimmed || out.includes(trimmed) || out.length >= maxAttempts) return;
		if (isExcluded(trimmed)) return;
		out.push(trimmed);
	};
	push(requested);
	for (const id of fallbackOrder) push(id);
	return out;
}

async function rewriteWithOpenRouter(options: {
	question: string;
	history: readonly AiRewriteHistoryTurn[];
	model: string;
	onReasoning?: (delta: string) => void;
	signal?: AbortSignal;
}): Promise<Omit<AiAskRewriteResult, "requestedModel" | "routing">> {
	const messages = buildRewriteMessages(options.question, options.history);
	let content = "";
	let reasoning = "";
	let usedModel = options.model;
	let usedJsonMode = true;
	const runStream = async (jsonMode: boolean) => {
		content = "";
		reasoning = "";
		usedModel = options.model;
		usedJsonMode = jsonMode;
		for await (const chunk of openRouterChatStream({
			model: options.model,
			messages,
			maxTokens: ASK_PLANNER_MAX_TOKENS,
			reasoningEffort: ASK_PLANNER_REASONING_EFFORT,
			jsonMode,
			signal: options.signal,
		})) {
			if (chunk.reasoning) {
				reasoning += chunk.reasoning;
				options.onReasoning?.(chunk.reasoning);
			}
			if (chunk.content) content += chunk.content;
			if (chunk.model) usedModel = chunk.model;
		}
	};
	try {
		await runStream(true);
	} catch (error) {
		// Some free providers reject response_format — retry once without it.
		if (errorStatus(error) === 400 && usedJsonMode) {
			console.warn(
				`[ai/ask] planner ${options.model} rejected json_mode; retrying without it`,
			);
			await runStream(false);
		} else {
			throw error;
		}
	}
	// Models that think inside <think> tags in the content stream.
	if (!reasoning.trim()) {
		const split = splitThinkTags(content);
		if (split.reasoning) {
			reasoning = split.reasoning;
			content = split.content;
			options.onReasoning?.(split.reasoning);
		}
	}
	const plan = parseRewritePlan(content, options.question);
	if (plan.degraded && import.meta.env?.DEV) {
		const preview = content.replace(/\s+/g, " ").trim().slice(0, 280);
		console.warn(
			`[ai/ask] planner ${usedModel} unusable rewrite (${plan.degradedReason || "degraded"}): ${preview || "(empty content)"}`,
		);
	}
	return {
		plan,
		reasoning,
		model: usedModel,
		provider: "openrouter",
	};
}

async function rewriteWithGemini(options: {
	question: string;
	history: readonly AiRewriteHistoryTurn[];
	signal?: AbortSignal;
}): Promise<Omit<AiAskRewriteResult, "requestedModel" | "routing">> {
	const messages = buildRewriteMessages(options.question, options.history);
	const gemini = openRouterMessagesToGemini(messages);
	const model = getConfiguredGeminiModel();
	const generated = await geminiGenerate({
		model,
		system: gemini.system,
		messages: gemini.messages,
		maxOutputTokens: 1200,
		temperature: 0.2,
		signal: options.signal,
	});
	return {
		plan: parseRewritePlan(generated.content, options.question),
		reasoning: "",
		model: generated.model || model,
		provider: "gemini",
	};
}

function modelLabel(id: string): string {
	return curatedAskModelLabel(id).replace(/^[^:]+:\s*/, "");
}

function failureMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error || "error");
}

/** Medium-effort reasoning on free models can take a while on hard questions. */
const PLANNER_ATTEMPT_MS = 90_000;

/**
 * Plan the Ask. Prefer the requested OpenRouter model (it streams reasoning);
 * when it is rate-limited or unavailable try the other curated models before
 * falling back to Gemini (no reasoning stream) when GEMINI_API_KEY is set.
 *
 * Each attempt gets its own timeout so a slow/refusing first model does not
 * abort the whole fallback chain via a shared AbortSignal.
 */
export async function rewriteAskQuestion(options: {
	question: string;
	history?: readonly AiRewriteHistoryTurn[];
	model: string;
	onReasoning?: (delta: string) => void;
	signal?: AbortSignal;
}): Promise<AiAskRewriteResult> {
	const history = options.history || [];
	const requested = options.model;
	const parentSignal = options.signal;

	const attemptSignal = (): AbortSignal => {
		const timeout = AbortSignal.timeout(PLANNER_ATTEMPT_MS);
		if (!parentSignal) return timeout;
		if (typeof AbortSignal.any === "function") {
			return AbortSignal.any([parentSignal, timeout]);
		}
		return parentSignal.aborted ? parentSignal : timeout;
	};

	const fullOrder = plannerModelAttempts(
		requested,
		ASK_PLANNER_FALLBACK_ORDER,
		ASK_PLANNER_FALLBACK_ORDER.length + 1,
	);
	const queue = plannerModelAttempts(
		requested,
		ASK_PLANNER_FALLBACK_ORDER,
		MAX_PLANNER_OPENROUTER_ATTEMPTS,
		{ isExcluded: (id) => plannerModelHealth.isExcluded(id) },
	);
	const skippedCooldown = fullOrder.filter(
		(id) =>
			plannerModelHealth.isExcluded(id) && !queue.includes(id),
	);
	const failed: AiAskPlannerRouting["failed"] = [];
	const called: string[] = [];

	const buildRouting = (
		used: string,
		provider: "openrouter" | "gemini",
		plan: AiRewritePlan,
	): AiAskPlannerRouting => ({
		requested,
		queue,
		attempts: [...called],
		skippedCooldown,
		failed: [...failed],
		used,
		provider,
		degraded: plan.degraded === true,
		...(plan.degradedReason ? { degradedReason: plan.degradedReason } : {}),
	});

	if (getOpenRouterApiKey()) {
		let lastError: unknown = null;
		if (skippedCooldown.includes(requested.trim())) {
			console.warn(
				`[ai/ask] planner ${requested} in cooldown — skipping for ~${Math.ceil(plannerModelHealth.cooldownRemainingMs(requested) / 60_000)}m`,
			);
		}
		for (const model of queue) {
			if (parentSignal?.aborted) throw parentSignal.reason ?? lastError;
			called.push(model);
			try {
				const result = await rewriteWithOpenRouter({
					question: options.question,
					history,
					model,
					onReasoning: options.onReasoning,
					signal: attemptSignal(),
				});
				if (shouldRetryUnusableRewrite(result.plan)) {
					failed.push({
						model,
						message: `unusable rewrite (${result.plan.degradedReason || "degraded"})`,
					});
					const hasNextOpenRouter = queue.indexOf(model) < queue.length - 1;
					if (hasNextOpenRouter || isGeminiConfigured()) {
						console.warn(
							`[ai/ask] planner ${model} returned unusable rewrite; trying next`,
						);
						// Soft miss — don’t cool the model down like a 429.
						if (hasNextOpenRouter) continue;
						break; // fall through to Gemini
					}
				}
				plannerModelHealth.recordSuccess(model);
				const skippedRequested = skippedCooldown.includes(requested.trim());
				const note =
					model !== requested
						? skippedRequested
							? `${modelLabel(requested)} was recently unavailable — planned with ${modelLabel(model)} instead.`
							: `${modelLabel(requested)} was busy — planned with ${modelLabel(model)} instead.`
						: undefined;
				return {
					...result,
					requestedModel: requested,
					routing: buildRouting(result.model, "openrouter", result.plan),
					...(note ? { plannerNote: note } : {}),
				};
			} catch (error) {
				lastError = error;
				plannerModelHealth.recordFailure(model, error);
				failed.push({
					model,
					...(errorStatus(error) ? { status: errorStatus(error) } : {}),
					message: failureMessage(error),
				});
				if (parentSignal?.aborted || !shouldTryAnotherPlannerModel(error)) {
					throw error;
				}
				console.warn(
					`[ai/ask] planner ${model} unavailable (${errorStatus(error) || "error"}); trying next`,
					error instanceof Error ? error.message : error,
				);
			}
		}
		if (!isGeminiConfigured()) {
			if (lastError) throw lastError;
			const error = new Error(
				"Ask planners returned unusable rewrites and Gemini is not configured.",
			) as Error & { status?: number };
			error.status = 502;
			throw error;
		}
		console.warn(
			queue.length === 0
				? "[ai/ask] all OpenRouter planners in cooldown — using Gemini"
				: "[ai/ask] all OpenRouter planners failed or unusable; using Gemini",
		);
		called.push(getConfiguredGeminiModel());
		const result = await rewriteWithGemini({
			question: options.question,
			history,
			signal: attemptSignal(),
		});
		return {
			...result,
			requestedModel: requested,
			routing: buildRouting(result.model, "gemini", result.plan),
			plannerNote:
				queue.length === 0
					? `Free models were recently unavailable — planned with Gemini instead, which does not share its thinking.`
					: `${modelLabel(requested)} and the other free models were busy — planned with Gemini instead, which does not share its thinking.`,
		};
	}

	if (!isGeminiConfigured()) {
		const error = new Error("Ask is not configured on this server.") as Error & {
			status?: number;
		};
		error.status = 503;
		throw error;
	}
	called.push(getConfiguredGeminiModel());
	const result = await rewriteWithGemini({
		question: options.question,
		history,
		signal: attemptSignal(),
	});
	return {
		...result,
		requestedModel: requested,
		routing: buildRouting(result.model, "gemini", result.plan),
	};
}
