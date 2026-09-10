import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	linkifyAskSummaryHtml,
	linkifyDiscourseIdText,
	looksLikeAskMarkdown,
	normalizeAskSummaryProse,
} from "./linkifyAskSummary";
import { transformId } from "./transformId";

export const RESEARCH_REPORT_MAX_CHARS = 20_000;

export const RESEARCH_REPORT_SYSTEM = `You write a research report from early Buddhist discourses already selected for the reader. You do not search. You do not invent citations.

Write GitHub-flavored markdown only (no JSON, no HTML tags). Use:
- ## / ### headings
- short paragraphs and lists
- markdown tables when a comparison, map of collections, or survey of facets helps
- ordinary discourse IDs in prose (MN 10, SN 22.59) — only IDs whose excerpts or full text you were given
- no ## Sources section — the harness appends a bilingual source list

Rules:
- Write only from the excerpts. If a discourse merely lists terms, say that — do not claim it defines them.
- Do not import stock Dhamma unless the excerpt states it.
- Prefer a readable document over padding. Tables should have a header row.
- Space after sentence punctuation. Never glue a discourse ID to the period.
- Hard / controversial questions: report what the excerpts say and what they do not declare. No safety sermon.
- Never give crisis counseling, medical, or legal advice.
- If excerpts are empty, write a short note that the library did not yield a report.`;

export interface ResearchReportResult {
	report: string;
	model: string;
	reasoning: string;
}

function escapeAlreadyLinkedInline(
	html: string,
): string {
	return html
		.replace(/\*\*((?:(?!\*\*).)+)\*\*/g, "<strong>$1</strong>")
		.replace(
			/(^|[\s(>])\*([^*\n<]+)\*(?=[\s).,;:!?<*]|$)/g,
			"$1<em>$2</em>",
		);
}

function inlineHtml(
	text: string,
	results: readonly { slug: string; href?: string }[],
): string {
	return escapeAlreadyLinkedInline(linkifyDiscourseIdText(text, results));
}

function splitTableRow(line: string): string[] {
	const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
	return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
	const cells = splitTableRow(line);
	return (
		cells.length > 0 &&
		cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")))
	);
}

function isTableBlock(lines: readonly string[]): boolean {
	if (lines.length < 2) return false;
	if (!lines[0]?.includes("|")) return false;
	return isSeparatorRow(lines[1] || "");
}

