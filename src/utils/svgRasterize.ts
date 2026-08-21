/**
 * Rasterize discourse SVGs at their authored pixel size.
 *
 * CloudConvert's SVG → WEBP path works because it (1) uses the SVG's own
 * width/height and (2) uses a full SVG engine (filters, gradient opacity,
 * line art). @resvg/resvg-js misses glow / low-opacity backdrops. Chromium
 * matches that quality; we encode PNG (lossless, EPUB/Kobo-safe) instead of
 * WEBP so e-readers that reject WebP still show the diagram.
 */

import type { Page } from "playwright-core";

export type SvgPixelSize = { width: number; height: number };

/** Same modes as the site / PDF discourse viz switcher, plus EPUB e-ink paper. */
export type SvgVizRasterMode = "light" | "dark" | "thermal" | "eink";

/** Warm off-white used under the e-ink raster (not harsh printer white). */
export const EINK_PAPER = "#f4f1ea";

const DEFAULT_SIZE: SvgPixelSize = { width: 920, height: 920 };
const MAX_EDGE = 16384;

function parsePxAttr(openTag: string, name: string): number | undefined {
	const m = openTag.match(
		new RegExp(`\\b${name}\\s*=\\s*["']([\\d.]+)\\s*(?:px)?["']`, "i"),
	);
	if (!m) return undefined;
	const n = Number(m[1]);
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseViewBoxSize(openTag: string): SvgPixelSize | undefined {
	const vb = openTag.match(
		/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i,
	);
	if (!vb) return undefined;
	const width = Number(vb[1]);
	const height = Number(vb[2]);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return undefined;
	}
	return { width, height };
}

function rootSvgOpenTag(svg: string): string {
	return svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
}

/**
 * Prefer the root SVG's width/height (CloudConvert), then viewBox.
 * Percentage sizes are ignored so we do not emit a 100×100 raster.
 */
export function parseSvgPixelSize(svg: string): SvgPixelSize {
	const open = rootSvgOpenTag(svg);
	const width = parsePxAttr(open, "width");
	const height = parsePxAttr(open, "height");
	const vb = parseViewBoxSize(open);
	if (width && height) return { width, height };
	if (width && vb) {
		return { width, height: width * (vb.height / vb.width) };
	}
	if (height && vb) {
		return { width: height * (vb.width / vb.height), height };
	}
	if (vb) return vb;
	return DEFAULT_SIZE;
}

export function stripXmlDeclaration(svg: string): string {
	return svg.replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, "");
}

/** Ensure xmlns + XML declaration for native SVG parsers such as resvg. */
export function ensureSvgMarkup(svg: string): string {
	let out = svg.trim();
	if (!/xmlns=/.test(out)) {
		out = out.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
	}
	if (!/^<\?xml/i.test(out)) {
		out = `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;
	}
	return out;
}

/** Write explicit CSS-pixel width/height on the root <svg>. */
export function ensureSvgHasPixelSize(
	svg: string,
	width: number,
	height: number,
): string {
	const w = String(Math.max(1, Math.round(width)));
	const h = String(Math.max(1, Math.round(height)));
	let replaced = false;
	const next = svg.replace(/<svg\b[^>]*>/i, (tag) => {
		replaced = true;
		const without = tag
			.replace(/\s+width\s*=\s*["'][^"']*["']/i, "")
			.replace(/\s+height\s*=\s*["'][^"']*["']/i, "");
		return without.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`);
	});
	return replaced ? next : svg;
}

const INVERT = `<feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" result="inv"/>`;

function contrastTransfer(
	input: string,
	slope: number,
	intercept: number,
	result?: string,
): string {
	const resultAttr = result ? ` result="${result}"` : "";
	return `<feComponentTransfer in="${input}"${resultAttr}>
      <feFuncR type="linear" slope="${slope}" intercept="${intercept}"/>
      <feFuncG type="linear" slope="${slope}" intercept="${intercept}"/>
      <feFuncB type="linear" slope="${slope}" intercept="${intercept}"/>
    </feComponentTransfer>`;
}

function vizFilterPrimitives(mode: Exclude<SvgVizRasterMode, "dark">): string {
	if (mode === "thermal") {
		return `${INVERT}
    <feColorMatrix in="inv" type="saturate" values="0" result="gray"/>
    ${contrastTransfer("gray", 1.368, -0.114)}`;
	}
	if (mode === "eink") {
		// invert + grayscale + contrast(1.2), no thermal brightness lift.
		// Last matrix tints whites toward EINK_PAPER so the page is warm, not harsh.
		return `${INVERT}
    <feColorMatrix in="inv" type="saturate" values="0" result="gray"/>
    ${contrastTransfer("gray", 1.2, -0.1, "punch")}
    <feColorMatrix in="punch" type="matrix" values="0.957 0 0 0 0  0 0.945 0 0 0  0 0 0.918 0 0  0 0 0 1 0"/>`;
	}
	return `${INVERT}
    <feColorMatrix in="inv" type="hueRotate" values="180" result="hue"/>
    <feColorMatrix in="hue" type="saturate" values="0.88" result="sat"/>
    ${contrastTransfer("sat", 1.06, -0.03)}`;
}

