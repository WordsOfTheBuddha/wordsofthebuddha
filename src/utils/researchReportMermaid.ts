import { decodeHtmlEntities } from "./htmlEntities";
import { sanitizeResearchReportHtml } from "./researchReportSanitize";
import {
	enhanceResearchReportDiagrams,
	updateDiagramViewerSvg,
} from "./researchReportDiagramViewer";
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

let mermaidMod: MermaidApi | null = null;
let mermaidTheme = "";
let themeSyncInstalled = false;
let themeSyncRoot: ParentNode | null = null;

function unwrapMermaid(mod: MermaidModule): MermaidApi {
	return (mod.default ?? mod) as MermaidApi;
}

function isDev(): boolean {
	return typeof import.meta.env !== "undefined" && Boolean(import.meta.env.DEV);
}

function logMermaidIssue(phase: string, err?: unknown): void {
	if (isDev()) console.error(`[ai-mermaid] ${phase}`, err ?? "");
}

/**
 * Vite 8 wraps `import(variable)` with `__vite__injectQuery(url, "import")`.
 * That `?import` request 500s for files in `/public` ("should not be imported
 * from source"). Build `import()` at runtime so the vendor URL stays native.
 */
const importPublicEsm = new Function("u", "return import(u)") as (
	url: string,
) => Promise<MermaidModule>;

/**
 * Browser-side mermaid rendering for research reports.
 *
 * IMPORTANT (Vercel 250 MB serverless cap): this module is part of the SSR
 * bundle, so it must NEVER statically or dynamically import the npm
 * `mermaid` package (~140 MB). The browser loads the vendored ESM build from
 * `/vendor/mermaid/` (public, CDN), server PDF/EPUB export renders mermaid
 * inside Playwright (researchReportMermaidServer.ts), and Node-only baking
 * for tests lives in researchReportMermaidNode.ts.
 */
async function importMermaid(): Promise<MermaidApi> {
	if (typeof document === "undefined") {
		throw new Error(
			"mermaid vendor ESM is browser-only; on the server use hydratePlaywrightMermaid",
		);
	}
	const spec = "/vendor/" + "mermaid/mermaid.esm.min.mjs";
	try {
		return unwrapMermaid(await importPublicEsm(spec));
	} catch (err) {
		logMermaidIssue("vendor import failed", err);
		throw err;
	}
}

function mermaidInitConfig(theme: string): Record<string, unknown> {
	return {
		startOnLoad: false,
		securityLevel: "strict",
		suppressErrorRendering: true,
		theme,
		htmlLabels: true,
		flowchart: { htmlLabels: true },
	};
}

async function loadMermaid(dark: boolean): Promise<MermaidApi> {
	if (!mermaidMod) mermaidMod = await importMermaid();
	const theme = dark ? "dark" : "neutral";
	if (mermaidTheme !== theme) {
		mermaidMod.initialize(mermaidInitConfig(theme));
		mermaidTheme = theme;
	}
	return mermaidMod;
}

export async function mermaidSourceToSvg(
	source: string,
	dark = false,
): Promise<string> {
	if (typeof document === "undefined") return "";
	const text = normalizeMermaidSource(source).trim();
	if (!text) return "";
	const mermaid = await loadMermaid(dark);
	const id = `ai-mmd-${Math.random().toString(36).slice(2, 10)}`;
	try {
		await mermaid.parse(text);
		const { svg } = await mermaid.render(id, text);
		if (!svg || isMermaidErrorSvg(svg)) {
			logMermaidIssue("empty or error svg");
			return "";
		}
		return sanitizeResearchReportHtml(svg, { allowStyle: true });
	} catch (err) {
		logMermaidIssue("render failed", err);
		return "";
	} finally {
		removeMermaidTempElements(id);
	}
}

/**
 * Replace `<pre class="ai-report-mermaid">` listings with rendered diagrams.
 * The `renderSvg` callback keeps this helper free of any mermaid import so
 * both the browser (vendor ESM) and Node (npm package, tests only) can use it
 * without pulling mermaid into the serverless bundle.
 */
