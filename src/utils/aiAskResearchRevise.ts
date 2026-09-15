import { extractJsonObject } from "./extractJsonObject";
import { prefixedAiDiscourseIdsInText } from "./aiSearchQuery";
// Browser-safe: planner parsing runs in aiModeClient. The fs-backed
// clipDiscourseSvgRequestSlugs would drag node:fs into the client bundle;
// the server re-clips with the existence check and is the source of truth.
import { normalizeDiscourseSvgRequestSlugs } from "./discourseSvgForAiPure";
import {
	sanitizeResearchHistoryReportStats,
	type ResearchHistoryReportStats,
} from "./aiAskResearchHistoryStats";
import {
	sanitizeResearchClarifyQuestions,
	type ResearchClarifyQuestion,
} from "./aiAskResearchClarify";

/** Soft clip for a large patch (~50k completion tokens). Ingest stays 100k chars. */
export const RESEARCH_REVISE_MAX_OUTPUT_WORDS = 35_000;
export const RESEARCH_REVISE_CHANGELOG_MAX = 2_400;
/** Per scoped edit — room for detailed instructions beyond the 8k question field. */
export const RESEARCH_REVISE_INSTRUCTION_MAX = 12_000;
export const RESEARCH_REVISE_QUOTE_MAX = 800;
export const RESEARCH_REVISE_HEADING_MAX = 180;
/** Max scoped edit items the reader can send in one revision request. */
export const RESEARCH_REVISE_EDITS_MAX = 6;
/** Version bodies kept in the subcollection. */
export const RESEARCH_REVISE_BODIES_MAX = 8;
export const RESEARCH_REVISE_TOO_LONG_ERROR =
	"The revision was too long to finish. Try a smaller change.";
export const RESEARCH_REVISE_UNPARSEABLE_ERROR =
	"Could not parse the revision response. Try again, or split the request into smaller steps.";
export const RESEARCH_REVISE_EMPTY_PATCH_ERROR =
	"The revision returned no edits. Try naming the change more specifically.";
export const RESEARCH_REVISE_GENERIC_ERROR =
	"Could not revise the report. Try again with a clearer or smaller change.";
export const RESEARCH_REVISE_CONSIDERING_NOTE = "Considering the revision…";
export const RESEARCH_REVISE_SEARCH_NOTE = "Looking up additional discourses…";
export const RESEARCH_REVISE_WRITING_NOTE = "Revising the report…";
/** Live hop while a revision waits on the reader's answers (never persisted). */
export const RESEARCH_REVISE_WAITING_NOTE = "Waiting for your answer…";
/** Persisted hop that names the planner's reading of the instruction. */
export const RESEARCH_REVISE_PLAN_NOTE_PREFIX = "Plan: ";
/** Fits in {@link RESEARCH_PROCESS_NOTE_CHARS} with the `Plan: ` prefix. */
export const RESEARCH_REVISE_PLAN_SUMMARY_MAX = 260;
export const RESEARCH_REVISE_CLARIFY_MAX_QUESTIONS = 2;
export const RESEARCH_REVISE_CLARIFY_MAX_LABEL = 120;
/** A paused revision that gets no answer is dropped after this long. */
export const RESEARCH_REVISE_CLARIFY_TTL_MS = 30 * 60 * 1000;
export const RESEARCH_REVISE_CLARIFY_TITLE = "A quick check before revising";
export const RESEARCH_REVISE_CLARIFY_CONTINUE = "Continue revision";
export const RESEARCH_REVISE_CLARIFY_CANCEL = "Cancel";
export const RESEARCH_REVISE_CLARIFY_EXPIRED_ERROR =
	"Revision paused too long without an answer; nothing was changed.";

/** Planner questions for a revise, plus the reading they hang off. */
export interface ResearchReviseClarify {
	id: string;
	questions: ResearchClarifyQuestion[];
	/** Reader-facing plan (“delete ¶12 (duplicate of ¶11) · …”). */
	interpretation: string;
	/** Version the revision started from; null = current head. */
	fromVersion: number | null;
	expiresAt: number;
}

export function isResearchRevisePlanNote(note: string): boolean {
	return /^plan:\s/i.test(note.replace(/\s+/g, " ").trim());
}

/**
 * Turn model-side block ids into what the reader sees: `p12` → `¶12`. Other
 * kinds are described in words by the planner, so only `p` needs mapping.
 */
export function readerFacingReviseBlockRefs(text: string): string {
	return text
		.replace(/\[\[([phtc]\d{1,4})\]\]/gi, "$1")
		.replace(/(^|[\s(,;:/–—-])[pP](\d{1,4})(?=$|[\s),;:.!?/–—-])/g, "$1¶$2");
}

/** One-line reading for the process strip and the clarify card kicker. */
export function researchRevisePlanSummary(plan: {
	summary?: string;
	intent?: string;
}): string {
	const source = (plan.summary || plan.intent || "").replace(/\s+/g, " ").trim();
	if (!source) return "";
	const reader = readerFacingReviseBlockRefs(source);
	return reader.length > RESEARCH_REVISE_PLAN_SUMMARY_MAX
		? `${reader.slice(0, RESEARCH_REVISE_PLAN_SUMMARY_MAX - 1).trimEnd()}…`
		: reader;
}

function discourseIdsForPlanNote(ids: readonly string[]): string {
	return ids
		.map((id) =>
			id.replace(/^([a-z]+)(\d.*)$/i, (_m, book: string, num: string) => `${book.toUpperCase()} ${num}`),
		)
		.join(", ");
}

/** Legacy path when no planner JSON: search only for discourse ids named in the instruction. */
export function researchReviseNeedsSearch(
	_instruction: string,
	namedIds: readonly string[] = [],
): boolean {
	return namedIds.length > 0;
}

/** Discourse ids the planner asked to open — union of readFull, readPali, readIllustration, and instruction. */
export function reviseEvidenceRequestedIds(options: {
	instruction: string;
	plan?: {
		readFull?: string[];
		readPali?: string[];
		readIllustration?: string[];
	} | null;
}): string[] {
	return [
		...new Set([
			...(options.plan?.readFull || []),
			...(options.plan?.readPali || []),
			...(options.plan?.readIllustration || []),
			...prefixedAiDiscourseIdsInText(options.instruction),
		]),
	];
}

/** Reader-facing error when the writer patch cannot be applied. */
export function researchReviseWriterFailureMessage(input: {
	unparseable?: boolean;
	emptyPatch?: boolean;
	opsDropped?: number;
}): string {
	if (input.unparseable) return RESEARCH_REVISE_UNPARSEABLE_ERROR;
	if (input.opsDropped && input.opsDropped > 0) {
		const dropped = input.opsDropped;
		return `Could not apply the revision (${dropped} edit${dropped === 1 ? "" : "s"} fell outside the plan). Try naming fewer changes, or split them across two revisions.`;
	}
	if (input.emptyPatch) return RESEARCH_REVISE_EMPTY_PATCH_ERROR;
	return RESEARCH_REVISE_GENERIC_ERROR;
}

/** Log the model's raw JSON when the harness cannot parse or apply it. */
export function logResearchReviseWriterRawOutput(raw: string, reason: string): void {
	const text = raw.trim();
	if (!text) return;
	const cap = 80_000;
	const body =
		text.length > cap
			? `${text.slice(0, cap)}\n… [truncated ${text.length - cap} chars]`
			: text;
	console.warn(
		`[ai/research/revise] writer raw output (${reason}, ${text.length} chars):\n---\n${body}\n---`,
	);
}

/** Reader-facing process hop; always surfaces something when the planner named work. */
export function researchRevisePlanNote(
	plan: {
		summary?: string;
		intent?: string;
		searchQueries?: string[];
		readFull?: string[];
		readPali?: string[];
		readIllustration?: string[];
		targets?: string[];
	} = {},
): string {
	let summary = researchRevisePlanSummary(plan);
	if (!summary && plan.searchQueries?.length) {
		summary = `look up: ${plan.searchQueries.slice(0, 3).join("; ")}`;
	}
	if (!summary && (plan.readFull?.length || plan.readPali?.length || plan.readIllustration?.length)) {
		const ids = [
			...new Set([
				...(plan.readFull || []),
				...(plan.readPali || []),
				...(plan.readIllustration || []),
			]),
		].slice(0, 4);
		summary = `read ${discourseIdsForPlanNote(ids)}`;
	}
	if (!summary && plan.targets?.length) {
		summary = `edit ${readerFacingReviseBlockRefs(plan.targets.slice(0, 8).join(", "))}`;
	}
	return summary ? `${RESEARCH_REVISE_PLAN_NOTE_PREFIX}${summary}` : "";
}

export function sanitizeResearchReviseClarifyQuestions(
	raw: unknown,
): ResearchClarifyQuestion[] {
	return sanitizeResearchClarifyQuestions(raw, {
		maxQuestions: RESEARCH_REVISE_CLARIFY_MAX_QUESTIONS,
		maxLabel: RESEARCH_REVISE_CLARIFY_MAX_LABEL,
		noPreference: false,
		blockIds: true,
	});
}

export function sanitizeResearchReviseClarify(raw: unknown): ResearchReviseClarify | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const id = typeof record.id === "string" ? record.id.trim().slice(0, 80) : "";
	const questions = sanitizeResearchReviseClarifyQuestions(record.questions);
	if (!id || questions.length === 0) return null;
	const expiresAt =
		typeof record.expiresAt === "number" && Number.isFinite(record.expiresAt)
			? Math.floor(record.expiresAt)
			: 0;
	const fromRaw = record.fromVersion;
	return {
		id,
		questions,
		interpretation: researchRevisePlanSummary({
			summary: typeof record.interpretation === "string" ? record.interpretation : "",
		}),
		fromVersion:
			typeof fromRaw === "number" && Number.isFinite(fromRaw) && fromRaw > 0
				? Math.floor(fromRaw)
				: null,
		expiresAt,
	};
}

export function isResearchReviseClarifyExpired(
	clarify: { expiresAt: number } | null | undefined,
	now: number = Date.now(),
): boolean {
	return Boolean(clarify && clarify.expiresAt > 0 && clarify.expiresAt <= now);
}

/** Label for the clarify card: which version the paused revision started from. */
export function researchReviseClarifyBaseLabel(fromVersion: number | null | undefined): string {
	return fromVersion && fromVersion > 0 ? `Revising from v${fromVersion}` : "";
}

export function researchRevisionStartedLabel(n: number): string {
	const version = Math.max(1, Math.floor(Number(n) || 1));
	return `Started v${version} revision`;
}

