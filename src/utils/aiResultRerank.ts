import {
	clipAiHistorySummary,
	extractJsonObject,
	type AiRewriteHistoryTurn,
} from "./aiQueryRewrite";
import {
	ASK_HISTORY_MAX_TURNS,
	candidatesForAskFollowUp,
	clipAskHistoryTurns,
	collectAskHistoryShownSlugs,
	formatAskAlreadyShownIds,
} from "./aiAskHistory";
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
/** Typical survey size / planner hint. Not a pad-to quota. */
export const AI_RERANK_MAX_LIMIT = 50;
/** Hard clip: a few extra on-topic survey hits may overshoot the typical 50. */
export const AI_RERANK_HARD_LIMIT = 55;
/**
 * Hard clip for summary prose. Ordinary asks stay shorter in the prompt;
 * research / detailed asks may use more of this budget.
 */
export const AI_RERANK_SUMMARY_MAX = 4800;
/** Room for a survey slug list plus a multi-paragraph briefing. */
export const AI_RERANK_MAX_OUTPUT_TOKENS = 8192;
const RERANK_HISTORY_TURNS = ASK_HISTORY_MAX_TURNS;
const RERANK_HISTORY_SHOWN_SLUGS = AI_RERANK_HARD_LIMIT;
/**
 * Top-of-pool candidates also get their matched content snippet. Descriptions
 * alone are thin for writing a briefing; snippets are query-relevant passages.
 */
export const AI_RERANK_SNIPPET_CANDIDATES = 150;
const RERANK_SNIPPET_CHARS = 280;
/** Tail of the planning model’s reasoning forwarded to the rescorer. */
export const AI_RERANK_PLANNING_NOTES_MAX = 1200;

/**
 * Default ~10; survey / research asks use a typical size of 50. The rescorer
 * chooses the final count (no padding to that typical size).
 */
const EXPANSIVE_RESULT_RE =
	/\b(exhaustiv\w*|comprehensiv\w*|thorough\w*|in detail|detailed|in.?depth|as many as possible|all (relevant |the )?(discourses|suttas|citations)|every (relevant )?(discourse|sutta)|complete (list|survey|treatment)|survey of|list all|show (me )?more|more (discourses|suttas|citations|references|examples)|more than ten|wide (net|range)|full (range|treatment|survey)|broad(er)? (set|survey|overview|coverage)|research\b|citations?\b|collect (all|many)|compile|as many (as you can|discourses|suttas|citations)|lots of (discourses|suttas)|many (discourses|suttas|citations)|everything (on|about)|extensive(\s+search)?)\b/i;

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
		AI_RERANK_HARD_LIMIT,
		Math.max(1, Math.floor(value)),
	);
}

/**
 * Cap applied to the rescorer’s slug list. Brief stays at ~10; survey may
 * overshoot the typical 50 up to AI_RERANK_HARD_LIMIT.
 */
export function askRerankCap(limit: number): number {
	const target = clampAskResultLimit(limit);
	return target > AI_RERANK_DEFAULT_LIMIT
		? AI_RERANK_HARD_LIMIT
		: target;
}

/**
 * Planner `coverage` is a brief-vs-survey hint, not a pad-to quota.
 * Returns the prompt target (10 or 50). The rescorer owns the final count.
 * Keyword matching is only used when the rewrite omitted the field
 * (degraded / no JSON).
 */
export function resolveAskResultLimit(
	question: string,
	coverage?: "brief" | "survey" | string,
): number {
	if (coverage === "survey") return AI_RERANK_MAX_LIMIT;
	if (coverage === "brief") return AI_RERANK_DEFAULT_LIMIT;
	const text = question.replace(/\s+/g, " ").trim();
	if (!text) return AI_RERANK_DEFAULT_LIMIT;
	return isExpansiveAskQuestion(text)
		? AI_RERANK_MAX_LIMIT
		: AI_RERANK_DEFAULT_LIMIT;
}

