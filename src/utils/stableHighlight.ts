/**
 * View-independent highlight anchors.
 *
 * A stored highlight is a flat list of spans. Each span lives inside one text
 * block (paragraph, heading, list item, table cell, …) and is addressed by the
 * block's key plus character offsets into the block's reading text: its text
 * nodes, minus copy chrome (`¶ N` markers, buttons, popovers), collapse
 * toggles and SVG / Mermaid diagrams. A multi-paragraph selection becomes one
 * span per block it touches, English and Pāli alike.
 *
 * The same block can exist several times in the DOM (interleaved article,
 * split-view clones, Pāli-only reference view). Every copy is painted, so
 * switching views never needs a re-anchor. Spans whose block is not on the page
 * (Pāli spans on an English-only render) stay stored and unpainted.
 *
 * Each span keeps its quote plus a little surrounding text so it can be found
 * again after small wording edits or paragraph renumbering.
 */

import { shouldSkipCopyElement } from "./plainCopy";

export type HighlightColor = "yellow" | "pink" | "green" | "blue";

export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
	"yellow",
	"pink",
	"green",
	"blue",
];

export interface HighlightSpan {
	block: string;
	start: number;
	end: number;
	color: HighlightColor;
	quote: string;
	prefix: string;
	suffix: string;
}

export const HIGHLIGHT_DOC_VERSION = 3;

export interface HighlightDocument {
	version: typeof HIGHLIGHT_DOC_VERSION;
	spans: HighlightSpan[];
}

/** A selected stretch of one block, before it gets a color. */
export interface BlockPiece {
	block: string;
	start: number;
	end: number;
}

type Lang = "en" | "pli";

interface BlockRef {
	key: string;
	lang: Lang;
	el: HTMLElement;
}

export interface BlockIndex {
	byKey: Map<string, BlockRef[]>;
	/** First copy of each key, in document order. */
	canonical: BlockRef[];
}

const BLOCK_TAGS = [
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"li",
	"td",
	"th",
	"pre",
	"blockquote",
	"dt",
	"dd",
	"figcaption",
	"caption",
];
const BLOCK_TAG_SET = new Set(BLOCK_TAGS.map((t) => t.toUpperCase()));
const BLOCK_SELECTOR = BLOCK_TAGS.join(",");

/** Never part of reading text: diagrams, form controls, expandable `․․․`. */
const OPAQUE_SELECTOR =
	"svg, .mermaid, script, style, noscript, textarea, input, select, .collapse-toggle";
const EXCLUDED_BLOCK_SELECTOR =
	".highlight-menu, .tm-popover-overlay, .bottom-popover, .popover-content";
const MARK_SELECTOR = "mark[data-hl]";
const CONTEXT_CHARS = 32;

function isNestedBlock(el: Element, block: Element): boolean {
	return el !== block && BLOCK_TAG_SET.has(el.tagName.toUpperCase());
}

/** Text nodes that make up a block's reading text, in order. */
export function blockTextNodes(block: HTMLElement): Text[] {
	const doc = block.ownerDocument;
	const walker = doc.createTreeWalker(
		block,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		{
			acceptNode(node: Node): number {
				if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
				const el = node as HTMLElement;
				if (el.matches("mark[data-hl]")) return NodeFilter.FILTER_SKIP;
				if (isNestedBlock(el, block)) return NodeFilter.FILTER_REJECT;
				if (el.matches(OPAQUE_SELECTOR)) return NodeFilter.FILTER_REJECT;
				if (shouldSkipCopyElement(el)) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_SKIP;
			},
		},
	);
	const nodes: Text[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		nodes.push(n as Text);
	}
	return nodes;
}

export function blockText(block: HTMLElement): string {
	return blockTextNodes(block)
		.map((t) => t.data)
		.join("");
}

function blockLang(el: HTMLElement, key: string | null): Lang {
	if (key?.startsWith("pli:")) return "pli";
	if (key?.startsWith("en:")) return "en";
	return el.closest(".pali-paragraph, #panel2, .ref-pali-only-view")
		? "pli"
		: "en";
}

