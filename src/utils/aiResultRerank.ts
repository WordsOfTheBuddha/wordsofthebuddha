import {
	clipAiHistorySummary,
	extractJsonObject,
	type AiRewriteHistoryTurn,
} from "./aiQueryRewrite";
import { normalizeAskShareSlug } from "./aiAskShare";
import { normalizeAskSummaryProse } from "./linkifyAskSummary";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	geminiGenerate,
	getConfiguredGeminiRerankModel,
	isGeminiConfigured,
	shouldFallbackRerankToOpenRouter,
} from "./gemini";
import {
	getConfiguredOpenRouterModel,
	getOpenRouterApiKey,
	openRouterChat,
} from "./openrouter";
import { transformId } from "./transformId";

/** Match the search candidate pool — Gemini’s context can handle this easily. */
export const AI_RERANK_CANDIDATE_LIMIT = 500;
export const AI_RERANK_DEFAULT_LIMIT = 10;
/** Ceiling when the person asks to research / collect / cite more widely. */
export const AI_RERANK_MAX_LIMIT = 50;
/**
 * Hard clip for summary prose. Ordinary asks stay shorter in the prompt;
 * research / detailed asks may use more of this budget.
 */
export const AI_RERANK_SUMMARY_MAX = 4800;
/** Room for up to 50 slugs plus a multi-paragraph briefing. */
export const AI_RERANK_MAX_OUTPUT_TOKENS = 8192;
const RERANK_HISTORY_TURNS = 6;
const RERANK_HISTORY_SHOWN_SLUGS = AI_RERANK_MAX_LIMIT;
/**
 * Top-of-pool candidates also get their matched content snippet. Descriptions
 * alone are thin for writing a briefing; snippets are query-relevant passages.
 */
export const AI_RERANK_SNIPPET_CANDIDATES = 150;
const RERANK_SNIPPET_CHARS = 170;
/** Tail of the planning model’s reasoning forwarded to the rescorer. */
export const AI_RERANK_PLANNING_NOTES_MAX = 1200;

/**
 * Default ~10; raise the ceiling to 50 when they ask to research, survey,
 * cite more, or otherwise want broader coverage. The model still chooses
 * how many of that ceiling to fill.
 */
const EXPANSIVE_RESULT_RE =
	/\b(exhaustiv\w*|comprehensiv\w*|thorough\w*|in detail|detailed|in.?depth|as many as possible|all (relevant |the )?(discourses|suttas|citations)|every (relevant )?(discourse|sutta)|complete (list|survey|treatment)|survey of|list all|show (me )?more|more (discourses|suttas|citations|references|examples)|more than ten|wide (net|range)|full (range|treatment|survey)|broad(er)? (set|survey|overview|coverage)|research\b|citations?\b|collect (all|many)|compile|as many (as you can|discourses|suttas|citations)|lots of (discourses|suttas)|many (discourses|suttas|citations)|everything (on|about)|extensive)\b/i;

const EXPLICIT_COUNT_RE =
	/\b(?:top |at least )?(?:1[5-9]|[2-9]\d|thirty|forty|fifty)\+?\s+(?:relevant )?(?:discourses|suttas|citations|references)\b/i;

export function isExpansiveAskQuestion(question: string): boolean {
	const text = question.replace(/\s+/g, " ").trim();
	if (!text) return false;
	return EXPANSIVE_RESULT_RE.test(text) || EXPLICIT_COUNT_RE.test(text);
}

export function clampAskResultLimit(value: number): number {
	if (!Number.isFinite(value)) return AI_RERANK_DEFAULT_LIMIT;
	return Math.min(
		AI_RERANK_MAX_LIMIT,
		Math.max(1, Math.floor(value)),
	);
}

export function resolveAskResultLimit(question: string): number {
	const text = question.replace(/\s+/g, " ").trim();
	if (!text) return AI_RERANK_DEFAULT_LIMIT;
	return isExpansiveAskQuestion(text)
		? AI_RERANK_MAX_LIMIT
		: AI_RERANK_DEFAULT_LIMIT;
}

