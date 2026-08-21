/**
 * /api/export/[...slug]
 *
 * Generates a PDF (via Playwright) or EPUB for a collection or topic page.
 *
 * Usage:
 *   GET /api/export/snp2
 *   GET /api/export/sn1-11?format=epub
 *   POST /api/export/sn1-11  (JSON body — subset export; see POST handler)
 *   GET /api/export/on/mindfulness
 *
 * Query params (optional):
 *   threshold  – integer, max tooltip def length before footnoting (default: 40)
 *   format     – pdf (default) or epub
 *
 * ⚠️  Deployment note:
 *   Production uses @sparticuz/chromium-min + playwright-core (no bundled Chromium).
 *   PDF always launches Chromium. EPUB launches it only when discourse diagrams
 *   are included, so they can be screenshot at the SVG's authored size.
 *   For local export, install Chrome/Chromium or run
 *   `npx playwright install chromium` (devDependency) and set
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH if needed.
 */
export const prerender = false;

import type { APIRoute } from "astro";
import {
	fetchCollectionPdfData,
	fetchOnPagePdfData,
	buildPdfHtml,
	countCollectionDiscourses,
	type PdfPaliOptions,
	type CollectionPdf,
} from "../../../utils/pdfRenderer";
import {
	applyFormatConstraints,
	pdfVizImageMode,
	type ExportFormat,
	type ExportVizImageMode,
	type PdfExportParams,
	type PdfImageMode,
} from "../../../utils/exportFormatConstraints";
import { buildCollectionEpub, collectionHasInlineSvg } from "../../../utils/epubRenderer";
import {
	rasterizeSvgOnPage,
	type SvgVizRasterMode,
} from "../../../utils/svgRasterize";
import type { EpubCoverAccentRole, EpubCoverKind } from "../../../utils/epubCover";
import { getQualityContentType } from "../../../utils/ContentTagUtils";

import {
	buildPdfExportSelectionTree,
	flattenExportTreeSlugs,
	type PdfExportDiscourseLine,
} from "../../../utils/collectionPdfExportTree";
import {
	buildOnPagePdfExportTree,
	flattenOnPageExportSlugs,
	type OnPageDiscourse,
} from "../../../utils/onPagePdfExportTree";
import { findContentBySlug } from "../../../utils/discover-data";
import { getReferencePostsForTag } from "../../../utils/referencePostsForPage";
import { normalizeDiscourseIdForContentImages } from "../../../utils/contentImage";
import { determineRouteType } from "../../../utils/routeHandler";
import { directoryStructure } from "../../../data/directoryStructure";
import type { DirectoryStructure } from "../../../types/directory";
import type { Browser } from "playwright-core";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const esmRequire = createRequire(import.meta.url);

// ── Chromium launcher ───────────────────────────────────────────────────────
// On Vercel (and other serverless environments) the Playwright-bundled Chromium
// is not available. We use @sparticuz/chromium-min + playwright-core instead.
// Locally we fall back to the bundled Chromium that ships with playwright.
//
// Prerequisites (run once):
//   npm install playwright-core @sparticuz/chromium-min
//
// The pack URL is derived from the installed @sparticuz/chromium-min version
// so it stays in sync automatically. Override via CHROMIUM_PACK_URL env var.
// Releases: https://github.com/Sparticuz/chromium/releases
function getChromiumMinVersion(): string {
	// The package's "exports" field blocks direct require of package.json,
	// so resolve the main entry and walk up to find the package root.
	const entryPath = esmRequire.resolve("@sparticuz/chromium-min");
	let dir = dirname(entryPath);
	while (true) {
		const pkgPath = join(dir, "package.json");
		try {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			if (pkg.name === "@sparticuz/chromium-min") return pkg.version;
		} catch {}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error("Could not determine @sparticuz/chromium-min version");
}

function getChromiumPackUrl(): string {
	if (process.env.CHROMIUM_PACK_URL) return process.env.CHROMIUM_PACK_URL;
	const version = getChromiumMinVersion();
	return `https://github.com/Sparticuz/chromium/releases/download/v${version}/chromium-v${version}-pack.x64.tar`;
}

async function launchBrowser(): Promise<Browser> {
	const { chromium: core } = await import("playwright-core");
	const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];

	const isServerless =
		!!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
	if (isServerless) {
		const { default: chromiumMin } = await import("@sparticuz/chromium-min");
		return core.launch({
			args: chromiumMin.args,
			executablePath:
				await chromiumMin.executablePath(getChromiumPackUrl()),
			headless: true,
		});
	}

	// Local / Node server: playwright-core + installed Chrome/Chromium.
	// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH for a custom binary, or run
	// `npx playwright install chromium` (devDependency) and point env at it.
	const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
	if (executablePath) {
		return core.launch({
			executablePath,
			args: launchArgs,
			headless: true,
		});
	}
	return core.launch({
		channel: process.env.PW_CHANNEL || "chrome",
		args: launchArgs,
		headless: true,
	});
}

