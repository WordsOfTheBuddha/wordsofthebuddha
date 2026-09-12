import { inflectionStemKey } from "./paliInflectionUtils";
import { compactDiscourseIdQuery, normalizeForComparison } from "./searchRanking";
import { transformId } from "./transformId";

/** Drop operators so a missed exact/collection query can still find discourses. */
export function relaxSearchQuery(query: string): string {
	let text = query.replace(/\s+/g, " ").trim();
	if (!text) return "";
	text = text.replace(/^(?:title|content|contentPali):/gi, "");
	text = text.replace(/\s(?:title|content|contentPali):/gi, " ");
	text = text.replace(/(^|\s)\^[A-Za-z0-9]+/g, "$1");
	text = text.replace(/(^|\s)!/g, "$1");
	text = text.replace(/\|/g, " ");
	text = text.replace(/["'`]+/g, " ");
	return text.replace(/\s+/g, " ").trim();
}

/**
 * Normalize a rewrite query before search.
 * Spaced IDs from the catalog ("MN 109", "SN 22.82") become compact slugs.
 */
export function normalizeAiSearchQuery(query: string): string {
	const trimmed = query.replace(/\s+/g, " ").trim();
	if (!trimmed) return "";
	const compact = compactDiscourseIdQuery(trimmed);
	return compact || trimmed;
}

/** Prefixed discourse ID query (mn109 / SN 22.82), not a bare numeral. */
export function isPrefixedAiDiscourseIdQuery(query: string): boolean {
	const compact = compactDiscourseIdQuery(query.replace(/\s+/g, " ").trim());
	return Boolean(compact && /^[a-z]{2,5}\d/i.test(compact));
}

function queryOrParts(query: string): string[] {
	return query
		.split("|")
		.map((part) => part.replace(/\s+/g, " ").trim())
		.filter(Boolean);
}

/**
 * Prefixed discourse IDs named in a query, including OR parts
 * ("SN 12.49 | SN 48.9" → sn12.49, sn48.9).
 */
export function prefixedAiDiscourseIdsInQuery(query: string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const part of queryOrParts(query)) {
		if (!isPrefixedAiDiscourseIdQuery(part)) continue;
		const compact = normalizeAiSearchQuery(part);
		const key = compact.toLowerCase();
		if (!compact || seen.has(key)) continue;
		seen.add(key);
		out.push(compact);
	}
	return out;
}

export function prefixedAiDiscourseIdsInQueries(
	queries: readonly string[] = [],
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const query of queries) {
		for (const id of prefixedAiDiscourseIdsInQuery(query)) {
			const key = id.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(id);
		}
	}
	return out;
}

/** True when every OR-part is a prefixed discourse ID (direct request). */
export function isPrefixedAiDiscourseIdOnlyQuery(query: string): boolean {
	const parts = queryOrParts(query);
	return (
		parts.length > 0 && parts.every((part) => isPrefixedAiDiscourseIdQuery(part))
	);
}

const NAMED_DISCOURSE_PREFIX =
	"mn|dn|sn|an|dhp|ud|iti|snp|kp|thag|thig|vv|pv|ja|bv|cp|mil";
const NAMED_DISCOURSE_ID_IN_TEXT = new RegExp(
	`\\b(${NAMED_DISCOURSE_PREFIX})\\s*(\\d+(?:\\.\\d+)*)\\b`,
	"gi",
);
const MAX_NAMED_DISCOURSE_IDS = 12;

/**
 * Unique prefixed discourse IDs in prose (MN 70, SN 12.49, SN48.9).
 * Uncapped — report stats need the full citation set.
 */
export function uniquePrefixedDiscourseIdsInText(text: string): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const source = (text || "").replace(/\u2019/g, "'");
	for (const match of source.matchAll(NAMED_DISCOURSE_ID_IN_TEXT)) {
		const compact = `${(match[1] || "").toLowerCase()}${match[2] || ""}`;
		if (!isPrefixedAiDiscourseIdQuery(compact)) continue;
		const key = compact.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(compact);
	}
	return out;
}

/**
 * Prefixed discourse IDs the person wrote in prose (MN 70, SN 12.49, SN48.9).
 * Harness-side — does not depend on the planner putting IDs in queries[].
 */
export function prefixedAiDiscourseIdsInText(text: string): string[] {
	return uniquePrefixedDiscourseIdsInText(text).slice(
		0,
		MAX_NAMED_DISCOURSE_IDS,
	);
}