const RERANK_SYSTEM = `You re-rank Pāli discourse search candidates for Words of the Buddha.

You receive a person's question, a result-count ceiling, optional guidance from the planning model that wrote the searches, optional earlier turns from the same Ask conversation, optional fallback search terms that were also tried, and a list of candidate discourses (id, title, description, and for the top of the pool a matched passage). Return JSON only:
{"slugs":["mn10","sn47.19"],"count":2,"summary":"A real briefing that answers the question from the selected discourses. Use blank lines between short paragraphs when the treatment needs more than one.","shareSlug":"mindfulness-of-the-body","usefulFallbackQueries":["broader term"]}

Rules:
- Order slugs best-first for answering the person's question (technique / practical application when they asked for that).
- Only use slugs from the candidate list. Never invent IDs.
- The Target result count is a ceiling, not a quota. You choose how many slugs to return. Prefer quality over padding: drop weak, tangential, or near-duplicate candidates. Ordinary questions: about 8–12 strong matches is typical. When the ceiling is higher (up to 50) because they asked to research, survey, cite more, or cover a topic exhaustively, return as many distinct strong matches as the question warrants — still never pad.
- Prefer native translations over reference-only when both cover the same teaching.
- Candidates are listed in library-search order (best fused rank first). That order is a hint, not a verdict — read the descriptions and passages.
- When "Guidance from the planning step" is present, follow it for what to prioritize, which facets to represent, and how to frame the answer. It comes from a stronger model that read the question first. Planning notes (if present) are its raw thinking — use them for intent, ignore any JSON drafting.
- When Earlier in this Ask is present, treat this as one conversation: resolve pronouns and references (“that”, “the second one”, “those discourses”, “more like this”) against prior questions, shown IDs, and clipped prior summaries. Rank and write the summary as a continuation, not a brand-new isolated Ask — unless the new question clearly changes topic.
- summary: this is the reader's answer, written from the selected discourses — not a caption. Plain prose; blank lines between short paragraphs when you need more than one. Ordinary questions: a real briefing, typically two short paragraphs (about 5–10 sentences). When they asked for detail, research, a survey, many citations, or exhaustive coverage: write a fuller treatment in several short paragraphs (as much as needed, roughly 12–25 sentences) covering the main facets present in the selected set. Mention selected discourse IDs in ordinary prose (e.g. MN 10, SN 47.19); the UI can link those IDs. Prefer clarity over padding. Do not invent teachings, quote long passages, or use markdown.
- When the question names something mainly outside these early discourses (commentaries, later Abhidhamma layers, other Buddhist schools, popular terms not taught here): say so clearly, then point to the closest early-discourse parallels in the selected set and what they actually cover. Use the extra length when needed for that framing.
- Hard / controversial / “test” questions (killing, war, sexuality, undeclared points, harsh ethics, political or social provocations still aimed at the early discourses): do not refuse, moralize, or write a safety disclaimer. Answer the way the selected discourses do — report what the Buddha said, what he did not declare, and any characteristic reframes (e.g. killing anger rather than beings; the four undeclared positions). Stay factual and measured; do not sensationalize; let the discourses carry the answer.
- Never give crisis counseling, medical/legal advice, or spiritualize personal distress. If the rewrite layer marked a true personal crisis off-topic, keep summary empty.
- shareSlug: optional short public URL slug for the question theme (lowercase kebab-case, about 12–48 characters), e.g. "four-foundations-of-mindfulness".
- usefulFallbackQueries: subset of the provided fallback search terms that actually helped surface the selected discourses. Use exact strings from the fallback list. Return [] when fallbacks added nothing useful (or none were provided).`;

export interface AiRerankCandidate {
	slug: string;
	title: string;
	description: string;
	contentSnippet?: string | null;
	referenceOnly?: boolean;
}

export interface AiRerankPromptOptions {
	fallbackQueries?: readonly string[];
	history?: readonly AiRewriteHistoryTurn[];
	limit?: number;
	/** From the planning model’s JSON (`rankingGuidance`). */
	guidance?: string;
	/** Tail of the planning model’s reasoning stream. */
	planningNotes?: string;
}

