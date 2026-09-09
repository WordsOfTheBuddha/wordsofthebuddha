import type { SearchData } from "../service/search/search";
import { getSearchDocBySlug } from "../service/search/search";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	clipRerankSummary,
	formatRerankHistoryBlock,
} from "./aiResultRerank";
import {
	extractJsonObject,
	type AiRewriteHistoryTurn,
} from "./aiQueryRewrite";
import { joinAskSummaryParagraphs } from "./linkifyAskSummary";
import { questionTextForTermMatch } from "./aiSearchQuery";
import {
	ASK_PLANNER_MAX_TOKENS,
	askPlannerChatOptions,
	getOpenRouterApiKey,
	openRouterChatStream,
	splitThinkTags,
} from "./openrouter";
import { inflectionStemKey } from "./paliInflectionUtils";
import { normalizeForComparison, STOPWORDS, stripAnnotations } from "./searchRanking";
import { transformId } from "./transformId";

/** Expanded excerpts sent to the thinking writer (not the ranker’s 440-char clip). */
export const ASK_ANSWER_HIT_CHARS = 1800;
/** Survey sets can be 50; the writer reads the best-first prefix in full. */
export const ASK_ANSWER_MAX_EXPANDED = 16;
const ASK_ANSWER_MAX_PARAS = 4;
const MIN_PARA = 40;
const MIN_HINT = 4;
/** Romanized aspirates (dh/kh/…) so samadikkhandho matches samādhikkhandho. */
const PALI_ASPIRATE_RE = /dh|kh|th|ph|bh|gh|jh|ch/g;

function foldPaliAspirates(norm: string): string {
	return norm.replace(PALI_ASPIRATE_RE, (pair) => pair[0] || pair);
}

export const ASK_ANSWER_SYSTEM = `You write the reader's answer for Words of the Buddha Ask.

You receive the person's question, optional guidance from the planning step, and excerpts from discourses already selected for them. You do not search. You do not re-rank.

Return JSON only:
{"paragraphs":["First short paragraph.","Second short paragraph."]}

You may use {"summary":"…"} instead; if so, put a blank line (\\n\\n) between paragraphs.

Rules:
- Write only from the excerpts. If a discourse merely lists terms, say that it lists them — do not claim it defines, elaborates, or analyzes those terms.
- Do not import stock Dhamma (jhāna formulas, four noble truths, anicca-dukkha-anattā, “stable base for insight”) unless the excerpt actually states that for this term.
- Match the form they asked for. If they demonstrated a syntax, definition line, list, or comparison, use that. Several short paragraphs are the default briefing form when they did not specify a form.
- Space after sentence punctuation. Never glue the next sentence or a discourse ID to the period (wrong: “silence.AN 6.29”; right: “silence.” then a new paragraph “AN 6.29 …”).
- Mention selected discourse IDs in ordinary prose (MN 10, SN 6.2). Prefer IDs whose excerpts actually support the claim. Do not cite a discourse for a gloss it does not give.
- Prefer clarity over padding. Do not use markdown unless that is the form they asked for.
- When the question names something mainly outside these early discourses: say so, then point to the closest early-discourse parallels in the excerpts and what they actually cover.
- Hard / controversial / “test” questions: do not refuse, moralize, or write a safety disclaimer. Report what the excerpts say, what they do not declare, and any characteristic reframes. Stay factual.
- Never give crisis counseling, medical/legal advice, or spiritualize personal distress. If there are no excerpts, keep paragraphs empty.`;

export interface AskAnswerPassage {
	source: string;
	text: string;
}

export interface AskAnswerHitEvidence {
	slug: string;
	title: string;
	referenceOnly: boolean;
	passages: AskAnswerPassage[];
}

function errorStatus(error: unknown): number {
	return typeof error === "object" &&
		error &&
		"status" in error &&
		typeof (error as { status?: unknown }).status === "number"
		? (error as { status: number }).status
		: 0;
}

