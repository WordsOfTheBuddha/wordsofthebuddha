import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach } from "node:test";
import { JSDOM } from "jsdom";
import { formatBlock } from "./contentParser";
import {
	getPlainTextFromRange,
	getPlainTextFromRangeClone,
	getPlainTextFromContainer,
	shouldSkipCopyElement,
	installDiscoursePlainCopy,
	resetDiscoursePlainCopyForTests,
	beginCopySanitization,
	endCopySanitization,
	isEditableCopyTarget,
} from "./plainCopy";

function installDom(html: string): { document: Document; window: Window } {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
	const { window } = dom;
	globalThis.window = window as unknown as Window & typeof globalThis;
	globalThis.document = window.document;
	globalThis.Node = window.Node;
	globalThis.Element = window.Element;
	globalThis.HTMLElement = window.HTMLElement;
	globalThis.Range = window.Range;
	globalThis.NodeFilter = window.NodeFilter;
	globalThis.TreeWalker = window.TreeWalker;
	return { document: window.document, window: window as unknown as Window };
}

function selectAll(el: Element): Range {
	const range = document.createRange();
	range.selectNodeContents(el);
	return range;
}

/**
 * Approximate WebKit native copy of a selection: concatenates text nodes and
 * maps in-flow `<br>` → `\n`. Sibling `<p>`s glue (`Park.Then`) without the
 * JS copy handler. Skips `.paragraph-num`.
 */
function nativeCopyLike(root: ParentNode): string {
	let out = "";
	const walker = document.createTreeWalker(
		root,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		{
			acceptNode(node: Node): number {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const el = node as HTMLElement;
					if (
						el.classList.contains("paragraph-num") ||
						el.matches(
							"button, script, style, .tm-lookup-btn, .listen-para-actions",
						)
					) {
						return NodeFilter.FILTER_REJECT;
					}
					if (el.tagName.toLowerCase() === "br") {
						return NodeFilter.FILTER_ACCEPT;
					}
					return NodeFilter.FILTER_SKIP;
				}
				const text = node as Text;
				if (isInterBlockWhitespaceForNative(text)) {
					return NodeFilter.FILTER_REJECT;
				}
				return NodeFilter.FILTER_ACCEPT;
			},
		},
	);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			out += "\n";
		} else {
			out += (node as Text).data;
		}
	}
	return out;
}

function isInterBlockWhitespaceForNative(text: Text): boolean {
	if (!/^[\s\u00a0]*$/.test(text.data)) return false;
	const parent = text.parentElement;
	if (!parent) return true;
	return !parent.closest(
		"p, h1, h2, h3, h4, h5, h6, li, blockquote, pre",
	);
}

