import { extractJsonObject } from "./extractJsonObject";
import {
	sanitizeResearchHistoryReportStats,
	type ResearchHistoryReportStats,
} from "./aiAskResearchHistoryStats";

/** Soft clip for a large patch (~50k completion tokens). Ingest stays 100k chars. */
export const RESEARCH_REVISE_MAX_OUTPUT_WORDS = 35_000;
export const RESEARCH_REVISE_CHANGELOG_MAX = 320;
export const RESEARCH_REVISE_INSTRUCTION_MAX = 2_000;
export const RESEARCH_REVISE_QUOTE_MAX = 800;
export const RESEARCH_REVISE_HEADING_MAX = 180;
/** Version bodies kept in the subcollection. */
export const RESEARCH_REVISE_BODIES_MAX = 8;
export const RESEARCH_REVISE_TOO_LONG_ERROR =
	"The revision was too long to finish. Try a smaller change.";
export const RESEARCH_REVISE_CONSIDERING_NOTE = "Considering the revision…";
export const RESEARCH_REVISE_SEARCH_NOTE = "Looking up additional discourses…";
export const RESEARCH_REVISE_WRITING_NOTE = "Revising the report…";

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
}

const REPORT_BLOCK_TAG = /^\[\[p\d+\]\]\s*$/;

/**
 * Split a report body into addressable blocks. Blank lines separate blocks;
 * fenced code stays whole; a run of list lines is one block.
 */
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
	for (const line of lines) {
		if (/^\s*```/.test(line)) {
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
			flush();
			continue;
		}
		if (REPORT_BLOCK_TAG.test(line)) continue;
		current.push(line);
	}
	flush();
	let section = "";
	return chunks.map((chunk, index) => {
		const first = chunk.split("\n")[0] || "";
		let kind: ResearchReportBlock["kind"] = "paragraph";
		if (/^#{1,6}\s+/.test(first)) {
			kind = "heading";
			if (/^#{2,3}\s+/.test(first)) {
				section = first.replace(/^#{2,3}\s+/, "").trim();
			}
		} else if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(first)) kind = "list";
		else if (/^\s*>/.test(first)) kind = "quote";
		else if (/^\s*```/.test(first)) kind = "code";
		else if (/^\s*(?:\||<)/.test(first)) kind = "other";
		return { id: `p${index + 1}`, markdown: chunk, section, kind };
	});
}

/** Report text as the writer sees it: every block preceded by its [[pN]] tag. */
export function numberedReportForModel(blocks: readonly ResearchReportBlock[]): string {
	return blocks.map((block) => `[[${block.id}]]\n${block.markdown}`).join("\n\n");
}

/** Strip any [[pN]] tags a model echoes back inside new markdown. */
export function stripReportBlockTags(markdown: string): string {
	return markdown
		.replace(/\r\n/g, "\n")
		.split("\n")
		.filter((line) => !REPORT_BLOCK_TAG.test(line))
		.join("\n")
		.replace(/\[\[p\d+\]\]\s*/g, "")
		.trim();
}

export function normalizeReportBlockId(value: unknown): string {
	const text = typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
	const match = text.trim().match(/p?(\d+)/i);
	return match ? `p${Number(match[1])}` : "";
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
	const targets = [...new Set(list(record.targets).map(normalizeReportBlockId).filter(Boolean))].slice(0, 12);
	const intent = typeof record.intent === "string" ? clipResearchReviseInstruction(record.intent) : "";
	const searchQueries = [...new Set(list(record.searchQueries).map((q) => q.slice(0, 120)))].slice(0, 3);
	const readFull = [
		...new Set(
			list(record.readFull)
				.map((id) => id.toLowerCase().replace(/\s+/g, ""))
				.filter((id) => /^[a-z]+\d+(?:\.\d+)*$/.test(id)),
		),
	].slice(0, 4);
	if (!targets.length && !intent && !searchQueries.length && !readFull.length) return null;
	return { targets, intent, searchQueries, readFull };
}

export interface ResearchVersionMeta {
	n: number;
	at: number;
	instruction: string;
	changelog: string;
	from: number | null;
	heading?: string;
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

export function clipResearchReviseInstruction(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_INSTRUCTION_MAX);
}

export function clipResearchReviseQuote(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_QUOTE_MAX);
}

export function clipResearchReviseHeading(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_HEADING_MAX);
}

export function clipResearchChangelog(value: string): string {
	return value.replace(/\s+/g, " ").trim().slice(0, RESEARCH_REVISE_CHANGELOG_MAX);
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

/** Block keys of a report body: paragraphs, headings, list items, quotes. */
export function reportBlockKeys(markdown: string): string[] {
	const out: string[] = [];
	const text = stripSourcesForRevise(markdown);
	let inFence = false;
	for (const chunk of splitParagraphs(text)) {
		if (/^```/.test(chunk)) {
			inFence = !inFence || !/```\s*$/.test(chunk);
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

/** Full block walk in reading order (includes short blocks skipped by diffs). */
export function enumerateReportBlocks(markdown: string): ReportEnumeratedBlock[] {
	const out: ReportEnumeratedBlock[] = [];
	const text = stripSourcesForRevise(markdown);
	let inFence = false;
	for (const chunk of splitParagraphs(text)) {
		if (/^```/.test(chunk)) {
			inFence = !inFence || !/```\s*$/.test(chunk);
			continue;
		}
		if (inFence) continue;
		const lines = chunk.split("\n");
		const listy = lines.every(
			(line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line) || /^\s+\S/.test(line),
		);
		if (listy) {
			let item = "";
			for (const line of lines) {
				if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
					if (item) pushEnumeratedReportBlock(out, item);
					item = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
				} else {
					item += ` ${line.trim()}`;
				}
			}
			if (item) pushEnumeratedReportBlock(out, item);
			continue;
		}
		pushEnumeratedReportBlock(
			out,
			chunk.replace(/^\s*>\s?/gm, "").replace(/^#{1,6}\s+/, ""),
		);
	}
	return out;
}

function pushEnumeratedReportBlock(
	out: ReportEnumeratedBlock[],
	markdown: string,
): void {
	const trimmed = markdown.trim();
	out.push({
		index: out.length,
		key: normalizeReportBlockText(trimmed),
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
			const substitute = costs[i - 1][j - 1] + (exact ? 0 : 1.45 - similarity);
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

function processNoteLooksLikeCompletedRevise(note: string): boolean {
	const n = note.replace(/\s+/g, " ").trim();
	return (
		/^(?:revised|revising) the report/i.test(n) ||
		/^(?:considered|considering) the revision/i.test(n) ||
		/^started v\d+ revision/i.test(n)
	);
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

export function versionBodiesToKeep(
	index: readonly ResearchVersionMeta[],
	max = RESEARCH_REVISE_BODIES_MAX,
): number[] {
	const nums = index.map((item) => item.n);
	if (nums.length <= max) return nums;
	return nums.slice(nums.length - max);
}

/** Style-only prompts skip library search. Named IDs or “add/include” still search. */
export function researchReviseNeedsSearch(
	instruction: string,
	namedIds: readonly string[] = [],
): boolean {
	if (namedIds.length > 0) return true;
	const text = instruction.replace(/\s+/g, " ").trim();
	if (!text) return false;
	return /\b(add|include|cite|bring in|also|missing|sutta|suttas|discourse|discourses)\b/i.test(
		text,
	);
}
