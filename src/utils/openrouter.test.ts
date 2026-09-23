import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CURATED_ASK_MODELS,
	DEFAULT_OPENROUTER_MODEL,
	ASK_PLANNER_FALLBACK_ORDER,
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	ASK_PLANNER_PAID_REASONING_EFFORT,
	ASK_PLANNER_REASONING_EFFORT,
	ASK_RESEARCH_VERIFY_REASONING_EFFORT,
	ASK_WRITER_REASONING_EFFORT,
	askPlannerChatOptions,
	askWriterChatOptions,
	formatOpenRouterUsageLine,
	resolveReasoningEffort,
	openRouterProviderPreferences,
	openRouterReasoningBody,
	createContentThinkSplitter,
	getAskPickerDefaultModel,
	isAllowedFreeModelId,
	isAskPlannerPaidFallbackModelId,
	isCuratedAskModelId,
	isFreeCatalogModel,
	openRouterChoiceDelta,
	openRouterModelLabel,
	parseOpenRouterUsage,
	resolveOpenRouterChatModel,
	resolveRequestedOpenRouterModel,
	selectFreeOpenRouterModels,
	shouldShowAiModelPicker,
	splitThinkTags,
	streamDeltaContent,
	streamDeltaReasoning,
} from "./openrouter";
import {
	DEEPSEEK_V4_1_FLASH_MODEL,
	GPT6_LUNA_PRO_MODEL,
	paidRouteAttempts,
	type PaidRouteEndpoint,
} from "./paidModelRoute";

describe("streamDeltaReasoning", () => {
	it("reads the normalized field first and never doubles up", () => {
		assert.equal(
			streamDeltaReasoning({
				reasoning: "a",
				reasoning_details: [{ type: "reasoning.text", text: "a" }],
			}),
			"a",
		);
	});

	it("falls back to reasoning_content, then reasoning_details text", () => {
		assert.equal(streamDeltaReasoning({ reasoning_content: "b" }), "b");
		assert.equal(
			streamDeltaReasoning({
				reasoning_details: [
					{ type: "reasoning.text", text: "c" },
					{ type: "reasoning.encrypted", data: "zzz" },
					{ type: "reasoning.summary", summary: "d" },
				],
			}),
			"cd",
		);
		assert.equal(streamDeltaReasoning({ content: "x" }), "");
	});

	it("reads GLM-style thinking fields and content blocks", () => {
		assert.equal(
			streamDeltaReasoning({
				reasoning_details: [{ type: "reasoning", thinking: "glm think" }],
			}),
			"glm think",
		);
		assert.equal(
			streamDeltaReasoning({
				content: [{ type: "thinking", thinking: "block think" }],
			}),
			"block think",
		);
		assert.equal(
			streamDeltaContent({
				content: [
					{ type: "thinking", thinking: "hidden" },
					{ type: "text", text: '{"a":1}' },
				],
			}),
			'{"a":1}',
		);
	});
});

describe("openRouterChoiceDelta", () => {
	it("reads delta fields, or a message-only final chunk", () => {
		assert.deepEqual(
			openRouterChoiceDelta({
				delta: { reasoning_content: "from delta" },
			}),
			{ reasoning: "from delta", content: "" },
		);
		assert.deepEqual(
			openRouterChoiceDelta({
				message: { reasoning_content: "late", content: '{"ok":true}' },
			}),
			{ reasoning: "late", content: '{"ok":true}' },
		);
	});
});

describe("createContentThinkSplitter", () => {
	it("streams unclosed <think> tags into reasoning", () => {
		const take = createContentThinkSplitter();
		assert.deepEqual(take("<think>hi"), { reasoning: "hi", content: "" });
		assert.deepEqual(take(" there</think>{\"a\":1}"), {
			reasoning: " there",
			content: '{"a":1}',
		});
	});
});

describe("resolveReasoningEffort", () => {
	it("maps medium to high for GLM and DeepSeek, and leaves GPT and free models alone", () => {
		assert.equal(
			resolveReasoningEffort(ASK_PLANNER_PAID_FALLBACK_MODEL, "medium"),
			"high",
		);
		assert.equal(
			resolveReasoningEffort(DEEPSEEK_V4_1_FLASH_MODEL, "medium"),
			"high",
		);
		assert.equal(
			resolveReasoningEffort(ASK_PLANNER_PAID_FALLBACK_MODEL, "low"),
			"low",
		);
		assert.equal(resolveReasoningEffort(GPT6_LUNA_PRO_MODEL, "medium"), "medium");
		assert.equal(
			resolveReasoningEffort("nvidia/nemotron-3-ultra-550b-a55b:free", "medium"),
			"medium",
		);
		assert.equal(ASK_RESEARCH_VERIFY_REASONING_EFFORT, "low");
	});
});

