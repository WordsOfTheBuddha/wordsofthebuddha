import type { OpenRouterChatMessage } from "./openrouter";
import { getAiLibraryHintsText } from "./aiLibraryHintsServer";
import { extractJsonObject } from "./extractJsonObject";
import {
	ASK_HISTORY_MAX_TURNS,
	ASK_HISTORY_PARSE_CAP,
	ASK_HISTORY_SUMMARY_MAX,
	clipAskHistoryTurns,
	collectAskHistoryShownSlugs,
	formatAskAlreadyShownIds,
	shouldExcludeAlreadyShownAskHits,
	type AiAskFollowUpHistoryTurn,
} from "./aiAskHistory";
import { normalizeAskShareSlug } from "./aiAskShare";
import {
	isWeakAiSearchQuery,
	normalizeAiSearchQuery,
	isBareCollectionFilterQuery,
	repairCommonAskTypos,
	topicalFallbackQueries,
} from "./aiSearchQuery";

export { extractJsonObject };

export type AiRewriteHistoryTurn = AiAskFollowUpHistoryTurn;

/** Soft cap for prior-turn summary text sent as Ask conversation context. */
export const AI_ASK_HISTORY_SUMMARY_MAX = ASK_HISTORY_SUMMARY_MAX;
/** How many already-shown slugs to mention in follow-up rewrite context. */
const HISTORY_SHOWN_SLUGS = 50;

export function clipAiHistorySummary(
	value: string,
	max = AI_ASK_HISTORY_SUMMARY_MAX,
): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Planner classification of whether prior result IDs should be blacklisted. */
export type AiAskFollowUpIntent = "diversify" | "refine" | "new";

export interface AiRewritePlan {
	/** Lightly cleaned wording for display (typos / speech errors fixed). */
	correctedQuestion: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	/**
	 * Subset of `queries` the planner marked as lexical targets (Pāli
	 * compounds, exact terms). Code tags those hits for the ranker.
	 */
	termQueries?: string[];
	offTopic: boolean;
	/** Public URL slug for /ask/{shareSlug} — theme of the question. */
	shareSlug?: string;
	/** Exact person-page slugs from the Person pages list when clearly about that figure. */
	personSlugs?: string[];
	/** True when we had to synthesize short queries because the model plan was unusable. */
	degraded?: boolean;
	/** Why the plan was degraded — used to decide whether to try another planner. */
	degradedReason?: "no_json" | "weak_queries" | "offtopic_override";
	/**
	 * Notes for the later ranking step and the thinking writer (facets to
	 * cover, how to treat the question, what to avoid). Written by the
	 * planning model. Says *why*; the blacklist decision lives in `excludeSlugs`.
	 */
	rankingGuidance?: string;
	/**
	 * How wide the later ranking step should go. `survey` raises the result
	 * ceiling even when the displayed question dropped words like “extensive”.
	 */
	coverage?: "brief" | "survey";
	/**
	 * Planner classification for a follow-up: drop prior hits, keep them
	 * for a named refine, or treat this as a new topic.
	 */
	followUpIntent?: AiAskFollowUpIntent;
	/**
	 * Discourse slugs the rescorer must not include. Only IDs from
	 * already-shown history; never invented. `[]` means keep them in play.
	 * Omitted when the planner did not set the field — callers may fall
	 * back to followUpIntent or a light question-text heuristic.
	 */
	excludeSlugs?: string[];
}

/**
 * True when this rewrite is too weak to trust — retry the same planner once,
 * then try the next model instead of searching with topical fallbacks.
 */
export function shouldRetryUnusableRewrite(plan: AiRewritePlan): boolean {
	return (
		plan.degradedReason === "no_json" || plan.degradedReason === "weak_queries"
	);
}

