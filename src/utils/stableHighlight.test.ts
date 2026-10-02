import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { JSDOM } from "jsdom";
import { createCombinedMarkdown, formatBlock, parsePaliOnly } from "./contentParser";
import { highlightSlugFromUrl, legacyHighlightSlugs } from "./highlightSlug";
import {
	addPieces,
	anchorsFromPieces,
	buildBlockIndex,
	erasePieces,
	paintHighlights,
	paintNotes,
	parseHighlightDocument,
	piecesFromRange,
	sanitizeDiscourseNotes,
	spansFromLegacySegments,
	type HighlightSpan,
} from "./stableHighlight";

function installDom(html: string): Document {
	const dom = new JSDOM(
		`<!DOCTYPE html><html><body><div id="highlight-root">${html}</div></body></html>`,
	);
	const { window } = dom;
	globalThis.window = window as unknown as Window & typeof globalThis;
	globalThis.document = window.document;
	globalThis.Node = window.Node;
	globalThis.Element = window.Element;
	globalThis.HTMLElement = window.HTMLElement;
	globalThis.Range = window.Range;
	globalThis.NodeFilter = window.NodeFilter;
	return window.document;
}

const root = () => document.getElementById("highlight-root") as HTMLElement;
const allRendered = () => true;

function textRange(el: Element, needle: string, endNeedle = needle): Range {
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	let startSet = false;
	for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
		if (!startSet) {
			const i = n.data.indexOf(needle);
			if (i >= 0) {
				range.setStart(n, i);
				startSet = true;
			}
		}
		if (startSet) {
			const j = n.data.indexOf(endNeedle);
			if (j >= 0) {
				range.setEnd(n, j + endNeedle.length);
				return range;
			}
		}
	}
	throw new Error(`text not found: ${needle} / ${endNeedle}`);
}

function select(
	startEl: Element,
	startNeedle: string,
	endEl: Element,
	endNeedle: string,
): Range {
	const range = document.createRange();
	const a = textRange(startEl, startNeedle);
	const b = textRange(endEl, endNeedle);
	range.setStart(a.startContainer, a.startOffset);
	range.setEnd(b.endContainer, b.endOffset);
	return range;
}

function highlight(range: Range, color: HighlightSpan["color"] = "yellow", spans: HighlightSpan[] = []) {
	const index = buildBlockIndex(root());
	return addPieces(spans, piecesFromRange(range, root(), allRendered, index), color, index);
}

function markedText(scope: ParentNode): string[] {
	return Array.from(scope.querySelectorAll("mark[data-hl]")).map((m) => m.textContent ?? "");
}

const EN1 = formatBlock("At one time the Blessed One was dwelling at Sāvatthī.", false, 0, null, 1);
const EN2 = formatBlock("Then a monk approached the Blessed One and sat down.", false, 1, null, 2);
const PLI1 = formatBlock("Ekaṁ samayaṁ bhagavā sāvatthiyaṁ viharati.", true, 0, null, 1, 1);
const PLI2 = formatBlock("Atha kho aññataro bhikkhu yena bhagavā tenupasaṅkami.", true, 1, null, 2, 2);

const englishOnlyPage = () =>
	`<article class="md-content interleaved-article">${EN1}${EN2}</article>`;
const interleavedPage = () =>
	`<article class="md-content interleaved-article">${PLI1}${EN1}${PLI2}${EN2}</article>`;
const splitPage = () =>
	`<article class="md-content interleaved-article">${PLI1}${EN1}${PLI2}${EN2}</article>
	<div class="split-wrapper"><article id="panel1" class="split-panel md-content">${EN1}${EN2}</article>
	<article id="panel2" class="split-panel md-content">${PLI1}${PLI2}</article></div>`;

describe("highlight slugs", () => {
	it("keys by pathname and lists the old per-view keys", () => {
		assert.equal(highlightSlugFromUrl("https://x.test/sn47.10?pli=true&layout=split"), "/sn47.10");
		assert.ok(legacyHighlightSlugs("/sn47.10").includes("/sn47.10?pli=true&layout=interleaved"));
	});
});

