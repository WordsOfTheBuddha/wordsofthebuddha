/**
 * OpenRouter server helpers. The API key must never reach the browser.
 */

export interface OpenRouterFreeModel {
	id: string;
	name: string;
	contextLength: number;
}

/**
 * Curated free models offered in the Ask picker (limited top choices).
 * Order is display preference — stronger models first. Lightning is pickable
 * but is not an automatic planner fallback.
 */
export const CURATED_ASK_MODELS: readonly OpenRouterFreeModel[] = [
	{
		id: "nvidia/nemotron-3-ultra-550b-a55b:free",
		name: "NVIDIA: Nemotron 3 Ultra",
		contextLength: 0,
	},
	{
		id: "nvidia/nemotron-3.5-lightning:free",
		name: "NVIDIA: Nemotron 3.5 Lightning",
		contextLength: 0,
	},
] as const;

/**
 * Paid OpenRouter planner fallback only — never shown in the free picker.
 * Used after Ultra (not Lightning).
 */
export const ASK_PLANNER_PAID_FALLBACK_MODEL = "z-ai/glm-5.3-flash";

const ASK_INTERNAL_MODEL_LABELS: Readonly<Record<string, string>> = {
	[ASK_PLANNER_PAID_FALLBACK_MODEL]: "Z.ai: GLM 5.3 Flash",
};

export function isAskPlannerPaidFallbackModelId(id: string): boolean {
	return id.trim() === ASK_PLANNER_PAID_FALLBACK_MODEL;
}

/**
 * OpenRouter planner fallback after the requested/default model fails.
 * Ultra, then paid GLM. Lightning stays pickable but is not an automatic
 * fallback.
 */
export const ASK_PLANNER_FALLBACK_ORDER: readonly string[] = [
	CURATED_ASK_MODELS[0].id,
	ASK_PLANNER_PAID_FALLBACK_MODEL,
];

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

/** OpenRouter `reasoning.effort` values we use for Ask. */
export type OpenRouterReasoningEffort = "low" | "medium" | "high";

/** Default for non-planner chat (e.g. OpenRouter rerank fallback). */
export const DEFAULT_OPENROUTER_REASONING_EFFORT: OpenRouterReasoningEffort =
	"medium";
/** Planner rewrite — more thinking before the JSON chips. */
export const ASK_PLANNER_REASONING_EFFORT: OpenRouterReasoningEffort = "medium";
/** GLM 5.3 Flash accepts low / high / max, not medium. */
export const ASK_PLANNER_PAID_REASONING_EFFORT: OpenRouterReasoningEffort =
	"high";
/** Planner needs room for medium reasoning + the JSON object. */
export const ASK_PLANNER_MAX_TOKENS = 4096;
/**
 * Writer only needs short paragraphs from excerpts. A 4096 budget with
 * medium/high effort spends the whole window on thinking and never emits JSON.
 */
export const ASK_WRITER_MAX_TOKENS = 2048;
/** Cap hidden thinking so the model still has room for the JSON briefing. */
export const ASK_WRITER_REASONING_MAX_TOKENS = 1024;
/** Write from excerpts — do not reuse the planner’s high-effort setting. */
export const ASK_WRITER_REASONING_EFFORT: OpenRouterReasoningEffort = "low";

/**
 * Paid GLM often swallows the reasoning channel under `json_object`, and
 * rejects `reasoning.effort: medium`. Free Nemotron planners keep JSON mode
 * and medium effort.
 */
export function askPlannerChatOptions(model: string): {
	jsonMode: boolean;
	reasoningEffort: OpenRouterReasoningEffort;
} {
	if (isAskPlannerPaidFallbackModelId(model)) {
		return {
			jsonMode: false,
			reasoningEffort: ASK_PLANNER_PAID_REASONING_EFFORT,
		};
	}
	return {
		jsonMode: true,
		reasoningEffort: ASK_PLANNER_REASONING_EFFORT,
	};
}

/**
 * Thinking writer: low effort so it finishes the JSON briefing. GLM still
 * skips `json_object` (it swallows the reasoning channel under that mode).
 */
export function askWriterChatOptions(model: string): {
	jsonMode: boolean;
	reasoningEffort: OpenRouterReasoningEffort;
} {
	return {
		jsonMode: !isAskPlannerPaidFallbackModelId(model),
		reasoningEffort: ASK_WRITER_REASONING_EFFORT,
	};
}