const PLANNING_NOTES_DRAFT_LINE =
	/^[{}\[\]]|^```|^"?(?:queries|fallbackQueries|correctedQuestion|displayQuestion|lookingFor|shareSlug|offTopic|personSlugs|rankingGuidance)"?\s*:/i;

export function clipPlanningNotes(
	value: string | undefined,
	max = AI_RERANK_PLANNING_NOTES_MAX,
): string {
	const text = (value || "")
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.filter((line) => line && !PLANNING_NOTES_DRAFT_LINE.test(line))
		.join("\n")
		.trim();
	if (text.length <= max) return text;
	// The conclusion lives at the end of a reasoning stream.
	return `…${text.slice(text.length - max)}`;
}

export interface AiRerankParseResult {
	slugs: string[];
	summary: string;
	shareSlug?: string;
	usefulFallbackQueries: string[];
	/** True when the model included usefulFallbackQueries (even if []). */
	usefulFallbackQueriesSpecified: boolean;
}

export function clipRerankSummary(value: string, max = AI_RERANK_SUMMARY_MAX): string {
	return normalizeAskSummaryProse(value, max);
}

function parseUsefulFallbackQueries(
	raw: unknown,
	allowedFallbacks: readonly string[],
): string[] {
	if (!Array.isArray(raw) || allowedFallbacks.length === 0) return [];
	const byKey = new Map(
		allowedFallbacks.map((query) => [query.toLowerCase(), query] as const),
	);
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		if (typeof item !== "string") continue;
		const key = item.replace(/\s+/g, " ").trim().toLowerCase();
		const match = byKey.get(key);
		if (!match || seen.has(key)) continue;
		seen.add(key);
		out.push(match);
	}
	return out;
}

export function parseRerankResponse(
	raw: string,
	allowed: ReadonlySet<string>,
	max = AI_RERANK_MAX_LIMIT,
	allowedFallbacks: readonly string[] = [],
): AiRerankParseResult {
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") {
		return {
			slugs: [],
			summary: "",
			usefulFallbackQueries: [],
			usefulFallbackQueriesSpecified: false,
		};
	}
	const record = parsed as Record<string, unknown>;
	const list = Array.isArray(record.slugs)
		? record.slugs
		: Array.isArray(record.ids)
			? record.ids
			: [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of list) {
		if (typeof item !== "string") continue;
		const slug = item.replace(/\s+/g, "").trim().toLowerCase();
		if (!slug || !allowed.has(slug) || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
		if (out.length >= max) break;
	}
	const summaryRaw =
		typeof record.summary === "string"
			? record.summary
			: typeof record.alignment === "string"
				? record.alignment
				: typeof record.blurb === "string"
					? record.blurb
					: "";
	const shareSlug =
		normalizeAskShareSlug(
			typeof record.shareSlug === "string" ? record.shareSlug : "",
		) || undefined;
	const usefulFallbackRaw =
		record.usefulFallbackQueries ?? record.usefulFallbacks;
	const usefulFallbackQueriesSpecified = Array.isArray(usefulFallbackRaw);
	const usefulFallbackQueries = usefulFallbackQueriesSpecified
		? parseUsefulFallbackQueries(usefulFallbackRaw, allowedFallbacks)
		: [];
	return {
		slugs: out,
		summary: clipRerankSummary(summaryRaw),
		...(shareSlug ? { shareSlug } : {}),
		usefulFallbackQueries,
		usefulFallbackQueriesSpecified,
	};
}

/** @deprecated use parseRerankResponse */
export function parseRerankSlugs(
	raw: string,
	allowed: ReadonlySet<string>,
	max = AI_RERANK_MAX_LIMIT,
): string[] {
	return parseRerankResponse(raw, allowed, max).slugs;
}

function candidateLine(hit: AiRerankCandidate, index: number): string {
	const id = transformId(hit.slug);
	const title = (hit.title || "").replace(/\s+/g, " ").trim().slice(0, 100);
	// Keep descriptions — they’re what lets the reranker beat keyword overfitting.
	const description = (hit.description || "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 180);
	const ref = hit.referenceOnly ? " [reference]" : "";
	const snippet =
		index < AI_RERANK_SNIPPET_CANDIDATES && hit.contentSnippet
			? (hit.contentSnippet || "")
					.replace(/<[^>]*>/g, "")
					.replace(/\s+/g, " ")
					.trim()
					.slice(0, RERANK_SNIPPET_CHARS)
			: "";
	const snippetLine = snippet ? `\n   passage: ${snippet}` : "";
	return `${index + 1}. ${id}${ref} | ${title}\n   ${description || "(no description)"}${snippetLine}`;
}

export function formatRerankHistoryBlock(
	history: readonly AiRewriteHistoryTurn[] = [],
): string {
	const recent = history.slice(-RERANK_HISTORY_TURNS);
	if (recent.length === 0) return "";
	const lines = recent.map((turn, index) => {
		const shown = (turn.resultSlugs || [])
			.slice(0, RERANK_HISTORY_SHOWN_SLUGS)
			.map((slug) => transformId(slug))
			.filter(Boolean)
			.join(", ");
		const shownLine = shown ? `\n   shown: ${shown}` : "";
		const summary = clipAiHistorySummary(turn.summary || "");
		const summaryLine = summary ? `\n   summary: ${summary}` : "";
		const looking = (turn.lookingFor || "").replace(/\s+/g, " ").trim();
		const lookingLine = looking ? `\n   lookingFor: ${looking}` : "";
		return `${index + 1}. Q: ${turn.question}${lookingLine}${shownLine}${summaryLine}`;
	});
	return `\nEarlier in this Ask:\n${lines.join("\n")}\n`;
}

export function buildRerankUserPrompt(
	question: string,
	candidates: readonly AiRerankCandidate[],
	fallbackQueriesOrOptions: readonly string[] | AiRerankPromptOptions = [],
	history: readonly AiRewriteHistoryTurn[] = [],
	limit: number = AI_RERANK_DEFAULT_LIMIT,
): string {
	const options: AiRerankPromptOptions = Array.isArray(fallbackQueriesOrOptions)
		? { fallbackQueries: fallbackQueriesOrOptions, history, limit }
		: (fallbackQueriesOrOptions as AiRerankPromptOptions);
	const fallbackQueries = options.fallbackQueries || [];
	const body = candidates.map((hit, index) => candidateLine(hit, index)).join("\n");
	const target = clampAskResultLimit(options.limit ?? AI_RERANK_DEFAULT_LIMIT);
	const coverage =
		target > AI_RERANK_DEFAULT_LIMIT
			? `Coverage: they asked for broader / more detailed / research-style coverage. Choose how many discourses to return (ceiling ${target}, not a quota). Write a fuller summary that treats the question.`
			: `Coverage: prefer a tight, high-quality set around ${target}. Write a real briefing, not a caption.`;
	const guidance = (options.guidance || "").replace(/\s+/g, " ").trim();
	const guidanceBlock = guidance
		? `\nGuidance from the planning step: ${guidance}\n`
		: "";
	const notes = clipPlanningNotes(options.planningNotes);
	const notesBlock = notes ? `\nPlanning notes (raw, may be partial):\n${notes}\n` : "";
	const fallbacks =
		fallbackQueries.length > 0
			? `\nFallback searches also tried: ${fallbackQueries
					.map((query) => JSON.stringify(query))
					.join(", ")}\n`
			: "\nFallback searches also tried: (none)\n";
	const earlier = formatRerankHistoryBlock(options.history || []);
	return `Question: ${question.replace(/\s+/g, " ").trim()}