export function researchRevisionStartedNote(n: number): string {
	return `${researchRevisionStartedLabel(n)}…`;
}

/** "Started v2 revision" hops render as a grey system divider, not a step. */
export function isResearchRevisionStartedLabel(text: string): boolean {
	return /^started v\d+ revision\b/i.test(text.replace(/\s+/g, " ").trim());
}

/** Next report version, treating an unseeded job as v1. */
export function nextResearchRevisionN(
	index: readonly ResearchVersionMeta[],
): number {
	return nextResearchVersionN(
		index.length > 0 ? index : [openingResearchVersionMeta()],
	);
}

/**
 * replace      — swap a whole ## section
 * insert-after — new section after that heading
 * replace-text — rewrite one existing paragraph in place; `find` is a verbatim
 *                excerpt from that paragraph (the paragraph containing it is
 *                replaced by `markdown`)
 */
export type ResearchReviseEditMode = "replace" | "insert-after" | "replace-text";

export interface ResearchReviseEdit {
	heading: string;
	mode: ResearchReviseEditMode;
	markdown: string;
	find?: string;
}

/**
 * Block-addressed ops. The report is sent to the writer with every block
 * (paragraph, heading, list, quote) labelled [[pN]]; ops name those ids, so a
 * change lands on exactly the block the reader meant.
 */
export type ResearchReviseOpKind =
	| "update"
	| "delete"
	| "insert-after"
	| "insert-before";

export interface ResearchReviseOp {
	op: ResearchReviseOpKind;
	id: string;
	/** Replacement or new block(s); may hold several blocks separated by blank lines. */
	markdown: string;
}

export interface ResearchRevisePatch {
	changelog: string;
	/** Legacy section/excerpt edits (still accepted from the model). */
	edits: ResearchReviseEdit[];
	/** Preferred: block ops keyed by [[pN]] ids. */
	ops?: ResearchReviseOp[];
}

/** Room for a moved sub-section (paragraphs, quotes, a heading) in one insert op. */
export const RESEARCH_REVISE_MAX_BLOCKS_PER_OP = 24;

export interface ResearchReportBlock {
	id: string;
	markdown: string;
	/** Nearest ## / ### heading text above this block ("" for the opening). */
	section: string;
	kind: "heading" | "paragraph" | "list" | "quote" | "code" | "other";
}

/** What the planner decided before evidence is gathered and the writer runs. */
export interface ResearchRevisePlan {
	/** Block ids the edit should touch. */
	targets: string[];
	/** One or two sentences: the concrete edit to make. */
	intent: string;
	/** Library searches worth one round (empty = none needed). */
	searchQueries: string[];
	/** Discourse ids (mn10, sn48.42) to read in full for quotations. */
	readFull: string[];
	/** Discourse ids whose Pāli file must be opened alongside English. */
	readPali: string[];
	/** Discourse ids whose site SVG markup should be inlined for the writer. */
	readIllustration: string[];
	/** Reader-facing one-liner for the process strip (falls back to `intent`). */
	summary?: string;
	/** Genuine ambiguities the writer should not guess at (0–2). */
	questions?: ResearchClarifyQuestion[];
}

/**
 * Block id prefixes. `p` counts the blocks the reader sees numbered as ¶ N
 * (paragraphs, block quotations, lists — see REPORT_PARAGRAPH_SELECTOR);
 * headings, tables/rules/HTML, and fenced code get their own counters so the
 * reader's "P12" and the model's `p12` are the same block.
 */
export const REPORT_BLOCK_ID_PREFIXES = {
	paragraph: "p",
	quote: "p",
	list: "p",
	heading: "h",
	other: "t",
	code: "c",
} as const;

