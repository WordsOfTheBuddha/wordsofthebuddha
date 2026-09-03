import { compactDiscourseIdQuery } from "./searchRanking";

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
			seeds: ["satipaṭṭhāna", "ānāpānasati", "sati"],
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