export function langOfKey(key: string): Lang {
	if (key.startsWith("pli:")) return "pli";
	if (key.startsWith("en:")) return "en";
	return key.split(":")[2] === "pli" ? "pli" : "en";
}

function keyedBlockId(el: HTMLElement): string | null {
	const key = el.getAttribute("data-hl-block");
	if (key) return key;
	const num = el.getAttribute("data-paragraph-number");
	if (num && el.classList.contains("english-paragraph")) return `en:${num}`;
	return null;
}

/**
 * Unkeyed blocks (headings, list items, table cells) are numbered within their
 * surface. Split panels count as the main article: they are clones of it.
 */
function surfaceId(el: HTMLElement, root: HTMLElement): string {
	if (el.closest("#panel1, #panel2")) return "main";
	if (el.closest(".ref-pali-only-view")) return "refpli";
	if (el.closest(".interleaved-article")) return "main";
	const md = el.closest(".md-content");
	if (md) {
		const others = Array.from(root.querySelectorAll(".md-content")).filter(
			(m) =>
				!m.matches("#panel1, #panel2, .interleaved-article") &&
				!m.closest(".ref-pali-only-view"),
		);
		return `md${others.indexOf(md)}`;
	}
	return "page";
}

export function buildBlockIndex(root: HTMLElement): BlockIndex {
	const byKey = new Map<string, BlockRef[]>();
	const canonical: BlockRef[] = [];
	const counters = new Map<string, number>();

	for (const el of Array.from(
		root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR),
	)) {
		if (el.closest(EXCLUDED_BLOCK_SELECTOR)) continue;
		if (el.closest(OPAQUE_SELECTOR)) continue;
		if (el.classList.contains("english-pair-spacer")) continue;

		let key = keyedBlockId(el);
		const lang = blockLang(el, key);
		if (!key) {
			const surface = surfaceId(el, root);
			const counterKey = `${surface}:${lang}`;
			const n = counters.get(counterKey) ?? 0;
			counters.set(counterKey, n + 1);
			key = `u:${surface}:${lang}:${n}`;
		}
		const ref = { key, lang, el };
		const list = byKey.get(key);
		if (list) {
			list.push(ref);
		} else {
			byKey.set(key, [ref]);
			canonical.push(ref);
		}
	}
	return { byKey, canonical };
}

function textForKey(index: BlockIndex, key: string): string | null {
	const ref = index.byKey.get(key)?.[0];
	return ref ? blockText(ref.el) : null;
}

export function makeSpan(
	block: string,
	text: string,
	start: number,
	end: number,
	color: HighlightColor,
): HighlightSpan {
	return {
		block,
		start,
		end,
		color,
		quote: text.slice(start, end),
		prefix: text.slice(Math.max(0, start - CONTEXT_CHARS), start),
		suffix: text.slice(end, end + CONTEXT_CHARS),
	};
}

// ---------------------------------------------------------------------------
// Selection → pieces

function rangeIntersectsNode(range: Range, node: Node): boolean {
	const nodeRange = node.ownerDocument!.createRange();
	try {
		nodeRange.selectNodeContents(node);
		return (
			range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
			range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
		);
	} catch {
		return false;
	}
}

/** Reading-text offset of a DOM boundary point relative to `nodes`. */
function boundaryOffset(nodes: Text[], container: Node, offset: number): number {
	if (nodes.length === 0) return 0;
	const probe = nodes[0].ownerDocument.createRange();
	probe.setStart(container, offset);
	probe.collapse(true);
	let acc = 0;
	for (const t of nodes) {
		if (t === container) return acc + Math.min(offset, t.length);
		if (probe.comparePoint(t, t.length) <= 0) acc += t.length;
		else break;
	}
	return acc;
}

function trimToContent(
	text: string,
	start: number,
	end: number,
): [number, number] {
	while (start < end && /\s/.test(text[start]!)) start++;
	while (end > start && /\s/.test(text[end - 1]!)) end--;
	return [start, end];
}

