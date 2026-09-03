import type { AiDiscourseHit } from "./aiDiscourseHits";

export interface AiAskSessionEntry {
	/** Display wording (typo-corrected when available). */
	question: string;
	/** Exact text the user submitted, for cache matching on re-ask. */
	originalQuestion?: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	results: AiDiscourseHit[];
	model: string;
	reasoning: string;
	/** How the result set aligns with the question (from Gemini rerank). */
	summary?: string;
	/** Preferred public /ask/{shareSlug} theme from the model. */
	shareSlug?: string;
	at: number;
	/** Correlates with server askTelemetry / feedback. */
	requestId?: string;
	/** Set once the user rates this ask in-session. */
	feedback?: "up" | "down";
	/** Signed-in favorite — prefer keeping these when trimming history. */
	saved?: boolean;
}

const SESSION_KEY = "ai-ask-session-v1";
/** In-tab active Ask thread — restored when the user returns via Back. */
const ACTIVE_THREAD_KEY = "ai-ask-active-thread-v1";
/** Rolling history for signed-in (and local) Ask sessions. */
export const AI_ASK_SESSION_LIMIT = 20;
const ACTIVE_THREAD_TURN_LIMIT = 6;

const MAX_QUESTION = 500;
const MAX_LOOKING = 280;
const MAX_QUERY = 100;
const MAX_QUERIES = 6;
const MAX_REASONING = 4000;
const MAX_SUMMARY = 1200;
const MAX_RESULTS = 8;
const MAX_SNIPPET = 280;
const MAX_TITLE = 160;
const MAX_DESCRIPTION = 280;

export function normalizeAskQuestionKey(question: string): string {
	return question.replace(/\s+/g, " ").trim().toLowerCase();
}

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function defaultStorage(): Storage | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage;
}

/** One-time move from sessionStorage so prior tabs keep working. */
function migrateSessionStorageOnce(storage: Storage): void {
	if (typeof sessionStorage === "undefined") return;
	try {
		if (storage.getItem(SESSION_KEY)) return;
		const legacy = sessionStorage.getItem(SESSION_KEY);
		if (!legacy) return;
		storage.setItem(SESSION_KEY, legacy);
		sessionStorage.removeItem(SESSION_KEY);
	} catch {
		/* ignore */
	}
}

export function sanitizeAskHistoryEntry(
	raw: unknown,
): AiAskSessionEntry | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const question = clip(typeof record.question === "string" ? record.question : "", MAX_QUESTION);
	if (!question) return null;
	const resultsRaw = Array.isArray(record.results) ? record.results : [];
	const results: AiDiscourseHit[] = [];
	for (const item of resultsRaw.slice(0, MAX_RESULTS)) {
		if (!item || typeof item !== "object") continue;
		const hit = item as Record<string, unknown>;
		const slug = clip(typeof hit.slug === "string" ? hit.slug : "", 64);
		const href = clip(typeof hit.href === "string" ? hit.href : "", 120);
		if (!slug || !href) continue;
		results.push({
			slug,
			title: clip(typeof hit.title === "string" ? hit.title : slug, MAX_TITLE),
			description: clip(
				typeof hit.description === "string" ? hit.description : "",
				MAX_DESCRIPTION,
			),
			contentSnippet:
				typeof hit.contentSnippet === "string" && hit.contentSnippet
					? clip(hit.contentSnippet, MAX_SNIPPET)
					: null,
			referenceOnly: hit.referenceOnly === true,
			...(typeof hit.volpage === "string" && hit.volpage
				? { volpage: clip(hit.volpage, 80) }
				: {}),
			href,
		});
	}
	if (results.length === 0) return null;

	const queries = Array.isArray(record.queries)
		? record.queries
				.filter((query): query is string => typeof query === "string")
				.map((query) => clip(query, MAX_QUERY))
				.filter(Boolean)
				.slice(0, MAX_QUERIES)
		: [];
	const fallbackQueries = Array.isArray(record.fallbackQueries)
		? record.fallbackQueries
				.filter((query): query is string => typeof query === "string")
				.map((query) => clip(query, MAX_QUERY))
				.filter(Boolean)
				.slice(0, MAX_QUERIES)
		: [];
	const originalQuestion =
		typeof record.originalQuestion === "string"
			? clip(record.originalQuestion, MAX_QUESTION)
			: "";
	const at =
		typeof record.at === "number" && Number.isFinite(record.at)
			? Math.max(0, Math.round(record.at))
			: Date.now();

	return {
		question,
		...(originalQuestion ? { originalQuestion } : {}),
		lookingFor: clip(
			typeof record.lookingFor === "string" ? record.lookingFor : "",
			MAX_LOOKING,
		),
		queries,
		fallbackQueries,
		offTopic: record.offTopic === true,
		results,
		model: clip(typeof record.model === "string" ? record.model : "", 120),
		reasoning: clip(
			typeof record.reasoning === "string" ? record.reasoning : "",
			MAX_REASONING,
		),
		...(typeof record.summary === "string" && record.summary.trim()
			? { summary: clip(record.summary, MAX_SUMMARY) }
			: {}),
		...(typeof record.shareSlug === "string" && record.shareSlug.trim()
			? { shareSlug: clip(record.shareSlug.toLowerCase(), 48) }
			: {}),
		at,
		...(typeof record.requestId === "string" && record.requestId.trim()
			? { requestId: clip(record.requestId, 80) }
			: {}),
		...(record.feedback === "up" || record.feedback === "down"
			? { feedback: record.feedback }
			: {}),
		saved: record.saved === true,
	};
}