describe("askPlannerChatOptions", () => {
	it("drops json_object and uses high effort for paid GLM and DeepSeek", () => {
		assert.deepEqual(askPlannerChatOptions(ASK_PLANNER_PAID_FALLBACK_MODEL), {
			jsonMode: false,
			reasoningEffort: ASK_PLANNER_PAID_REASONING_EFFORT,
		});
		assert.deepEqual(askPlannerChatOptions(DEEPSEEK_V4_1_FLASH_MODEL), {
			jsonMode: false,
			reasoningEffort: ASK_PLANNER_PAID_REASONING_EFFORT,
		});
		assert.deepEqual(askPlannerChatOptions(GPT6_LUNA_PRO_MODEL), {
			jsonMode: false,
			reasoningEffort: ASK_PLANNER_REASONING_EFFORT,
		});
		assert.equal(ASK_PLANNER_PAID_REASONING_EFFORT, "high");
		assert.deepEqual(
			askPlannerChatOptions("nvidia/nemotron-3-ultra-550b-a55b:free"),
			{
				jsonMode: true,
				reasoningEffort: ASK_PLANNER_REASONING_EFFORT,
			},
		);
	});
});

describe("askWriterChatOptions", () => {
	it("uses low effort and keeps paid models off json_object", () => {
		assert.deepEqual(askWriterChatOptions(ASK_PLANNER_PAID_FALLBACK_MODEL), {
			jsonMode: false,
			reasoningEffort: ASK_WRITER_REASONING_EFFORT,
		});
		assert.equal(askWriterChatOptions(DEEPSEEK_V4_1_FLASH_MODEL).jsonMode, false);
		assert.equal(askWriterChatOptions(GPT6_LUNA_PRO_MODEL).jsonMode, false);
		assert.deepEqual(
			askWriterChatOptions("nvidia/nemotron-3-ultra-550b-a55b:free"),
			{
				jsonMode: true,
				reasoningEffort: ASK_WRITER_REASONING_EFFORT,
			},
		);
		assert.equal(ASK_WRITER_REASONING_EFFORT, "low");
	});
});

describe("openRouterReasoningBody", () => {
	it("sends effort or max_tokens, never both", () => {
		assert.deepEqual(openRouterReasoningBody("low"), {
			effort: "low",
			exclude: false,
		});
		assert.deepEqual(openRouterReasoningBody("low", 1024), {
			exclude: false,
			max_tokens: 1024,
		});
		assert.deepEqual(openRouterReasoningBody("medium", 0), {
			effort: "medium",
			exclude: false,
		});
	});
});

describe("splitThinkTags", () => {
	it("moves <think> blocks out of content", () => {
		const split = splitThinkTags('<think>plan it</think>\n{"a":1}');
		assert.equal(split.reasoning, "plan it");
		assert.equal(split.content, '{"a":1}');
		assert.deepEqual(splitThinkTags('{"a":1}'), { content: '{"a":1}', reasoning: "" });
		const open = splitThinkTags('<think>still thinking\n{"a":1}');
		assert.equal(open.reasoning, 'still thinking\n{"a":1}');
		assert.equal(open.content, "");
	});
});

describe("isAllowedFreeModelId", () => {
	it("allows :free models and the free router", () => {
		assert.equal(isAllowedFreeModelId(DEFAULT_OPENROUTER_MODEL), true);
		assert.equal(isAllowedFreeModelId("openrouter/free"), true);
		assert.equal(isAllowedFreeModelId("meta-llama/llama-3.2-3b-instruct:free"), true);
	});

	it("rejects paid and malformed ids", () => {
		assert.equal(isAllowedFreeModelId("openai/gpt-4o"), false);
		assert.equal(isAllowedFreeModelId("nvidia/nemotron-3-ultra-550b-a55b"), false);
		assert.equal(isAllowedFreeModelId("z-ai/glm-5.3-flash"), false);
		assert.equal(isAllowedFreeModelId(ASK_PLANNER_PAID_FALLBACK_MODEL), false);
		assert.equal(isAllowedFreeModelId("evil:free extra"), false);
		assert.equal(isAllowedFreeModelId(""), false);
	});
});

