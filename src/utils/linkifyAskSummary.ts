import { transformId } from "./transformId";
import { slugFromCitationHref } from "./discourseCitationPopover";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Display / compact aliases for a discourse slug that may appear in prose. */
export function discourseIdAliases(slug: string): string[] {
	const compact = slug.trim().toLowerCase();
	if (!compact) return [];
	const display = transformId(compact);
	const noSpaceDisplay = display.replace(/\s+/g, "");
	const upperCompact = compact.toUpperCase();
	const spaced = compact.replace(/^([a-z]+)(\d)/i, "$1 $2");
	return [...new Set([compact, display, noSpaceDisplay, upperCompact, spaced])]
		.map((alias) => alias.trim())
		.filter(Boolean);
}

/** Soft wrap for inferred briefing paragraphs (JSON dumps often omit blank lines). */
const ASK_SUMMARY_PARA_CHARS = 560;

const DISCOURSE_SENTENCE_START =
	/^(?:AN|SN|MN|DN|ITI|Iti|Dhp|Ud|Snp|SNP|Thag|Thig|Kp|Khp|Pv|Vv|Ja|Bv|Cp|Mil|Nett|Pe)\s*\d/i;

const ASK_SUMMARY_BREAK_CUE =
	/^(?:A caveat\b|Caveat:|Note that\b|And note that\b|Relatedly,)/i;

const FALSE_SENTENCE_END =
	/(?:^|[^a-zāīū])(?:i\.e|e\.g|vs|cf|n\.b)\.$/i;

/**
 * Models in JSON mode often glue the next sentence to the period
 * (`technique.AN 6.29`). Insert the missing space; leave `i.e.` / `6.29` alone.
 */
export function repairAskSentenceSpacing(value: string): string {
	return value.replace(
		/([a-zāīūṅñṭḍṇḷṃṁ0-9\)\]'’"”])([.!?])(['"”’)\]]*)(?=\p{Lu})/gu,
		"$1$2$3 ",
	);
}

function isFalseSentenceEnd(text: string, punctIndex: number): boolean {
	if (text[punctIndex] !== ".") return false;
	const window = text.slice(Math.max(0, punctIndex - 6), punctIndex + 1);
	return FALSE_SENTENCE_END.test(window);
}

export function splitAskSummarySentences(text: string): string[] {
	const trimmed = text.replace(/\s+/g, " ").trim();
	if (!trimmed) return [];
	const out: string[] = [];
	const re = /[.!?]['"”’)]*(?=\s+\p{Lu}|$)/gu;
	let start = 0;
	let match: RegExpExecArray | null;
	while ((match = re.exec(trimmed))) {
		if (isFalseSentenceEnd(trimmed, match.index)) continue;
		const piece = trimmed.slice(start, match.index + match[0].length).trim();
		if (piece) out.push(piece);
		start = match.index + match[0].length;
	}
	const tail = trimmed.slice(start).trim();
	if (tail) out.push(tail);
	return out.length > 0 ? out : [trimmed];
}

function inferAskParagraphs(text: string): string {
	const sentences = splitAskSummarySentences(text);
	if (sentences.length <= 1) return text.replace(/\s+/g, " ").trim();
	const paras: string[] = [];
	let current = "";
	for (const sentence of sentences) {
		const force =
			current.length > 0 &&
			(DISCOURSE_SENTENCE_START.test(sentence) ||
				ASK_SUMMARY_BREAK_CUE.test(sentence));
		const overflow =
			current.length > 0 &&
			current.length + 1 + sentence.length > ASK_SUMMARY_PARA_CHARS;
		if (force || overflow) {
			paras.push(current);
			current = sentence;
		} else {
			current = current ? `${current} ${sentence}` : sentence;
		}
	}
	if (current) paras.push(current);
	return paras.join("\n\n");
}

function formatAskSummaryBlock(block: string): string {
	const spaced = repairAskSentenceSpacing(block.replace(/[ \t]+/g, " ").trim());
	if (!spaced) return "";
	return inferAskParagraphs(spaced);
}

function isMdTableSeparator(line: string): boolean {
	const cells = line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
	return (
		cells.length > 0 &&
		cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")))
	);
}

function isMdListLine(line: string): boolean {
	const trimmed = line.trim();
	return /^[-*•]\s+\S/.test(trimmed) || /^\d+[.)]\s+\S/.test(trimmed);
}

