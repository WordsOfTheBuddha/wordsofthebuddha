import type { AiDiscourseHit } from "./aiDiscourseHits";
import { toPublicAskHit } from "./aiDiscourseHits";
import {
	ASK_WRITER_IDLE_MS,
	ASK_WRITER_MIN_MS,
	createWatchdogAbortSignal,
	resolveAskWriterBudgetMs,
} from "./aiAskAnswer";
import { buildResearchReportEvidence } from "./aiAskResearchReportWrite";
import {
	clipResearchChangelog,
	clipResearchReviseHeading,
	clipResearchReviseInstruction,
	clipResearchReviseQuote,
	parseResearchRevisePatch,
	researchReviseNeedsSearch,
	RESEARCH_REVISE_MAX_OUTPUT_WORDS,
	type ResearchRevisePatch,
} from "./aiAskResearchRevise";
import {
	searchDiscoursesForQueries,
	warmAskSearchIndexes,
} from "./aiDiscourseSearch";
import { prefixedAiDiscourseIdsInText } from "./aiSearchQuery";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	ASK_WRITER_REASONING_EFFORT,
	getOpenRouterApiKey,
	openRouterChat,
} from "./openrouter";

export const RESEARCH_REVISE_WRITER_MAX_TOKENS = 8_192;
export const RESEARCH_REVISE_NEW_HITS_MAX = 8;

export const RESEARCH_REVISE_SYSTEM = `You edit a research report written from early Buddhist discourses. You do not search. You do not invent citations.

Return JSON only:
{"changelog":"one sentence of what changed","edits":[{"heading":"exact ## heading text or empty for the opening","mode":"replace","markdown":"## Heading\\n\\nupdated markdown"}]}

Rules:
- The current report is the base. Keep what still holds. Do not reprint untouched sections.
- edits may cover any number of places. Total words in all edits[].markdown combined must stay at or under ${RESEARCH_REVISE_MAX_OUTPUT_WORDS}.
- mode is "replace" (swap that section) or "insert-after" (new section after that heading).
- markdown for a replace should start with the same ## heading unless you are renaming it.
- Write only from the report plus any new passages supplied. If new passages are empty, do not pad.
- Ordinary discourse IDs in prose (MN 10, SN 22.59). Do not invent IDs.
- No ## Sources section — the harness rebuilds it.
- changelog: one short sentence of what this version changed, for the version list.
- If a heading was pinned, prefer editing that section; you may still edit others the instruction names.`;

export async function gatherReviseEvidence(options: {
	instruction: string;
	existingHits: readonly AiDiscourseHit[];
	signal?: AbortSignal;
}): Promise<{ hits: AiDiscourseHit[]; evidence: string }> {
	const named = prefixedAiDiscourseIdsInText(options.instruction);
	if (!researchReviseNeedsSearch(options.instruction, named)) {
		return { hits: [], evidence: "" };
	}
	if (!getOpenRouterApiKey()) return { hits: [], evidence: "" };
	await warmAskSearchIndexes();
	const queries =
		named.length > 0
			? named.slice(0, 6)
			: [options.instruction.replace(/\s+/g, " ").trim().slice(0, 120)];
	const searched = await searchDiscoursesForQueries(queries, [], {
		mergeLimit: 40,
		question: options.instruction,
	});
	const existing = new Set(
		options.existingHits.map((hit) => hit.slug.trim().toLowerCase()),
	);
	const hits: AiDiscourseHit[] = [];
	for (const hit of searched.hits) {
		const slug = hit.slug.trim().toLowerCase();
		if (!slug || existing.has(slug)) continue;
		hits.push(toPublicAskHit(hit));
		existing.add(slug);
		if (hits.length >= RESEARCH_REVISE_NEW_HITS_MAX) break;
	}
	if (hits.length === 0) return { hits: [], evidence: "" };
	const evidence = await buildResearchReportEvidence({
		question: options.instruction,
		hits,
		namedQueries: queries,
		maxExpanded: RESEARCH_REVISE_NEW_HITS_MAX,
	});
	return { hits, evidence };
}

export async function writeResearchRevise(options: {
	report: string;
	instruction: string;
	heading?: string;
	quote?: string;
	evidence?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<{ patch: ResearchRevisePatch | null; model: string }> {
	const empty = { patch: null, model: "" };
	if (!getOpenRouterApiKey()) return empty;
	const budget = options.timeoutMs ?? resolveAskWriterBudgetMs(0);
	if (budget < ASK_WRITER_MIN_MS) return empty;
	const instruction = clipResearchReviseInstruction(options.instruction);
	const report = options.report.replace(/\r\n/g, "\n").trim();
	if (!instruction || !report) return empty;
	const heading = clipResearchReviseHeading(options.heading || "");
	const quote = clipResearchReviseQuote(options.quote || "");
	const evidence = (options.evidence || "").trim();
	const watchdog = createWatchdogAbortSignal({
		idleMs: ASK_WRITER_IDLE_MS,
		maxMs: budget,
		parent: options.signal,
	});
	try {
		const result = await openRouterChat({
			model: ASK_PLANNER_PAID_FALLBACK_MODEL,
			maxTokens: RESEARCH_REVISE_WRITER_MAX_TOKENS,
			reasoningEffort: ASK_WRITER_REASONING_EFFORT,
			jsonMode: true,
			signal: watchdog.signal,
			messages: [
				{ role: "system", content: RESEARCH_REVISE_SYSTEM },
				{
					role: "user",
					content: `Instruction: ${instruction}
${heading ? `Pinned heading: ${heading}\n` : ""}${quote ? `Pinned quote: ${quote}\n` : ""}
Current report (markdown):
${report}

${evidence ? `New passages (use only if they close the instruction):\n${evidence}\n` : "No new passages.\n"}
JSON:`,
				},
			],
		});
		watchdog.ping();
		const patch = parseResearchRevisePatch(result.content || "");
		if (patch && !patch.changelog) {
			patch.changelog = clipResearchChangelog(instruction);
		}
		return {
			patch,
			model: result.model || ASK_PLANNER_PAID_FALLBACK_MODEL,
		};
	} finally {
		watchdog.dispose();
	}
}
