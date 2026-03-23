/**
 * Scan all .svg files under src/assets/content-images/ (non-recursive).
 *
 * Helps spot shared palette families (background blues, gold accents, etc.)
 * so you can design a build-time hex map or author light variants consistently.
 *
 * Usage: npx tsx src/utils/analyzeContentImageSvgColors.ts
 * Output: table to stdout + optional JSON path via --json <file>
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "content-images");

type Hex = string;

function expandShortHex(h: string): Hex | null {
  const s = h.replace(/^#/, "").toLowerCase();
  if (s.length === 3) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  if (s.length === 6 || s.length === 8) {
    return `#${s}`;
  }
  return null;
}

function hexToRgb(hex: Hex): { r: number; g: number; b: number } | null {
  const e = expandShortHex(hex);
  if (!e) return null;
  const s = e.slice(1);
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hueBucket(h: number): string {
  if (Number.isNaN(h)) return "gray";
  const x = ((h % 360) + 360) % 360;
  if (x < 15 || x >= 345) return "red";
  if (x < 45) return "orange";
  if (x < 75) return "yellow";
  if (x < 150) return "green";
  if (x < 210) return "cyan";
  if (x < 270) return "blue";
  if (x < 300) return "purple";
  return "magenta";
}

/** Extract #RGB / #RRGGBB / #RRGGBBAA from file (SVG source). */
function extractHexColors(svg: string): Hex[] {
  const out: Hex[] = [];
  const re = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const full = expandShortHex(`#${m[1]}`);
    if (full && full.length === 7) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  let jsonOut: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--json" && args[i + 1]) {
      jsonOut = args[++i];
    }
  }

  let files: string[];
  try {
    files = readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith(".svg"));
  } catch (e) {
    console.error("Could not read", ROOT, e);
    process.exit(1);
  }

  const globalCount = new Map<Hex, number>();
  const perFile = new Map<string, Map<Hex, number>>();

  for (const f of files.sort()) {
    const path = join(ROOT, f);
    const svg = readFileSync(path, "utf8");
    const hexes = extractHexColors(svg);
    const local = new Map<Hex, number>();
    for (const h of hexes) {
      globalCount.set(h, (globalCount.get(h) ?? 0) + 1);
      local.set(h, (local.get(h) ?? 0) + 1);
    }
    perFile.set(f, local);
  }

  const sorted = [...globalCount.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`Scanned ${files.length} SVGs under ${ROOT}\n`);
  console.log("Top colors (hex) by total occurrence across all files:\n");
  console.log(" count  hex       hue-bucket  approx HSL");
  for (const [hex, n] of sorted.slice(0, 40)) {
    const rgb = hexToRgb(hex);
    const hsl = rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
    const hb = hsl ? hueBucket(hsl.h) : "?";
    const hslStr = hsl
      ? `${Math.round(hsl.h)}° s=${(hsl.s * 100).toFixed(0)}% l=${(hsl.l * 100).toFixed(0)}%`
      : "";
    console.log(`${String(n).padStart(6)}  ${hex}  ${hb.padEnd(10)} ${hslStr}`);
  }

  // Bucket aggregate: sum occurrences per hue bucket
  const bucketOcc = new Map<string, number>();
  for (const [hex, n] of globalCount) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    const { h } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const b = hueBucket(h);
    bucketOcc.set(b, (bucketOcc.get(b) ?? 0) + n);
  }
  console.log("\nOccurrences summed by rough hue family (all hex tokens):\n");
  for (const [b, n] of [...bucketOcc.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${b.padEnd(10)} ${n}`);
  }

  console.log("\n--- Per-file unique color count (lower → more reuse of shared palette) ---\n");
  for (const f of files.sort()) {
    const m = perFile.get(f)!;
    console.log(`  ${f.padEnd(36)} ${m.size} unique hex`);
  }

  const report = {
    root: ROOT,
    fileCount: files.length,
    uniqueHexCount: globalCount.size,
    topColors: sorted.slice(0, 60).map(([hex, count]) => {
      const rgb = hexToRgb(hex)!;
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      return {
        hex,
        count,
        hueBucket: hueBucket(hsl.h),
        h: Math.round(hsl.h),
        s: Math.round(hsl.s * 1000) / 1000,
        l: Math.round(hsl.l * 1000) / 1000,
      };
    }),
    hueBucketTotals: Object.fromEntries([...bucketOcc.entries()].sort((a, b) => b[1] - a[1])),
    perFileUniqueCount: Object.fromEntries(files.map((f) => [f, perFile.get(f)!.size])),
  };

  if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nWrote JSON report to ${jsonOut}`);
  }
}

main();
