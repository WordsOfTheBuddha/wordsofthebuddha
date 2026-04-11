/**
 * Server-side PDF rendering utilities.
 *
 * Pipeline for each discourse:
 *   raw MDX body
 *     → strip MDX-specific syntax (imports, JSX)
 *     → convert |term::definition| gloss syntax to <span class="tt" data-def="…">
 *     → marked.parse() → HTML
 *     → jsdom tooltip→footnote pass
 *     → clean HTML string ready for Playwright
 *
 * The full collection HTML document is assembled by buildPdfHtml().
 */

import { JSDOM } from "jsdom";
import { Marked, Renderer } from "marked";
import type { Tokens } from "marked";
import type { DirectoryStructure } from "../types/directory";
import { findEntry, findEntriesBySlugPrefix } from "./textApi";
import { findContentImages } from "./contentImage";
import { existsSync, readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { findSvgSafeCuts, cutsToSlices } from "./svgSafeCuts";
import {
	createCombinedMarkdown,
	formatBlock,
	parseContent,
	type ContentPair,
} from "./contentParser";
import { getChapterEntryListForPdf } from "./collectionPdfChapterEntries";
import { discourseSlugFromEntry } from "./collectionPdfExportTree";

// ---------------------------------------------------------------------------
// Isolated marked instance – avoids polluting the global marked used by mdParser
// ---------------------------------------------------------------------------

const renderer = new Renderer();

renderer.heading = function (token) {
	const level = token.depth;
	const text = typeof token.text === "string" ? token.text : "";
	// h4 is used for verse numbers (e.g. "#### 179")
	if (level === 4) {
		return `<p class="verse-number">${text}</p>`;
	}
	// Shift body headings down 2 levels in the actual tag so they nest
	// below chapter headings (h2) and discourse titles (h3) in the PDF
	// bookmark outline.  The CSS class stays based on original level so
	// visual sizing is unchanged.
	const tagLevel = Math.min(level + 2, 6);
	return `<h${tagLevel} class="content-h${level}">${text}</h${tagLevel}>\n`;
};

// Avoid wrapping pre-built polytext paragraphs (same structure as MDContent / mdParser)
renderer.paragraph = function (this: any, token: Tokens.Paragraph) {
	const html: string = this.parser?.parseInline
		? this.parser.parseInline(token.tokens)
		: ((token as { text?: string }).text ?? "");
	const t = html.trimStart();
	if (
		t.startsWith('<p class="pali-paragraph"') ||
		t.startsWith('<p class="english-paragraph"')
	) {
		return html;
	}
	return `<p>${html}</p>`;
};

export const pdfMarked = new Marked({
	gfm: true,
	breaks: true,
});
pdfMarked.use({ renderer });

// ---------------------------------------------------------------------------
// Step 1: Strip MDX-specific syntax
// ---------------------------------------------------------------------------

export function stripMdxSyntax(body: string): string {
	return (
		body
			// Remove ESM import lines
			.replace(/^import\s+.*$/gm, "")
			// Remove self-closing JSX components like <Image ... />
			.replace(/<[A-Z][A-Za-z]*[^>]*\/>/g, "")
			// Remove block JSX components  e.g. <Image>...</Image>
			.replace(/<[A-Z][A-Za-z]*[^>]*>[\s\S]*?<\/[A-Z][A-Za-z]*>/g, "")
			// Remove JSX expression blocks {/* comment */}
			.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
			.trim()
	);
}

// ---------------------------------------------------------------------------
// Step 2: Convert |term::definition| gloss syntax to tooltip spans
// ---------------------------------------------------------------------------

export function convertGlossToSpans(text: string): string {
	return text.replace(
		/\|([^|:]+)::([^|]+)\|/g,
		(_, term, rest) => {
			// Strip TTS override (third ::segment) from definition if present
			const ttsSep = rest.indexOf("::");
			const def = ttsSep >= 0 ? rest.slice(0, ttsSep) : rest;
			// Pure TTS-override (empty def) — render term as plain text, no footnote span
			if (!def.trim()) return term.trim();
			return `<span class="tt" data-def="${def.trim().replace(/"/g, "&quot;").replace(/'/g, "&#39;")}">${term.trim()}</span>`;
		},
	);
}

// ---------------------------------------------------------------------------
// Step 3: marked.parse() – raw MDX → HTML
// ---------------------------------------------------------------------------

export function mdxBodyToHtml(body: string): string {
	const clean = stripMdxSyntax(body);
	const withSpans = convertGlossToSpans(clean);
	// pdfMarked v15 .parse() is synchronous
	return pdfMarked.parse(withSpans) as string;
}

/** Marked HTML for combined Pali+English markdown (same pairing as discourse pages). */
function polytextMarkdownToHtml(markdown: string): string {
	const withSpans = convertGlossToSpans(markdown);
	return pdfMarked.parse(withSpans) as string;
}

/**
 * Split layout: one grid row per content pair so English and Pāli stay aligned
 * (same logical pairing as `data-pair-id` in MDContent — not two independent columns).
 */
function buildSplitPdfHtmlFromPairs(pairs: ContentPair[]): string {
	let pairIndex = 0;
	const rows: string[] = [];

	for (const pair of pairs) {
		if (pair.type === "other") {
			rows.push(
				`<div class="pdf-poly-row pdf-poly-row-full"><div class="pdf-poly-full">${pair.english}</div></div>`,
			);
			continue;
		}

		if (pair.english.startsWith("#")) {
			const enRaw = formatBlock(
				pair.english,
				false,
				undefined,
				undefined,
				pair.actualParagraphNumber,
			);
			const piRaw = pair.pali
				? formatBlock(
						pair.pali,
						true,
						undefined,
						undefined,
						pair.actualParagraphNumber,
					)
				: "";
			rows.push(
				`<div class="pdf-poly-row pdf-poly-row-heading">
  <div class="pdf-poly-cell pdf-poly-en">${polytextMarkdownToHtml(enRaw)}</div>
  <div class="pdf-poly-cell pdf-poly-pi">${piRaw ? polytextMarkdownToHtml(piRaw) : '<div class="pdf-poly-cell-empty"></div>'}</div>
</div>`,
			);
			continue;
		}

		const idx = pairIndex++;
		const enRaw = formatBlock(
			pair.english,
			false,
			idx,
			undefined,
			pair.actualParagraphNumber,
		);
		const piRaw =
			pair.pali !== undefined
				? formatBlock(
						pair.pali,
						true,
						idx,
						undefined,
						pair.actualParagraphNumber,
					)
				: "";

		rows.push(
			`<div class="pdf-poly-row">
  <div class="pdf-poly-cell pdf-poly-en">${polytextMarkdownToHtml(enRaw)}</div>
  <div class="pdf-poly-cell pdf-poly-pi">${piRaw ? polytextMarkdownToHtml(piRaw) : '<div class="pdf-poly-cell-empty"></div>'}</div>
</div>`,
		);
	}

	return `<div class="pdf-poly-split">${rows.join("\n")}</div>`;
}

// ---------------------------------------------------------------------------
// Step 4: Server-side tooltip → footnote transformation (jsdom)
// ---------------------------------------------------------------------------

/**
 * Converts all .tt[data-def] spans to footnote references.
 * Appends a <section class="footnotes"> at the end of the HTML.
 * Duplicate terms (by text) are de-annotated after first occurrence.
 */
export function processFootnotes(
	html: string,
	options?: { includeKeyTermsSection?: boolean },
): string {
	const includeKeyTermsSection = options?.includeKeyTermsSection !== false;

	const dom = new JSDOM(`<div id="root">${html}</div>`);
	const { document } = dom.window;
	const root = document.getElementById("root")!;

	const spans = Array.from(root.querySelectorAll(".tt[data-def]"));
	const seen = new Set<string>();
	const notes: Array<{ term: string; def: string }> = [];

	for (const el of spans) {
		const def = el.getAttribute("data-def") || "";
		const term = el.textContent?.trim() || "";
		const key = term.toLowerCase();

		const replacement = document.createElement("span");

		if (seen.has(key)) {
			// Already annotated – keep the term bold, no duplicate footnote
			replacement.innerHTML = `<b>${term}</b>`;
		} else {
			seen.add(key);
			// Always footnote – no number in body text
			replacement.innerHTML = `<b>${term}</b>`;
			notes.push({ term, def });
		}

		el.replaceWith(replacement);
	}

	// Append footnote section if there are any long definitions
	if (notes.length > 0 && includeKeyTermsSection) {
		const section = document.createElement("section");
		section.className = "footnotes";

		const heading = document.createElement("p");
		heading.className = "fn-heading";
		heading.textContent = "Key Terms";
		section.appendChild(heading);

		for (const { term, def } of notes) {
			// Extract Pali term from [paliTerm] at end of definition
			const paliMatch = def.match(/\[([^\]]+)\]$/);
			const pali = paliMatch ? paliMatch[1] : null;
			const cleanDef = pali ? def.replace(/\s*\[[^\]]+\]$/, "") : def;

			const p = document.createElement("p");
			p.className = "fn-item";
			p.innerHTML = `<b>${term}</b>${pali ? ` <span class="fn-pali">[${pali}]</span>` : ""} — ${cleanDef}`;
			section.appendChild(p);
		}

		root.appendChild(section);
	}

	return root.innerHTML;
}