// ── Concurrency gate ────────────────────────────────────────────────────────
// Caps simultaneous Chromium instances to prevent memory exhaustion.
const MAX_CONCURRENT = 2;
let activeJobs = 0;

function parseFormat(value: unknown): ExportFormat {
	return value === "epub" ? "epub" : "pdf";
}

function safeExportFilename(title: string, ext: ExportFormat): string {
	const base = title
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return `${base || "export"}.${ext}`;
}

function fileDownloadResponse(
	body: Uint8Array,
	filename: string,
	contentType: string,
): Response {
	return new Response(body, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": "no-store",
		},
	});
}

async function respondWithEpub(
	collectionData: CollectionPdf,
	opts: {
		collectionUrl: string;
		date: string;
		parentTitle?: string;
		title: string;
		emptyMessage: string;
		coverKind?: EpubCoverKind;
		coverAccentRole?: EpubCoverAccentRole;
		titleKindLabel?: string;
		/** Light / dark / e-ink baked into diagram PNGs. Thermal is coerced first. */
		vizImageMode?: ExportVizImageMode;
	},
): Promise<Response> {
	const totalDiscourses = countCollectionDiscourses(collectionData);
	if (totalDiscourses === 0) {
		return errorResponse(opts.emptyMessage, 404);
	}

	const startMs = Date.now();
	let rasterizeDiagram: ((svg: string) => Promise<Buffer>) | undefined;
	let browser: Browser | undefined;
	let heldJob = false;
	const vizMode: SvgVizRasterMode =
		opts.vizImageMode === "dark"
			? "dark"
			: opts.vizImageMode === "light"
				? "light"
				: "eink";

	if (collectionHasInlineSvg(collectionData)) {
		try {
			browser = await launchBrowser();
			const page = await browser.newPage();
			console.log(`[EPUB Export] Rasterizing diagrams as ${vizMode}`);
			rasterizeDiagram = (svg: string) =>
				rasterizeSvgOnPage(page, svg, { vizMode });
			activeJobs++;
			heldJob = true;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(
				`[EPUB Export] Chromium rasterizer unavailable, using resvg: ${msg}`,
			);
			if (browser) {
				await browser.close().catch(() => {});
				browser = undefined;
			}
			rasterizeDiagram = undefined;
		}
	}

	try {
		const buf = await buildCollectionEpub(collectionData, {
			collectionUrl: opts.collectionUrl,
			date: opts.date,
			parentTitle: opts.parentTitle,
			coverKind: opts.coverKind,
			coverAccentRole: opts.coverAccentRole,
			titleKindLabel: opts.titleKindLabel,
			rasterizeDiagram,
			vizImageMode: vizMode,
		});
		const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
		console.log(`[EPUB Export] Done in ${elapsed}s — ${buf.length} bytes`);
		return fileDownloadResponse(
			new Uint8Array(buf),
			safeExportFilename(opts.title, "epub"),
			"application/epub+zip",
		);
	} finally {
		if (browser) {
			await browser.close().catch(() => {});
		}
		if (heldJob) activeJobs--;
	}
}

