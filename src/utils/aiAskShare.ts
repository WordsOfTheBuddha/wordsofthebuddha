import type { AiDiscourseHit } from "./aiDiscourseHits";
import { normalizeAskQuestionKey } from "./aiAskSession";

export const ASK_SHARE_SLUG_MIN = 8;
export const ASK_SHARE_SLUG_MAX = 48;
export const ASK_SHARE_COLLECTION = "askShares";

const STOP = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"did",
	"do",
	"does",
	"for",
	"from",
	"how",
	"i",
	"in",
	"is",
	"it",
	"of",
	"on",
	"or",
	"the",
	"to",
	"was",
	"what",
	"when",
	"where",
	"which",
	"who",
	"why",
	"with",
	"about",
	"there",
]);

export interface AiAskShareSnapshot {
	slug: string;
	question: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	summary: string;
	results: AiDiscourseHit[];
	model: string;
	requestId?: string;
	createdAt: number;
}

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Normalize model/user text into a public share slug, or null if unusable. */
export function normalizeAskShareSlug(raw: string): string | null {
	const slug = raw
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, ASK_SHARE_SLUG_MAX)
		.replace(/-+$/g, "");
	if (slug.length < ASK_SHARE_SLUG_MIN) return null;
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
	return slug;
}

/** Local fallback when the model omits or returns a bad shareSlug. */
export function deriveAskShareSlug(
	lookingFor: string,
	question: string,
): string {
	const preferred = normalizeAskShareSlug(lookingFor);
	if (preferred) return preferred;

	const words = question
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9\s-]/g, " ")
		.split(/[\s-]+/)
		.filter((word) => word.length > 1 && !STOP.has(word))
		.slice(0, 6);
	const fromQuestion = normalizeAskShareSlug(words.join("-"));
	if (fromQuestion) return fromQuestion;

	const loose = normalizeAskShareSlug(
		question.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
	);
	return loose || "ask-discourses";
}

export function resolveAskShareSlug(
	preferred: string | undefined | null,
	lookingFor: string,
	question: string,
): string {
	return (
		normalizeAskShareSlug(preferred || "") ||
		deriveAskShareSlug(lookingFor, question)
	);
}

export function askSharePath(slug: string): string {
	return `/ask/${slug}`;
}

export function sanitizeAskShareResults(raw: unknown): AiDiscourseHit[] {
	if (!Array.isArray(raw)) return [];
	const out: AiDiscourseHit[] = [];
	for (const item of raw.slice(0, 12)) {
		if (!item || typeof item !== "object") continue;
		const hit = item as Record<string, unknown>;
		const slug = clip(typeof hit.slug === "string" ? hit.slug : "", 64);
		const href = clip(
			typeof hit.href === "string" ? hit.href : slug ? `/${slug}` : "",
			120,
		);
		if (!slug || !href) continue;
		out.push({
			slug,
			title: clip(typeof hit.title === "string" ? hit.title : slug, 160),
			description: clip(
				typeof hit.description === "string" ? hit.description : "",
				280,
			),
			contentSnippet:
				typeof hit.contentSnippet === "string" && hit.contentSnippet
					? clip(hit.contentSnippet, 280)
					: null,
			referenceOnly: hit.referenceOnly === true,
			...(typeof hit.volpage === "string" && hit.volpage
				? { volpage: clip(hit.volpage, 80) }
				: {}),
			href,
		});
	}
	return out;
}

export function sanitizeAskShareSnapshot(
	raw: unknown,
): AiAskShareSnapshot | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const slug = normalizeAskShareSlug(
		typeof record.slug === "string" ? record.slug : "",
	);
	const question = clip(
		typeof record.question === "string" ? record.question : "",
		500,
	);
	const results = sanitizeAskShareResults(record.results);
	if (!slug || !question || results.length === 0) return null;
	const queries = Array.isArray(record.queries)
		? record.queries
				.filter((item): item is string => typeof item === "string")
				.map((item) => clip(item, 100))
				.filter(Boolean)
				.slice(0, 6)
		: [];
	const fallbackQueries = Array.isArray(record.fallbackQueries)
		? record.fallbackQueries
				.filter((item): item is string => typeof item === "string")
				.map((item) => clip(item, 100))
				.filter(Boolean)
				.slice(0, 6)
		: [];
	const createdAt =
		typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
			? Math.max(0, Math.round(record.createdAt))
			: Date.now();
	return {
		slug,
		question,
		lookingFor: clip(
			typeof record.lookingFor === "string" ? record.lookingFor : "",
			160,
		),
		queries,
		fallbackQueries,
		summary: clip(
			typeof record.summary === "string" ? record.summary : "",
			1200,
		),
		results,
		model: clip(typeof record.model === "string" ? record.model : "", 120),
		...(typeof record.requestId === "string" && record.requestId.trim()
			? { requestId: clip(record.requestId, 80) }
			: {}),
		createdAt,
	};
}

export function askShareMatchesQuestion(
	snapshot: AiAskShareSnapshot,
	question: string,
): boolean {
	return (
		normalizeAskQuestionKey(snapshot.question) ===
		normalizeAskQuestionKey(question)
	);
}
