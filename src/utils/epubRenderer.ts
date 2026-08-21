/**
 * EPUB 3 packaging for collection / topic exports.
 *
 * Reuses the same CollectionPdf HTML produced for PDF (MDX → HTML, Pāli,
 * key terms, diagrams). This module only splits that HTML into XHTML
 * chapters, writes a clickable nav document, and zips an EPUB.
 */

import type { CollectionPdf, DiscoursePdf } from "./pdfRenderer";
import { buildZip } from "./epubZip";
import {
	buildEpubCoverModel,
	renderEpubCoverPng,
	type EpubCoverAccentRole,
	type EpubCoverKind,
} from "./epubCover";
import {
	rasterizeSvgWithResvg,
	type SvgVizRasterMode,
} from "./svgRasterize";

export type EpubDiagramRasterizer = (svg: string) => Promise<Buffer>;

export type EpubBuildOptions = {
	collectionUrl: string;
	/** Display date on the cover; may include simple HTML such as <sup>. */
	date: string;
	parentTitle?: string;
	/** Override for tests; defaults to a random URN. */
	identifier?: string;
	/** Override modified timestamp for tests. */
	modified?: string;
	coverKind?: EpubCoverKind;
	coverAccentRole?: EpubCoverAccentRole;
	/** Topic / Quality / Simile — shown on the inner title page, not the shelf cover. */
	titleKindLabel?: string;
	/**
	 * Chromium screenshot at the SVG's authored size. When omitted, falls back
	 * to resvg at the same native pixel size (tests / no browser).
	 */
	rasterizeDiagram?: EpubDiagramRasterizer;
	/** Light / dark / thermal / e-ink baked into diagram PNGs. */
	vizImageMode?: SvgVizRasterMode;
};

type SpineItem = {
	id: string;
	href: string;
	title: string;
	body: string;
	images?: { href: string; data: string | Buffer }[];
};

type NavNode = {
	label: string;
	href?: string;
	children?: NavNode[];
};

const VOID_TAGS =
	"area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr";

/** Convert HTML5 fragments into XML-safe XHTML for EPUB 3 content docs. */
export function htmlToXhtml(html: string): string {
	return (
		html
			.replace(/<\?xml[\s\S]*?\?>/gi, "")
			.replace(/<!DOCTYPE[^>]*>/gi, "")
			.replace(/&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;")
			.replace(
				new RegExp(`<(${VOID_TAGS})(\\s[^>]*?)?\\s*>`, "gi"),
				(match, tag: string, attrs = "") => {
					if (/\/>\s*$/.test(match.trimEnd())) return match;
					return `<${tag}${attrs} />`;
				},
			)
	);
}

export function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/**
 * Fold Indic glyphs that Kobo’s UI font cannot draw (popup ToC / header).
 * Keeps macrons (ā ī ū ē ō) and ñ, which that chrome can render.
 */
const NCX_FOLD: Record<string, string> = {
	ṭ: "t",
	Ṭ: "T",
	ḍ: "d",
	Ḍ: "D",
	ṇ: "n",
	Ṇ: "N",
	ṅ: "n",
	Ṅ: "N",
	ḷ: "l",
	Ḷ: "L",
	ḹ: "l",
	Ḹ: "L",
	ṃ: "m",
	ṁ: "m",
	Ṃ: "M",
	Ṁ: "M",
	ṛ: "r",
	Ṛ: "R",
	ṝ: "r",
	Ṝ: "R",
	ṣ: "s",
	Ṣ: "S",
	ś: "s",
	Ś: "S",
	ḥ: "h",
	Ḥ: "H",
	ẖ: "h",
	ḵ: "k",
	Ḵ: "K",
	ḻ: "l",
	Ḻ: "L",
	ṉ: "n",
	Ṉ: "N",
	ṟ: "r",
	Ṟ: "R",
	ṯ: "t",
	Ṯ: "T",
	ḏ: "d",
	Ḏ: "D",
};

const NCX_FOLD_RE =
	/[ṭṬḍḌṇṆṅṄḷḶḹḸṃṁṂṀṛṚṝṜṣṢśŚḥḤẖḵḴḻḺṉṈṟṞṯṮḏḎ]/g;

export function foldNcxLabel(text: string): string {
	return text.replace(NCX_FOLD_RE, (ch) => NCX_FOLD[ch] ?? ch);
}

function formatSlugId(slug: string): string {
	const upper = slug.toUpperCase();
	const m = /^([A-Z]+)(\d.*)$/.exec(upper);
	return m ? `${m[1]} ${m[2]}` : upper;
}

function stripPaliPrefix(title: string): string {
	const idx = title.indexOf(" - ");
	if (idx === -1) return title;
	return title.slice(idx + 3);
}

function extractPaliName(title: string): string {
	const idx = title.indexOf(" - ");
	if (idx === -1) return "";
	return title.slice(0, idx).trim();
}

function fileStem(slug: string): string {
	const cleaned = slug.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
	return cleaned.replace(/^-+|-+$/g, "") || "item";
}

function xmlId(prefix: string, slug: string): string {
	return `${prefix}-${fileStem(slug).replace(/\./g, "-")}`;
}

function discourseCount(collection: CollectionPdf): number {
	return collection.chapters.reduce((n, ch) => {
		if (ch.vaggas && ch.vaggas.length > 0) {
			return (
				n +
				ch.vaggas.reduce((m, vagga) => m + vagga.discourses.length, 0)
			);
		}
		return n + ch.discourses.length;
	}, 0);
}

function discourseLabel(d: DiscoursePdf): string {
	const id = formatSlugId(d.slug);
	const displayTitle = stripPaliPrefix(d.title);
	return `${id} ${displayTitle}`.trim();
}

/** Drop a footnotes block that has a heading (or nothing) but no actual notes. */
function stripEmptyEpubFootnotes(html: string): string {
	return html.replace(
		/<section\b[^>]*\bclass="[^"]*\bfootnotes\b[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
		(section) => {
			const hasItems =
				/<p\b[^>]*\bclass="[^"]*\bfn-item\b/i.test(section) ||
				/<aside\b[^>]*epub:type="footnote"/i.test(section) ||
				/<aside\b[^>]*\bclass="[^"]*\bepub-footnote\b/i.test(section);
			return hasItems ? section : "";
		},
	);
}

