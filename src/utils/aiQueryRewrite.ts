import type { OpenRouterChatMessage } from "./openrouter";
import { getAiLibraryHintsText } from "./aiLibraryHintsServer";
import { normalizeAskShareSlug } from "./aiAskShare";
import {
	isWeakAiSearchQuery,
	repairCommonAskTypos,
	topicalFallbackQueries,
} from "./aiSearchQuery";

export interface AiRewriteHistoryTurn {
	question: string;
	lookingFor: string;
	queries: string[];
	/** Slugs already shown — follow-ups should diversify away from these. */
	resultSlugs?: string[];
}

export interface AiRewritePlan {
	/** Lightly cleaned wording for display (typos / speech errors fixed). */
	correctedQuestion: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	/** Public URL slug for /ask/{shareSlug} — theme of the question. */
	shareSlug?: string;
	/** True when we had to synthesize short queries because the model plan was unusable. */
	degraded?: boolean;
}

export const AI_REWRITE_SYSTEM_PROMPT = `You rewrite a person's question into search queries for a Pāli sutta library (Words of the Buddha).

The search engine already ranks discourses. Your job is NOT to answer, quote, or teach. Do not invent sutta citations. Do not write a Dhamma explanation.

Return JSON only, no markdown, no preface:
{"correctedQuestion":"cleaned wording of their question","lookingFor":"short phrase shown to the reader","queries":["term"],"fallbackQueries":["broader term"],"shareSlug":"mindfulness-of-the-body","offTopic":false}

Search language (this site's real operators — use them when they help):
- Default matches titles, descriptions, IDs, and topics/qualities/similes (fuzzy).
- quest — fuzzy word
- ^SN or ^AN — only that collection (SN, AN, MN, DN, DHP, …)
- !word — exclude discourses containing word
- 'sammāsati or "sammāsati" — exact whole word, diacritic-exact
- "letting go" — exact phrase (each word exact)
- illusion | ignorance — either word
- title:element content:consciousness — restrict to title or body
- title:element (content:space | content:consciousness) — grouped OR in a field
- Combining: ^SN consciousness ; !^DHP ; ^AN urgency !mindfulness
- PTS: pts:AN V. 91 ; pts:MN 2 ; pts:SN V 31 ; PTS 4.152 ; pts:Iti 27
  (pts: / volpage: / leading PTS — not ordinary bare numbers)

Query rules:
- correctedQuestion: the person's question with obvious typos / speech-to-text errors fixed (e.g. "weeknds"→"bhikkhus", "budha"→"Buddha", "mind fulless"→"mindfulness"). Keep the same meaning and roughly the same length. Do not expand into a different question, add citations, or answer it. If already clear, return it unchanged (normalized spacing/punctuation is fine).
- lookingFor: usually a short theme label (a few words), never the full question. When offTopic is true, lookingFor may be a longer one- or two-sentence redirect (especially for distress).
- shareSlug: a short public URL slug for this question (lowercase kebab-case English, 3–6 words, about 12–48 characters). Capture the theme, e.g. "mindfulness-of-the-body", "four-foundations-of-mindfulness", "craving-and-suffering". No spaces, no punctuation besides hyphens, no discourse IDs alone, no filler like "question-about". Prefer readable over cryptic.
- 1 to 4 primary queries. Each is usually 1–8 tokens, not a full sentence. Never put the whole question into queries[].
- Prefer short topical English and common Pāli from the library vocabulary / Known discourses list.
- Prefer queries likely to hit real discourses (known terms, exact Pāli forms with '… when diacritics matter, collection filters only when the person asked for a nikāya).
- If they named a discourse (MN 10, SN 12.2, Dhp 1), include that ID as one query.
- When citing a specific sutta by name or story, copy the ID only from the Known discourses list below (never invent a nearby number such as SN 22.87 for Puṇṇama).
- lookingFor may name those IDs, but must not invent IDs absent from the Known discourses list.
- Broad / practical / “inspired” / “technique” / “how to apply” / “diverse aspects” asks: cover several facets with complementary short queries (classic practice clusters + English synonyms). For mindfulness / sati practice, prefer the Satipaṭṭhāna Saṃyutta and related stems: satipaṭṭhāna, ^SN satipaṭṭhāna, ānāpānasati, kāyagatāsati, sampajañña, sati, sammāsati — plus known IDs (MN 10, MN 118, SN 47.1, SN 47.2, SN 47.35, SN 47.40, SN 47.42, AN 8.63). Do not stop at DN 22 / MN 10 alone when they ask for techniques or other kinds.
- If they asked for exact wording, a collection, OR/exclude, or a PTS page, encode that with the operators above.
- fallbackQueries: 1–3 broader backups (plain short words, no operators) if the first queries might miss.
- Follow-ups that ask for “other”, “more”, “diverse”, “not included yet”, or an enumeration: invent a fresh complementary query set. Prefer different facets / saṃyuttas / IDs than Earlier turns already returned (see alreadyShown). Do not repeat the same lookingFor or the same primary queries unless the person asked to refine one specific hit.
- Scope (set offTopic carefully):
  - Related but outside early Buddhist discourses (commentaries, Abhidhamma later layers, other Buddhist schools, popular Buddhist terms not in the nikāyas): keep offTopic false. Search for the closest early-discourse parallels / themes so the later summary can frame what is and is not in the Buddha’s discourses.
  - Clearly unrelated (weather, recipes, news, coding, celebrity gossip): set offTopic true and empty query arrays. Put a brief polite redirect in lookingFor (e.g. “This Ask looks only in the early discourses.”).
  - Distress / crisis / self-harm / medical or legal emergency: set offTopic true and empty query arrays. lookingFor must gently refuse AI help and point them to a real person / local emergency or crisis resources — do not search, diagnose, counsel, or spiritualize the crisis.
  - Hard or controversial questions still inside the canon (disputed suttas, difficult ethics, “most controversial discourse”): keep offTopic false and search normally.`;