export const AI_REWRITE_SYSTEM_PROMPT = `You rewrite a person's question into search queries for a Pāli sutta library (Words of the Buddha).

The search engine already ranks discourses. Your job is NOT to answer, quote, or teach. Do not invent sutta citations. Do not write a Dhamma explanation.

Pipeline context: after your queries run, a smaller (non-thinking) model re-ranks up to ~500 candidate discourses. A thinking model then writes the reader's answer from fuller excerpts of the selected set. The ranker sees the candidates, the question, earlier turns, rankingGuidance, termQueries (as [term: …] marks), and excludeSlugs. It must not infer which prior IDs to drop — you set excludeSlugs. rankingGuidance tells the ranker what to prefer and the writer how to frame the answer (form and facets). termQueries tell the harness which searches are lexical targets.

Return JSON only in the final answer — no markdown fences, no preface, no trailing commentary. Put any chain-of-thought in the reasoning channel (or <think> tags), never as a substitute for the JSON object. Content must be exactly one JSON object:
{"correctedQuestion":"their question with only clear typos fixed (or unchanged)","lookingFor":"short phrase shown to the reader","queries":["term"],"termQueries":["term"],"fallbackQueries":["broader term"],"personSlugs":["ananda"],"shareSlug":"mindfulness-of-the-body","coverage":"brief","rankingGuidance":"1–3 sentences for the ranking and answer steps","followUpIntent":"refine","excludeSlugs":[],"offTopic":false}

Search language (this site's real operators — use them when they help):
- Default matches titles, descriptions, IDs, and topics/qualities/similes/persons (fuzzy).
- quest — fuzzy word. Unquoted Pāli is diacritic-insensitive and matches inflected endings: vimuttikkhandho also finds vimuttikkhandha, vimuttikkhandhaṁ, vimuttikkhandhena. Prefer this for a named Pāli term (gloss, “where this word appears”, “all discourses with X”).
- ^SN or ^AN — only that collection (SN, AN, MN, DN, DHP, …)
- !word — exclude discourses containing word
- 'sammāsati or "sammāsati" — exact whole word, diacritic-exact, no inflections. 'vimuttikkhandho misses vimuttikkhandhaṁ. Use only when they asked for that exact spelling / no inflected matches — never as the default for Pāli.
- "letting go" — exact phrase (each word exact)
- illusion | ignorance — either word
- title:element content:consciousness — restrict to title or body
- title:element (content:space | content:consciousness) — grouped OR in a field
- Combining: ^SN consciousness ; !^DHP ; ^AN urgency !mindfulness
- PTS: pts:AN V. 91 ; pts:MN 2 ; pts:SN V 31 ; PTS 4.152 ; pts:Iti 27
  (pts: / volpage: / leading PTS — not ordinary bare numbers)

Query rules:
- correctedQuestion: preserve the person's wording. Only edit when the text is garbled or has an obvious typo / speech-to-text error that makes it not make sense (e.g. "weeknds"→"bhikkhus", "budha"→"Buddha", "mind fulless"→"mindfulness"). If they gave detailed instructions, constraints, or a careful multi-part ask, keep that wording verbatim — do not reword, polish, shorten, reorder, summarize, or “improve” it. Do not expand into a different question, add citations, or answer it. If already clear, return it unchanged (normalized spacing is fine).
- lookingFor: usually a short theme label (a few words), never the full question. When offTopic is true, lookingFor may be a longer one- or two-sentence redirect (especially for distress).
- shareSlug: a short public URL slug for this question (lowercase kebab-case English, 3–6 words, about 12–48 characters). Capture the theme, e.g. "mindfulness-of-the-body", "four-foundations-of-mindfulness", "craving-and-suffering". No spaces, no punctuation besides hyphens, no discourse IDs alone, no filler like "question-about". Prefer readable over cryptic.
- 1 to 4 primary queries. Each is usually 1–8 tokens, not a full sentence. Never put the whole question into queries[].
- Prefer short topical English and common Pāli from the library vocabulary / Known discourses list.
- Prefer queries likely to hit real discourses (known terms, collection filters only when the person asked for a nikāya).
- Named Pāli words/compounds: put the bare unquoted form in queries[] (vimuttikkhandho, not 'vimuttikkhandho). Do not quote Pāli “because diacritics matter” — default search already handles diacritics and inflections; '… is too tight. Do not replace a named compound with a shorter stem as a primary query (vimuttikkhandho → vimutti) unless they asked about the broader term.
- personSlugs: optional. Include a slug only when the person named that figure in the question (e.g. "Ānanda", "Sakka"). Do not infer a person from a story, a yakkha/spirit, or a teaching topic. Leave personSlugs empty when they did not name anyone. Never invent slugs.
- If they named a discourse (MN 10, SN 12.2, Dhp 1), include that ID as one query.
- When citing a specific sutta by name or story, copy the ID only from the Known discourses list below (never invent a nearby number such as SN 22.87 for Puṇṇama).
- lookingFor may name those IDs, but must not invent IDs absent from the Known discourses list.
- Broad / practical / “inspired” / “technique” / “how to apply” / “diverse aspects” asks: cover several facets with complementary short queries (classic practice clusters + English synonyms). For mindfulness / sati practice, prefer the Satipaṭṭhāna Saṃyutta and related stems: satipaṭṭhāna, ^SN satipaṭṭhāna, ānāpānasati, kāyagatāsati, sampajañña, sati, sammāsati — plus known IDs (MN 10, MN 118, SN 47.1, SN 47.2, SN 47.35, SN 47.40, SN 47.42, AN 8.63). Do not stop at DN 22 / MN 10 alone when they ask for techniques or other kinds.
- If they asked for exact wording, a collection, OR/exclude, or a PTS page, encode that with the operators above.
- fallbackQueries: 1–3 broader backups (plain short words, no operators) if the first queries might miss.
- termQueries: subset of queries[] that are the lexical targets to find or define. Include a Pāli compound even when the person used an English headword and you supplied the Pāli (samadikkhandho for “aggregate of collectedness”). Do not list collection filters, English synonyms, or a split compound (vimutti khandha). The harness marks hits from these searches for the ranker. Empty when every primary query is just a topical backup.
- coverage: always set this. "survey" when they want a wide, cited, or thorough treatment of a topic — including when they never used those words (gather the discourses on X; what the canon says across the nikāyas; help me study Y properly; map the teaching). "brief" for a named sutta, a specific story, “which discourse”, or an ordinary short question. Classify the intent; do not copy the example’s "brief".
- rankingGuidance: 1–3 plain sentences addressed to the ranking step and the later thinking writer. Say what they actually want and how to write it — including any form they demonstrated or requested (a syntax, definition line, list, comparison, “likewise” for a related term). Name facets or must-have IDs; say what to de-prioritize. For hard topics, tell it to report what the Buddha said, what he refused to declare, and any characteristic reframes. When coverage is survey, keep a broad set. When termQueries is set, tell it to prefer those tagged hits over famous discourses that only matched a backup. Do not answer the question here. Empty string when nothing beyond the obvious applies. On follow-ups, say which facets to cover instead — do not use rankingGuidance as the blacklist; that is excludeSlugs.
- Follow-ups: Earlier turns include the original question, later questions, clipped summaries, and alreadyShown IDs. Resolve pronouns (“that”, “the second one”) against those turns — never drop the first question when the thread is long.
- followUpIntent + excludeSlugs: default is keep already-shown IDs. excludeSlugs [] means keep them — the harness will not infer a blacklist from followUpIntent. Copy IDs into excludeSlugs only from Already shown IDs (same slug spelling), and only when they clearly want a *different set of discourses* (“other”, “not those”, “fresh set”, “not included yet”). Never invent a citation. More evidence, more citations, “likewise” / “and also” for a related term, or continuing the same treatment are not grounds to drop prior IDs.
  - diversify (they want a different set): followUpIntent "diversify" and put those alreadyShown IDs in excludeSlugs. Invent a fresh complementary query set. Do not repeat the same lookingFor or the same primary queries.
  - refine (go deeper, “the second one”, continue the same task for a related term): followUpIntent "refine". excludeSlugs must be []. Search any newly named terms unquoted. Do not use a bare ^AN / ^SN / ^ITI as a primary query; it floods the pool.
  - new topic (unrelated to prior hits): followUpIntent "new". excludeSlugs [].
- First question (no earlier turns): omit followUpIntent; excludeSlugs [].
- Scope (set offTopic carefully — this is library scope, not a content filter):
  - Related but outside early Buddhist discourses (commentaries, Abhidhamma later layers, other Buddhist schools, popular Buddhist terms not in the nikāyas): keep offTopic false. Search for the closest early-discourse parallels / themes so the later summary can frame what is and is not in the Buddha’s discourses.
  - Clearly unrelated (weather, recipes, news, coding, celebrity gossip): set offTopic true and empty query arrays. Put a brief polite redirect in lookingFor (e.g. “This Ask looks only in the early discourses.”).
  - Personal distress / crisis only: the person is asking for help with their own acute self-harm, suicide, or a medical/legal emergency right now. Set offTopic true and empty query arrays. lookingFor must gently refuse AI help and point them to a real person / local emergency or crisis resources — do not search, diagnose, counsel, or spiritualize the crisis.
  - Hard, controversial, “edgy”, or test questions about the teachings (killing, war, sexuality, undeclared points after death, harsh speech, caste, gender, politics, “most controversial discourse”, hypotheticals meant to stress the ethics): keep offTopic false and search normally. Do NOT refuse, sanitize, or leave queries empty for safety. The Buddha addressed many of these by stating a teaching, refusing to declare speculative positions, or reframing (e.g. kill anger/greed/delusion; avyākata / undeclared points in SN 44, MN 63, MN 72; householder ethics in DN 31 / AN 8.54). Prefer queries that surface those discourses. Never invent a refusal in lookingFor for these.`;