function defaultDownloadDate(): string {
	return new Date().toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function parseImageMode(value: string | null): PdfImageMode {
	if (value === "none" || value === "svgAll" || value === "svgPrimaryOnly") {
		return value;
	}
	return "svgPrimaryOnly";
}

function parseVizParam(vizParam: string | null): ExportVizImageMode | undefined {
	if (
		vizParam === "light" ||
		vizParam === "dark" ||
		vizParam === "thermal" ||
		vizParam === "eink"
	) {
		return vizParam;
	}
	if (vizParam === "print") return "thermal";
	if (vizParam === "paper") return "eink";
	return undefined;
}

function paramsFromSearchParams(url: URL): PdfExportParams {
	const downloadDate = url.searchParams.get("date") ?? defaultDownloadDate();
	const imageMode = parseImageMode(url.searchParams.get("images"));
	const vizImageMode = parseVizParam(url.searchParams.get("viz"));
	const pliParam = url.searchParams.get("pli");
	const layoutParam = url.searchParams.get("layout");
	const paliOptions: PdfPaliOptions | undefined =
		pliParam === "true" || pliParam === "1"
			? {
					enabled: true,
					layout:
						layoutParam === "split" ? "split" : "interleaved",
				}
			: undefined;
	const keyTermsParam = url.searchParams.get("keyTerms");
	const includeKeyTermsSection =
		keyTermsParam !== "0" && keyTermsParam !== "false";
	return {
		downloadDate,
		imageMode,
		vizImageMode,
		pdfContentOptions: { paliOptions, includeKeyTermsSection },
	};
}

function paramsFromJsonBody(body: Record<string, unknown>): PdfExportParams {
	const downloadDate =
		typeof body.date === "string" && body.date.trim().length > 0
			? body.date.trim()
			: defaultDownloadDate();
	const imageMode = parseImageMode(
		typeof body.images === "string" ? body.images : null,
	);
	const vizImageMode = parseVizParam(
		typeof body.viz === "string" ? body.viz : null,
	);
	const pli = body.pli === true || body.pli === "true";
	const layoutParam = typeof body.layout === "string" ? body.layout : "";
	const paliOptions: PdfPaliOptions | undefined = pli
		? {
				enabled: true,
				layout:
					layoutParam === "split" ? "split" : "interleaved",
			}
		: undefined;
	const kt = body.keyTerms;
	const includeKeyTermsSection =
		kt !== false && kt !== "false" && kt !== 0 && kt !== "0";
	return {
		downloadDate,
		imageMode,
		vizImageMode,
		pdfContentOptions: { paliOptions, includeKeyTermsSection },
	};
}

function resolveParentTitle(slug: string): string | undefined {
	let parentTitle: string | undefined;
	for (const [topSlug, topMeta] of Object.entries(directoryStructure)) {
		if (topSlug === slug) break;
		if (topMeta.children) {
			if (topMeta.children[slug]) {
				parentTitle = topMeta.title;
				break;
			}
			for (const [, midMeta] of Object.entries(topMeta.children)) {
				if (midMeta.children?.[slug]) {
					parentTitle = midMeta.title || topMeta.title;
					break;
				}
			}
			if (parentTitle) break;
		}
	}
	return parentTitle;
}

async function validateSelectedDiscourseSlugs(
	collectionSlug: string,
	raw: unknown,
): Promise<{ ok: true; set: Set<string> } | { ok: false; response: Response }> {
	if (!Array.isArray(raw) || raw.length === 0) {
		return {
			ok: false,
			response: errorResponse(
				"selectedDiscourseSlugs must be a non-empty array.",
				400,
			),
		};
	}
	const tree = await buildPdfExportSelectionTree(collectionSlug);
	if (!tree) {
		return {
			ok: false,
			response: errorResponse(
				"This collection has no exportable discourses.",
				404,
			),
		};
	}
	const allowed = new Set(flattenExportTreeSlugs(tree));
	const normalized = [
		...new Set(
			raw.map((s) =>
				normalizeDiscourseIdForContentImages(String(s).trim()),
			),
		),
	].filter(Boolean);
	if (normalized.length === 0) {
		return {
			ok: false,
			response: errorResponse("Select at least one discourse.", 400),
		};
	}
	for (const s of normalized) {
		if (!allowed.has(s)) {
			return {
				ok: false,
				response: errorResponse(
					`Discourse not in this collection: ${s}`,
					400,
				),
			};
		}
	}
	return { ok: true, set: new Set(normalized) };
}

type OnPageExportContext = {
	pageSlug: string;
	title: string;
	description: string;
	discourseLines: PdfExportDiscourseLine[];
	allowed: Set<string>;
	coverAccentRole: EpubCoverAccentRole;
	titleKindLabel: string;
};

function resolveOnPageExportContext(
	pageSlug: string,
):
	| { ok: true; ctx: OnPageExportContext }
	| { ok: false; response: Response } {
	const { item: content, type: contentType } = findContentBySlug(pageSlug);
	if (
		!content ||
		(contentType !== "topic" &&
			contentType !== "quality" &&
			contentType !== "simile")
	) {
		return {
			ok: false,
			response: errorResponse(
				`'${pageSlug}' is not a known topic, quality, or simile page.`,
				404,
			),
		};
	}

	const discourses: OnPageDiscourse[] = (content.discourses ?? []).map(
		(d: { id: string; title: string; description?: string }) => ({
			id: d.id,
			title: d.title,
			description: d.description,
		}),
	);
	const enSlugs = new Set(discourses.map((d) => d.id));
	const referencePosts = getReferencePostsForTag(pageSlug, enSlugs);
	const tree = buildOnPagePdfExportTree(
		pageSlug,
		content.title,
		discourses,
		referencePosts,
	);
	if (!tree) {
		return {
			ok: false,
			response: errorResponse(
				`No discourses found for '${pageSlug}'.`,
				404,
			),
		};
	}

	let coverAccentRole: EpubCoverAccentRole = "topic";
	let titleKindLabel = "Topic";
	if (contentType === "quality") {
		const q = getQualityContentType(pageSlug);
		coverAccentRole =
			q === "bright-quality"
				? "positive"
				: q === "negative-quality"
					? "negative"
					: "neutral";
		titleKindLabel = "Quality";
	} else if (contentType === "simile") {
		titleKindLabel = "Simile";
	}

	return {
		ok: true,
		ctx: {
			pageSlug,
			title: content.title,
			description: content.description ?? "",
			discourseLines: tree.chapters[0]?.discourses ?? [],
			allowed: new Set(flattenOnPageExportSlugs(tree)),
			coverAccentRole,
			titleKindLabel,
		},
	};
}

function validateSelectedOnPageDiscourseSlugs(
	pageSlug: string,
	raw: unknown,
): { ok: true; set: Set<string> } | { ok: false; response: Response } {
	const resolved = resolveOnPageExportContext(pageSlug);
	if (!resolved.ok) return resolved;

	if (!Array.isArray(raw) || raw.length === 0) {
		return {
			ok: false,
			response: errorResponse(
				"selectedDiscourseSlugs must be a non-empty array.",
				400,
			),
		};
	}

	const normalized = [
		...new Set(
			raw.map((s) =>
				normalizeDiscourseIdForContentImages(String(s).trim()),
			),
		),
	].filter(Boolean);
	if (normalized.length === 0) {
		return {
			ok: false,
			response: errorResponse("Select at least one discourse.", 400),
		};
	}
	for (const s of normalized) {
		if (!resolved.ctx.allowed.has(s)) {
			return {
				ok: false,
				response: errorResponse(
					`Discourse not on this page: ${s}`,
					400,
				),
			};
		}
	}
	return { ok: true, set: new Set(normalized) };
}

function parseExportSlugParam(slug: string | undefined):
	| { kind: "on-page"; pageSlug: string }
	| { kind: "collection"; collectionSlug: string }
	| null {
	if (!slug) return null;
	if (slug.startsWith("on/")) {
		const pageSlug = slug.slice("on/".length).trim();
		return pageSlug ? { kind: "on-page", pageSlug } : null;
	}
	return { kind: "collection", collectionSlug: slug };
}

async function runOnPagePdfGeneration(
	pageSlug: string,
	params: PdfExportParams,
	selectedDiscourseSlugs: Set<string> | null,
	format: ExportFormat = "pdf",
): Promise<Response> {
	const resolved = resolveOnPageExportContext(pageSlug);
	if (!resolved.ok) return resolved.response;

	const { title, description, discourseLines, coverAccentRole, titleKindLabel } =
		resolved.ctx;
	const collectionUrl = `www.wordsofthebuddha.org/on/${pageSlug}`;
	const { downloadDate, imageMode, vizImageMode, pdfContentOptions } =
		params;

	console.log(
		`[${format === "epub" ? "EPUB" : "PDF"} Export] Generating ${format.toUpperCase()} for on-page: ${pageSlug} (subset: ${selectedDiscourseSlugs ? selectedDiscourseSlugs.size + " discourses" : "full"})`,
	);
	const startMs = Date.now();

	if (format === "epub") {
		try {
			const collectionData = await fetchOnPagePdfData(
				pageSlug,
				title,
				description,
				discourseLines,
				imageMode,
				pdfContentOptions,
				selectedDiscourseSlugs,
			);
			return await respondWithEpub(collectionData, {
				collectionUrl,
				date: downloadDate,
				title,
				emptyMessage: `No discourses found for '${pageSlug}'.`,
				coverKind: "topic",
				coverAccentRole,
				titleKindLabel,
				vizImageMode,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[EPUB Export] Error:", msg);
			return errorResponse(`EPUB generation failed: ${msg}`, 500);
		}
	}

	activeJobs++;
	let browser: Browser | undefined;
	try {
		const [collectionData, launchedBrowser] = await Promise.all([
			fetchOnPagePdfData(
				pageSlug,
				title,
				description,
				discourseLines,
				imageMode,
				pdfContentOptions,
				selectedDiscourseSlugs,
			),
			launchBrowser(),
		]);
		browser = launchedBrowser;

		const totalDiscourses = countCollectionDiscourses(collectionData);
		if (totalDiscourses === 0) {
			return errorResponse(
				`No discourses found for '${pageSlug}'.`,
				404,
			);
		}

		const html = buildPdfHtml(collectionData, {
			collectionUrl,
			date: downloadDate,
			vizImageMode: pdfVizImageMode(vizImageMode),
		});
		const page = await browser.newPage();
		await page.setViewportSize({ width: 794, height: 1123 });
		await page.setContent(html, {
			waitUntil: "domcontentloaded",
			timeout: 20_000,
		});

		const pdfBuffer = await page.pdf({
			format: "A4",
			margin: {
				top: "22mm",
				right: "22mm",
				bottom: "28mm",
				left: "22mm",
			},
			printBackground: false,
			displayHeaderFooter: true,
			headerTemplate: "<span></span>",
			footerTemplate: `
				<div style="
					font-family: 'Times New Roman', Times, serif;
					font-size: 9pt;
					color: #888;
					width: 100%;
					text-align: center;
					padding: 0 22mm;
					box-sizing: border-box;
				">
					<span class="pageNumber"></span>
				</div>`,
			outline: true,
			tagged: true,
		});

		await browser.close();
		browser = undefined;

		const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
		console.log(
			`[PDF Export] Done in ${elapsed}s — ${pdfBuffer.length} bytes`,
		);

		return fileDownloadResponse(
			new Uint8Array(pdfBuffer),
			safeExportFilename(title, "pdf"),
			"application/pdf",
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[PDF Export] Error:", msg);
		if (browser) {
			await browser.close().catch(() => {});
		}
		return errorResponse(`PDF generation failed: ${msg}`, 500);
	} finally {
		activeJobs--;
	}
}

async function runPdfGeneration(
	slug: string,
	metadata: DirectoryStructure,
	params: PdfExportParams,
	selectedDiscourseSlugs: Set<string> | null,
	format: ExportFormat = "pdf",
): Promise<Response> {
	const collectionUrl = `www.wordsofthebuddha.org/${slug}`;
	const parentTitle = resolveParentTitle(slug);
	const { downloadDate, imageMode, vizImageMode, pdfContentOptions } =
		params;
	const paliOptions = pdfContentOptions.paliOptions;
	const includeKeyTermsSection =
		pdfContentOptions.includeKeyTermsSection !== false;

	console.log(
		`[${format === "epub" ? "EPUB" : "PDF"} Export] Generating ${format.toUpperCase()} for collection: ${slug} (images: ${imageMode}, viz: ${vizImageMode ?? "default"}, pali: ${paliOptions?.enabled ? paliOptions.layout : "off"}, keyTerms: ${includeKeyTermsSection ? "yes" : "no"}, subset: ${selectedDiscourseSlugs ? selectedDiscourseSlugs.size + " discourses" : "full"})`,
	);
	const startMs = Date.now();

	if (format === "epub") {
		try {
			const collectionData = await fetchCollectionPdfData(
				slug,
				metadata,
				imageMode,
				pdfContentOptions,
				selectedDiscourseSlugs,
			);
			return await respondWithEpub(collectionData, {
				collectionUrl,
				date: downloadDate,
				parentTitle,
				title: metadata.title,
				emptyMessage: `No discourses found for collection '${slug}'. The content may not be published yet.`,
				coverKind: parentTitle ? "section" : "collection",
				vizImageMode,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[EPUB Export] Error:", msg);
			return errorResponse(`EPUB generation failed: ${msg}`, 500);
		}
	}

	activeJobs++;
	let browser: Browser | undefined;
	try {
		const [collectionData, launchedBrowser] = await Promise.all([
			fetchCollectionPdfData(
				slug,
				metadata,
				imageMode,
				pdfContentOptions,
				selectedDiscourseSlugs,
			),
			launchBrowser(),
		]);
		browser = launchedBrowser;

		const totalDiscourses = countCollectionDiscourses(collectionData);

		if (totalDiscourses === 0) {
			return errorResponse(
				`No discourses found for collection '${slug}'. The content may not be published yet.`,
				404,
			);
		}

		console.log(
			`[PDF Export] ${totalDiscourses} discourses in ${collectionData.chapters.length} chapter(s). Building HTML…`,
		);

		const html = buildPdfHtml(collectionData, {
			collectionUrl,
			date: downloadDate,
			parentTitle,
			vizImageMode: pdfVizImageMode(vizImageMode),
		});

		const page = await browser.newPage();

		await page.setViewportSize({ width: 794, height: 1123 });

		await page.setContent(html, {
			waitUntil: "domcontentloaded",
			timeout: 20_000,
		});

		const pdfBuffer = await page.pdf({
			format: "A4",
			margin: {
				top: "22mm",
				right: "22mm",
				bottom: "28mm",
				left: "22mm",
			},
			printBackground: false,
			displayHeaderFooter: true,
			headerTemplate: "<span></span>",
			footerTemplate: `
				<div style="
					font-family: 'Times New Roman', Times, serif;
					font-size: 9pt;
					color: #888;
					width: 100%;
					text-align: center;
					padding: 0 22mm;
					box-sizing: border-box;
				">
					<span class="pageNumber"></span>
				</div>`,
			outline: true,
			tagged: true,
		});

		await browser.close();
		browser = undefined;

		const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
		console.log(
			`[PDF Export] Done in ${elapsed}s — ${pdfBuffer.length} bytes`,
		);

		return fileDownloadResponse(
			new Uint8Array(pdfBuffer),
			safeExportFilename(metadata.title, "pdf"),
			"application/pdf",
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[PDF Export] Error:", msg);
		if (browser) {
			await browser.close().catch(() => {});
		}
		return errorResponse(`PDF generation failed: ${msg}`, 500);
	} finally {
		activeJobs--;
	}
}

export const GET: APIRoute = async ({ params, url }) => {
	const parsed = parseExportSlugParam(params.slug as string | undefined);
	if (!parsed) {
		return errorResponse("Missing collection slug", 400);
	}

	const format = parseFormat(url.searchParams.get("format"));
	const p = applyFormatConstraints(format, paramsFromSearchParams(url));
	if (
		activeJobs >= MAX_CONCURRENT &&
		(format === "pdf" || p.imageMode !== "none")
	) {
		return errorResponse(
			"Export is busy — please try again in a moment.",
			503,
		);
	}

	if (parsed.kind === "on-page") {
		return runOnPagePdfGeneration(parsed.pageSlug, p, null, format);
	}

	const route = determineRouteType(parsed.collectionSlug);

	if (route.type !== "collection" || !route.metadata) {
		return errorResponse(
			`'${parsed.collectionSlug}' is not a known collection. Use a valid collection slug such as snp2, sn1-11, mn, dhp.`,
			404,
		);
	}

	return runPdfGeneration(
		parsed.collectionSlug,
		route.metadata,
		p,
		null,
		format,
	);
};

/**
 * Subset export: JSON body with `selectedDiscourseSlugs` (non-empty) plus the
 * same option fields as GET query params (`date`, `images`, `viz`, `pli`,
 * `layout`, `keyTerms`, `format`).
 */
export const POST: APIRoute = async ({ params, request }) => {
	const parsed = parseExportSlugParam(params.slug as string | undefined);
	if (!parsed) {
		return errorResponse("Missing collection slug", 400);
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return errorResponse("Expected a JSON body.", 400);
	}

	if (!json || typeof json !== "object") {
		return errorResponse("Invalid JSON body.", 400);
	}

	const body = json as Record<string, unknown>;
	const format = parseFormat(body.format);
	const exportParams = applyFormatConstraints(
		format,
		paramsFromJsonBody(body),
	);
	if (
		activeJobs >= MAX_CONCURRENT &&
		(format === "pdf" || exportParams.imageMode !== "none")
	) {
		return errorResponse(
			"Export is busy — please try again in a moment.",
			503,
		);
	}

	if (parsed.kind === "on-page") {
		const sel = validateSelectedOnPageDiscourseSlugs(
			parsed.pageSlug,
			body.selectedDiscourseSlugs,
		);
		if (!sel.ok) return sel.response;
		return runOnPagePdfGeneration(
			parsed.pageSlug,
			exportParams,
			sel.set,
			format,
		);
	}

	const route = determineRouteType(parsed.collectionSlug);

	if (route.type !== "collection" || !route.metadata) {
		return errorResponse(
			`'${parsed.collectionSlug}' is not a known collection. Use a valid collection slug such as snp2, sn1-11, mn, dhp.`,
			404,
		);
	}

	const sel = await validateSelectedDiscourseSlugs(
		parsed.collectionSlug,
		body.selectedDiscourseSlugs,
	);
	if (!sel.ok) return sel.response;

	return runPdfGeneration(
		parsed.collectionSlug,
		route.metadata,
		exportParams,
		sel.set,
		format,
	);
};

function errorResponse(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