/** Convert PDF-style commentary markers into EPUB popup footnotes, keeping the Notes list when it has items. */
export function enhanceEpubCommentaryNotes(html: string): string {
	return stripEmptyEpubFootnotes(
		html
			.replace(
				/<sup class="cn-ref">\[(\d+)\]<\/sup>/g,
				'<a class="cn-ref" id="noteref-$1" href="#note-$1" epub:type="noteref">[$1]</a>',
			)
			.replace(
				/<p class="fn-item"><span class="cn-num">\[(\d+)\]<\/span>([\s\S]*?)<\/p>/g,
				(_match, num: string, body: string) => {
					const prose = body.trim();
					return `<p class="fn-item" id="note-${num}-text"><span class="cn-num">[${num}]</span>${body}</p>\n<aside id="note-${num}" class="epub-footnote" epub:type="footnote" hidden="hidden"><p>${prose}</p></aside>`;
				},
			),
	);
}

/** Pull inline SVGs into standalone image files so labels keep their layout. */
export function extractEpubInlineSvgs(
	html: string,
	filePrefix: string,
): { html: string; files: { href: string; data: string }[] } {
	const files: { href: string; data: string }[] = [];
	let n = 0;
	const next = html.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
		n += 1;
		const href = `images/${filePrefix}-${n}.svg`;
		files.push({ href, data: svg });
		return `<img class="pdf-discourse-image-img" src="${href}" alt="" />`;
	});
	return { html: next, files };
}

function wrapXhtml(
	title: string,
	bodyInner: string,
	cssHref = "css/stylesheet.css",
): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(foldNcxLabel(title))}</title>
  <link rel="stylesheet" type="text/css" href="${cssHref}" />