function renderTable(
	lines: readonly string[],
	results: readonly { slug: string; href?: string }[],
): string {
	const header = splitTableRow(lines[0] || "");
	const body = lines.slice(2).filter((line) => line.includes("|"));
	const th = header
		.map((cell) => `<th>${inlineHtml(cell, results)}</th>`)
		.join("");
	const rows = body
		.map((line) => {
			const cells = splitTableRow(line);
			while (cells.length < header.length) cells.push("");
			return `<tr>${cells
				.slice(0, header.length)
				.map((cell) => `<td>${inlineHtml(cell, results)}</td>`)
				.join("")}</tr>`;
		})
		.join("");
	return `<div class="ai-report-table-wrap"><table class="ai-report-table"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderList(
	lines: readonly string[],
	ordered: boolean,
	results: readonly { slug: string; href?: string }[],
): string {
	const items = lines
		.map((line) =>
			line.replace(ordered ? /^\d+[.)]\s+/ : /^[-*•]\s+/, ""),
		)
		.map((line) => `<li>${inlineHtml(line, results)}</li>`)
		.join("");
	return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
}

function isQuoteBlock(lines: readonly string[]): boolean {
	const nonempty = lines.filter((line) => line.trim());
	return (
		nonempty.length > 0 &&
		nonempty.every((line) => /^>\s?/.test(line.trim()))
	);
}

function renderQuote(
	lines: readonly string[],
	results: readonly { slug: string; href?: string }[],
): string {
	const text = lines
		.map((line) => line.trim().replace(/^>\s?/, ""))
		.filter(Boolean)
		.join(" ");
	if (!text) return "";
	return `<blockquote><p>${inlineHtml(text, results)}</p></blockquote>`;
}

function renderHeading(
	line: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const match = line.match(/^(#{1,3})\s+(.*)$/);
	if (!match) return `<p>${inlineHtml(line, results)}</p>`;
	const level = match[1]?.length || 2;
	const tag = level === 1 ? "h2" : level === 2 ? "h2" : "h3";
	return `<${tag}>${inlineHtml(match[2] || "", results)}</${tag}>`;
}

function renderBlock(
	block: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const lines = block
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => line.trim());
	if (lines.length === 0) return "";
	if (isQuoteBlock(lines)) return renderQuote(lines, results);
	if (isTableBlock(lines)) return renderTable(lines, results);
	const bullet = lines.every((line) => /^[-*•]\s+/.test(line.trim()));
	const numbered = lines.every((line) => /^\d+[.)]\s+/.test(line.trim()));
	if (bullet || numbered) {
		return renderList(
			lines.map((line) => line.trim()),
			numbered,
			results,
		);
	}
	if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0] || "")) {
		return renderHeading((lines[0] || "").trim(), results);
	}
	return `<p>${lines.map((line) => inlineHtml(line.trim(), results)).join("<br>")}</p>`;
}

export function clipResearchReport(
	value: string,
	max = RESEARCH_REPORT_MAX_CHARS,
): string {
	return value.replace(/\r\n/g, "\n").trim().slice(0, Math.max(0, max));
}

export function parseResearchReportMarkdown(raw: string): string {
	let text = raw
		.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
		.replace(/\r\n/g, "\n")
		.trim();
	text = text.replace(/^```(?:markdown|md)?\n/i, "").replace(/\n```$/i, "");
	text = text.replace(/^["']+|["']+$/g, "").trim();
	if (text.startsWith("{")) {
		try {
			const parsed = JSON.parse(text) as { report?: unknown; markdown?: unknown };
			const fromJson =
				typeof parsed.report === "string"
					? parsed.report
					: typeof parsed.markdown === "string"
						? parsed.markdown
						: "";
			if (fromJson.trim()) text = fromJson.trim();
		} catch {
			/* keep stripped text */
		}
	}
	return clipResearchReport(text);
}

/** Split a catalog title (`Pali - English`) for source lines. */
export function splitDiscourseDisplayTitle(title: string): {
	pali: string;
	english: string;
} {
	const trimmed = title.replace(/\s+/g, " ").trim();
	const idx = trimmed.indexOf(" - ");
	if (idx === -1) return { pali: trimmed, english: "" };
	return {
		pali: trimmed.slice(0, idx).trim(),
		english: trimmed.slice(idx + 3).trim(),
	};
}

export function formatResearchSourceLabel(title: string): string {
	const { pali, english } = splitDiscourseDisplayTitle(title);
	if (english && pali && english !== pali) return `${pali} — ${english}`;
	return pali || english;
}

/** Card heading: Pāli title, then English, matching Search cards. */
export function formatResearchHitTitle(title: string): string {
	const { pali, english } = splitDiscourseDisplayTitle(title);
	if (english && pali && english !== pali) return `${pali} - ${english}`;
	return pali || english || title.replace(/\s+/g, " ").trim();
}

export function formatResearchSourceLine(hit: {
	slug: string;
	title?: string;
	volpage?: string;
}): string {
	const id = transformId(hit.slug) || hit.slug;
	const label = formatResearchSourceLabel(hit.title || "");
	const pts = (hit.volpage || "").replace(/\s+/g, " ").trim();
	const base = label ? `${id} — ${label}` : id;
	return pts ? `${base} · ${pts}` : base;
}

export function buildResearchSourcesMarkdown(
	hits: readonly { slug: string; title?: string }[],
): string {
	const lines = hits
		.filter((hit) => (hit.slug || "").trim())
		.map((hit) => `- ${formatResearchSourceLine(hit)}`);
	if (lines.length === 0) return "";
	return `## Sources\n\n${lines.join("\n")}`;
}

export function replaceResearchSourcesSection(
	markdown: string,
	hits: readonly { slug: string; title?: string }[],
): string {
	const body = stripResearchSourcesSection(markdown);
	const sources = buildResearchSourcesMarkdown(hits);
	if (!sources) return body;
	if (!body) return sources;
	return `${body}\n\n${sources}`;
}

export function stripResearchSourcesSection(markdown: string): string {
	return clipResearchReport(markdown)
		.replace(/(?:^|\n)## Sources\b[\s\S]*$/i, "")
		.trim();
}

/** Ask briefing: prose paragraphs, or the report renderer when they asked for structure. */
export function renderAskBriefingHtml(
	summary: string,
	results: readonly { slug: string; href?: string }[] = [],
): string {
	const text = normalizeAskSummaryProse(summary);
	if (!text) return "";
	if (looksLikeAskMarkdown(text)) {
		return renderResearchReportHtml(text, results);
	}
	return linkifyAskSummaryHtml(text, results);
}

export function renderResearchReportHtml(
	markdown: string,
	results: readonly { slug: string; href?: string }[] = [],
): string {
	const text = stripResearchSourcesSection(markdown);
	if (!text) return "";
	return text
		.split(/\n{2,}/)
		.map((block) => renderBlock(block, results))
		.filter(Boolean)
		.join("");
}

export function fallbackResearchReport(options: {
	question: string;
	hits: readonly AiDiscourseHit[];
	emptyReason?: string;
}): string {
	const question = options.question.replace(/\s+/g, " ").trim();
	if (options.hits.length === 0) {
		return `## Report

${options.emptyReason || "The library search did not return matching discourses for this brief."}

The question was: ${question || "(none)"}`;
	}
	return replaceResearchSourcesSection(
		`## Report

A full write-up could not be finished in time. These discourses were selected for **${question || "this question"}**.`,
		options.hits.slice(0, 40),
	);
}
