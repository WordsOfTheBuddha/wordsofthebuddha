import { Marked, Renderer } from "marked";
import type { AiDiscourseHit } from "./aiDiscourseHits";
import {
	annotateResearchCitationLinks,
	type CitationPopoverHit,
} from "./discourseCitationPopover";
import {
	linkifyAskSummaryHtml,
	linkifyDiscourseIdsInHtml,
	looksLikeAskMarkdown,
	normalizeAskSummaryProse,
} from "./linkifyAskSummary";
import { transformId } from "./transformId";

/** Storage ceiling only — large enough for a finished 16k-token report plus Sources. */
export const RESEARCH_REPORT_MAX_CHARS = 100_000;

export const RESEARCH_REPORT_SYSTEM = `You write a research report from early Buddhist discourses already selected for the reader. You do not search. You do not invent citations.

Write GitHub-flavored markdown only (no JSON, no HTML tags). Use:
- ## / ### / #### headings
- short paragraphs and lists
- markdown tables when a comparison, map of collections, or survey of facets helps
- ordinary discourse IDs in prose (MN 10, SN 22.59) — prefer IDs whose excerpts or full text you were given; you may also name other selected titles as further sources without inventing their content
- no ## Sources section — the harness appends a bilingual source list

Hidden thinking is shown to the reader. Think however the excerpts require. When you can, say in ordinary language what the passages support and which IDs carry the claim.

If a claim turns on Pāli wording (a compound, inflection, or a distinction English does not settle), add a final line the harness will strip:
readPali: MN 70, SN 12.49
Use only IDs you were given. The harness then opens those discourses in Pāli and English and you rewrite. Omit the line when English is enough, and omit it when Pāli (full text) is already in the passages.

Rules:
- Write only from the passages you were given (excerpts, full English, and Pāli when present). If a discourse merely lists terms, say that — do not claim it defines them.
- Do not import stock Dhamma unless the excerpt states it.
- Write a thorough report when the passages support it. Prefer a readable document over padding. Tables should have a header row.
- Space after sentence punctuation. Never glue a discourse ID to the period.
- Hard / controversial questions: report what the excerpts say and what they do not declare. No safety sermon.
- Never give crisis counseling, medical, or legal advice.
- If excerpts are empty, write a short note that the library did not yield a report.`;

export interface ResearchReportResult {
	report: string;
	model: string;
	reasoning: string;
	/** Selected-set slugs the writer asked to open in Pāli and English. */
	readPali?: string[];
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function safeReportHref(href: string | null | undefined): string | null {
	const trimmed = (href || "").trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
	if (trimmed.startsWith("#") && !trimmed.toLowerCase().startsWith("#javascript")) {
		return trimmed;
	}
	return null;
}

const reportRenderer = new Renderer();

reportRenderer.heading = function ({ tokens, depth }) {
	const html = this.parser.parseInline(tokens);
	const tag = depth <= 2 ? "h2" : "h3";
	return `<${tag}>${html}</${tag}>\n`;
};

reportRenderer.html = function ({ text }) {
	return escapeHtml(text);
};

reportRenderer.image = function ({ text }) {
	return escapeHtml(text || "");
};

reportRenderer.link = function ({ href, title, tokens }) {
	const text = this.parser.parseInline(tokens);
	const safe = safeReportHref(href);
	if (!safe) return text;
	const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
	return `<a class="ai-summary-ref" href="${escapeHtml(safe)}"${titleAttr}>${text}</a>`;
};

reportRenderer.hr = function () {
	return `<hr class="ai-report-rule">\n`;
};

reportRenderer.table = function (token) {
	const inner = Renderer.prototype.table.call(this, token);
	return `<div class="ai-report-table-wrap">${inner.replace(
		"<table>",
		'<table class="ai-report-table">',
	)}</div>\n`;
};

const reportMarked = new Marked({
	async: false,
	gfm: true,
	breaks: false,
	pedantic: false,
});
reportMarked.use({ renderer: reportRenderer });

/** GFM soft breaks are spaces; marked leaves the newline in the HTML. */
function flattenSoftBreaks(html: string): string {
	return html.replace(
		/<(p|h2|h3|li|td|th)([^>]*)>([\s\S]*?)<\/\1>/gi,
		(_match, tag: string, attrs: string, inner: string) =>
			`<${tag}${attrs}>${inner.replace(/[ \t]*\n[ \t]*/g, " ")}</${tag}>`,
	);
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

/** Strip a harness `readPali:` line and return the requested IDs. */
export function takeResearchReadPaliRequest(raw: string): {
	report: string;
	readPali: string[];
} {
	const lines = raw.replace(/\r\n/g, "\n").split("\n");
	const ids: string[] = [];
	const kept: string[] = [];
	for (const line of lines) {
		const match = line.trim().match(/^readPali:\s*(.+)$/i);
		if (match) {
			for (const part of match[1].split(/[,;]/)) {
				const id = part.replace(/\s+/g, " ").trim();
				if (id) ids.push(id);
			}
			continue;
		}
		kept.push(line);
	}
	return {
		report: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
		readPali: ids,
	};
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
	return takeResearchReadPaliRequest(
		clipResearchReport(markdown).replace(
			/(?:^|\n)## Sources\b[\s\S]*$/i,
			"",
		),
	).report;
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
	results: readonly CitationPopoverHit[] = [],
	options?: { citationPopovers?: boolean },
): string {
	const text = stripResearchSourcesSection(markdown);
	if (!text) return "";
	const html = reportMarked.parse(text);
	const linked = linkifyDiscourseIdsInHtml(
		flattenSoftBreaks(typeof html === "string" ? html : ""),
		results,
	);
	if (!options?.citationPopovers) return linked;
	return annotateResearchCitationLinks(linked, results);
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