function defaultIsRendered(el: HTMLElement): boolean {
	return el.getClientRects().length > 0;
}

/**
 * Split a selection into per-block pieces. Blocks that are in the range but
 * not rendered (hidden Pāli, the inactive layout) are left out, so only what
 * the reader saw selected gets highlighted.
 */
export function piecesFromRange(
	range: Range,
	root: HTMLElement,
	isRendered: (el: HTMLElement) => boolean = defaultIsRendered,
	index: BlockIndex = buildBlockIndex(root),
): BlockPiece[] {
	const pieces: BlockPiece[] = [];
	const seen = new Set<string>();
	for (const ref of allRefs(index)) {
		if (seen.has(ref.key)) continue;
		if (!rangeIntersectsNode(range, ref.el)) continue;
		if (!isRendered(ref.el)) continue;
		const nodes = blockTextNodes(ref.el);
		const text = nodes.map((t) => t.data).join("");
		const rawStart = boundaryOffset(nodes, range.startContainer, range.startOffset);
		const rawEnd = boundaryOffset(nodes, range.endContainer, range.endOffset);
		const [start, end] = trimToContent(text, rawStart, rawEnd);
		if (start >= end) continue;
		seen.add(ref.key);
		pieces.push({ block: ref.key, start, end });
	}
	return pieces;
}

function allRefs(index: BlockIndex): BlockRef[] {
	const refs: BlockRef[] = [];
	for (const list of index.byKey.values()) refs.push(...list);
	return refs.sort((a, b) =>
		a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
			? -1
			: 1,
	);
}

// ---------------------------------------------------------------------------
// Editing the span list

function mergeSameColor(spans: HighlightSpan[], text: string): HighlightSpan[] {
	const sorted = [...spans].sort((a, b) => a.start - b.start);
	const out: HighlightSpan[] = [];
	for (const span of sorted) {
		const prev = out[out.length - 1];
		if (
			prev &&
			prev.color === span.color &&
			!text.slice(prev.end, span.start).trim()
		) {
			out[out.length - 1] = makeSpan(
				prev.block,
				text,
				prev.start,
				Math.max(prev.end, span.end),
				prev.color,
			);
			continue;
		}
		out.push(span);
	}
	return out;
}

function subtractPiece(
	spans: HighlightSpan[],
	piece: BlockPiece,
	text: string,
): HighlightSpan[] {
	const out: HighlightSpan[] = [];
	for (const span of spans) {
		if (span.block !== piece.block || span.end <= piece.start || span.start >= piece.end) {
			out.push(span);
			continue;
		}
		const [ls, le] = trimToContent(text, span.start, Math.min(span.end, piece.start));
		if (ls < le) out.push(makeSpan(span.block, text, ls, le, span.color));
		const [rs, re] = trimToContent(text, Math.max(span.start, piece.end), span.end);
		if (rs < re) out.push(makeSpan(span.block, text, rs, re, span.color));
	}
	return out;
}

/** New color wins over whatever it overlaps; same-color neighbours merge. */
export function addPieces(
	spans: HighlightSpan[],
	pieces: BlockPiece[],
	color: HighlightColor,
	index: BlockIndex,
): HighlightSpan[] {
	let next = spans;
	for (const piece of pieces) {
		const text = textForKey(index, piece.block);
		if (text === null) continue;
		next = subtractPiece(next, piece, text);
		const own = next.filter((s) => s.block === piece.block);
		const rest = next.filter((s) => s.block !== piece.block);
		own.push(makeSpan(piece.block, text, piece.start, piece.end, color));
		next = [...rest, ...mergeSameColor(own, text)];
	}
	return next;
}

export function erasePieces(
	spans: HighlightSpan[],
	pieces: BlockPiece[],
	index: BlockIndex,
): HighlightSpan[] {
	let next = spans;
	for (const piece of pieces) {
		const text = textForKey(index, piece.block);
		if (text === null) continue;
		next = subtractPiece(next, piece, text);
	}
	return next;
}