describe("block keys from the renderer", () => {
	it("stamps English paragraph numbers and Pāli ordinals", () => {
		assert.match(EN1, /data-hl-block="en:1"/);
		assert.match(PLI2, /data-hl-block="pli:2"/);
	});

	it("gives Pāli the same key in the discourse view and the Pāli-only view", () => {
		const pali = "Ekaṁ samayaṁ.\n\nAtha kho bhikkhu.\n\nDutiyaṁ.";
		const interleaved = createCombinedMarkdown(
			[
				{ type: "paragraph", english: "One time.", pali: "Ekaṁ samayaṁ.", actualParagraphNumber: 1, paliOrdinal: 1 },
				{ type: "paragraph", english: "Then a monk.", pali: "Atha kho bhikkhu.", actualParagraphNumber: 2, paliOrdinal: 2 },
			],
			true,
		) as string;
		const paliOnly = createCombinedMarkdown(parsePaliOnly(pali), true) as string;
		const pli2 = /data-hl-block="pli:2"[^>]*><span class="pali-word">Atha</;
		assert.match(interleaved, pli2);
		assert.match(paliOnly, pli2);
	});
});

describe("view-independent restore", () => {
	beforeEach(() => installDom(""));

	it("restores an English-only highlight on the English of an interleaved Pāli page", () => {
		installDom(englishOnlyPage());
		const en2 = root().querySelector('[data-hl-block="en:2"]')!;
		const spans = highlight(textRange(en2, "a monk approached"));

		installDom(interleavedPage());
		paintHighlights(root(), spans);
		assert.deepEqual(markedText(root()), ["a monk approached"]);
		assert.equal(root().querySelector("mark")!.closest("p")!.getAttribute("data-hl-block"), "en:2");
	});

	it("paints every copy: interleaved article and split panels", () => {
		installDom(interleavedPage());
		const pli2 = root().querySelector('[data-hl-block="pli:2"]')!;
		const en1 = root().querySelector('[data-hl-block="en:1"]')!;
		const spans = highlight(textRange(en1, "Blessed One"), "green", highlight(textRange(pli2, "bhikkhu")));

		installDom(splitPage());
		paintHighlights(root(), spans);
		assert.deepEqual(markedText(root().querySelector("#panel1")!), ["Blessed One"]);
		assert.deepEqual(markedText(root().querySelector("#panel2")!), ["bhikkhu"]);
		assert.deepEqual(markedText(root().querySelector(".interleaved-article")!), ["Blessed One", "bhikkhu"]);
	});

	it("keeps Pāli spans when the page renders English only, and shows them in the Pāli-only view", () => {
		installDom(interleavedPage());
		const pli1 = root().querySelector('[data-hl-block="pli:1"]')!;
		const spans = highlight(select(pli1, "bhagavā", pli1, "sāvatthiyaṁ"));

		installDom(englishOnlyPage());
		const kept = paintHighlights(root(), spans);
		assert.deepEqual(markedText(root()), []);
		assert.deepEqual(kept, spans);

		installDom(`<div class="ref-pali-only-view"><article class="md-content interleaved-article">${PLI1}${PLI2}</article></div>`);
		paintHighlights(root(), kept);
		assert.equal(markedText(root()).join(""), "bhagavā sāvatthiyaṁ");
	});
});