describe("resolveRequestedOpenRouterModel", () => {
	const FLAG = "PUBLIC_AI_SHOW_MODEL_PICKER";

	function withFlag(value: string | undefined, fn: () => void) {
		const prev = process.env[FLAG];
		try {
			if (value === undefined) delete process.env[FLAG];
			else process.env[FLAG] = value;
			fn();
		} finally {
			if (prev === undefined) delete process.env[FLAG];
			else process.env[FLAG] = prev;
		}
	}

	it("defaults to paid GLM when the free picker is hidden", () => {
		withFlag(undefined, () => {
			assert.equal(shouldShowAiModelPicker(), false);
			assert.equal(
				resolveRequestedOpenRouterModel(),
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			);
			assert.equal(
				resolveRequestedOpenRouterModel(DEFAULT_OPENROUTER_MODEL),
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			);
			assert.equal(
				resolveRequestedOpenRouterModel("openai/gpt-4o"),
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			);
		});
	});

	it("accepts curated free models when the picker is shown", () => {
		withFlag("1", () => {
			for (const model of CURATED_ASK_MODELS) {
				assert.equal(resolveRequestedOpenRouterModel(model.id), model.id);
				assert.equal(isCuratedAskModelId(model.id), true);
			}
		});
	});

	it("rejects arbitrary paid ids from the client when the picker is shown", () => {
		withFlag("1", () => {
			const resolved = resolveRequestedOpenRouterModel("openai/gpt-4o");
			assert.equal(isAllowedFreeModelId(resolved), true);
			assert.notEqual(resolved, "openai/gpt-4o");
			assert.notEqual(
				resolveRequestedOpenRouterModel(ASK_PLANNER_PAID_FALLBACK_MODEL),
				ASK_PLANNER_PAID_FALLBACK_MODEL,
			);
		});
	});

	it("ignores retired :free ids the client may still have stored", () => {
		assert.notEqual(
			resolveRequestedOpenRouterModel("minimax/minimax-m3:free"),
			"minimax/minimax-m3:free",
		);
	});
});

describe("resolveOpenRouterChatModel", () => {
	it("allows paid GLM and curated free fallbacks on internal calls", () => {
		assert.equal(
			resolveOpenRouterChatModel(ASK_PLANNER_PAID_FALLBACK_MODEL),
			ASK_PLANNER_PAID_FALLBACK_MODEL,
		);
		assert.equal(
			resolveOpenRouterChatModel(DEFAULT_OPENROUTER_MODEL),
			DEFAULT_OPENROUTER_MODEL,
		);
		assert.equal(isAskPlannerPaidFallbackModelId(ASK_PLANNER_PAID_FALLBACK_MODEL), true);
		assert.equal(isCuratedAskModelId(ASK_PLANNER_PAID_FALLBACK_MODEL), false);
		assert.equal(
			openRouterModelLabel(ASK_PLANNER_PAID_FALLBACK_MODEL),
			"Z.ai: GLM 5.3 Flash",
		);
		assert.deepEqual(ASK_PLANNER_FALLBACK_ORDER, [
			ASK_PLANNER_PAID_FALLBACK_MODEL,
		]);
	});
});

describe("openRouterProviderPreferences", () => {
	it("uses OpenRouter native price sort for an unpinned paid call", () => {
		assert.deepEqual(
			openRouterProviderPreferences(ASK_PLANNER_PAID_FALLBACK_MODEL),
			{ sort: "price", allow_fallbacks: true },
		);
		assert.equal(
			openRouterProviderPreferences(DEFAULT_OPENROUTER_MODEL),
			undefined,
		);
	});

	it("pins a scored provider and keeps GLM price sort as the last attempt", () => {
		const host: PaidRouteEndpoint = {
			modelId: DEEPSEEK_V4_1_FLASH_MODEL,
			providerTag: "relace",
			promptPerToken: 0.00000006,
			completionPerToken: 0.00000032,
			throughput: 52,
			uptime1d: 100,
			status: 0,
		};
		const attempts = paidRouteAttempts([host], {
			inputTokens: 12_000,
			kind: "ask",
		});
		assert.deepEqual(attempts[0]?.provider, {
			only: ["relace"],
			allow_fallbacks: false,
		});
		assert.deepEqual(attempts[1]?.provider, {
			sort: "price",
			allow_fallbacks: true,
		});
	});
});