/** Named IDs from the question first, then any ID-only search chips. */
export function collectDirectDiscourseIds(input: {
	question?: string;
	queries?: readonly string[];
}): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const add = (id: string) => {
		const key = id.toLowerCase();
		if (!key || seen.has(key)) return;
		seen.add(key);
		out.push(id);
	};
	for (const id of prefixedAiDiscourseIdsInText(input.question || "")) add(id);
	for (const id of prefixedAiDiscourseIdsInQueries(input.queries || [])) add(id);
	return out;
}

/** Reader-facing ID list for the process strip (SN 12.49, MN 70). */
export function formatDirectDiscourseIds(
	input: { question?: string; queries?: readonly string[] },
	max = 8,
): string {
	return collectDirectDiscourseIds(input)
		.slice(0, Math.max(1, max))
		.map((id) => transformId(id))
		.filter(Boolean)
		.join(", ");
}

/** @deprecated use formatDirectDiscourseIds */
export function formatPrefixedDiscourseIds(
	queries: readonly string[] = [],
	max = 8,
): string {
	return formatDirectDiscourseIds({ queries }, max);
}

const MAX_USEFUL_QUERY_WORDS = 8;
const MAX_USEFUL_QUERY_CHARS = 72;

/**
 * Full-sentence / rambling queries rarely hit well in this search engine.
 * Discourse IDs and short topical phrases are fine.
 */
export function isWeakAiSearchQuery(query: string): boolean {
	const normalized = normalizeAiSearchQuery(query);
	if (!normalized) return true;
	if (isPrefixedAiDiscourseIdQuery(normalized)) return false;
	if (normalized.length > MAX_USEFUL_QUERY_CHARS) return true;
	const words = normalized.split(/\s+/).filter(Boolean);
	return words.length > MAX_USEFUL_QUERY_WORDS;
}

const TOPICAL_STOPWORDS = new Set([
	"a",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"by",
	"for",
	"from",
	"how",
	"i",
	"i'm",
	"im",
	"in",
	"into",
	"is",
	"it",
	"its",
	"like",
	"me",
	"my",
	"not",
	"of",
	"on",
	"or",
	"other",
	"please",
	"that",
	"the",
	"these",
	"there",
	"this",
	"those",
	"to",
	"want",
	"what",
	"when",
	"where",
	"which",
	"who",
	"why",
	"with",
	"would",
	"you",
	"your",
	"about",
	"looking",
	"find",
	"discourse",
	"discourses",
	"sutta",
	"suttas",
	"teach",
	"teaches",
	"teaching",
	"teachings",
	"included",
	"particular",
	"also",
	"very",
	"all",
	"yet",
	"them",
	"they",
	"their",
	"ones",
]);

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Inflected / bracket lemmas shorter than this stay exact-match only. */
const MIN_NAMED_STEM_LEN = 8;

/**
 * Drop `|example|` bodies so words inside a demonstrated syntax are not
 * treated as search terms. Keep `[lemma]` markers.
 */
export function questionTextForTermMatch(question: string): string {
	const text = question.replace(/\s+/g, " ").trim();
	if (!text) return "";
	return text.replace(/\|([^|\n]*)\|/g, (_all, inner: string) => {
		const lemmas = [...String(inner).matchAll(/\[([^\]\n]{2,80})\]/g)]
			.map((match) => match[1].trim())
			.filter(Boolean)
			.join(" ");
		return lemmas ? ` ${lemmas} ` : " ";
	});
}

function questionLemmaNorms(question: string): string[] {
	const text = questionTextForTermMatch(question);
	if (!text) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	const add = (raw: string) => {
		const norm = normalizeForComparison(raw.replace(/\s+/g, " ").trim());
		if (norm.length < 4 || seen.has(norm)) return;
		seen.add(norm);
		out.push(norm);
	};
	for (const match of text.matchAll(/\[([^\]\n]{2,80})\]/g)) {
		add(match[1]);
	}
	for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
		add(match[0]);
	}
	return out;
}

/** Bare `^AN` / `^SN` collection chips — they flood the fused pool. */
export function isBareCollectionFilterQuery(query: string): boolean {
	return /^\^[A-Za-z]{2,5}$/.test(query.replace(/\s+/g, " ").trim());
}

/**
 * True when `query` occurs as its own term in the question — not as a stem
 * inside a longer compound (`vimutti` in `vimuttikkhandho`).
 */
export function queryOccursAsTermInQuestion(
	query: string,
	question: string,
): boolean {
	const q = normalizeAiSearchQuery(query).replace(/\s+/g, " ").trim().toLowerCase();
	if (!q || q.length < 4) return false;
	const words = q.split(/\s+/).filter(Boolean);
	if (words.length === 1 && TOPICAL_STOPWORDS.has(words[0])) return false;
	const text = questionTextForTermMatch(question);
	if (!text) return false;
	const pattern = new RegExp(
		`(^|[^\\p{L}\\p{N}])${escapeRegex(q)}(?=[^\\p{L}\\p{N}]|$)`,
		"iu",
	);
	if (pattern.test(text)) return true;
	if (words.length !== 1) return false;
	const qStem = inflectionStemKey(normalizeForComparison(q));
	if (qStem.length < MIN_NAMED_STEM_LEN) return false;
	return questionLemmaNorms(question).some(
		(token) => inflectionStemKey(token) === qStem,
	);
}