describe("multi-paragraph selections", () => {
	beforeEach(() => installDom(interleavedPage()));

	it("splits a mixed English / Pāli selection into one span per block", () => {
		const en1 = root().querySelector('[data-hl-block="en:1"]')!;
		const en2 = root().querySelector('[data-hl-block="en:2"]')!;
		const spans = highlight(select(en1, "dwelling", en2, "a monk"));
		assert.deepEqual(
			spans.map((s) => [s.block, s.quote]),
			[
				["en:1", "dwelling at Sāvatthī."],
				["pli:2", "Atha kho aññataro bhikkhu yena bhagavā tenupasaṅkami."],
				["en:2", "Then a monk"],
			],
		);
	});

	it("leaves out blocks that were in the range but not rendered (hidden Pāli)", () => {
		const en1 = root().querySelector('[data-hl-block="en:1"]')!;
		const en2 = root().querySelector('[data-hl-block="en:2"]')!;
		const range = select(en1, "dwelling", en2, "a monk");
		const pieces = piecesFromRange(range, root(), (el) => !el.classList.contains("pali-paragraph"));
		assert.deepEqual(pieces.map((p) => p.block), ["en:1", "en:2"]);
	});

	it("lets a new color win over the overlapped part and erases partially", () => {
		const en2 = root().querySelector('[data-hl-block="en:2"]')!;
		let spans = highlight(textRange(en2, "Then a monk approached"));
		paintHighlights(root(), spans);
		spans = highlight(textRange(en2, "monk"), "pink", spans);
		assert.deepEqual(
			spans.map((s) => [s.color, s.quote]).sort(),
			[["pink", "monk"], ["yellow", "Then a"], ["yellow", "approached"]],
		);
		paintHighlights(root(), spans);
		const index = buildBlockIndex(root());
		spans = erasePieces(spans, piecesFromRange(textRange(root().querySelector('[data-hl-block="en:2"]')!, "Then"), root(), allRendered, index), index);
		assert.deepEqual(spans.map((s) => s.quote).sort(), ["a", "approached", "monk"]);
	});
});

describe("no drift", () => {
	beforeEach(() => installDom(""));

	it("ignores ¶ markers, verse line breaks and whitespace when counting offsets", () => {
		installDom(`<article class="md-content interleaved-article">${formatBlock("One cannot reach the end\nof the world by traveling.", false, 0, null, 3)}</article>`);
		const p = root().querySelector("p")!;
		assert.ok(p.querySelector(".paragraph-num"));
		const spans = highlight(textRange(p, "the end", "of the world"));
		const painted = paintHighlights(root(), spans);
		assert.equal(root().querySelector("mark")!.closest("p"), p);
		assert.equal(markedText(root()).join(""), "the endof the world");
		assert.deepEqual(paintHighlights(root(), painted), painted);
	});

	it("re-anchors after a wording change earlier in the paragraph", () => {
		installDom(englishOnlyPage());
		const spans = highlight(textRange(root().querySelector('[data-hl-block="en:2"]')!, "sat down"));
		installDom(`<article class="md-content interleaved-article">${EN1}${formatBlock("Then a certain monk went up to the Blessed One and sat down.", false, 1, null, 2)}</article>`);
		paintHighlights(root(), spans);
		assert.deepEqual(markedText(root()), ["sat down"]);
	});

	it("follows a paragraph that was renumbered", () => {
		installDom(englishOnlyPage());
		const spans = highlight(textRange(root().querySelector('[data-hl-block="en:2"]')!, "a monk approached the Blessed One"));
		const inserted = formatBlock("A new opening line.", false, 1, null, 2);
		const moved = formatBlock("Then a monk approached the Blessed One and sat down.", false, 2, null, 3);
		installDom(`<article class="md-content interleaved-article">${EN1}${inserted}${moved}</article>`);
		const painted = paintHighlights(root(), spans);
		assert.deepEqual(markedText(root()), ["a monk approached the Blessed One"]);
		assert.equal(painted[0]!.block, "en:3");
	});

	it("does not jump a short quote into another paragraph", () => {
		installDom(englishOnlyPage());
		const spans = highlight(textRange(root().querySelector('[data-hl-block="en:2"]')!, "monk"));
		installDom(`<article class="md-content interleaved-article">${EN1}${formatBlock("Completely rewritten.", false, 1, null, 2)}${formatBlock("A monk came.", false, 2, null, 3)}</article>`);
		paintHighlights(root(), spans);
		assert.deepEqual(markedText(root()), []);
	});
});

