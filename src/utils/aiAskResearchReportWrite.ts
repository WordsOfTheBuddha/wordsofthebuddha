import type { SearchData } from "../service/search/search";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	ADAPTIVE_WRITER_FALLBACK_TPS,
	ASK_WRITER_IDLE_MS,
	ASK_WRITER_MIN_MS,
	RESEARCH_EXCERPT_CHARS,
	RESEARCH_EXCERPT_PARAS,
	askAnswerHints,
	buildAskAnswerEvidence,
	createWatchdogAbortSignal,
	formatAskAnswerEvidenceBlock,
	resolveAdaptiveWriterMaxTokens,
	resolveAskWriterBudgetMs,
} from "./aiAskAnswer";
import { formatAttachedMaterialBlock } from "./aiAskComposition";
import type { AiRewriteHistoryTurn } from "./aiQueryRewrite";
import { clipAiQuestion } from "./aiAskQuestionText";
import {
	parseResearchReportMarkdown,
	replaceResearchSourcesSection,
	RESEARCH_REPORT_SYSTEM,
	takeResearchReadPaliRequest,
	type ResearchReportResult,
} from "./aiAskResearchReport";
import {
	finishResearchReportLength,
	researchReportLengthGuidance,
	stripResearchReportLengthNote,
} from "./aiAskResearchReportLength";

import type { DiscourseEvidenceSpan } from "./discourseEvidenceSpan";
import { resolveResearchReadFullSlugs } from "./aiAskResearchContinue";
import { clipDiscourseSvgRequestSlugs } from "./discourseSvgForAi";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	ASK_WRITER_REASONING_EFFORT,
	RESEARCH_WRITER_MAX_TOKENS,
	getOpenRouterApiKey,
	openRouterAuthHeaders,
	openRouterChatStream,
	splitThinkTags,
} from "./openrouter";
import {
	estimatePaidRouteInputTokens,
	loadPaidRouteCatalog,
	paidRouteAttempts,
} from "./paidModelRoute";

/** Research writer reads more of the selected set than a short Ask briefing. */
export const RESEARCH_ANSWER_MAX_EXPANDED = 28;

/** Told to the writer so a long report stops as a finished piece inside the clock. */
export function researchReportWriterBudgetNote(maxTokens: number): string {
	const cap = Math.max(1, Math.floor(maxTokens));
	return `Completion budget: finish the whole report within ${cap} tokens. If that is tighter than the word guidance, write a shorter finished report. Close the section you are in, and do not start a section you cannot finish.`;
}

async function reportWriterTokensPerSecond(inputTokens: number): Promise<number> {
	try {
		const catalog = await loadPaidRouteCatalog({
			headers: openRouterAuthHeaders(),
		});
		const [first] = paidRouteAttempts(catalog, {
			inputTokens,
			kind: "report",
		});
		if (first?.throughput != null && first.throughput > 0) return first.throughput;
	} catch {
		/* A missing catalog still gets a conservative speed. */
	}
	return ADAPTIVE_WRITER_FALLBACK_TPS;
}

export async function buildResearchReportEvidence(options: {
	question: string;
	hits: readonly AiDiscourseHit[];
	termQueries?: readonly string[];
	namedQueries?: readonly string[];
	readFullSlugs?: readonly string[];
	readPaliSlugs?: readonly string[];
	readIllustrationSlugs?: readonly string[];
	spanBySlug?: Readonly<Record<string, DiscourseEvidenceSpan>>;
	loadDoc?: (slug: string) => Promise<SearchData | undefined>;
	maxExpanded?: number;
}): Promise<string> {
	const hints = askAnswerHints(options.question, options.termQueries);
	const maxExpanded = options.maxExpanded ?? RESEARCH_ANSWER_MAX_EXPANDED;
	const slugs = options.hits.map((hit) => hit.slug);
	const pack = await buildAskAnswerEvidence(
		options.hits,
		hints,
		options.loadDoc,
		maxExpanded,
		{
			fullSlugs: resolveResearchReadFullSlugs(
				options.namedQueries,
				slugs,
				options.readFullSlugs,
			),
			paliSlugs: resolveResearchReadFullSlugs(
				[],
				slugs,
				options.readPaliSlugs,
			),
			svgSlugs: clipDiscourseSvgRequestSlugs(
				options.readIllustrationSlugs || [],
			),
			excerptChars: RESEARCH_EXCERPT_CHARS,
			excerptParas: RESEARCH_EXCERPT_PARAS,
			labelParagraphs: true,
			spanBySlug: options.spanBySlug,
		},
	);
	return formatAskAnswerEvidenceBlock({ ...pack, markCore: true });
}

