import type { AiDiscourseHit } from "./aiDiscourseHits";
import { normalizeAskQuestionKey } from "./aiAskSession";
import {
	RESEARCH_REPORT_MAX_CHARS,
	stripResearchSourcesSection,
} from "./aiAskResearchReport";
import { normalizeAskSummaryProse } from "./linkifyAskSummary";

export const ASK_SHARE_SLUG_MIN = 8;
export const ASK_SHARE_SLUG_MAX = 48;
export const ASK_SHARE_COLLECTION = "askShares";
/** Last-resort numeric walk after date / hour suffixes are taken. */
export const ASK_SHARE_SLUG_SUFFIX_LIMIT = 1000;

const ASK_SHARE_SLUG_MONTHS = [
	"jan",
	"feb",
	"mar",
	"apr",
	"may",
	"jun",
	"jul",
	"aug",
	"sep",
	"oct",
	"nov",
	"dec",
] as const;

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
	research?: boolean;
	report?: string;
	reasoning?: string;
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
	research?: boolean;
	report?: string;
	reasoning?: string;
	candidateCount?: number;
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
	report?: string;
}

const ASK_SHARE_THREAD_LIMIT = 6;
/** Match Ask display cap (`AI_RERANK_MAX_LIMIT`). */
export const ASK_SHARE_RESULT_MAX = 50;
/** Match Research selected-set cap (`RESEARCH_RERANK_HARD_LIMIT`). */
export const RESEARCH_SHARE_RESULT_MAX = 160;

/** Research snapshots carry `research: true` and/or a report body. */
export function isAskShareResearchInput(raw: unknown): boolean {
	if (!raw || typeof raw !== "object") return false;
	const record = raw as Record<string, unknown>;
	return (
		record.research === true ||
		(typeof record.report === "string" && Boolean(record.report.trim()))
	);
}

export function askShareResultMax(raw: unknown): number {
	return isAskShareResearchInput(raw)
		? RESEARCH_SHARE_RESULT_MAX
		: ASK_SHARE_RESULT_MAX;
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

/** Clip `base-suffix` so the result stays a valid public slug. */
export function askShareSlugWithTextSuffix(
	base: string,
	suffix: string,
): string {
	const cleanSuffix = suffix
		.toLowerCase()
		.replace(/^-+|-+$/g, "")
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/-{2,}/g, "-");
	const root = normalizeAskShareSlug(base) || base;
	if (!cleanSuffix) return root;
	const budget = ASK_SHARE_SLUG_MAX - cleanSuffix.length - 1;
	const trimmed = root
		.slice(0, Math.max(ASK_SHARE_SLUG_MIN, budget))
		.replace(/-+$/g, "");
	const candidate = `${trimmed}-${cleanSuffix}`;
	return normalizeAskShareSlug(candidate) || candidate;
}

/** UTC `sep-10-2026` — collision suffix for a distinct snapshot. */
export function formatAskShareSlugUtcDate(now = Date.now()): string {
	const date = new Date(now);
	const month = ASK_SHARE_SLUG_MONTHS[date.getUTCMonth()] || "jan";
	return `${month}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

/** UTC `sep-10-2026-14h` when the date suffix is already taken that day. */
export function formatAskShareSlugUtcHour(now = Date.now()): string {
	const date = new Date(now);
	return `${formatAskShareSlugUtcDate(now)}-${date.getUTCHours()}h`;
}

/** `base-2`, `base-3`, … clipped so the result stays a valid public slug. */
export function askShareSlugWithNumericSuffix(
	base: string,
	n: number,
): string {
	const root = normalizeAskShareSlug(base) || base;
	if (!Number.isFinite(n) || n < 2) return root;
	return askShareSlugWithTextSuffix(root, String(Math.floor(n)));
}

/** n=1 is the unsuffixed theme slug; n=2 is `-2`, and so on. */
export function askShareSlugCandidate(base: string, n: number): string {
	const root = normalizeAskShareSlug(base) || base;
	if (!Number.isFinite(n) || n <= 1) return root;
	return askShareSlugWithNumericSuffix(root, n);
}

/**
 * Clean theme, then `sep-10-2026`, then `sep-10-2026-14h`.
 * Numeric `-2` is a last resort after these (see uniquify).
 */
export function askShareSlugCollisionCandidates(
	base: string,
	now = Date.now(),
): string[] {
	const root = normalizeAskShareSlug(base) || base;
	const dated = askShareSlugWithTextSuffix(root, formatAskShareSlugUtcDate(now));
	const hourly = askShareSlugWithTextSuffix(root, formatAskShareSlugUtcHour(now));
	const out = [root];
	if (dated && !out.includes(dated)) out.push(dated);
	if (hourly && !out.includes(hourly)) out.push(hourly);
	return out;
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
	if ((existing.report || "").trim() !== (incoming.report || "").trim()) {
		return false;
	}
	return (
		normalizeAskSummaryProse(existing.summary || "") ===
		normalizeAskSummaryProse(incoming.summary || "")
	);
}

/**
 * Reuse a slug only for the same snapshot; otherwise append a UTC date
 * (`-sep-10-2026`), then hour (`-sep-10-2026-14h`), then `-2`, `-3`, …
 * `getExisting` may be sync (tests) or async (Firestore).
 */
export async function uniquifyAskShareSlug<T extends AskShareIdentityInput>(
	preferred: string | undefined | null,
	incoming: AskShareIdentityInput,
	getExisting: (slug: string) => T | null | Promise<T | null>,
	lookingFor = "",
	options?: { now?: number },
): Promise<{ slug: string; existing: T | null }> {
	const now = options?.now ?? Date.now();
	const base = resolveAskShareSlug(
		preferred,
		lookingFor,
		incoming.question,
	);
	const seen = new Set<string>();
	const trySlug = async (
		candidate: string,
	): Promise<{ slug: string; existing: T | null } | null> => {
		if (!candidate || seen.has(candidate)) return null;
		seen.add(candidate);
		const existing = await getExisting(candidate);
		if (!existing) return { slug: candidate, existing: null };
		if (askShareIsSameSnapshot(existing, incoming)) {
			return { slug: candidate, existing };
		}
		return null;
	};

	for (const candidate of askShareSlugCollisionCandidates(base, now)) {
		const hit = await trySlug(candidate);
		if (hit) return hit;
	}
	for (let n = 2; n <= ASK_SHARE_SLUG_SUFFIX_LIMIT; n++) {
		const hit = await trySlug(askShareSlugWithNumericSuffix(base, n));
		if (hit) return hit;
	}
	return {
		slug: askShareSlugWithNumericSuffix(base, now),
		existing: null,
	};
}

export function askSharePath(
	slug: string,
	options?: { research?: boolean },
): string {
	const clean = normalizeAskShareSlug(slug) || slug.trim().toLowerCase();
	return options?.research ? `/research/${clean}` : `/ask/${clean}`;
}

/** Redirect when a public share URL is missing or on the wrong lane prefix. */
export function askSharePageRedirect(
	pathname: string,
	share: Pick<AiAskShareSnapshot, "slug" | "research"> | null,
): string | null {
	const path = pathname.replace(/\/+$/, "") || "/";
	const researchUrl = /^\/research\/[^/]+$/.test(path);
	const askUrl = /^\/ask\/[^/]+$/.test(path);
	if (!share) {
		if (researchUrl) return "/search?mode=research";
		if (askUrl || path.startsWith("/shared-ask/")) return "/search?mode=ask";
		return null;
	}
	const canonical = askSharePath(share.slug, {
		research: share.research === true,
	});
	if (researchUrl && !share.research) return canonical;
	if (askUrl && share.research) return canonical;
	return null;
}

function shareSeoPlainText(markdown: string): string {
	return stripResearchSourcesSection(markdown)
		.replace(/^#{1,3}\s+/gm, "")
		.replace(/[*_>`]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** Title and description for a public share page. */
