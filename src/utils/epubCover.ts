/**
 * Discover-style EPUB covers (light cream card, collection accent).
 *
 * Library thumbnail: raster PNG as EPUB/images/cover.png (cover-image).
 * SVG is ignored by most reader libraries. The cover is metadata only —
 * it is not a spine page, so reading starts at the table of contents.
 */

import {
	collectionVisuals,
	getCollectionVisual,
} from "../components/collection-covers/collectionVisuals";
import { homeCollections } from "../data/collectionHome";
import { directoryStructure } from "../data/directoryStructure";

function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export type EpubCoverKind = "collection" | "section" | "topic";
export type EpubCoverAccentRole =
	| "topic"
	| "positive"
	| "negative"
	| "neutral";

export type EpubCoverInput = {
	slug: string;
	title: string;
	parentTitle?: string;
	kind?: EpubCoverKind;
	accentRole?: EpubCoverAccentRole;
	discourseCount: number;
};

export type EpubCoverModel = {
	kind: EpubCoverKind;
	accent: string;
	kicker: string;
	ribbon?: string;
	title: string;
	subtitle: string;
	relation?: string;
	footerLeft: string;
	footerRight: string;
};

const PAPER = "#f4eee4";
const INK = "#1c1915";
const MUTED = "#6f675e";
const BORDER = "#e0d8cc";
const BRAND = "Words of the Buddha";

const TOPIC_ACCENTS: Record<EpubCoverAccentRole, string> = {
	topic: "#2563eb",
	positive: "#d97706",
	negative: "#475569",
	neutral: "#0891b2",
};

function formatSlugId(slug: string): string {
	const upper = slug.toUpperCase();
	const m = /^([A-Z]+)(\d.*)$/.exec(upper);
	return m ? `${m[1]} ${m[2]}` : upper;
}

function splitTitle(title: string): { pali: string; english: string } {
	const idx = title.indexOf(" - ");
	if (idx === -1) return { pali: "", english: title };
	return {
		pali: title.slice(0, idx).trim(),
		english: title.slice(idx + 3).trim(),
	};
}

function stripEnglishPrefix(parentTitle: string): string {
	const { pali, english } = splitTitle(parentTitle);
	return pali || english;
}

export function rootCollectionSlug(slug: string): string | undefined {
	if (collectionVisuals[slug]) return slug;
	for (const [top, meta] of Object.entries(directoryStructure)) {
		if (top === slug) return top;
		if (!meta.children) continue;
		if (meta.children[slug]) return top;
		for (const [mid, midMeta] of Object.entries(meta.children)) {
			if (mid === slug) return top;
			if (midMeta.children?.[slug]) return top;
		}
	}
	return undefined;
}

function inferKind(input: EpubCoverInput): EpubCoverKind {
	if (input.kind) return input.kind;
	if (input.parentTitle) return "section";
	if (homeCollections.some((c) => c.slug === input.slug)) return "collection";
	return "section";
}

export function buildEpubCoverModel(input: EpubCoverInput): EpubCoverModel {
	const kind = inferKind(input);
	const { pali, english } = splitTitle(input.title);
	const root = rootCollectionSlug(input.slug);
	const home = homeCollections.find((c) => c.slug === (root ?? input.slug));
	const visual = getCollectionVisual(root ?? input.slug);
	const accentHex =
		kind === "topic"
			? TOPIC_ACCENTS[input.accentRole ?? "topic"]
			: visual.accent.startsWith("#")
				? visual.accent
				: "#6b5b4f";

	if (kind === "topic") {
		return {
			kind,
			accent: accentHex,
			kicker: "",
			title: english || input.title,
			subtitle: "",
			footerLeft: "",
			footerRight: BRAND,
		};
	}

	if (kind === "section") {
		return {
			kind,
			accent: accentHex,
			kicker: formatSlugId(input.slug),
			title: pali || english,
			subtitle: pali ? english : "",
			relation: input.parentTitle
				? `from ${stripEnglishPrefix(input.parentTitle)}`
				: home
					? `from ${home.paliName}`
					: undefined,
			footerLeft: "",
			footerRight: BRAND,
		};
	}

	return {
		kind: "collection",
		accent: accentHex,
		kicker: (visual.abbrev || input.slug).toUpperCase(),
		title: home?.paliName || pali || english,
		subtitle: home?.englishName || (pali ? english : ""),
		footerLeft: "",
		footerRight: BRAND,
	};
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
	const words = text.trim().split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let cur = "";
	for (const word of words) {
		const next = cur ? `${cur} ${word}` : word;
		if (next.length > maxChars && cur) {
			lines.push(cur);
			cur = word;
			if (lines.length === maxLines) {
				cur = "";
				break;
			}
		} else {
			cur = next;
		}
	}
	if (cur && lines.length < maxLines) lines.push(cur);
	return lines;
}

