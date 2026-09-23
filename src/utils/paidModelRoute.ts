/**
 * Pick a paid OpenRouter model and provider for one Ask, report, or revise
 * call. The provider catalog is cached per process for 10 minutes. The winner
 * is computed per request from that snapshot and the payload size.
 */

import { createTtlCache } from "./ttlCache";

export const PAID_ROUTE_GLM_MODEL = "z-ai/glm-5.3-flash";
export const DEEPSEEK_V4_1_FLASH_MODEL = "deepseek/deepseek-v4.1-flash";
export const GPT6_LUNA_PRO_MODEL = "openai/gpt-6-luna-pro";

export const PAID_ROUTE_MODELS = [
	PAID_ROUTE_GLM_MODEL,
	DEEPSEEK_V4_1_FLASH_MODEL,
	GPT6_LUNA_PRO_MODEL,
] as const;

export type PaidRouteKind = "ask" | "report" | "revise";

/** Expected completion tokens. Not the request max_tokens cap. */
export const PAID_ROUTE_EXPECTED_OUTPUT: Readonly<Record<PaidRouteKind, number>> =
	{
		ask: 1_000,
		report: 8_000,
		revise: 8_000,
	};

export const PAID_ROUTE_CATALOG_TTL_MS = 10 * 60 * 1000;
export const PAID_ROUTE_MIN_UPTIME = 99;
export const PAID_ROUTE_MIN_TPS = 10;
/** A faster host may win when it costs at most this multiple of the cheapest. */
export const PAID_ROUTE_COST_BAND = 1.2;
/** Within the cost band, speed wins only at this multiple of the cheapest host. */
export const PAID_ROUTE_THROUGHPUT_GAIN = 2;

const OPENROUTER_ENDPOINTS = "https://openrouter.ai/api/v1/models";
const CATALOG_KEY = "catalog";

export interface PaidRouteEndpoint {
	modelId: string;
	providerTag: string;
	promptPerToken: number;
	completionPerToken: number;
	/** Tokens per second. Missing throughput is stored as a non-positive number. */
	throughput: number;
	/** Last-day uptime percent. Null when the provider has no sample. */
	uptime1d: number | null;
	status: number;
}

export interface PaidRouteRequest {
	inputTokens: number;
	kind: PaidRouteKind;
}

export interface PaidRouteAttempt {
	model: string;
	provider?:
		| { sort: "price"; allow_fallbacks: true }
		| { only: string[]; allow_fallbacks: false };
	estimatedCost: number | null;
	throughput: number | null;
	pinned: boolean;
	inputTokens: number;
	kind: PaidRouteKind;
}

export function isPaidRouteModelId(id: string): boolean {
	const trimmed = id.trim();
	return (PAID_ROUTE_MODELS as readonly string[]).includes(trimmed);
}

/** GLM 5.3 Flash and DeepSeek V4.1 Flash reject `reasoning.effort: medium`. */
export function paidModelRejectsMediumReasoning(model: string): boolean {
	const trimmed = model.trim();
	return (
		trimmed === PAID_ROUTE_GLM_MODEL || trimmed === DEEPSEEK_V4_1_FLASH_MODEL
	);
}

export function estimatePaidRouteInputTokens(
	messages: readonly { content?: unknown }[],
): number {
	let chars = 0;
	for (const message of messages) chars += contentChars(message.content);
	return Math.max(1, Math.ceil(chars / 4));
}

export function paidRouteCost(
	endpoint: PaidRouteEndpoint,
	request: PaidRouteRequest,
): number {
	const output = PAID_ROUTE_EXPECTED_OUTPUT[request.kind];
	return (
		request.inputTokens * endpoint.promptPerToken +
		output * endpoint.completionPerToken
	);
}

export function isEligiblePaidRoute(endpoint: PaidRouteEndpoint): boolean {
	if (endpoint.uptime1d == null || endpoint.uptime1d <= PAID_ROUTE_MIN_UPTIME) {
		return false;
	}
	if (!(endpoint.throughput >= PAID_ROUTE_MIN_TPS)) return false;
	if (endpoint.status < 0) return false;
	if (!(endpoint.promptPerToken > 0) || !(endpoint.completionPerToken > 0)) {
		return false;
	}
	if (!endpoint.providerTag.trim() || !endpoint.modelId.trim()) return false;
	return true;
}

/**
 * Eligible hosts, best value first. The first is the pick. Later entries are
 * the same rule applied to whoever remains, for a single retry.
 */
