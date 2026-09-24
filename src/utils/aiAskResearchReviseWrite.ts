import type { ResearchContextImage } from "./aiAskComposition";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import { toPublicAskHit } from "./aiDiscourseHits";
import {
	ASK_WRITER_IDLE_MS,
	ASK_WRITER_MIN_MS,
	createWatchdogAbortSignal,
} from "./aiAskAnswer";
import { buildResearchReportEvidence } from "./aiAskResearchReportWrite";
import {
	clipResearchChangelog,
	clipResearchReviseHeading,
	clipResearchReviseInstruction,
	clipResearchReviseQuote,
	formatResearchReviseQuoteForModel,
	clipResearchRevisePlan,
	auditResearchRevisePatchConstraints,
	constrainResearchRevisePatch,
	ensureResearchReviseMermaidFences,
	formatResearchRevisePatchAuditLog,
	logResearchReviseWriterRawOutput,
	mermaidBlocksToFence,
	resolveResearchReviseTargets,
	pinnedBlockIdsFromReviseEdits,
	numberedReportForModel,
	parseResearchRevisePatch,
	reportBlocksContainingText,
	researchReviseFailedAsTooLong,
	researchReviseNeedsSearch,
	researchRevisePatchIsEmpty,
	reviseEditsPlannerScopeBlock,
	reviseEvidenceRequestedIds,
	RESEARCH_REVISE_TARGETS_MAX,
	splitReportBlocks,
	type ResearchReportBlock,
	type ResearchReviseEdit,
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
	buildEvidenceSpanBySlug,
	discourseEvidenceReadLabels,
} from "./discourseEvidenceSpan";
import { slugMatchesQuery } from "./searchRanking";
import {
	ASK_PLANNER_PAID_FALLBACK_MODEL,
	ASK_WRITER_REASONING_EFFORT,
	askWriterChatOptions,
	buildOpenRouterUserContent,
	getOpenRouterApiKey,
	openRouterChat,
} from "./openrouter";

function reviseReferenceImagesLead(count: number): string {
	if (count <= 0) return "";
	return `${count} reference image${count === 1 ? "" : "s"} attached by the reader (screenshots of visual issues, diagrams, etc.). Use them to understand what to fix.\n\n`;
}

function reviseModelUserContent(
	text: string,
	images?: readonly ResearchContextImage[],
): string | ReturnType<typeof buildOpenRouterUserContent> {
	return buildOpenRouterUserContent(
		`${reviseReferenceImagesLead(images?.length || 0)}${text}`,
		images,
	);
}

/** Paid GLM allows 131k completions; 50k covers a full cited report. */
export const RESEARCH_REVISE_WRITER_MAX_TOKENS = 50_000;
export const RESEARCH_REVISE_NEW_HITS_MAX = 8;

/**
 * First pass: decide exactly which blocks the edit touches and what evidence
 * (one search, a few full reads) the writer will need. Cheap output, so it can
 * spend its reasoning on the report rather than on prose.
 */
export const RESEARCH_REVISE_BLOCK_ID_NOTE = `Block ids: paragraphs, block quotations and lists are labelled [[pN]] — these are the same numbers the reader sees as ¶ N beside the report, so "P12", "paragraph 12" or "¶12" in the instruction means block p12 and nothing else. Headings are [[hN]], tables and rules [[tN]], fenced code or diagrams [[cN]]. Trust the id over any guess about what the reader meant; if the numbered block does not fit the instruction, say so in the intent rather than editing a neighbour.`;

export const RESEARCH_REVISE_STYLE_NOTE = `Two kinds of style language. A remark attached to a specific edit ("use em-dashes sparingly" while also asking to move ¶31–38) only constrains those edits and does not add targets. When the instruction itself is a report-wide transformation (reformat the report, add Pāli beside every English quote, give sections subsection titles, restyle as a study guide, fence every diagram), that IS the edit: target every block the transformation applies to.`;