export const RERANK_SYSTEM = `You re-rank Pāli discourse search candidates for Words of the Buddha.

You receive a person's question, a result-count ceiling, optional guidance from the planning model that wrote the searches, optional earlier turns from the same Ask conversation, an optional planner blacklist of IDs not to include, optional fallback search terms that were also tried, and a list of candidate discourses (id, title, description, and for the top of the pool a matched passage). Return JSON only:
{"slugs":["mn10","sn47.19"],"count":2,"summary":"A real briefing that answers the question from the selected discourses. Use blank lines between short paragraphs when the treatment needs more than one.","shareSlug":"mindfulness-of-the-body","usefulFallbackQueries":["broader term"]}

Rules:
- Order slugs best-first for answering the person's question (technique / practical application when they asked for that).
- Only use slugs from the candidate list. Never invent IDs.
- Ordinary questions (target around 10): return only as many as are needed. A specific story, named sutta, or “which discourse” lookup may need 3–6. Do not stretch to 10 for padding.
- Survey / research / extensive / citations: select every distinct on-topic discourse, best-first. Typical size is 20–50 — not a pad-to quota. Do not stop at a top-10 shortlist. Do not stretch to 50 to fill a round number. If the pool is thin, fewer than 20 is fine. If a few more than 50 are clearly on-topic, include them (hard cap about 55). Drop only near-duplicates, reference-only copies of a native hit, and clearly off-topic items.
- Prefer native translations over reference-only when both cover the same teaching.
- Candidates are listed in library-search order (best fused rank first). That order is a hint, not a verdict — read the descriptions and passages.
- When "Guidance from the planning step" is present, follow it for what to prioritize, which facets to represent, and how to frame the answer. It comes from a stronger model that read the question first. Planning notes (if present) are its raw thinking — use them for intent, ignore any JSON drafting.
- When Earlier in this Ask is present, treat this as one conversation: resolve pronouns and references (“that”, “the second one”, “those discourses”, “more like this”) against prior questions, shown IDs, and clipped prior summaries. Rank and write the summary as a continuation, not a brand-new isolated Ask — unless the new question clearly changes topic. Already-shown IDs are context for pronouns, not a blacklist you infer.
- When "Do not include these IDs (planner blacklist)" is present, never select those slugs. The planning model already classified diversify vs refine vs new topic. Do not infer a blacklist from earlier turns or from wording like “other discourses.” An empty planner blacklist means already-shown IDs may stay in play.
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
	/**
	 * Planner-owned blacklist (`excludeSlugs`). `[]` means keep prior IDs;
	 * omitted means the candidate-pool heuristic may still apply.
	 */
	excludeSlugs?: readonly string[];
}

const PLANNING_NOTES_DRAFT_LINE =
	/^[{}\[\]]|^```|^"?(?:queries|fallbackQueries|correctedQuestion|displayQuestion|lookingFor|shareSlug|offTopic|personSlugs|rankingGuidance|coverage|followUpIntent|excludeSlugs|blacklist)"?\s*:/i;

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
	max = AI_RERANK_HARD_LIMIT,
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
	// JSON `count` is advisory for the model; slugs are the selected set.
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
	max = AI_RERANK_HARD_LIMIT,
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
	const recent = clipAskHistoryTurns(history, RERANK_HISTORY_TURNS);
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
	const allShown = formatAskAlreadyShownIds(
		collectAskHistoryShownSlugs(history),
		(slug) => transformId(slug) || slug,
		RERANK_HISTORY_SHOWN_SLUGS,
	);
	const shownUnion = allShown
		? `Already shown IDs (context for pronouns only — do not drop these unless the planner blacklist says so): ${allShown}\n`
		: "";
	return `\nEarlier in this Ask:\n${lines.join("\n")}\n${shownUnion}`;
}

/**
 * Explicit planner blacklist for Flash. History is not a substitute.
 */