export function piecesOverlapSpans(
	spans: HighlightSpan[],
	pieces: BlockPiece[],
): boolean {
	return pieces.some((p) =>
		spans.some(
			(s) => s.block === p.block && s.start < p.end && s.end > p.start,
		),
	);
}

// ---------------------------------------------------------------------------
// Locating a span in (possibly changed) text

interface Normalized {
	norm: string;
	/** Raw start / end (exclusive) for each normalized code unit. */
	starts: number[];
	ends: number[];
}

const PUNCT_FOLD: Record<string, string> = {
	"\u2018": "'",
	"\u2019": "'",
	"\u02bc": "'",
	"\u201c": '"',
	"\u201d": '"',
	"\u2013": "-",
	"\u2014": "-",
	"\u2026": "...",
	"\u1e41": "\u1e43", // ṁ → ṃ
};

/** Case-, diacritic-, punctuation- and whitespace-insensitive form with an offset map. */
function normalize(text: string): Normalized {
	let norm = "";
	const starts: number[] = [];
	const ends: number[] = [];
	let lastWasSpace = true;
	for (let i = 0; i < text.length; ) {
		const cp = text.codePointAt(i)!;
		const ch = String.fromCodePoint(cp);
		const next = i + ch.length;
		const folded = (PUNCT_FOLD[ch] ?? ch)
			.normalize("NFD")
			.replace(/\p{M}/gu, "")
			.toLowerCase();
		if (/^\s+$/.test(folded) || folded === "") {
			if (folded !== "" && !lastWasSpace) {
				norm += " ";
				starts.push(i);
				ends.push(next);
				lastWasSpace = true;
			}
		} else {
			for (let k = 0; k < folded.length; k++) {
				norm += folded[k];
				starts.push(i);
				ends.push(next);
			}
			lastWasSpace = false;
		}
		i = next;
	}
	return { norm, starts, ends };
}

function commonSuffixLength(a: string, b: string): number {
	let n = 0;
	while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
	return n;
}

function commonPrefixLength(a: string, b: string): number {
	let n = 0;
	while (n < a.length && n < b.length && a[n] === b[n]) n++;
	return n;
}

interface Located {
	start: number;
	end: number;
	score: number;
	/** Normalized quote length plus matching context characters. */
	evidence: number;
}

/** A match in some other block must not be a coincidence ("the", "monks"). */
const MIN_CROSS_BLOCK_EVIDENCE = 24;

function allIndexes(haystack: string, needle: string): number[] {
	const out: number[] = [];
	if (!needle) return out;
	for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + 1)) {
		out.push(i);
	}
	return out;
}

/**
 * Best place for `span` in `text`. Exact quote matches beat approximate ones;
 * among equals the surrounding context decides, then distance to the old
 * offset. Approximate matching anchors on the quote's head and tail so a word
 * change in the middle still resolves.
 */
export function locateInText(text: string, span: HighlightSpan): Located | null {
	if (text.slice(span.start, span.end) === span.quote && span.quote) {
		return {
			start: span.start,
			end: span.end,
			score: Number.MAX_SAFE_INTEGER,
			evidence: Number.MAX_SAFE_INTEGER,
		};
	}
	const t = normalize(text);
	const q = normalize(span.quote).norm.trim();
	if (!q) return null;
	const p = normalize(span.prefix).norm;
	const s = normalize(span.suffix).norm;

	const candidates: { ns: number; ne: number; base: number }[] = [];
	for (const i of allIndexes(t.norm, q)) {
		candidates.push({ ns: i, ne: i + q.length, base: 10_000 });
	}
	if (candidates.length === 0 && q.length >= 12) {
		const k = Math.max(6, Math.min(24, Math.floor(q.length / 3)));
		const head = q.slice(0, k);
		const tail = q.slice(-k);
		const maxLen = Math.ceil(q.length * 1.5) + 8;
		for (const h of allIndexes(t.norm, head)) {
			for (const tl of allIndexes(t.norm, tail)) {
				const ne = tl + tail.length;
				if (tl < h + head.length - k || ne - h > maxLen) continue;
				if (ne - h < q.length / 2) continue;
				candidates.push({ ns: h, ne, base: 0 });
				break;
			}
		}
	}

	let best: Located | null = null;
	for (const c of candidates) {
		const context =
			commonSuffixLength(t.norm.slice(Math.max(0, c.ns - p.length), c.ns), p) +
			commonPrefixLength(t.norm.slice(c.ne, c.ne + s.length), s);
		const start = t.starts[c.ns]!;
		const end = t.ends[c.ne - 1]!;
		const score = c.base + context * 10 - Math.abs(start - span.start) / 1000;
		const evidence = (c.base > 0 ? q.length : q.length / 2) + context;
		if (!best || score > best.score) best = { start, end, score, evidence };
	}
	return best;
}