/** SVG library thumbnail — 2:3 like Discover collection cards. */
export function renderEpubCoverSvg(model: EpubCoverModel): string {
	const titleLines = wrapLines(model.title, 16, 4);
	const titleSize = 64;
	const titleLineH = 74;
	const subtitleSize = 56;
	const relationSize = 50;
	const extraBelow =
		(model.subtitle ? 40 + subtitleSize : 0) +
		(model.relation ? 32 + relationSize : 0);
	const visualMid = 640;
	const titleY = Math.round(
		visualMid -
			(((titleLines.length - 1) * titleLineH + extraBelow) / 2) +
			titleSize * 0.35,
	);
	const titleTspans = titleLines
		.map((line, i) => {
			return `<tspan x="400" dy="${i === 0 ? 0 : titleLineH}">${escapeXml(line)}</tspan>`;
		})
		.join("");
	const afterTitle = titleY + (titleLines.length - 1) * titleLineH + 28;

	const ribbonLabel = model.ribbon?.toUpperCase() ?? "";
	const ribbonW = Math.max(200, ribbonLabel.length * 18 + 56);
	const ribbonX = 800 - 48 - ribbonW;
	const ribbon = model.ribbon
		? `<g>
  <rect x="${ribbonX}" y="44" width="${ribbonW}" height="52" rx="4" fill="${model.accent}"/>
  <text x="${ribbonX + ribbonW / 2}" y="80" text-anchor="middle" fill="${PAPER}" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="1.6">${escapeXml(ribbonLabel)}</text>
</g>`
		: "";

	const subtitle = model.subtitle
		? `<text x="400" y="${afterTitle + 52}" text-anchor="middle" fill="${INK}" font-family="Georgia, serif" font-size="${subtitleSize}" font-weight="500">${escapeXml(model.subtitle)}</text>`
		: "";
	const relationY = afterTitle + (model.subtitle ? 52 + subtitleSize + 36 : 52);
	const relation = model.relation
		? `<text x="400" y="${relationY}" text-anchor="middle" fill="${INK}" font-family="Georgia, serif" font-size="${relationSize}">${escapeXml(model.relation)}</text>`
		: "";

	const kicker = model.kicker
		? `<text x="64" y="100" fill="${INK}" font-family="Times New Roman, Times, Georgia, serif" font-size="52" font-weight="700" letter-spacing="0.6">${escapeXml(model.kicker.toUpperCase())}</text>`
		: "";
	const footer =
		model.footerLeft
			? `<text x="64" y="1130" fill="${INK}" font-family="Georgia, serif" font-size="50" font-weight="500">${escapeXml(model.footerLeft)}</text>
  <text x="736" y="1130" text-anchor="end" fill="${INK}" font-family="Georgia, serif" font-size="50" font-weight="500">${escapeXml(model.footerRight)}</text>`
			: `<text x="400" y="1130" text-anchor="middle" fill="${INK}" font-family="Georgia, serif" font-size="56" font-weight="500">${escapeXml(model.footerRight)}</text>`;

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" width="800" height="1200">
  <rect width="800" height="1200" fill="${PAPER}"/>
  <rect x="0" y="0" width="800" height="16" fill="${model.accent}"/>
  <rect x="0" y="0" width="28" height="1200" fill="${model.accent}"/>
  ${ribbon}
  ${kicker}
  <text x="400" y="${titleY}" text-anchor="middle" fill="${INK}" font-family="Georgia, serif" font-size="64" font-weight="600">${titleTspans}</text>
  ${subtitle}
  ${relation}
  <line x1="64" y1="1036" x2="736" y2="1036" stroke="${BORDER}" stroke-width="2" stroke-dasharray="6 8"/>
  ${footer}
</svg>
`;
}

/** Raster cover for reader libraries (SVG is ignored as cover-image by most apps). */
export async function renderEpubCoverPng(model: EpubCoverModel): Promise<Buffer> {
	const svg = renderEpubCoverSvg(model);
	const { Resvg } = await import("@resvg/resvg-js");
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: 2000 },
		font: { loadSystemFonts: true },
		background: PAPER,
	});
	return resvg.render().asPng();
}

export function renderEpubCoverXhtml(model: EpubCoverModel): string {
	const ribbon = model.ribbon
		? `<span class="epub-cover-ribbon">${escapeXml(model.ribbon)}</span>`
		: "";
	const subtitle = model.subtitle
		? `<p class="epub-cover-english">${escapeXml(model.subtitle)}</p>`
		: "";
	const relation = model.relation
		? `<p class="epub-cover-from">${escapeXml(model.relation)}</p>`
		: "";

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(model.title)}</title>
  <style type="text/css">
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: Georgia, "Times New Roman", Times, serif;
      background: ${PAPER};
      color: ${INK};
    }
    .epub-cover {
      box-sizing: border-box;
      min-height: 95vh;
      margin: 3vh 6%;
      padding: 1.4em 1.3em 1.1em 1.5em;
      border: 1px solid ${BORDER};
      border-left: 6px solid ${model.accent};
      background: ${PAPER};
      display: flex;
      flex-direction: column;
    }
    .epub-cover-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75em;
    }
    .epub-cover-kicker {
      font-size: 0.78em;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${model.accent};
      margin: 0;
    }
    .epub-cover-ribbon {
      display: inline-block;
      padding: 0.2em 0.55em;
      font-size: 0.62em;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: ${PAPER};
      background: ${model.accent};
    }
    .epub-cover-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 1.5em 0.4em;
    }
    .epub-cover-title {
      font-size: 1.85em;
      font-weight: 500;
      line-height: 1.25;
      margin: 0;
      hyphens: none;
      -webkit-hyphens: none;
      word-break: keep-all;
    }
    .epub-cover-english {
      margin: 0.7em 0 0;
      font-size: 1em;
      color: ${MUTED};
    }
    .epub-cover-from {
      margin: 0.45em 0 0;
      font-size: 0.95em;
      font-style: italic;
      color: ${MUTED};
    }
    .epub-cover-footer {
      display: flex;
      justify-content: space-between;
      gap: 0.75em;
      border-top: 1px dashed ${BORDER};
      padding-top: 0.7em;
      font-size: 0.82em;
      color: ${MUTED};
    }
    .epub-cover-footer p { margin: 0; }
  </style>
</head>
<body>
  <div class="epub-cover">
    <div class="epub-cover-top">
      <p class="epub-cover-kicker">${escapeXml(model.kicker)}</p>
      ${ribbon}
    </div>
    <div class="epub-cover-main">
      <h1 class="epub-cover-title">${escapeXml(model.title)}</h1>
      ${subtitle}
      ${relation}
    </div>
    <div class="epub-cover-footer">
      <p>${escapeXml(model.footerLeft)}</p>
      <p>${escapeXml(model.footerRight)}</p>
    </div>
  </div>
</body>
</html>
`;
}
