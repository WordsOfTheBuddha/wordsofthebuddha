/**
 * One-off utility: normalize standalone design-system icons to a canonical square
 * viewBox with uniform scale and centered content.
 *
 * Bounding boxes come from **@resvg/resvg-js** `getBBox()` (paint-aware, includes
 * stroke). Content is fitted into [0, canvas]² with `--fill` as the max fraction
 * of the canvas used by the axis-aligned bounds.
 *
 * Usage:
 *   npx tsx src/utils/normalizeDesignSystemIcons.ts --files icons/mn1-brahma.svg,icons/mn1-ariya-header.svg
 *   npx tsx src/utils/normalizeDesignSystemIcons.ts --glob "icons/*.svg"
 *
 * Paths are relative to src/assets/content-images/design-system/ unless absolute.
 *
 * Options:
 *   --canvas N     Output viewBox 0 0 N N (default 24)
 *   --fill F       Max axis fit: scale so max(w,h) <= F * canvas (default 0.88)
 *   --dry-run      Log bbox + scale only; do not write files
 *   --out-dir DIR  Write under DIR preserving relative path (default: overwrite input)
 *
 * Re-running strips a single outer `<g transform="…">` from a previous pass
 * (same pattern this script writes), then re-fits—so it is **idempotent** aside
 * from float rounding.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { glob } from "glob";
import { Resvg } from "@resvg/resvg-js";

const DS_ROOT = resolve(
	process.cwd(),
	"src/assets/content-images/design-system",
);

type BBox = { minX: number; minY: number; maxX: number; maxY: number };

function extractSvgInner(xml: string): string {
	const m = xml.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
	return m ? m[1].trim() : xml.trim();
}

/** If this script already wrapped content in a single outer `<g transform="…">`, unwrap so re-runs are idempotent. */
function unwrapOuterTransformGroup(inner: string): string {
	const t = inner.trim();
	const m = t.match(/^<g\s+transform="[^"]*"[^>]*>([\s\S]*)<\/g>\s*$/i);
	return m ? m[1].trim() : inner;
}

function contentForNormalize(xml: string): string {
	return unwrapOuterTransformGroup(extractSvgInner(xml));
}

function parseArgs(argv: string[]) {
	const out: {
		files: string[];
		globs: string[];
		canvas: number;
		fill: number;
		dryRun: boolean;
		outDir: string | null;
	} = { files: [], globs: [], canvas: 24, fill: 0.88, dryRun: false, outDir: null };

	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--dry-run") out.dryRun = true;
		else if (a === "--files" && argv[i + 1]) {
			out.files.push(
				...argv[++i]
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
			);
		} else if (a === "--glob" && argv[i + 1]) out.globs.push(argv[++i]);
		else if (a === "--canvas" && argv[i + 1]) out.canvas = Number(argv[++i]);
		else if (a === "--fill" && argv[i + 1]) out.fill = Number(argv[++i]);
		else if (a === "--out-dir" && argv[i + 1]) out.outDir = argv[++i];
	}
	return out;
}

/** Large scratch viewBox so negative / wide coordinates still measure. */
function wrapForMeasure(inner: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-500 -500 4000 4000" width="4000" height="4000">${inner}</svg>`;
}

function measureWithResvg(inner: string): BBox {
	const svg = wrapForMeasure(inner);
	const resvg = new Resvg(svg, { fitTo: { mode: "original" } });
	const b = resvg.getBBox();
	if (!b || b.width <= 0 || b.height <= 0) {
		throw new Error("Resvg getBBox() failed or empty artwork");
	}
	return {
		minX: b.x,
		minY: b.y,
		maxX: b.x + b.width,
		maxY: b.y + b.height,
	};
}

function buildNormalizedSvg(
	inner: string,
	bbox: BBox,
	canvas: number,
	fill: number,
): string {
	const w = bbox.maxX - bbox.minX;
	const h = bbox.maxY - bbox.minY;
	if (w <= 0 || h <= 0) throw new Error("Degenerate bbox");

	const cx = (bbox.minX + bbox.maxX) / 2;
	const cy = (bbox.minY + bbox.maxY) / 2;
	const s = fill * Math.min(canvas / w, canvas / h);

	const tx = canvas / 2;
	const ty = canvas / 2;

	const r = (n: number, d: number) => Number(n.toFixed(d));
	const transform = `translate(${r(tx, 4)}, ${r(ty, 4)}) scale(${r(s, 5)}) translate(${r(-cx, 4)}, ${r(-cy, 4)})`;

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}">
  <g transform="${transform}">
${inner
	.split("\n")
	.map((line) => "    " + line)
	.join("\n")}
  </g>
</svg>
`;
}

function resolveInputPath(p: string): string {
	if (p.startsWith("/")) return p;
	const rel = p.replace(/^\//, "");
	return resolve(DS_ROOT, rel);
}

async function main() {
	const args = parseArgs(process.argv);
	let paths: string[] = [...args.files.map(resolveInputPath)];

	for (const g of args.globs) {
		const pattern = resolve(DS_ROOT, g.replace(/^\//, ""));
		const found = await glob(pattern, { windowsPathsNoEscape: true });
		paths.push(...found);
	}

	paths = [...new Set(paths)].filter((p) => existsSync(p));
	if (paths.length === 0) {
		console.error(
			"No input files. Example:\n  npx tsx src/utils/normalizeDesignSystemIcons.ts --glob \"icons/*.svg\" --dry-run",
		);
		process.exit(1);
	}

	for (const abs of paths.sort()) {
		const xml = readFileSync(abs, "utf8");
		const inner = contentForNormalize(xml);
		const bbox = measureWithResvg(inner);
		const w = bbox.maxX - bbox.minX;
		const h = bbox.maxY - bbox.minY;
		const cx = (bbox.minX + bbox.maxX) / 2;
		const cy = (bbox.minY + bbox.maxY) / 2;
		const s = args.fill * Math.min(args.canvas / w, args.canvas / h);

		const rel = relative(DS_ROOT, abs);
		console.log(rel);
		console.log(
			`  bbox: ${bbox.minX.toFixed(3)} ${bbox.minY.toFixed(3)} … ${bbox.maxX.toFixed(3)} ${bbox.maxY.toFixed(3)} (w=${w.toFixed(3)} h=${h.toFixed(3)})`,
		);
		console.log(
			`  center: (${cx.toFixed(3)}, ${cy.toFixed(3)})  scale: ${s.toFixed(4)}`,
		);

		if (args.dryRun) continue;

		const out = buildNormalizedSvg(inner, bbox, args.canvas, args.fill);
		const target =
			args.outDir != null
				? resolve(process.cwd(), args.outDir, rel)
				: abs;
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, out, "utf8");
		console.log(
			`  wrote ${args.outDir ? relative(process.cwd(), target) : rel}`,
		);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