function isMdHeadingLine(line: string): boolean {
	return /^#{1,6}\s+\S/.test(line.trim());
}

function isMdRuleLine(line: string): boolean {
	return /^-{3,}$/.test(line.trim());
}

/**
 * True when the briefing is structured markdown (table, list, heading)
 * rather than ordinary prose paragraphs.
 */
export function looksLikeAskMarkdown(value: string): boolean {
	const lines = value
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => line.trim());
	for (let i = 0; i < lines.length - 1; i++) {
		const line = lines[i] || "";
		const next = lines[i + 1] || "";
		if (line.includes("|") && isMdTableSeparator(next)) return true;
	}
	if (lines.filter((line) => isMdListLine(line)).length >= 2) return true;
	return lines.some((line) => isMdHeadingLine(line) || isMdRuleLine(line));
}

function isStructuredMarkdownLine(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed) return false;
	return (
		trimmed.includes("|") ||
		isMdListLine(trimmed) ||
		isMdTableSeparator(trimmed) ||
		isMdHeadingLine(trimmed) ||
		isMdRuleLine(trimmed) ||
		/^>\s?/.test(trimmed)
	);
}

/** Drop blank lines between table rows or list items so each stays one block. */
export function compactAskMarkdown(value: string): string {
	const lines = value
		.replace(/\r\n/g, "\n")
		.trim()
		.split("\n")
		.map((line) => line.trimEnd());
	const out: string[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] || "";
		const blank = !line.trim();
		if (!blank) {
			out.push(line);
			continue;
		}
		const prev = [...lines.slice(0, i)].reverse().find((item) => item.trim());
		const next = lines.slice(i + 1).find((item) => item.trim());
		if (!prev || !next) continue;
		const prevTable = prev.includes("|") || isMdTableSeparator(prev);
		const nextTable = next.includes("|") || isMdTableSeparator(next);
		const prevList = isMdListLine(prev);
		const nextList = isMdListLine(next);
		if ((prevTable && nextTable) || (prevList && nextList)) continue;
		if (out[out.length - 1] === "") continue;
		out.push("");
	}
	return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function preserveStructuredParagraph(item: string): string {
	const text = item.replace(/\r\n/g, "\n").trim();
	if (!text) return "";
	if (looksLikeAskMarkdown(text) || isStructuredMarkdownLine(text)) {
		return text;
	}
	return text.replace(/\s+/g, " ");
}

/** Join a model `paragraphs` array into briefing prose. */
export function joinAskSummaryParagraphs(raw: unknown): string {
	if (!Array.isArray(raw)) return "";
	const parts = raw
		.map((item) =>
			typeof item === "string" ? preserveStructuredParagraph(item) : "",
		)
		.filter(Boolean);
	if (parts.length === 0) return "";
	if (looksLikeAskMarkdown(parts.join("\n"))) {
		return compactAskMarkdown(parts.join("\n"));
	}
	return parts.join("\n\n");
}

/**
 * Keep paragraph breaks; collapse intra-paragraph whitespace. Used before
 * storing, clipping, and rendering Ask briefings. Also repairs glued
 * sentences and infers paragraphs when the model omitted blank lines.
 * Structured markdown (tables, lists, headings) is left intact.
 */
export function normalizeAskSummaryProse(value: string, max?: number): string {
	if (looksLikeAskMarkdown(value)) {
		const text = compactAskMarkdown(value);
		if (max == null) return text;
		return text.slice(0, Math.max(0, max));
	}
	const text = value
		.replace(/\r\n/g, "\n")
		.split(/\n+/)
		.map((part) => formatAskSummaryBlock(part))
		.filter(Boolean)
		.join("\n\n")
		.replace(/\n{3,}/g, "\n\n");
	if (max == null) return text;
	return text.slice(0, Math.max(0, max));
}

/** Optional `¶21` / `¶ 6 – ¶ 50` after a discourse ID. */
const PARA_CITE_TAIL =
	"(?:\\s*¶\\s*\\d+(?:\\s*[-–—]\\s*¶?\\s*\\d+)?)?";

const CITATION_BLOCKS = new Set(["p", "li", "td", "th", "blockquote"]);

export type DiscourseIdLink = { slug: string; href: string };