</head>
<body>
${bodyInner}
</body>
</html>
`;
}

function splitCollectionTitle(title: string): {
	paliName: string;
	englishTitle: string;
} {
	const hasSeparator = title.includes(" - ");
	if (!hasSeparator) {
		return { paliName: "", englishTitle: title };
	}
	const idx = title.indexOf(" - ");
	return {
		paliName: title.slice(0, idx).trim(),
		englishTitle: title.slice(idx + 3).trim(),
	};
}

function titlePageBody(
	collection: CollectionPdf,
	options: EpubBuildOptions,
): string {
	const { paliName, englishTitle } = splitCollectionTitle(collection.title);
	const formattedId = formatSlugId(collection.slug);
	const subtitleLine =
		options.titleKindLabel ||
		[paliName, formattedId].filter(Boolean).join(" \u00B7 ");
	const fromLine = options.parentTitle
		? `<p class="cover-from">from ${escapeXml(options.parentTitle)}</p>`
		: "";
	const desc = collection.description
		? `<p class="cover-desc">${escapeXml(collection.description)}</p>`
		: "";
	return `<div class="cover-page">
  <p class="cover-brand">Words of the Buddha</p>
  <div class="cover-main">
    <h1 class="cover-title">${escapeXml(englishTitle)}</h1>
    <p class="cover-subtitle">${escapeXml(subtitleLine)}</p>
    ${fromLine}
    <hr class="cover-rule" />
    ${desc}
  </div>
  <div class="cover-footer">
    <p class="cover-url">${escapeXml(options.collectionUrl)}</p>
    <p class="cover-date">Downloaded on ${htmlToXhtml(options.date)}</p>
  </div>
</div>`;
}

function headingPageBody(title: string, description?: string): string {
	const desc = description
		? `<p class="chapter-desc">${escapeXml(description)}</p>`
		: "";
	return `<section class="chapter-section">
  <h1 class="chapter-heading">${escapeXml(title)}</h1>
  ${desc}
</section>`;
}

function discourseBody(d: DiscoursePdf): {
	body: string;
	images: { href: string; data: string }[];
} {
	const id = formatSlugId(d.slug);
	const displayTitle = stripPaliPrefix(d.title);
	const paliName = extractPaliName(d.title);
	const paliLine = paliName
		? `<p class="discourse-pali">${escapeXml(paliName)}</p>`
		: "";
	const desc = d.description
		? `<p class="discourse-desc">${escapeXml(d.description)}</p>`
		: "";
	const extracted = extractEpubInlineSvgs(
		enhanceEpubCommentaryNotes(d.html),
		`viz-${fileStem(d.slug)}`,
	);
	return {
		body: `<section class="discourse" id="${xmlId("d", d.slug)}">
  <h1 class="discourse-title">${escapeXml(`${id} ${displayTitle}`.trim())}</h1>
  ${paliLine}
  ${desc}
  <div class="discourse-body">${htmlToXhtml(extracted.html)}</div>
</section>`,
		images: extracted.files,
	};
}

function collectSpineAndNav(collection: CollectionPdf): {
	spine: SpineItem[];
	nav: NavNode[];
} {
	const spine: SpineItem[] = [];
	const nav: NavNode[] = [];

	const pushItem = (
		id: string,
		href: string,
		title: string,
		body: string,
		images?: { href: string; data: string }[],
	): SpineItem => {
		const item = { id, href, title, body, images };
		spine.push(item);
		return item;
	};

	for (const ch of collection.chapters) {
		let chapterNav: NavNode | null = null;

		if (collection.hasChapters) {
			const href = `chapter-${fileStem(ch.slug)}.xhtml`;
			const id = xmlId("ch", ch.slug);
			pushItem(id, href, ch.title, headingPageBody(ch.title, ch.description));
			chapterNav = { label: ch.title, href, children: [] };
			nav.push(chapterNav);
		}

		const vaggaGroups =
			ch.vaggas && ch.vaggas.length > 0
				? ch.vaggas
				: [{ slug: "", title: "", discourses: ch.discourses }];

		for (const vagga of vaggaGroups) {
			let parent: NavNode | NavNode[] = chapterNav ?? nav;

			if (vagga.title) {
				const vSlug = `${ch.slug}-${vagga.slug || fileStem(vagga.title)}`;
				const href = `vagga-${fileStem(vSlug)}.xhtml`;
				const id = xmlId("vg", vSlug);
				pushItem(
					id,
					href,
					vagga.title,
					headingPageBody(vagga.title, vagga.description),
				);
				const vaggaNav: NavNode = {
					label: vagga.title,
					href,
					children: [],
				};
				if (Array.isArray(parent)) {
					parent.push(vaggaNav);
				} else {
					parent.children = parent.children ?? [];
					parent.children.push(vaggaNav);
				}
				parent = vaggaNav;
			}

			for (const d of vagga.discourses) {
				const href = `d-${fileStem(d.slug)}.xhtml`;
				const id = xmlId("item", d.slug);
				const title = discourseLabel(d);
				const rendered = discourseBody(d);
				pushItem(id, href, title, rendered.body, rendered.images);
				const node: NavNode = { label: title, href };
				if (Array.isArray(parent)) {
					parent.push(node);
				} else {
					parent.children = parent.children ?? [];
					parent.children.push(node);
				}
			}
		}
	}

	return { spine, nav };
}

function renderNavOl(nodes: NavNode[], foldLabels = false): string {
	const items = nodes
		.map((node) => {
			const raw = foldLabels ? foldNcxLabel(node.label) : node.label;
			const label = escapeXml(raw);
			const heading = node.href
				? `<a href="${escapeXml(node.href)}">${label}</a>`
				: `<span>${label}</span>`;
			const kids =
				node.children && node.children.length > 0
					? `\n${renderNavOl(node.children, foldLabels)}`
					: "";
			return `    <li>${heading}${kids}</li>`;
		})
		.join("\n");
	return `  <ol>\n${items}\n  </ol>`;
}

/** In-book contents page — full IAST, reading font. */
function tocPageDocument(nav: NavNode[]): string {
	const toc = renderNavOl(nav, false);
	const body = `<h1>Table of Contents</h1>
