/**
 * Gemini Developer API helpers (server only). Key must never reach the browser.
 *
 * Free-tier RPD varies by model and account (often ~1,000/day for Flash /
 * Flash-Lite). Check Google AI Studio for the live quota on your project.
 */

/**
 * Newer free-tier accounts reject many 2.5 Flash IDs.
 * Flash-Lite is the reliable high-RPD default for both rewrite fallback and rerank.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
export const DEFAULT_GEMINI_RERANK_MODEL = "gemini-3.5-flash-lite";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

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

export function getGeminiApiKey(): string | undefined {
	return env("GEMINI_API_KEY");
}

export function getConfiguredGeminiModel(): string {
	return env("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
}

export function getConfiguredGeminiRerankModel(): string {
	return env("GEMINI_RERANK_MODEL") || DEFAULT_GEMINI_RERANK_MODEL;
}

export function isGeminiConfigured(): boolean {
	return Boolean(getGeminiApiKey());
}

export interface GeminiChatMessage {
	role: "user" | "model";
	content: string;
}

export interface GeminiGenerateResult {
	content: string;
	model: string;
}

function extractText(payload: unknown): string {
	if (!payload || typeof payload !== "object") return "";
	const candidates = (payload as { candidates?: unknown }).candidates;
	if (!Array.isArray(candidates) || !candidates[0]) return "";
	const content = (candidates[0] as { content?: { parts?: unknown } }).content;
	const parts = content?.parts;
	if (!Array.isArray(parts)) return "";
	return parts
		.map((part) => {
			if (part && typeof part === "object" && "text" in part) {
				return String((part as { text?: unknown }).text || "");
			}
			return "";
		})
		.join("");
}

export async function geminiGenerate(options: {
	model?: string;
	system?: string;
	messages: readonly GeminiChatMessage[];
	maxOutputTokens?: number;
	temperature?: number;
	signal?: AbortSignal;
}): Promise<GeminiGenerateResult> {
	const key = getGeminiApiKey();
	if (!key) {
		const error = new Error("GEMINI_API_KEY is not set") as Error & {
			status?: number;
		};
		error.status = 503;
		throw error;
	}
	const model = (options.model || getConfiguredGeminiModel()).trim();
	const contents = options.messages.map((message) => ({
		role: message.role === "model" ? "model" : "user",
		parts: [{ text: message.content }],
	}));
	const body: Record<string, unknown> = {
		contents,
		generationConfig: {
			temperature: options.temperature ?? 0.2,
			maxOutputTokens: options.maxOutputTokens ?? 2048,
			// Prefer JSON when the model supports it; still parse fenced/raw text.
			responseMimeType: "application/json",
		},
	};
	if (options.system?.trim()) {
		body.systemInstruction = {
			parts: [{ text: options.system.trim() }],
		};
	}

	const url = `${GEMINI_API}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		signal: options.signal,
		body: JSON.stringify(body),
	});
	const payload = (await response.json()) as {
		error?: { message?: string; code?: number; status?: string };
	};
	if (!response.ok) {
		const message =
			payload.error?.message || `Gemini request failed (${response.status})`;
		const error = new Error(message) as Error & { status?: number };
		error.status = response.status;
		throw error;
	}
	const content = extractText(payload);
	if (!content.trim()) {
		const error = new Error(
			`Gemini returned an empty response (${model})`,
		) as Error & { status?: number };
		error.status = 502;
		throw error;
	}
	return {
		content,
		model,
	};
}

/** True when OpenRouter (or similar) failures should try Gemini rewrite. */
export function shouldFallbackRewriteToGemini(error: unknown): boolean {
	const status =
		typeof error === "object" &&
		error &&
		"status" in error &&
		typeof (error as { status?: unknown }).status === "number"
			? (error as { status: number }).status
			: 0;
	if (status === 429 || status === 502 || status === 503 || status === 408) {
		return true;
	}
	const message = error instanceof Error ? error.message : String(error || "");
	return /rate.?limit|timeout|temporar|unavailable|overloaded/i.test(message);
}
