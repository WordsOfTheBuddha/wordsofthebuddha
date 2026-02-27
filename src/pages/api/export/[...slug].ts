/**
 * /api/export/[...slug]
 *
 * Generates a PDF for a collection or sub-collection on-the-fly using
 * Playwright headless Chromium.
 *
 * Usage:
 *   GET /api/export/snp2
 *   GET /api/export/sn1-11
 *   GET /api/export/dhp
 *   GET /api/export/mn1-50
 *
 * Query params (optional):
 *   threshold  – integer, max tooltip def length before footnoting (default: 40)
 *
 * ⚠️  Deployment note:
 *   Playwright's bundled Chromium (~300 MB) cannot be included in a Vercel
 *   Serverless Function. For production deployment you have two options:
 *     1. Replace `chromium` from 'playwright' with `@sparticuz/chromium` +
 *        `playwright-core` (works on Vercel/AWS Lambda with the chromium layer).
 *     2. Generate PDFs at build time and serve as static assets.
 *   For local development and Node.js servers, the bundled Chromium works
 *   as-is after running: npx playwright install chromium
 */
export const prerender = false;

import type { APIRoute } from "astro";
import {
	fetchCollectionPdfData,
	buildPdfHtml,
} from "../../../utils/pdfRenderer";
import { determineRouteType } from "../../../utils/routeHandler";
import { directoryStructure } from "../../../data/directoryStructure";
import type { Browser } from "playwright-core";

// ── Chromium launcher ───────────────────────────────────────────────────────
// On Vercel (and other serverless environments) the Playwright-bundled Chromium
// is not available. We use @sparticuz/chromium-min + playwright-core instead.
// Locally we fall back to the bundled Chromium that ships with playwright.
//
// Prerequisites (run once):
//   npm install playwright-core @sparticuz/chromium-min
//
// The CHROMIUM_PACK_URL env var lets you pin a specific Sparticuz release:
//   https://github.com/Sparticuz/chromium/releases
// ⚠️  Must match the installed @sparticuz/chromium-min version AND include
//     the architecture suffix (.x64.tar or .arm64.tar) for v137+.
const CHROMIUM_PACK_URL =
	process.env.CHROMIUM_PACK_URL ??
	"https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar";

async function launchBrowser(): Promise<Browser> {
	const isServerless =
		!!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
	if (isServerless) {
		const [{ default: chromiumMin }, { chromium: core }] =
			await Promise.all([
				import("@sparticuz/chromium-min"),
				import("playwright-core"),
			]);
		return core.launch({
			args: chromiumMin.args,
			executablePath: await chromiumMin.executablePath(CHROMIUM_PACK_URL),
			headless: true,
		});
	}
	// Local / Node server: use playwright's bundled Chromium
	const { chromium } = await import("playwright");
	return chromium.launch({
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});
}

// ── Concurrency gate ────────────────────────────────────────────────────────
// Caps simultaneous Chromium instances to prevent memory exhaustion.
const MAX_CONCURRENT = 2;
let activeJobs = 0;

export const GET: APIRoute = async ({ params, url }) => {
	const slug = params.slug as string | undefined;

	if (!slug) {
		return errorResponse("Missing collection slug", 400);
	}

	// Resolve the collection from directoryStructure
	const route = determineRouteType(slug);

	if (route.type !== "collection" || !route.metadata) {
		return errorResponse(
			`'${slug}' is not a known collection. Use a valid collection slug such as snp2, sn1-11, mn, dhp.`,
			404,
		);
	}

	if (activeJobs >= MAX_CONCURRENT) {
		return errorResponse(
			"PDF generation is busy — please try again in a moment.",
			503,
		);
	}

	// Optional footnote threshold
	// (kept for future use; threshold logic was removed from processFootnotes)

	// Date string passed from the client's browser locale
	const downloadDate =
		url.searchParams.get("date") ??
		new Date().toLocaleDateString("en-GB", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});

	const collectionUrl = `www.wordsofthebuddha.org/${slug}`;

	// Resolve parent collection title for sub-collections
	let parentTitle: string | undefined;
	for (const [topSlug, topMeta] of Object.entries(directoryStructure)) {
		if (topSlug === slug) break; // top-level, no parent
		if (topMeta.children) {
			// Check direct children
			if (topMeta.children[slug]) {
				parentTitle = topMeta.title;
				break;
			}
			// Check grandchildren (e.g. sn1-11 > sn1)
			for (const [midSlug, midMeta] of Object.entries(topMeta.children)) {
				if (midMeta.children?.[slug]) {
					parentTitle = midMeta.title || topMeta.title;
					break;
				}
			}
			if (parentTitle) break;
		}
	}

	console.log(`[PDF Export] Generating PDF for collection: ${slug}`);
	const startMs = Date.now();

	activeJobs++;
	let browser: Browser | undefined;
	try {
		// ── 1. Fetch all discourse content and render to HTML ──────────────
		const collectionData = await fetchCollectionPdfData(
			slug,
			route.metadata,
		);

		const totalDiscourses = collectionData.chapters.reduce(
			(acc, ch) => acc + ch.discourses.length,
			0,
		);

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
		});

		// ── 2. Render HTML → PDF via Playwright ────────────────────────────
		browser = await launchBrowser();

		const page = await browser.newPage();

		// Set A4 viewport so %vh values etc. are sensible during page.setContent
		await page.setViewportSize({ width: 794, height: 1123 }); // A4 at 96 dpi

		await page.setContent(html, {
			waitUntil: "domcontentloaded",
			timeout: 20_000,
		});

		const pdfBuffer = await page.pdf({
			format: "A4",
			margin: {
				top: "22mm",
				right: "22mm",
				bottom: "28mm", // slightly larger to fit footer
				left: "22mm",
			},
			printBackground: false,
			// ── Page numbers in footer ─────────────────────────────────────
			displayHeaderFooter: true,
			headerTemplate: "<span></span>", // empty – required when displayHeaderFooter is true
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
			// ── PDF outline → sidebar bookmarks ───────────────────────────
			outline: true,
			// Tagged PDF for accessibility
			tagged: true,
		});

		await browser.close();
		browser = undefined;

		const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
		console.log(
			`[PDF Export] Done in ${elapsed}s — ${pdfBuffer.length} bytes`,
		);

		// ── 3. Return PDF ──────────────────────────────────────────────────
		const safeName = `${route.metadata.title
			.normalize("NFD") // decompose diacritics (ā → a + combining)
			.replace(/[\u0300-\u036f]/g, "") // strip combining marks → "Udana"
			.replace(/[^a-z0-9]+/gi, "-") // non-alphanumeric → hyphen
			.replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
			.toLowerCase()}.pdf`;

		return new Response(new Uint8Array(pdfBuffer), {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${safeName}"`,
				"Cache-Control": "no-store",
			},
		});
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
};

function errorResponse(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