const MAX_QUESTION_CHARS = 500;
const MAX_QUERIES = 4;
/** Per-turn already-shown slugs accepted from the follow-up payload. */
const HISTORY_PARSE_SLUG_CAP = 55;
const MAX_FALLBACK_QUERIES = 3;
const MAX_QUERY_CHARS = 100;

export function clipAiQuestion(question: string): string {
	return question.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_CHARS);
}

function asStringArray(value: unknown, limit = MAX_QUERIES): string[] {
	if (Array.isArray(value)) {
		return value
			.map((item) => (typeof item === "string" ? item : ""))
			.map((item) => item.replace(/\s+/g, " ").trim())
			.filter((item) => item.length > 0 && item.length <= MAX_QUERY_CHARS)
			.slice(0, limit);
	}
	if (typeof value === "string" && value.trim()) {
		return [value.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_CHARS)];
	}
	return [];
}

function parseCorrectedQuestion(
	record: Record<string, unknown>,
	fallbackQuestion: string,
): string {
	const fallback = clipAiQuestion(fallbackQuestion);
	const raw =
		typeof record.correctedQuestion === "string"
			? record.correctedQuestion
			: typeof record.displayQuestion === "string"
				? record.displayQuestion
				: "";
	const corrected = clipAiQuestion(raw);
	return corrected || fallback;
}

