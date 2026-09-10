import {
	extractJsonObject,
	type AiRewritePlan,
} from "./aiQueryRewrite";
import { normalizeAiSearchQuery } from "./aiSearchQuery";

export const RESEARCH_VERIFY_QUERY_LIMIT = 4;
export const RESEARCH_VERIFY_NOTE_MAX = 160;

export interface ResearchVerifyResult {
	onTrack: boolean;
	note: string;
	revisedQueries: string[];
	lookingFor?: string;
}

function clipNote(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_VERIFY_NOTE_MAX);
}

function clipQueries(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of value) {
		if (typeof item !== "string") continue;
		const query = normalizeAiSearchQuery(item);
		if (!query) continue;
		const key = query.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(query);
		if (out.length >= RESEARCH_VERIFY_QUERY_LIMIT) break;
	}
	return out;
}

export function parseResearchVerify(text: string): ResearchVerifyResult {
	const parsed = extractJsonObject(text);
	if (!parsed || typeof parsed !== "object") {
		return { onTrack: true, note: "", revisedQueries: [] };
	}
	const record = parsed as Record<string, unknown>;
	const onTrack = record.onTrack !== false;
	const note =
		typeof record.note === "string" ? clipNote(record.note) : "";
	const lookingFor =
		typeof record.lookingFor === "string"
			? record.lookingFor.replace(/\s+/g, " ").trim().slice(0, 280)
			: "";
	const revisedQueries = clipQueries(record.revisedQueries);
	return {
		onTrack,
		note,
		revisedQueries,
		...(lookingFor ? { lookingFor } : {}),
	};
}

/**
 * Off-track verify may replace the primary queries once. Empty revisedQueries
 * keeps the original plan rather than failing the job.
 */
export function applyResearchVerifyToPlan(
	plan: AiRewritePlan,
	verify: ResearchVerifyResult,
): AiRewritePlan {
	const lookingFor = verify.lookingFor || plan.lookingFor;
	const coverage = plan.offTopic ? plan.coverage : "survey";
	if (verify.onTrack || verify.revisedQueries.length === 0) {
		return {
			...plan,
			lookingFor,
			...(coverage ? { coverage } : {}),
		};
	}
	return {
		...plan,
		lookingFor,
		coverage: "survey",
		queries: verify.revisedQueries,
	};
}

export const RESEARCH_VERIFY_SYSTEM = `You check whether a planned sutta-library search is on the right track.

You receive the person's question, the planner's theme and search queries, and a small scout of real discourse hits from those queries. You do not answer the question. You do not invent discourse IDs.

Return JSON only:
{"onTrack":true,"note":"short verdict for the reader","revisedQueries":[],"lookingFor":""}

Rules:
- onTrack true when the scout hits are clearly about the same teaching or story the person asked about.
- onTrack false when the queries drifted (wrong term, too famous a neighbor, wrong nikāya, empty/irrelevant scout). Then put 1–4 better short search queries in revisedQueries. Each query is 1–8 tokens, not a sentence. Use the site's search operators only when they help.
- note: one short clause shown in the UI (e.g. "On track · feeling (vedanā)" or "Adjusted searches · added SN 36"). Empty is fine.
- lookingFor: optional shorter theme label. Empty string keeps the planner's label.
- If the scout is thin but the queries still match the question, keep onTrack true and leave revisedQueries empty.
- Never invent sutta citations as queries unless they already appeared in the scout or the question.`;