export async function replaceMermaidPlaceholders(
	html: string,
	renderSvg: (source: string) => Promise<string>,
): Promise<string> {
	const re = /<pre class="ai-report-mermaid"[^>]*>([\s\S]*?)<\/pre>/gi;
	const matches = [...html.matchAll(re)];
	if (matches.length === 0) return html;
	let out = html;
	for (const match of matches) {
		const source = decodeHtmlEntities(match[1] || "").trim();
		if (!source || !match[0]) continue;
		try {
			const svg = await renderSvg(source);
			if (!svg) continue;
			out = out.replace(
				match[0],
				`<div class="ai-report-diagram">${svg}</div>`,
			);
		} catch (err) {
			logMermaidIssue("placeholder replace failed", err);
		}
	}
	return out;
}

export async function replaceMermaidPlaceholdersWithSvg(
	html: string,
	dark = false,
): Promise<string> {
	if (typeof document === "undefined") return html;
	return replaceMermaidPlaceholders(html, (source) =>
		mermaidSourceToSvg(source, dark),
	);
}

function mermaidDark(): boolean {
	return (
		typeof document !== "undefined" &&
		document.documentElement.classList.contains("dark")
	);
}

function stampMermaidSource(diagram: HTMLElement, source: string): void {
	if (!source) return;
	diagram.dataset.aiMermaidSource = source;
}

export function installResearchReportMermaidThemeSync(
	root: ParentNode,
): void {
	themeSyncRoot = root;
	if (themeSyncInstalled || typeof document === "undefined") return;
	themeSyncInstalled = true;
	let lastDark = mermaidDark();
	const observer = new MutationObserver(() => {
		const dark = mermaidDark();
		if (dark === lastDark) return;
		lastDark = dark;
		const target = themeSyncRoot || document;
		void rethemeResearchReportMermaid(target);
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
}

export async function rethemeResearchReportMermaid(
	root: ParentNode,
): Promise<void> {
	if (typeof document === "undefined") return;
	const dark = mermaidDark();
	for (const diagram of root.querySelectorAll<HTMLElement>(
		".ai-report-diagram[data-ai-mermaid-source]",
	)) {
		const source = diagram.dataset.aiMermaidSource || "";
		if (!source) continue;
		try {
			const svgMarkup = await mermaidSourceToSvg(source, dark);
			if (!svgMarkup) continue;
			const tmp = document.createElement("div");
			tmp.innerHTML = svgMarkup;
			const svg = tmp.querySelector("svg");
			if (!svg) continue;
			updateDiagramViewerSvg(diagram, svg);
		} catch (err) {
			logMermaidIssue("retheme failed", err);
		}
	}
}

export async function hydrateResearchReportMermaid(
	root: ParentNode,
): Promise<void> {
	installResearchReportMermaidThemeSync(root);
	if (typeof document === "undefined") return;
	const nodes = [
		...root.querySelectorAll<HTMLElement>(
			"[data-ai-mermaid]:not([data-ai-mermaid-done])",
		),
	];
	if (nodes.length === 0) return;
	const dark = mermaidDark();
	for (const node of nodes) {
		node.setAttribute("data-ai-mermaid-done", "1");
		const source = (node.textContent || "").trim();
		if (!source) continue;
		try {
			const svg = await mermaidSourceToSvg(source, dark);
			if (!svg) {
				node.setAttribute("data-ai-mermaid-done", "error");
				continue;
			}
			const wrap = document.createElement("div");
			wrap.className = "ai-report-diagram";
			stampMermaidSource(wrap, source);
			if (node.dataset.reportBlockIdx) {
				wrap.dataset.reportBlockIdx = node.dataset.reportBlockIdx;
			}
			if (node.dataset.reportBlockKey) {
				wrap.dataset.reportBlockKey = node.dataset.reportBlockKey;
			}
			if (node.dataset.reportBlockId) {
				wrap.dataset.reportBlockId = node.dataset.reportBlockId;
			}
			wrap.innerHTML = svg;
			node.replaceWith(wrap);
		} catch (err) {
			logMermaidIssue("hydrate failed", err);
			node.setAttribute("data-ai-mermaid-done", "error");
		}
	}
	enhanceResearchReportDiagrams(root);
}
