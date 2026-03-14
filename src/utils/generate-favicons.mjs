/**
 * Generate all favicon PNGs + ICO from public/favicon.svg
 *
 * Usage:  npx tsx src/utils/generate-favicons.mjs
 *    or:  node src/utils/generate-favicons.mjs   (after installing deps)
 *
 * Deps (installed automatically via npx):
 *   @resvg/resvg-js  — pure-WASM SVG→PNG renderer
 *   png-to-ico       — PNG→ICO converter
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "..", "public");

// ── Dynamic imports (so npx installs them if missing) ──
const { Resvg } = await import("@resvg/resvg-js");

// ── Read the SVG source ──
const svgSource = readFileSync(join(publicDir, "favicon.svg"), "utf8");

// ── Helper: render SVG at a given size, optionally with a background ──
function renderPng(svg, size, opts = {}) {
  const { bg, padding = 0 } = opts;

  // If we need padding (maskable safe-zone), shrink the SVG and center it
  let finalSvg = svg;
  if (padding > 0) {
    const innerSize = size - padding * 2;
    finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${bg ? `<rect width="${size}" height="${size}" fill="${bg}" rx="0"/>` : ""}
      <svg x="${padding}" y="${padding}" width="${innerSize}" height="${innerSize}" viewBox="0 0 120 120">
        ${extractInner(svg)}
      </svg>
    </svg>`;
  } else if (bg) {
    // Add background rect behind the lotus
    finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">
      <rect width="120" height="120" fill="${bg}" rx="0"/>
      ${extractInner(svg)}
    </svg>`;
  }

  const resvg = new Resvg(finalSvg, {
    fitTo: { mode: "width", value: size },
  });
  return resvg.render().asPng();
}

// Extract inner content from the SVG (everything between <svg> tags)
function extractInner(svg) {
  return svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
}

// ── PNG palette overrides (since PNGs can't react to media queries) ──
// Keep generated PNGs aligned with the dark favicon treatment.
function svgForPng(svg) {
  // Replace CSS class declarations if present.
  return svg
    .replace(/\.petal-outer-left\s*\{[^}]+\}/g, ".petal-outer-left { fill: #d47445; }")
    .replace(/\.petal-outer-right\s*\{[^}]+\}/g, ".petal-outer-right { fill: #d47445; }")
    .replace(/\.petal-inner-left\s*\{[^}]+\}/g, ".petal-inner-left { fill: #fbbf24; }")
    .replace(/\.petal-inner-right\s*\{[^}]+\}/g, ".petal-inner-right { fill: #fbbf24; }")
    .replace(/\.jewel\s*\{[^}]+\}/g, ".jewel { fill: #e7dcc4; }")
    .replace(/\.lotus\s*\{[^}]+\}/g, ".lotus { stroke: #0a0908; stroke-width: 3.5; stroke-linejoin: round; }");
}

const pngSvg = svgForPng(svgSource);

const BG = "#0a0908"; // match favicon.svg badge background for consistency
const BG_MASKABLE = "#15120f"; // slightly lighter for launcher contrast on dark wallpapers

// ── Generate each variant ──
const variants = [
  // Standard favicons (transparent bg for browser tabs)
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },

  // Apple touch icon (needs solid bg — shown on home screen)
  { name: "apple-touch-icon.png", size: 180, bg: BG },

  // Android chrome icons (solid bg)
  { name: "android-chrome-192x192.png", size: 192, bg: BG },
  { name: "android-chrome-512x512.png", size: 512, bg: BG },

  // Rounded PWA icons (solid bg)
  { name: "icon-192-rounded.png", size: 192, bg: BG },
  { name: "icon-512-rounded.png", size: 512, bg: BG },

  // Maskable icons (safe-zone: icon content in center 80%)
  { name: "icon-192-maskable.png", size: 192, bg: BG_MASKABLE, maskable: true },
  { name: "icon-512-maskable.png", size: 512, bg: BG_MASKABLE, maskable: true },
];

for (const v of variants) {
  const padding = v.maskable ? Math.round(v.size * 0.1) : 0;
  const png = renderPng(pngSvg, v.size, { bg: v.bg, padding });
  const outPath = join(publicDir, v.name);
  writeFileSync(outPath, png);
  console.log(`✓ ${v.name} (${v.size}×${v.size})`);
}

// ── Generate favicon.ico (16 + 32) ──
try {
  const pngToIco = (await import("png-to-ico")).default;
  const ico16 = renderPng(pngSvg, 16);
  const ico32 = renderPng(pngSvg, 32);
  const ico = await pngToIco([ico16, ico32]);
  writeFileSync(join(publicDir, "favicon.ico"), ico);
  console.log("✓ favicon.ico (16+32)");
} catch (e) {
  console.warn("⚠ Could not generate favicon.ico:", e.message);
  console.warn("  Install png-to-ico to generate ICO, or convert manually.");
}

console.log("\nDone! All favicons written to public/");