export const RESEARCH_REVISE_PLAN_SYSTEM = `You plan one revision request to a research report written from early Buddhist discourses. The request may contain several independent changes; account for every explicit change while leaving everything else untouched. Read the current revision instruction, the original research request and preferences, and the report, then return JSON only:
{"targets":["p12"],"intent":"one or two sentences naming the exact change: which block(s), what happens to each","summary":"one line for the reader, under 140 characters","searchQueries":[],"readFull":[],"readPali":[],"readIllustration":[],"questions":[]}

${RESEARCH_REVISE_BLOCK_ID_NOTE}

Rules:
- "summary": the plan in the reader's terms, as short clauses joined by " · " — e.g. "delete ¶12 (duplicate of ¶11) · fence the diagram in ¶72 · add SN 47.10, 47.20, 47.42 after ¶35". Write paragraph ids as ¶12 (never p12); name headings and diagrams by their text. This line is shown to the reader while the revision runs.
- "questions": normally an empty array. Ask (at most 2) only when the instruction is genuinely ambiguous and guessing would risk editing the wrong block or doing the wrong thing — e.g. the reader's block number does not match the content they describe, an instruction could mean two different edits, or a named passage appears in several places. Never ask about style guidance, about things the report itself settles, or to confirm a plan you are confident in. Each question: {"id":"which","prompt":"one plain sentence, under 120 characters","choices":[{"id":"a","label":"a concrete option — for blocks, quote their opening words","blockId":"p11"}],"suggestedChoiceId":"a"}. Give 2–4 choices, each a real, specific alternative (the harness adds an "Other" free-text choice). Include "blockId" when a choice points at a block. Set "suggestedChoiceId" to the choice you would pick. When questions are present, still fill targets/intent/summary with your best reading.
- When edits are placeholder or test text (random keystrokes, single letters, numbers only), ask whether to cancel the revision or apply nothing — do not offer a choice to "retype" or "wait while the reader retypes"; rewording happens in the revise composer (Cancel, edit, resubmit) or via the harness "Other" choice if they truly mean something else.
- If the user message contains "Reader's answers", the questions have been asked and answered: follow those answers, treat them as part of the instruction, and return "questions": [].
- "targets": every block the revision must update, insert next to, or delete. If the reader names several changes, include targets for every one. If the reader pinned a passage, its block is a target. Write a run of consecutive blocks as one range ("p31-p38", "p21-p30"); the harness expands it. Kind-wide work uses an alias instead of listing ids: "quotes" (every blockquote), "headings", "diagrams" (fenced or broken mermaid), "paragraphs", or "all" / "report" for a whole-report restyle. Never trim the list to fit — an omitted block cannot be edited at all.
- Moving blocks (“X belongs after Y”, “move ¶31–38 under the Cook sub-section”): targets are the moved range AND the anchor block they land after (the last block of the destination sub-section, e.g. the final paragraph under the "Cook" heading). Say in "intent" which block is the anchor.
- Re-synthesizing or tightening a section: targets are that section's heading and every block under it, as a range.
- ${RESEARCH_REVISE_STYLE_NOTE}
- A bare "mermaid" / "flowchart" paragraph that is not inside a \`\`\` fence is a broken diagram; include that paragraph's id (or "diagrams") in targets. The harness will fence it if the writer skips the op.
- "intent": be concrete. Say what the reader wants done (e.g. “split p12: keep the lead-in, move the sentence in quotation marks into its own > blockquote with its SN citation, keep the rest as a following paragraph; leave p13 unchanged”).
- "searchQueries": up to 3 short library searches, only when the instruction needs discourses the report does not yet cite (new evidence, more sources, a topic not covered). Leave empty for edits the report's own text can satisfy.
- "readFull": up to 4 discourse ids (mn10, sn48.42, an1.485-494) whose full text the writer needs to quote word-for-word — the discourses already cited in the target blocks when quotations are asked for, or ids the instruction names. Range ids (AN 1.485–494) are valid; the harness resolves them to the file that contains that span. Leave empty otherwise.
- "readPali": discourse ids whose Pāli file must be opened alongside English when the instruction asks for Pāli wording.
- "readIllustration": up to 2 discourse ids (an10.61, sn36.6) whose site SVG markup the writer should embed — not for quotations. When the instruction asks to include, show, or reuse a discourse diagram/SVG/chart from the site, put those ids here. Leave empty when a new mermaid summary chart is enough or no site diagram is named.
- If the instruction is only about wording, layout, or structure, return empty searchQueries, readFull, readPali, and readIllustration.`;