interface PaintTarget {
	el: HTMLElement;
	start: number;
	end: number;
}

interface Resolved {
	span: HighlightSpan;
	targets: PaintTarget[];
}

function locateOnRefs(span: HighlightSpan, refs: BlockRef[]): Resolved | null {
	const targets: PaintTarget[] = [];
	let updated: HighlightSpan | null = null;
	for (const ref of refs) {
		const text = blockText(ref.el);
		const found = locateInText(text, span);
		if (!found) continue;
		targets.push({ el: ref.el, start: found.start, end: found.end });
		updated ??= makeSpan(ref.key, text, found.start, found.end, span.color);
	}
	return updated ? { span: updated, targets } : null;
}

/**
 * Find a span on the current page: its own block first, then any block of the
 * same language (the paragraph may have been renumbered or moved).
 */
export function resolveSpan(span: HighlightSpan, index: BlockIndex): Resolved | null {
	const own = index.byKey.get(span.block);
	if (own) {
		const direct = locateOnRefs(span, own);
		if (direct) return direct;
	}
	const lang = langOfKey(span.block);
	let bestKey: string | null = null;
	let bestScore = -Infinity;
	for (const ref of index.canonical) {
		if (ref.lang !== lang || ref.key === span.block) continue;
		const found = locateInText(blockText(ref.el), span);
		if (
			found &&
			found.evidence >= MIN_CROSS_BLOCK_EVIDENCE &&
			found.score > bestScore
		) {
			bestScore = found.score;
			bestKey = ref.key;
		}
	}
	return bestKey ? locateOnRefs(span, index.byKey.get(bestKey)!) : null;
}

export function pageHasLang(index: BlockIndex, lang: Lang): boolean {
	return index.canonical.some((r) => r.lang === lang);
}

// ---------------------------------------------------------------------------
// Painting

export function clearHighlightMarks(root: HTMLElement): void {
	const parents = new Set<Node>();
	root.querySelectorAll(MARK_SELECTOR).forEach((mark) => {
		const parent = mark.parentNode;
		if (!parent) return;
		while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
		parent.removeChild(mark);
		parents.add(parent);
	});
	parents.forEach((p) => p.normalize());
}

function wrapRange(el: HTMLElement, start: number, end: number, color: HighlightColor): void {
	const doc = el.ownerDocument;
	let acc = 0;
	for (const t of blockTextNodes(el)) {
		const len = t.length;
		const s = Math.max(start, acc);
		const e = Math.min(end, acc + len);
		acc += len;
		if (s >= e) continue;
		let target = t;
		const localStart = s - (acc - len);
		if (localStart > 0) target = target.splitText(localStart);
		if (e - s < target.length) target.splitText(e - s);
		const mark = doc.createElement("mark");
		mark.className = `highlight-${color}`;
		mark.setAttribute("data-hl", "");
		target.parentNode!.insertBefore(mark, target);
		mark.appendChild(target);
	}
}

/**
 * Repaint every copy of every span. Returns the spans with offsets / keys
 * refreshed to where they were found; spans not on this page come back as-is.
 */