// ---------------------------------------------------------------------------
// Step 5: Commentary frontmatter → numbered footnote section
// ---------------------------------------------------------------------------

/**
 * Converts ^[n]^ markers in body HTML to <sup> references and appends a
 * "Notes" section built from the discourse's `commentary` frontmatter array.
 *
 * Each commentary item has the form: "[1] **term** Explanatory text..."
 * (YAML may escape the bracket as \[1])
 */
function processCommentaryNotes(
	html: string,
	commentary: string | string[] | undefined,
): string {
	if (!commentary) return html;

	const items = Array.isArray(commentary) ? commentary : [commentary];

	const notes: Array<{ num: string; content: string }> = [];
	for (const raw of items) {
		// Unescape YAML leading \[ → [
		const text = raw.startsWith("\\[") ? raw.replace(/^\\\[/, "[") : raw;
		const match = text.match(/^\[(\d+)\]\s*([\s\S]*)/);
		if (match) notes.push({ num: match[1], content: match[2].trim() });
	}

	if (notes.length === 0) return html;

	// Replace ^[n]^ with superscript references in the body
	const withRefs = html.replace(
		/\^\[(\d+)\]\^/g,
		'<sup class="cn-ref">[$1]</sup>',
	);

	// Build the numbered notes section (reuses footnote CSS classes)
	const rows = notes
		.map(({ num, content }) => {
			const contentHtml = pdfMarked.parseInline(content) as string;
			return `<p class="fn-item"><span class="cn-num">[${num}]</span> ${contentHtml}</p>`;
		})
		.join("\n");

	return (
		withRefs +
		`\n<section class="footnotes">\n<p class="fn-heading">Notes</p>\n${rows}\n</section>`
	);
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

type PdfImageMode = "none" | "svgPrimaryOnly" | "svgAll";

export interface DiscoursePdf {
	slug: string;
	title: string;
	description: string;
	html: string;
}

export interface ChapterPdf {
	slug: string;
	title: string;
	description: string;
	discourses: DiscoursePdf[];
}

export interface CollectionPdf {
	slug: string;
	title: string;
	description: string;
	chapters: ChapterPdf[];
	/** True when the collection has named sub-collections (e.g. SN 1-11 → SN 1, SN 2 …) */
	hasChapters: boolean;
}

/** When Pali mode is on in the client, collection PDFs mirror interleaved vs split layout. */
export type PdfPaliOptions = {
	enabled: boolean;
	layout: "interleaved" | "split";
};

/** Options for collection PDF body rendering (passed through fetchCollectionPdfData). */
export type PdfExportContentOptions = {
	paliOptions?: PdfPaliOptions;
	/** When false, glossed terms stay bold in the body but the Key Terms appendix is omitted. Default true. */
	includeKeyTermsSection?: boolean;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

async function fetchDiscourseHtml(
	slug: string,
	imageMode: PdfImageMode,
	paliOptions?: PdfPaliOptions,
	includeKeyTermsSection = true,
): Promise<string> {
	const entry = await findEntry("en", { slug });
	if (!entry?.body) return "<p><em>(Content not available)</em></p>";

	// Optional discourse header image(s) for PDFs – SVG only by default.
	let imageHtml = "";
	if (imageMode !== "none") {
		const data = entry.data as any;
		const title = data?.title || slug;

		try {
			const images = findContentImages(slug, data, title);
			if (images.length > 0) {
				const svgImages = images.filter((img) =>
					img.modulePath.toLowerCase().endsWith(".svg"),
				);

				let selected =
					imageMode === "svgAll"
						? svgImages.length > 0
							? svgImages
							: images
						: svgImages.length > 0
							? [svgImages[0]]
							: [];

				if (selected.length > 0) {
					imageHtml = selected
						.map((img) => {
							const marker = "/content-images/";
							const idx = img.modulePath.lastIndexOf(marker);
							const filename =
								idx !== -1
									? img.modulePath.slice(idx + marker.length)
									: "";

							let figureInner = "";

							// For SVGs, inline the markup directly from public/content-images.
							if (filename.toLowerCase().endsWith(".svg")) {
								try {
									const abs = resolvePath(
										process.cwd(),
										"public",
										"content-images",
										filename,
									);
									if (existsSync(abs)) {
										let svg = readFileSync(abs, "utf-8");
										// Strip explicit width/height so the SVG scales
										// via its viewBox to fit the container.
										svg = svg.replace(
											/(<svg[^>]*?)\s+width="[^"]*"/i,
											"$1",
										);
										svg = svg.replace(
											/(<svg[^>]*?)\s+height="[^"]*"/i,
											"$1",
										);

										// Slice SVGs at content-aware safe cut points
										// to avoid cutting through text/shapes.
										const vbMatch = svg.match(
											/viewBox="([\d.\s,]+)"/i,
										);
										if (vbMatch) {
											const [vbX, , vbW] =
												vbMatch[1]
													.split(/[\s,]+/)
													.map(Number);

											const safeCuts = findSvgSafeCuts(svg);
											const slices = safeCuts
												? cutsToSlices(safeCuts)
												: (() => {
														const [, vbY, , vbH] = vbMatch[1].split(/[\s,]+/).map(Number);
														const STRIP_H = 100;
														const s: { y: number; h: number }[] = [];
														let curY = vbY;
														let rem = vbH;
														while (rem > 0) {
															const h = Math.min(STRIP_H, rem);
															s.push({ y: curY, h });
															curY += h;
															rem -= h;
														}
														return s;
													})();

											// Extract background colour from first gradient stop
											const bgMatch = svg.match(
												/stop-color="(#[0-9a-fA-F]{3,8})"/,
											);
											const bgColor =
												bgMatch?.[1] || "#0b1528";
											const strips = slices
												.map((slice) =>
													svg.replace(
														/viewBox="[^"]*"/i,
														`viewBox="${vbX} ${slice.y} ${vbW} ${slice.h}"`,
													),
												)
												.join("\n");
											figureInner = `<div style="background:${bgColor};line-height:0;font-size:0;margin-bottom:2em;">${strips}</div>`;
										} else {
											figureInner = svg;
										}
									}
								} catch {
									// Fall back to <img> below.
								}
							}

							if (!figureInner) {
								const src =
									(img.image as any)?.src ||
									(filename
										? `/content-images/${filename}`
										: "");
								if (!src) return "";
								const alt = escapeHtml(img.alt || title);
								figureInner = `<img src="${src}" alt="${alt}" class="pdf-discourse-image-img" />`;
							}

							// No caption in PDFs – title is already present above.
							return `<figure class="pdf-discourse-image">
  ${figureInner}
</figure>`;
						})
						.filter(Boolean)
						.join("\n");
				}
			}
		} catch {
			// If image resolution fails for any reason, fall back to text-only.
			imageHtml = "";
		}
	}

	let html: string;
	if (paliOptions?.enabled) {
		const paliEntry = await findEntry("pli", { slug });
		const pairs = parseContent(
			{ body: paliEntry?.body ?? "" },
			entry,
			undefined,
			undefined,
			undefined,
			undefined,
		);
		const layout = paliOptions.layout === "split" ? "split" : "interleaved";

		if (layout === "split") {
			html = buildSplitPdfHtmlFromPairs(pairs);
		} else {
			const combined = createCombinedMarkdown(pairs, true, "interleaved");
			html = polytextMarkdownToHtml(combined as string);
		}
	} else {
		html = mdxBodyToHtml(entry.body);
	}

	html = processFootnotes(html, { includeKeyTermsSection });
	html = processCommentaryNotes(html, (entry.data as any)?.commentary);
	return `${imageHtml}${html}`;
}

