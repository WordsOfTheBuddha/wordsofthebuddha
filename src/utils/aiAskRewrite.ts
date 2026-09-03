import {
	buildRewriteMessages,
	parseRewritePlan,
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
import {
	getOpenRouterApiKey,
	openRouterChatStream,
	type OpenRouterChatMessage,
} from "./openrouter";

export interface AiAskRewriteResult {
	plan: AiRewritePlan;
	reasoning: string;
	model: string;
	provider: "openrouter" | "gemini";
}

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

async function rewriteWithOpenRouter(options: {
	question: string;
	history: readonly AiRewriteHistoryTurn[];
	model: string;
	onReasoning?: (delta: string) => void;
	signal?: AbortSignal;
}): Promise<AiAskRewriteResult> {
	const messages = buildRewriteMessages(options.question, options.history);
	let content = "";
	let reasoning = "";
	let usedModel = options.model;
	for await (const chunk of openRouterChatStream({
		model: options.model,
		messages,
		signal: options.signal,
	})) {
		if (chunk.reasoning) {
			reasoning += chunk.reasoning;
			options.onReasoning?.(chunk.reasoning);
		}
		if (chunk.content) content += chunk.content;
		if (chunk.model) usedModel = chunk.model;
	}
	return {
		plan: parseRewritePlan(content, options.question),
		reasoning,
		model: usedModel,
		provider: "openrouter",
	};
}

async function rewriteWithGemini(options: {
	question: string;
	history: readonly AiRewriteHistoryTurn[];
	signal?: AbortSignal;
}): Promise<AiAskRewriteResult> {
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

/**
 * Prefer OpenRouter for rewrite; fall back to Gemini on rate-limits / outages
 * when GEMINI_API_KEY is configured.
 */
export async function rewriteAskQuestion(options: {
	question: string;
	history?: readonly AiRewriteHistoryTurn[];
	model: string;
	onReasoning?: (delta: string) => void;
	signal?: AbortSignal;
}): Promise<AiAskRewriteResult> {
	const history = options.history || [];
	const signal = options.signal ?? AbortSignal.timeout(45_000);

	if (getOpenRouterApiKey()) {
		try {
			return await rewriteWithOpenRouter({
				question: options.question,
				history,
				model: options.model,
				onReasoning: options.onReasoning,
				signal,
			});
		} catch (error) {
			if (!isGeminiConfigured() || !shouldFallbackRewriteToGemini(error)) {
				throw error;
			}
			console.warn("[ai/ask] OpenRouter rewrite failed; trying Gemini", error);
			return rewriteWithGemini({
				question: options.question,
				history,
				signal: AbortSignal.timeout(45_000),
			});
		}
	}

	if (!isGeminiConfigured()) {
		const error = new Error("Ask is not configured on this server.") as Error & {
			status?: number;
		};
		error.status = 503;
		throw error;
	}
	return rewriteWithGemini({
		question: options.question,
		history,
		signal,
	});
}
