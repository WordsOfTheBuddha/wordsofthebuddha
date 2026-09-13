import type { SearchData } from "../service/search/search";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	ASK_WRITER_IDLE_MS,
	ASK_WRITER_MIN_MS,
	RESEARCH_EXCERPT_CHARS,
	RESEARCH_EXCERPT_PARAS,
	askAnswerHints,
	buildAskAnswerEvidence,
	createWatchdogAbortSignal,
	formatAskAnswerEvidenceBlock,
	resolveAskWriterBudgetMs,
} from "./aiAskAnswer";
import type { AiRewriteHistoryTurn } from "./aiQueryRewrite";
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

import { resolveResearchReadFullSlugs } from "./aiAskResearchContinue";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	ASK_WRITER_REASONING_EFFORT,
	RESEARCH_WRITER_MAX_TOKENS,
	getOpenRouterApiKey,
	openRouterChatStream,
	splitThinkTags,
} from "./openrouter";

/** Research writer reads more of the selected set than a short Ask briefing. */
export const RESEARCH_ANSWER_MAX_EXPANDED = 28;

export async function buildResearchReportEvidence(options: {
	question: string;
	hits: readonly AiDiscourseHit[];
	termQueries?: readonly string[];
	namedQueries?: readonly string[];
	readFullSlugs?: readonly string[];
	readPaliSlugs?: readonly string[];
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
			excerptChars: RESEARCH_EXCERPT_CHARS,
			excerptParas: RESEARCH_EXCERPT_PARAS,
			labelParagraphs: true,
		},
	);
	return formatAskAnswerEvidenceBlock({ ...pack, markCore: true });
}

export async function writeResearchReport(options: {
	question: string;
	/** Wording before planner cleanup — may still name a word count. */
	originalQuestion?: string;
	brief?: string;
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
	const watchdog = createWatchdogAbortSignal({
		idleMs: ASK_WRITER_IDLE_MS,
		maxMs: budget,
		parent: options.signal,
	});
	try {
		const maxExpanded = options.maxExpanded ?? RESEARCH_ANSWER_MAX_EXPANDED;
		const evidence = await buildResearchReportEvidence({
			question: options.question,
			hits: options.hits,
			termQueries: options.termQueries,
			namedQueries: options.namedQueries,
			readFullSlugs: options.readFullSlugs,
			readPaliSlugs: options.readPaliSlugs,
			loadDoc: options.loadDoc,
			maxExpanded,
		});
		if (watchdog.signal.aborted) return empty;
		if (!evidence.trim()) return empty;
		const brief = (options.brief || "").replace(/\s+/g, " ").trim();
		const originalQuestion = (options.originalQuestion || "")
			.replace(/\s+/g, " ")
			.trim();
		const lengthSources = {
			question: options.question,
			originalQuestion,
			brief,
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
		const messages = [
			{ role: "system" as const, content: RESEARCH_REPORT_SYSTEM },
			{
				role: "user" as const,
				content: `Question: ${options.question.replace(/\s+/g, " ").trim()}
${brief ? `Clarifying brief:\n${brief}\n` : ""}${guidance ? `Guidance: ${guidance}\n` : ""}${prior ? `Previous draft to improve (keep what still holds; revise from the new passages):\n${prior}\n` : ""}
Passages from the selected discourses (at most ${maxExpanded} expanded; some may be full text, and some may include Pāli with the English). [core] / English is the site's core translation; [reference] / Sujato English is Bhikkhu Sujato's reference translation:
${evidence}

Markdown report:`,
			},
		];
		let content = "";
		let reasoning = "";
		let usedModel = model;
		for await (const chunk of openRouterChatStream({
			model,
			messages,
			maxTokens: RESEARCH_WRITER_MAX_TOKENS,
			reasoningEffort: ASK_WRITER_REASONING_EFFORT,
			jsonMode: false,
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
		const readPali = resolveResearchReadFullSlugs(
			taken.readPali,
			options.hits.map((hit) => hit.slug),
		);
		if (!report) return { ...empty, reasoning, model: usedModel, readPali };
		return { report, model: usedModel, reasoning, readPali };
	} finally {
		watchdog.dispose();
	}
}