describe("getPlainTextFromRange", () => {
	beforeEach(() => {
		installDom("");
		document.documentElement.classList.remove("pali-on");
	});

	it("joins consecutive English paragraphs with a blank line and omits pilcrows", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph" id="1" data-paragraph-number="1">At one time, the Blessed One was dwelling at Sāvatthi, in Jeta’s Grove, Anāthapiṇḍika’s Park.</p>
				<p class="english-paragraph" id="2" data-paragraph-number="2">Then, when the night had advanced, the young deity Rohitassa approached the Blessed One.</p>
				<p class="english-paragraph" id="3" data-paragraph-number="3">“Is it possible, venerable sir, … reborn?”</p>
				<p class="english-paragraph" id="6" data-paragraph-number="6">Translation in progress...</p>
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		const text = getPlainTextFromRange(selectAll(article));
		assert.equal(
			text,
			[
				"At one time, the Blessed One was dwelling at Sāvatthi, in Jeta’s Grove, Anāthapiṇḍika’s Park.",
				"Then, when the night had advanced, the young deity Rohitassa approached the Blessed One.",
				"“Is it possible, venerable sir, … reborn?”",
				"Translation in progress...",
			].join("\n\n"),
		);
		assert.equal(text.includes("¶"), false);
		assert.equal(/\dThen/.test(text), false);
	});

	it("does not include aria-hidden paragraph numbers or TM / listen chrome", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph" id="1" data-paragraph-number="1">
					<span class="paragraph-num" aria-hidden="true">¶ 1</span>
					First paragraph.
					<button class="tm-lookup-btn" type="button">TM</button>
				</p>
				<p class="english-paragraph english-pair-spacer" aria-hidden="true"><span>​</span></p>
				<p class="english-paragraph" id="2" data-paragraph-number="2">
					<span class="paragraph-num" aria-hidden="true">¶ 2</span>
					Second paragraph.
					<span class="listen-para-actions"><button type="button">Listen</button></span>
				</p>
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		const text = getPlainTextFromRange(selectAll(article));
		assert.equal(text, "First paragraph.\n\nSecond paragraph.");
		assert.equal(text.includes("¶"), false);
		assert.equal(text.includes("TM"), false);
		assert.equal(text.includes("Listen"), false);
	});

	it("omits hidden Pāli when pali-on is off", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph" id="1">English one.</p>
				<p class="pali-paragraph">Pāli one.</p>
				<p class="english-paragraph" id="2">English two.</p>
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		const text = getPlainTextFromRange(selectAll(article));
		assert.equal(text, "English one.\n\nEnglish two.");
		assert.equal(text.includes("Pāli"), false);
	});

	it("strips formatBlock markers and joins paragraphs with a blank line", () => {
		const { document } = installDom(`
			<article class="md-content">
				${formatBlock("paragraph one", false, 0)}
				${formatBlock("paragraph two", false, 1)}
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		assert.equal(article.querySelectorAll(".paragraph-num").length, 2);
		assert.equal(article.querySelectorAll(".copy-para-break").length, 0);
		const text = getPlainTextFromRange(selectAll(article));
		assert.equal(text, "paragraph one\n\nparagraph two");
	});

	it("joins sibling english <p>s with a blank line (not Park.Then)", () => {
		const { document } = installDom(`
			<article class="md-content">${formatBlock("Anāthapiṇḍika’s Park.", false, 0)}${formatBlock("Then, when the night had advanced", false, 1)}${formatBlock("One:“Is it possible", false, 2)}</article>
		`);
		const article = document.querySelector(".md-content")!;
		const paragraphs = [
			...article.querySelectorAll(".english-paragraph"),
		];
		assert.equal(paragraphs.length, 3);

		const gluedWithoutHandler = paragraphs
			.map((p) => {
				const clone = p.cloneNode(true) as HTMLElement;
				clone
					.querySelectorAll(".paragraph-num")
					.forEach((n) => n.remove());
				return clone.textContent || "";
			})
			.join("");
		assert.equal(
			gluedWithoutHandler.includes("Park.Then"),
			true,
			"sibling <p> textContent glues without the copy handler",
		);

		const native = nativeCopyLike(article);
		assert.equal(native.includes("Park.Then"), true);

		assert.equal(
			getPlainTextFromRange(selectAll(article)),
			"Anāthapiṇḍika’s Park.\n\nThen, when the night had advanced\n\nOne:“Is it possible",
		);
	});

	it("separates sibling english <p>s with one blank line", () => {
		const { document } = installDom(`
			<article class="md-content">${formatBlock("paragraph one", false, 0)}${formatBlock("paragraph two", false, 1)}</article>
		`);
		const article = document.querySelector(".md-content")!;
		assert.equal(article.querySelectorAll("br.copy-para-break").length, 0);
		assert.equal(
			getPlainTextFromRange(selectAll(article)),
			"paragraph one\n\nparagraph two",
		);
	});

	it("keeps gloss term text and ignores tooltip attributes", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph" id="1">The young deity <span class="tooltip-text" data-tooltip="lit. red horse">Rohitassa</span> said this.</p>
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		const text = getPlainTextFromRange(selectAll(article));
		assert.equal(text, "The young deity Rohitassa said this.");
		assert.equal(text.includes("red horse"), false);
	});

	it("inserts a blank line between cloned sibling english-paragraph elements", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph">paragraph one</p>
				<p class="english-paragraph">paragraph two</p>
			</article>
		`);
		const [p1, p2] = document.querySelectorAll(".english-paragraph");
		const holder = document.createElement("div");
		holder.appendChild(p1.cloneNode(true));
		holder.appendChild(p2.cloneNode(true));
		assert.equal(
			getPlainTextFromContainer(holder),
			"paragraph one\n\nparagraph two",
		);
	});

	it("getPlainTextFromRangeClone matches container path for multi-paragraph selection", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph">paragraph one</p>
				<p class="english-paragraph">paragraph two</p>
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		const range = selectAll(article);
		assert.equal(
			getPlainTextFromRangeClone(range),
			"paragraph one\n\nparagraph two",
		);
		assert.equal(
			getPlainTextFromRangeClone(range),
			getPlainTextFromRange(range),
		);
	});

	it("joins consecutive English paragraphs in split panel #panel1", () => {
		const { document } = installDom(`
			<div class="split-wrapper" aria-hidden="true">
				<article id="panel1" class="split-panel md-content prose">
					<p class="english-paragraph" id="1">paragraph one</p>
					<p class="english-paragraph" id="2">paragraph two</p>
				</article>
				<article id="panel2" class="split-panel md-content prose"></article>
			</div>
		`);
		const panel = document.querySelector("#panel1")!;
		assert.equal(
			getPlainTextFromRange(selectAll(panel)),
			"paragraph one\n\nparagraph two",
		);
	});

	it("prefers #panel1 over hidden interleaved article in DOM order", () => {
		const { document } = installDom(`
			<div class="ref-translation-view">
				<article class="interleaved-article md-content" aria-hidden="true">
					<p class="english-paragraph">hidden interleaved</p>
				</article>
				<div class="split-wrapper" aria-hidden="false">
					<article id="panel1" class="split-panel md-content">
						<p class="english-paragraph">paragraph one</p>
						<p class="english-paragraph">paragraph two</p>
					</article>
					<article id="panel2" class="split-panel md-content"></article>
				</div>
			</div>
		`);
		const panel = document.querySelector("#panel1")!;
		assert.equal(
			getPlainTextFromRange(selectAll(panel)),
			"paragraph one\n\nparagraph two",
		);
	});

	it("joins paragraphs when intersectsNode is broken (WebKit)", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph">paragraph one</p>
				<p class="english-paragraph">paragraph two</p>
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		const original = Range.prototype.intersectsNode;
		Range.prototype.intersectsNode = () => false;
		try {
			assert.equal(
				getPlainTextFromRange(selectAll(article)),
				"paragraph one\n\nparagraph two",
			);
		} finally {
			Range.prototype.intersectsNode = original;
		}
	});

	it("does not glue minified </p><p> siblings from a text-node selection", () => {
		const { document } = installDom(
			`<article class="md-content"><p class="english-paragraph">Anāthapiṇḍika’s Park.</p><p class="english-paragraph">Then, when the night had advanced</p><p class="english-paragraph">Unselected third.</p></article>`,
		);
		const article = document.querySelector(".md-content")!;
		const [p1, p2] = article.querySelectorAll("p");
		const t1 = p1.firstChild as Text;
		const t2 = p2.firstChild as Text;
		const range = document.createRange();
		range.setStart(t1, 0);
		range.setEnd(t2, t2.data.length);

		assert.equal(
			(article.textContent || "").includes("Park.Then"),
			true,
			"native textContent glues adjacent p's with no separator",
		);
		assert.equal(
			getPlainTextFromRange(range),
			"Anāthapiṇḍika’s Park.\n\nThen, when the night had advanced",
		);
	});

	it("unwrapped clone fragments glue; live paragraph walk still joins", () => {
		const { document } = installDom(
			`<article class="md-content"><p class="english-paragraph">What four?</p><p class="english-paragraph">1.) There are dark deeds with dark results;</p></article>`,
		);
		const article = document.querySelector(".md-content")!;
		const [p1, p2] = article.querySelectorAll("p");
		const t1 = p1.firstChild as Text;
		const t2 = p2.firstChild as Text;
		const range = document.createRange();
		range.setStart(t1, 5);
		range.setEnd(t2, 3);

		// Chrome cloneContents() of a mid-<p> → mid-<p> selection often yields
		// bare text/spans with no sibling <p> wrappers. JSDOM keeps the <p>s, so
		// simulate the unwrapped fragment Chrome hands the old clone walker.
		const unwrapped = document.createElement("div");
		unwrapped.appendChild(document.createTextNode("four?"));
		unwrapped.appendChild(document.createTextNode("1.)"));
		assert.equal(
			(unwrapped.textContent || "").includes("four?1.)"),
			true,
			"unwrapped clone textContent glues paragraphs",
		);
		assert.equal(
			getPlainTextFromContainer(unwrapped).includes("\n\n"),
			false,
			"walking the unwrapped clone cannot see sibling <p>s",
		);
		assert.equal(getPlainTextFromRange(range), "four?\n\n1.)");
		assert.equal(getPlainTextFromRangeClone(range), "four?\n\n1.)");
	});

	it("keeps verse <br> as single newlines and a blank line after preceding prose", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph">paragraph one</p>
				<p class="english-paragraph verse">One cannot reach the end of the world<br>through traveling at any time;</p>
			</article>
		`);
		const article = document.querySelector(".md-content")!;
		assert.equal(
			getPlainTextFromRange(selectAll(article)),
			"paragraph one\n\nOne cannot reach the end of the world\nthrough traveling at any time;",
		);

		const holder = document.createElement("div");
		for (const p of article.querySelectorAll("p")) {
			holder.appendChild(p.cloneNode(true));
		}
		assert.equal(
			getPlainTextFromContainer(holder),
			"paragraph one\n\nOne cannot reach the end of the world\nthrough traveling at any time;",
		);

		const native = nativeCopyLike(article);
		assert.match(
			native,
			/One cannot reach the end of the world\nthrough traveling at any time;/,
		);
		assert.equal(native.includes("worldthrough"), false);
	});

	it("formatBlock verse <br>s stay as in-flow line breaks", () => {
		const { document } = installDom(`
			<article class="md-content">${formatBlock("One cannot reach the end of the world\nthrough traveling at any time;", false, 0)}</article>
		`);
		const p = document.querySelector(".english-paragraph")!;
		assert.equal(p.classList.contains("verse"), true);
		assert.equal(p.querySelectorAll("br.copy-para-break").length, 0);
		assert.ok(
			p.querySelectorAll("br").length >= 1,
			"verse line breaks remain",
		);
		assert.equal(
			getPlainTextFromRange(selectAll(p)),
			"One cannot reach the end of the world\nthrough traveling at any time;",
		);
		assert.match(
			nativeCopyLike(p),
			/world\nthrough traveling/,
		);
	});

	it("AN 4.235: numbered list is verse <br>s; sibling prose <p>s get a blank line", () => {
		const opening =
			"Bhikkhus, having realized them for myself with direct knowledge, I have declared these four kinds of deeds. What four?";
		const numbered = [
			"1.) There are dark deeds with dark results;",
			"2.) There are bright deeds with bright results;",
			"3.) There are dark and bright deeds with dark and bright results;",
			"4.) There are neither dark nor bright deeds with neither dark nor bright results, which leads to the wearing away of deeds.",
		].join("\n");
		const dark =
			"And what are dark deeds with dark results? Here, someone kills living beings. These are called dark deeds with dark results.";
		const { document } = installDom(`
			<article class="md-content">${formatBlock(opening, false, 0)}${formatBlock(numbered, false, 1)}${formatBlock(dark, false, 2)}</article>
		`);
		const article = document.querySelector(".md-content")!;
		const paragraphs = [
			...article.querySelectorAll(".english-paragraph"),
		];
		assert.equal(paragraphs.length, 3);
		assert.equal(paragraphs[0].classList.contains("verse"), false);
		assert.equal(paragraphs[1].classList.contains("verse"), true);
		assert.equal(
			paragraphs[1].querySelectorAll("br").length,
			3,
		);
		assert.equal(article.querySelectorAll("br.copy-para-break").length, 0);

		const expected = [opening, numbered, dark].join("\n\n");
		assert.equal(getPlainTextFromRange(selectAll(article)), expected);

		const native = nativeCopyLike(article);
		assert.equal(native.includes("What four?1.)"), true);
		assert.equal(native.includes("deeds.And what"), true);
		assert.match(native, /1\.\)[^\n]+\n2\.\)/);
	});
});

describe("getPlainTextFromContainer", () => {
	it("adds blank lines after cloned paragraph elements", () => {
		const { document } = installDom(`
			<div id="src">
				<p>paragraph one text</p>
				<p>paragraph two text</p>
			</div>
		`);
		const src = document.getElementById("src")!;
		const text = getPlainTextFromContainer(src);
		assert.equal(text, "paragraph one text\n\nparagraph two text");
	});
});

describe("copy event handler", () => {
	it("preventDefaults and sets text/plain only, with blank lines", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(`
			<article class="md-content">
				<p class="english-paragraph" id="1">paragraph one text</p>
				<p class="english-paragraph" id="2">paragraph two text</p>
			</article>
		`);
		installDiscoursePlainCopy();

		const article = document.querySelector(".md-content")!;
		const selection = window.getSelection();
		assert.ok(selection);
		selection.removeAllRanges();
		selection.addRange(selectAll(article));

		const stored: Record<string, string> = {};
		const event = new window.Event("copy", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "clipboardData", {
			value: {
				setData(type: string, value: string) {
					stored[type] = value;
				},
			},
		});
		document.dispatchEvent(event);

		assert.equal(event.defaultPrevented, true);
		assert.equal(stored["text/html"], undefined);
		assert.equal(
			stored["text/plain"],
			"paragraph one text\n\nparagraph two text",
		);
	});

	it("inline handler extracts text before preventDefault", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(`
			<article class="md-content">
				<p class="english-paragraph">paragraph one</p>
				<p class="english-paragraph">paragraph two</p>
			</article>
		`);
		assert.equal(typeof window.__suttaPlainCopyPrepare, "undefined");
		const inlineSrc = readFileSync(
			path.join(
				path.dirname(fileURLToPath(import.meta.url)),
				"discoursePlainCopyInline.js",
			),
			"utf8",
		);
		(window as unknown as { eval: (code: string) => void }).eval(inlineSrc);

		const article = document.querySelector(".md-content")!;
		const selection = window.getSelection();
		assert.ok(selection);
		selection.removeAllRanges();
		selection.addRange(selectAll(article));

		const stored: Record<string, string> = {};
		const event = new window.Event("copy", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "clipboardData", {
			value: {
				setData(type: string, value: string) {
					stored[type] = value;
				},
			},
		});
		document.dispatchEvent(event);

		assert.equal(event.defaultPrevented, true);
		assert.equal(stored["text/plain"], "paragraph one\n\nparagraph two");
	});

	it("inline copy does not log on copy", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(`
			<article class="md-content">
				<p class="english-paragraph">paragraph one</p>
				<p class="english-paragraph">paragraph two</p>
			</article>
		`);
		const logs: unknown[][] = [];
		const originalLog = console.log;
		const originalWarn = console.warn;
		const originalError = console.error;
		console.log = (...args: unknown[]) => {
			logs.push(["log", ...args]);
		};
		console.warn = (...args: unknown[]) => {
			logs.push(["warn", ...args]);
		};
		console.error = (...args: unknown[]) => {
			logs.push(["error", ...args]);
		};
		window.console.log = console.log;
		window.console.warn = console.warn;
		window.console.error = console.error;
		try {
			const inlineSrc = readFileSync(
				path.join(
					path.dirname(fileURLToPath(import.meta.url)),
					"discoursePlainCopyInline.js",
				),
				"utf8",
			);
			(window as unknown as { eval: (code: string) => void }).eval(inlineSrc);

			const article = document.querySelector(".md-content")!;
			const selection = window.getSelection();
			assert.ok(selection);
			selection.removeAllRanges();
			selection.addRange(selectAll(article));

			const event = new window.Event("copy", {
				bubbles: true,
				cancelable: true,
			});
			Object.defineProperty(event, "clipboardData", {
				value: {
					setData() {},
				},
			});
			document.dispatchEvent(event);
			assert.equal(event.defaultPrevented, true);
			assert.equal(logs.length, 0);
		} finally {
			console.log = originalLog;
			console.warn = originalWarn;
			console.error = originalError;
			window.console.log = originalLog;
			window.console.warn = originalWarn;
			window.console.error = originalError;
		}
	});

	it("does not treat contenteditable discourse as an editable skip", () => {
		const { document } = installDom(`
			<div id="highlight-root" contenteditable="true">
				<article class="md-content" contenteditable="true">
					<p class="english-paragraph">What four?</p>
				</article>
			</div>
			<input id="q" />
			<div id="other" contenteditable="true">notes</div>
		`);
		const article = document.querySelector(".md-content") as HTMLElement;
		const root = document.getElementById("highlight-root") as HTMLElement;
		const para = document.querySelector(".english-paragraph") as HTMLElement;
		assert.equal(article.getAttribute("contenteditable"), "true");
		assert.equal(root.getAttribute("contenteditable"), "true");
		assert.equal(isEditableCopyTarget(article), false);
		assert.equal(isEditableCopyTarget(root), false);
		assert.equal(isEditableCopyTarget(para), false);
		assert.equal(isEditableCopyTarget(document.getElementById("q")), true);
		assert.equal(isEditableCopyTarget(document.getElementById("other")), true);
	});

	it("copy event on contenteditable discourse preventDefaults and writes paragraph breaks", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(`
			<div id="highlight-root" contenteditable="true">
				<article class="md-content" contenteditable="true">
					<p class="english-paragraph">What four?</p>
					<p class="english-paragraph">1.) There are dark deeds with dark results;</p>
				</article>
			</div>
		`);
		const written: { text: string } = { text: "" };
		Object.defineProperty(window.navigator, "clipboard", {
			configurable: true,
			value: {
				writeText(text: string) {
					written.text = text;
					return Promise.resolve();
				},
			},
		});
		const inlineSrc = readFileSync(
			path.join(
				path.dirname(fileURLToPath(import.meta.url)),
				"discoursePlainCopyInline.js",
			),
			"utf8",
		);
		(window as unknown as { eval: (code: string) => void }).eval(inlineSrc);

		const article = document.querySelector(".md-content") as HTMLElement;
		assert.equal(article.getAttribute("contenteditable"), "true");
		assert.ok(
			article.closest("[contenteditable='true']"),
			"old skip used closest([contenteditable=true]) and would have bailed",
		);
		const selection = window.getSelection();
		assert.ok(selection);
		selection.removeAllRanges();
		selection.addRange(selectAll(article));

		const stored: Record<string, string> = {};
		const event = new window.Event("copy", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "clipboardData", {
			value: {
				setData(type: string, value: string) {
					stored[type] = value;
				},
			},
		});
		article.dispatchEvent(event);

		assert.equal(event.defaultPrevented, true);
		const expected =
			"What four?\n\n1.) There are dark deeds with dark results;";
		assert.equal(written.text, expected);
		assert.equal(stored["text/plain"], expected);
	});

	it("inline copy joins a mid-paragraph selection with a blank line", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(
			`<article class="md-content"><p class="english-paragraph">What four?</p><p class="english-paragraph">1.) There are dark deeds with dark results;</p></article>`,
		);
		const written: { text: string } = { text: "" };
		Object.defineProperty(window.navigator, "clipboard", {
			configurable: true,
			value: {
				writeText(text: string) {
					written.text = text;
					return Promise.resolve();
				},
			},
		});
		const inlineSrc = readFileSync(
			path.join(
				path.dirname(fileURLToPath(import.meta.url)),
				"discoursePlainCopyInline.js",
			),
			"utf8",
		);
		(window as unknown as { eval: (code: string) => void }).eval(inlineSrc);

		const article = document.querySelector(".md-content")!;
		const [p1, p2] = article.querySelectorAll("p");
		const t1 = p1.firstChild as Text;
		const t2 = p2.firstChild as Text;
		const range = document.createRange();
		range.setStart(t1, 0);
		range.setEnd(t2, t2.data.length);
		const selection = window.getSelection();
		assert.ok(selection);
		selection.removeAllRanges();
		selection.addRange(range);

		const stored: Record<string, string> = {};
		const event = new window.Event("copy", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "clipboardData", {
			value: {
				setData(type: string, value: string) {
					stored[type] = value;
				},
			},
		});
		document.dispatchEvent(event);

		const expected =
			"What four?\n\n1.) There are dark deeds with dark results;";
		assert.equal(event.defaultPrevented, true);
		assert.equal(stored["text/plain"], expected);
		assert.equal(written.text, expected);
	});

	it("inline copy does not steal copy from inputs", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(`
			<article class="md-content">
				<p class="english-paragraph">paragraph one</p>
			</article>
			<input id="q" value="query" />
		`);
		const written: { text: string } = { text: "" };
		Object.defineProperty(window.navigator, "clipboard", {
			configurable: true,
			value: {
				writeText(text: string) {
					written.text = text;
					return Promise.resolve();
				},
			},
		});
		const inlineSrc = readFileSync(
			path.join(
				path.dirname(fileURLToPath(import.meta.url)),
				"discoursePlainCopyInline.js",
			),
			"utf8",
		);
		(window as unknown as { eval: (code: string) => void }).eval(inlineSrc);

		const input = document.getElementById("q") as HTMLInputElement;
		input.focus();
		const stored: Record<string, string> = {};
		const event = new window.Event("copy", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "clipboardData", {
			value: {
				setData(type: string, value: string) {
					stored[type] = value;
				},
			},
		});
		input.dispatchEvent(event);
		assert.equal(event.defaultPrevented, false);
		assert.equal(stored["text/plain"], undefined);
		assert.equal(written.text, "");
	});

	it("inline handler joins paragraphs when intersectsNode is broken (WebKit)", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(`
			<div class="ref-translation-view">
				<article class="interleaved-article md-content" aria-hidden="true">
					<p class="english-paragraph">hidden</p>
				</article>
				<div class="split-wrapper" aria-hidden="false">
					<article id="panel1" class="split-panel md-content">
						<p class="english-paragraph">paragraph one</p>
						<p class="english-paragraph">paragraph two</p>
					</article>
				</div>
			</div>
		`);
		const inlineSrc = readFileSync(
			path.join(
				path.dirname(fileURLToPath(import.meta.url)),
				"discoursePlainCopyInline.js",
			),
			"utf8",
		);
		(window as unknown as { eval: (code: string) => void }).eval(inlineSrc);

		const panel = document.querySelector("#panel1")!;
		const selection = window.getSelection();
		assert.ok(selection);
		selection.removeAllRanges();
		selection.addRange(selectAll(panel));

		const original = Range.prototype.intersectsNode;
		Range.prototype.intersectsNode = () => false;

		const stored: Record<string, string> = {};
		const event = new window.Event("copy", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "clipboardData", {
			value: {
				setData(type: string, value: string) {
					stored[type] = value;
				},
			},
		});
		try {
			document.dispatchEvent(event);
		} finally {
			Range.prototype.intersectsNode = original;
		}

		assert.equal(event.defaultPrevented, true);
		assert.equal(stored["text/plain"], "paragraph one\n\nparagraph two");
	});

	it("hides paragraph-num nodes via copying-discourse while sanitizing", () => {
		resetDiscoursePlainCopyForTests();
		const { document } = installDom(`<p id="1">x</p>`);

		beginCopySanitization();
		assert.equal(
			document.documentElement.classList.contains("copying-discourse"),
			true,
		);
		endCopySanitization();
		assert.equal(
			document.documentElement.classList.contains("copying-discourse"),
			false,
		);
	});

	it("replaces native copy of consecutive numbered paragraphs without pilcrows", () => {
		resetDiscoursePlainCopyForTests();
		const { document, window } = installDom(`
			<article class="md-content">
				<p class="english-paragraph" id="1" data-paragraph-number="1"><span class="paragraph-num" aria-hidden="true">¶ 1</span>At one time, the Blessed One was dwelling at Sāvatthi, in Jeta’s Grove, Anāthapiṇḍika’s Park.</p>
				<p class="english-paragraph" id="2" data-paragraph-number="2"><span class="paragraph-num" aria-hidden="true">¶ 2</span>Then, when the night had advanced, the young deity Rohitassa approached the Blessed One.</p>
			</article>
		`);
		installDiscoursePlainCopy();

		const article = document.querySelector(".md-content")!;
		const selection = window.getSelection();
		assert.ok(selection);
		selection.removeAllRanges();
		selection.addRange(selectAll(article));

		const nativeLike = selection.toString();
		assert.equal(nativeLike.includes("¶"), true, "jsdom toString includes marker text (native-like)");

		const stored: Record<string, string> = {};
		const event = new window.Event("copy", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "clipboardData", {
			value: {
				setData(type: string, value: string) {
					stored[type] = value;
				},
			},
		});
		document.dispatchEvent(event);

		assert.equal(event.defaultPrevented, true);
		assert.equal(
			stored["text/plain"],
			"At one time, the Blessed One was dwelling at Sāvatthi, in Jeta’s Grove, Anāthapiṇḍika’s Park.\n\nThen, when the night had advanced, the young deity Rohitassa approached the Blessed One.",
		);
		assert.equal(stored["text/plain"].includes("¶"), false);
		assert.equal(/\dThen/.test(stored["text/plain"]), false);
	});

	it("cloneContents never includes CSS ::before (why attempt-2 unit tests were green)", () => {
		const { document } = installDom(`
			<article class="md-content">
				<p class="english-paragraph" id="2" data-paragraph-number="2">Then, when the night had advanced</p>
			</article>
		`);
		const style = document.createElement("style");
		style.textContent = `p[id]::before { content: "¶ " attr(data-paragraph-number); }`;
		document.head.appendChild(style);

		const p = document.querySelector("p")!;
		const range = document.createRange();
		range.selectNodeContents(p);
		const cloned = range.cloneContents();
		assert.equal((cloned.textContent || "").includes("¶"), false);
		assert.equal(
			getPlainTextFromRange(range).includes("¶"),
			false,
		);
	});
});

describe("shouldSkipCopyElement", () => {
	it("skips aria-hidden and TM buttons", () => {
		const { document } = installDom(`
			<button class="tm-lookup-btn">TM</button>
			<span aria-hidden="true">¶ 3</span>
			<em>keep</em>
		`);
		assert.equal(
			shouldSkipCopyElement(document.querySelector(".tm-lookup-btn") as HTMLElement),
			true,
		);
		assert.equal(
			shouldSkipCopyElement(document.querySelector("[aria-hidden]") as HTMLElement),
			true,
		);
		assert.equal(
			shouldSkipCopyElement(document.querySelector("em") as HTMLElement),
			false,
		);
	});
});
