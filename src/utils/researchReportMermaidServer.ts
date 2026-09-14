/**
 * Server-side mermaid rendering for PDF/EPUB export.
 *
 * Diagrams render inside headless Chromium (Playwright), never in Node:
 * importing the npm `mermaid` package here would drag ~140 MB into Vercel's
 * `_render` serverless function (250 MB cap) and fail the production build.
 * The UMD bundle is vendored at `public/vendor/mermaid/mermaid.min.js`
 * (copied by `scripts/copy-mermaid-vendor.mjs`, shipped to serverless via
 * the adapter's `includeFiles`), so this module only references that path —
 * never `node_modules/mermaid`, which the file tracer must not follow.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { sanitizeResearchReportHtml } from "./researchReportSanitize";
import {
	isMermaidErrorSvg,
	normalizeMermaidSource,
} from "./researchReportMermaidNormalize";

type PlaywrightLikePage = {
	evaluate<T>(pageFunction: () => T | Promise<T>): Promise<T>;
	addScriptTag(options: {
		path?: string;
		content?: string;
	}): Promise<unknown>;
	setContent(
		html: string,
		options?: { waitUntil?: string; timeout?: number },
	): Promise<void>;
};

/** Vendored UMD build — present locally (prebuild) and in serverless (includeFiles). */
export function mermaidUmdPath(): string | null {
	const abs = join(
		process.cwd(),
		"public",
		"vendor",
		"mermaid",
		"mermaid.min.js",
	);
	return existsSync(abs) ? abs : null;
}

/**
 * Load the UMD bundle into the page when mermaid listings remain.
 * Returns false when there is nothing to draw or no bundle on disk.
 */
async function ensureMermaidInPage(
	page: PlaywrightLikePage,
): Promise<boolean> {
	const leftover = await page.evaluate(
		() => document.querySelectorAll("[data-ai-mermaid]").length,
	);
	if (!leftover) return false;
	const bundle = mermaidUmdPath();
	if (!bundle) return false;
	await page.addScriptTag({ path: bundle });
	await page.addScriptTag({
		content: `globalThis.__normalizeMermaidSource = ${normalizeMermaidSource.toString()};
globalThis.__isMermaidErrorSvg = ${isMermaidErrorSvg.toString()};`,
	});
	return true;
}

/** After Playwright setContent: draw any mermaid listings in place. */
export async function hydratePlaywrightMermaid(
	page: PlaywrightLikePage,
): Promise<void> {
	if (!(await ensureMermaidInPage(page))) return;
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
			suppressErrorRendering: true,
			theme: "neutral",
			htmlLabels: true,
			flowchart: { htmlLabels: true },
		});
		const normalize = (globalThis as unknown as {
			__normalizeMermaidSource?: (source: string) => string;
		}).__normalizeMermaidSource;
		const isErrorSvg = (globalThis as unknown as {
			__isMermaidErrorSvg?: (svg: string) => boolean;
		}).__isMermaidErrorSvg;
		for (const node of [
			...document.querySelectorAll("[data-ai-mermaid]"),
		]) {
			const source = (
				normalize ? normalize(node.textContent || "") : node.textContent || ""
			).trim();
			if (!source) continue;
			try {
				const id = `pdf-mmd-${Math.random().toString(36).slice(2, 10)}`;
				const { svg } = await mermaid.render(id, source);
				if (!svg || isErrorSvg?.(svg)) continue;
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

const MERMAID_PRE_RE =
	/<pre class="ai-report-mermaid"[^>]*>[\s\S]*?<\/pre>/gi;

/**
 * EPUB path: render each mermaid listing in the page, then splice the
 * sanitized SVGs back over the `<pre>` blocks in document order. Unrenderable
 * sources keep their listing (same fallback as a failed Node bake).
 */
export async function hydrateMermaidHtml(
	page: PlaywrightLikePage,
	html: string,
): Promise<string> {
	if (!html.includes("ai-report-mermaid")) return html;
	await page.setContent(html, {
		waitUntil: "domcontentloaded",
		timeout: 20_000,
	});
	if (!(await ensureMermaidInPage(page))) return html;
	const svgs = await page.evaluate(async () => {
		const out: string[] = [];
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
		if (!mermaid) return out;
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			suppressErrorRendering: true,
			theme: "neutral",
			htmlLabels: true,
			flowchart: { htmlLabels: true },
		});
		const normalize = (globalThis as unknown as {
			__normalizeMermaidSource?: (source: string) => string;
		}).__normalizeMermaidSource;
		const isErrorSvg = (globalThis as unknown as {
			__isMermaidErrorSvg?: (svg: string) => boolean;
		}).__isMermaidErrorSvg;
		for (const node of [
			...document.querySelectorAll("[data-ai-mermaid]"),
		]) {
			const source = (
				normalize ? normalize(node.textContent || "") : node.textContent || ""
			).trim();
			if (!source) {
				out.push("");
				continue;
			}
			try {
				const id = `epub-mmd-${Math.random().toString(36).slice(2, 10)}`;
				const { svg } = await mermaid.render(id, source);
				out.push(!svg || isErrorSvg?.(svg) ? "" : svg);
			} catch {
				out.push("");
			}
		}
		return out;
	});
	if (svgs.length === 0) return html;
	let index = 0;
	return html.replace(MERMAID_PRE_RE, (block) => {
		const svg = svgs[index++];
		if (!svg || isMermaidErrorSvg(svg)) return block;
		return `<div class="ai-report-diagram">${sanitizeResearchReportHtml(svg, { allowStyle: true })}</div>`;
	});
}
