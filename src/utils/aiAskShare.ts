import type { AiDiscourseHit } from "./aiDiscourseHits";
import { normalizeAskQuestionKey } from "./aiAskSession";
import { normalizeAskSummaryProse } from "./linkifyAskSummary";

export const ASK_SHARE_SLUG_MIN = 8;
export const ASK_SHARE_SLUG_MAX = 48;
export const ASK_SHARE_COLLECTION = "askShares";
/** Walk `-2`, `-3`, … this many times before a timestamp fallback. */
export const ASK_SHARE_SLUG_SUFFIX_LIMIT = 1000;

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

/** One turn inside a shared conversation (no nested thread). */
export interface AiAskShareTurn {
	question: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	summary: string;
	results: AiDiscourseHit[];
	model: string;
	requestId?: string;
	candidateCount?: number;
}

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
	/**
	 * Full conversation through the shared turn (oldest → newest).
	 * When absent, the top-level fields are the only turn.
	 */
	thread?: AiAskShareTurn[];
}

/** Fields that distinguish one public Ask snapshot from another. */
export interface AskShareIdentityInput {
	question: string;
	summary: string;
	results: readonly { slug: string }[];
	requestId?: string;
}

const ASK_SHARE_THREAD_LIMIT = 6;

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

/** `base-2`, `base-3`, … clipped so the result stays a valid public slug. */
export function askShareSlugWithNumericSuffix(
	base: string,
	n: number,
): string {
	const root = normalizeAskShareSlug(base) || base;
	if (!Number.isFinite(n) || n < 2) return root;
	const suffix = String(Math.floor(n));
	const budget = ASK_SHARE_SLUG_MAX - suffix.length - 1;
	const trimmed = root
		.slice(0, Math.max(ASK_SHARE_SLUG_MIN, budget))
		.replace(/-+$/g, "");
	const candidate = `${trimmed}-${suffix}`;
	return normalizeAskShareSlug(candidate) || candidate;
}

/** n=1 is the unsuffixed theme slug; n=2 is `-2`, and so on. */
export function askShareSlugCandidate(base: string, n: number): string {
	const root = normalizeAskShareSlug(base) || base;
	if (!Number.isFinite(n) || n <= 1) return root;
	return askShareSlugWithNumericSuffix(root, n);
}

export function askShareResultFingerprint(
	results: readonly { slug?: string }[],
): string {
	return results
		.map((item) =>
			typeof item.slug === "string" ? item.slug.trim().toLowerCase() : "",
		)
		.filter(Boolean)
		.join("\n");
}

/**
 * Same public Ask: this question, this summary, and this result set.
 * Theme slug matches are not enough — those are collisions.
 */
export function askShareIsSameSnapshot(
	existing: AskShareIdentityInput,
	incoming: AskShareIdentityInput,
): boolean {
	if (!askShareMatchesQuestion(existing, incoming.question)) {
		return false;
	}
	if (
		askShareResultFingerprint(existing.results) !==
		askShareResultFingerprint(incoming.results)
	) {
		return false;
	}
	return (
		normalizeAskSummaryProse(existing.summary || "") ===
		normalizeAskSummaryProse(incoming.summary || "")
	);
}

/**
 * Reuse a slug only for the same snapshot; otherwise append `-2`, `-3`, …
 * `getExisting` may be sync (tests) or async (Firestore).
 */
export async function uniquifyAskShareSlug<T extends AskShareIdentityInput>(
	preferred: string | undefined | null,
	incoming: AskShareIdentityInput,
	getExisting: (slug: string) => T | null | Promise<T | null>,
	lookingFor = "",
): Promise<{ slug: string; existing: T | null }> {
	const base = resolveAskShareSlug(
		preferred,
		lookingFor,
		incoming.question,
	);
	for (let n = 1; n <= ASK_SHARE_SLUG_SUFFIX_LIMIT; n++) {
		const candidate = askShareSlugCandidate(base, n);
		const existing = await getExisting(candidate);
		if (!existing) return { slug: candidate, existing: null };
		if (askShareIsSameSnapshot(existing, incoming)) {
			return { slug: candidate, existing };
		}
	}
	return {
		slug: askShareSlugWithNumericSuffix(base, Date.now()),
		existing: null,
	};
}

export function askSharePath(slug: string): string {
	return `/ask/${slug}`;
}

export function sanitizeAskShareResults(raw: unknown): AiDiscourseHit[] {
	if (!Array.isArray(raw)) return [];
	const out: AiDiscourseHit[] = [];
	for (const item of raw.slice(0, 50)) {
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

export function sanitizeAskShareTurn(raw: unknown): AiAskShareTurn | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const question = clip(
		typeof record.question === "string" ? record.question : "",
		500,
	);
	const results = sanitizeAskShareResults(record.results);
	if (!question || results.length === 0) return null;
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
	return {
		question,
		lookingFor: clip(
			typeof record.lookingFor === "string" ? record.lookingFor : "",
			160,
		),
		queries,
		fallbackQueries,
		summary: normalizeAskSummaryProse(
			typeof record.summary === "string" ? record.summary : "",
			4800,
		),
		results,
		model: clip(typeof record.model === "string" ? record.model : "", 120),
		...(typeof record.requestId === "string" && record.requestId.trim()
			? { requestId: clip(record.requestId, 80) }
			: {}),
		...(typeof record.candidateCount === "number" &&
		Number.isFinite(record.candidateCount) &&
		record.candidateCount > 0
			? {
					candidateCount: Math.min(
						2000,
						Math.floor(record.candidateCount),
					),
				}
			: {}),
	};
}

export function sanitizeAskShareSnapshot(
	raw: unknown,
): AiAskShareSnapshot | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const slug = normalizeAskShareSlug(
		typeof record.slug === "string" ? record.slug : "",
	);
	const head = sanitizeAskShareTurn(record);
	if (!slug || !head) return null;
	const createdAt =
		typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
			? Math.max(0, Math.round(record.createdAt))
			: Date.now();
	const thread = Array.isArray(record.thread)
		? record.thread
				.map((item) => sanitizeAskShareTurn(item))
				.filter((item): item is AiAskShareTurn => Boolean(item))
				.slice(0, ASK_SHARE_THREAD_LIMIT)
		: [];
	return {
		slug,
		question: head.question,
		lookingFor: head.lookingFor,
		queries: head.queries,
		fallbackQueries: head.fallbackQueries,
		summary: head.summary,
		results: head.results,
		model: head.model,
		...(head.requestId ? { requestId: head.requestId } : {}),
		createdAt,
		...(thread.length > 1 ? { thread } : {}),
	};
}

/** Turns to show for a public share (full prefix thread when present). */
export function askShareTurnsForRestore(
	share: AiAskShareSnapshot,
): AiAskShareTurn[] {
	if (share.thread && share.thread.length > 1) {
		return share.thread;
	}
	return [
		{
			question: share.question,
			lookingFor: share.lookingFor,
			queries: share.queries,
			fallbackQueries: share.fallbackQueries,
			summary: share.summary,
			results: share.results,
			model: share.model,
			...(share.requestId ? { requestId: share.requestId } : {}),
		},
	];
}

export function askShareMatchesQuestion(
	snapshot: Pick<AiAskShareSnapshot, "question">,
	question: string,
): boolean {
	return (
		normalizeAskQuestionKey(snapshot.question) ===
		normalizeAskQuestionKey(question)
	);
}