const REPORT_BLOCK_TAG = /^\[\[[phtc]\d+\]\]\s*$/i;
const HEADING_LINE = /^#{1,6}\s+/;
const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s+/;
const QUOTE_LINE = /^\s*>/;
const FENCE_LINE = /^\s*```/;
const RULE_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/**
 * Split a report body into addressable blocks the way the renderer will:
 * blank lines separate blocks; a heading line is always its own block; a
 * fence or `>` line interrupts a paragraph; fenced code stays whole; a list
 * stays one block even when blank lines sit between its items.
 */
export function primaryKeyForSplitBlock(block: ResearchReportBlock): string {
	const kind: ReportDiffBlockKind =
		block.kind === "heading"
			? "heading"
			: block.kind === "quote"
				? "quote"
				: block.kind === "code"
					? "code"
					: block.kind === "list"
						? "list"
						: block.kind === "other"
							? "other"
							: "paragraph";
	let text = block.markdown;
	if (block.kind === "heading") text = text.replace(/^#{1,6}\s+/, "");
	if (block.kind === "quote") text = text.replace(/^\s*>\s?/gm, "");
	if (block.kind === "code") {
		text = text.replace(/^```\w*\n?/, "").replace(/\n```\s*$/, "");
	}
	return reportDiffBlockKey(kind, text);
}

/** Map a stamped DOM block key to the writer's [[cN]] / [[tN]] / [[pN]] id. */
export function splitBlockIdForEnumeratedKey(
	markdown: string,
	enumeratedKey: string,
	enumeratedMarkdown = "",
): string {
	const key = (enumeratedKey || "").trim();
	if (key) {
		for (const block of splitReportBlocks(markdown)) {
			if (primaryKeyForSplitBlock(block) === key) return block.id;
		}
	}
	const norm = normalizeReportBlockText(
		enumeratedMarkdown.trim() ||
			(key.includes(":") ? key.slice(key.indexOf(":") + 1) : key),
	);
	if (!norm) return "";
	for (const block of splitReportBlocks(markdown)) {
		const splitNorm = normalizeReportBlockText(block.markdown);
		if (
			splitNorm === norm ||
			splitNorm.includes(norm) ||
			norm.includes(splitNorm)
		) {
			return block.id;
		}
	}
	return "";
}

export function splitReportBlocks(markdown: string): ResearchReportBlock[] {
	const text = stripSourcesForRevise(markdown).replace(/\r\n/g, "\n");
	if (!text.trim()) return [];
	const lines = text.split("\n");
	const chunks: string[] = [];
	let current: string[] = [];
	let inFence = false;
	const flush = () => {
		const chunk = current.join("\n").trim();
		if (chunk) chunks.push(chunk);
		current = [];
	};
	const currentIsList = () => current.length > 0 && LIST_LINE.test(current[0] || "");
	const currentIsQuote = () => current.length > 0 && QUOTE_LINE.test(current[0] || "");
	const nextContentLine = (from: number): string | null => {
		for (let j = from; j < lines.length; j += 1) {
			if (lines[j]?.trim()) return lines[j] || null;
		}
		return null;
	};
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] || "";
		if (FENCE_LINE.test(line)) {
			if (!inFence) flush();
			inFence = !inFence;
			current.push(line);
			if (!inFence) flush();
			continue;
		}
		if (inFence) {
			current.push(line);
			continue;
		}
		if (!line.trim()) {
			// A loose list (blank lines between items) renders as one <ul>/<ol>.
			if (currentIsList()) {
				const next = nextContentLine(i + 1);
				if (next && (LIST_LINE.test(next) || /^\s{2,}\S/.test(next))) {
					current.push("");
					continue;
				}
			}
			flush();
			continue;
		}
		if (REPORT_BLOCK_TAG.test(line)) continue;
		if (HEADING_LINE.test(line)) {
			flush();
			current.push(line);
			flush();
			continue;
		}
		if (QUOTE_LINE.test(line) && current.length > 0 && !currentIsQuote()) {
			flush();
		}
		current.push(line);
	}
	flush();
	let section = "";
	const counters: Record<string, number> = {};
	return chunks.map((chunk) => {
		const first = chunk.split("\n")[0] || "";
		let kind: ResearchReportBlock["kind"] = "paragraph";
		if (HEADING_LINE.test(first)) {
			kind = "heading";
			if (/^#{2,3}\s+/.test(first)) {
				section = first.replace(/^#{2,3}\s+/, "").trim();
			}
		} else if (LIST_LINE.test(first)) kind = "list";
		else if (QUOTE_LINE.test(first)) kind = "quote";
		else if (FENCE_LINE.test(first)) kind = "code";
		else if (/^\s*(?:\||<)/.test(first) || RULE_LINE.test(first)) kind = "other";
		const prefix = REPORT_BLOCK_ID_PREFIXES[kind];
		counters[prefix] = (counters[prefix] || 0) + 1;
		return { id: `${prefix}${counters[prefix]}`, markdown: chunk, section, kind };
	});
}

/** Report text as the writer sees it: every block preceded by its [[pN]] tag. */
export function numberedReportForModel(blocks: readonly ResearchReportBlock[]): string {
	return blocks.map((block) => `[[${block.id}]]\n${block.markdown}`).join("\n\n");
}

/** Strip any [[pN]] / [[hN]] tags a model echoes back inside new markdown. */
export function stripReportBlockTags(markdown: string): string {
	return markdown
		.replace(/\r\n/g, "\n")
		.split("\n")
		.filter((line) => !REPORT_BLOCK_TAG.test(line))
		.join("\n")
		.replace(/\[\[[phtc]\d+\]\]\s*/gi, "")
		.trim();
}

/**
 * Canonical block id from a model (or reader) reference. A bare number, "¶ 12",
 * "P12" or "paragraph 12" all mean the visible paragraph p12; h/t/c ids keep
 * their prefix. Anything else is not an id.
 */
export function normalizeReportBlockId(value: unknown): string {
	const text = (
		typeof value === "string" ? value : typeof value === "number" ? String(value) : ""
	)
		.trim()
		.replace(/^\[\[|\]\]$/g, "")
		.trim();
	const typed = text.match(/^([phtc])\s*-?\s*(\d+)$/i);
	if (typed) return `${typed[1].toLowerCase()}${Number(typed[2])}`;
	const visible = text.match(/^(?:¶|para(?:graph)?|block)?\s*(\d+)$/i);
	return visible ? `p${Number(visible[1])}` : "";
}

/** Widest span a single range target may cover (a whole long section). */
export const REPORT_BLOCK_RANGE_MAX = 40;
/** Planner targets kept after ranges and kind aliases expand (a report-wide restyle). */
export const RESEARCH_REVISE_TARGETS_MAX = 160;

/** Kind-wide target tokens the planner may emit instead of listing every id. */
export const RESEARCH_REVISE_TARGET_ALIASES = [
	"quotes",
	"all-quotes",
	"headings",
	"all-headings",
	"diagrams",
	"mermaid",
	"paragraphs",
	"all",
	"report",
] as const;

export function isResearchReviseTargetAlias(value: string): boolean {
	const key = value.trim().toLowerCase();
	return (RESEARCH_REVISE_TARGET_ALIASES as readonly string[]).includes(key);
}

/**
 * One planner target → block ids. Accepts a single id (`p12`, `¶ 12`, `h3`)
 * or a same-kind range (`p31-p38`, `¶31–38`, `p31 to p38`), expanded in order.
 */
export function expandReportBlockIdRange(value: unknown): string[] {
	const text = (typeof value === "string" ? value : "")
		.trim()
		.replace(/^\[\[|\]\]$/g, "")
		.trim();
	const range = text.match(
		/^(?:¶|para(?:graph)?s?|blocks?)?\s*([phtc])?\s*(\d+)\s*(?:-|–|—|to|through|\.\.)\s*(?:¶)?\s*([phtc])?\s*(\d+)$/i,
	);
	if (!range) {
		const single = normalizeReportBlockId(text);
		return single ? [single] : [];
	}
	const kindA = (range[1] || range[3] || "p").toLowerCase();
	const kindB = (range[3] || range[1] || "p").toLowerCase();
	if (kindA !== kindB) return [];
	const from = Number(range[2]);
	const to = Number(range[4]);
	if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
		return [];
	}
	const end = Math.min(to, from + REPORT_BLOCK_RANGE_MAX - 1);
	const out: string[] = [];
	for (let n = from; n <= end; n += 1) out.push(`${kindA}${n}`);
	return out;
}

const UNFENCED_MERMAID_RE =
	/^(?:mermaid\b|(?:flowchart|graph)\s+(?:TB|BT|LR|RL|TD)\b|sequenceDiagram\b)/i;

/** A paragraph that is a Mermaid diagram with no ``` fence (renders as prose). */
export function isUnfencedMermaidMarkdown(markdown: string): boolean {
	const text = markdown.replace(/\r\n/g, "\n").trim();
	if (!text || /^```/.test(text)) return false;
	return UNFENCED_MERMAID_RE.test(text);
}

/** Wrap a bare mermaid/flowchart paragraph in a complete ```mermaid fence. */
export function fenceMermaidMarkdown(markdown: string): string {
	const text = markdown.replace(/\r\n/g, "\n").trim();
	if (completeFenceInfo(text)) return text;
	const body = text.replace(/^mermaid\s*/i, "").trim();
	return body ? `\`\`\`mermaid\n${body}\n\`\`\`` : text;
}

const MERMAID_DIAGRAM_LINE_RE =
	/^(?:\s*(?:subgraph|end|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)\b|.*(?:-->|---|-.-|==>|o--|x--)|.*[[({"'`]|^\s*%%|^\s*(?:classDef|class|style|direction)\s)/i;

function isMermaidDiagramLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed) return true;
	if (MERMAID_DIAGRAM_LINE_RE.test(line)) return true;
	if (/^[A-Za-z][A-Za-z0-9_]*(\s*[[(]|\s*[-=]+>)/.test(trimmed)) return true;
	return false;
}

function isMermaidCaptionProseLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed) return false;
	if (isMermaidDiagramLine(line)) return false;
	return /^[A-Z]/.test(trimmed) && /\s/.test(trimmed);
}

function splitMermaidDiagramFromProse(body: string): { diagram: string; prose: string } | null {
	const lines = body.split("\n");
	let sawDiagram = false;
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		if (line.trim() && isMermaidDiagramLine(line)) sawDiagram = true;
		if (sawDiagram && isMermaidCaptionProseLine(line)) {
			const diagram = lines.slice(0, i).join("\n").trimEnd();
			const prose = lines.slice(i).join("\n").trim();
			if (diagram && prose) return { diagram, prose };
			return null;
		}
	}
	return null;
}

/**
 * Close an opened ```mermaid fence before trailing caption prose the writer
 * sometimes leaves inside the fence (renders as a pre block).
 */
export function closeMermaidFenceBeforeProse(markdown: string): string {
	const text = markdown.replace(/\r\n/g, "\n").trim();
	if (!text.startsWith("```mermaid")) return markdown;
	const body = text.slice("```mermaid".length).replace(/^\n/, "");
	const closeMatch = body.match(/\n```(?:\s*\n([\s\S]*)|\s*$)$/);
	const inner = closeMatch ? body.slice(0, body.length - closeMatch[0].length) : body;
	const trailingOutside = closeMatch?.[1]?.trim() || "";
	const split = splitMermaidDiagramFromProse(inner);
	if (!split) {
		if (!closeMatch && inner.trim()) {
			return `\`\`\`mermaid\n${inner.trimEnd()}\n\`\`\``;
		}
		return markdown;
	}
	const prose = trailingOutside
		? `${split.prose}\n\n${trailingOutside}`.trim()
		: split.prose;
	return `\`\`\`mermaid\n${split.diagram}\n\`\`\`\n\n${prose}`;
}

/** Fence bare mermaid inside a writer op (including new insert-after blocks). */
export function fenceMermaidInOpMarkdown(markdown: string): string {
	let text = markdown.replace(/\r\n/g, "\n").trim();
	if (!text) return markdown;
	if (text.startsWith("```mermaid")) {
		text = closeMermaidFenceBeforeProse(text);
	}
	if (completeFenceInfo(text)) return text;
	if (isUnfencedMermaidMarkdown(text)) {
		return closeMermaidFenceBeforeProse(fenceMermaidMarkdown(text));
	}
	const chunks = text.split(/\n\n+/);
	if (chunks.length <= 1) return text === markdown.trim() ? markdown : text;
	const fenced = chunks.map((chunk) => {
		if (!isUnfencedMermaidMarkdown(chunk)) return chunk;
		const wrapped = fenceMermaidMarkdown(chunk);
		return chunk.startsWith("```mermaid")
			? closeMermaidFenceBeforeProse(wrapped)
			: wrapped;
	});
	const joined = fenced.join("\n\n");
	if (joined !== text) return joined;
	const trimmed = markdown.replace(/\r\n/g, "\n").trim();
	return text === trimmed ? markdown : text;
}

/**
 * Unfenced diagrams the harness should fence itself: targeted ones, ones the
 * instruction names by ¶ number, or the only broken diagram when the ask is
 * “fix the mermaid”.
 */
export function mermaidBlocksToFence(
	blocks: readonly ResearchReportBlock[],
	options: { targets?: readonly string[]; instruction?: string; planText?: string } = {},
): ResearchReportBlock[] {
	const unfenced = blocks.filter((block) => isUnfencedMermaidMarkdown(block.markdown));
	if (unfenced.length === 0) return [];
	const targetSet = new Set(
		(options.targets || []).map(normalizeReportBlockId).filter(Boolean),
	);
	const blob = `${options.instruction || ""} ${options.planText || ""}`;
	const mentioned = new Set(
		[...blob.matchAll(/(?:¶|\[\[)?\s*[pP]\s*(\d{1,4})/g)].map((match) => `p${Number(match[1])}`),
	);
	const asks = /mermaid|flowchart|diagram|\bfenc/i.test(blob);
	return unfenced.filter((block) => {
		if (targetSet.has(block.id)) return true;
		if (asks && mentioned.has(block.id)) return true;
		if (asks && unfenced.length === 1) return true;
		return false;
	});
}

/**
 * After the writer returns, add or repair fence ops so a skipped mermaid
 * update cannot leave the diagram as prose.
 */
export function ensureResearchReviseMermaidFences(options: {
	blocks: readonly ResearchReportBlock[];
	patch: ResearchRevisePatch | null;
	targets?: readonly string[];
	instruction?: string;
	planText?: string;
}): ResearchRevisePatch | null {
	let patch = options.patch;
	if (patch?.ops?.length) {
		const ops = patch.ops.map((op) => {
			if (op.op === "delete") return op;
			const markdown = fenceMermaidInOpMarkdown(op.markdown);
			return markdown === op.markdown ? op : { ...op, markdown };
		});
		patch = { ...patch, ops };
	}
	const toFence = mermaidBlocksToFence(options.blocks, options);
	if (toFence.length === 0) return patch;
	const ops = [...(patch?.ops || [])];
	for (const block of toFence) {
		const index = ops.findIndex((op) => op.id === block.id && op.op === "update");
		const candidate = index >= 0 ? ops[index].markdown : block.markdown;
		const markdown = completeFenceInfo(candidate)
			? candidate.trim()
			: fenceMermaidMarkdown(
					isUnfencedMermaidMarkdown(candidate) ? candidate : block.markdown,
				);
		if (!completeFenceInfo(markdown)) continue;
		const next = { op: "update" as const, id: block.id, markdown };
		if (index >= 0) ops[index] = next;
		else ops.push(next);
	}
	const next: ResearchRevisePatch = {
		changelog: patch?.changelog || "Fenced the mermaid diagram.",
		edits: patch?.edits || [],
		ops,
	};
	return researchRevisePatchIsEmpty(next) ? null : next;
}

/** Expand kind aliases (`quotes`, `diagrams`, `all`) against the live report. */
export function resolveResearchReviseTargets(
	raw: readonly string[],
	blocks: readonly ResearchReportBlock[],
): string[] {
	const known = new Set(blocks.map((block) => block.id));
	const out: string[] = [];
	const push = (id: string) => {
		if (known.has(id) && !out.includes(id)) out.push(id);
	};
	for (const item of raw) {
		const key = item.trim().toLowerCase();
		if (key === "quotes" || key === "all-quotes") {
			for (const block of blocks) if (block.kind === "quote") push(block.id);
			continue;
		}
		if (key === "headings" || key === "all-headings") {
			for (const block of blocks) if (block.kind === "heading") push(block.id);
			continue;
		}
		if (key === "diagrams" || key === "mermaid") {
			for (const block of blocks) {
				if (
					block.kind === "code" ||
					isUnfencedMermaidMarkdown(block.markdown)
				) {
					push(block.id);
				}
			}
			continue;
		}
		if (key === "paragraphs") {
			for (const block of blocks) if (block.kind === "paragraph") push(block.id);
			continue;
		}
		if (key === "all" || key === "report") {
			for (const block of blocks) push(block.id);
			continue;
		}
		for (const id of expandReportBlockIdRange(item)) push(id);
	}
	return out.slice(0, RESEARCH_REVISE_TARGETS_MAX);
}

function parseOpKind(value: unknown): ResearchReviseOpKind | null {
	const op = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (op === "update" || op === "replace" || op === "edit" || op === "rewrite") {
		return "update";
	}
	if (op === "delete" || op === "remove") return "delete";
	if (op === "insert-after" || op === "insert_after" || op === "append-after") {
		return "insert-after";
	}
	if (op === "insert-before" || op === "insert_before") return "insert-before";
	return null;
}

export function clipOpsToWordBudget(
	ops: readonly ResearchReviseOp[],
	max = RESEARCH_REVISE_MAX_OUTPUT_WORDS,
): ResearchReviseOp[] {
	const out: ResearchReviseOp[] = [];
	let used = 0;
	for (const op of ops) {
		if (op.op === "delete") {
			out.push({ ...op, markdown: "" });
			continue;
		}
		const words = countWords(op.markdown);
		if (used >= max) break;
		if (used + words <= max) {
			out.push(op);
			used += words;
			continue;
		}
		const clipped = clipEditsToWordBudget(
			[{ heading: "", mode: "replace", markdown: op.markdown }],
			max - used,
		)[0];
		if (clipped?.markdown) out.push({ ...op, markdown: clipped.markdown });
		break;
	}
	return out;
}

/** Apply block ops; unknown ids are dropped rather than appended blindly. */
export function applyResearchReviseOps(
	markdown: string,
	ops: readonly ResearchReviseOp[],
): string {
	const blocks = splitReportBlocks(markdown);
	if (blocks.length === 0) return stripSourcesForRevise(markdown);
	const index = new Map(blocks.map((block, i) => [block.id, i]));
	const replaced = new Map<number, string | null>();
	const before = new Map<number, string[]>();
	const after = new Map<number, string[]>();
	for (const op of clipOpsToWordBudget(ops)) {
		const i = index.get(op.id);
		if (i === undefined) continue;
		const body = stripReportBlockTags(op.markdown);
		if (op.op === "delete") {
			replaced.set(i, null);
		} else if (op.op === "update") {
			replaced.set(i, body || null);
		} else if (op.op === "insert-after") {
			if (body) after.set(i, [...(after.get(i) || []), body]);
		} else if (body) {
			before.set(i, [...(before.get(i) || []), body]);
		}
	}
	const out: string[] = [];
	blocks.forEach((block, i) => {
		for (const item of before.get(i) || []) out.push(item);
		if (replaced.has(i)) {
			const body = replaced.get(i);
			if (body) out.push(body);
		} else {
			out.push(block.markdown);
		}
		for (const item of after.get(i) || []) out.push(item);
	});
	return out
		.map((chunk) => chunk.trim())
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

export function clipResearchRevisePlan(raw: unknown): ResearchRevisePlan | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const list = (value: unknown): string[] =>
		Array.isArray(value)
			? value
					.map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
					.filter(Boolean)
			: [];
	const rawTargets = list(record.targets);
	const targets = [
		...new Set([
			...rawTargets.filter(isResearchReviseTargetAlias).map((item) => item.toLowerCase()),
			...rawTargets.flatMap(expandReportBlockIdRange),
		]),
	].slice(0, RESEARCH_REVISE_TARGETS_MAX);
	const intent = typeof record.intent === "string" ? clipResearchReviseInstruction(record.intent) : "";
	const searchQueries = [...new Set(list(record.searchQueries).map((q) => q.slice(0, 120)))].slice(0, 3);
	const clipDiscourseIds = (value: unknown) =>
		[
			...new Set(
				list(value)
					.map((id) => id.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, ""))
					.filter((id) => /^[a-z]+\d+(?:\.\d+)*(?:-\d+)?$/.test(id)),
			),
		].slice(0, 4);
	const readFull = clipDiscourseIds(record.readFull);
	const readPali = clipDiscourseIds(record.readPali);
	const readIllustration = normalizeDiscourseSvgRequestSlugs(clipDiscourseIds(record.readIllustration));
	const summary =
		typeof record.summary === "string"
			? record.summary.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_PLAN_SUMMARY_MAX * 2)
			: "";
	const questions = sanitizeResearchReviseClarifyQuestions(record.questions);
	if (
		!targets.length &&
		!intent &&
		!searchQueries.length &&
		!readFull.length &&
		!readPali.length &&
		!readIllustration.length &&
		!questions.length
	) {
		return null;
	}
	return {
		targets,
		intent,
		searchQueries,
		readFull,
		readPali,
		readIllustration,
		...(summary ? { summary } : {}),
		...(questions.length ? { questions } : {}),
	};
}

export interface ResearchVersionMeta {
	n: number;
	at: number;
	instruction: string;
	changelog: string;
	from: number | null;
	heading?: string;
	/** Reference screenshots sent with the revision request (not stored). */
	imageCount?: number;
	/** Length / citation snapshot of this version, for the drawer changelog. */
	stats?: ResearchHistoryReportStats;
}

export interface ResearchReportSection {
	heading: string;
	level: 2 | 3;
	markdown: string;
}

export function countWords(text: string): number {
	return text
		.replace(/\s+/g, " ")
		.trim()
		.split(" ")
		.filter(Boolean).length;
}

/** True when a live selection should show Revise report (2+ whitespace tokens). */
export function selectionQualifiesForRevise(text: string): boolean {
	return countWords(text) >= 2;
}

/** Live composer input: collapse horizontal runs; keep newlines and a trailing space. */
export function normalizeResearchReviseInstructionInput(value: string): string {
	return value
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " "))
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.slice(0, RESEARCH_REVISE_INSTRUCTION_MAX);
}

export function clipResearchReviseInstruction(value: string): string {
	return normalizeResearchReviseInstructionInput(value)
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.trim();
}

export function clipResearchReviseQuote(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_QUOTE_MAX);
}

/** Head/tail excerpt for planner and writer prompts; block ids carry the anchor. */
export function formatResearchReviseQuoteForModel(value: string): string {
	const text = value.replace(/\s+/g, " ").trim();
	if (!text) return "";
	const max = RESEARCH_REVISE_QUOTE_MAX;
	if (text.length <= 240) return text.slice(0, max);
	const headBudget = Math.floor(max * 0.45);
	const tailBudget = max - headBudget - 3;
	let head = text.slice(0, headBudget);
	const headSpace = head.lastIndexOf(" ");
	if (headSpace > headBudget * 0.55) head = head.slice(0, headSpace);
	let tail = text.slice(text.length - tailBudget);
	const tailSpace = tail.indexOf(" ");
	if (tailSpace >= 0 && tailSpace < tailBudget * 0.35) {
		tail = tail.slice(tailSpace + 1);
	}
	return `${head.trim()} … ${tail.trim()}`.slice(0, max);
}

export function clipResearchReviseHeading(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_HEADING_MAX);
}