<nav epub:type="toc" id="toc">
${toc}
</nav>`;
	return wrapXhtml("Table of Contents", body);
}

/** EPUB 3 machine nav — folded labels for reader chrome (Kobo popup, Apple sidebar). */
function navDocument(nav: NavNode[]): string {
	const toc = renderNavOl(nav, true);
	const body = `<nav epub:type="toc" id="toc">
${toc}
</nav>
<nav epub:type="landmarks" id="landmarks" hidden="hidden">
  <ol>
    <li><a epub:type="bodymatter" href="title.xhtml">Beginning</a></li>
    <li><a epub:type="toc" href="toc.xhtml">Table of Contents</a></li>
  </ol>
</nav>`;
	return wrapXhtml("Table of Contents", body);
}

/** Kobo’s popup ToC only reliably lists top-level NCX points. */
function flattenNavHrefs(nodes: NavNode[]): NavNode[] {
	const out: NavNode[] = [];
	const walk = (list: NavNode[]) => {
		for (const node of list) {
			if (node.href) out.push({ label: node.label, href: node.href });
			if (node.children?.length) walk(node.children);
		}
	};
	walk(nodes);
	return out;
}

/** EPUB 2 NCX — Kobo uses this for the popup ToC and “where am I”. */
export function ncxDocument(
	nav: NavNode[],
	identifier: string,
	docTitle: string,
): string {
	let order = 0;
	const points = [
		{ label: docTitle, href: "title.xhtml" },
		{ label: "Table of Contents", href: "toc.xhtml" },
		...flattenNavHrefs(nav),
	]
		.map((node) => {
			order += 1;
			return `    <navPoint id="np-${order}" playOrder="${order}">
      <navLabel><text>${escapeXml(foldNcxLabel(node.label))}</text></navLabel>
      <content src="${escapeXml(node.href)}"/>
    </navPoint>`;
		})
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="3"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(foldNcxLabel(docTitle))}</text></docTitle>
  <navMap>
${points}
  </navMap>
</ncx>
`;
}

function coverPageXhtml(): string {
	return wrapXhtml(
		"Cover",
		`<div class="epub-cover-image"><img src="images/cover.png" alt="" /></div>`,
	);
}

function isoNow(override?: string): string {
	if (override) return override;
	return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function packageOpf(
	collection: CollectionPdf,
	options: EpubBuildOptions,
	spine: SpineItem[],
	identifier: string,
	modified: string,
): string {
	const { englishTitle } = splitCollectionTitle(collection.title);
	const manifestItems = [
		`<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>`,
		`<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml"/>`,
		`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
		`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
		`<item id="css" href="css/stylesheet.css" media-type="text/css"/>`,
		`<item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
		`<item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image"/>`,
		...spine.flatMap((item) =>
			(item.images ?? []).map((img) => {
				return `<item id="${xmlId("viz", img.href)}" href="${escapeXml(img.href)}" media-type="${imageMediaType(img.href)}"/>`;
			}),
		),
		...spine.map(
			(item) =>
				`<item id="${item.id}" href="${item.href}" media-type="application/xhtml+xml"/>`,
		),
	].join("\n    ");

	const spineRefs = [
		`<itemref idref="cover-page" linear="no"/>`,
		`<itemref idref="title"/>`,
		`<itemref idref="toc"/>`,
		`<itemref idref="nav" linear="no"/>`,
		...spine.map((item) => `<itemref idref="${item.id}"/>`),
	].join("\n    ");

	const source = options.collectionUrl.startsWith("http")
		? options.collectionUrl
		: `https://${options.collectionUrl.replace(/^\/+/, "")}`;

	return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(englishTitle)}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Words of the Buddha</dc:creator>
    <dc:publisher>wordsofthebuddha.org</dc:publisher>
    <dc:source>${escapeXml(source)}</dc:source>
    <meta property="dcterms:modified">${escapeXml(modified)}</meta>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${spineRefs}
  </spine>
  <guide>
    <reference type="cover" title="Cover" href="cover.xhtml"/>
    <reference type="toc" title="Table of Contents" href="toc.xhtml"/>
  </guide>
</package>
`;
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

const EPUB_CSS = `* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
}