export function formatRerankExcludeBlock(
	excludeSlugs?: readonly string[],
	hasHistory = false,
): string {
	if (!hasHistory || excludeSlugs === undefined) return "";
	if (excludeSlugs.length === 0) {
		return `\nDo not include these IDs (planner blacklist): (none). Already-shown IDs may stay in play.\n`;
	}
	const ids = formatAskAlreadyShownIds(
		excludeSlugs,
		(slug) => transformId(slug) || slug,
		RERANK_HISTORY_SHOWN_SLUGS,
	);
	return `\nDo not include these IDs (planner blacklist): ${ids}\n`;
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
	const survey = target > AI_RERANK_DEFAULT_LIMIT;
	const coverage = survey
		? `Coverage: they asked to research / survey / cite thoroughly. Select every distinct on-topic discourse. Typical size is 20–${AI_RERANK_MAX_LIMIT} — do not pad to a round number or stretch to ${AI_RERANK_MAX_LIMIT} for quota. If the pool is thin, fewer than 20 is fine. A few more than ${AI_RERANK_MAX_LIMIT} is OK when they are clearly on-topic (hard cap about ${AI_RERANK_HARD_LIMIT}). Write a fuller summary that treats the question.`
		: `Coverage: return only as many as are needed (ceiling ${target}). A single-discourse lookup may be 3–6. Write a real briefing, not a caption.`;
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
	const excludeBlock = formatRerankExcludeBlock(
		options.excludeSlugs,
		(options.history || []).length > 0,
	);
	const targetLine = survey
		? `Target result count: typically 20–${AI_RERANK_MAX_LIMIT} (hard cap ${AI_RERANK_HARD_LIMIT})`
		: `Target result count: up to ${target}`;
	return `Question: ${question.replace(/\s+/g, " ").trim()}
${targetLine}
${coverage}
${guidanceBlock}${notesBlock}${earlier}${excludeBlock}${fallbacks}
Candidates:
${body}

JSON:`;
}

export function applyRerankOrder<T extends { slug: string }>(
	candidates: readonly T[],
	orderedSlugs: readonly string[],
	limit = AI_RERANK_DEFAULT_LIMIT,
	minCount = 0,
): T[] {
	const cap = clampAskResultLimit(limit);
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
		if (out.length >= cap) return out;
	}
	const floor = Math.min(cap, Math.max(0, Math.floor(minCount)));
	if (out.length === 0) return candidates.slice(0, cap);
	if (out.length >= floor) return out;
	for (const hit of candidates) {
		if (seen.has(hit.slug)) continue;
		seen.add(hit.slug);
		out.push(hit);
		if (out.length >= floor) break;
	}
	return out;
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
	// Trust the rescorer’s slug list. Brief stays at ~10; survey may
	// overshoot the typical 50 up to the hard cap. Never pad from leftovers.
	return {
		results: applyRerankOrder(
			candidates,
			parsed.slugs,
			askRerankCap(target),
		),
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
	excludeSlugs?: readonly string[];
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
					excludeSlugs: options.excludeSlugs,
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
		askRerankCap(options.limit),
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
					excludeSlugs: options.excludeSlugs,
				}),
			},
		],
		maxTokens: AI_RERANK_MAX_OUTPUT_TOKENS,
		signal: options.signal ?? AbortSignal.timeout(90_000),
	});
	const parsed = parseRerankResponse(
		generated.content,
		allowed,
		askRerankCap(options.limit),
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
	/** Prompt target for how many discourses to return (default 10, typical survey 50, hard cap 55). */
	limit?: number;
	/** Preferred OpenRouter model when Gemini is unavailable (usually the Ask model). */
	openRouterModel?: string;
	/** `rankingGuidance` from the planning model’s JSON. */
	guidance?: string;
	/** Planning model’s reasoning stream (tail is forwarded, clipped). */
	planningNotes?: string;
	/**
	 * Planner-owned blacklist. When set (including `[]`), this is the
	 * candidate-pool filter — Flash does not infer the policy. Omitted:
	 * light question-text heuristic only as a degraded fallback.
	 */
	excludeSlugs?: readonly string[];
	signal?: AbortSignal;
}): Promise<AiRerankResult> {
	const history = options.history || [];
	const candidates = candidatesForAskFollowUp(
		options.candidates.slice(0, AI_RERANK_CANDIDATE_LIMIT),
		options.question,
		history,
		options.excludeSlugs,
	);
	const fallbackQueries = options.fallbackQueries || [];
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
				excludeSlugs: options.excludeSlugs,
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
			excludeSlugs: options.excludeSlugs,
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