export function askShareSeo(
	share: Pick<
		AiAskShareSnapshot,
		"question" | "summary" | "lookingFor" | "research" | "report"
	>,
): { title: string; description: string } {
	if (share.research) {
		const fromReport = shareSeoPlainText(share.report || "");
		return {
			title: `${share.question.slice(0, 60)} · Research Report`,
			description: (
				fromReport ||
				share.lookingFor ||
				"Shared research report based on the Words of the Buddha."
			).slice(0, 160),
		};
	}
	return {
		title: `${share.question.slice(0, 80)} · Ask`,
		description: (
			share.summary ||
			share.lookingFor ||
			"Shared Ask results from the discourses of the Buddha."
		).slice(0, 160),
	};
}

export function sanitizeAskShareResults(
	raw: unknown,
	max = ASK_SHARE_RESULT_MAX,
): AiDiscourseHit[] {
	if (!Array.isArray(raw)) return [];
	const limit = Number.isFinite(max)
		? Math.max(0, Math.floor(max))
		: ASK_SHARE_RESULT_MAX;
	const out: AiDiscourseHit[] = [];
	for (const item of raw.slice(0, limit)) {
		if (!item || typeof item !== "object") continue;
		const hit = item as Record<string, unknown>;
		const slug = clip(typeof hit.slug === "string" ? hit.slug : "", 64);
		const rawHref = typeof hit.href === "string" ? hit.href.trim() : "";
		const href = clip(rawHref || (slug ? `/${slug}` : ""), 120);
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
	const research = isAskShareResearchInput(record);
	const results = sanitizeAskShareResults(
		record.results,
		askShareResultMax(record),
	);
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
		summary:
			research && typeof record.report === "string"
				? clip(
						(record.summary as string) || "",
						4800,
					)
				: normalizeAskSummaryProse(
						typeof record.summary === "string" ? record.summary : "",
						4800,
					),
		results,
		model: clip(typeof record.model === "string" ? record.model : "", 120),
		...(research ? { research: true } : {}),
		...(typeof record.report === "string" && record.report.trim()
			? {
					report: record.report
						.replace(/\r\n/g, "\n")
						.trim()
						.slice(0, RESEARCH_REPORT_MAX_CHARS),
				}
			: {}),
		...(typeof record.reasoning === "string" && record.reasoning.trim()
			? {
					reasoning: record.reasoning
						.replace(/\r\n/g, "\n")
						.trim()
						.slice(0, 4000),
				}
			: {}),
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
		...(head.research ? { research: true } : {}),
		...(head.report ? { report: head.report } : {}),
		...(head.reasoning ? { reasoning: head.reasoning } : {}),
		...(head.candidateCount ? { candidateCount: head.candidateCount } : {}),
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
			...(share.research ? { research: true } : {}),
			...(share.report ? { report: share.report } : {}),
			...(share.reasoning ? { reasoning: share.reasoning } : {}),
			...(share.candidateCount
				? { candidateCount: share.candidateCount }
				: {}),
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