/**
 * Newest-first trim. When over the cap, drop unsaved entries from the end
 * before touching favorites.
 */
export function trimAskHistoryEntries(
	entries: readonly AiAskSessionEntry[],
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	const out = entries
		.map((entry) => sanitizeAskHistoryEntry(entry))
		.filter((entry): entry is AiAskSessionEntry => Boolean(entry));
	while (out.length > limit) {
		let dropIndex = -1;
		for (let i = out.length - 1; i >= 0; i--) {
			if (!out[i]?.saved) {
				dropIndex = i;
				break;
			}
		}
		if (dropIndex === -1) out.pop();
		else out.splice(dropIndex, 1);
	}
	return out;
}

export function sanitizeAskHistoryEntries(
	raw: unknown,
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	if (!Array.isArray(raw)) return [];
	const out: AiAskSessionEntry[] = [];
	for (const item of raw) {
		const entry = sanitizeAskHistoryEntry(item);
		if (!entry) continue;
		out.push(entry);
	}
	return trimAskHistoryEntries(out, limit);
}

export function readAiAskSession(
	storage: Storage | null | undefined = defaultStorage(),
): AiAskSessionEntry[] {
	if (!storage) return [];
	migrateSessionStorageOnce(storage);
	try {
		const raw = storage.getItem(SESSION_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as { entries?: unknown };
		return sanitizeAskHistoryEntries(parsed.entries);
	} catch {
		return [];
	}
}

export function writeAiAskSession(
	entries: readonly AiAskSessionEntry[],
	storage: Storage | null | undefined = defaultStorage(),
): void {
	if (!storage) return;
	try {
		storage.setItem(
			SESSION_KEY,
			JSON.stringify({
				entries: trimAskHistoryEntries(entries, AI_ASK_SESSION_LIMIT),
			}),
		);
	} catch {
		/* quota / private mode */
	}
}

function entryMatchesQuestionKey(
	entry: AiAskSessionEntry,
	key: string,
): boolean {
	if (!key) return false;
	if (normalizeAskQuestionKey(entry.question) === key) return true;
	const original = normalizeAskQuestionKey(entry.originalQuestion || "");
	return original.length > 0 && original === key;
}

/** Newest first. Replaces an older entry with the same question (display or original). */
export function upsertAiAskSessionEntry(
	entries: readonly AiAskSessionEntry[],
	entry: AiAskSessionEntry,
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	const clean = sanitizeAskHistoryEntry(entry);
	if (!clean) return trimAskHistoryEntries(entries, limit);
	const keys = [
		normalizeAskQuestionKey(clean.question),
		normalizeAskQuestionKey(clean.originalQuestion || ""),
	].filter(Boolean);
	const rest = entries.filter(
		(item) => !keys.some((key) => entryMatchesQuestionKey(item, key)),
	);
	return trimAskHistoryEntries([clean, ...rest], limit);
}

export function findAiAskSessionEntry(
	entries: readonly AiAskSessionEntry[],
	question: string,
): AiAskSessionEntry | undefined {
	const key = normalizeAskQuestionKey(question);
	if (!key) return undefined;
	return entries.find((entry) => entryMatchesQuestionKey(entry, key));
}

/** Drop history rows matching any of the given question strings. */
export function removeAskHistoryEntriesByQuestions(
	entries: readonly AiAskSessionEntry[],
	questions: readonly string[],
): AiAskSessionEntry[] {
	const keys = questions
		.map((question) => normalizeAskQuestionKey(question))
		.filter(Boolean);
	if (keys.length === 0) return [...entries];
	return entries.filter(
		(entry) => !keys.some((key) => entryMatchesQuestionKey(entry, key)),
	);
}

/** Merge lists by question key; the newer `at` wins. Newest first. */
export function mergeAskHistoryEntries(
	left: readonly AiAskSessionEntry[],
	right: readonly AiAskSessionEntry[],
	limit = AI_ASK_SESSION_LIMIT,
): AiAskSessionEntry[] {
	const byKey = new Map<string, AiAskSessionEntry>();
	const consider = (raw: AiAskSessionEntry): void => {
		const entry = sanitizeAskHistoryEntry(raw);
		if (!entry) return;
		const keys = [
			normalizeAskQuestionKey(entry.question),
			normalizeAskQuestionKey(entry.originalQuestion || ""),
		].filter(Boolean);
		let prior: AiAskSessionEntry | undefined;
		for (const key of keys) {
			const existing = byKey.get(key);
			if (existing && (!prior || existing.at >= prior.at)) prior = existing;
		}
		if (prior && prior.at > entry.at) return;
		if (prior) {
			for (const [key, value] of byKey) {
				if (value === prior) byKey.delete(key);
			}
		}
		for (const key of keys) byKey.set(key, entry);
	};
	for (const entry of left) consider(entry);
	for (const entry of right) consider(entry);
	return trimAskHistoryEntries(
		[...new Set(byKey.values())].sort((a, b) => b.at - a.at),
		limit,
	);
}

export function formatAskRelativeTime(at: number, now = Date.now()): string {
	if (!Number.isFinite(at) || at <= 0) return "";
	const delta = Math.max(0, now - at);
	const mins = Math.floor(delta / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 48) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 14) return `${days}d ago`;
	try {
		return new Date(at).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
	} catch {
		return "";
	}
}