/**
 * Lexical-target searches for tagging. Prefer `termQueries` from the planner;
 * otherwise fall back to queries that actually occur in the question.
 */
export function namedTermSearchQueries(
	question: string,
	queries: readonly string[],
	termQueries?: readonly string[],
): string[] {
	const allowed = new Set<string>();
	for (const query of queries) {
		const normalized = normalizeAiSearchQuery(query);
		if (normalized) allowed.add(normalized.toLowerCase());
	}
	const fromPlanner: string[] = [];
	const seen = new Set<string>();
	for (const query of termQueries || []) {
		const normalized = normalizeAiSearchQuery(query);
		if (!normalized || isBareCollectionFilterQuery(normalized)) continue;
		const key = normalized.toLowerCase();
		if (!allowed.has(key) || seen.has(key)) continue;
		seen.add(key);
		fromPlanner.push(normalized);
	}
	if (fromPlanner.length > 0) return fromPlanner;
	const out: string[] = [];
	for (const query of queries) {
		const normalized = normalizeAiSearchQuery(query);
		if (!normalized) continue;
		const key = normalized.toLowerCase();
		if (seen.has(key)) continue;
		if (!queryOccursAsTermInQuestion(normalized, question)) continue;
		seen.add(key);
		out.push(normalized);
	}
	return out;
}

/** Simple speech/typo repairs before topical fallback extraction. */
const TOPICAL_REPAIRS: readonly [RegExp, string][] = [
	[/\bmind\s*full?ness\s+coins\b/gi, "mindfulness kinds"],
	[/\bmindfulness\s+coins\b/gi, "mindfulness kinds"],
	[/\bmind\s*full?ness\b/gi, "mindfulness"],
	[/\bmind\s*fulless\b/gi, "mindfulness"],
	[/\bdis\s*courses?\b/gi, "discourses"],
	[/\bbud+ha\b/gi, "Buddha"],
	[/\bbhik+u+s?\b/gi, "bhikkhus"],
	[/\bweeknds?\b/gi, "bhikkhus"],
];

/** Practice-cluster seeds when topical fallback detects a theme. */
const THEME_CLUSTER_SEEDS: readonly { match: RegExp; seeds: readonly string[] }[] =
	[
		{
			match: /\bmindfulness\b|\bsati\b|\bsatipa/i,
			seeds: ["mindfulness", "satipaṭṭhāna", "ānāpānasati"],
		},
	];

export function repairCommonAskTypos(text: string): string {
	let out = text.replace(/\s+/g, " ").trim();
	for (const [pattern, replacement] of TOPICAL_REPAIRS) {
		out = out.replace(pattern, replacement);
	}
	return out.replace(/\s+/g, " ").trim();
}

/**
 * When the model returns no usable short queries, derive a few topical terms
 * from the question instead of searching the whole sentence.
 */
export function topicalFallbackQueries(
	question: string,
	limit = 3,
): string[] {
	const repaired = repairCommonAskTypos(question).toLowerCase();
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (term: string) => {
		const t = term.replace(/\s+/g, " ").trim();
		if (!t || seen.has(t) || out.length >= limit) return;
		seen.add(t);
		out.push(t);
	};
	for (const cluster of THEME_CLUSTER_SEEDS) {
		if (cluster.match.test(repaired)) {
			for (const seed of cluster.seeds) push(seed);
		}
	}
	const words = repaired
		.replace(/[^a-z0-9āīūṅñṭḍṇḷṃ\s'-]/gi, " ")
		.split(/\s+/)
		.map((word) => word.replace(/^'+|'+$/g, ""))
		.filter(
			(word) =>
				word.length > 2 &&
				!TOPICAL_STOPWORDS.has(word) &&
				!/^\d+$/.test(word),
		);
	for (let i = 0; i < words.length - 1 && out.length < limit; i++) {
		const bigram = `${words[i]} ${words[i + 1]}`;
		// Prefer content-ish pairs (skip helper+noun noise somewhat by length).
		if (words[i].length < 4 && words[i + 1].length < 4) continue;
		push(bigram);
	}
	for (const word of words) {
		if (out.length >= limit) break;
		push(word);
	}
	return out.slice(0, limit);
}