async function fetchChapterDiscourses(
	chapterSlug: string,
	range: { start: number; end: number } | undefined,
	imageMode: PdfImageMode,
	paliOptions?: PdfPaliOptions,
	includeKeyTermsSection = true,
	selectedDiscourseSlugs?: Set<string> | null,
): Promise<DiscoursePdf[]> {
	const limited = await getChapterEntryListForPdf(chapterSlug, range);
	const filtered =
		selectedDiscourseSlugs && selectedDiscourseSlugs.size > 0
			? limited.filter((entry) =>
					selectedDiscourseSlugs.has(discourseSlugFromEntry(entry)),
				)
			: limited;

	// Render body for each discourse in parallel
	const discourses = await Promise.all(
		filtered.map(async (entry) => {
			const slug = (entry.data as any)?.slug || entry.slug || "";
			const title = (entry.data as any)?.title || slug;
			const description = (entry.data as any)?.description || "";
			const html = await fetchDiscourseHtml(
				slug,
				imageMode,
				paliOptions,
				includeKeyTermsSection,
			);
			return { slug, title, description, html };
		}),
	);

	return discourses;
}

/**
 * Resolve a collection and all its discourse content for PDF generation.
 * - If the collection has children in directoryStructure, each child becomes a chapter.
 * - Otherwise the collection is flat (no chapter headings).
 */
