import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { formatBlock } from "./contentParser";
import { parseMarkdown } from "./mdParser";
import {
	PARAGRAPH_NUM_CLASS,
	paragraphNumberMarkerHtml,
	withoutParagraphNumberMarkers,
} from "./paragraphNumbers";

const repoSrc = path.join(path.dirname(fileURLToPath(import.meta.url)));

function installDom(html: string): Document {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document;
	globalThis.Node = dom.window.Node;
	globalThis.HTMLElement = dom.window.HTMLElement;
	return dom.window.document;
}

describe("paragraph number markup", () => {
	it("emits a real aria-hidden marker on numbered English paragraphs", () => {
		const html = formatBlock("Hello world.", false, 0);
		assert.match(
			html,
			/<span class="paragraph-num" aria-hidden="true" unselectable="on">¶ 1<\/span>/,
		);
		assert.match(html, /data-paragraph-number="1"/);
		assert.equal(html.includes("::before"), false);
	});

	it("does not emit trailing copy-para-break brs (plain copy is JS-only)", () => {
		const html = formatBlock("Hello world.", false, 0);
		assert.equal(html.includes("copy-para-break"), false);
		assert.match(html, />Hello world\.<\/p>/);
	});

	it("does not emit copy-para-break on Pāli paragraphs", () => {
		const html = formatBlock("Bhikkhave.", true, 0);
		assert.equal(html.includes("paragraph-num"), false);
		assert.equal(html.includes("¶"), false);
		assert.equal(html.includes("copy-para-break"), false);
		assert.match(html, /Bhikkhave/);
		assert.match(html, /<\/p>$/);
	});

	it("does not wrap headings in paragraphs or copy-break markup", () => {
		const html = formatBlock("### A heading", false, 0);
		assert.equal(html.includes("copy-para-break"), false);
		assert.equal(html.includes("<p"), false);
	});

	it("survives marked.parse without nesting paragraphs", async () => {
		const html = await parseMarkdown(
			`${formatBlock("Hello world.", false, 0)}\n\n${formatBlock("Second.", false, 1)}`,
		);
		assert.equal(html.includes("<p><p"), false);
		assert.equal((html.match(/class="paragraph-num"/g) || []).length, 2);
		assert.equal(html.includes("copy-para-break"), false);
		assert.match(html, />Hello world\.<\/p>/);
		assert.match(html, />Second\.<\/p>/);
	});

	it("paragraphNumberMarkerHtml matches the class the copy walker skips", () => {
		assert.equal(
			paragraphNumberMarkerHtml(12),
			`<span class="${PARAGRAPH_NUM_CLASS}" aria-hidden="true" unselectable="on">¶ 12</span>`,
		);
	});

	it("AN 4.235 paragraphs 1–2 keep verse brs without trailing copy brs", () => {
		const opening =
			"Bhikkhus, having realized them for myself with direct knowledge, I have declared these four kinds of deeds. What four?";
		const numbered = [
			"1.) There are dark deeds with dark results;",
			"2.) There are bright deeds with bright results;",
			"3.) There are dark and bright deeds with dark and bright results;",
			"4.) There are neither dark nor bright deeds with neither dark nor bright results, which leads to the wearing away of deeds.",
		].join("\n");
		const p1 = formatBlock(opening, false, 0);
		const p2 = formatBlock(numbered, false, 1);
		assert.ok(p1.endsWith("What four?</p>"), p1);
		assert.equal(p1.includes("position:absolute"), false);
		assert.ok(p2.endsWith("</p>"), p2);
		assert.equal(p2.includes("copy-para-break"), false);
		assert.equal(
			(p2.match(/<br \/>/g) || []).length,
			3,
			"verse line breaks stay between numbered lines",
		);
	});
});

describe("withoutParagraphNumberMarkers", () => {
	it("detaches markers for the callback and restores them after", () => {
		const document = installDom(`
			<p id="1" data-paragraph-number="1">
				<span class="paragraph-num" aria-hidden="true">¶ 1</span>Hello
			</p>
		`);
		const p = document.querySelector("p")!;
		assert.equal(p.querySelector(".paragraph-num")?.textContent, "¶ 1");
		const during = withoutParagraphNumberMarkers(() => {
			assert.equal(p.querySelector(".paragraph-num"), null);
			return p.textContent?.trim();
		});
		assert.equal(during, "Hello");
		assert.equal(p.querySelector(".paragraph-num")?.textContent, "¶ 1");
	});
});