function questionTokens(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9āīūṅñṭḍṇḷṃ\s'-]/gi, " ")
		.split(/\s+/)
		.map((token) => token.replace(/^'+|'+$/g, ""))
		.filter((token) => token.length > 0);
}

/**
 * Accept typo/speech fixes; reject paraphrase / polish of clear detailed asks.
 */
export function preferMinimalCorrectedQuestion(
	original: string,
	proposed: string,
): string {
	const base = repairCommonAskTypos(clipAiQuestion(original));
	const next = repairCommonAskTypos(clipAiQuestion(proposed));
	if (!next) return base;
	if (!base) return next;
	if (base.toLowerCase() === next.toLowerCase()) return next;

	const baseTokens = questionTokens(base);
	const nextTokens = questionTokens(next);
	if (baseTokens.length === 0) return next;

	const nextSet = new Set(nextTokens);
	const baseSet = new Set(baseTokens);
	const retained = baseTokens.filter((token) => nextSet.has(token)).length;
	const added = nextTokens.filter((token) => !baseSet.has(token)).length;
	const retention = retained / baseTokens.length;
	const additionRatio = added / baseTokens.length;
	const detailed =
		baseTokens.length >= 18 ||
		/[.!?;]/.test(base) ||
		/\b(please|exhaustiv\w*|in detail|detailed|show me|list|include|do not|don't|make sure|specifically|search|write|rank|compare|explain)\b/i.test(
			base,
		);

	// Single-token speech fixes on short asks (weeknds→bhikkhus) stay allowed.
	if (!detailed && retention >= 0.6 && additionRatio <= 0.35) {
		return next;
	}
	if (detailed && retention >= 0.9 && additionRatio <= 0.15) {
		return next;
	}
	if (!detailed && retention >= 0.85 && additionRatio <= 0.25) {
		return next;
	}
	return base;
}