export async function fetchCollectionPdfData(
	slug: string,
	metadata: DirectoryStructure,
	imageMode: PdfImageMode = "svgPrimaryOnly",
	options?: PdfExportContentOptions,
	selectedDiscourseSlugs?: Set<string> | null,
): Promise<CollectionPdf> {
	const paliOptions = options?.paliOptions;
	const includeKeyTermsSection = options?.includeKeyTermsSection !== false;

	const childEntries = metadata.children
		? Object.entries(metadata.children)
		: [];
	const hasChapters = childEntries.length > 0;

	let chapters: ChapterPdf[];

	if (hasChapters) {
		chapters = await Promise.all(
			childEntries.map(async ([childSlug, childMeta]) => {
				const discourses = await fetchChapterDiscourses(
					childSlug,
					childMeta.range,
					imageMode,
					paliOptions,
					includeKeyTermsSection,
					selectedDiscourseSlugs,
				);
				return {
					slug: childSlug,
					title: childMeta.title,
					description: childMeta.description || "",
					discourses,
				};
			}),
		);
	} else {
		// Flat collection (e.g. DhP chapters, SNP sections)
		const discourses = await fetchChapterDiscourses(
			slug,
			undefined,
			imageMode,
			paliOptions,
			includeKeyTermsSection,
			selectedDiscourseSlugs,
		);
		chapters = [
			{
				slug,
				title: "",
				description: "",
				discourses,
			},
		];
	}

	// Filter out empty chapters
	const nonEmpty = chapters.filter((c) => c.discourses.length > 0);

	return {
		slug,
		title: metadata.title,
		description: metadata.description || "",
		chapters: nonEmpty,
		hasChapters,
	};
}

