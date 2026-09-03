/**
 * OpenRouter server helpers. The API key must never reach the browser.
 */

export interface OpenRouterFreeModel {
	id: string;
	name: string;
	contextLength: number;
}

/** Curated free models offered in the Ask picker (limited top choices). */
export const CURATED_ASK_MODELS: readonly OpenRouterFreeModel[] = [
	{
		id: "z-ai/glm-5.2:free",
		name: "Z.ai: GLM 5.2",
		contextLength: 0,
	},
	{
		id: "google/gemma-4-31b-it:free",
		name: "Google: Gemma 4 31B",
		contextLength: 0,
	},
	{
		id: "thinkingmachines/inkling:free",
		name: "Thinking Machines: Inkling",
		contextLength: 0,
	},
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		name: "NVIDIA: Nemotron 3 Ultra",
		contextLength: 0,
	},
] as const;

export const DEFAULT_OPENROUTER_MODEL = CURATED_ASK_MODELS[0].id;

export const OPENROUTER_FREE_ROUTER = "openrouter/free";

export const OPENROUTER_SITE_URL = "https://www.wordsofthebuddha.org";
export const OPENROUTER_SITE_NAME = "Words of the Buddha";

const OPENROUTER_API = "https://openrouter.ai/api/v1";

export interface OpenRouterChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface OpenRouterChatResult {
	content: string;
	reasoning: string;
	model: string;
}

function env(name: string): string | undefined {
	const meta = (
		import.meta as ImportMeta & { env?: Record<string, string | undefined> }
	).env;
	const candidates = [
		typeof process !== "undefined" ? process.env[name] : undefined,
		meta?.[name],
	];
	for (const value of candidates) {
		if (value && value.trim()) return value.trim();
	}
	return undefined;
}

export function getOpenRouterApiKey(): string | undefined {
	return env("OPENROUTER_API_KEY");
}

export function isCuratedAskModelId(id: string): boolean {
	return CURATED_ASK_MODELS.some((model) => model.id === id);
}

export function curatedAskModelLabel(id: string): string {
	return (
		CURATED_ASK_MODELS.find((model) => model.id === id)?.name || id
	);
}

export function isAllowedFreeModelId(id: string): boolean {
	const trimmed = id.trim();
	if (!trimmed || trimmed.length > 200 || /\s/.test(trimmed)) return false;
	if (trimmed === OPENROUTER_FREE_ROUTER) return true;
	return trimmed.endsWith(":free");
}

export function getConfiguredOpenRouterModel(): string {
	const fromEnv = env("OPENROUTER_MODEL");
	if (fromEnv && isAllowedFreeModelId(fromEnv)) return fromEnv;
	return DEFAULT_OPENROUTER_MODEL;
}

/**
 * Model preselected in the picker. The curated list’s first entry (GLM 5.2) is
 * the product default. OPENROUTER_MODEL is only used when the picker is hidden
 * (stale process env often overrides `.env` and would otherwise win here).
 */
export function getAskPickerDefaultModel(): string {
	if (!shouldShowAiModelPicker()) return getConfiguredOpenRouterModel();
	return DEFAULT_OPENROUTER_MODEL;
}

export function resolveRequestedOpenRouterModel(
	requested: string | undefined | null,
): string {
	const trimmed = requested?.trim() || "";
	if (trimmed && isCuratedAskModelId(trimmed)) return trimmed;
	// When the picker is hidden, honor a free OPENROUTER_MODEL override.
	if (trimmed && isAllowedFreeModelId(trimmed) && !shouldShowAiModelPicker()) {
		return trimmed;
	}
	const configured = getConfiguredOpenRouterModel();
	if (isCuratedAskModelId(configured) || !shouldShowAiModelPicker()) {
		return configured;
	}
	return DEFAULT_OPENROUTER_MODEL;
}

/**
 * Show the free-model picker. Set PUBLIC_AI_SHOW_MODEL_PICKER=0 (or false)
 * to hide it everywhere, including `astro dev`. Set =1 to force it on.
 */
export function shouldShowAiModelPicker(): boolean {
	const flag = (env("PUBLIC_AI_SHOW_MODEL_PICKER") || "").toLowerCase();
	if (flag === "0" || flag === "false") return false;
	if (flag === "1" || flag === "true") return true;
	return true;
}

interface OpenRouterCatalogModel {
	id?: string;
	name?: string;
	context_length?: number;
	pricing?: {
		prompt?: string | number;
		completion?: string | number;
	};
}

export function isFreeCatalogModel(model: OpenRouterCatalogModel): boolean {
	if (!model.id) return false;
	if (isAllowedFreeModelId(model.id)) return true;
	const prompt = Number(model.pricing?.prompt);
	const completion = Number(model.pricing?.completion);
	return prompt === 0 && completion === 0;
}

/** Prefer live catalog metadata, but always only the curated shortlist. */
export function selectFreeOpenRouterModels(
	catalog: readonly OpenRouterCatalogModel[],
): OpenRouterFreeModel[] {
	const byId = new Map<string, OpenRouterCatalogModel>();
	for (const model of catalog) {
		if (model.id) byId.set(model.id, model);
	}
	const preferred = getAskPickerDefaultModel();
	const out = CURATED_ASK_MODELS.map((curated) => {
		const live = byId.get(curated.id);
		return {
			id: curated.id,
			name: curated.name,
			contextLength: Number(live?.context_length) || curated.contextLength,
		};
	});
	out.sort((a, b) => {
		if (a.id === preferred) return -1;
		if (b.id === preferred) return 1;
		return (
			CURATED_ASK_MODELS.findIndex((model) => model.id === a.id) -
			CURATED_ASK_MODELS.findIndex((model) => model.id === b.id)
		);
	});
	return out;
}