const MAX_LOOKING_FOR = 160;
/** Off-topic / distress redirects need a fuller sentence than a theme chip. */
const MAX_OFF_TOPIC_LOOKING_FOR = 280;
export const MAX_RANKING_GUIDANCE = 600;

export function clipRankingGuidance(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.replace(/\s+/g, " ").trim().slice(0, MAX_RANKING_GUIDANCE);
}

export function parseAskCoverage(value: unknown): "brief" | "survey" | undefined {
	if (typeof value !== "string") return undefined;
	const token = value.replace(/\s+/g, " ").trim().toLowerCase();
	if (
		token === "survey" ||
		token === "expansive" ||
		token === "broad" ||
		token === "wide" ||
		token === "extensive"
	) {
		return "survey";
	}
	if (token === "brief" || token === "tight" || token === "narrow") {
		return "brief";
	}
	return undefined;
}

export function parseAskFollowUpIntent(
	value: unknown,
): AiAskFollowUpIntent | undefined {
	if (typeof value !== "string") return undefined;
	const token = value.replace(/\s+/g, " ").trim().toLowerCase();
	if (
		token === "diversify" ||
		token === "other" ||
		token === "more" ||
		token === "blacklist"
	) {
		return "diversify";
	}
	if (token === "refine" || token === "deeper" || token === "keep") {
		return "refine";
	}
	if (token === "new" || token === "new_topic" || token === "new-topic") {
		return "new";
	}
	return undefined;
}

/** Compact planner/history IDs so "MN 10" and "mn10" match. */
export function normalizeAskPlanSlug(raw: string): string {
	return raw.replace(/\s+/g, "").trim().toLowerCase();
}

/**
 * Keep only slugs that already appeared in this Ask. Never invent IDs.
 */
export function parseAskExcludeSlugs(
	raw: unknown,
	allowedShown: readonly string[],
): string[] {
	const allowed = new Map<string, string>();
	for (const slug of allowedShown) {
		const key = normalizeAskPlanSlug(slug);
		if (!key || allowed.has(key)) continue;
		allowed.set(key, key);
	}
	if (allowed.size === 0) return [];
	const values = Array.isArray(raw)
		? raw
		: typeof raw === "string" && raw.trim()
			? [raw]
			: [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of values) {
		if (typeof item !== "string") continue;
		const match = allowed.get(normalizeAskPlanSlug(item));
		if (!match || seen.has(match)) continue;
		seen.add(match);
		out.push(match);
	}
	return out;
}

function rewriteExcludeField(record: Record<string, unknown>): unknown {
	if ("excludeSlugs" in record) return record.excludeSlugs;
	if ("blacklist" in record) return record.blacklist;
	if ("excludeIds" in record) return record.excludeIds;
	return undefined;
}

function parseTermQueries(
	raw: unknown,
	queries: readonly string[],
): string[] {
	const allowed = new Set(
		queries.map((query) => normalizeAiSearchQuery(query).toLowerCase()).filter(Boolean),
	);
	const out: string[] = [];
	const seen = new Set<string>();
	for (const value of asStringArray(raw, MAX_QUERIES)) {
		const normalized = normalizeAiSearchQuery(value);
		if (!normalized || isBareCollectionFilterQuery(normalized)) continue;
		if (!normalized) continue;
		const key = normalized.toLowerCase();
		if (!allowed.has(key) || seen.has(key)) continue;
		seen.add(key);
		out.push(normalized);
	}
	return out;
}