export function rasterPageBackground(
	mode: SvgVizRasterMode,
): string | undefined {
	if (mode === "dark") return undefined;
	if (mode === "eink") return EINK_PAPER;
	return "#ffffff";
}

/**
 * Bake light / thermal / e-ink into the SVG so Chromium and resvg both honor
 * the mode. CSS filters on a root <svg> are easy to miss in screenshots.
 */
export function wrapSvgForVizMode(
	svg: string,
	mode: SvgVizRasterMode,
): string {
	if (mode === "dark") return svg;
	const id = `epub-viz-${mode}`;
	const primitives = vizFilterPrimitives(mode);
	const { width, height } = parseSvgPixelSize(svg);
	const defs = `<defs><filter id="${id}" x="0" y="0" width="${width}" height="${height}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${primitives}</filter></defs>`;
	const stripped = stripXmlDeclaration(svg).trim();
	const opened = stripped.replace(
		/<svg\b[^>]*>/i,
		(tag) => `${tag}${defs}<g filter="url(#${id})">`,
	);
	if (opened === stripped) return svg;
	return opened.replace(/<\/svg>\s*$/i, "</g></svg>");
}

export function htmlForSvgRaster(
	svg: string,
	width: number,
	height: number,
	vizMode: SvgVizRasterMode = "dark",
): string {
	const w = Math.max(1, Math.round(width));
	const h = Math.max(1, Math.round(height));
	const markup = stripXmlDeclaration(
		wrapSvgForVizMode(ensureSvgHasPixelSize(svg, w, h), vizMode),
	).trim();
	const pageBg = rasterPageBackground(vizMode) ?? "transparent";
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: ${w}px;
    height: ${h}px;
    background: ${pageBg};
  }
  body > svg {
    display: block;
    width: ${w}px;
    height: ${h}px;
  }
</style>
</head>
<body>${markup}</body>
</html>`;
}

function clampSize(size: SvgPixelSize): SvgPixelSize {
	let { width, height } = size;
	const long = Math.max(width, height);
	if (long > MAX_EDGE) {
		const scale = MAX_EDGE / long;
		width *= scale;
		height *= scale;
	}
	return {
		width: Math.max(1, Math.round(width)),
		height: Math.max(1, Math.round(height)),
	};
}

/**
 * Screenshot the SVG in Chromium at its authored pixel size.
 * Preserves feGaussianBlur glows, gradient stop-opacity, and line art.
 */
export async function rasterizeSvgOnPage(
	page: Page,
	svg: string,
	options?: { vizMode?: SvgVizRasterMode },
): Promise<Buffer> {
	const vizMode = options?.vizMode ?? "dark";
	const size = clampSize(parseSvgPixelSize(svg));
	await page.setViewportSize({ width: size.width, height: size.height });
	await page.setContent(
		htmlForSvgRaster(svg, size.width, size.height, vizMode),
		{
			waitUntil: "domcontentloaded",
			timeout: 20_000,
		},
	);
	const loc = page.locator("body > svg").first();
	if ((await loc.count()) === 0) {
		throw new Error("SVG did not render");
	}
	return page.screenshot({
		type: "png",
		animations: "disabled",
		omitBackground: vizMode === "dark",
	});
}

/** resvg fallback when Chromium is not available (tests / launch failure). */
export async function rasterizeSvgWithResvg(
	svg: string,
	options?: { vizMode?: SvgVizRasterMode },
): Promise<Buffer> {
	const vizMode = options?.vizMode ?? "dark";
	const size = clampSize(parseSvgPixelSize(svg));
	const prepared = ensureSvgMarkup(
		wrapSvgForVizMode(
			ensureSvgHasPixelSize(svg, size.width, size.height),
			vizMode,
		),
	);
	const { Resvg } = await import("@resvg/resvg-js");
	const resvg = new Resvg(prepared, {
		fitTo: { mode: "original" },
		font: { loadSystemFonts: true },
		shapeRendering: 2,
		textRendering: 1,
		background: rasterPageBackground(vizMode),
	});
	return Buffer.from(resvg.render().asPng());
}