let freeModelsCache: { at: number; models: OpenRouterFreeModel[] } | null =
	null;
const FREE_MODELS_TTL_MS = 10 * 60 * 1000;

export async function fetchFreeOpenRouterModels(): Promise<
	OpenRouterFreeModel[]
> {
	const now = Date.now();
	if (freeModelsCache && now - freeModelsCache.at < FREE_MODELS_TTL_MS) {
		return freeModelsCache.models;
	}
	const key = getOpenRouterApiKey();
	const headers: Record<string, string> = {
		Accept: "application/json",
	};
	if (key) headers.Authorization = `Bearer ${key}`;
	try {
		const response = await fetch(`${OPENROUTER_API}/models`, { headers });
		if (!response.ok) {
			throw new Error(`OpenRouter models failed: ${response.status}`);
		}
		const payload = (await response.json()) as {
			data?: OpenRouterCatalogModel[];
		};
		const models = selectFreeOpenRouterModels(payload.data || []);
		freeModelsCache = { at: now, models };
		return models;
	} catch {
		const models = selectFreeOpenRouterModels([]);
		freeModelsCache = { at: now, models };
		return models;
	}
}

export function openRouterAuthHeaders(): Record<string, string> {
	const key = getOpenRouterApiKey();
	if (!key) {
		throw new Error("OPENROUTER_API_KEY is not set");
	}
	return {
		Authorization: `Bearer ${key}`,
		"HTTP-Referer": env("OPENROUTER_HTTP_REFERER") || OPENROUTER_SITE_URL,
		"X-Title": env("OPENROUTER_SITE_NAME") || OPENROUTER_SITE_NAME,
		"Content-Type": "application/json",
	};
}

function messageText(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") return part;
				if (part && typeof part === "object" && "text" in part) {
					return String((part as { text?: unknown }).text || "");
				}
				return "";
			})
			.join("");
	}
	return "";
}

export async function openRouterChat(options: {
	model: string;
	messages: OpenRouterChatMessage[];
	maxTokens?: number;
	signal?: AbortSignal;
}): Promise<OpenRouterChatResult> {
	const model = resolveRequestedOpenRouterModel(options.model);
	const response = await fetch(`${OPENROUTER_API}/chat/completions`, {
		method: "POST",
		headers: openRouterAuthHeaders(),
		body: JSON.stringify({
			model,
			messages: options.messages,
			max_tokens: options.maxTokens ?? 1600,
			temperature: 0.2,
			reasoning: { effort: "low", exclude: false },
		}),
		signal: options.signal,
	});
	if (!response.ok) {
		let message = `OpenRouter request failed (${response.status})`;
		try {
			const payload = (await response.json()) as {
				error?: { message?: string };
			};
			if (payload.error?.message) message = payload.error.message;
		} catch {
			/* keep status message */
		}
		const error = new Error(message) as Error & { status?: number };
		error.status = response.status;
		throw error;
	}
	const payload = (await response.json()) as {
		model?: string;
		choices?: Array<{
			message?: {
				content?: unknown;
				reasoning?: unknown;
				reasoning_content?: unknown;
			};
		}>;
	};
	const message = payload.choices?.[0]?.message;
	const content = messageText(message?.content);
	const reasoning = messageText(
		message?.reasoning ?? message?.reasoning_content,
	);
	return {
		content: content.includes("{")
			? content
			: [content, reasoning].filter(Boolean).join("\n"),
		reasoning,
		model: payload.model || model,
	};
}

export interface OpenRouterStreamChunk {
	reasoning?: string;
	content?: string;
	model?: string;
}

export async function* openRouterChatStream(options: {
	model: string;
	messages: OpenRouterChatMessage[];
	maxTokens?: number;
	signal?: AbortSignal;
}): AsyncGenerator<OpenRouterStreamChunk> {
	const model = resolveRequestedOpenRouterModel(options.model);
	const response = await fetch(`${OPENROUTER_API}/chat/completions`, {
		method: "POST",
		headers: openRouterAuthHeaders(),
		signal: options.signal,
		body: JSON.stringify({
			model,
			messages: options.messages,
			max_tokens: options.maxTokens ?? 1600,
			temperature: 0.2,
			stream: true,
			reasoning: { effort: "low", exclude: false },
		}),
	});
	if (!response.ok) {
		let message = `OpenRouter request failed (${response.status})`;
		try {
			const payload = (await response.json()) as {
				error?: { message?: string };
			};
			if (payload.error?.message) message = payload.error.message;
		} catch {
			/* keep status message */
		}
		const error = new Error(message) as Error & { status?: number };
		error.status = response.status;
		throw error;
	}
	if (!response.body) {
		throw new Error("OpenRouter stream had no body");
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const data = trimmed.slice(5).trim();
			if (!data || data === "[DONE]") continue;
			let payload: {
				model?: string;
				choices?: Array<{
					delta?: { content?: unknown; reasoning?: unknown };
				}>;
			};
			try {
				payload = JSON.parse(data) as typeof payload;
			} catch {
				continue;
			}
			const delta = payload.choices?.[0]?.delta;
			const reasoning = messageText(delta?.reasoning);
			const content = messageText(delta?.content);
			if (reasoning) yield { reasoning };
			if (content) yield { content };
			if (payload.model) yield { model: payload.model };
		}
	}
	yield { model };
}