/**
 * Planner-owned blacklist for the rescorer.
 *
 * `excludeSlugs` is authoritative, including `[]` (keep prior IDs). Do not
 * expand an empty list just because followUpIntent is diversify. If the
 * planner omitted the field and classified diversify, fill from already-shown
 * IDs. If it omitted both, a light question-text heuristic is the degraded
 * fallback.
 */
export function resolveRewriteExcludeSlugs(
	plan: Pick<AiRewritePlan, "excludeSlugs" | "followUpIntent">,
	alreadyShown: readonly string[],
	question: string,
): string[] {
	const shown = collectAskHistoryShownSlugs([{ resultSlugs: alreadyShown }]);
	if (shown.length === 0) return [];
	const shownSet = new Set(shown);

	if (plan.excludeSlugs !== undefined) {
		return plan.excludeSlugs.filter((slug) =>
			shownSet.has(normalizeAskPlanSlug(slug)),
		);
	}

	if (plan.followUpIntent === "diversify") return shown;
	if (plan.followUpIntent === "refine" || plan.followUpIntent === "new") {
		return [];
	}

	return shouldExcludeAlreadyShownAskHits(question, [
		{ resultSlugs: shown },
	])
		? shown
		: [];
}

function shortLookingFor(
	preferred: string,
	queries: readonly string[],
	correctedQuestion: string,
): string {
	const clipped = preferred
		.replace(/^looking for:\s*/i, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_LOOKING_FOR);
	if (
		clipped &&
		clipped.length <= 80 &&
		!isWeakAiSearchQuery(clipped) &&
		clipped.toLowerCase() !== correctedQuestion.toLowerCase()
	) {
		return clipped;
	}
	if (queries[0] && !isWeakAiSearchQuery(queries[0])) return queries[0];
	const topical = topicalFallbackQueries(correctedQuestion, 2);
	return topical.join(" · ") || clipped || correctedQuestion.slice(0, 80);
}

function offTopicLookingFor(
	preferred: string,
	correctedQuestion: string,
): string {
	const clipped = preferred
		.replace(/^looking for:\s*/i, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_OFF_TOPIC_LOOKING_FOR);
	if (
		clipped &&
		clipped.toLowerCase() !== correctedQuestion.toLowerCase()
	) {
		return clipped;
	}
	return "This Ask looks only in the early discourses of the Buddha.";
}

function usableQueries(values: readonly string[]): string[] {
	return values.filter((query) => !isWeakAiSearchQuery(query));
}

/**
 * True when the person is asking for help with their own acute crisis —
 * the only case where Ask should refuse to search the library.
 */