export function paintHighlights(
	root: HTMLElement,
	spans: HighlightSpan[],
): HighlightSpan[] {
	clearHighlightMarks(root);
	const index = buildBlockIndex(root);
	const resolved: (Resolved | null)[] = spans.map((s) => resolveSpan(s, index));
	resolved.forEach((r) => {
		if (!r) return;
		for (const t of r.targets) wrapRange(t.el, t.start, t.end, r.span.color);
	});
	return spans.map((s, i) => resolved[i]?.span ?? s);
}

// ---------------------------------------------------------------------------
// Storage and legacy recovery

export function parseHighlightDocument(raw: unknown): HighlightDocument | null {
	if (!raw || typeof raw !== "object") return null;
	const data = raw as { version?: unknown; spans?: unknown };
	if (data.version !== HIGHLIGHT_DOC_VERSION || !Array.isArray(data.spans)) {
		return null;
	}
	const spans = data.spans.filter(
		(s): s is HighlightSpan =>
			!!s &&
			typeof s === "object" &&
			typeof (s as HighlightSpan).block === "string" &&
			typeof (s as HighlightSpan).quote === "string" &&
			HIGHLIGHT_COLORS.includes((s as HighlightSpan).color),
	);
	return { version: HIGHLIGHT_DOC_VERSION, spans };
}

export function buildHighlightDocument(spans: HighlightSpan[]): HighlightDocument {
	return { version: HIGHLIGHT_DOC_VERSION, spans };
}

function colorOfMark(mark: Element): HighlightColor | null {
	for (const c of HIGHLIGHT_COLORS) {
		if (mark.classList.contains(`highlight-${c}`)) return c;
	}
	return null;
}

/**
 * Best-effort recovery from pre-v3 documents, which only kept a view-specific
 * Rangy hash plus a snapshot of each highlighted container's HTML. The
 * snapshots carry the marks and their colors, so each mark is re-anchored by
 * text against the current page.
 */
export function spansFromLegacySegments(
	segments: Record<string, { containerHTML?: string }> | undefined,
	root: HTMLElement,
	existing: HighlightSpan[] = [],
): HighlightSpan[] {
	if (!segments) return existing;
	const doc = root.ownerDocument;
	const index = buildBlockIndex(root);
	let recovered = existing;

	for (const segment of Object.values(segments)) {
		if (!segment?.containerHTML) continue;
		const tpl = doc.createElement("template");
		tpl.innerHTML = segment.containerHTML;
		const marks = Array.from(
			tpl.content.querySelectorAll('mark[class*="highlight-"]'),
		);
		for (const mark of marks) {
			mark.setAttribute("data-hl", "");
		}
		const byBlock = new Map<HTMLElement, { color: HighlightColor; mark: Element }[]>();
		for (const mark of marks) {
			const color = colorOfMark(mark);
			const block = mark.closest<HTMLElement>(BLOCK_SELECTOR);
			if (!color || !block) continue;
			const list = byBlock.get(block) ?? [];
			list.push({ color, mark });
			byBlock.set(block, list);
		}
		for (const [block, list] of byBlock) {
			const nodes = blockTextNodes(block);
			const text = nodes.map((t) => t.data).join("");
			const isPali = block.classList.contains("pali-paragraph");
			const guessKey =
				(isPali ? null : keyedBlockId(block)) ?? (isPali ? "pli:?" : "en:?");
			const local: HighlightSpan[] = [];
			for (const { color, mark } of list) {
				const start = boundaryOffset(nodes, mark, 0);
				const end = boundaryOffset(nodes, mark, mark.childNodes.length);
				if (start >= end) continue;
				local.push(makeSpan(guessKey, text, start, end, color));
			}
			for (const span of mergeSameColor(local, text)) {
				const found = resolveSpan(span, index);
				if (found) {
					recovered = addPieces(
						recovered,
						[{ block: found.span.block, start: found.span.start, end: found.span.end }],
						span.color,
						index,
					);
				} else if (
					!pageHasLang(index, langOfKey(span.block)) &&
					!recovered.some(
						(s) =>
							s.block === span.block &&
							s.quote === span.quote &&
							s.color === span.color,
					)
				) {
					recovered = [...recovered, span];
				}
			}
		}
	}
	return recovered;
}