/** Hash fragment from `MN 21 ¶21` or `MN 10 ¶6 - ¶50` (`21`, `6-50`). */
export function paragraphAnchorFromCite(text: string): string {
	const range = text.match(/¶\s*(\d+)\s*[-–—]\s*¶?\s*(\d+)/);
	if (range?.[1] && range[2]) {
		return range[1] === range[2] ? range[1] : `${range[1]}-${range[2]}`;
	}
	const one = text.match(/¶\s*(\d+)/);
	return one?.[1] || "";
}

/** Append a paragraph fragment when the base href has none. */
export function withParagraphHash(href: string, anchor: string): string {
	const hash = (anchor || "").replace(/^#/, "").trim();
	const trimmed = (href || "").trim();
	if (!hash || !trimmed || trimmed.includes("#")) return trimmed;
	return `${trimmed}#${hash}`;
}

function citationIdToken(token: string): string {
	return token.replace(/\s*¶[\s\S]*$/, "").trim();
}

function slugForCitationHref(
	href: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const fromPath = slugFromCitationHref(href);
	if (fromPath) return fromPath;
	const trimmed = (href || "").trim();
	if (!trimmed) return "";
	const base = trimmed.split("#")[0] || trimmed;
	for (const hit of results) {
		const slug = (hit.slug || "").trim().toLowerCase();
		if (!slug) continue;
		const hitHref = (hit.href || `/${slug}`).trim() || `/${slug}`;
		if (hitHref === trimmed || hitHref.split("#")[0] === base) return slug;
	}
	return "";
}

/**
 * Point markdown citation hrefs at the result href (PDF/EPUB anchors),
 * keeping a paragraph fragment when the destination can take one.
 */
export function remapResearchCitationHrefs(
	html: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const bySlug = new Map<string, string>();
	for (const hit of results) {
		const slug = (hit.slug || "").trim().toLowerCase();
		if (!slug) continue;
		bySlug.set(slug, (hit.href || `/${slug}`).trim() || `/${slug}`);
	}
	if (bySlug.size === 0) return html;
	return html.replace(/<a\b([^>]*?)>/gi, (open, attrs: string) => {
		if (!/\bai-summary-ref\b/.test(attrs)) return open;
		const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
		const href = hrefMatch?.[1];
		if (!href) return open;
		const slug = slugFromCitationHref(href);
		const dest = slug ? bySlug.get(slug) : undefined;
		if (!dest) return open;
		const fragment = href.includes("#") ? href.slice(href.indexOf("#") + 1) : "";
		const next = withParagraphHash(dest, fragment);
		if (next === href) return open;
		return `<a${attrs.replace(/\bhref\s*=\s*"[^"]*"/i, `href="${escapeHtml(next)}"`)}>`;
	});
}

export function discourseIdLinkIndex(
	results: readonly { slug: string; href?: string }[],
): { byKey: Map<string, DiscourseIdLink>; pattern: RegExp | null } {
	type Alias = { alias: string; slug: string; href: string };
	const aliases: Alias[] = [];
	const seenAlias = new Set<string>();
	for (const hit of results) {
		const slug = (hit.slug || "").trim().toLowerCase();
		if (!slug) continue;
		const href = (hit.href || `/${slug}`).trim() || `/${slug}`;
		for (const alias of discourseIdAliases(slug)) {
			const key = alias.toLowerCase();
			if (seenAlias.has(key)) continue;
			seenAlias.add(key);
			aliases.push({ alias, slug, href });
		}
	}
	aliases.sort((a, b) => b.alias.length - a.alias.length);
	const pattern =
		aliases.length > 0
			? new RegExp(
					`\\b(?:${aliases.map((item) => escapeRegExp(item.alias)).join("|")})\\b${PARA_CITE_TAIL}`,
					"gi",
				)
			: null;
	const byKey = new Map(
		aliases.map(
			(item) =>
				[item.alias.toLowerCase(), { slug: item.slug, href: item.href }] as const,
		),
	);
	return { byKey, pattern };
}

export function linkifyDiscourseIdText(
	text: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const { byKey, pattern } = discourseIdLinkIndex(results);
	return linkifySummaryParagraph(text, byKey, pattern);
}

function unwrapHtmlAnchors(html: string): string {
	return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1");
}

/**
 * Link discourse IDs in already-escaped HTML text nodes. Skips tags,
 * existing anchors, and heading text so titles stay unlinked.
 */
export function linkifyDiscourseIdsInHtml(
	html: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const { byKey, pattern } = discourseIdLinkIndex(results);
	if (!pattern) return html;
	let headingDepth = 0;
	let skipDepth = 0;
	const seenStack: Set<string>[] = [new Set()];
	const currentSeen = () => seenStack[seenStack.length - 1] || seenStack[0]!;
	return html.replace(
		/(<a\b[^>]*>[\s\S]*?<\/a>)|(<\/?h[1-6]\b[^>]*>)|(<\/?(?:svg|pre|code|textarea)\b[^>]*>)|(<[^>]+>)|([^<]+)/gi,
		(
			chunk,
			anchor: string | undefined,
			headingTag: string | undefined,
			skipTag: string | undefined,
			tag: string | undefined,
			text: string | undefined,
		) => {
			if (headingTag) {
				if (/^<\/h/i.test(headingTag)) {
					headingDepth = Math.max(0, headingDepth - 1);
				} else {
					headingDepth += 1;
				}
				return chunk;
			}
			if (skipTag) {
				if (/^<\//.test(skipTag)) {
					skipDepth = Math.max(0, skipDepth - 1);
				} else if (!/\/\s*>$/.test(skipTag)) {
					skipDepth += 1;
				}
				return chunk;
			}
			if (anchor) {
				if (headingDepth > 0) return unwrapHtmlAnchors(anchor);
				const hrefMatch = anchor.match(/\bhref\s*=\s*"([^"]*)"/i);
				const slug = slugForCitationHref(hrefMatch?.[1] || "", results);
				if (slug) currentSeen().add(slug);
				return chunk;
			}
			if (tag) {
				const close = /^<\/([a-z0-9]+)/i.exec(tag);
				const open = /^<([a-z0-9]+)/i.exec(tag);
				const name = (close?.[1] || open?.[1] || "").toLowerCase();
				if (CITATION_BLOCKS.has(name)) {
					if (close) {
						if (seenStack.length > 1) seenStack.pop();
					} else if (open && !/\/\s*>$/.test(tag)) {
						seenStack.push(new Set());
					}
				}
				return chunk;
			}
			if (!text || headingDepth > 0 || skipDepth > 0) return chunk;
			return linkifySummaryText(text, byKey, pattern, currentSeen(), false);
		},
	);
}