export function rankPaidRoutes(
	endpoints: readonly PaidRouteEndpoint[],
	request: PaidRouteRequest,
): PaidRouteEndpoint[] {
	const pool = endpoints.filter(isEligiblePaidRoute);
	const ranked: PaidRouteEndpoint[] = [];
	const seen = new Set<string>();
	while (pool.length > ranked.length) {
		const remaining = pool.filter((endpoint) => !seen.has(endpointKey(endpoint)));
		if (remaining.length === 0) break;
		const winner = pickPaidRoute(remaining, request);
		ranked.push(winner);
		seen.add(endpointKey(winner));
	}
	return ranked;
}

/**
 * Up to two pinned hosts, then GLM price-sort so the call still completes
 * when the pins fail. An empty or missing catalog is GLM price-sort only.
 */
export function paidRouteAttempts(
	endpoints: readonly PaidRouteEndpoint[] | null,
	request: PaidRouteRequest,
): PaidRouteAttempt[] {
	const ranked = endpoints ? rankPaidRoutes(endpoints, request) : [];
	const pins = ranked.slice(0, 2).map((endpoint) => ({
		model: endpoint.modelId,
		provider: {
			only: [endpoint.providerTag],
			allow_fallbacks: false as const,
		},
		estimatedCost: paidRouteCost(endpoint, request),
		throughput: endpoint.throughput,
		pinned: true,
		inputTokens: request.inputTokens,
		kind: request.kind,
	}));
	const glm: PaidRouteAttempt = {
		model: PAID_ROUTE_GLM_MODEL,
		provider: { sort: "price", allow_fallbacks: true },
		estimatedCost: null,
		throughput: null,
		pinned: false,
		inputTokens: request.inputTokens,
		kind: request.kind,
	};
	if (pins.length === 0) return [glm];
	return [...pins, glm];
}

export function formatPaidRouteLine(attempt: PaidRouteAttempt): string {
	const provider =
		attempt.provider && "only" in attempt.provider
			? attempt.provider.only[0]
			: "price-sort";
	const est =
		attempt.estimatedCost == null ? "-" : attempt.estimatedCost.toFixed(6);
	const tps =
		attempt.throughput == null ? "-" : String(Math.round(attempt.throughput));
	return `[openrouter] route kind=${attempt.kind} in=${attempt.inputTokens} model=${attempt.model} provider=${provider} est=${est} tps=${tps}`;
}

const catalogCache = createTtlCache<PaidRouteEndpoint[]>({
	ttlMs: PAID_ROUTE_CATALOG_TTL_MS,
});
let catalogInflight: Promise<PaidRouteEndpoint[] | null> | null = null;

export function resetPaidRouteCatalogCacheForTests(): void {
	catalogCache.clear();
	catalogInflight = null;
}

/**
 * Live prices, uptime, and throughput for the three paid models.
 * Returns null when every model fetch fails, and does not cache that miss.
 */
export async function loadPaidRouteCatalog(options?: {
	fetchImpl?: typeof fetch;
	headers?: Record<string, string>;
}): Promise<PaidRouteEndpoint[] | null> {
	const hit = catalogCache.get(CATALOG_KEY);
	if (hit) return hit;
	if (!catalogInflight) {
		const fetchImpl = options?.fetchImpl ?? fetch;
		const headers = options?.headers;
		catalogInflight = fetchPaidRouteCatalog(fetchImpl, headers)
			.then((rows) => {
				if (rows) catalogCache.set(CATALOG_KEY, rows);
				return rows;
			})
			.finally(() => {
				catalogInflight = null;
			});
	}
	return catalogInflight;
}

async function fetchPaidRouteCatalog(
	fetchImpl: typeof fetch,
	headers: Record<string, string> | undefined,
): Promise<PaidRouteEndpoint[] | null> {
	const results = await Promise.all(
		PAID_ROUTE_MODELS.map((modelId) =>
			fetchModelEndpoints(fetchImpl, headers, modelId).catch(() => null),
		),
	);
	if (results.every((rows) => rows == null)) return null;
	return dedupeEndpoints(results.flatMap((rows) => rows ?? []));
}

async function fetchModelEndpoints(
	fetchImpl: typeof fetch,
	headers: Record<string, string> | undefined,
	modelId: string,
): Promise<PaidRouteEndpoint[]> {
	const slash = modelId.indexOf("/");
	const author = encodeURIComponent(modelId.slice(0, slash));
	const slug = encodeURIComponent(modelId.slice(slash + 1));
	const response = await fetchImpl(
		`${OPENROUTER_ENDPOINTS}/${author}/${slug}/endpoints`,
		headers ? { headers } : undefined,
	);
	if (!response.ok) {
		throw new Error(`OpenRouter endpoints failed (${response.status})`);
	}
	const payload = (await response.json()) as unknown;
	return parseEndpointPayload(modelId, payload);
}