export function clipResearchChangelog(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_CHANGELOG_MAX);
}

export function researchReviseVersionChangelog(input: {
	patchChangelog?: string;
	instruction: string;
	imageCount?: number;
}): string {
	const base = clipResearchChangelog(
		(input.patchChangelog || "").trim() || input.instruction,
	);
	const count = Math.max(0, Math.floor(input.imageCount || 0));
	if (count <= 0) return base;
	const note =
		count === 1
			? "1 reference image attached."
			: `${count} reference images attached.`;
	return clipResearchChangelog(base ? `${base} ${note}` : note);
}

export function reportHeadingSlug(text: string): string {
	const slug = text
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 72)
		.replace(/-+$/g, "");
	return slug || "section";
}

export function normalizeReportHeading(value: string): string {
	return value
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, "")
		.replace(/^#{1,6}\s+/, "")
		.replace(/[*_`]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

export function stripHtmlToPlain(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/\s+/g, " ")
		.trim();
}

function escapeHeadingAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;");
}

/** Stable ids + data-report-heading on h2/h3 so the client can pin a section. */
export function stampResearchReportHeadingIds(html: string): string {
	const seen = new Map<string, number>();
	return html.replace(
		/<h([23])>([\s\S]*?)<\/h\1>/gi,
		(_match, level: string, inner: string) => {
			const plain = stripHtmlToPlain(inner);
			let slug = reportHeadingSlug(plain);
			const n = (seen.get(slug) || 0) + 1;
			seen.set(slug, n);
			if (n > 1) slug = `${slug}-${n}`;
			return `<h${level} id="rh-${slug}" data-report-heading="${escapeHeadingAttr(plain)}">${inner}</h${level}>`;
		},
	);
}

function stripSourcesForRevise(markdown: string): string {
	return markdown
		.replace(/\r\n/g, "\n")
		.trim()
		.replace(/(?:^|\n)## Sources\b[\s\S]*$/i, "")
		.trim();
}

export function splitReportSections(markdown: string): ResearchReportSection[] {
	const text = stripSourcesForRevise(markdown);
	if (!text.trim()) return [];
	const headingRe = /^(#{2,3})\s+.+$/gm;
	const matches = [...text.matchAll(headingRe)];
	if (matches.length === 0) {
		return [{ heading: "", level: 2, markdown: text.trim() }];
	}
	const sections: ResearchReportSection[] = [];
	const firstIndex = matches[0]?.index ?? 0;
	const preamble = text.slice(0, firstIndex).trim();
	if (preamble) {
		sections.push({ heading: "", level: 2, markdown: preamble });
	}
	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		if (!match) continue;
		const start = match.index ?? 0;
		const next = matches[i + 1];
		const end = next && typeof next.index === "number" ? next.index : text.length;
		const chunk = text.slice(start, end).trim();
		const marks = match[1] || "##";
		const level: 2 | 3 = marks.length >= 3 ? 3 : 2;
		const heading = (match[0] || "")
			.replace(/^#{2,3}\s+/, "")
			.trim();
		sections.push({ heading, level, markdown: chunk });
	}
	return sections;
}

function headingFromMarkdown(markdown: string): string {
	const line = markdown.replace(/\r\n/g, "\n").trim().split("\n")[0] || "";
	if (!/^#{2,3}\s+/.test(line)) return "";
	return line.replace(/^#{2,3}\s+/, "").trim();
}

function ensureHeadingMarkdown(markdown: string, heading: string): string {
	const text = markdown.replace(/\r\n/g, "\n").trim();
	if (!text) return "";
	if (/^#{2,3}\s+/.test(text) || !heading.trim()) return text;
	return `## ${heading.trim()}\n\n${text}`;
}

function findSectionIndex(
	sections: readonly ResearchReportSection[],
	heading: string,
): number {
	const key = normalizeReportHeading(heading);
	if (!key) {
		const preamble = sections.findIndex((section) => !section.heading);
		return preamble;
	}
	return sections.findIndex(
		(section) => normalizeReportHeading(section.heading) === key,
	);
}

/** Markdown of one section (by heading; "" = opening) for evidence context. */
export function reportSectionMarkdown(markdown: string, heading: string): string {
	const sections = splitReportSections(markdown);
	const idx = findSectionIndex(sections, heading);
	return idx >= 0 ? sections[idx]?.markdown || "" : "";
}

function normalizeReviseText(value: string): string {
	return value
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/[*_`>#]/g, "")
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

function splitParagraphs(markdown: string): string[] {
	return markdown
		.replace(/\r\n/g, "\n")
		.split(/\n{2,}/)
		.map((part) => part.trim())
		.filter(Boolean);
}

function updateReportFenceState(inFence: boolean, chunk: string): boolean {
	const markers = chunk.match(/^\s*```/gm)?.length || 0;
	return markers % 2 === 1 ? !inFence : inFence;
}

function tokenSet(text: string): Set<string> {
	return new Set(
		normalizeReviseText(text)
			.split(/[^a-z0-9]+/)
			.filter((token) => token.length > 2),
	);
}

/**
 * Index of the paragraph that `find` points at: exact normalized containment
 * first, then the best token-overlap match (≥ 0.55) so a lightly paraphrased
 * excerpt still lands on the right paragraph instead of appending a new one.
 */
export function locateReviseParagraph(
	paragraphs: readonly string[],
	find: string,
): number {
	const key = normalizeReviseText(find);
	if (!key) return -1;
	const exact = paragraphs.findIndex((paragraph) =>
		normalizeReviseText(paragraph).includes(key),
	);
	if (exact >= 0) return exact;
	const wanted = tokenSet(key);
	if (wanted.size < 3) return -1;
	let best = -1;
	let bestScore = 0;
	paragraphs.forEach((paragraph, index) => {
		if (/^#{1,6}\s/.test(paragraph)) return;
		const have = tokenSet(paragraph);
		if (have.size === 0) return;
		let hit = 0;
		wanted.forEach((token) => {
			if (have.has(token)) hit += 1;
		});
		const score = hit / wanted.size;
		if (score > bestScore) {
			bestScore = score;
			best = index;
		}
	});
	return bestScore >= 0.55 ? best : -1;
}

/** Replace the paragraph containing `find` inside one section; null if absent. */
function replaceParagraphInSection(
	section: ResearchReportSection,
	find: string,
	markdown: string,
): ResearchReportSection | null {
	const paragraphs = splitParagraphs(section.markdown);
	const idx = locateReviseParagraph(paragraphs, find);
	if (idx < 0) return null;
	const replacement = markdown.replace(/\r\n/g, "\n").trim();
	const next = [...paragraphs];
	if (replacement) next.splice(idx, 1, replacement);
	else next.splice(idx, 1);
	return { ...section, markdown: next.join("\n\n").trim() };
}

/**
 * Comparable key for one rendered block: markdown syntax and punctuation
 * removed so a paragraph's textContent and its markdown source agree.
 */
export function normalizeReportBlockText(text: string): string {
	return text
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, "");
}

export const REPORT_BLOCK_KEY_MIN = 12;

/** Below this token overlap, a rewrite is delete+insert, not one amber edit. */
export const REPORT_BLOCK_EDIT_SIMILARITY_MIN = 0.85;

export type ReportDiffBlockKind =
	| "heading"
	| "paragraph"
	| "list"
	| "quote"
	| "code"
	| "other";

export function reportDiffBlockKey(
	kind: ReportDiffBlockKind,
	text: string,
): string {
	const normalized = normalizeReportBlockText(text);
	if (normalized.length < REPORT_BLOCK_KEY_MIN) return "";
	return `${kind}:${normalized}`;
}

export function reportDiffBlockKindFromKey(key: string): ReportDiffBlockKind {
	const kind = key.split(":")[0];
	if (
		kind === "heading" ||
		kind === "paragraph" ||
		kind === "list" ||
		kind === "quote" ||
		kind === "code" ||
		kind === "other"
	) {
		return kind;
	}
	return "paragraph";
}

/** Block keys of a report body: paragraphs, headings, list items, quotes. */
export function reportBlockKeys(markdown: string): string[] {
	const out: string[] = [];
	const text = stripSourcesForRevise(markdown);
	let inFence = false;
	for (const chunk of splitParagraphs(text)) {
		if (/^```/.test(chunk)) {
			inFence = updateReportFenceState(inFence, chunk);
			continue;
		}
		if (inFence) continue;
		const lines = chunk.split("\n");
		const listy = lines.every((line) =>
			/^\s*(?:[-*+]|\d+[.)])\s+/.test(line) || /^\s+\S/.test(line),
		);
		if (listy) {
			let item = "";
			for (const line of lines) {
				if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
					if (item) out.push(normalizeReportBlockText(item));
					item = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
				} else {
					item += ` ${line.trim()}`;
				}
			}
			if (item) out.push(normalizeReportBlockText(item));
			continue;
		}
		out.push(
			normalizeReportBlockText(
				chunk.replace(/^\s*>\s?/gm, "").replace(/^#{1,6}\s+/, ""),
			),
		);
	}
	return out.filter((key) => key.length >= REPORT_BLOCK_KEY_MIN);
}

export interface ReportContentBlock {
	key: string;
	markdown: string;
	/** Position among every rendered markdown block, including short headings. */
	index: number;
}

/** One report block in reading order — every paragraph, heading, list item, quote. */
export interface ReportEnumeratedBlock {
	index: number;
	key: string;
	markdown: string;
}

/** Markdown blocks with normalized keys — used for add / edit / delete diffs. */
export function reportContentBlocks(markdown: string): ReportContentBlock[] {
	return enumerateReportBlocks(markdown)
		.filter((block) => block.key.length >= REPORT_BLOCK_KEY_MIN)
		.map(({ index, key, markdown: body }) => ({ index, key, markdown: body }));
}

/** Full block walk in reading order, matching the report renderer's DOM blocks. */
export function enumerateReportBlocks(markdown: string): ReportEnumeratedBlock[] {
	const out: ReportEnumeratedBlock[] = [];
	for (const block of splitReportBlocks(markdown)) {
		const chunk = block.markdown;
		const lines = chunk.split("\n");
		if (block.kind === "list") {
			let item = "";
			for (const line of lines) {
				if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
					if (item) pushEnumeratedReportBlock(out, item, "list");
					item = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
				} else {
					item += ` ${line.trim()}`;
				}
			}
			if (item) pushEnumeratedReportBlock(out, item, "list");
			continue;
		}
		const kind: ReportDiffBlockKind =
			block.kind === "heading" ||
			block.kind === "quote" ||
			block.kind === "code" ||
			block.kind === "other"
				? block.kind
				: "paragraph";
		pushEnumeratedReportBlock(
			out,
			chunk.replace(/^\s*>\s?/gm, "").replace(/^#{1,6}\s+/, ""),
			kind,
		);
	}
	return out;
}

function pushEnumeratedReportBlock(
	out: ReportEnumeratedBlock[],
	markdown: string,
	kind: ReportDiffBlockKind,
): void {
	const trimmed = markdown.trim();
	out.push({
		index: out.length,
		key: reportDiffBlockKey(kind, trimmed),
		markdown: trimmed,
	});
}

export function reportBlockIndexByKey(
	markdown: string,
	key: string,
): number {
	return enumerateReportBlocks(markdown).findIndex((block) => block.key === key);
}

export interface ReportBlockDiff {
	/** Brand-new blocks in the latest version. */
	added: string[];
	/** Rewritten blocks (a prior block at the same slot was replaced). */
	edited: string[];
	/** Blocks dropped from the prior version (shown collapsed). */
	removed: ReportRemovedBlock[];
}

export interface ReportRemovedBlock extends ReportContentBlock {
	/**
	 * Insert before the first new-version block at this full block index.
	 * `null` means the removal belonged after the final surviving block.
	 */
	beforeNextIndex: number | null;
	/** Fallback anchor when DOM indices drift (e.g. after a table). */
	beforeNextKey?: string | null;
}

type ReportDiffOp =
	| { kind: "same"; before: ReportContentBlock; after: ReportContentBlock }
	| { kind: "edit"; before: ReportContentBlock; after: ReportContentBlock }
	| { kind: "delete"; before: ReportContentBlock }
	| { kind: "insert"; after: ReportContentBlock };

function reportBlockTokens(block: ReportContentBlock): Set<string> {
	const words = block.markdown
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.match(/[\p{L}\p{N}]{3,}/gu);
	if (words?.length) return new Set(words);
	const grams = new Set<string>();
	for (let i = 0; i <= block.key.length - 4; i += 2) {
		grams.add(block.key.slice(i, i + 4));
	}
	return grams;
}

function reportBlockSimilarity(
	a: ReportContentBlock,
	b: ReportContentBlock,
): number {
	if (a.key === b.key) return 1;
	if (reportDiffBlockKindFromKey(a.key) !== reportDiffBlockKindFromKey(b.key)) {
		return 0;
	}
	const left = reportBlockTokens(a);
	const right = reportBlockTokens(b);
	if (left.size === 0 || right.size === 0) return 0;
	let shared = 0;
	for (const token of left) if (right.has(token)) shared += 1;
	return shared / Math.max(left.size, right.size);
}

/**
 * Align the old and new block streams. Exact blocks cost nothing; substitutions
 * cost less than delete+insert, with similar text preferred when one side has
 * several candidates. This keeps rewrites paired without losing true inserts.
 */
function alignReportBlocks(
	before: readonly ReportContentBlock[],
	after: readonly ReportContentBlock[],
): ReportDiffOp[] {
	const rows = before.length + 1;
	const cols = after.length + 1;
	const costs = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
	const steps = Array.from({ length: rows }, () =>
		Array<"same" | "edit" | "delete" | "insert">(cols).fill("same"),
	);
	for (let i = 1; i < rows; i += 1) {
		costs[i][0] = i;
		steps[i][0] = "delete";
	}
	for (let j = 1; j < cols; j += 1) {
		costs[0][j] = j;
		steps[0][j] = "insert";
	}
	for (let i = 1; i < rows; i += 1) {
		for (let j = 1; j < cols; j += 1) {
			const exact = before[i - 1].key === after[j - 1].key;
			const similarity = reportBlockSimilarity(before[i - 1], after[j - 1]);
			const substitute =
				costs[i - 1][j - 1] +
				(exact
					? 0
					: similarity >= REPORT_BLOCK_EDIT_SIMILARITY_MIN
						? 1.45 - similarity
						: 2.01);
			const remove = costs[i - 1][j] + 1;
			const insert = costs[i][j - 1] + 1;
			if (substitute <= remove && substitute <= insert) {
				costs[i][j] = substitute;
				steps[i][j] = exact ? "same" : "edit";
			} else if (remove <= insert) {
				costs[i][j] = remove;
				steps[i][j] = "delete";
			} else {
				costs[i][j] = insert;
				steps[i][j] = "insert";
			}
		}
	}
	const out: ReportDiffOp[] = [];
	let i = before.length;
	let j = after.length;
	while (i > 0 || j > 0) {
		const step = steps[i][j];
		if (i > 0 && j > 0 && (step === "same" || step === "edit")) {
			out.push({ kind: step, before: before[i - 1], after: after[j - 1] });
			i -= 1;
			j -= 1;
		} else if (i > 0 && (j === 0 || step === "delete")) {
			out.push({ kind: "delete", before: before[i - 1] });
			i -= 1;
		} else {
			out.push({ kind: "insert", after: after[j - 1] });
			j -= 1;
		}
	}
	return out.reverse();
}

/** Classify and position block-level changes between two report bodies. */
export function diffReportBlockChanges(base: string, next: string): ReportBlockDiff {
	const ops = alignReportBlocks(
		reportContentBlocks(base),
		reportContentBlocks(next),
	);
	const added: string[] = [];
	const edited: string[] = [];
	const removed: ReportRemovedBlock[] = [];
	for (let i = 0; i < ops.length; i += 1) {
		const op = ops[i];
		if (op.kind === "insert") {
			added.push(op.after.key);
		} else if (op.kind === "edit") {
			edited.push(op.after.key);
		} else if (op.kind === "delete") {
			const nextSurvivor = ops
				.slice(i + 1)
				.find(
					(candidate): candidate is Extract<ReportDiffOp, { after: ReportContentBlock }> =>
						candidate.kind !== "delete",
				);
			removed.push({
				...op.before,
				beforeNextIndex: nextSurvivor?.after.index ?? null,
				beforeNextKey: nextSurvivor?.after.key ?? null,
			});
		}
	}
	return { added, edited, removed };
}

/** Keys present in `next` but not `base` — every touched block (legacy helper). */
export function changedReportBlockKeys(base: string, next: string): string[] {
	const diff = diffReportBlockChanges(base, next);
	return [...diff.added, ...diff.edited];
}

export function reportBlockDiffCount(diff: ReportBlockDiff | null): number {
	if (!diff) return 0;
	return diff.added.length + diff.edited.length + diff.removed.length;
}

function completeFenceInfo(markdown: string): string | null {
	const text = markdown.replace(/\r\n/g, "\n").trim();
	const opening = text.match(/^```([^\n]*)\n/);
	if (!opening || !/\n```\s*$/.test(text)) return null;
	const markers = text.match(/^\s*```/gm)?.length || 0;
	if (markers !== 2) return null;
	return (opening[1] || "").trim().toLowerCase();
}

export type ResearchReviseOpRejectReason =
	| "unknown_block_id"
	| "outside_targets"
	| "too_many_replacement_blocks"
	| "unclosed_fence"
	| "broken_mermaid_fence"
	| "mermaid_fence_language_changed";

export interface ResearchReviseOpReject {
	op: ResearchReviseOp;
	reason: ResearchReviseOpRejectReason;
	detail: string;
}

/** Why a single writer op fails `constrainResearchRevisePatch`; null when it passes. */
export function rejectResearchReviseOpReason(
	op: ResearchReviseOp,
	options: {
		blocks: readonly ResearchReportBlock[];
		targets?: readonly string[];
	},
): ResearchReviseOpReject | null {
	const byId = new Map(options.blocks.map((block) => [block.id, block]));
	const scoped = new Set(
		(options.targets || []).map(normalizeReportBlockId).filter((id) => byId.has(id)),
	);
	const hasScope = scoped.size > 0;
	const id = normalizeReportBlockId(op.id);
	const target = byId.get(id);
	if (!target) {
		return {
			op,
			reason: "unknown_block_id",
			detail: `no block ${id || op.id} in the report`,
		};
	}
	if (hasScope && !scoped.has(id)) {
		return {
			op,
			reason: "outside_targets",
			detail: `${id} not in planner targets (${scoped.size} allowed)`,
		};
	}
	if (op.op === "delete") return null;
	const replacementBlocks = splitReportBlocks(op.markdown);
	if (replacementBlocks.length > RESEARCH_REVISE_MAX_BLOCKS_PER_OP) {
		return {
			op,
			reason: "too_many_replacement_blocks",
			detail: `${replacementBlocks.length} blocks in markdown (max ${RESEARCH_REVISE_MAX_BLOCKS_PER_OP})`,
		};
	}
	const fenceMarkers = op.markdown.match(/^\s*```/gm)?.length || 0;
	if (fenceMarkers % 2 !== 0) {
		return {
			op,
			reason: "unclosed_fence",
			detail: `${fenceMarkers} fence marker(s) — need an even count`,
		};
	}
	if (op.op === "update" && target.kind === "code") {
		const beforeInfo = completeFenceInfo(target.markdown);
		const afterInfo = completeFenceInfo(op.markdown);
		if (beforeInfo === null) {
			return {
				op,
				reason: "broken_mermaid_fence",
				detail: `existing ${id} is not a complete fenced block`,
			};
		}
		if (afterInfo !== beforeInfo) {
			return {
				op,
				reason: "mermaid_fence_language_changed",
				detail: `fence language ${afterInfo || "(missing)"} ≠ ${beforeInfo}`,
			};
		}
	}
	return null;
}

export interface ResearchRevisePatchAudit {
	kept: ResearchReviseOp[];
	rejected: ResearchReviseOpReject[];
	legacyEditsDropped: number;
	targetCount: number;
}

/** Inspect which ops survive scope/fence constraints and why others do not. */
export function auditResearchRevisePatchConstraints(options: {
	patch: ResearchRevisePatch | null;
	blocks: readonly ResearchReportBlock[];
	targets?: readonly string[];
}): ResearchRevisePatchAudit {
	const patch = options.patch;
	const scoped = new Set(
		(options.targets || [])
			.map(normalizeReportBlockId)
			.filter((id) => options.blocks.some((block) => block.id === id)),
	);
	const kept: ResearchReviseOp[] = [];
	const rejected: ResearchReviseOpReject[] = [];
	for (const op of patch?.ops || []) {
		const reason = rejectResearchReviseOpReason(op, options);
		if (reason) rejected.push(reason);
		else kept.push(op);
	}
	const hasScope = scoped.size > 0;
	return {
		kept,
		rejected,
		legacyEditsDropped: hasScope ? patch?.edits?.length || 0 : 0,
		targetCount: scoped.size,
	};
}

/** Server log line for a constrain audit (grep `[ai/research/revise]`). */
export function formatResearchRevisePatchAuditLog(
	label: string,
	audit: ResearchRevisePatchAudit,
): string {
	const lines = [
		`[ai/research/revise] ${label}: kept ${audit.kept.length}, rejected ${audit.rejected.length}, targets ${audit.targetCount}`,
	];
	if (audit.legacyEditsDropped > 0) {
		lines.push(
			`[ai/research/revise] ${label}: dropped ${audit.legacyEditsDropped} legacy heading edit(s) (scoped plan uses block ops only)`,
		);
	}
	for (const item of audit.rejected) {
		lines.push(
			`[ai/research/revise] ${label}: reject ${item.op.op}:${normalizeReportBlockId(item.op.id)} — ${item.reason} (${item.detail})`,
		);
	}
	return lines.join("\n");
}

/**
 * Enforce the planner's scope after generation. This is the hard backstop for
 * a writer that reprints unrelated blocks or damages an atomic fenced diagram.
 */
export function constrainResearchRevisePatch(options: {
	patch: ResearchRevisePatch | null;
	blocks: readonly ResearchReportBlock[];
	targets?: readonly string[];
}): ResearchRevisePatch | null {
	const patch = options.patch;
	if (!patch) return null;
	const audit = auditResearchRevisePatchConstraints(options);
	const scoped = new Set(
		(options.targets || [])
			.map(normalizeReportBlockId)
			.filter((id) => options.blocks.some((block) => block.id === id)),
	);
	const hasScope = scoped.size > 0;
	const constrained: ResearchRevisePatch = {
		...patch,
		// A scoped block plan cannot safely accept heading-based legacy edits.
		edits: hasScope ? [] : patch.edits,
		...(audit.kept.length ? { ops: audit.kept } : { ops: undefined }),
	};
	return researchRevisePatchIsEmpty(constrained) ? null : constrained;
}

/** Human-readable diff for debugging large revisions in the browser console. */
export function formatReportBlockDiffDebug(base: string, next: string): string {
	const diff = diffReportBlockChanges(base, next);
	const lines = [
		`report diff: ${reportBlockDiffCount(diff)} changes (${diff.added.length} added, ${diff.edited.length} edited, ${diff.removed.length} removed)`,
	];
	if (diff.added.length) {
		lines.push("added:");
		for (const key of diff.added) lines.push(`  + ${key}`);
	}
	if (diff.edited.length) {
		lines.push("edited:");
		for (const key of diff.edited) lines.push(`  ~ ${key}`);
	}
	if (diff.removed.length) {
		lines.push("removed:");
		for (const block of diff.removed) {
			const preview = block.markdown.replace(/\s+/g, " ").trim().slice(0, 72);
			lines.push(
				`  - [before #${block.beforeNextIndex ?? "end"}${block.beforeNextKey ? ` key=${block.beforeNextKey}` : ""}] ${preview}`,
			);
		}
	}
	return lines.join("\n");
}

export function clipEditsToWordBudget(
	edits: readonly ResearchReviseEdit[],
	max = RESEARCH_REVISE_MAX_OUTPUT_WORDS,
): ResearchReviseEdit[] {
	const out: ResearchReviseEdit[] = [];
	let used = 0;
	for (const edit of edits) {
		const markdown = edit.markdown.replace(/\r\n/g, "\n").trim();
		if (!markdown) {
			// A replace-text with empty markdown deletes that paragraph.
			if (edit.mode === "replace-text" && (edit.find || "").trim()) {
				out.push({ ...edit, markdown });
			}
			continue;
		}
		const words = countWords(markdown);
		if (used >= max) break;
		if (used + words <= max) {
			out.push({ ...edit, markdown });
			used += words;
			continue;
		}
		const tokens = markdown.split(/(\s+)/);
		let take = "";
		let n = 0;
		for (const token of tokens) {
			if (!token) continue;
			if (/^\s+$/.test(token)) {
				if (take) take += token;
				continue;
			}
			if (n + 1 > max - used) break;
			take += token;
			n += 1;
		}
		const clipped = take.trim();
		if (clipped) out.push({ ...edit, markdown: clipped });
		break;
	}
	return out;
}

export function applyResearchRevisePatch(
	markdown: string,
	patch: ResearchRevisePatch,
): string {
	if (patch.ops && patch.ops.length > 0) {
		// Block ops first; any legacy edits in the same patch apply on top.
		const afterOps = applyResearchReviseOps(markdown, patch.ops);
		if (patch.edits.length === 0) return afterOps;
		return applyResearchRevisePatch(afterOps, { ...patch, ops: [] });
	}
	const edits = clipEditsToWordBudget(patch.edits);
	if (edits.length === 0) {
		return stripSourcesForRevise(markdown);
	}
	const sections = splitReportSections(markdown);
	for (const edit of edits) {
		if (edit.mode === "replace-text") {
			const find = (edit.find || "").trim();
			if (!find) continue;
			const pinned = findSectionIndex(sections, edit.heading);
			const order =
				pinned >= 0
					? [pinned, ...sections.map((_s, i) => i).filter((i) => i !== pinned)]
					: sections.map((_s, i) => i);
			let done = false;
			for (const i of order) {
				const section = sections[i];
				if (!section) continue;
				const next = replaceParagraphInSection(section, find, edit.markdown);
				if (!next) continue;
				sections[i] = next;
				done = true;
				break;
			}
			if (done) continue;
			// Excerpt not found: fall back to a section replace only when the
			// writer gave a full section; otherwise drop rather than append junk.
			if (!/^#{2,3}\s+/.test(edit.markdown.trim())) continue;
		}
		const body = ensureHeadingMarkdown(edit.markdown, edit.heading);
		if (!body) continue;
		const idx = findSectionIndex(sections, edit.heading);
		const heading = headingFromMarkdown(body) || edit.heading;
		const next: ResearchReportSection = {
			heading,
			level: /^###\s/m.test(body) ? 3 : 2,
			markdown: body,
		};
		if (idx < 0) {
			sections.push(next);
			continue;
		}
		if (edit.mode === "insert-after") {
			sections.splice(idx + 1, 0, next);
		} else {
			sections[idx] = next;
		}
	}
	return sections
		.map((section) => section.markdown.trim())
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

function parseMode(value: unknown, hasFind: boolean): ResearchReviseEditMode {
	const mode = typeof value === "string" ? value.trim().toLowerCase() : "";
	if (mode === "insert-after") return "insert-after";
	if (
		mode === "replace-text" ||
		mode === "replace-paragraph" ||
		mode === "edit" ||
		(hasFind && mode !== "replace")
	) {
		return "replace-text";
	}
	return "replace";
}

export function parseResearchRevisePatch(raw: string): ResearchRevisePatch | null {
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") return null;
	const record = parsed as Record<string, unknown>;
	const changelog = clipResearchChangelog(
		typeof record.changelog === "string" ? record.changelog : "",
	);
	const ops: ResearchReviseOp[] = [];
	const rawOps = Array.isArray(record.ops) ? record.ops : [];
	for (const item of rawOps) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const op = parseOpKind(row.op ?? row.mode ?? row.type);
		const id = normalizeReportBlockId(row.id ?? row.block ?? row.target);
		if (!op || !id) continue;
		const body =
			typeof row.markdown === "string"
				? stripReportBlockTags(row.markdown)
				: typeof row.text === "string"
					? stripReportBlockTags(row.text)
					: "";
		if (op !== "delete" && !body) continue;
		ops.push({ op, id, markdown: op === "delete" ? "" : body });
	}
	const list = Array.isArray(record.edits)
		? record.edits
		: Array.isArray(record.operations)
			? record.operations
			: [];
	const edits: ResearchReviseEdit[] = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		// Block-addressed rows sometimes land in `edits`; route them to ops.
		const rowId = normalizeReportBlockId(row.id ?? row.block);
		const rowOp = parseOpKind(row.op ?? row.mode);
		if (rowId && rowOp && !(typeof row.heading === "string" && row.heading.trim())) {
			const body = typeof row.markdown === "string" ? stripReportBlockTags(row.markdown) : "";
			if (rowOp === "delete" || body) {
				ops.push({ op: rowOp, id: rowId, markdown: rowOp === "delete" ? "" : body });
			}
			continue;
		}
		const markdown =
			typeof row.markdown === "string"
				? row.markdown.replace(/\r\n/g, "\n").trim()
				: "";
		const find =
			typeof row.find === "string"
				? row.find.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_QUOTE_MAX)
				: "";
		const mode = parseMode(row.mode, Boolean(find));
		if (!markdown && !(mode === "replace-text" && find)) continue;
		edits.push({
			heading: clipResearchReviseHeading(
				typeof row.heading === "string" ? row.heading : "",
			),
			mode,
			markdown,
			...(find ? { find } : {}),
		});
	}
	if (!changelog && edits.length === 0 && ops.length === 0) return null;
	return {
		changelog,
		edits: clipEditsToWordBudget(edits),
		...(ops.length ? { ops: clipOpsToWordBudget(ops) } : {}),
	};
}

export function researchRevisePatchIsEmpty(patch: ResearchRevisePatch | null): boolean {
	return !patch || (patch.edits.length === 0 && !(patch.ops && patch.ops.length > 0));
}

/** Truncated JSON (output cap) should not be treated as a generic writer failure. */
export function researchReviseFailedAsTooLong(input: {
	patch: ResearchRevisePatch | null;
	truncated?: boolean;
	content?: string;
}): boolean {
	if (input.patch && !researchRevisePatchIsEmpty(input.patch)) return false;
	if (input.truncated) return true;
	const text = (input.content || "").trim();
	if (!text) return false;
	const start = text.indexOf("{");
	if (start < 0) return false;
	const end = text.lastIndexOf("}");
	return end <= start;
}

export function sanitizeResearchVersionMeta(
	raw: unknown,
): ResearchVersionMeta | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const n = Math.floor(Number(record.n));
	if (!Number.isFinite(n) || n < 1) return null;
	const at = Math.floor(Number(record.at));
	const heading =
		typeof record.heading === "string"
			? clipResearchReviseHeading(record.heading)
			: "";
	const fromRaw = record.from;
	const from =
		fromRaw === null || fromRaw === undefined
			? null
			: Math.floor(Number(fromRaw));
	const stats = sanitizeResearchHistoryReportStats(record.stats);
	return {
		n,
		at: Number.isFinite(at) && at > 0 ? at : Date.now(),
		instruction: clipResearchReviseInstruction(
			typeof record.instruction === "string" ? record.instruction : "",
		),
		changelog: clipResearchChangelog(
			typeof record.changelog === "string" ? record.changelog : "",
		),
		from: from && Number.isFinite(from) && from > 0 ? from : null,
		...(heading ? { heading } : {}),
		...(stats ? { stats } : {}),
	};
}

