import { transformId } from "./transformId";

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

/** Join a model `paragraphs` array into briefing prose. */
export function joinAskSummaryParagraphs(raw: unknown): string {
	if (!Array.isArray(raw)) return "";
	return raw
		.map((item) =>
			typeof item === "string" ? item.replace(/\s+/g, " ").trim() : "",
		)
		.filter(Boolean)
		.join("\n\n");
}

/**
 * Keep paragraph breaks; collapse intra-paragraph whitespace. Used before
 * storing, clipping, and rendering Ask briefings. Also repairs glued
 * sentences and infers paragraphs when the model omitted blank lines.
 */
export function normalizeAskSummaryProse(value: string, max?: number): string {
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

function linkifySummaryParagraph(
	text: string,
	byKey: Map<string, string>,
	pattern: RegExp | null,
): string {
	if (!pattern) return escapeHtml(text);
	let out = "";
	let cursor = 0;
	for (const match of text.matchAll(pattern)) {
		const index = match.index ?? 0;
		const token = match[0] || "";
		if (index > cursor) {
			out += escapeHtml(text.slice(cursor, index));
		}
		const href = byKey.get(token.toLowerCase());
		if (href) {
			out += `<a class="ai-summary-ref" href="${escapeHtml(href)}">${escapeHtml(token)}</a>`;
		} else {
			out += escapeHtml(token);
		}
		cursor = index + token.length;
	}
	if (cursor < text.length) {
		out += escapeHtml(text.slice(cursor));
	}
	return out;
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

	type Alias = { alias: string; href: string };
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
			aliases.push({ alias, href });
		}
	}
	aliases.sort((a, b) => b.alias.length - a.alias.length);
	const pattern =
		aliases.length > 0
			? new RegExp(
					`\\b(?:${aliases.map((item) => escapeRegExp(item.alias)).join("|")})\\b`,
					"gi",
				)
			: null;
	const byKey = new Map(
		aliases.map((item) => [item.alias.toLowerCase(), item.href] as const),
	);

	return text
		.split("\n\n")
		.map(
			(paragraph) =>
				`<p>${linkifySummaryParagraph(paragraph, byKey, pattern)}</p>`,
		)
		.join("");
}
