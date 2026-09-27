/**
 * Build-time equivalent of the two DOM passes that used to run before a
 * discourse could be shown: BottomDrawer's `replaceTooltips` (|term::gloss|
 * → `.tooltip-text`) and Collapse's `initCollapse` (`<collapse>` → ․․․
 * toggle). Doing both in HTML lets the article paint without waiting for the
 * page's JS bundle.
 *
 * Output must match what those passes produce in the browser, in the same
 * order: Collapse runs first (module scripts execute before DOMContentLoaded),
 * so `data-content` keeps raw gloss markup for the expand handler to render.
 * When the HTML holds something this pass cannot reproduce exactly, it
 * returns `ok: false` and the caller keeps the client-side path.
 */

import { replaceGlossMarkup } from "./glossDisplay";

export const COLLAPSE_MARK = "\u2024\u2024\u2024";

/** Same test BottomDrawer applies to a text node before rewriting it. */
const CLIENT_GLOSS_TEST = /\|.+?::.+?\|/;

const TOKEN_RE = /(<!--[\s\S]*?-->|<[^>]*>)/;

/** Tags a `<collapse>` may contain without the HTML parser moving it. */
const COLLAPSE_INLINE_TAGS = /^(a|b|br|em|i|small|span|strong|sub|sup|u)$/;

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: "\u00a0",
	rarr: "\u2192",
	larr: "\u2190",
	mdash: "\u2014",
	ndash: "\u2013",
	hellip: "\u2026",
};

class UnsupportedMarkup extends Error {}

function decodeEntities(text: string): string {
	if (!text.includes("&")) return text;
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body) => {
		if (body[0] === "#") {
			const code =
				body[1] === "x" || body[1] === "X"
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			return String.fromCodePoint(code);
		}
		const named = NAMED_ENTITIES[body.toLowerCase()];
		if (named === undefined) throw new UnsupportedMarkup(m);
		return named;
	});
}

function escapeText(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeAttr(text: string): string {
	return escapeText(text).replace(/"/g, "&quot;");
}

/** BottomDrawer's escaping for `data-tooltip-content`. */
function escapeTooltipAttr(text: string): string {
	return escapeAttr(text).replace(/'/g, "&#039;");
}

function parseMarkdownLinks(text: string): string {
	return text.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" class="tooltip-link">$1</a>',
	);
}

type Piece = { text: string } | { tag: string };

function renderGlossText(rawText: string): Piece[] {
	const text = decodeEntities(rawText);
	if (!CLIENT_GLOSS_TEST.test(text)) return [{ text: rawText }];
	const glosses: { term: string; tooltip: string }[] = [];
	const replaced = replaceGlossMarkup(text, (term, tooltip) => {
		glosses.push({ term, tooltip });
		return `\u0000${glosses.length - 1}\u0000`;
	});
	const parts = replaced.split(/\u0000(\d+)\u0000/);
	const out: Piece[] = [];
	for (let i = 0; i < parts.length; i++) {
		if (i % 2 === 0) {
			if (parts[i]) out.push({ text: escapeText(parts[i]) });
			continue;
		}
		const { term, tooltip } = glosses[Number(parts[i])];
		out.push(
			{
				tag: `<span class="tooltip-text" data-tooltip-content="${escapeTooltipAttr(parseMarkdownLinks(tooltip))}">`,
			},
			{ text: escapeText(term) },
			{ tag: "</span>" },
		);
	}
	return out;
}

function tagName(tag: string): string {
	const m = /^<\/?([a-z][a-z0-9-]*)/i.exec(tag);
	if (!m) throw new UnsupportedMarkup(tag);
	return m[1].toLowerCase();
}

function textContentOf(pieces: Piece[]): string {
	let out = "";
	for (const p of pieces) if ("text" in p) out += p.text;
	return decodeEntities(out);
}

function transform(html: string): string {
	const tokens = html.split(TOKEN_RE);
	/** Open `<span>`s; `true` marks a `.pali-word` span. */
	const spans: boolean[] = [];
	let paliDepth = 0;
	let root: Piece[] = [];
	let collapse: Piece[] | null = null;
	let collapseDepth = 0;

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const out = collapse ?? root;
		if (i % 2 === 0) {
			if (!token) continue;
			if (paliDepth > 0 || collapse) out.push({ text: token });
			else out.push(...renderGlossText(token));
			continue;
		}
		if (token.startsWith("<!--")) {
			out.push({ tag: token });
			continue;
		}
		const name = tagName(token);
		const closing = token.startsWith("</");
		if (/^(script|style|textarea|template)$/.test(name)) {
			throw new UnsupportedMarkup(token);
		}

		if (name === "collapse") {
			if (!closing) {
				if (collapse || !/^<collapse\s*>$/i.test(token)) {
					throw new UnsupportedMarkup(token);
				}
				collapse = [];
				continue;
			}
			if (!collapse || collapseDepth !== 0) throw new UnsupportedMarkup(token);
			const full = textContentOf(collapse).trim();
			root.push({
				tag: `<span class="collapse-toggle collapsed" data-content="${escapeAttr(full)}" title="Click to expand">${COLLAPSE_MARK}</span>`,
			});
			collapse = null;
			continue;
		}
		if (collapse) {
			if (!COLLAPSE_INLINE_TAGS.test(name)) throw new UnsupportedMarkup(token);
			// A close for an element opened outside the collapse would end the
			// collapse early in the browser's parser (e.g. inside `.pali-word`).
			if (closing) {
				if (collapseDepth === 0) throw new UnsupportedMarkup(token);
				collapseDepth--;
			} else if (name !== "br" && !token.endsWith("/>")) {
				collapseDepth++;
			}
		}

		out.push({ tag: token });
		if (name !== "span" || token.endsWith("/>")) continue;
		if (closing) {
			if (spans.length === 0) throw new UnsupportedMarkup(token);
			if (spans.pop()) paliDepth--;
		} else {
			const paliWord = /\bclass="[^"]*\bpali-word\b[^"]*"/.test(token);
			spans.push(paliWord);
			if (paliWord) paliDepth++;
		}
	}
	if (collapse || spans.length > 0) throw new UnsupportedMarkup("unbalanced");
	return root.map((p) => ("text" in p ? p.text : p.tag)).join("");
}

export function prerenderReadingMarkup(html: string): {
	html: string;
	ok: boolean;
} {
	if (!html.includes("::") && !html.includes("<collapse")) {
		return { html, ok: true };
	}
	try {
		return { html: transform(html), ok: true };
	} catch (e) {
		if (e instanceof UnsupportedMarkup) return { html, ok: false };
		throw e;
	}
}
