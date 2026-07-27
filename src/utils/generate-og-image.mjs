/**
 * Generate the default social share card: public/og-default.png (1200×630).
 *
 * Used as og:image / twitter:image for every page without its own discourse
 * artwork. Rendered from SVG so it stays in the design system's palette and can
 * be regenerated deterministically.
 *
 * Usage:  node src/utils/generate-og-image.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");
const publicDir = join(projectRoot, "public");
const fontsDir = join(publicDir, "assets", "fonts");

const { Resvg } = await import("@resvg/resvg-js");

const WIDTH = 1200;
const HEIGHT = 630;

// Design tokens mirrored from src/styles/global.css (dark surface) and
// public/favicon.svg (lotus mark).
const PAPER = "#1f1c17";
const INK = "#e7dcc4";
const ACCENT = "#d47445";
const PETAL_OUTER = "#F29C5A";
const PETAL_INNER = "#fbbf24";
const SEED = "#e7dcc4";

const TITLE = "Words of the Buddha";
const SUBTITLE = "Early Buddhist discourses in Pāli and English";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <path id="petal" d="M 0 -22 C 14 -8 14 12 0 18 C -14 12 -14 -8 0 -22 Z" />
    <radialGradient id="glow" cx="50%" cy="34%" r="62%">
      <stop offset="0%" stop-color="#3a2f22" stop-opacity="1" />
      <stop offset="100%" stop-color="${PAPER}" stop-opacity="1" />
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" />

  <!-- Lotus mark, scaled up from the favicon geometry -->
  <g transform="translate(600,196) scale(1.9)" stroke="${PAPER}" stroke-width="3.5" stroke-linejoin="round">
    <use href="#petal" transform="translate(-14, 16) rotate(-65)" fill="${PETAL_OUTER}" />
    <use href="#petal" transform="translate(14, 16) rotate(65)" fill="${PETAL_OUTER}" />
    <use href="#petal" transform="translate(-9, 0) rotate(-25)" fill="${PETAL_INNER}" />
    <use href="#petal" transform="translate(9, 0) rotate(25)" fill="${PETAL_INNER}" />
    <circle cx="0" cy="-26" r="9" fill="${SEED}" />
  </g>

  <text x="600" y="396" text-anchor="middle"
        font-family="Gentium Plus" font-weight="bold" font-size="76" fill="${INK}">${TITLE}</text>

  <rect x="510" y="436" width="180" height="3" rx="1.5" fill="${ACCENT}" />

  <text x="600" y="500" text-anchor="middle"
        font-family="Gentium Plus" font-size="34" fill="${INK}" fill-opacity="0.78">${SUBTITLE}</text>

  <text x="600" y="574" text-anchor="middle"
        font-family="Gentium Plus" font-size="26" fill="${ACCENT}" letter-spacing="2">wordsofthebuddha.org</text>
</svg>`;

const resvg = new Resvg(svg, {
	fitTo: { mode: "width", value: WIDTH },
	font: {
		// Gentium Plus is the site's Pāli serif and ships as TTF, which resvg
		// reads directly (the Spectral files are woff2).
		fontFiles: [
			join(fontsDir, "GentiumPlus-Regular.ttf"),
			join(fontsDir, "GentiumPlus-Bold.ttf"),
		],
		loadSystemFonts: false,
		defaultFontFamily: "Gentium Plus",
	},
});

const png = resvg.render().asPng();
const outPath = join(publicDir, "og-default.png");
writeFileSync(outPath, png);

console.log(
	`Wrote ${outPath} (${WIDTH}×${HEIGHT}, ${(png.length / 1024).toFixed(1)} KB)`,
);