// ---------------------------------------------------------------------------
// HTML document builder
// ---------------------------------------------------------------------------

/** Format a slug like dhp1-20 or ud1.1 → DHP 1-20 / UD 1.1 */
function formatSlugId(slug: string): string {
	const upper = slug.toUpperCase();
	const m = /^([A-Z]+)(\d.*)$/.exec(upper);
	return m ? `${m[1]} ${m[2]}` : upper;
}

/**
 * Strip the Pali-title prefix from a discourse title.
 * "Paṭhama bodhi sutta - Upon Awakening (First)" → "Upon Awakening (First)"
 * "Yamakavagga - Chapter 1 - Pairs"             → "Chapter 1 - Pairs"
 * "Upon Awakening" (no separator)               → "Upon Awakening"
 */
function stripPaliPrefix(title: string): string {
	const idx = title.indexOf(" - ");
	if (idx === -1) return title;
	return title.slice(idx + 3);
}

/**
 * Extract just the Pali name from a discourse title, or "" if none.
 * "Lobha sutta - Greed" → "Lobha sutta"
 * "Greed"              → ""
 */
function extractPaliName(title: string): string {
	const idx = title.indexOf(" - ");
	if (idx === -1) return "";
	return title.slice(0, idx).trim();
}

function buildToc(collection: CollectionPdf): string {
	let html = "";

	for (const ch of collection.chapters) {
		if (collection.hasChapters) {
			html += `<div class="toc-chapter-heading">${ch.title}</div>\n`;
		}
		for (const d of ch.discourses) {
			const id = formatSlugId(d.slug);
			const displayTitle = stripPaliPrefix(d.title);
			const paliName = extractPaliName(d.title);
			const paliSpan = paliName
				? `<span class="toc-pali">${paliName}</span>`
				: "";
			html += `<div class="toc-entry">
  <a href="#d-${d.slug}" class="toc-link"><span class="toc-id">${id}</span>&ensp;${displayTitle}${paliSpan}</a>
  ${d.description ? `<div class="toc-desc">${d.description}</div>` : ""}
</div>\n`;
		}
	}

	return html;
}

