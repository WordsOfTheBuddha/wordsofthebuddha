/**
 * Node-only mermaid baking (jsdom + the npm `mermaid` package).
 *
 * NEVER import this module from SSR routes or anything they can reach: the
 * `import("mermaid")` below would drag the ~140 MB package into Vercel's
 * `_render` serverless function (250 MB uncompressed cap) and fail the
 * production build. Server exports render mermaid inside Playwright instead
 * (see researchReportMermaidServer.ts); the browser uses the vendored ESM
 * build (see researchReportMermaid.ts).
 *
 * This module exists for `tsx --test` and build-time scripts, which run in
 * plain Node where the import is harmless.
 */
import { sanitizeResearchReportHtml } from "./researchReportSanitize";
import { replaceMermaidPlaceholders } from "./researchReportMermaid";
import {
	isMermaidErrorSvg,
	normalizeMermaidSource,
	removeMermaidTempElements,
} from "./researchReportMermaidNormalize";

type MermaidApi = {
	initialize: (config: Record<string, unknown>) => void;
	parse: (text: string) => Promise<unknown>;
	render: (id: string, text: string) => Promise<{ svg: string }>;
};

type MermaidModule = { default?: MermaidApi } & MermaidApi;

let domReady = false;

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

async function nodeMermaidSourceToSvg(
	source: string,
	dark = false,
): Promise<string> {
	const text = normalizeMermaidSource(source).trim();
	if (!text) return "";
	const mod = (await import("mermaid")) as MermaidModule;
	const mermaid: MermaidApi = (mod.default ?? mod) as MermaidApi;
	mermaid.initialize({
		startOnLoad: false,
		// mermaid 12's DOMPurify interop throws `addHook is not a function` in
		// jsdom. The SVG still passes through sanitizeResearchReportHtml.
		securityLevel: "loose",
		suppressErrorRendering: true,
		theme: dark ? "dark" : "neutral",
		htmlLabels: true,
		flowchart: { htmlLabels: true },
	});
	const id = `ai-mmd-${Math.random().toString(36).slice(2, 10)}`;
	try {
		await mermaid.parse(text);
		const { svg } = await mermaid.render(id, text);
		if (!svg || isMermaidErrorSvg(svg)) return "";
		return sanitizeResearchReportHtml(svg, { allowStyle: true });
	} catch {
		return "";
	} finally {
		removeMermaidTempElements(id);
	}
}

/** Node/PDF/EPUB tests and build scripts: mermaid.render needs a document. */
export async function bakeResearchReportMermaid(
	html: string,
	dark = false,
): Promise<string> {
	if (!html.includes("ai-report-mermaid")) return html;
	await ensureMermaidDom();
	return replaceMermaidPlaceholders(html, (source) =>
		nodeMermaidSourceToSvg(source, dark),
	);
}
