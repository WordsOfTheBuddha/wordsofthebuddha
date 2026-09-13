import { extractJsonObject } from "./extractJsonObject";

/** Output delta per revise pass — not an ingest cap. */
export const RESEARCH_REVISE_MAX_OUTPUT_WORDS = 5_000;
export const RESEARCH_REVISE_CHANGELOG_MAX = 180;
export const RESEARCH_REVISE_INSTRUCTION_MAX = 2_000;
export const RESEARCH_REVISE_QUOTE_MAX = 800;
export const RESEARCH_REVISE_HEADING_MAX = 180;
/** Version bodies kept in the subcollection. */
export const RESEARCH_REVISE_BODIES_MAX = 8;

export type ResearchReviseEditMode = "replace" | "insert-after";

export interface ResearchReviseEdit {
	heading: string;
	mode: ResearchReviseEditMode;
	markdown: string;
}

export interface ResearchRevisePatch {
	changelog: string;
	edits: ResearchReviseEdit[];
}

export interface ResearchVersionMeta {
	n: number;
	at: number;
	instruction: string;
	changelog: string;
	from: number | null;
	heading?: string;
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

export function clipEditsToWordBudget(
	edits: readonly ResearchReviseEdit[],
	max = RESEARCH_REVISE_MAX_OUTPUT_WORDS,
): ResearchReviseEdit[] {
	const out: ResearchReviseEdit[] = [];
	let used = 0;
	for (const edit of edits) {
		const markdown = edit.markdown.replace(/\r\n/g, "\n").trim();
		if (!markdown) continue;
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
	const edits = clipEditsToWordBudget(patch.edits);
	if (edits.length === 0) {
		return stripSourcesForRevise(markdown);
	}
	const sections = splitReportSections(markdown);
	for (const edit of edits) {
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

function parseMode(value: unknown): ResearchReviseEditMode {
	return value === "insert-after" ? "insert-after" : "replace";
}

export function parseResearchRevisePatch(raw: string): ResearchRevisePatch | null {
	const parsed = extractJsonObject(raw);
	if (!parsed || typeof parsed !== "object") return null;
	const record = parsed as Record<string, unknown>;
	const changelog = clipResearchChangelog(
		typeof record.changelog === "string" ? record.changelog : "",
	);
	const list = Array.isArray(record.edits)
		? record.edits
		: Array.isArray(record.operations)
			? record.operations
			: [];
	const edits: ResearchReviseEdit[] = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const markdown =
			typeof row.markdown === "string"
				? row.markdown.replace(/\r\n/g, "\n").trim()
				: "";
		if (!markdown) continue;
		edits.push({
			heading: clipResearchReviseHeading(
				typeof row.heading === "string" ? row.heading : "",
			),
			mode: parseMode(row.mode),
			markdown,
		});
	}
	if (!changelog && edits.length === 0) return null;
	return { changelog, edits: clipEditsToWordBudget(edits) };
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
	};
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

export const RESEARCH_OPENING_CHANGELOG = "Original report.";

export function openingResearchVersionMeta(
	at = Date.now(),
): ResearchVersionMeta {
	return {
		n: 1,
		at,
		instruction: "",
		changelog: RESEARCH_OPENING_CHANGELOG,
		from: null,
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