export function parseEndpointPayload(
	modelId: string,
	payload: unknown,
): PaidRouteEndpoint[] {
	const list = endpointList(payload);
	const parsed: PaidRouteEndpoint[] = [];
	for (const item of list) {
		const endpoint = parseEndpoint(modelId, item);
		if (endpoint) parsed.push(endpoint);
	}
	return parsed;
}

function pickPaidRoute(
	endpoints: readonly PaidRouteEndpoint[],
	request: PaidRouteRequest,
): PaidRouteEndpoint {
	const scored = endpoints.map((endpoint) => ({
		endpoint,
		cost: paidRouteCost(endpoint, request),
	}));
	scored.sort(
		(a, b) =>
			a.cost - b.cost ||
			b.endpoint.throughput - a.endpoint.throughput ||
			a.endpoint.modelId.localeCompare(b.endpoint.modelId) ||
			a.endpoint.providerTag.localeCompare(b.endpoint.providerTag),
	);
	const cheapest = scored[0];
	const band = scored.filter(
		(row) => row.cost <= cheapest.cost * PAID_ROUTE_COST_BAND,
	);
	const faster = band.filter(
		(row) =>
			row.endpoint.throughput >=
			cheapest.endpoint.throughput * PAID_ROUTE_THROUGHPUT_GAIN,
	);
	if (faster.length === 0) return cheapest.endpoint;
	faster.sort(
		(a, b) =>
			b.endpoint.throughput - a.endpoint.throughput ||
			a.cost - b.cost ||
			a.endpoint.providerTag.localeCompare(b.endpoint.providerTag),
	);
	return faster[0].endpoint;
}

function endpointKey(endpoint: PaidRouteEndpoint): string {
	return `${endpoint.modelId}\0${endpoint.providerTag}`;
}

function dedupeEndpoints(rows: PaidRouteEndpoint[]): PaidRouteEndpoint[] {
	const byKey = new Map<string, PaidRouteEndpoint>();
	for (const row of rows) {
		const key = endpointKey(row);
		const prev = byKey.get(key);
		if (
			!prev ||
			row.promptPerToken + row.completionPerToken <
				prev.promptPerToken + prev.completionPerToken
		) {
			byKey.set(key, row);
		}
	}
	return [...byKey.values()];
}

function endpointList(payload: unknown): unknown[] {
	if (!payload || typeof payload !== "object") return [];
	const record = payload as Record<string, unknown>;
	if (Array.isArray(record.endpoints)) return record.endpoints;
	const data = record.data;
	if (Array.isArray(data)) return data;
	if (data && typeof data === "object") {
		const nested = (data as Record<string, unknown>).endpoints;
		if (Array.isArray(nested)) return nested;
	}
	return [];
}

function parseEndpoint(
	modelId: string,
	raw: unknown,
): PaidRouteEndpoint | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const providerTag = typeof record.tag === "string" ? record.tag.trim() : "";
	if (!providerTag) return null;
	const pricing =
		record.pricing && typeof record.pricing === "object"
			? (record.pricing as Record<string, unknown>)
			: null;
	const promptPerToken = finiteNumber(pricing?.prompt);
	const completionPerToken = finiteNumber(pricing?.completion);
	if (promptPerToken == null || completionPerToken == null) return null;
	const throughputRecord =
		record.throughput_last_30m && typeof record.throughput_last_30m === "object"
			? (record.throughput_last_30m as Record<string, unknown>)
			: null;
	const throughput = finiteNumber(throughputRecord?.p50) ?? 0;
	const uptime1d = finiteNumber(record.uptime_last_1d);
	const statusRaw = finiteNumber(record.status);
	return {
		modelId,
		providerTag,
		promptPerToken,
		completionPerToken,
		throughput,
		uptime1d,
		status: statusRaw ?? 0,
	};
}

function finiteNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function contentChars(content: unknown): number {
	if (typeof content === "string") return content.length;
	if (!Array.isArray(content)) return 0;
	let chars = 0;
	for (const part of content) {
		if (typeof part === "string") {
			chars += part.length;
			continue;
		}
		if (part && typeof part === "object" && "text" in part) {
			const text = (part as { text?: unknown }).text;
			if (typeof text === "string") chars += text.length;
		}
	}
	return chars;
}
