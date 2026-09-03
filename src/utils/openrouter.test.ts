import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CURATED_ASK_MODELS,
	DEFAULT_OPENROUTER_MODEL,
	getAskPickerDefaultModel,
	isAllowedFreeModelId,
	isCuratedAskModelId,
	isFreeCatalogModel,
	resolveRequestedOpenRouterModel,
	selectFreeOpenRouterModels,
	shouldShowAiModelPicker,
	splitThinkTags,
	streamDeltaReasoning,
} from "./openrouter";

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
});

describe("splitThinkTags", () => {
	it("moves <think> blocks out of content", () => {
		const split = splitThinkTags('<think>plan it</think>\n{"a":1}');
		assert.equal(split.reasoning, "plan it");
		assert.equal(split.content, '{"a":1}');
		assert.deepEqual(splitThinkTags('{"a":1}'), { content: '{"a":1}', reasoning: "" });
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
		assert.equal(isAllowedFreeModelId("evil:free extra"), false);
		assert.equal(isAllowedFreeModelId(""), false);
	});
});

describe("resolveRequestedOpenRouterModel", () => {
	it("accepts curated free models", () => {
		for (const model of CURATED_ASK_MODELS) {
			assert.equal(resolveRequestedOpenRouterModel(model.id), model.id);
			assert.equal(isCuratedAskModelId(model.id), true);
		}
	});

	it("falls back away from paid ids", () => {
		const resolved = resolveRequestedOpenRouterModel("openai/gpt-4o");
		assert.equal(isAllowedFreeModelId(resolved), true);
		assert.notEqual(resolved, "openai/gpt-4o");
	});
});

describe("shouldShowAiModelPicker", () => {
	it("defaults to showing the free-model picker", async () => {
		const { shouldShowAiModelPicker } = await import("./openrouter");
		assert.equal(shouldShowAiModelPicker(), true);
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
				id: "z-ai/glm-5.2:free",
				name: "GLM 5.2 (free)",
				pricing: { prompt: "0", completion: "0" },
				context_length: 256000,
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
				"minimax/minimax-m3:free",
				"z-ai/glm-5.2:free",
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
