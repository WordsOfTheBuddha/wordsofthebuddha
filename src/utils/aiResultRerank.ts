import { extractJsonObject } from "./aiQueryRewrite";
import { normalizeAskShareSlug } from "./aiAskShare";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	geminiGenerate,
	getConfiguredGeminiRerankModel,
	isGeminiConfigured,
} from "./gemini";
import { transformId } from "./transformId";

/** Match the search candidate pool — Gemini’s context can handle this easily. */
export const AI_RERANK_CANDIDATE_LIMIT = 500;
export const AI_RERANK_DEFAULT_LIMIT = 10;
export const AI_RERANK_MAX_LIMIT = 20;
/** Usual answers stay short; framing “related but outside the nikāyas” may run longer. */
export const AI_RERANK_SUMMARY_MAX = 1200;

const RERANK_SYSTEM = `You re-rank Pāli discourse search candidates for Words of the Buddha.

You receive a person's question and a list of candidate discourses (id, title, description). Return JSON only:
{"slugs":["mn10","sn47.19"],"count":10,"summary":"2–4 sentences explaining how these discourses match what the person asked for.","shareSlug":"mindfulness-of-the-body"}

Rules:
- Order slugs best-first for answering the person's question (technique / practical application when they asked for that).
- Only use slugs from the candidate list. Never invent IDs.
- Prefer quality over quantity: typically 8–12 strong matches. Use up to 20 only when many candidates are clearly relevant.
- Drop weak / tangential / near-duplicate candidates.
- Prefer native translations over reference-only when both cover the same teaching.
- summary: plain prose for the reader. Default 2–4 sentences explaining how the chosen set aligns with their intent. Mention a few of the selected discourse IDs when helpful. Do not invent teachings or quote long passages. No markdown.
- When the question names something mainly outside these early discourses (commentaries, later Abhidhamma layers, other Buddhist schools, popular terms not taught here): say so clearly, then point to the closest early-discourse parallels in the selected set and what they actually cover. You may use up to about 6 sentences for that framing.
- For hard or controversial questions that are still inside the canon: stay factual and measured; do not sensationalize; let the selected discourses carry the answer.
- Never give crisis counseling, medical/legal advice, or spiritualize distress. If the question is a crisis, keep summary empty (the rewrite layer should have marked it off-topic).
- shareSlug: optional short public URL slug for the question theme (lowercase kebab-case, about 12–48 characters), e.g. "four-foundations-of-mindfulness".`;

export interface AiRerankCandidate {
	slug: string;
	title: string;
	description: string;
	referenceOnly?: boolean;
}

export interface AiRerankParseResult {
	slugs: string[];
	summary: string;
	shareSlug?: string;
}

export function clipRerankSummary(value: string, max = AI_RERANK_SUMMARY_MAX): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function parseRerankResponse(
	raw: string,
	allowed: ReadonlySet<string>,
	max = AI_RERANK_MAX_LIMIT,
): AiRerankParseResult {
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") {
		return { slugs: [], summary: "" };
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
	return {
		slugs: out,
		summary: clipRerankSummary(summaryRaw),
		...(shareSlug ? { shareSlug } : {}),
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
	return `${index + 1}. ${id}${ref} | ${title}\n   ${description || "(no description)"}`;
}

export function buildRerankUserPrompt(
	question: string,
	candidates: readonly AiRerankCandidate[],
): string {
	const body = candidates.map((hit, index) => candidateLine(hit, index)).join("\n");
	return `Question: ${question.replace(/\s+/g, " ").trim()}

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

/**
 * Ask Gemini to order/filter candidates and summarize alignment.
 * On failure or missing key, returns the original list capped to the default display limit.
 */
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
	const candidates = options.candidates.slice(0, AI_RERANK_CANDIDATE_LIMIT);
	if (candidates.length <= 1 || !isGeminiConfigured()) {
		return {
			results: candidates.slice(0, AI_RERANK_DEFAULT_LIMIT),
			summary: "",
			usedGemini: false,
			model: "",
		};
	}
	const allowed = new Set(candidates.map((hit) => hit.slug.toLowerCase()));
	try {
		const model = getConfiguredGeminiRerankModel();
		const generated = await geminiGenerate({
			model,
			system: RERANK_SYSTEM,
			messages: [
				{
					role: "user",
					content: buildRerankUserPrompt(options.question, candidates),
				},
			],
			maxOutputTokens: 1600,
			temperature: 0.1,
			// Large candidate lists need more headroom than a short rewrite.
			signal: options.signal ?? AbortSignal.timeout(60_000),
		});
		const parsed = parseRerankResponse(
			generated.content,
			allowed,
			AI_RERANK_MAX_LIMIT,
		);
		if (parsed.slugs.length === 0) {
			return {
				results: candidates.slice(0, AI_RERANK_DEFAULT_LIMIT),
				summary: "",
				usedGemini: false,
				model,
			};
		}
		const target =
			parsed.slugs.length >= 8
				? Math.min(parsed.slugs.length, AI_RERANK_MAX_LIMIT)
				: AI_RERANK_DEFAULT_LIMIT;
		return {
			results: applyRerankOrder(candidates, parsed.slugs, target),
			summary: parsed.summary,
			...(parsed.shareSlug ? { shareSlug: parsed.shareSlug } : {}),
			usedGemini: true,
			model: generated.model || model,
		};
	} catch (error) {
		console.error("[ai/ask] gemini rerank failed", error);
		return {
			results: candidates.slice(0, AI_RERANK_DEFAULT_LIMIT),
			summary: "",
			usedGemini: false,
			model: "",
		};
	}
}