export const RESEARCH_REVISE_SYSTEM = `You are the editor of a research report written from early Buddhist discourses. You do not search. You do not invent citations. You make the smallest edit that fully carries out the instruction, so the revised report reads as one continuous piece.

${RESEARCH_REVISE_BLOCK_ID_NOTE} Address blocks by id. Return JSON only:
{"changelog":"what changed, where, and which discourses were newly cited — a short paragraph is fine when several parts were done or could not be sourced","ops":[
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
- Moving blocks → one "insert-after" on the anchor block whose "markdown" carries the moved blocks verbatim (in order, blank-line separated, adjusting only a lead-in sentence if the new position needs it), plus a "delete" for each block at the old position. Never leave a moved block in both places, and never paraphrase text you are only relocating.
- Renaming a heading → "update" the heading block.
- Carry out every part of the instruction that the allowed target blocks make possible. If the instruction is report-wide (every quote, every heading, a restyle), update every allowed target it applies to — do not shrink it to one or two sample blocks. If one part truly cannot be done, do the rest and name the omission in "changelog"; never skip the whole request. Prefer finishing every requested kind of change over polishing a single section.
- Only the target blocks may be used as op ids. Every other block must remain byte-for-byte unchanged. Do not reprint unchanged blocks or copy the remainder of the report into an op. Never include [[pN]] labels inside "markdown".
- Separate every block in "markdown" with a blank line: a heading line, then a blank line, then its paragraph. Never glue a heading to the text under it.
- ${RESEARCH_REVISE_STYLE_NOTE}
- A fenced code or Mermaid block is atomic. When updating one, return the complete fenced block, preserving the opening language (for example \`\`\`mermaid) and closing \`\`\`. Never emit a bare "mermaid" line. A paragraph that reads "mermaid / flowchart …" without a fence is a broken diagram: "update" it into a complete \`\`\`mermaid … \`\`\` block, quoting node labels that contain spaces or punctuation (A["Label text"]). Do not touch any other diagram unless it is explicitly targeted.
- When passages include Illustration (SVG) with \`\`\`svg markup, embed or adapt it as a fenced \`\`\`svg block (atomic, like mermaid). Do not invent SVG paths or off-site URLs. For a holistic summary chart the instruction asks for, prefer \`\`\`mermaid unless it names a site diagram to reuse.

Continuity (the revised text must not read as bolted on):
- Match the report's voice, tense, terminology, transliteration, and citation style exactly. Reuse its phrasing for recurring concepts.
- Open a rewritten block so it follows from the block before it and leads into the one after; do not restate what neighbouring blocks already say.
- No meta-commentary ("This paragraph…", "As requested…", "Revised:").

Quotations:
- When the instruction asks for quotes, quotations, or the Buddha's words, include direct quotations in double quotation marks, copied word-for-word from the passages supplied (or from wording already quoted in the report), each followed by its discourse ID exactly as the passage labels it. Do not paraphrase inside quotation marks and do not quote from memory.
- When the instruction asks for Pāli, copy the Pāli from the supplied passages alongside the English. Do not invent Pāli that is not in those passages.
- Set-off quotations use the report's existing form: a "> " blockquote with the quoted words in quotation marks followed by the discourse ID.
- If the supplied passages do not contain a fitting line, say so in the changelog instead of inventing one.

Citations:
- Ordinary discourse IDs in prose (MN 10, SN 22.59). Do not invent IDs.
- When new passages are supplied, cite their discourse IDs in the edited markdown so they appear as citations. Do not drop citations that were in the original block.
- No ## Sources section — the harness rebuilds it.

Scope:
- Ops may touch any number of blocks; finish every op you start. A wide instruction (Pāli beside every quote, subsection titles throughout, a house style) is one job: emit an op for each target it applies to. Search and full-read limits stay with the planner; write only from the report plus supplied passages, and say in the changelog what you could not source.
- If a heading was pinned, edit within that section unless the instruction names others.
- The current revision instruction controls what changes now. The original research request and preference brief are background constraints for scope, style, terminology, and emphasis; preserve them unless the current instruction explicitly overrides them.
- If the message carries the reader's answers to the planner's questions, they are part of the current instruction: where an answer names a block, edit that block and not the one the instruction's number pointed at.
- Write only from the report plus any supplied passages. If passages are empty, do not pad.`;