describe("stylesheet regression", () => {
	it("does not paint ¶ N via CSS generated content", () => {
		const files = [
			"styles/content.css",
			"styles/listen-mode.css",
			"styles/global.css",
			"components/ParagraphToggle.astro",
		];
		for (const rel of files) {
			const src = readFileSync(path.join(repoSrc, "..", rel), "utf8");
			assert.equal(
				/content:\s*["']¶/.test(src),
				false,
				`${rel} still uses CSS content for pilcrow markers`,
			);
			assert.equal(
				/p\[id\]::before/.test(src),
				false,
				`${rel} still targets p[id]::before`,
			);
			assert.equal(
				/data-paragraph-number\]::before/.test(src),
				false,
				`${rel} still targets [data-paragraph-number]::before`,
			);
		}
		const contentCss = readFileSync(
			path.join(repoSrc, "..", "styles/content.css"),
			"utf8",
		);
		assert.equal(
			contentCss.includes("copy-para-break"),
			false,
			"content.css must not style copy-para-break brs",
		);
		assert.equal(
			/p\.english-paragraph[^{]*\{[^}]*2lh/.test(contentCss),
			false,
			"english-paragraph must not use -2lh margin (fails under split-wrapper)",
		);
		assert.equal(
			/p\.english-paragraph[^{]*::after/.test(contentCss),
			false,
			"dead p::after \\\\A\\\\A copy hook must not stack with in-flow brs",
		);
		const mdContent = readFileSync(
			path.join(repoSrc, "..", "components/MDContent.astro"),
			"utf8",
		);
		assert.equal(
			mdContent.includes("copy-para-break"),
			false,
			"MDContent must not collapse copy-para-break brs",
		);
		const listenCss = readFileSync(
			path.join(repoSrc, "..", "styles/listen-mode.css"),
			"utf8",
		);
		assert.equal(
			listenCss.includes("copy-para-break"),
			false,
			"listen-mode must not style copy-para-break brs",
		);
		const inlineCopy = readFileSync(
			path.join(repoSrc, "discoursePlainCopyInline.js"),
			"utf8",
		);
		assert.equal(
			inlineCopy.includes("input, textarea, select, [contenteditable='true']"),
			false,
			"must not bail on contenteditable for discourse selections",
		);
		assert.ok(
			inlineCopy.includes('document.addEventListener("copy"'),
			"inline copy handler must listen on document capture",
		);
		assert.ok(
			inlineCopy.includes("event.preventDefault()"),
			"inline copy handler must call preventDefault",
		);
		assert.ok(
			inlineCopy.includes("__suttaPlainCopyPrepare"),
			"inline copy handler may use the module prepare helper when present",
		);
		assert.equal(
			inlineCopy.includes("[sutta-copy]"),
			false,
			"inline copy handler must not log debug traces",
		);
		assert.equal(
			inlineCopy.includes("__suttaCopyDebug"),
			false,
			"inline copy handler must not keep a debug gate",
		);
		const liveIdx = inlineCopy.indexOf("__suttaPlainFromLiveSelection");
		const onCopyIdx = inlineCopy.indexOf("function __suttaOnCopy");
		const extractCallIdx = inlineCopy.indexOf(
			"__suttaExtractSelectionPlain(sel, event)",
			onCopyIdx,
		);
		const writeCallIdx = inlineCopy.indexOf(
			"__suttaWritePlainClipboard(event, text)",
			extractCallIdx,
		);
		const preventIdx = inlineCopy.indexOf("event.preventDefault()");
		const setDataIdx = inlineCopy.indexOf(
			'clipboardData.setData("text/plain"',
		);
		assert.ok(
			liveIdx >= 0 &&
				extractCallIdx > onCopyIdx &&
				writeCallIdx > extractCallIdx &&
				preventIdx >= 0 &&
				setDataIdx > preventIdx,
			"inline copy handler must extract live blocks, then preventDefault, then setData",
		);
		const layoutSrc = readFileSync(
			path.join(repoSrc, "..", "layouts", "Layout.astro"),
			"utf8",
		);
		assert.ok(
			layoutSrc.includes("discoursePlainCopyInline"),
			"Layout.astro must inline the copy script in head",
		);
		assert.equal(
			layoutSrc.includes("data-sutta-plain-copy"),
			false,
			"data-sutta-plain-copy was debug-only",
		);
	});
});