body {
  font-family: Georgia, "Times New Roman", Times, serif;
  font-size: 1em;
  line-height: 1.65;
  color: #111;
}

h1, h2, h3, h4, h5, h6 {
  line-height: 1.3;
  page-break-after: avoid;
}

p { margin: 0.55em 0; }

.cover-page {
  text-align: center;
  padding: 2em 1em;
}
.cover-brand {
  font-variant: small-caps;
  letter-spacing: 0.12em;
  color: #888;
  margin-bottom: 2em;
  text-align: center;
}
.cover-main {
  text-align: center;
  width: 100%;
}
.cover-title,
h1.cover-title {
  font-size: 1.6em;
  font-weight: bold;
  margin: 0.4em auto;
  text-align: center;
  width: 100%;
}
.cover-subtitle {
  font-style: italic;
  color: #555;
  margin-bottom: 0.4em;
  text-align: center;
}
.cover-from {
  color: #555;
  margin: 0.3em 0;
  text-align: center;
}
.cover-rule {
  width: 40%;
  margin: 1.4em auto;
  border: none;
  border-top: 1px solid #ccc;
}
.cover-desc {
  font-size: 0.95em;
  line-height: 1.6;
  color: #333;
  max-width: 32em;
  margin: 0 auto;
  text-align: center;
}
.cover-footer {
  margin-top: 3em;
  font-size: 0.85em;
  color: #777;
  text-align: center;
}
.cover-url, .cover-date { margin: 0.2em 0; }

.chapter-heading, .vagga-heading {
  font-size: 1.25em;
  font-weight: bold;
  margin-bottom: 0.4em;
}
.chapter-desc, .vagga-desc {
  font-size: 0.95em;
  color: #444;
  font-style: italic;
}

.discourse-title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 0.15em;
}
.discourse-pali {
  font-style: italic;
  color: #666;
  font-size: 0.95em;
  margin-bottom: 0.3em;
}
.discourse-desc {
  font-size: 0.92em;
  color: #444;
  margin-bottom: 1em;
  font-style: italic;
}

.discourse-body .paragraph-num,
.discourse-body .copy-para-break { display: none; }

.discourse-body .pali-paragraph {
  color: #333;
  opacity: 0.88;
  margin-bottom: 0.15em;
}
.discourse-body .english-paragraph {
  color: #111;
  margin-top: 0.25em;
  margin-bottom: 0.7em;
}
.discourse-body .english-paragraph.verse {
  margin: 0.55em 0 0.65em 0;
  padding-left: 0.55em;
  border-left: 3px solid #c5c5c5;
}
.discourse-body .pali-paragraph.verse-basic {
  padding-left: 0.2em;
}

.pdf-discourse-image {
  margin: 0 0 1.5em 0;
  text-align: center;
}
.pdf-discourse-image svg,
.pdf-discourse-image img,
.pdf-discourse-image-img {
  width: 100%;
  max-width: 100%;
  height: auto;
}

.epub-cover-image {
  margin: 0;
  padding: 0;
  text-align: center;
}
.epub-cover-image img {
  width: 100%;
  height: auto;
}

.verse-number {
  font-weight: bold;
  color: #555;
  margin: 1em 0 0.2em;
}
.verse-block {
  margin: 0.4em 0 0.6em 1.2em;
  font-style: italic;
}