export function looksLikePersonalCrisis(question: string): boolean {
	return /\b(i\s+(want to|am going to|feel like|plan to|might)\s+(kill|hurt|harm)\s+(myself|me)|kill myself|hurt myself|end my (own )?life|suicid(e|al)|i need (an? )?(emergency|ambulance|doctor) (now|right now)?|i('m| am) going to (die|kill))\b/i.test(
		question.replace(/\s+/g, " ").trim(),
	);
}

/**
 * Teaching / ethics / “test” topics that models sometimes wrongly mark
 * off-topic for safety. These must stay searchable.
 */
export function looksLikeHardTeachingTopic(question: string): boolean {
	return /\b(buddha|dhamma|dharma|sutta|discourse|nik[aā]ya|precept|killing|kill|war|soldier|violence|sexual|sensual|desire|undeclared|avy[aā]kata|after death|tath[aā]gata|controversial|householder|anger|greed|delusion|caste|brahmin|ethics|moral|harm|cruel|slaughter|meat|abortion|suicide|rebirth|hell|heaven|politics)\b/i.test(
		question.replace(/\s+/g, " ").trim(),
	);
}

/**
 * Honor model offTopic only for unrelated asks or a true personal crisis.
 * If the model refused a hard teaching topic, search anyway.
 */
export function shouldHonorOffTopic(
	question: string,
	modelOffTopic: boolean,
): boolean {
	if (!modelOffTopic) return false;
	if (looksLikePersonalCrisis(question)) return true;
	if (looksLikeHardTeachingTopic(question)) return false;
	return true;
}

export function parseRewritePlan(
	raw: string,
	fallbackQuestion: string,
	alreadyShownSlugs: readonly string[] = [],
): AiRewritePlan {
	const repairedFallback = repairCommonAskTypos(clipAiQuestion(fallbackQuestion));
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") {
		const topical = topicalFallbackQueries(repairedFallback);
		return {
			correctedQuestion: repairedFallback,
			lookingFor: shortLookingFor("", topical, repairedFallback),
			queries: topical,
			fallbackQueries: [],
			offTopic: false,
			degraded: true,
			degradedReason: "no_json",
		};
	}
	const record = parsed as Record<string, unknown>;
	const correctedQuestion = preferMinimalCorrectedQuestion(
		fallbackQuestion,
		parseCorrectedQuestion(record, repairedFallback),
	);
	const rawQueries = asStringArray(record.queries, MAX_QUERIES);
	const rawFallbacks = asStringArray(
		record.fallbackQueries,
		MAX_FALLBACK_QUERIES,
	).filter((query) => !rawQueries.includes(query));
	let queries = usableQueries(rawQueries);
	let fallbackQueries = usableQueries(rawFallbacks).filter(
		(query) => !queries.includes(query),
	);
	// Dropping a single rambling chip among good ones is normal — not “degraded”.
	let degraded = false;
	let degradedReason: AiRewritePlan["degradedReason"];
	if (queries.length === 0) {
		queries = topicalFallbackQueries(correctedQuestion);
		degraded = true;
		degradedReason = "weak_queries";
	}
	if (fallbackQueries.length === 0 && degraded) {
		fallbackQueries = topicalFallbackQueries(correctedQuestion, 2).filter(
			(query) => !queries.includes(query),
		);
	}
	const modelOffTopic = record.offTopic === true;
	const honorOffTopic = shouldHonorOffTopic(correctedQuestion, modelOffTopic);
	const shareSlug =
		normalizeAskShareSlug(
			typeof record.shareSlug === "string"
				? record.shareSlug
				: typeof record.slug === "string"
					? record.slug
					: "",
		) || undefined;
	if (honorOffTopic && rawQueries.length === 0) {
		return {
			correctedQuestion,
			lookingFor: offTopicLookingFor(
				typeof record.lookingFor === "string" ? record.lookingFor : "",
				correctedQuestion,
			),
			queries: [],
			fallbackQueries: [],
			offTopic: true,
			...(shareSlug ? { shareSlug } : {}),
		};
	}
	// Model refused a searchable teaching topic — keep the topical search path.
	if (modelOffTopic && !honorOffTopic) {
		degraded = true;
		degradedReason = "offtopic_override";
		if (queries.length === 0) {
			queries = topicalFallbackQueries(correctedQuestion);
		}
	}
	const lookingFor = shortLookingFor(
		typeof record.lookingFor === "string" ? record.lookingFor : "",
		queries,
		correctedQuestion,
	);
	const personSlugs = asStringArray(
		record.personSlugs ?? record.persons,
		3,
	)
		.map((slug) =>
			slug
				.trim()
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^a-z0-9.-]/g, ""),
		)
		.filter(Boolean);
	const rankingGuidance = clipRankingGuidance(
		record.rankingGuidance ?? record.guidance ?? record.rerankGuidance,
	);
	const coverage = parseAskCoverage(record.coverage);
	const followUpIntent = parseAskFollowUpIntent(
		record.followUpIntent ?? record.intent ?? record.followupIntent,
	);
	const excludeRaw = rewriteExcludeField(record);
	const excludeSpecified = excludeRaw !== undefined;
	const excludeSlugs = excludeSpecified
		? parseAskExcludeSlugs(excludeRaw, alreadyShownSlugs)
		: undefined;
	const termQueries = parseTermQueries(
		record.termQueries ?? record.namedTerms ?? record.focusQueries,
		queries,
	);
	return {
		correctedQuestion,
		lookingFor,
		queries,
		fallbackQueries,
		offTopic: false,
		...(shareSlug ? { shareSlug } : {}),
		...(personSlugs.length > 0 ? { personSlugs } : {}),
		...(termQueries.length > 0 ? { termQueries } : {}),
		...(rankingGuidance ? { rankingGuidance } : {}),
		...(coverage ? { coverage } : {}),
		...(followUpIntent ? { followUpIntent } : {}),
		...(excludeSpecified ? { excludeSlugs: excludeSlugs ?? [] } : {}),
		...(degraded ? { degraded: true, degradedReason } : {}),
	};
}