/** Section markdown that holds `text` (pinned quote), or "" when not found. */
/** Block ids holding `text` (a pinned selection may span several blocks). */
export function reportBlocksContainingText(
	blocks: readonly ResearchReportBlock[],
	text: string,
): string[] {
	const key = normalizeReviseText(text || "");
	if (!key) return [];
	const bodies = blocks.map((block) => block.markdown);
	const out: string[] = [];
	// A selection spanning blocks: each block whose text is a substring of it.
	if (key.length > 40) {
		blocks.forEach((block) => {
			const body = normalizeReviseText(block.markdown);
			if (body.length > 20 && key.includes(body)) out.push(block.id);
		});
		if (out.length > 0) return out;
	}
	const index = locateReviseParagraph(bodies, text);
	return index >= 0 && blocks[index] ? [blocks[index].id] : [];
}

/** One reader edit: optional pin + instruction (API + job storage). */
export interface ResearchReviseEdit {
	instruction: string;
	blockIds?: string[];
	heading?: string;
	quote?: string;
}

function parseResearchReviseEdit(raw: unknown): ResearchReviseEdit | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const instruction = clipResearchReviseInstruction(
		typeof record.instruction === "string" ? record.instruction : "",
	);
	if (!instruction) return null;
	const edit: ResearchReviseEdit = { instruction };
	const heading = clipResearchReviseHeading(
		typeof record.heading === "string" ? record.heading : "",
	);
	const quote = clipResearchReviseQuote(
		typeof record.quote === "string" ? record.quote : "",
	);
	if (heading) edit.heading = heading;
	if (quote) edit.quote = quote;
	if (Array.isArray(record.blockIds)) {
		const blockIds = record.blockIds
			.filter((id): id is string => typeof id === "string")
			.map((id) => id.trim())
			.filter((id) => /^[phtc]\d{1,4}$/i.test(id))
			.slice(0, RESEARCH_REVISE_TARGETS_MAX);
		if (blockIds.length > 0) edit.blockIds = blockIds;
	}
	return edit;
}