function buildContent(collection: CollectionPdf): string {
	let html = "";
	let firstSection = true;

	for (const ch of collection.chapters) {
		if (collection.hasChapters) {
			const breakClass = firstSection
				? ""
				: ' style="page-break-before:always"';
			html += `<div class="chapter-section"${breakClass}>
  <h2 class="chapter-heading">${ch.title}</h2>
  ${ch.description ? `<p class="chapter-desc">${ch.description}</p>` : ""}
</div>\n`;
			firstSection = false;
		}

		for (const d of ch.discourses) {
			const isFirstDiscourse = !collection.hasChapters && firstSection;
			const breakAttr = isFirstDiscourse
				? ""
				: ' style="page-break-before:always"';
			firstSection = false;

			// Flat collections: use h2 so discourses sit at the same outline level
			// as "Table of Contents" (not nested under it). Chaptered: keep h3.
			const hLevel = collection.hasChapters ? "h3" : "h2";
			const id = formatSlugId(d.slug);
			const displayTitle = stripPaliPrefix(d.title);

			const paliName = extractPaliName(d.title);
			const paliLine = paliName
				? `<p class="discourse-pali">${paliName}</p>`
				: "";

			html += `<section id="d-${d.slug}" class="discourse"${breakAttr}>
  <${hLevel} class="discourse-title">${id} ${displayTitle}</${hLevel}>
  ${paliLine}
  ${d.description ? `<p class="discourse-desc">${d.description}</p>` : ""}
  <div class="discourse-body">${d.html}</div>
</section>\n`;
		}
	}

	return html;
}

/** Assemble the complete HTML document to feed to Playwright. */
export type PdfVizImageMode = "light" | "dark" | "thermal";