describe("parseOpenRouterUsage", () => {
	it("reads tokens, cache, cost, and provider", () => {
		const usage = parseOpenRouterUsage({
			id: "gen-abc",
			provider: "Baidu",
			usage: {
				prompt_tokens: 1200,
				completion_tokens: 80,
				cost: 0.00042,
				prompt_tokens_details: { cached_tokens: 100 },
				completion_tokens_details: { reasoning_tokens: 40 },
			},
		});
		assert.deepEqual(usage, {
			promptTokens: 1200,
			completionTokens: 80,
			reasoningTokens: 40,
			cachedTokens: 100,
			cost: 0.00042,
			provider: "Baidu",
			generationId: "gen-abc",
		});
		assert.equal(
			formatOpenRouterUsageLine("z-ai/glm-5.3-flash", usage!),
			"[openrouter] model=z-ai/glm-5.3-flash provider=Baidu cost=0.00042 prompt=1200 completion=80 reason=40 cache=100 gen=gen-abc",
		);
		assert.equal(parseOpenRouterUsage({ model: "x" }), null);
	});
});

describe("shouldShowAiModelPicker", () => {
	const FLAG = "PUBLIC_AI_SHOW_MODEL_PICKER";

	function withFlag(value: string | undefined, fn: () => void) {
		const prev = process.env[FLAG];
		try {
			if (value === undefined) delete process.env[FLAG];
			else process.env[FLAG] = value;
			fn();
		} finally {
			if (prev === undefined) delete process.env[FLAG];
			else process.env[FLAG] = prev;
		}
	}

	it("defaults to hiding the free-model picker", () => {
		withFlag(undefined, () => {
			assert.equal(shouldShowAiModelPicker(), false);
		});
	});

	it("shows when PUBLIC_AI_SHOW_MODEL_PICKER is 1 or true", () => {
		withFlag("1", () => {
			assert.equal(shouldShowAiModelPicker(), true);
		});
		withFlag("true", () => {
			assert.equal(shouldShowAiModelPicker(), true);
		});
	});

	it("stays hidden when PUBLIC_AI_SHOW_MODEL_PICKER is 0 or false", () => {
		withFlag("0", () => {
			assert.equal(shouldShowAiModelPicker(), false);
		});
		withFlag("false", () => {
			assert.equal(shouldShowAiModelPicker(), false);
		});
	});
});

describe("selectFreeOpenRouterModels", () => {
	it("returns only the curated shortlist (no Gemma)", () => {
		const models = selectFreeOpenRouterModels([
			{
				id: "openai/gpt-4o",
				name: "GPT-4o",
				pricing: { prompt: "2.5", completion: "10" },
			},
			{
				id: "qwen/qwen3-8b:free",
				name: "Qwen3 8B (free)",
				pricing: { prompt: "0", completion: "0" },
			},
			{
				id: "google/gemma-4-31b-it:free",
				name: "Gemma 4 31B (free)",
				pricing: { prompt: "0", completion: "0" },
			},
			{
				id: "nvidia/nemotron-3.5-lightning:free",
				name: "Nemotron 3.5 Lightning (free)",
				pricing: { prompt: "0", completion: "0" },
				context_length: 262144,
			},
		]);
		assert.equal(models.length, CURATED_ASK_MODELS.length);
		assert.equal(
			DEFAULT_OPENROUTER_MODEL,
			"nvidia/nemotron-3-ultra-550b-a55b:free",
		);
		assert.deepEqual(
			models.map((model) => model.id),
			[
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				"nvidia/nemotron-3.5-lightning:free",
			],
		);
		assert.equal(
			models.some((model) => model.id === "google/gemma-4-31b-it:free"),
			false,
		);
		assert.equal(
			models.some((model) => model.id === "qwen/qwen3-8b:free"),
			false,
		);
		// Picker default is the curated product default, not a stale process env.
		assert.equal(models[0]?.id, getAskPickerDefaultModel());
	});

	it("treats :free as free even without pricing", () => {
		assert.equal(isFreeCatalogModel({ id: "foo/bar:free" }), true);
		assert.equal(isFreeCatalogModel({ id: "foo/bar" }), false);
	});
});