function stripMarkup(value: string): string {
	return stripAnnotations(value)
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function splitParagraphs(text: string): string[] {
	const cleaned = stripAnnotations(text).replace(/<[^>]*>/g, " ");
	return cleaned
		.split(/\n{2,}|\n(?=\S)/)
		.map((part) => part.replace(/\s+/g, " ").trim())
		.filter((part) => part.length >= MIN_PARA);
}

function hintKeys(hint: string): string[] {
	const norm = normalizeForComparison(hint.replace(/\s+/g, " ").trim());
	if (norm.length < MIN_HINT) return [];
	const stem = inflectionStemKey(norm);
	return stem.length >= MIN_HINT && stem !== norm ? [norm, stem] : [norm];
}

export function askAnswerHints(
	question: string,
	termQueries: readonly string[] = [],
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const add = (raw: string) => {
		const text = raw.replace(/\s+/g, " ").trim();
		if (!text) return;
		const key = normalizeForComparison(text);
		if (key.length < MIN_HINT || seen.has(key) || STOPWORDS.has(key)) return;
		seen.add(key);
		out.push(text);
	};
	for (const query of termQueries) add(query);
	const visible = questionTextForTermMatch(question);
	for (const match of visible.matchAll(/[\p{L}\p{N}]+/gu)) {
		add(match[0]);
	}
	return out;
}

function textHasHint(text: string, hint: string): boolean {
	const hay = normalizeForComparison(text);
	if (!hay) return false;
	const hayFold = foldPaliAspirates(hay);
	for (const key of hintKeys(hint)) {
		if (hay.includes(key)) return true;
		const folded = foldPaliAspirates(key);
		if (folded.length >= MIN_HINT && hayFold.includes(folded)) return true;
	}
	return false;
}

function scoreText(text: string, hints: readonly string[]): number {
	if (!text || hints.length === 0) return 0;
	let score = 0;
	for (const hint of hints) {
		if (textHasHint(text, hint)) score += 1;
	}
	return score;
}

function matchingHintKeys(text: string, hints: readonly string[]): Set<string> {
	const matched = new Set<string>();
	for (const hint of hints) {
		if (textHasHint(text, hint)) {
			matched.add(normalizeForComparison(hint));
		}
	}
	return matched;
}

function clipText(text: string, max: number): string {
	const trimmed = text.replace(/\s+/g, " ").trim();
	if (trimmed.length <= max) return trimmed;
	return trimmed.slice(0, max).trimEnd();
}

export function pickMatchingParagraphs(
	text: string,
	hints: readonly string[],
	maxChars = ASK_ANSWER_HIT_CHARS,
	maxParas = ASK_ANSWER_MAX_PARAS,
): string {
	const body = (text || "").trim();
	if (!body) return "";
	const paras = splitParagraphs(body);
	if (paras.length === 0) return clipText(stripMarkup(body), maxChars);
	const scored = paras.map((para, index) => ({
		para,
		index,
		score: scoreText(para, hints),
	}));
	const hits = scored
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index);
	const chosen = (hits.length > 0 ? hits.slice(0, maxParas) : scored.slice(0, 2))
		.sort((a, b) => a.index - b.index);
	let out = "";
	for (const item of chosen) {
		const next = out ? `${out}\n\n${item.para}` : item.para;
		if (next.length > maxChars) {
			if (!out) return clipText(item.para, maxChars);
			break;
		}
		out = next;
	}
	return out;
}

export function selectAskAnswerPassages(input: {
	english?: string;
	pali?: string;
	hints: readonly string[];
	referenceOnly?: boolean;
	fallback?: string;
	maxChars?: number;
}): AskAnswerPassage[] {
	const maxChars = input.maxChars ?? ASK_ANSWER_HIT_CHARS;
	const english = pickMatchingParagraphs(input.english || "", input.hints, maxChars);
	const pali = pickMatchingParagraphs(input.pali || "", input.hints, maxChars);
	const enHints = matchingHintKeys(english, input.hints);
	const paliHints = matchingHintKeys(pali, input.hints);
	const out: AskAnswerPassage[] = [];
	if (english && (enHints.size > 0 || paliHints.size === 0)) {
		out.push({
			source: input.referenceOnly ? "Sujato English" : "English",
			text: english,
		});
	}
	const paliHasExtra = [...paliHints].some((key) => !enHints.has(key));
	if (pali && (paliHasExtra || enHints.size === 0)) {
		out.push({ source: "Pali", text: pali });
	}
	if (out.length === 0) {
		const fallback = clipText(stripMarkup(input.fallback || ""), maxChars);
		if (fallback) out.push({ source: "card", text: fallback });
	}
	return out;
}

export async function buildAskAnswerEvidence(
	hits: readonly AiDiscourseHit[],
	hints: readonly string[],
	loadDoc: (
		slug: string,
	) => Promise<SearchData | undefined> = (slug) =>
		getSearchDocBySlug(slug, true),
): Promise<{
	expanded: AskAnswerHitEvidence[];
	listedOnly: string[];
}> {
	const expanded: AskAnswerHitEvidence[] = [];
	const listedOnly: string[] = [];
	for (const [index, hit] of hits.entries()) {
		if (index >= ASK_ANSWER_MAX_EXPANDED) {
			listedOnly.push(hit.slug);
			continue;
		}
		const doc = await loadDoc(hit.slug);
		const fallback = [hit.contentSnippet, hit.description]
			.filter(Boolean)
			.join("\n\n");
		const passages = selectAskAnswerPassages({
			english: doc?.content,
			pali: doc?.contentPali,
			hints,
			referenceOnly: hit.referenceOnly || doc?.referenceOnly,
			fallback,
		});
		expanded.push({
			slug: hit.slug,
			title: hit.title || "",
			referenceOnly: hit.referenceOnly === true || doc?.referenceOnly === true,
			passages,
		});
	}
	return { expanded, listedOnly };
}