function sessionStorageOrNull(): Storage | null {
	if (typeof sessionStorage === "undefined") return null;
	return sessionStorage;
}

/**
 * Remember the open Ask thread so Back from a discourse restores it on
 * `/search?mode=ai` without forcing every Ask into a public /ask/:slug URL.
 */
export function writeActiveAskThread(
	entries: readonly AiAskSessionEntry[],
	storage: Storage | null | undefined = sessionStorageOrNull(),
): void {
	if (!storage) return;
	const turns = entries
		.map((entry) => sanitizeAskHistoryEntry(entry))
		.filter((entry): entry is AiAskSessionEntry => Boolean(entry))
		.slice(-ACTIVE_THREAD_TURN_LIMIT);
	if (turns.length === 0) {
		clearActiveAskThread(storage);
		return;
	}
	try {
		storage.setItem(
			ACTIVE_THREAD_KEY,
			JSON.stringify({ turns, at: Date.now() }),
		);
	} catch {
		/* quota / private mode */
	}
}

export function readActiveAskThread(
	storage: Storage | null | undefined = sessionStorageOrNull(),
): AiAskSessionEntry[] {
	if (!storage) return [];
	try {
		const raw = storage.getItem(ACTIVE_THREAD_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as { turns?: unknown };
		return sanitizeAskHistoryEntries(
			parsed.turns,
			ACTIVE_THREAD_TURN_LIMIT,
		);
	} catch {
		return [];
	}
}

export function clearActiveAskThread(
	storage: Storage | null | undefined = sessionStorageOrNull(),
): void {
	if (!storage) return;
	try {
		storage.removeItem(ACTIVE_THREAD_KEY);
	} catch {
		/* ignore */
	}
}