/** Accept `edits[]` or legacy single instruction + heading/quote. */
export function normalizeResearchReviseEdits(body: {
	edits?: unknown;
	instruction?: string;
	heading?: string;
	quote?: string;
}): ResearchReviseEdit[] {
	if (Array.isArray(body.edits) && body.edits.length > 0) {
		const parsed = body.edits
			.map(parseResearchReviseEdit)
			.filter((edit): edit is ResearchReviseEdit => Boolean(edit))
			.slice(0, RESEARCH_REVISE_EDITS_MAX);
		if (parsed.length > 0) return parsed;
	}
	const instruction = clipResearchReviseInstruction(body.instruction || "");
	if (!instruction) return [];
	const edit: ResearchReviseEdit = { instruction };
	const heading = clipResearchReviseHeading(body.heading || "");
	const quote = clipResearchReviseQuote(body.quote || "");
	if (heading) edit.heading = heading;
	if (quote) edit.quote = quote;
	return [edit];
}

export function sanitizeResearchReviseEdits(raw: unknown): ResearchReviseEdit[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map(parseResearchReviseEdit)
		.filter((edit): edit is ResearchReviseEdit => Boolean(edit))
		.slice(0, RESEARCH_REVISE_EDITS_MAX);
}

const knownBlockIds = (
	blocks: readonly ResearchReportBlock[],
): Set<string> => new Set(blocks.map((block) => block.id));

