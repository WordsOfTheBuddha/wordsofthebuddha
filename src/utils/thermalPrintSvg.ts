/**
 * SVG → high-resolution PNG for thermal printers (default 304 DPI).
 *
 * Renders with @resvg/resvg-js (good text shaping / system fonts).
 * Dark, screen-oriented SVGs are wrapped with vector invert + grayscale so
 * structure and labels stay aligned without hand-tuning colors.
 *
 * Usage:
 *   npx tsx src/utils/thermalPrintSvg.ts <input.svg> [output.png]
 *   npx tsx src/utils/thermalPrintSvg.ts src/assets/content-images/an7.65.svg
 *
 * Options:
 *   --dpi <n>        Target print resolution (default 304). Width/height scale as (dpi/96)× SVG size.
 *   --no-invert      Skip invert (use for already light-themed artwork).
 *   --no-grayscale   Keep RGB after invert (usually worse on thermal; default is grayscale).
 *   --fit width|height  Which dimension fitTo uses (default width).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const CSS_PX_PER_INCH = 96;

export type ThermalPrintOptions = {
  /** Print DPI; pixel size = round(svgCssPx * dpi / 96). Default 304. */
  dpi: number;
  /** Invert colors (recommended for dark-background diagrams). Default true. */
  invert: boolean;
  /** Convert to grayscale after invert. Default true. */
  grayscale: boolean;
  fit: "width" | "height";
  textRendering: 0 | 1 | 2;
};

const defaultOptions: ThermalPrintOptions = {
  dpi: 304,
  invert: true,
  grayscale: true,
  fit: "width",
  textRendering: 1,
};

/** Parse viewBox or width/height; falls back to 300×300. */
export function parseSvgDimensions(svg: string): { width: number; height: number } {
  const vb = svg.match(
    /viewBox\s*=\s*["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i,
  );
  if (vb) {
    return { width: Number(vb[1]), height: Number(vb[2]) };
  }
  const w = svg.match(/\bwidth\s*=\s*["']([\d.]+)\s*(?:px)?["']/i);
  const h = svg.match(/\bheight\s*=\s*["']([\d.]+)\s*(?:px)?["']/i);
  if (w && h) {
    return { width: Number(w[1]), height: Number(h[1]) };
  }
  return { width: 300, height: 300 };
}

/**
 * Insert white backdrop + optional invert/grayscale filters around existing SVG content.
 * Preserves the root <svg> attributes (viewBox, dimensions, xmlns).
 */
export function wrapSvgForThermalPrint(
  svg: string,
  w: number,
  h: number,
  opts: Pick<ThermalPrintOptions, "invert" | "grayscale">,
): string {
  const defs = `<defs>
    <filter id="thermalInvert" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>
    </filter>
    <filter id="thermalGray" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>`;

  let open = "";
  let close = "";
  if (opts.invert && opts.grayscale) {
    open = '<g filter="url(#thermalGray)"><g filter="url(#thermalInvert)">';
    close = "</g></g>";
  } else if (opts.invert) {
    open = '<g filter="url(#thermalInvert)">';
    close = "</g>";
  } else if (opts.grayscale) {
    open = '<g filter="url(#thermalGray)">';
    close = "</g>";
  }

  const withoutXml = svg.replace(/^\uFEFF?<\?xml[^?]*\?>\s*/i, "");
  const replaced = withoutXml.replace(
    /^<svg\b([^>]*)>/i,
    `<svg$1>${defs}${open}`,
  );
  if (replaced === withoutXml) {
    throw new Error("Could not find root <svg> tag");
  }
  return replaced.replace(/<\/svg>\s*$/i, `${close}</svg>`);
}

export async function renderThermalPng(
  svgSource: string,
  options: Partial<ThermalPrintOptions> = {},
): Promise<Buffer> {
  const opts = { ...defaultOptions, ...options };
  const { width: w, height: h } = parseSvgDimensions(svgSource);
  const scaledW = Math.max(1, Math.round((w * opts.dpi) / CSS_PX_PER_INCH));
  const scaledH = Math.max(1, Math.round((h * opts.dpi) / CSS_PX_PER_INCH));

  const wrapped = wrapSvgForThermalPrint(svgSource, w, h, {
    invert: opts.invert,
    grayscale: opts.grayscale,
  });

  const { Resvg } = await import("@resvg/resvg-js");
  const fitTo =
    opts.fit === "height"
      ? { mode: "height" as const, value: scaledH }
      : { mode: "width" as const, value: scaledW };

  const resvg = new Resvg(wrapped, {
    fitTo,
    dpi: opts.dpi,
    font: {
      loadSystemFonts: true,
    },
    textRendering: opts.textRendering,
    shapeRendering: 2,
    background: "#ffffff",
  });

  return resvg.render().asPng();
}

function parseArgs(argv: string[]) {
  const out: {
    inputs: string[];
    output?: string;
    dpi: number;
    invert: boolean;
    grayscale: boolean;
    fit: "width" | "height";
  } = {
    inputs: [],
    dpi: defaultOptions.dpi,
    invert: defaultOptions.invert,
    grayscale: defaultOptions.grayscale,
    fit: defaultOptions.fit,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dpi" && argv[i + 1]) {
      out.dpi = Math.max(1, Number(argv[++i]));
    } else if (a === "--no-invert") {
      out.invert = false;
    } else if (a === "--no-grayscale") {
      out.grayscale = false;
    } else if (a === "--fit" && argv[i + 1]) {
      const f = argv[++i].toLowerCase();
      if (f === "width" || f === "height") out.fit = f;
    } else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      process.exit(1);
    } else {
      out.inputs.push(a);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [input, outputArg] = args.inputs;
  if (!input) {
    console.error(`Usage: npx tsx src/utils/thermalPrintSvg.ts <input.svg> [output.png] [options]`);
    process.exit(1);
  }

  const svgSource = readFileSync(input, "utf8");
  const png = await renderThermalPng(svgSource, {
    dpi: args.dpi,
    invert: args.invert,
    grayscale: args.grayscale,
    fit: args.fit,
  });

  const outPath =
    outputArg ??
    join(dirname(input), basename(input, ".svg") + ".thermal.png");

  writeFileSync(outPath, png);
  const { width: w, height: h } = parseSvgDimensions(svgSource);
  const scaledW = Math.round((w * args.dpi) / CSS_PX_PER_INCH);
  const scaledH = Math.round((h * args.dpi) / CSS_PX_PER_INCH);
  console.log(`Wrote ${outPath} (${scaledW}×${scaledH} px @ ${args.dpi} dpi scale)`);
}

const isMain = process.argv[1]?.includes("thermalPrintSvg");
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