export function formatAskAnswerEvidenceBlock(input: {
	expanded: readonly AskAnswerHitEvidence[];
	listedOnly?: readonly string[];
}): string {
	const blocks = input.expanded.map((hit) => {
		const id = transformId(hit.slug) || hit.slug;
		const ref = hit.referenceOnly ? " [reference]" : "";
		const title = (hit.title || "").replace(/\s+/g, " ").trim().slice(0, 100);
		const body =
			hit.passages.length > 0
				? hit.passages
						.map((passage) => `${passage.source}:\n${passage.text}`)
						.join("\n\n")
				: "(no excerpt)";
		return `${id}${ref} — ${title || "(untitled)"}\n${body}`;
	});
	const listed = (input.listedOnly || [])
		.map((slug) => transformId(slug) || slug)
		.filter(Boolean);
	const extra =
		listed.length > 0
			? `\nAlso selected (no excerpt in this prompt): ${listed.join(", ")}.`
			: "";
	return `${blocks.join("\n\n")}${extra}`;
}

export function buildAskAnswerUserPrompt(options: {
	question: string;
	evidence: string;
	guidance?: string;
	history?: readonly AiRewriteHistoryTurn[];
}): string {
	const question = options.question.replace(/\s+/g, " ").trim();
	const guidance = (options.guidance || "").replace(/\s+/g, " ").trim();
	const guidanceBlock = guidance
		? `\nGuidance from the planning step: ${guidance}\n`
		: "";
	const earlier = formatRerankHistoryBlock(options.history || []);
	return `Question: ${question}
${guidanceBlock}${earlier}
Excerpts from the selected discourses:
${options.evidence}

JSON:`;
}

export function parseAskAnswerSummary(raw: string): string {
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") return "";
	const record = parsed as Record<string, unknown>;
	const fromParas = joinAskSummaryParagraphs(record.paragraphs);
	const summaryRaw =
		fromParas ||
		(typeof record.summary === "string"
			? record.summary
			: typeof record.answer === "string"
				? record.answer
				: "");
	return clipRerankSummary(summaryRaw);
}

export interface AskAnswerResult {
	summary: string;
	model: string;
	reasoning: string;
}

/**
 * Thinking-model write from expanded selected-discourse excerpts.
 * Returns an empty summary when OpenRouter is unavailable or the model fails
 * — callers should keep the ranker’s fallback briefing.
 */
export async function writeAskAnswer(options: {
	question: string;
	hits: readonly AiDiscourseHit[];
	model: string;
	termQueries?: readonly string[];
	guidance?: string;
	history?: readonly AiRewriteHistoryTurn[];
	onReasoning?: (delta: string) => void;
	signal?: AbortSignal;
	loadDoc?: (slug: string) => Promise<SearchData | undefined>;
}): Promise<AskAnswerResult> {
	const empty: AskAnswerResult = { summary: "", model: "", reasoning: "" };
	if (options.hits.length === 0 || !getOpenRouterApiKey()) return empty;
	const hints = askAnswerHints(options.question, options.termQueries);
	const pack = await buildAskAnswerEvidence(
		options.hits,
		hints,
		options.loadDoc,
	);
	const evidence = formatAskAnswerEvidenceBlock(pack);
	if (!evidence.trim()) return empty;
	const messages = [
		{ role: "system" as const, content: ASK_ANSWER_SYSTEM },
		{
			role: "user" as const,
			content: buildAskAnswerUserPrompt({
				question: options.question,
				evidence,
				guidance: options.guidance,
				history: options.history,
			}),
		},
	];
	const plannerChat = askPlannerChatOptions(options.model);
	let content = "";
	let reasoning = "";
	let usedModel = options.model;
	let usedJsonMode = plannerChat.jsonMode;
	const runStream = async (jsonMode: boolean) => {
		content = "";
		reasoning = "";
		usedModel = options.model;
		usedJsonMode = jsonMode;
		for await (const chunk of openRouterChatStream({
			model: options.model,
			messages,
			maxTokens: ASK_PLANNER_MAX_TOKENS,
			reasoningEffort: plannerChat.reasoningEffort,
			jsonMode,
			signal: options.signal ?? AbortSignal.timeout(90_000),
		})) {
			if (chunk.reasoning) {
				reasoning += chunk.reasoning;
				options.onReasoning?.(chunk.reasoning);
			}
			if (chunk.content) content += chunk.content;
			if (chunk.model) usedModel = chunk.model;
		}
	};
	try {
		await runStream(plannerChat.jsonMode);
	} catch (error) {
		if (errorStatus(error) === 400 && usedJsonMode) {
			console.warn(
				`[ai/ask] writer ${options.model} rejected json_mode; retrying without it`,
			);
			await runStream(false);
		} else {
			throw error;
		}
	}
	if (!reasoning.trim()) {
		const split = splitThinkTags(content);
		if (split.reasoning) {
			reasoning = split.reasoning;
			content = split.content;
			options.onReasoning?.(split.reasoning);
		}
	}
	const summary = parseAskAnswerSummary(content);
	if (!summary) return { ...empty, reasoning, model: usedModel };
	return { summary, model: usedModel, reasoning };
}