/** Resolve pinned block ids for one edit (explicit ids, else quote lookup). */
export function resolveReviseEditBlockIds(
	edit: ResearchReviseEdit,
	blocks: readonly ResearchReportBlock[],
): string[] {
	const known = knownBlockIds(blocks);
	const fromIds = (edit.blockIds || []).filter((id) => known.has(id));
	if (fromIds.length > 0) return fromIds;
	if (edit.quote) return reportBlocksContainingText(blocks, edit.quote);
	return [];
}

export function pinnedBlockIdsFromReviseEdits(
	edits: readonly ResearchReviseEdit[],
	blocks: readonly ResearchReportBlock[],
): string[] {
	return [
		...new Set(edits.flatMap((edit) => resolveReviseEditBlockIds(edit, blocks))),
	];
}

export function reviseEditsPlannerInstruction(
	edits: readonly ResearchReviseEdit[],
): string {
	if (edits.length === 1) return edits[0]?.instruction || "";
	return edits
		.map((edit, index) => `Edit ${index + 1}: ${edit.instruction}`)
		.join("\n");
}

export function reviseEditsPlannerScopeBlock(
	edits: readonly ResearchReviseEdit[],
	blocks: readonly ResearchReportBlock[],
): string {
	if (edits.length <= 1) return "";
	const lines: string[] = ["The reader requested these distinct edits:"];
	edits.forEach((edit, index) => {
		lines.push(`${index + 1}. ${edit.instruction}`);
		if (edit.heading) lines.push(`   Section: ${edit.heading}`);
		const ids = resolveReviseEditBlockIds(edit, blocks);
		if (ids.length > 0) lines.push(`   Blocks: ${ids.join(", ")}`);
		else if (edit.quote) {
			lines.push(
				`   Passage: ${formatResearchReviseQuoteForModel(edit.quote)}`,
			);
		}
	});
	return lines.join("\n");
}