.footnotes {
  margin-top: 1.6em;
  padding-top: 0.6em;
  border-top: 1px solid #999;
}
.fn-heading {
  font-weight: bold;
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.fn-item {
  font-size: 0.9em;
  line-height: 1.5;
  margin: 0.25em 0;
}
aside.epub-footnote {
  display: none;
}
a.cn-ref {
  font-size: 0.75em;
  vertical-align: super;
  line-height: 0;
  text-decoration: none;
}
.cn-num { color: #555; }

ul, ol { margin: 0.5em 0 0.5em 1.4em; }
li { margin: 0.2em 0; }

a { color: inherit; text-decoration: none; }
nav#toc a { text-decoration: underline; }
`;

function imageMediaType(href: string): string {
	const lower = href.toLowerCase();
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	return "image/svg+xml";
}

export function collectionHasInlineSvg(collection: CollectionPdf): boolean {
	return collection.chapters.some((ch) =>
		ch.discourses.some((d) => /<svg\b/i.test(d.html)),
	);
}

async function rasterizeSpineDiagrams(
	spine: SpineItem[],
	rasterize?: EpubDiagramRasterizer,
	optionsViz?: SvgVizRasterMode,
): Promise<void> {
	const needsRaster = spine.some((item) =>
		(item.images ?? []).some((img) => img.href.toLowerCase().endsWith(".svg")),
	);
	if (!needsRaster) return;

	const vizMode: SvgVizRasterMode =
		optionsViz === "light" ||
		optionsViz === "thermal" ||
		optionsViz === "eink"
			? optionsViz
			: "dark";
	const render =
		rasterize ??
		((svg: string) => rasterizeSvgWithResvg(svg, { vizMode }));
	for (const item of spine) {
		if (!item.images?.length) continue;
		const next: NonNullable<SpineItem["images"]> = [];
		for (const img of item.images) {
			if (typeof img.data !== "string" || !img.href.toLowerCase().endsWith(".svg")) {
				next.push(img);
				continue;
			}
			try {
				const pngHref = img.href.replace(/\.svg$/i, ".png");
				next.push({ href: pngHref, data: await render(img.data) });
				item.body = item.body.split(img.href).join(pngHref);
			} catch {
				const imgRe = new RegExp(
					`<img\\b[^>]*src="${img.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>`,
					"g",
				);
				item.body = item.body.replace(
					imgRe,
					'<p class="viz-fallback">Diagram omitted.</p>',
				);
			}
		}
		item.images = next;
	}
}

/**
 * Build an EPUB 3 zip buffer from already-rendered collection HTML.
 */
export async function buildCollectionEpub(
	collection: CollectionPdf,
	options: EpubBuildOptions,
): Promise<Buffer> {
	const identifier =
		options.identifier ?? `urn:uuid:${crypto.randomUUID()}`;
	const modified = isoNow(options.modified);
	const { spine, nav } = collectSpineAndNav(collection);
	await rasterizeSpineDiagrams(
		spine,
		options.rasterizeDiagram,
		options.vizImageMode,
	);
	const coverModel = buildEpubCoverModel({
		slug: collection.slug,
		title: collection.title,
		parentTitle: options.parentTitle,
		kind: options.coverKind,
		accentRole: options.coverAccentRole,
		discourseCount: discourseCount(collection),
	});
	const { englishTitle } = splitCollectionTitle(collection.title);

	return buildZip([
		{ name: "mimetype", data: "application/epub+zip", store: true },
		{ name: "META-INF/container.xml", data: CONTAINER_XML },
		{
			name: "EPUB/package.opf",
			data: packageOpf(collection, options, spine, identifier, modified),
		},
		{
			name: "EPUB/toc.ncx",
			data: ncxDocument(nav, identifier, englishTitle),
		},
		{
			name: "EPUB/cover.xhtml",
			data: coverPageXhtml(),
		},
		{
			name: "EPUB/title.xhtml",
			data: wrapXhtml(
				englishTitle,
				titlePageBody(collection, options),
			),
		},
		{ name: "EPUB/toc.xhtml", data: tocPageDocument(nav) },
		{ name: "EPUB/nav.xhtml", data: navDocument(nav) },
		{ name: "EPUB/css/stylesheet.css", data: EPUB_CSS },
		{
			name: "EPUB/images/cover.png",
			data: await renderEpubCoverPng(coverModel),
		},
		...spine.flatMap((item) =>
			(item.images ?? []).map((img) => ({
				name: `EPUB/${img.href}`,
				data: img.data,
			})),
		),
		...spine.map((item) => ({
			name: `EPUB/${item.href}`,
			data: wrapXhtml(item.title, item.body),
		})),
	]);
}