export function parseAskHistory(raw: unknown): AiRewriteHistoryTurn[] {
	if (!Array.isArray(raw)) return [];
	const turns: AiRewriteHistoryTurn[] = [];
	for (const item of clipAskHistoryTurns(raw, ASK_HISTORY_PARSE_CAP)) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const question =
			typeof record.question === "string" ? clipAiQuestion(record.question) : "";
		if (!question) continue;
		const lookingFor =
			typeof record.lookingFor === "string"
				? record.lookingFor.replace(/\s+/g, " ").trim().slice(0, 160)
				: "";
		const queries = Array.isArray(record.queries)
			? record.queries
					.filter((query): query is string => typeof query === "string")
					.map((query) => query.replace(/\s+/g, " ").trim())
					.filter(Boolean)
					.slice(0, 4)
			: [];
		// Follow-ups (“more like this”, “not already shown”) need every shown
		// slug, including a survey that slightly overshoots the typical 50.
		const resultSlugs = Array.isArray(record.resultSlugs)
			? record.resultSlugs
					.filter((slug): slug is string => typeof slug === "string")
					.map((slug) => slug.replace(/\s+/g, " ").trim().toLowerCase())
					.filter(Boolean)
					.slice(0, HISTORY_PARSE_SLUG_CAP)
			: [];
		const summary =
			typeof record.summary === "string"
				? clipAiHistorySummary(record.summary)
				: "";
		turns.push({
			question,
			lookingFor,
			queries,
			...(resultSlugs.length > 0 ? { resultSlugs } : {}),
			...(summary ? { summary } : {}),
		});
	}
	return clipAskHistoryTurns(turns, ASK_HISTORY_MAX_TURNS);
}

export function buildRewriteMessages(
	question: string,
	history: readonly AiRewriteHistoryTurn[] = [],
	libraryHints: string = getAiLibraryHintsText(),
): OpenRouterChatMessage[] {
	const clipped = clipAiQuestion(question);
	const recent = clipAskHistoryTurns(history, ASK_HISTORY_MAX_TURNS);
	const allShown = formatAskAlreadyShownIds(
		collectAskHistoryShownSlugs(history),
		(slug) => slug,
		HISTORY_SHOWN_SLUGS,
	);
	const shownUnion = allShown
		? `\nAlready shown IDs (copy into excludeSlugs only when they want a different set of discourses; leave excludeSlugs [] to keep them): ${allShown}`
		: "";
	const historyBlock =
		recent.length === 0
			? ""
			: `\n\nEarlier turns (same conversation — resolve pronouns / “that” / “the second one” against these; turn 1 is the original question):\n${recent
					.map((turn, index) => {
						const queries = turn.queries.join(" | ") || "(none)";
						const shown = (turn.resultSlugs || [])
							.slice(0, HISTORY_SHOWN_SLUGS)
							.join(", ");
						const shownLine = shown
							? `\n   alreadyShown: ${shown}`
							: "";
						const summary = clipAiHistorySummary(turn.summary || "");
						const summaryLine = summary
							? `\n   summary: ${summary}`
							: "";
						return `${index + 1}. Q: ${turn.question}\n   lookingFor: ${turn.lookingFor}\n   queries: ${queries}${shownLine}${summaryLine}`;
					})
					.join("\n")}${shownUnion}`;
	const system = libraryHints
		? `${AI_REWRITE_SYSTEM_PROMPT}\n\n${libraryHints}`
		: AI_REWRITE_SYSTEM_PROMPT;
	return [
		{ role: "system", content: system },
		{
			role: "user",
			content: `Question: ${clipped}${historyBlock}\n\nJSON:`,
		},
	];
}
