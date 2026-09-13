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
	clipResearchRevisePlan,
	numberedReportForModel,
	parseResearchRevisePatch,
	reportBlocksContainingText,
	researchReviseFailedAsTooLong,
	researchReviseNeedsSearch,
	splitReportBlocks,
	type ResearchReportBlock,
	type ResearchRevisePatch,
	type ResearchRevisePlan,
} from "./aiAskResearchRevise";
import { extractJsonObject } from "./extractJsonObject";
import {
	searchDiscoursesForQueries,
	warmAskSearchIndexes,
} from "./aiDiscourseSearch";
import {
	prefixedAiDiscourseIdsInText,
	uniquePrefixedDiscourseIdsInText,
} from "./aiSearchQuery";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	ASK_WRITER_REASONING_EFFORT,
	askWriterChatOptions,
	getOpenRouterApiKey,
	openRouterChat,
} from "./openrouter";

/** DeepSeek V4 Flash allows 393k completions; 50k covers a full cited report. */
export const RESEARCH_REVISE_WRITER_MAX_TOKENS = 50_000;
export const RESEARCH_REVISE_NEW_HITS_MAX = 8;

/**
 * First pass: decide exactly which blocks the edit touches and what evidence
 * (one search, a few full reads) the writer will need. Cheap output, so it can
 * spend its reasoning on the report rather than on prose.
 */
export const RESEARCH_REVISE_PLAN_SYSTEM = `You plan one edit to a research report written from early Buddhist discourses. Every block of the report is labelled [[pN]]. Read the instruction and the report, then return JSON only:
{"targets":["p12"],"intent":"one or two sentences naming the exact change: which block(s), what happens to each","searchQueries":[],"readFull":[]}

Rules:
- "targets": the block ids the edit must change, insert next to, or delete — the smallest set that carries out the instruction. If the reader pinned a passage, its block is a target. Do not list blocks that merely relate to the topic.
- "intent": be concrete. Say what the reader wants done (e.g. “split p12: keep the lead-in, move the sentence in quotation marks into its own > blockquote with its SN citation, keep the rest as a following paragraph; leave p13 unchanged”).
- "searchQueries": up to 3 short library searches, only when the instruction needs discourses the report does not yet cite (new evidence, more sources, a topic not covered). Leave empty for edits the report's own text can satisfy.
- "readFull": up to 4 discourse ids (mn10, sn48.42) whose full text the writer needs to quote word-for-word — the discourses already cited in the target blocks when quotations are asked for, or ids the instruction names. Leave empty otherwise.
- If the instruction is only about wording, layout, or structure, return empty searchQueries and readFull.`;

export const RESEARCH_REVISE_SYSTEM = `You are the editor of a research report written from early Buddhist discourses. You do not search. You do not invent citations. You make the smallest edit that fully carries out the instruction, so the revised report reads as one continuous piece.

The report is given with every block (heading, paragraph, list, quotation) labelled [[pN]]. Address blocks by id. Return JSON only:
{"changelog":"one or two sentences: what changed, where, and which discourses were newly cited","ops":[
 {"op":"update","id":"p12","markdown":"replacement for block p12 — may be one block, or several blocks separated by blank lines (e.g. paragraph, > quotation, paragraph) when a block is split"},
 {"op":"insert-after","id":"p12","markdown":"new block(s) placed after p12"},
 {"op":"insert-before","id":"p12","markdown":"new block(s) placed before p12"},
 {"op":"delete","id":"p13"}
]}

Choosing ops:
- Rewriting, tightening, expanding, correcting, reformatting, or adding a quotation to an existing block → "update" that block. The replacement must carry forward every point and citation from it that still holds. Never insert a new block when the instruction is to change an existing one.
- Turning an embedded quotation into a sutta quote → "update" the block with three parts: the prose before the quotation, a "> " blockquote holding only the words in quotation marks plus its citation, then the prose after. Do not move text from neighbouring blocks into the quotation, and do not touch neighbouring blocks.
- New material → "insert-after" (or "insert-before") the block it belongs next to. A new section is an insert whose markdown begins with a "## Heading" line. Prefer weaving new material into the section it belongs to over appending a section.
- Removing text → "delete" the block, or "update" it without the removed sentences.
- Renaming a heading → "update" the heading block.
- Only the target blocks change unless the instruction cannot be carried out otherwise; every other block stays as it is. Do not reprint unchanged blocks. Never include [[pN]] labels inside "markdown".

Continuity (the revised text must not read as bolted on):
- Match the report's voice, tense, terminology, transliteration, and citation style exactly. Reuse its phrasing for recurring concepts.
- Open a rewritten block so it follows from the block before it and leads into the one after; do not restate what neighbouring blocks already say.
- No meta-commentary ("This paragraph…", "As requested…", "Revised:").

Quotations:
- When the instruction asks for quotes, quotations, or the Buddha's words, include direct quotations in double quotation marks, copied word-for-word from the passages supplied (or from wording already quoted in the report), each followed by its discourse ID exactly as the passage labels it. Do not paraphrase inside quotation marks and do not quote from memory.
- Set-off quotations use the report's existing form: a "> " blockquote with the quoted words in quotation marks followed by the discourse ID.
- If the supplied passages do not contain a fitting line, say so in the changelog instead of inventing one.

Citations:
- Ordinary discourse IDs in prose (MN 10, SN 22.59). Do not invent IDs.
- When new passages are supplied, cite their discourse IDs in the edited markdown so they appear as citations. Do not drop citations that were in the original block.
- No ## Sources section — the harness rebuilds it.

Scope:
- Ops may touch any number of blocks; finish every op you start.
- If a heading was pinned, edit within that section unless the instruction names others.
- Write only from the report plus any supplied passages. If passages are empty, do not pad.`;