export function buildPdfHtml(
	collection: CollectionPdf,
	options: {
		collectionUrl: string;
		date: string;
		parentTitle?: string;
		/** Matches browser `data-viz-image-mode` / localStorage `vizImageMode` for diagram filters */
		vizImageMode?: PdfVizImageMode;
	},
): string {
	const { collectionUrl, date, parentTitle } = options;
	const vizImageMode: PdfVizImageMode =
		options.vizImageMode === "light" ||
		options.vizImageMode === "dark" ||
		options.vizImageMode === "thermal"
			? options.vizImageMode
			: "dark";
	const toc = buildToc(collection);
	const content = buildContent(collection);

	// Split title into Pali subtitle + English main title
	const hasSeparator = collection.title.includes(" - ");
	let paliName = "";
	let englishTitle = collection.title;
	if (hasSeparator) {
		const idx = collection.title.indexOf(" - ");
		paliName = collection.title.slice(0, idx).trim();
		englishTitle = collection.title.slice(idx + 3).trim();
	}

	// Format the sub-title line: "Paliname · ID" or just "ID" when no Pali
	const formattedId = formatSlugId(collection.slug);
	const subtitleParts: string[] = [];
	if (paliName) subtitleParts.push(paliName);
	subtitleParts.push(formattedId);
	const subtitleLine = subtitleParts.join(" \u00B7 ");

	// "from Udāna — Inspired Utterances" context line for sub-collections
	const fromLine = parentTitle
		? `<p class="cover-from">from ${parentTitle}</p>`
		: "";

	return `<!DOCTYPE html>
<html lang="en" data-viz-image-mode="${vizImageMode}">
<head>
  <meta charset="utf-8">
  <title>${collection.title}</title>
  <style>${PDF_CSS}</style>
</head>
<body>

<!-- ── Cover page ─────────────────────────────────────────────────── -->
<div class="cover-page">
  <p class="cover-brand">Words of the Buddha</p>
  <div class="cover-main">
    <h1 class="cover-title">${englishTitle}</h1>
    <p class="cover-subtitle">${subtitleLine}</p>
    ${fromLine}
    <hr class="cover-rule" />
    ${collection.description ? `<p class="cover-desc">${collection.description}</p>` : ""}
  </div>
  <div class="cover-footer">
    <p class="cover-url">${collectionUrl}</p>
    <p class="cover-date">Downloaded on ${date}</p>
  </div>
</div>

<!-- ── Table of Contents ──────────────────────────────────────────── -->
<div class="toc-page">
  <h2 class="toc-heading">Table of Contents</h2>
  ${toc}
</div>

<!-- ── Discourse content ──────────────────────────────────────────── -->
<div class="content-pages">
  ${content}
</div>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const PDF_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

html {
  --discourse-viz-filter-light: invert(1) hue-rotate(180deg) saturate(0.88) contrast(1.06);
  --discourse-viz-filter-thermal: invert(1) grayscale(1) contrast(1.2) brightness(1.14);
}

/* Match site discourse diagram modes (same filters as DiscourseImage.astro) */
html[data-viz-image-mode="light"] .pdf-discourse-image-img,
html[data-viz-image-mode="light"] .pdf-discourse-image svg {
  filter: var(--discourse-viz-filter-light) !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
html[data-viz-image-mode="thermal"] .pdf-discourse-image-img,
html[data-viz-image-mode="thermal"] .pdf-discourse-image svg,
html[data-viz-image-mode="print"] .pdf-discourse-image-img,
html[data-viz-image-mode="print"] .pdf-discourse-image svg {
  filter: var(--discourse-viz-filter-thermal) !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
html[data-viz-image-mode="dark"] .pdf-discourse-image-img,
html[data-viz-image-mode="dark"] .pdf-discourse-image svg {
  filter: none !important;
}

body {
  font-family: "Times New Roman", Times, Georgia, serif;
  font-size: 12pt;
  line-height: 1.75;
  color: #000;
}

/* ── Page breaks ───────────────────── */
.cover-page  { page-break-after: always; }
.toc-page    { page-break-after: always; }

h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
p { orphans: 3; widows: 3; margin: 0.5em 0; }

/* ── Cover page ───────────────────── */
.cover-page {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  min-height: 85vh;
  text-align: center;
  padding: 3em;
}
.cover-brand {
  font-variant: small-caps;
  font-size: 11pt;
  letter-spacing: 0.12em;
  color: #888;
  margin-bottom: 1em;
}
.cover-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.cover-title {
  font-size: 20pt;
  font-weight: bold;
  line-height: 1.4;
  margin-bottom: 0.4em;
}
.cover-pali {
  font-size: 13pt;
  font-style: italic;
  color: #555;
  margin-bottom: 0.2em;
}
.cover-subtitle {
  font-size: 12pt;
  font-style: italic;
  color: #555;
  margin-bottom: 0.2em;
}
.cover-from {
  font-size: 10.5pt;
  color: #777;
  margin-bottom: 0.8em;
}
.cover-rule {
  width: 80pt;
  border: none;
  border-top: 0.5pt solid #aaa;
  margin: 0.8em 0 1.2em;
}
.cover-desc {
  font-size: 11pt;
  font-weight: normal;
  line-height: 1.8;
  max-width: 540pt;
  color: #333;
}
.cover-footer {
  text-align: center;
}
.cover-url {
  font-size: 10pt;
  letter-spacing: 0.04em;
  color: #555;
  margin-bottom: 0.3em;
}
.cover-date {
  font-size: 9pt;
  color: #888;
  margin: 0;
}

/* ── Table of Contents ───────────────────────────────────── */
.toc-heading {
  font-size: 15pt;
  font-weight: bold;
  margin-bottom: 1.2em;
  padding-bottom: 0.3em;
  border-bottom: 1pt solid #aaa;
}
.toc-chapter-heading {
  font-size: 10pt;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #444;
  margin: 1.2em 0 0.3em;
}
.toc-entry { margin: 0.3em 0; }
.toc-link {
  color: #000;
  text-decoration: none;
  font-size: 11pt;
}
.toc-id {
  font-variant: small-caps;
  font-size: 10pt;
  color: #444;
}
.toc-desc {
  font-size: 9.5pt;
  color: #555;
  margin: 0.1em 0 0.5em 0;
  line-height: 1.5;
}
.toc-pali {
  font-style: italic;
  color: #888;
  margin-left: 0.5em;
  font-size: 10pt;
}

/* ── Chapter section ─────────────────────────────────────── */
.chapter-heading {
  font-size: 15pt;
  font-weight: bold;
  margin-bottom: 0.4em;
}
.chapter-desc {
  font-size: 10.5pt;
  line-height: 1.7;
  color: #333;
  margin-bottom: 1em;
}

/* ── Individual discourse ────────────────────────────────── */
.discourse-title {
  font-size: 13pt;
  font-weight: bold;
  margin-bottom: 0.15em;
}
.discourse-pali {
  font-style: italic;
  color: #777;
  font-size: 10.5pt;
  margin-bottom: 0.3em;
}
.discourse-desc {
  font-size: 10pt;
  color: #444;
  margin-bottom: 1.2em;
  line-height: 1.6;
  font-style: italic;
}
.discourse-body > p { margin: 0.55em 0; }

/* Pāli + English polytext — match web (MDContent) + verse quote bar (global .verse) */
.discourse-body .pali-paragraph {
  font-family: "Gentium Plus", "Times New Roman", Times, Georgia, serif;
  color: #333;
  opacity: 0.82;
  margin-bottom: 0.15em;
}
.discourse-body .english-paragraph {
  font-family: "Times New Roman", Times, Georgia, serif;
  color: #000;
  opacity: 1;
  margin-top: 0.35em;
  margin-bottom: 0.55em;
}
.discourse-body .pali-paragraph + .english-paragraph {
  margin-top: 0.18em;
}
/* English verse: left rule like .verse on the web */
.discourse-body .english-paragraph.verse {
  margin: 0.55em 0 0.65em 0;
  padding-left: 0.55em;
  border-left: 3pt solid #c5c5c5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
/* Pāli verse: lighter tone, subtle indent (web .verse-basic; no rule) */
.discourse-body .pali-paragraph.verse-basic {
  padding-left: 0.2em;
  margin-bottom: 0.25em;
}
.discourse-body .pali-paragraph strong,
.discourse-body .pali-paragraph b {
  color: #333;
  opacity: inherit;
}
/* Split: one row per EN/Pāli pair (aligns with web split + data-pair-id) */
.pdf-poly-split {
  display: flex;
  flex-direction: column;
  gap: 0.55em;
}
.pdf-poly-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 14pt;
  align-items: start;
}
.pdf-poly-row-full {
  display: block;
}
.pdf-poly-row-full .pdf-poly-full {
  width: 100%;
}
.pdf-poly-cell {
  min-width: 0;
}
.pdf-poly-cell .english-paragraph,
.pdf-poly-cell .pali-paragraph {
  margin-top: 0;
  margin-bottom: 0.35em;
}
.pdf-poly-cell .english-paragraph.verse {
  margin-top: 0.25em;
  margin-bottom: 0.45em;
}
.pdf-poly-cell-empty {
  min-height: 0.5em;
}
.pdf-poly-row-heading .pdf-poly-cell {
  margin-bottom: 0.2em;
}

/* Discourse header images (SVG diagrams, etc.) */
.pdf-discourse-image {
  margin: 0 0 2.5em 0;
  text-align: center;
	break-inside: auto;
	page-break-inside: auto;
	overflow: visible;
}
.pdf-discourse-image img,
.pdf-discourse-image-img {
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
	break-inside: auto;
	page-break-inside: auto;
}
.pdf-discourse-image svg {
	width: 100%;
	max-width: 100%;
  height: auto;
  display: block;
  margin: 0;
	break-inside: auto;
	page-break-inside: auto;
}

.verse-number {
  font-weight: bold;
  font-size: 10.5pt;
  color: #555;
  margin: 1em 0 0.2em;
}
.verse-block {
  margin: 0.4em 0 0.6em 1.5em;
  font-style: italic;
}
.content-h1 { font-size: 15pt; font-weight: bold; margin: 1em 0 0.4em; }
.content-h2 { font-size: 13pt; font-weight: bold; margin: 1em 0 0.3em; }
.content-h3 { font-size: 12pt; font-weight: bold; margin: 0.8em 0 0.2em; }

/* Bold inline terms */
b { font-weight: bold; }

/* ── Footnotes ───────────────────────────────────────────── */
.footnotes {
  margin-top: 1.8em;
  padding-top: 0.6em;
  border-top: 0.5pt solid #999;
  page-break-inside: avoid;
}
.fn-heading {
  font-weight: bold;
  font-size: 10pt;
  margin-bottom: 0.4em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.fn-item {
  font-size: 9.5pt;
  line-height: 1.55;
  margin: 0.25em 0;
}
.fn-pali { font-style: normal; }
.cn-ref {
  font-size: 7pt;
  vertical-align: super;
  line-height: 0;
  color: #555;
}
.cn-num { color: #555; font-style: normal; }

/* Lists */
ul, ol { margin: 0.5em 0 0.5em 1.5em; }
li { margin: 0.2em 0; }

/* Links  */
a { color: #000; text-decoration: none; }
`;