/** OpenRouter `reasoning` object for chat / stream requests. */
export function openRouterReasoningBody(
	effort: OpenRouterReasoningEffort = DEFAULT_OPENROUTER_REASONING_EFFORT,
	maxTokens?: number,
): {
	effort: OpenRouterReasoningEffort;
	exclude: false;
	max_tokens?: number;
} {
	return {
		effort,
		exclude: false,
		...(typeof maxTokens === "number" && maxTokens > 0
			? { max_tokens: maxTokens }
			: {}),
	};
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

/** Picker labels plus internal fallbacks (paid GLM) that are not curated. */
export function openRouterModelLabel(id: string): string {
	return ASK_INTERNAL_MODEL_LABELS[id.trim()] || curatedAskModelLabel(id);
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
 * Model preselected in the picker. The curated list’s first entry (Nemotron 3
 * Ultra) is the product default. OPENROUTER_MODEL is only used when the picker
 * is hidden (stale process env often overrides `.env` and would otherwise win).
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
 * Model id sent to OpenRouter. Client requests still go through
 * `resolveRequestedOpenRouterModel` (free/curated only). Internal planner
 * fallback may use the paid GLM id.
 */
export function resolveOpenRouterChatModel(model: string): string {
	const trimmed = model.trim();
	if (isAskPlannerPaidFallbackModelId(trimmed)) return trimmed;
	return resolveRequestedOpenRouterModel(trimmed);
}

/**
 * Hidden by default. Set PUBLIC_AI_SHOW_MODEL_PICKER=1 (or true) in `.env`
 * to show the curated free-model picker. Set =0 / false to keep it hidden.
 */
export function shouldShowAiModelPicker(): boolean {
	const flag = (env("PUBLIC_AI_SHOW_MODEL_PICKER") || "").toLowerCase();
	if (flag === "0" || flag === "false") return false;
	if (flag === "1" || flag === "true") return true;
	return false;
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
	reasoningEffort?: OpenRouterReasoningEffort;
	/** Provider-specific cap on hidden thinking tokens. */
	reasoningMaxTokens?: number;
	/** When true, ask the provider for JSON-only content (ignored if unsupported). */
	jsonMode?: boolean;
	signal?: AbortSignal;
}): Promise<OpenRouterChatResult> {
	const model = resolveOpenRouterChatModel(options.model);
	const response = await fetch(`${OPENROUTER_API}/chat/completions`, {
		method: "POST",
		headers: openRouterAuthHeaders(),
		body: JSON.stringify({
			model,
			messages: options.messages,
			max_tokens: options.maxTokens ?? 1600,
			temperature: 0.2,
			reasoning: openRouterReasoningBody(
				options.reasoningEffort ?? DEFAULT_OPENROUTER_REASONING_EFFORT,
				options.reasoningMaxTokens,
			),
			...(options.jsonMode
				? { response_format: { type: "json_object" } }
				: {}),
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

function reasoningDetailText(item: unknown): string {
	if (!item || typeof item !== "object") return "";
	const detail = item as Record<string, unknown>;
	const type = typeof detail.type === "string" ? detail.type : "";
	if (/encrypted|redacted/i.test(type)) return "";
	return (
		messageText(detail.text) ||
		messageText(detail.summary) ||
		messageText(detail.thinking) ||
		(typeof detail.content === "string" ? detail.content : "")
	);
}

/** Thinking parts inside `delta.content[]` (Claude / Z.AI-style blocks). */
function thinkingPartsText(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (!part || typeof part !== "object") return "";
			const rec = part as Record<string, unknown>;
			const type = typeof rec.type === "string" ? rec.type : "";
			if (!type || !/think|reason/i.test(type)) return "";
			if (/encrypted|redacted/i.test(type)) return "";
			return messageText(rec.text) || messageText(rec.thinking) || "";
		})
		.join("");
}

/**
 * Visible assistant text from a stream delta (skips thinking parts).
 */
export function streamDeltaContent(delta: unknown): string {
	if (!delta || typeof delta !== "object") return "";
	const record = delta as Record<string, unknown>;
	const content = record.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (typeof part === "string") return part;
			if (!part || typeof part !== "object") return "";
			const rec = part as Record<string, unknown>;
			const type = typeof rec.type === "string" ? rec.type : "";
			if (type && /think|reason/i.test(type)) return "";
			if ("text" in rec) return String(rec.text || "");
			return "";
		})
		.join("");
}

/**
 * Reasoning text from a stream delta. OpenRouter normalizes to `reasoning`,
 * but some providers only send `reasoning_content`, `reasoning_details[]`,
 * a `thinking` field, or thinking blocks inside `content[]`.
 * Never combine the string fields — they carry the same text.
 */
export function streamDeltaReasoning(delta: unknown): string {
	if (!delta || typeof delta !== "object") return "";
	const record = delta as Record<string, unknown>;
	const direct = messageText(record.reasoning);
	if (direct) return direct;
	const legacy = messageText(record.reasoning_content);
	if (legacy) return legacy;
	if (Array.isArray(record.reasoning_details)) {
		const fromDetails = record.reasoning_details
			.map(reasoningDetailText)
			.join("");
		if (fromDetails) return fromDetails;
	}
	return thinkingPartsText(record.content);
}

/**
 * Reasoning + content from a stream choice. Prefer `delta`; some providers
 * only put the full text on `message` in the last chunk.
 */
export function openRouterChoiceDelta(choice: unknown): {
	reasoning: string;
	content: string;
} {
	if (!choice || typeof choice !== "object") {
		return { reasoning: "", content: "" };
	}
	const rec = choice as { delta?: unknown; message?: unknown };
	const reasoning =
		streamDeltaReasoning(rec.delta) ||
		(rec.delta ? "" : streamDeltaReasoning(rec.message));
	const content =
		streamDeltaContent(rec.delta) ||
		(rec.delta ? "" : streamDeltaContent(rec.message));
	return { reasoning, content };
}

/**
 * Split `<think>` incrementally so later slices stay stable (no trim).
 */
export function splitThinkTagsRaw(content: string): {
	content: string;
	reasoning: string;
} {
	if (!/<think\b/i.test(content)) return { content, reasoning: "" };
	const parts: string[] = [];
	const stripped = content.replace(
		/<think\b[^>]*>([\s\S]*?)(?:<\/think>|$)/gi,
		(_m, inner: string) => {
			parts.push(inner);
			return "";
		},
	);
	return { content: stripped, reasoning: parts.filter(Boolean).join("\n\n") };
}

export function createContentThinkSplitter(): (delta: string) => {
	reasoning: string;
	content: string;
} {
	let raw = "";
	let emittedReasoning = "";
	let emittedContent = "";
	return (delta: string) => {
		if (!delta) return { reasoning: "", content: "" };
		raw += delta;
		const split = splitThinkTagsRaw(raw);
		const reasoning = split.reasoning.startsWith(emittedReasoning)
			? split.reasoning.slice(emittedReasoning.length)
			: "";
		const content = split.content.startsWith(emittedContent)
			? split.content.slice(emittedContent.length)
			: "";
		emittedReasoning = split.reasoning;
		emittedContent = split.content;
		return { reasoning, content };
	};
}

/**
 * Some models ignore the reasoning field and think inside `<think>` tags in
 * the content stream instead. Split those out so the thinking is still shown.
 */
export function splitThinkTags(content: string): { content: string; reasoning: string } {
	const split = splitThinkTagsRaw(content);
	return { content: split.content.trim(), reasoning: split.reasoning.trim() };
}

export async function* openRouterChatStream(options: {
	model: string;
	messages: OpenRouterChatMessage[];
	maxTokens?: number;
	reasoningEffort?: OpenRouterReasoningEffort;
	/** Provider-specific cap on hidden thinking tokens. */
	reasoningMaxTokens?: number;
	/** When true, ask the provider for JSON-only content (ignored if unsupported). */
	jsonMode?: boolean;
	signal?: AbortSignal;
}): AsyncGenerator<OpenRouterStreamChunk> {
	const model = resolveOpenRouterChatModel(options.model);
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
			reasoning: openRouterReasoningBody(
				options.reasoningEffort ?? DEFAULT_OPENROUTER_REASONING_EFFORT,
				options.reasoningMaxTokens,
			),
			...(options.jsonMode
				? { response_format: { type: "json_object" } }
				: {}),
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
	const takeThink = createContentThinkSplitter();
	let buffer = "";
	let emittedReasoning = false;
	let emittedContent = false;
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
					message?: { content?: unknown; reasoning?: unknown };
				}>;
			};
			try {
				payload = JSON.parse(data) as typeof payload;
			} catch {
				continue;
			}
			const choice = payload.choices?.[0];
			const fromDelta = openRouterChoiceDelta({ delta: choice?.delta });
			let reasoning = fromDelta.reasoning;
			let content = fromDelta.content;
			// Some providers only put the full text on the last `message`.
			// Skip that when deltas already streamed — the message is a repeat.
			if (!reasoning && !emittedReasoning) {
				reasoning = streamDeltaReasoning(choice?.message);
			}
			if (!content && !emittedContent) {
				content = streamDeltaContent(choice?.message);
			}
			if (reasoning) {
				emittedReasoning = true;
				yield { reasoning };
			}
			if (content) {
				const split = takeThink(content);
				if (split.reasoning) {
					emittedReasoning = true;
					yield { reasoning: split.reasoning };
				}
				if (split.content) {
					emittedContent = true;
					yield { content: split.content };
				}
			}
			if (payload.model) yield { model: payload.model };
		}
	}
	yield { model };
}