export function reportSectionContainingText(
	markdown: string,
	text: string,
): string {
	const find = (text || "").trim();
	if (!find) return "";
	for (const section of splitReportSections(markdown)) {
		if (locateReviseParagraph(splitParagraphs(section.markdown), find) >= 0) {
			return section.markdown;
		}
	}
	return "";
}

/** Drawer row: "6,589 words (+312) · 51 cited (+2) · 115 sources". */
export function formatResearchVersionStats(
	stats?: ResearchHistoryReportStats | null,
	previous?: ResearchHistoryReportStats | null,
): string {
	if (!stats) return "";
	const delta = (now: number, before?: number): string => {
		if (typeof before !== "number" || !previous) return "";
		const diff = now - before;
		if (diff === 0) return "";
		return ` (${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("en-US")})`;
	};
	const parts: string[] = [];
	if (stats.words > 0) {
		parts.push(
			`${stats.words.toLocaleString("en-US")} ${stats.words === 1 ? "word" : "words"}${delta(stats.words, previous?.words)}`,
		);
	}
	if (stats.cited > 0) {
		parts.push(
			`${stats.cited.toLocaleString("en-US")} cited${delta(stats.cited, previous?.cited)}`,
		);
	}
	if (stats.additional > 0) {
		parts.push(
			`${stats.additional.toLocaleString("en-US")} ${stats.additional === 1 ? "source" : "sources"}${delta(stats.additional, previous?.additional)}`,
		);
	}
	return parts.join(" · ");
}

export function clipResearchVersionIndex(value: unknown): ResearchVersionMeta[] {
	if (!Array.isArray(value)) return [];
	const out: ResearchVersionMeta[] = [];
	const seen = new Set<number>();
	for (const item of value) {
		const meta = sanitizeResearchVersionMeta(item);
		if (!meta || seen.has(meta.n)) continue;
		seen.add(meta.n);
		out.push(meta);
	}
	out.sort((a, b) => a.n - b.n);
	return out;
}

export function nextResearchVersionN(
	index: readonly ResearchVersionMeta[],
): number {
	let max = 0;
	for (const item of index) {
		if (item.n > max) max = item.n;
	}
	return max + 1;
}

export function currentResearchVersionN(
	index: readonly ResearchVersionMeta[],
): number {
	if (index.length === 0) return 1;
	return index[index.length - 1]?.n || 1;
}

/** True when a stored hop marks a revision that actually shipped a version. */
function processNoteLooksLikeCompletedRevise(note: string): boolean {
	const n = note.replace(/\s+/g, " ").trim();
	// “Revising the report…” / “Started vN revision” run before the writer
	// returns — they must not advance the version chip or heal v2 from v1.
	return /^revised the report\b/i.test(n) && !/^revising the report/i.test(n);
}

function shippedVersionFromProcessNote(note: string): number {
	const n = note.replace(/\s+/g, " ").trim();
	if (!processNoteLooksLikeCompletedRevise(n)) return 0;
	const match = n.match(/^revised the report(?:\s*[·•]\s*v(\d+))?/i);
	if (match?.[1]) return Math.max(2, Number(match[1]) || 0);
	return 2;
}

function maxShippedVersionFromProcessNotes(
	notes?: readonly string[] | null,
): number {
	let max = 0;
	for (const note of notes || []) {
		if (typeof note !== "string") continue;
		max = Math.max(max, shippedVersionFromProcessNote(note));
	}
	return max;
}

function extendResearchVersionIndexToN(
	index: readonly ResearchVersionMeta[],
	targetN: number,
	options: {
		createdAt?: number;
		stats?: ResearchHistoryReportStats | null;
	} = {},
): ResearchVersionMeta[] {
	const goal = Math.max(1, Math.floor(targetN));
	const current = currentResearchVersionN(index);
	if (current >= goal) return [...index];
	const v1 =
		index[0] ||
		openingResearchVersionMeta(
			options.createdAt && options.createdAt > 0 ? options.createdAt : Date.now(),
		);
	const stats = sanitizeResearchHistoryReportStats(options.stats);
	const rows: ResearchVersionMeta[] = [v1];
	for (let n = 2; n <= goal; n += 1) {
		rows.push({
			n,
			at: v1.at > 0 ? v1.at + n * 1_000 : Date.now(),
			instruction: "",
			changelog:
				n === 2 ? "Revised the report." : `Revised the report · v${n}`,
			from: n - 1,
			...(n === goal && stats ? { stats } : {}),
		});
	}
	return clipResearchVersionIndex(rows);
}

export function researchProcessCompletedRevise(
	notes?: readonly string[] | null,
): boolean {
	return (notes || []).some(
		(note) => typeof note === "string" && processNoteLooksLikeCompletedRevise(note),
	);
}

/**
 * Jobs that revised in place before v2 was stored still have only v1 in the
 * index. Recover a v2 row from the process hops so the toolbar and drawer match.
 */
export function healedResearchVersionIndex(input: {
	versionIndex?: readonly ResearchVersionMeta[] | null;
	processNotes?: readonly string[] | null;
	createdAt?: number;
	/** Current body stats, stamped on the recovered v2 row. */
	stats?: ResearchHistoryReportStats | null;
}): ResearchVersionMeta[] {
	const index = clipResearchVersionIndex(input.versionIndex);
	const shippedN = maxShippedVersionFromProcessNotes(input.processNotes);
	if (shippedN > currentResearchVersionN(index)) {
		return extendResearchVersionIndexToN(index, shippedN, {
			createdAt: input.createdAt,
			stats: input.stats,
		});
	}
	if (!researchProcessCompletedRevise(input.processNotes)) return index;
	if (currentResearchVersionN(index) >= 2) return index;
	const v1 =
		index[0] ||
		openingResearchVersionMeta(
			input.createdAt && input.createdAt > 0 ? input.createdAt : Date.now(),
		);
	const stats = sanitizeResearchHistoryReportStats(input.stats);
	return clipResearchVersionIndex([
		v1,
		{
			n: 2,
			at: v1.at > 0 ? v1.at + 1_000 : Date.now(),
			instruction: "",
			changelog: "Revised the report.",
			from: 1,
			...(stats ? { stats } : {}),
		},
	]);
}

export const RESEARCH_OPENING_CHANGELOG = "Original report.";

export function openingResearchVersionMeta(
	at = Date.now(),
	stats?: ResearchHistoryReportStats | null,
): ResearchVersionMeta {
	const clean = sanitizeResearchHistoryReportStats(stats);
	return {
		n: 1,
		at,
		instruction: "",
		changelog: RESEARCH_OPENING_CHANGELOG,
		from: null,
		...(clean ? { stats: clean } : {}),
	};
}

export function mergeResearchHits<T extends { slug: string }>(
	existing: readonly T[],
	extra: readonly T[],
	max = 160,
): T[] {
	const out: T[] = [];
	const seen = new Set<string>();
	for (const hit of [...existing, ...extra]) {
		const slug = hit.slug.replace(/\s+/g, "").trim().toLowerCase();
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(hit);
		if (out.length >= max) break;
	}
	return out;
}

export function formatResearchVersionLabel(
	index: readonly ResearchVersionMeta[],
	previewN?: number | null,
): string {
	const current = currentResearchVersionN(index);
	const n =
		typeof previewN === "number" && previewN > 0 ? previewN : current;
	if (index.length === 0) return "v1";
	return n === current ? `v${n}` : `v${n} · preview`;
}

/** Toolbar label while a revise is in flight stays on the shipped head. */
export function formatResearchVersionLabelForTurn(
	index: readonly ResearchVersionMeta[],
	options: { previewN?: number | null; revising?: boolean } = {},
): string {
	if (options.revising) {
		return formatResearchVersionLabel(index, options.previewN ?? null);
	}
	return formatResearchVersionLabel(index, options.previewN);
}

export function versionBodiesToKeep(
	index: readonly ResearchVersionMeta[],
	max = RESEARCH_REVISE_BODIES_MAX,
): number[] {
	const nums = index.map((item) => item.n);
	if (nums.length <= max) return nums;
	return nums.slice(nums.length - max);
}

/** True when a stored report body may exist for this version number. */
export function isResearchVersionBodyStored(
	n: number,
	index: readonly ResearchVersionMeta[],
	max = RESEARCH_REVISE_BODIES_MAX,
): boolean {
	return versionBodiesToKeep(index, max).includes(n);
}