Target result count: up to ${target}
${coverage}
${guidanceBlock}${notesBlock}${earlier}${fallbacks}
Candidates:
${body}

JSON:`;
}

export function applyRerankOrder<T extends { slug: string }>(
	candidates: readonly T[],
	orderedSlugs: readonly string[],
	limit = AI_RERANK_DEFAULT_LIMIT,
): T[] {
	const bySlug = new Map(
		candidates.map((hit) => [hit.slug.toLowerCase(), hit] as const),
	);
	const out: T[] = [];
	const seen = new Set<string>();
	for (const slug of orderedSlugs) {
		const hit = bySlug.get(slug.toLowerCase());
		if (!hit || seen.has(hit.slug)) continue;
		seen.add(hit.slug);
		out.push(hit);
		if (out.length >= limit) return out;
	}
	if (out.length > 0) return out;
	return candidates.slice(0, limit);
}

export type AiRerankProvider = "gemini" | "openrouter" | "";

export interface AiRerankResult {
	results: AiDiscourseHit[];
	summary: string;
	shareSlug?: string;
	/** Size of the candidate pool that was ranked. */
	candidateCount: number;
	/** @deprecated prefer `provider === "gemini"` */
	usedGemini: boolean;
	reranked: boolean;
	provider: AiRerankProvider;
	model: string;
	usefulFallbackQueries: string[];
	usefulFallbackQueriesSpecified: boolean;
}

function emptyRerank(
	candidates: readonly AiDiscourseHit[],
	limit: number = AI_RERANK_DEFAULT_LIMIT,
): AiRerankResult {
	const target = clampAskResultLimit(limit);
	return {
		results: candidates.slice(0, target),
		summary: "",
		candidateCount: candidates.length,
		usedGemini: false,
		reranked: false,
		provider: "",
		model: "",
		usefulFallbackQueries: [],
		usefulFallbackQueriesSpecified: false,
	};
}

function finishRerank(
	candidates: readonly AiDiscourseHit[],
	parsed: AiRerankParseResult,
	provider: Exclude<AiRerankProvider, "">,
	model: string,
	limit: number,
): AiRerankResult {
	const target = clampAskResultLimit(limit);
	if (parsed.slugs.length === 0) {
		return emptyRerank(candidates, target);
	}
	return {
		results: applyRerankOrder(candidates, parsed.slugs, target),
		summary: parsed.summary,
		...(parsed.shareSlug ? { shareSlug: parsed.shareSlug } : {}),
		candidateCount: candidates.length,
		usedGemini: provider === "gemini",
		reranked: true,
		provider,
		model,
		usefulFallbackQueries: parsed.usefulFallbackQueries,
		usefulFallbackQueriesSpecified: parsed.usefulFallbackQueriesSpecified,
	};
}

interface RerankProviderOptions {
	question: string;
	candidates: readonly AiDiscourseHit[];
	fallbackQueries: readonly string[];
	history: readonly AiRewriteHistoryTurn[];
	limit: number;
	guidance?: string;
	planningNotes?: string;
	signal?: AbortSignal;
}

async function rerankWithGemini(
	options: RerankProviderOptions,
): Promise<AiRerankResult> {
	const model = getConfiguredGeminiRerankModel();
	const allowed = new Set(
		options.candidates.map((hit) => hit.slug.toLowerCase()),
	);
	const generated = await geminiGenerate({
		model,
		system: RERANK_SYSTEM,
		messages: [
			{
				role: "user",
				content: buildRerankUserPrompt(options.question, options.candidates, {
					fallbackQueries: options.fallbackQueries,
					history: options.history,
					limit: options.limit,
					guidance: options.guidance,
					planningNotes: options.planningNotes,
				}),
			},
		],
		maxOutputTokens: AI_RERANK_MAX_OUTPUT_TOKENS,
		temperature: 0.1,
		signal: options.signal ?? AbortSignal.timeout(90_000),
	});
	const parsed = parseRerankResponse(
		generated.content,
		allowed,
		options.limit,
		options.fallbackQueries,
	);
	return finishRerank(
		options.candidates,
		parsed,
		"gemini",
		generated.model || model,
		options.limit,
	);
}

async function rerankWithOpenRouter(
	options: RerankProviderOptions & { openRouterModel?: string },
): Promise<AiRerankResult> {
	if (!getOpenRouterApiKey()) {
		return emptyRerank(options.candidates, options.limit);
	}
	const model =
		options.openRouterModel?.trim() || getConfiguredOpenRouterModel();
	const allowed = new Set(
		options.candidates.map((hit) => hit.slug.toLowerCase()),
	);
	const generated = await openRouterChat({
		model,
		messages: [
			{ role: "system", content: RERANK_SYSTEM },
			{
				role: "user",
				content: buildRerankUserPrompt(options.question, options.candidates, {
					fallbackQueries: options.fallbackQueries,
					history: options.history,
					limit: options.limit,
					guidance: options.guidance,
					planningNotes: options.planningNotes,
				}),
			},
		],
		maxTokens: AI_RERANK_MAX_OUTPUT_TOKENS,
		signal: options.signal ?? AbortSignal.timeout(90_000),
	});
	const parsed = parseRerankResponse(
		generated.content,
		allowed,
		options.limit,
		options.fallbackQueries,
	);
	return finishRerank(
		options.candidates,
		parsed,
		"openrouter",
		generated.model || model,
		options.limit,
	);
}

/**
 * Re-rank candidates (Gemini first; OpenRouter when Gemini hits quota/errors).
 * On total failure, returns the original list capped to the requested display limit.
 */
export async function rerankDiscourseHits(options: {
	question: string;
	candidates: readonly AiDiscourseHit[];
	fallbackQueries?: readonly string[];
	/** Prior turns in this Ask thread — used for conversational follow-ups. */
	history?: readonly AiRewriteHistoryTurn[];
	/** Soft ceiling for how many discourses to return (default 10, max 50). */
	limit?: number;
	/** Preferred OpenRouter model when Gemini is unavailable (usually the Ask model). */
	openRouterModel?: string;
	/** `rankingGuidance` from the planning model’s JSON. */
	guidance?: string;
	/** Planning model’s reasoning stream (tail is forwarded, clipped). */
	planningNotes?: string;
	signal?: AbortSignal;
}): Promise<AiRerankResult> {
	const candidates = options.candidates.slice(0, AI_RERANK_CANDIDATE_LIMIT);
	const fallbackQueries = options.fallbackQueries || [];
	const history = options.history || [];
	const limit = clampAskResultLimit(
		options.limit ?? resolveAskResultLimit(options.question),
	);
	if (candidates.length <= 1) {
		return emptyRerank(candidates, limit);
	}

	if (isGeminiConfigured()) {
		try {
			return await rerankWithGemini({
				question: options.question,
				candidates,
				fallbackQueries,
				history,
				limit,
				guidance: options.guidance,
				planningNotes: options.planningNotes,
				signal: options.signal,
			});
		} catch (error) {
			if (!shouldFallbackRerankToOpenRouter(error)) {
				console.error("[ai/ask] gemini rerank failed", error);
				return emptyRerank(candidates, limit);
			}
			console.warn(
				"[ai/ask] gemini rerank quota/error — trying OpenRouter",
				error instanceof Error ? error.message : error,
			);
		}
	}

	try {
		return await rerankWithOpenRouter({
			question: options.question,
			candidates,
			fallbackQueries,
			history,
			limit,
			guidance: options.guidance,
			planningNotes: options.planningNotes,
			openRouterModel: options.openRouterModel,
			signal: options.signal,
		});
	} catch (error) {
		console.error("[ai/ask] openrouter rerank failed", error);
		return emptyRerank(candidates, limit);
	}
}

/** @deprecated use rerankDiscourseHits */
export async function rerankDiscourseHitsWithGemini(options: {
	question: string;
	candidates: readonly AiDiscourseHit[];
	signal?: AbortSignal;
}): Promise<{
	results: AiDiscourseHit[];
	summary: string;
	shareSlug?: string;
	usedGemini: boolean;
	model: string;
}> {
	const ranked = await rerankDiscourseHits(options);
	return {
		results: ranked.results,
		summary: ranked.summary,
		...(ranked.shareSlug ? { shareSlug: ranked.shareSlug } : {}),
		usedGemini: ranked.usedGemini,
		model: ranked.model,
	};
}
