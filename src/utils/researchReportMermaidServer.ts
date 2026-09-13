import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { replaceMermaidPlaceholdersWithSvg } from "./researchReportMermaid";

let domReady = false;

async function ensureMermaidDom(): Promise<void> {
	if (typeof document !== "undefined" || domReady) return;
	const { JSDOM } = await import("jsdom");
	const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
		pretendToBeVisual: true,
		url: "https://www.wordsofthebuddha.org/",
	});
	const win = dom.window;
	assignGlobal("window", win);
	assignGlobal("document", win.document);
	assignGlobal("DOMParser", win.DOMParser);
	assignGlobal("XMLSerializer", win.XMLSerializer);
	assignGlobal("getComputedStyle", win.getComputedStyle.bind(win));
	assignGlobal("HTMLElement", win.HTMLElement);
	assignGlobal("SVGElement", win.SVGElement);
	assignGlobal("Element", win.Element);
	assignGlobal("Node", win.Node);
	assignGlobal("DocumentFragment", win.DocumentFragment);
	assignGlobal("MutationObserver", win.MutationObserver);
	assignGlobal("navigator", win.navigator);
	assignGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
		win.setTimeout(() => cb(Date.now()), 16),
	);
	assignGlobal("CSSStyleSheet", nodeCssStyleSheetPolyfill());
	installSvgMeasurePolyfills(win);
	domReady = true;
}

function installSvgMeasurePolyfills(win: {
	Element?: { prototype: object };
	SVGElement?: { prototype: object };
}): void {
	const measure = function (this: Element) {
		const tag = this.tagName?.toLowerCase() || "";
		const text = (this.textContent || "").replace(/\s+/g, " ").trim();
		const fontSize =
			Number.parseFloat(this.getAttribute("font-size") || "") || 16;
		if (tag === "text" || tag === "tspan") {
			const width = Math.max(8, text.length * fontSize * 0.62);
			const height = fontSize * 1.25;
			return svgBox(0, -fontSize, width, height);
		}
		const attrW = Number.parseFloat(this.getAttribute("width") || "");
		const attrH = Number.parseFloat(this.getAttribute("height") || "");
		if (attrW || attrH) {
			return svgBox(0, 0, attrW || 40, attrH || 24);
		}
		const width = Math.max(48, text.length * 7.2);
		return svgBox(0, 0, width, 36);
	};
	for (const Ctor of [win.SVGElement, win.Element]) {
		if (!Ctor?.prototype) continue;
		Object.defineProperty(Ctor.prototype, "getBBox", {
			configurable: true,
			writable: true,
			value: measure,
		});
		Object.defineProperty(Ctor.prototype, "getComputedTextLength", {
			configurable: true,
			writable: true,
			value: function (this: Element) {
				return Math.max(8, (this.textContent || "").length * 8);
			},
		});
	}
}

function svgBox(
	x: number,
	y: number,
	width: number,
	height: number,
): DOMRect {
	return {
		x,
		y,
		width,
		height,
		top: y,
		left: x,
		bottom: y + height,
		right: x + width,
		toJSON() {
			return this;
		},
	} as DOMRect;
}

function nodeCssStyleSheetPolyfill(): typeof CSSStyleSheet {
	class CssStyleSheetPolyfill {
		cssRules: { cssText: string }[] = [];
		insertRule(rule: string, index = this.cssRules.length): number {
			this.cssRules.splice(index, 0, { cssText: rule });
			return index;
		}
		deleteRule(index: number): void {
			this.cssRules.splice(index, 1);
		}
		replaceSync(css: string): void {
			this.cssRules = css.trim() ? [{ cssText: css }] : [];
		}
	}
	return CssStyleSheetPolyfill as unknown as typeof CSSStyleSheet;
}

function assignGlobal(name: string, value: unknown): void {
	try {
		(globalThis as Record<string, unknown>)[name] = value;
	} catch {
		Object.defineProperty(globalThis, name, {
			configurable: true,
			writable: true,
			value,
		});
	}
}

export function mermaidUmdPath(): string | null {
	try {
		const require = createRequire(import.meta.url);
		const dir = dirname(require.resolve("mermaid/package.json"));
		for (const rel of ["dist/mermaid.min.js", "dist/mermaid.js"]) {
			const abs = join(dir, rel);
			if (existsSync(abs)) return abs;
		}
	} catch {
		/* mermaid not installed or no UMD build */
	}
	return null;
}

/** Node/PDF/EPUB: mermaid.render needs a document. */
export async function bakeResearchReportMermaid(
	html: string,
	dark = false,
): Promise<string> {
	if (!html.includes("ai-report-mermaid")) return html;
	await ensureMermaidDom();
	return replaceMermaidPlaceholdersWithSvg(html, dark);
}

type PlaywrightLikePage = {
	evaluate<T>(pageFunction: () => T | Promise<T>): Promise<T>;
	addScriptTag(options: { path: string }): Promise<unknown>;
};

/** After Playwright setContent: draw any mermaid listings Node could not bake. */
export async function hydratePlaywrightMermaid(
	page: PlaywrightLikePage,
): Promise<void> {
	const leftover = await page.evaluate(
		() => document.querySelectorAll("[data-ai-mermaid]").length,
	);
	if (!leftover) return;
	const bundle = mermaidUmdPath();
	if (!bundle) return;
	await page.addScriptTag({ path: bundle });
	await page.evaluate(async () => {
		const mermaid = (
			globalThis as unknown as {
				mermaid?: {
					initialize: (config: Record<string, unknown>) => void;
					render: (
						id: string,
						text: string,
					) => Promise<{ svg: string }>;
				};
			}
		).mermaid;
		if (!mermaid) return;
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			theme: "neutral",
			flowchart: { htmlLabels: false },
		});
		for (const node of [
			...document.querySelectorAll("[data-ai-mermaid]"),
		]) {
			const source = (node.textContent || "").trim();
			if (!source) continue;
			try {
				const id = `pdf-mmd-${Math.random().toString(36).slice(2, 10)}`;
				const { svg } = await mermaid.render(id, source);
				const wrap = document.createElement("div");
				wrap.className = "ai-report-diagram";
				wrap.innerHTML = svg;
				node.replaceWith(wrap);
			} catch {
				/* keep the listing */
			}
		}
	});
}
