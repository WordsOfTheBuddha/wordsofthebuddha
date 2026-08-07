/**
 * Renders a content-image SVG to PNG slices and reports any <text> node whose
 * measured width overflows the 920-wide artboard rail, so layout can be checked
 * without eyeballing every card.
 *
 * Usage: node scripts/render-content-image.mjs <svg-path> [outDir] [sliceHeight]
 */
import { readFileSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { chromium } from "playwright";

const svgPath = resolve(process.argv[2]);
const outDir = resolve(process.argv[3] ?? ".plan/render");
const sliceHeight = Number(process.argv[4] ?? 1100);

const svg = readFileSync(svgPath, "utf8");
const viewBox = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
const width = Number(viewBox[1]);
const height = Number(viewBox[2]);

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
	viewport: { width, height: Math.min(height, 2000) },
	deviceScaleFactor: 1,
});
await page.setContent(
	`<html><body style="margin:0;background:#0b1528">${svg}</body></html>`,
	{ waitUntil: "load" },
);
await page.evaluate(() => document.fonts.ready);

const overflows = await page.evaluate(() => {
	const out = [];
	for (const node of document.querySelectorAll("text")) {
		const box = node.getBBox();
		const ctm = node.getScreenCTM();
		const scale = ctm ? ctm.a : 1;
		const abs = node.getBoundingClientRect();
		if (abs.left < 4 || abs.right > 916) {
			out.push({
				text: node.textContent.slice(0, 70),
				left: Math.round(abs.left),
				right: Math.round(abs.right),
				top: Math.round(abs.top),
				w: Math.round(box.width * scale),
			});
		}
	}
	return out;
});

const stem = basename(svgPath, ".svg");
const slices = Math.ceil(height / sliceHeight);
await page.setViewportSize({ width, height: sliceHeight });
for (let i = 0; i < slices; i++) {
	await page.evaluate((y) => window.scrollTo(0, y), i * sliceHeight);
	await page.screenshot({ path: `${outDir}/${stem}-${i + 1}.png` });
}

await browser.close();

console.log(`rendered ${slices} slice(s) of ${stem} (${width}×${height}) to ${outDir}`);
if (overflows.length) {
	console.log(`\n${overflows.length} text node(s) outside the 4…916 rail:`);
	for (const o of overflows) console.log(`  y=${o.top} [${o.left}…${o.right}] ${o.text}`);
} else {
	console.log("\nno text nodes outside the artboard rail");
}