const MAX_QUESTION_CHARS = 500;
const MAX_HISTORY_TURNS = 6;
const MAX_QUERIES = 4;
const MAX_FALLBACK_QUERIES = 3;
const MAX_QUERY_CHARS = 100;

export function clipAiQuestion(question: string): string {
	return question.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_CHARS);
}

export function extractJsonObject(text: string): unknown {
	const stripped = text
		.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
		.replace(/```(?:json)?/gi, "")
		.trim();
	const start = stripped.indexOf("{");
	const end = stripped.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	try {
		return JSON.parse(stripped.slice(start, end + 1));
	} catch {
		return null;
	}
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

const MAX_LOOKING_FOR = 160;
/** Off-topic / distress redirects need a fuller sentence than a theme chip. */
const MAX_OFF_TOPIC_LOOKING_FOR = 280;

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

export function parseRewritePlan(
	raw: string,
	fallbackQuestion: string,
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
		};
	}
	const record = parsed as Record<string, unknown>;
	const correctedQuestion = repairCommonAskTypos(
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
	let degraded = queries.length < rawQueries.length;
	if (queries.length === 0) {
		queries = topicalFallbackQueries(correctedQuestion);
		degraded = true;
	}
	if (fallbackQueries.length === 0 && degraded) {
		fallbackQueries = topicalFallbackQueries(correctedQuestion, 2).filter(
			(query) => !queries.includes(query),
		);
	}
	const offTopic = record.offTopic === true;
	const shareSlug =
		normalizeAskShareSlug(
			typeof record.shareSlug === "string"
				? record.shareSlug
				: typeof record.slug === "string"
					? record.slug
					: "",
		) || undefined;
	if (offTopic && rawQueries.length === 0) {
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
	const lookingFor = shortLookingFor(
		typeof record.lookingFor === "string" ? record.lookingFor : "",
		queries,
		correctedQuestion,
	);
	return {
		correctedQuestion,
		lookingFor,
		queries,
		fallbackQueries,
		offTopic: false,
		...(shareSlug ? { shareSlug } : {}),
		...(degraded ? { degraded: true } : {}),
	};
}

export function buildRewriteMessages(
	question: string,
	history: readonly AiRewriteHistoryTurn[] = [],
	libraryHints: string = getAiLibraryHintsText(),
): OpenRouterChatMessage[] {
	const clipped = clipAiQuestion(question);
	const recent = history.slice(-MAX_HISTORY_TURNS);
	const historyBlock =
		recent.length === 0
			? ""
			: `\n\nEarlier turns:\n${recent
					.map((turn, index) => {
						const queries = turn.queries.join(" | ") || "(none)";
						const shown = (turn.resultSlugs || []).slice(0, 12).join(", ");
						const shownLine = shown
							? `\n   alreadyShown: ${shown}`
							: "";
						return `${index + 1}. Q: ${turn.question}\n   lookingFor: ${turn.lookingFor}\n   queries: ${queries}${shownLine}`;
					})
					.join("\n")}`;
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