function linkifySummaryText(
	text: string,
	byKey: Map<string, DiscourseIdLink>,
	pattern: RegExp | null,
	seen: Set<string>,
	escapeTokens: boolean,
): string {
	if (!pattern) return escapeTokens ? escapeHtml(text) : text;
	let out = "";
	let cursor = 0;
	pattern.lastIndex = 0;
	for (const match of text.matchAll(pattern)) {
		const index = match.index ?? 0;
		const token = match[0] || "";
		if (index > cursor) {
			const gap = text.slice(cursor, index);
			out += escapeTokens ? escapeHtml(gap) : gap;
		}
		const link = byKey.get(citationIdToken(token).toLowerCase());
		const write = escapeTokens ? escapeHtml(token) : token;
		if (link && !seen.has(link.slug)) {
			seen.add(link.slug);
			const href = withParagraphHash(link.href, paragraphAnchorFromCite(token));
			out += `<a class="ai-summary-ref" href="${escapeHtml(href)}">${write}</a>`;
		} else {
			out += write;
		}
		cursor = index + token.length;
	}
	if (cursor < text.length) {
		const tail = text.slice(cursor);
		out += escapeTokens ? escapeHtml(tail) : tail;
	}
	return out;
}

function linkifySummaryParagraph(
	text: string,
	byKey: Map<string, DiscourseIdLink>,
	pattern: RegExp | null,
): string {
	return linkifySummaryText(text, byKey, pattern, new Set(), true);
}

/**
 * Escape summary prose and link known discourse IDs to result hrefs.
 * Only IDs present in `results` are linked (never invent destinations).
 * Returns inner HTML: one `<p>` per paragraph.
 */
export function linkifyAskSummaryHtml(
	summary: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const text = normalizeAskSummaryProse(summary);
	if (!text) return "";

	const { byKey, pattern } = discourseIdLinkIndex(results);

	return text
		.split("\n\n")
		.map(
			(paragraph) =>
				`<p>${linkifySummaryParagraph(paragraph, byKey, pattern)}</p>`,
		)
		.join("");
}