export const RESEARCH_REVISE_PLANNER_MAX_TOKENS = 4_000;
export const RESEARCH_REVISE_PLANNER_BUDGET_MS = 120_000;

/**
 * Planner call. Returns null (the writer then works from heuristics) when the
 * model is unavailable, times out, or answers with nothing usable.
 */
export async function planResearchRevise(options: {
	report: string;
	instruction: string;
	heading?: string;
	quote?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<{ plan: ResearchRevisePlan | null; model: string }> {
	const empty = { plan: null, model: "" };
	if (!getOpenRouterApiKey()) return empty;
	const instruction = clipResearchReviseInstruction(options.instruction);
	const blocks = splitReportBlocks(options.report);
	if (!instruction || blocks.length === 0) return empty;
	const heading = clipResearchReviseHeading(options.heading || "");
	const quote = clipResearchReviseQuote(options.quote || "");
	const pinnedIds = quote ? reportBlocksContainingText(blocks, quote) : [];
	const watchdog = createWatchdogAbortSignal({
		idleMs: ASK_WRITER_IDLE_MS,
		maxMs: options.timeoutMs ?? RESEARCH_REVISE_PLANNER_BUDGET_MS,
		parent: options.signal,
	});
	try {
		const writerOpts = askWriterChatOptions(ASK_PLANNER_PAID_FALLBACK_MODEL);
		const result = await openRouterChat({
			model: ASK_PLANNER_PAID_FALLBACK_MODEL,
			maxTokens: RESEARCH_REVISE_PLANNER_MAX_TOKENS,
			reasoningEffort: writerOpts.reasoningEffort || ASK_WRITER_REASONING_EFFORT,
			jsonMode: writerOpts.jsonMode,
			signal: watchdog.signal,
			messages: [
				{ role: "system", content: RESEARCH_REVISE_PLAN_SYSTEM },
				{
					role: "user",
					content: `Instruction: ${instruction}
${heading ? `Pinned heading: ${heading}\n` : ""}${
						quote
							? `Pinned passage (the reader selected this${pinnedIds.length ? `; it sits in ${pinnedIds.join(", ")}` : ""}): ${quote}\n`
							: ""
					}
Report with block ids:
${numberedReportForModel(blocks)}

JSON:`,
				},
			],
		});
		watchdog.ping();
		const plan = clipResearchRevisePlan(extractJsonObject(result.content || ""));
		if (plan && pinnedIds.length) {
			// The pinned block is always in scope, whatever the planner said.
			plan.targets = [...new Set([...pinnedIds, ...plan.targets])].slice(0, 12);
		}
		return { plan, model: result.model || ASK_PLANNER_PAID_FALLBACK_MODEL };
	} catch {
		return empty;
	} finally {
		watchdog.dispose();
	}
}

/** Human-readable label for the discourse ids the planner asked to read. */
export function reviseReadFullLabel(ids: readonly string[]): string {
	return ids
		.map((id) => id.replace(/^([a-z]+)(\d.*)$/i, (_m, book: string, num: string) => `${book.toUpperCase()} ${num}`))
		.join(", ");
}

/** Instructions that want verbatim lines from the discourses. */
export function reviseWantsQuotes(instruction: string): boolean {
	return /\b(quot(?:e|es|ed|ation|ations)|verbatim|in (?:the buddha's|his) (?:own )?words|word[- ]for[- ]word|passage text)\b/i.test(
		instruction,
	);
}

/** How many already-cited discourses to re-read in full for a quote request. */
export const RESEARCH_REVISE_QUOTE_CONTEXT_MAX = 4;

/**
 * Existing hits the pinned passage / section already cites. When the reader
 * asks for quotations we re-read those in full so the writer can copy lines
 * word-for-word instead of paraphrasing from memory.
 */
export function reviseQuoteContextHits(options: {
	instruction: string;
	contextText: string;
	existingHits: readonly AiDiscourseHit[];
}): AiDiscourseHit[] {
	if (!reviseWantsQuotes(options.instruction)) return [];
	const ids = uniquePrefixedDiscourseIdsInText(options.contextText).map((id) =>
		id.toLowerCase(),
	);
	if (ids.length === 0) return [];
	const bySlug = new Map(
		options.existingHits.map((hit) => [hit.slug.trim().toLowerCase(), hit]),
	);
	const out: AiDiscourseHit[] = [];
	for (const id of ids) {
		const hit = bySlug.get(id);
		if (!hit) continue;
		out.push(hit);
		if (out.length >= RESEARCH_REVISE_QUOTE_CONTEXT_MAX) break;
	}
	return out;
}

/** Re-reads cap when the planner names discourses to quote from. */
export const RESEARCH_REVISE_REREAD_MAX = 6;

/**
 * What the evidence step will do for this revision, before any I/O. With a
 * plan the planner decides; without one the old instruction heuristics apply.
 */
export function planReviseEvidence(options: {
	instruction: string;
	existingHits: readonly AiDiscourseHit[];
	contextText?: string;
	plan?: ResearchRevisePlan | null;
}): { queries: string[]; reread: AiDiscourseHit[]; needsSearch: boolean } {
	const plan = options.plan || null;
	const named = prefixedAiDiscourseIdsInText(options.instruction);
	const bySlug = new Map(
		options.existingHits.map((hit) => [hit.slug.trim().toLowerCase(), hit]),
	);
	const reread: AiDiscourseHit[] = [];
	const rereadSeen = new Set<string>();
	const pushReread = (hit: AiDiscourseHit | undefined) => {
		if (!hit) return;
		const slug = hit.slug.trim().toLowerCase();
		if (rereadSeen.has(slug) || reread.length >= RESEARCH_REVISE_REREAD_MAX) return;
		rereadSeen.add(slug);
		reread.push(hit);
	};
	const missingReads: string[] = [];
	for (const id of plan?.readFull || []) {
		const hit = bySlug.get(id);
		if (hit) pushReread(hit);
		else missingReads.push(id);
	}
	for (const hit of reviseQuoteContextHits({
		instruction: options.instruction,
		contextText: options.contextText || "",
		existingHits: options.existingHits,
	})) {
		pushReread(hit);
	}
	const queries: string[] = [];
	const querySeen = new Set<string>();
	const pushQuery = (q: string) => {
		const text = q.replace(/\s+/g, " ").trim().slice(0, 120);
		const key = text.toLowerCase();
		if (!text || querySeen.has(key) || queries.length >= 6) return;
		querySeen.add(key);
		queries.push(text);
	};
	named.forEach(pushQuery);
	missingReads.forEach((id) => pushQuery(reviseReadFullLabel([id])));
	(plan?.searchQueries || []).forEach(pushQuery);
	let needsSearch = queries.length > 0;
	if (!plan && !needsSearch && researchReviseNeedsSearch(options.instruction, named)) {
		pushQuery(options.instruction);
		needsSearch = true;
	}
	return { queries, reread, needsSearch };
}

export async function gatherReviseEvidence(options: {
	instruction: string;
	existingHits: readonly AiDiscourseHit[];
	/** Pinned quote + pinned section markdown; drives quote re-reads. */
	contextText?: string;
	/** Planner output; when present it decides searches and re-reads. */
	plan?: ResearchRevisePlan | null;
	signal?: AbortSignal;
}): Promise<{ hits: AiDiscourseHit[]; evidence: string; reread: AiDiscourseHit[] }> {
	const { queries, reread, needsSearch } = planReviseEvidence(options);
	if (!needsSearch && reread.length === 0) {
		return { hits: [], evidence: "", reread: [] };
	}
	if (!getOpenRouterApiKey()) return { hits: [], evidence: "", reread: [] };
	if (!needsSearch) {
		const evidence = await buildResearchReportEvidence({
			question: options.instruction,
			hits: reread,
			readFullSlugs: reread.map((hit) => hit.slug),
			maxExpanded: reread.length,
		});
		return { hits: [], evidence, reread };
	}
	await warmAskSearchIndexes();
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
	if (hits.length === 0 && reread.length === 0) {
		return { hits: [], evidence: "", reread: [] };
	}
	const evidence = await buildResearchReportEvidence({
		question: options.instruction,
		hits: [...hits, ...reread],
		namedQueries: queries,
		readFullSlugs: reread.map((hit) => hit.slug),
		maxExpanded: RESEARCH_REVISE_NEW_HITS_MAX + reread.length,
	});
	return { hits, evidence, reread };
}

/** The writer's user message; exported so tests can check what the model sees. */
export function buildReviseWriterMessage(options: {
	blocks: readonly ResearchReportBlock[];
	instruction: string;
	heading?: string;
	quote?: string;
	evidence?: string;
	plan?: ResearchRevisePlan | null;
}): string {
	const heading = clipResearchReviseHeading(options.heading || "");
	const quote = clipResearchReviseQuote(options.quote || "");
	const evidence = (options.evidence || "").trim();
	const pinnedIds = quote ? reportBlocksContainingText(options.blocks, quote) : [];
	const known = new Set(options.blocks.map((block) => block.id));
	const targets = [
		...new Set([...pinnedIds, ...(options.plan?.targets || [])]),
	].filter((id) => known.has(id));
	const targetBlocks = options.blocks.filter((block) => targets.includes(block.id));
	const lines: string[] = [`Instruction: ${options.instruction}`];
	if (options.plan?.intent) lines.push(`Plan (from a first pass over the report): ${options.plan.intent}`);
	if (heading) lines.push(`Pinned heading: ${heading} (edit within this section)`);
	if (quote) {
		lines.push(
			`Pinned passage (the reader selected this${pinnedIds.length ? `; it sits in ${pinnedIds.join(", ")}` : ""}): ${quote}`,
		);
	}
	if (targets.length) {
		lines.push(
			`Target blocks: ${targets.join(", ")} — change these; leave every other block untouched unless the instruction cannot be carried out otherwise.`,
		);
		lines.push("", "Target blocks as they stand now:");
		for (const block of targetBlocks) lines.push(`[[${block.id}]]`, block.markdown, "");
	}
	lines.push("", "Current report, with block ids:", numberedReportForModel(options.blocks), "");
	lines.push(
		evidence
			? `Passages (verbatim discourse text; quote from these word-for-word, cite their IDs):\n${evidence}\n`
			: "No passages supplied — do not add quotations you cannot copy from the report itself.\n",
	);
	lines.push("JSON:");
	return lines.join("\n");
}

export async function writeResearchRevise(options: {
	report: string;
	instruction: string;
	heading?: string;
	quote?: string;
	evidence?: string;
	plan?: ResearchRevisePlan | null;
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<{
	patch: ResearchRevisePatch | null;
	model: string;
	tooLong?: boolean;
}> {
	const empty = { patch: null, model: "" };
	if (!getOpenRouterApiKey()) return empty;
	const budget = options.timeoutMs ?? Math.max(resolveAskWriterBudgetMs(0), 240_000);
	if (budget < ASK_WRITER_MIN_MS) return empty;
	const instruction = clipResearchReviseInstruction(options.instruction);
	const report = options.report.replace(/\r\n/g, "\n").trim();
	if (!instruction || !report) return empty;
	const blocks = splitReportBlocks(report);
	if (blocks.length === 0) return empty;
	const watchdog = createWatchdogAbortSignal({
		idleMs: ASK_WRITER_IDLE_MS,
		maxMs: budget,
		parent: options.signal,
	});
	try {
		const writerOpts = askWriterChatOptions(ASK_PLANNER_PAID_FALLBACK_MODEL);
		const result = await openRouterChat({
			model: ASK_PLANNER_PAID_FALLBACK_MODEL,
			maxTokens: RESEARCH_REVISE_WRITER_MAX_TOKENS,
			reasoningEffort: writerOpts.reasoningEffort || ASK_WRITER_REASONING_EFFORT,
			jsonMode: writerOpts.jsonMode,
			signal: watchdog.signal,
			messages: [
				{ role: "system", content: RESEARCH_REVISE_SYSTEM },
				{
					role: "user",
					content: buildReviseWriterMessage({
						blocks,
						instruction,
						heading: options.heading,
						quote: options.quote,
						evidence: options.evidence,
						plan: options.plan,
					}),
				},
			],
		});
		watchdog.ping();
		const patch = parseResearchRevisePatch(result.content || "");
		if (patch && !patch.changelog) {
			patch.changelog = clipResearchChangelog(instruction);
		}
		if (
			researchReviseFailedAsTooLong({
				patch,
				truncated: result.truncated,
				content: result.content,
			})
		) {
			return {
				patch: null,
				model: result.model || ASK_PLANNER_PAID_FALLBACK_MODEL,
				tooLong: true,
			};
		}
		return {
			patch,
			model: result.model || ASK_PLANNER_PAID_FALLBACK_MODEL,
		};
	} finally {
		watchdog.dispose();
	}
}