export const RESEARCH_REVISE_PLANNER_MAX_TOKENS = 4_000;
/** Planner cap. Unused time is added to the writer. */
export const RESEARCH_REVISE_PLANNER_BUDGET_MS = 120_000;
/** Writer floor. A slow planner does not shrink this. */
export const RESEARCH_REVISE_WRITER_BASE_MS = 150_000;

/**
 * Writer wall clock: 150s plus whatever the planner did not use of its 120s.
 * A plan that finishes in 20s gives the writer 250s. A plan that uses the
 * full 120s leaves the writer at 150s.
 */
export function resolveResearchReviseWriterBudgetMs(plannerElapsedMs: number): number {
	const unusedPlannerMs = Math.max(
		0,
		RESEARCH_REVISE_PLANNER_BUDGET_MS - Math.max(0, plannerElapsedMs),
	);
	return RESEARCH_REVISE_WRITER_BASE_MS + unusedPlannerMs;
}

/**
 * Planner call. Returns null (the writer then works from heuristics) when the
 * model is unavailable, times out, or answers with nothing usable.
 */
/** The reader's answers to the planner's questions, one “prompt → answer” per line. */
export function reviseClarificationsBlock(clarifications?: string): string {
	const text = (clarifications || "").trim();
	return text ? `Reader's answers to the planner's questions (these settle the ambiguity; follow them):\n${text}\n` : "";
}

export async function planResearchRevise(options: {
	report: string;
	instruction: string;
	originalQuestion?: string;
	clarifyBrief?: string;
	/** Answers from a paused revision; when present the planner must not ask again. */
	clarifications?: string;
	heading?: string;
	quote?: string;
	edits?: readonly ResearchReviseEdit[];
	attachedImages?: readonly ResearchContextImage[];
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
	const quoteForModel = quote ? formatResearchReviseQuoteForModel(quote) : "";
	const edits = options.edits?.length ? options.edits : [];
	const pinnedIds =
		edits.length > 0
			? pinnedBlockIdsFromReviseEdits(edits, blocks)
			: quote
				? reportBlocksContainingText(blocks, quote)
				: [];
	const editsBlock = reviseEditsPlannerScopeBlock(edits, blocks);
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
			routeKind: "ask",
			signal: watchdog.signal,
			messages: [
				{ role: "system", content: RESEARCH_REVISE_PLAN_SYSTEM },
				{
					role: "user",
					content: reviseModelUserContent(
						`Current revision instruction: ${instruction}
${reviseClarificationsBlock(options.clarifications)}${options.originalQuestion ? `Original research request (background): ${options.originalQuestion}\n` : ""}${
							options.clarifyBrief
								? `Original research preferences and emphasis choices:\n${options.clarifyBrief}\n`
								: ""
						}${editsBlock ? `${editsBlock}\n` : ""}${
							heading ? `Pinned heading: ${heading}\n` : ""
						}${
							quoteForModel
								? `Pinned passage (the reader selected this${pinnedIds.length ? `; it sits in ${pinnedIds.join(", ")}` : ""}): ${quoteForModel}\n`
								: ""
						}
Report with block ids:
${numberedReportForModel(blocks)}

JSON:`,
						options.attachedImages,
					),
				},
			],
		});
		watchdog.ping();
		const plan = clipResearchRevisePlan(extractJsonObject(result.content || ""));
		if (plan) {
			const mermaidIds = mermaidBlocksToFence(blocks, {
				targets: plan.targets,
				instruction,
				planText: `${plan.intent} ${plan.summary || ""}`,
			}).map((block) => block.id);
			plan.targets = resolveResearchReviseTargets(
				[...plan.targets, ...pinnedIds, ...mermaidIds],
				blocks,
			).slice(0, RESEARCH_REVISE_TARGETS_MAX);
		}
		if (plan && options.clarifications?.trim()) {
			// Answered once; a second round would loop the reader.
			delete plan.questions;
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

/** Instructions that want Pāli wording, not only English. */
export function reviseWantsPali(instruction: string): boolean {
	return /\bp[āa]li\b/i.test(instruction);
}

/** True when a hit is the named id, or the range file that contains it. */
export function hitMatchesDiscourseId(
	hit: { slug: string },
	id: string,
): boolean {
	const slug = hit.slug.trim();
	const key = id.trim();
	if (!slug || !key) return false;
	if (slug.toLowerCase() === key.toLowerCase()) return true;
	return slugMatchesQuery(slug, key) === "exact";
}

/** Slugs from hits that match any of the planner's discourse ids. */
export function reviseSlugsForDiscourseIds(
	ids: readonly string[],
	hits: readonly AiDiscourseHit[],
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const hit of hits) {
		const slug = hit.slug.trim().toLowerCase();
		if (!slug || seen.has(slug)) continue;
		if (!ids.some((id) => hitMatchesDiscourseId(hit, id))) continue;
		seen.add(slug);
		out.push(hit.slug);
	}
	return out;
}

