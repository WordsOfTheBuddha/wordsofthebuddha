import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildCollectionEpub,
	extractEpubInlineSvgs,
	enhanceEpubCommentaryNotes,
	foldNcxLabel,
	htmlToXhtml,
	ncxDocument,
} from "./epubRenderer";
import {
	extractZipEntry,
	firstZipEntryName,
	listZipEntryNames,
} from "./epubZip";
import type { CollectionPdf } from "./pdfRenderer";

const sample: CollectionPdf = {
	slug: "ud1",
	title: "Bodhivagga - Chapter 1 - The Tree of Awakening",
	description: "The first chapter of the Udāna.",
	hasChapters: false,
	chapters: [
		{
			slug: "ud1",
			title: "Chapter 1",
			description: "",
			discourses: [
				{
					slug: "ud1.1",
					title: "Paṭhama bodhi sutta - Upon Awakening (First)",
					description: "The Buddha attends to dependent origination.",
					html: `<p class="english-paragraph">Thus have I heard.</p><br><img src="x.png"><hr>`,
				},
				{
					slug: "ud1.2",
					title: "Dutiya bodhi sutta - Upon Awakening (Second)",
					description: "",
					html: `<p>Key terms &amp; notes</p>`,
				},
			],
		},
	],
};

describe("enhanceEpubCommentaryNotes", () => {
	it("links superscripts to footnote asides without dropping Notes", () => {
		const html = `<p>Heard.<sup class="cn-ref">[1]</sup></p>
<section class="footnotes">
<p class="fn-heading">Notes</p>
<p class="fn-item"><span class="cn-num">[1]</span> A comment.</p>
</section>`;
		const out = enhanceEpubCommentaryNotes(html);
		assert.match(out, /epub:type="noteref"/);
		assert.match(out, /<aside id="note-1"[^>]*epub:type="footnote"/);
		assert.match(out, /fn-heading">Notes/);
	});

	it("drops empty footnotes sections", () => {
		const headingOnly = `<p>Heard.</p>
<section class="footnotes">
<p class="fn-heading">Notes</p>
</section>`;
		const emptySection = `<p>Heard.</p>
<section class="footnotes"></section>`;
		for (const html of [headingOnly, emptySection]) {
			const out = enhanceEpubCommentaryNotes(html);
			assert.match(out, /Heard/);
			assert.doesNotMatch(out, /fn-heading/);
			assert.doesNotMatch(out, /class="footnotes"/);
			assert.doesNotMatch(out, /NOTES/i);
		}
	});
});

describe("extractEpubInlineSvgs", () => {
	it("moves diagrams into image files without changing their markup", () => {
		const html = `<p>Body</p><svg viewBox="0 0 10 10"><text font-size="10">label</text></svg>`;
		const out = extractEpubInlineSvgs(html, "viz-mn2");
		assert.match(out.html, /<img class="pdf-discourse-image-img" src="images\/viz-mn2-1.svg"/);
		assert.equal(out.files.length, 1);
		assert.match(out.files[0].data, /font-size="10"/);
		assert.match(out.html, /<p>Body<\/p>/);
	});
});

describe("foldNcxLabel", () => {
	it("folds Kobo-unsafe underdots while keeping macrons and ñ", () => {
		assert.equal(foldNcxLabel("Satipaṭṭhāna"), "Satipatthāna");
		assert.equal(foldNcxLabel("Mūlapaṇṇāsa"), "Mūlapannāsa");
		assert.equal(foldNcxLabel("ñāṇa"), "ñāna");
		assert.equal(foldNcxLabel("saṁsāra"), "samsāra");
		assert.equal(foldNcxLabel("saṃsāra"), "samsāra");
		assert.equal(foldNcxLabel("duḥkha"), "duhkha");
		assert.equal(foldNcxLabel("ḻaẖa"), "laha");
	});
});

describe("ncxDocument", () => {
	it("lists nested discourses as top-level points", () => {
		const ncx = ncxDocument(
			[
				{
					label: "Chapter 1",
					href: "chapter-sn1.xhtml",
					children: [{ label: "SN 1.1 Crossing", href: "d-sn1.1.xhtml" }],
				},
			],
			"urn:uuid:ncx",
			"Sagāthāvagga",
		);
		assert.match(ncx, /src="title.xhtml"/);
		assert.match(ncx, /src="toc.xhtml"/);
		assert.match(ncx, /src="chapter-sn1.xhtml"/);
		assert.match(ncx, /src="d-sn1.1.xhtml"/);
		assert.doesNotMatch(ncx, /<content[^/]*\/>\s*<navPoint/);
		assert.match(ncx, /Sagāthāvagga/);
	});

	it("folds Kobo-unsafe glyphs in navLabel text but not hrefs", () => {
		const ncx = ncxDocument(
			[
				{
					label: "MN 10 Satipaṭṭhāna",
					href: "d-mn10.xhtml",
				},
			],
			"urn:uuid:ncx",
			"Mūlapaṇṇāsa",
		);
		assert.match(ncx, /<navLabel><text>MN 10 Satipatthāna<\/text><\/navLabel>/);
		assert.match(ncx, /<navLabel><text>Mūlapannāsa<\/text><\/navLabel>/);
		assert.match(ncx, /<docTitle><text>Mūlapannāsa<\/text><\/docTitle>/);
		assert.match(ncx, /src="d-mn10.xhtml"/);
		assert.doesNotMatch(ncx, /ṭ/);
		assert.doesNotMatch(ncx, /ṇ/);
	});
});

describe("htmlToXhtml", () => {
	it("self-closes void tags and leaves existing entities", () => {
		const out = htmlToXhtml(
			`<p>a &amp; b</p><br><img src="x.png"><hr>`,
		);
		assert.match(out, /<br \/>/);
		assert.match(out, /<img src="x.png" \/>/);
		assert.match(out, /<hr \/>/);
		assert.match(out, /a &amp; b/);
	});

	it("escapes bare ampersands", () => {
		assert.equal(htmlToXhtml("A & B"), "A &amp; B");
	});
});

describe("buildCollectionEpub", () => {
	it("packages a valid EPUB 3 with a clickable nav", async () => {
		const buf = await buildCollectionEpub(sample, {
			collectionUrl: "www.wordsofthebuddha.org/ud1",
			date: "20<sup>th</sup> August 2026",
			identifier: "urn:uuid:test-ud1",
			modified: "2026-08-20T00:00:00Z",
		});

		assert.equal(firstZipEntryName(buf), "mimetype");
		assert.equal(buf.readUInt16LE(8), 0, "mimetype must be stored uncompressed");
		const mime = extractZipEntry(buf, "mimetype")?.toString("utf8");
		assert.equal(mime, "application/epub+zip");

		const names = listZipEntryNames(buf);
		assert.ok(names.includes("META-INF/container.xml"));
		assert.ok(names.includes("EPUB/package.opf"));
		assert.ok(names.includes("EPUB/nav.xhtml"));
		assert.ok(names.includes("EPUB/toc.xhtml"));
		assert.ok(names.includes("EPUB/title.xhtml"));
		assert.ok(names.includes("EPUB/toc.ncx"));
		assert.ok(names.includes("EPUB/cover.xhtml"));
		assert.ok(names.includes("EPUB/images/cover.png"));
		assert.ok(names.includes("EPUB/d-ud1.1.xhtml"));
		assert.ok(names.includes("EPUB/d-ud1.2.xhtml"));

		const tocPage = extractZipEntry(buf, "EPUB/toc.xhtml")?.toString("utf8");
		assert.ok(tocPage);
		assert.match(tocPage, /epub:type="toc"/);
		assert.match(tocPage, /href="d-ud1.1.xhtml"/);
		assert.match(tocPage, /Upon Awakening \(First\)/);

		const nav = extractZipEntry(buf, "EPUB/nav.xhtml")?.toString("utf8");
		assert.ok(nav);
		assert.match(nav, /epub:type="toc"/);
		assert.match(nav, /href="d-ud1.1.xhtml"/);
		assert.match(nav, /Upon Awakening \(First\)/);

		const chapter = extractZipEntry(buf, "EPUB/d-ud1.1.xhtml")?.toString(
			"utf8",
		);
		assert.ok(chapter);
		assert.match(chapter, /Thus have I heard/);
		assert.match(chapter, /<br \/>/);

		const opf = extractZipEntry(buf, "EPUB/package.opf")?.toString("utf8");
		assert.ok(opf);
		assert.match(opf, /properties="nav"/);
		assert.match(opf, /properties="cover-image"/);
		assert.match(opf, /images\/cover\.png/);
		assert.match(opf, /media-type="image\/png"/);
		assert.match(opf, /spine toc="ncx"/);
		assert.match(opf, /idref="cover-page" linear="no"/);
		assert.doesNotMatch(opf, /<itemref idref="cover"\/>/);
		assert.match(opf, /<itemref idref="title"\/>/);
		assert.match(opf, /<itemref idref="toc"\/>/);
		assert.match(opf, /idref="nav" linear="no"/);
		assert.match(opf, /href="toc.xhtml"/);

		const navDoc = extractZipEntry(buf, "EPUB/nav.xhtml")?.toString("utf8");
		assert.ok(navDoc);
		assert.match(navDoc, /epub:type="bodymatter" href="title.xhtml"/);
		assert.match(navDoc, /epub:type="toc" href="toc.xhtml"/);

		const titlePage = extractZipEntry(buf, "EPUB/title.xhtml")?.toString(
			"utf8",
		);
		assert.ok(titlePage);
		assert.match(titlePage, /Words of the Buddha/);
		assert.match(titlePage, /class="cover-title"/);
		assert.match(titlePage, /The Tree of Awakening/);
		assert.match(titlePage, /Downloaded on 20<sup>th<\/sup> August 2026/);

		const css = extractZipEntry(buf, "EPUB/css/stylesheet.css")?.toString(
			"utf8",
		);
		assert.ok(css);
		assert.match(css, /h1\.cover-title \{[^}]*text-align: center/s);

		const png = extractZipEntry(buf, "EPUB/images/cover.png");
		assert.ok(png);
		assert.equal(png[0], 0x89);
		assert.equal(png.toString("ascii", 1, 4), "PNG");

		const ncx = extractZipEntry(buf, "EPUB/toc.ncx")?.toString("utf8");
		assert.ok(ncx);
		assert.match(ncx, /<ncx /);
		assert.match(ncx, /src="toc.xhtml"/);
		assert.match(ncx, /src="d-ud1.1.xhtml"/);
		assert.match(ncx, /Upon Awakening \(First\)/);
	});

	it("turns commentary markers into EPUB noterefs and keeps Notes", async () => {
		const withNotes: CollectionPdf = {
			...sample,
			chapters: [
				{
					...sample.chapters[0],
					discourses: [
						{
							slug: "ud1.1",
							title: "Upon Awakening",
							description: "",
							html: `<p class="english-paragraph">Thus have I heard.<sup class="cn-ref">[1]</sup></p>
<section class="footnotes">
<p class="fn-heading">Notes</p>
<p class="fn-item"><span class="cn-num">[1]</span> A comment.</p>
</section>`,
						},
					],
				},
			],
		};
		const buf = await buildCollectionEpub(withNotes, {
			collectionUrl: "www.wordsofthebuddha.org/ud1",
			date: "20 August 2026",
			identifier: "urn:uuid:test-notes",
			modified: "2026-08-20T00:00:00Z",
		});
		const chapter = extractZipEntry(buf, "EPUB/d-ud1.1.xhtml")?.toString(
			"utf8",
		);
		assert.ok(chapter);
		assert.match(chapter, /epub:type="noteref"/);
		assert.match(chapter, /href="#note-1"/);
		assert.match(chapter, /epub:type="footnote"/);
		assert.match(chapter, /id="note-1"/);
		assert.match(chapter, /fn-heading">Notes/);
	});

	it("omits empty footnotes sections from chapter XHTML", async () => {
		const emptyNotes: CollectionPdf = {
			...sample,
			chapters: [
				{
					...sample.chapters[0],
					discourses: [
						{
							slug: "ud1.1",
							title: "Upon Awakening",
							description: "",
							html: `<p class="english-paragraph">Thus have I heard.</p>
<section class="footnotes">
<p class="fn-heading">Notes</p>
</section>`,
						},
					],
				},
			],
		};
		const buf = await buildCollectionEpub(emptyNotes, {
			collectionUrl: "www.wordsofthebuddha.org/ud1",
			date: "20 August 2026",
			identifier: "urn:uuid:test-empty-notes",
			modified: "2026-08-20T00:00:00Z",
		});
		const chapter = extractZipEntry(buf, "EPUB/d-ud1.1.xhtml")?.toString(
			"utf8",
		);
		assert.ok(chapter);
		assert.match(chapter, /Thus have I heard/);
		assert.doesNotMatch(chapter, /fn-heading/);
		assert.doesNotMatch(chapter, /NOTES/i);
		assert.doesNotMatch(chapter, /class="footnotes"/);
	});

	it("packages discourse diagrams as image files", async () => {
		const withViz: CollectionPdf = {
			...sample,
			chapters: [
				{
					...sample.chapters[0],
					discourses: [
						{
							slug: "mn2",
							title: "Sabbāsava sutta",
							description: "",
							html: `<figure class="pdf-discourse-image"><svg viewBox="0 0 20 20"><text font-size="10">Restraint</text></svg></figure><p>After.</p>`,
						},
					],
				},
			],
		};
		const buf = await buildCollectionEpub(withViz, {
			collectionUrl: "www.wordsofthebuddha.org/mn2",
			date: "20 August 2026",
			identifier: "urn:uuid:test-viz",
			modified: "2026-08-20T00:00:00Z",
		});
		const names = listZipEntryNames(buf);
		assert.ok(names.includes("EPUB/images/viz-mn2-1.png"));
		assert.ok(!names.includes("EPUB/images/viz-mn2-1.svg"));
		const chapter = extractZipEntry(buf, "EPUB/d-mn2.xhtml")?.toString(
			"utf8",
		);
		assert.ok(chapter);
		assert.match(chapter, /src="images\/viz-mn2-1.png"/);
		assert.doesNotMatch(chapter, /<svg /);
		const png = extractZipEntry(buf, "EPUB/images/viz-mn2-1.png");
		assert.ok(png);
		assert.equal(png[0], 0x89);
	});

	it("shows Quality on the inner title page instead of repeating the slug", async () => {
		const qualityPage: CollectionPdf = {
			...sample,
			slug: "perceiving-drawback",
			title: "Perceiving Drawback",
			description: "The contemplative perception of danger.",
		};
		const buf = await buildCollectionEpub(qualityPage, {
			collectionUrl:
				"www.wordsofthebuddha.org/on/perceiving-drawback",
			date: "20 August 2026",
			identifier: "urn:uuid:test-quality",
			modified: "2026-08-20T00:00:00Z",
			coverKind: "topic",
			coverAccentRole: "positive",
			titleKindLabel: "Quality",
		});
		const titlePage = extractZipEntry(buf, "EPUB/title.xhtml")?.toString(
			"utf8",
		);
		assert.ok(titlePage);
		assert.match(titlePage, /Perceiving Drawback/);
		assert.match(titlePage, />Quality</);
		assert.doesNotMatch(titlePage, /PERCEIVING-DRAWBACK/);
	});

	it("nests chapter and discourse links in the nav", async () => {
		const nested: CollectionPdf = {
			slug: "sn1-11",
			title: "Sagāthāvagga",
			description: "",
			hasChapters: true,
			chapters: [
				{
					slug: "sn1",
					title: "SN 1 Devatāsaṁyutta",
					description: "With deities",
					discourses: [
						{
							slug: "sn1.1",
							title: "Crossing the Flood",
							description: "",
							html: "<p>Crossing.</p>",
						},
					],
				},
			],
		};
		const buf = await buildCollectionEpub(nested, {
			collectionUrl: "www.wordsofthebuddha.org/sn1-11",
			date: "20 August 2026",
			identifier: "urn:uuid:test-sn",
			modified: "2026-08-20T00:00:00Z",
		});
		const names = listZipEntryNames(buf);
		assert.ok(names.includes("EPUB/chapter-sn1.xhtml"));
		assert.ok(names.includes("EPUB/d-sn1.1.xhtml"));
		const tocPage = extractZipEntry(buf, "EPUB/toc.xhtml")?.toString(
			"utf8",
		);
		assert.ok(tocPage);
		assert.match(tocPage, /href="chapter-sn1.xhtml"/);
		assert.match(tocPage, /href="d-sn1.1.xhtml"/);
		assert.match(tocPage, /Devatāsaṁyutta/);

		const nav = extractZipEntry(buf, "EPUB/nav.xhtml")?.toString("utf8");
		assert.ok(nav);
		assert.match(nav, /href="chapter-sn1.xhtml"/);
		assert.match(nav, /href="d-sn1.1.xhtml"/);
		assert.match(nav, /Devatāsamyutta/);
		assert.doesNotMatch(nav, /Devatāsaṁyutta/);

		const ncx = extractZipEntry(buf, "EPUB/toc.ncx")?.toString("utf8");
		assert.ok(ncx);
		assert.match(ncx, /src="chapter-sn1.xhtml"/);
		assert.match(ncx, /src="d-sn1.1.xhtml"/);
		assert.doesNotMatch(ncx, /<content[^/]*\/>\s*<navPoint/);
		assert.match(ncx, /Devatāsamyutta/);
		assert.doesNotMatch(ncx, /Devatāsaṁyutta/);
	});

	it("folds Kobo-unsafe glyphs in machine nav, NCX, and html titles but not in-book toc or body", async () => {
		const pali: CollectionPdf = {
			slug: "mn10",
			title: "Satipaṭṭhāna",
			description: "",
			hasChapters: true,
			chapters: [
				{
					slug: "mn10",
					title: "MN 10 Satipaṭṭhāna",
					description: "",
					discourses: [
						{
							slug: "mn10",
							title: "Satipaṭṭhāna",
							description: "",
							html: "<p>Mindfulness.</p>",
						},
					],
				},
			],
		};
		const buf = await buildCollectionEpub(pali, {
			collectionUrl: "www.wordsofthebuddha.org/mn10",
			date: "20 August 2026",
			identifier: "urn:uuid:test-fold",
			modified: "2026-08-20T00:00:00Z",
		});

		const tocPage = extractZipEntry(buf, "EPUB/toc.xhtml")?.toString(
			"utf8",
		);
		assert.ok(tocPage);
		assert.match(tocPage, /MN 10 Satipaṭṭhāna/);
		assert.doesNotMatch(tocPage, /Satipatthāna/);

		const nav = extractZipEntry(buf, "EPUB/nav.xhtml")?.toString("utf8");
		assert.ok(nav);
		assert.match(nav, /MN 10 Satipatthāna/);
		assert.doesNotMatch(nav, /ṭ/);

		const ncx = extractZipEntry(buf, "EPUB/toc.ncx")?.toString("utf8");
		assert.ok(ncx);
		assert.match(ncx, /<navLabel><text>Satipatthāna<\/text><\/navLabel>/);
		assert.match(ncx, /<navLabel><text>MN 10 Satipatthāna<\/text><\/navLabel>/);
		assert.doesNotMatch(ncx, /ṭ/);

		const chapter = extractZipEntry(buf, "EPUB/chapter-mn10.xhtml")?.toString(
			"utf8",
		);
		assert.ok(chapter);
		assert.match(chapter, /<title>MN 10 Satipatthāna<\/title>/);
		assert.match(chapter, /<h1 class="chapter-heading">MN 10 Satipaṭṭhāna<\/h1>/);

		const discourse = extractZipEntry(buf, "EPUB/d-mn10.xhtml")?.toString(
			"utf8",
		);
		assert.ok(discourse);
		assert.match(discourse, /<title>MN 10 Satipatthāna<\/title>/);
		assert.match(
			discourse,
			/<h1 class="discourse-title">MN 10 Satipaṭṭhāna<\/h1>/,
		);

		const titlePage = extractZipEntry(buf, "EPUB/title.xhtml")?.toString(
			"utf8",
		);
		assert.ok(titlePage);
		assert.match(titlePage, /<title>Satipatthāna<\/title>/);
		assert.match(titlePage, /<h1 class="cover-title">Satipaṭṭhāna<\/h1>/);

		const opf = extractZipEntry(buf, "EPUB/package.opf")?.toString("utf8");
		assert.ok(opf);
		assert.match(opf, /<dc:title>Satipaṭṭhāna<\/dc:title>/);
	});
});