export async function writeResearchReport(options: {
	question: string;
	/** Wording before planner cleanup — may still name a word count. */
	originalQuestion?: string;
	brief?: string;
	/** Research-only reader-provided notes (separate from clarify brief). */
	attachedContext?: string;
	hits: readonly AiDiscourseHit[];
	model?: string;
	termQueries?: readonly string[];
	guidance?: string;
	history?: readonly AiRewriteHistoryTurn[];
	onReasoning?: (delta: string) => void;
	signal?: AbortSignal;
	timeoutMs?: number;
	loadDoc?: (slug: string) => Promise<SearchData | undefined>;
	maxExpanded?: number;
	priorReport?: string;
	readFullSlugs?: readonly string[];
	/** Selected slugs to open in Pāli and English. */
	readPaliSlugs?: readonly string[];
	/** Selected slugs to inline site SVG markup for. */
	readIllustrationSlugs?: readonly string[];
	/** Search strings that may name already-selected discourse IDs. */
	namedQueries?: readonly string[];
}): Promise<ResearchReportResult> {
	const empty: ResearchReportResult = { report: "", model: "", reasoning: "" };
	const model = options.model || ASK_PLANNER_PAID_FALLBACK_MODEL;
	const budget = options.timeoutMs ?? resolveAskWriterBudgetMs(0);
	if (
		budget < ASK_WRITER_MIN_MS ||
		options.hits.length === 0 ||
		!getOpenRouterApiKey()
	) {
		return empty;
	}
	const prepStarted = Date.now();
	const maxExpanded = options.maxExpanded ?? RESEARCH_ANSWER_MAX_EXPANDED;
	const evidence = await buildResearchReportEvidence({
		question: options.question,
		hits: options.hits,
		termQueries: options.termQueries,
		namedQueries: options.namedQueries,
		readFullSlugs: options.readFullSlugs,
		readPaliSlugs: options.readPaliSlugs,
		readIllustrationSlugs: options.readIllustrationSlugs,
		loadDoc: options.loadDoc,
		maxExpanded,
	});
	if (options.signal?.aborted || !evidence.trim()) return empty;
	const clarifyBrief = (options.brief || "").replace(/\s+/g, " ").trim();
	const attachedBlock = formatAttachedMaterialBlock(
		options.attachedContext || "",
	);
	const brief = [clarifyBrief, attachedBlock].filter(Boolean).join("\n\n");
	const originalQuestion = (options.originalQuestion || "")
		.replace(/\s+/g, " ")
		.trim();
	const lengthSources = {
		question: options.question,
		originalQuestion,
		// Attached prior reports can quote old word-count asks; honor this turn only.
		brief: clarifyBrief,
	};
	const guidance = [
		options.guidance,
		researchReportLengthGuidance(
			lengthSources.question,
			lengthSources.originalQuestion,
			lengthSources.brief,
		),
	]
		.map((part) => (part || "").replace(/\s+/g, " ").trim())
		.filter(Boolean)
		.join(" ");
	const prior = stripResearchReportLengthNote(
		(options.priorReport || "").replace(/\r\n/g, "\n"),
	);
	const userContent = `Question: ${clipAiQuestion(options.question)}
${brief ? `Clarifying brief:\n${brief}\n` : ""}${guidance ? `Guidance: ${guidance}\n` : ""}${prior ? `Previous draft to improve (keep what still holds; revise from the new passages):\n${prior}\n` : ""}
Passages from the selected discourses (at most ${maxExpanded} expanded; some may be full text, and some may include Pāli with the English). [core] / English is the site's core translation; [reference] / Sujato English is Bhikkhu Sujato's reference translation:
${evidence}`;
	const tokensPerSecond = await reportWriterTokensPerSecond(
		estimatePaidRouteInputTokens(`${RESEARCH_REPORT_SYSTEM}\n${userContent}`),
	);
	const writeBudget = budget - (Date.now() - prepStarted);
	if (writeBudget < ASK_WRITER_MIN_MS) return empty;
	const maxTokens = resolveAdaptiveWriterMaxTokens(
		writeBudget,
		tokensPerSecond,
		RESEARCH_WRITER_MAX_TOKENS,
	);
	console.info(
		`[ai/research] writer cap maxTokens=${maxTokens} tps=${Math.round(tokensPerSecond)} budgetMs=${writeBudget}`,
	);
	const messages = [
		{ role: "system" as const, content: RESEARCH_REPORT_SYSTEM },
		{
			role: "user" as const,
			content: `${userContent}

${researchReportWriterBudgetNote(maxTokens)}

Markdown report:`,
		},
	];
	const watchdog = createWatchdogAbortSignal({
		idleMs: ASK_WRITER_IDLE_MS,
		maxMs: writeBudget,
		parent: options.signal,
	});
	try {
		let content = "";
		let reasoning = "";
		let usedModel = model;
		for await (const chunk of openRouterChatStream({
			model,
			messages,
			maxTokens,
			reasoningEffort: ASK_WRITER_REASONING_EFFORT,
			jsonMode: false,
			routeKind: "report",
			signal: watchdog.signal,
		})) {
			watchdog.ping();
			if (chunk.reasoning) {
				reasoning += chunk.reasoning;
				options.onReasoning?.(chunk.reasoning);
			}
			if (chunk.content) content += chunk.content;
			if (chunk.model) usedModel = chunk.model;
		}
		if (!reasoning.trim()) {
			const split = splitThinkTags(content);
			if (split.reasoning) {
				reasoning = split.reasoning;
				content = split.content;
				options.onReasoning?.(split.reasoning);
			}
		}
		const taken = takeResearchReadPaliRequest(
			parseResearchReportMarkdown(content),
		);
		const report = finishResearchReportLength(
			replaceResearchSourcesSection(taken.report, options.hits),
			lengthSources,
		);
		const selected = options.hits.map((hit) => hit.slug);
		const readPali = resolveResearchReadFullSlugs(
			taken.readPali,
			selected,
		);
		const readIllustration = clipDiscourseSvgRequestSlugs(
			resolveResearchReadFullSlugs(taken.readIllustration, selected),
		);
		if (!report) {
			return { ...empty, reasoning, model: usedModel, readPali, readIllustration };
		}
		return { report, model: usedModel, reasoning, readPali, readIllustration };
	} finally {
		watchdog.dispose();
	}
}