describe("other structures", () => {
	beforeEach(() => installDom(""));

	it("anchors list items, nested lists, table cells and code blocks", () => {
		installDom(`<article class="md-content">
			<ul><li>Outer item<ul><li>Inner item</li></ul></li></ul>
			<table><tr><td>Cell one</td><td>Cell two</td></tr></table>
			<pre><code>const x = 1;</code></pre>
		</article>`);
		const md = root().querySelector(".md-content")!;
		const spans = highlight(select(md.querySelector("li")!, "item", md.querySelector("pre")!, "const"));
		assert.deepEqual(spans.map((s) => s.quote), ["item", "Inner item", "Cell one", "Cell two", "const"]);
		paintHighlights(root(), spans);
		assert.deepEqual(markedText(root()), ["item", "Inner item", "Cell one", "Cell two", "const"]);
	});

	it("skips SVG / Mermaid diagrams and collapse toggles", () => {
		installDom(`<article class="md-content">
			<p>Before <span class="collapse-toggle collapsed" data-content="hidden">․․․</span> after.</p>
			<div class="mermaid"><svg><text>node label</text></svg></div>
			<p>Last paragraph.</p>
		</article>`);
		const ps = root().querySelectorAll("p");
		const spans = highlight(select(ps[0]!, "Before", ps[1]!, "Last"));
		assert.deepEqual(spans.map((s) => s.quote), ["Before  after.", "Last"]);
		paintHighlights(root(), spans);
		assert.equal(root().querySelector("svg mark, .collapse-toggle mark"), null);
	});
});

describe("legacy recovery", () => {
	beforeEach(() => installDom(interleavedPage()));

	it("re-anchors marks from old container snapshots, English and Pāli", () => {
		const segments = {
			"p-3": {
				containerHTML: `<p id="2" data-paragraph-number="2" data-pair-id="1" class="english-paragraph"><span class="paragraph-num" aria-hidden="true">¶ 2</span>Then a <mark class="highlight-blue">monk</mark> approached the Blessed One and sat down.</p>`,
			},
			"p-2": {
				containerHTML: `<p data-pair-id="1" class="pali-paragraph">Atha kho aññataro <mark class="highlight-yellow">bhikkhu</mark> yena bhagavā tenupasaṅkami.</p>`,
			},
		};
		const spans = spansFromLegacySegments(segments, root());
		assert.deepEqual(
			spans.map((s) => [s.block, s.color, s.quote]).sort(),
			[["en:2", "blue", "monk"], ["pli:2", "yellow", "bhikkhu"]],
		);
	});
});

describe("notes", () => {
	beforeEach(() => installDom(interleavedPage()));

	function mixedNote() {
		const pli1 = root().querySelector('[data-hl-block="pli:1"]')!;
		const en1 = root().querySelector('[data-hl-block="en:1"]')!;
		const pieces = piecesFromRange(
			select(pli1, "Ekaṁ", en1, "At one"),
			root(),
			allRendered,
		);
		return {
			id: "note-mixed01",
			text: "A private note",
			spans: anchorsFromPieces(pieces, buildBlockIndex(root())),
		};
	}

	it("drops a second note that overlaps an earlier range", () => {
		const note = mixedNote();
		const kept = sanitizeDiscourseNotes([
			note,
			{ ...note, id: "note-second1", text: "another" },
			{ id: "note-empty01", text: "   ", spans: note.spans },
		]);
		assert.deepEqual(kept.map((item) => item.id), ["note-mixed01"]);
		assert.equal(
			parseHighlightDocument({ version: 3, spans: [], notes: kept })?.notes.length,
			1,
		);
	});

	it("shows a mixed English and Pāli note from the English part on an English-only page", () => {
		const note = mixedNote();
		installDom(englishOnlyPage());
		const painted = paintNotes(root(), [note], allRendered);
		const cue = root().querySelector(".note-cue");
		assert.ok(cue);
		assert.equal(
			cue!.closest("[data-hl-block]")!.getAttribute("data-hl-block"),
			"en:1",
		);
		assert.match(root().querySelector("mark[data-note]")!.textContent ?? "", /At one/);
		assert.ok(painted[0]!.spans.some((span) => span.block === "pli:1"));
	});

	it("puts the marker on the first visible span when Pāli is hidden", () => {
		const note = mixedNote();
		paintNotes(root(), [note], (el) => !el.classList.contains("pali-paragraph"));
		const cues = [...root().querySelectorAll(".note-cue")];
		assert.ok(cues.length > 0);
		assert.ok(
			cues.every(
				(cue) => cue.closest("[data-hl-block]")!.getAttribute("data-hl-block") === "en:1",
			),
		);
		assert.ok(root().querySelector('[data-hl-block="pli:1"] mark[data-note]'));
		assert.ok(root().querySelector('[data-hl-block="en:1"] mark[data-note]'));
	});
});
