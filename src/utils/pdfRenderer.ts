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
import type { DirectoryStructure } from "../types/directory";
import { findEntry, findEntriesBySlugPrefix } from "./textApi";

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
	return `<h${level} class="content-h${level}">${text}</h${level}>\n`;
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
		(_, term, def) =>
			`<span class="tt" data-def="${def.trim().replace(/"/g, "&quot;").replace(/'/g, "&#39;")}">${term.trim()}</span>`,
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

// ---------------------------------------------------------------------------
// Step 4: Server-side tooltip → footnote transformation (jsdom)
// ---------------------------------------------------------------------------

/**
 * Converts all .tt[data-def] spans to footnote references.
 * Appends a <section class="footnotes"> at the end of the HTML.
 * Duplicate terms (by text) are de-annotated after first occurrence.
 */
export function processFootnotes(html: string): string {
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
	if (notes.length > 0) {
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

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

const MAX_DISCOURSES = 150; // Guard against accidentally huge collections

async function fetchDiscourseHtml(slug: string): Promise<string> {
	const entry = await findEntry("en", { slug });
	if (!entry?.body) return "<p><em>(Content not available)</em></p>";
	let html = mdxBodyToHtml(entry.body);
	html = processFootnotes(html);
	html = processCommentaryNotes(html, (entry.data as any)?.commentary);
	return html;
}

async function fetchChapterDiscourses(
	chapterSlug: string,
	range?: { start: number; end: number },
): Promise<DiscoursePdf[]> {
	// Range-based chapters like mn1-50, iti28-49:
	// extract the alphabetic base ("mn", "iti") and filter by number in range.
	const rangeMatch = /^([a-z]+)(\d+)-(\d+)$/i.exec(chapterSlug);

	let entries: Awaited<ReturnType<typeof findEntriesBySlugPrefix>>;
	if (rangeMatch) {
		const base = rangeMatch[1].toLowerCase();
		const lo = range?.start ?? Number(rangeMatch[2]);
		const hi = range?.end ?? Number(rangeMatch[3]);
		// Fetch all entries that start with the base prefix
		const all = await findEntriesBySlugPrefix("en", base);
		entries = all.filter((e) => {
			const slug = ((e.data as any)?.slug || (e as any).slug || "")
				.trim()
				.toLowerCase();
			const numMatch = new RegExp(`^${base}(\\d+)$`).exec(slug);
			if (!numMatch) return false;
			const num = Number(numMatch[1]);
			return num >= lo && num <= hi;
		});
	} else {
		// Numbered chapters (sn1, ud5 …) have discourses like sn1.1, so append dot.
		// Letter-only top-level collections (ud, kp, dhp …) match with no dot.
		const prefix = /\d$/.test(chapterSlug)
			? `${chapterSlug}.`
			: chapterSlug;
		entries = await findEntriesBySlugPrefix("en", prefix);
	}

	const limited = entries.slice(0, MAX_DISCOURSES);

	// Render body for each discourse in parallel
	const discourses = await Promise.all(
		limited.map(async (entry) => {
			const slug = (entry.data as any)?.slug || entry.slug || "";
			const title = (entry.data as any)?.title || slug;
			const description = (entry.data as any)?.description || "";
			const html = await fetchDiscourseHtml(slug);
			return { slug, title, description, html };
		}),
	);

	// Natural sort so sn1.9 comes before sn1.10 etc.
	discourses.sort((a, b) =>
		a.slug.localeCompare(b.slug, undefined, { numeric: true }),
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
): Promise<CollectionPdf> {
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
		const discourses = await fetchChapterDiscourses(slug);
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
export function buildPdfHtml(
	collection: CollectionPdf,
	options: {
		collectionUrl: string;
		date: string;
		parentTitle?: string;
	},
): string {
	const { collectionUrl, date, parentTitle } = options;
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
<html lang="en">
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