/** Server log line for revise evidence gathering — grep `[ai/research/revise] evidence`. */
export function formatReviseEvidenceDebugLog(input: {
	planReadFull: readonly string[];
	planReadPali: readonly string[];
	planReadIllustration: readonly string[];
	requestedIds: readonly string[];
	readFull: readonly string[];
	readPali: readonly string[];
	readIllustration: readonly string[];
	readFullLabels?: readonly string[];
	rereadSlugs: readonly string[];
	newHitSlugs: readonly string[];
	evidenceChars: number;
	evidenceHasPaliPassage: boolean;
	evidenceHasSvgMarkup: boolean;
}): string {
	const labels = input.readFullLabels?.length
		? input.readFullLabels.join(", ")
		: input.readFull.join(", ");
	return `[ai/research/revise] evidence: planReadFull=[${input.planReadFull.join(", ")}] planReadPali=[${input.planReadPali.join(", ")}] planReadIllustration=[${input.planReadIllustration.join(", ")}] requested=[${input.requestedIds.join(", ")}] readFull=[${input.readFull.join(", ")}] readPali=[${input.readPali.join(", ")}] readIllustration=[${input.readIllustration.join(", ")}] labels=[${labels}] reread=[${input.rereadSlugs.join(", ")}] searchHits=[${input.newHitSlugs.join(", ")}] evidenceChars=${input.evidenceChars} hasPaliPassage=${input.evidenceHasPaliPassage} hasSvgMarkup=${input.evidenceHasSvgMarkup}`;
}

function existingHitForDiscourseId(
	id: string,
	hits: readonly AiDiscourseHit[],
): AiDiscourseHit | undefined {
	return hits.find((hit) => hitMatchesDiscourseId(hit, id));
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
	const requested = reviseEvidenceRequestedIds({
		instruction: options.instruction,
		plan,
	});
	for (const id of requested) {
		const hit = existingHitForDiscourseId(id, options.existingHits);
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
	missingReads.forEach((id) => pushQuery(reviseReadFullLabel([id])));
	(plan?.searchQueries || []).forEach(pushQuery);
	let needsSearch = queries.length > 0;
	const namedInInstruction = prefixedAiDiscourseIdsInText(options.instruction);
	if (!plan && !needsSearch && researchReviseNeedsSearch(options.instruction, namedInInstruction)) {
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
}): Promise<{
	hits: AiDiscourseHit[];
	evidence: string;
	reread: AiDiscourseHit[];
	readFull: string[];
	readFullLabels: string[];
	readPali: string[];
	readIllustration: string[];
}> {
	const empty = {
		hits: [] as AiDiscourseHit[],
		evidence: "",
		reread: [] as AiDiscourseHit[],
		readFull: [] as string[],
		readFullLabels: [] as string[],
		readPali: [] as string[],
		readIllustration: [] as string[],
	};
	const { queries, reread, needsSearch } = planReviseEvidence(options);
	const requestedIds = reviseEvidenceRequestedIds({
		instruction: options.instruction,
		plan: options.plan,
	});
	const planReadFull = options.plan?.readFull || [];
	const planReadPali = options.plan?.readPali || [];
	const planReadIllustration = options.plan?.readIllustration || [];
	const needsReads =
		requestedIds.length > 0 ||
		planReadFull.length > 0 ||
		planReadPali.length > 0 ||
		planReadIllustration.length > 0;
	const fullFrom = (hits: readonly AiDiscourseHit[]) => {
		const out: AiDiscourseHit[] = [];
		const seen = new Set<string>();
		const push = (hit: AiDiscourseHit) => {
			const slug = hit.slug.trim().toLowerCase();
			if (!slug || seen.has(slug)) return;
			seen.add(slug);
			out.push(hit);
		};
		for (const hit of reread) push(hit);
		for (const hit of hits) {
			if (requestedIds.some((id) => hitMatchesDiscourseId(hit, id))) push(hit);
		}
		return out;
	};
	const pack = async (hits: readonly AiDiscourseHit[], extra: readonly AiDiscourseHit[]) => {
		const fullHits = fullFrom(extra);
		const allHits = [...extra, ...reread, ...fullHits];
		const readFull = reviseSlugsForDiscourseIds(
			[...planReadFull, ...planReadPali],
			fullHits,
		);
		const readPali = reviseSlugsForDiscourseIds(planReadPali, fullHits);
		const readIllustration = reviseSlugsForDiscourseIds(planReadIllustration, fullHits);
		const readPaliSlugs =
			readPali.length > 0
				? readPali
				: reviseWantsPali(options.instruction)
					? readFull
					: [];
		const spanBySlug = buildEvidenceSpanBySlug(
			requestedIds,
			allHits,
			(hit, id) => hitMatchesDiscourseId(hit, id),
		);
		const readFullLabels = discourseEvidenceReadLabels(
			requestedIds,
			allHits,
			(hit, id) => hitMatchesDiscourseId(hit, id),
		);
		const evidence = await buildResearchReportEvidence({
			question: options.instruction,
			hits: allHits,
			namedQueries: queries,
			readFullSlugs: readFull,
			readPaliSlugs: readPaliSlugs,
			readIllustrationSlugs: readIllustration,
			spanBySlug,
			maxExpanded: Math.max(readFull.length, readIllustration.length, allHits.length),
		});
		console.warn(
			formatReviseEvidenceDebugLog({
				planReadFull,
				planReadPali,
				planReadIllustration,
				requestedIds,
				readFull,
				readPali: readPaliSlugs,
				readIllustration,
				readFullLabels,
				rereadSlugs: reread.map((hit) => hit.slug),
				newHitSlugs: hits.map((hit) => hit.slug),
				evidenceChars: evidence.length,
				evidenceHasPaliPassage: /Pali \(full text\)/i.test(evidence),
				evidenceHasSvgMarkup: /Illustration \(SVG\):/i.test(evidence),
			}),
		);
		return {
			hits,
			evidence,
			reread,
			readFull,
			readFullLabels,
			readPali: readPaliSlugs,
			readIllustration,
		};
	};
	if (!needsSearch && reread.length === 0 && !needsReads) {
		return empty;
	}
	if (!getOpenRouterApiKey()) return empty;
	if (!needsSearch) {
		return pack([], reread);
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
	if (hits.length === 0 && reread.length === 0 && !needsReads) {
		return empty;
	}
	return pack(hits, [...hits, ...reread]);
}

/** The writer's user message; exported so tests can check what the model sees. */
export function buildReviseWriterMessage(options: {
	blocks: readonly ResearchReportBlock[];
	instruction: string;
	originalQuestion?: string;
	clarifyBrief?: string;
	clarifications?: string;
	heading?: string;
	quote?: string;
	edits?: readonly ResearchReviseEdit[];
	evidence?: string;
	plan?: ResearchRevisePlan | null;
}): string {
	const heading = clipResearchReviseHeading(options.heading || "");
	const quote = clipResearchReviseQuote(options.quote || "");
	const quoteForModel = quote ? formatResearchReviseQuoteForModel(quote) : "";
	const evidence = (options.evidence || "").trim();
	const edits = options.edits?.length ? options.edits : [];
	const pinnedIds =
		edits.length > 0
			? pinnedBlockIdsFromReviseEdits(edits, options.blocks)
			: quote
				? reportBlocksContainingText(options.blocks, quote)
				: [];
	const editsBlock = reviseEditsPlannerScopeBlock(edits, options.blocks);
	const known = new Set(options.blocks.map((block) => block.id));
	const targets = [
		...new Set([...pinnedIds, ...(options.plan?.targets || [])]),
	].filter((id) => known.has(id));
	const targetBlocks = options.blocks.filter((block) => targets.includes(block.id));
	const lines: string[] = [
		`Current revision instruction (make only these requested changes): ${options.instruction}`,
	];
	const clarifications = reviseClarificationsBlock(options.clarifications).trimEnd();
	if (clarifications) lines.push(clarifications);
	if (options.originalQuestion) {
		lines.push(
			`Original research request (background; preserve its scope and style unless the current instruction overrides it): ${options.originalQuestion}`,
		);
	}
	if (options.clarifyBrief) {
		lines.push(
			`Original research preferences and emphasis choices (background; keep these preferences):\n${options.clarifyBrief}`,
		);
	}
	if (options.plan?.intent) lines.push(`Plan (from a first pass over the report): ${options.plan.intent}`);
	if (editsBlock) lines.push(editsBlock);
	if (heading) lines.push(`Pinned heading: ${heading} (edit within this section)`);
	if (quoteForModel) {
		lines.push(
			`Pinned passage (the reader selected this${pinnedIds.length ? `; it sits in ${pinnedIds.join(", ")}` : ""}): ${quoteForModel}`,
		);
	}
	if (targets.length) {
		lines.push(
			`Allowed target blocks: ${targets.join(", ")} — ops may use only these ids. Every other block must remain byte-for-byte unchanged.`,
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
	originalQuestion?: string;
	clarifyBrief?: string;
	clarifications?: string;
	heading?: string;
	quote?: string;
	edits?: readonly ResearchReviseEdit[];
	evidence?: string;
	plan?: ResearchRevisePlan | null;
	attachedImages?: readonly ResearchContextImage[];
	signal?: AbortSignal;
	timeoutMs?: number;
}): Promise<{
	patch: ResearchRevisePatch | null;
	model: string;
	tooLong?: boolean;
	/** Model output was present but not valid revise JSON. */
	unparseable?: boolean;
	/** Parsed JSON had no ops the harness could apply. */
	emptyPatch?: boolean;
	/** Ops the writer returned but constrain rejected (scope, fences, etc.). */
	opsDropped?: number;
}> {
	const empty = { patch: null, model: "" };
	if (!getOpenRouterApiKey()) return empty;
	const budget = options.timeoutMs ?? resolveResearchReviseWriterBudgetMs(0);
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
			routeKind: "revise",
			signal: watchdog.signal,
			messages: [
				{ role: "system", content: RESEARCH_REVISE_SYSTEM },
				{
					role: "user",
					content: reviseModelUserContent(
						buildReviseWriterMessage({
							blocks,
							instruction,
							originalQuestion: options.originalQuestion,
							clarifyBrief: options.clarifyBrief,
							clarifications: options.clarifications,
							heading: options.heading,
							quote: options.quote,
							edits: options.edits,
							evidence: options.evidence,
							plan: options.plan,
						}),
						options.attachedImages,
					),
				},
			],
		});
		watchdog.ping();
		const mermaidIds = mermaidBlocksToFence(blocks, {
			targets: options.plan?.targets,
			instruction,
			planText: `${options.plan?.intent || ""} ${options.plan?.summary || ""}`,
		}).map((block) => block.id);
		const targets = resolveResearchReviseTargets(
			[...(options.plan?.targets || []), ...mermaidIds],
			blocks,
		);
		const raw = (result.content || "").trim();
		const parsed = parseResearchRevisePatch(raw);
		const unparseable = Boolean(raw) && !parsed;
		if (unparseable) {
			console.warn(
				`[ai/research/revise] writer returned no parseable patch (${raw.length} chars, truncated=${Boolean(result.truncated)})`,
			);
			logResearchReviseWriterRawOutput(
				raw,
				`unparseable, truncated=${Boolean(result.truncated)}`,
			);
		} else if (!parsed?.ops?.length && !parsed?.edits?.length) {
			console.warn(
				`[ai/research/revise] writer patch empty after parse (changelog=${Boolean(parsed?.changelog)})`,
			);
			if (raw) {
				logResearchReviseWriterRawOutput(raw, "empty patch after parse");
			}
		} else if (parsed && raw) {
			logResearchReviseWriterRawOutput(
				raw,
				`parsed ok (ops=${parsed.ops?.length || 0}, edits=${parsed.edits?.length || 0})`,
			);
		}
		const writerAudit = auditResearchRevisePatchConstraints({
			patch: parsed,
			blocks,
			targets,
		});
		if (writerAudit.rejected.length > 0 || writerAudit.legacyEditsDropped > 0) {
			console.warn(formatResearchRevisePatchAuditLog("writer", writerAudit));
		}
		const constrained = constrainResearchRevisePatch({
			patch: parsed,
			blocks,
			targets,
		});
		const fenced = ensureResearchReviseMermaidFences({
			blocks,
			patch: constrained,
			targets,
			instruction,
			planText: `${options.plan?.intent || ""} ${options.plan?.summary || ""}`,
		});
		const mermaidAudit = auditResearchRevisePatchConstraints({
			patch: fenced,
			blocks,
			targets,
		});
		if (mermaidAudit.rejected.length > 0) {
			console.warn(formatResearchRevisePatchAuditLog("mermaid", mermaidAudit));
		}
		const patch = constrainResearchRevisePatch({
			patch: fenced,
			blocks,
			targets,
		});
		const wanted = parsed?.ops?.length || 0;
		const kept = patch?.ops?.length || 0;
		if (wanted > kept) {
			console.warn(
				`[ai/research/revise] net ${wanted - kept} of ${wanted} writer op(s) dropped after mermaid harness (targets: ${targets.length})`,
			);
		}
		if (!patch && wanted > 0) {
			console.warn(
				`[ai/research/revise] no ops survived — see writer/mermaid reject lines above`,
			);
			if (raw) {
				logResearchReviseWriterRawOutput(
					raw,
					`parsed but no ops survived (wanted=${wanted}, kept=${kept})`,
				);
			}
		}
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
			if (raw) {
				logResearchReviseWriterRawOutput(raw, "truncated output");
			}
			return {
				patch: null,
				model: result.model || ASK_PLANNER_PAID_FALLBACK_MODEL,
				tooLong: true,
			};
		}
		const opsDropped = wanted > kept ? wanted - kept : 0;
		const emptyPatch = Boolean(parsed) && !unparseable && (!patch || researchRevisePatchIsEmpty(patch));
		return {
			patch,
			model: result.model || ASK_PLANNER_PAID_FALLBACK_MODEL,
			...(unparseable ? { unparseable: true } : {}),
			...(emptyPatch ? { emptyPatch: true } : {}),
			...(opsDropped > 0 ? { opsDropped } : {}),
		};
	} finally {
		watchdog.dispose();
	}
}
