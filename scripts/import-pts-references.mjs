#!/usr/bin/env node
/**
 * Import PTS (Pali Text Society) volume/page references from SuttaCentral
 * sc-data/structure/text_extra_info.json, filtered to discourses present in this repo.
 *
 * Range collection cards (an1.1-10, an8.121-147, …) often use a different uid
 * than SC extra_info (which may store an1.1-5 / an1.6-10 or only per-sutta
 * rows). Missing range slugs are synthesized from the first and last
 * constituent suttas so cards can show a start–end citation.
 *
 * Writes: src/data/ptsReferences.generated.ts
 *
 * Usage:
 *   node scripts/import-pts-references.mjs
 *   node scripts/import-pts-references.mjs --dry-run
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(
	PROJECT_ROOT,
	"src/data/ptsReferences.generated.ts",
);
const EN_ROOT = path.join(PROJECT_ROOT, "src/content/en");
const REF_ROOT = path.join(PROJECT_ROOT, "src/content/references/sujato");
const CATALOG_ROOT = path.join(PROJECT_ROOT, "src/content/catalog");

const SOURCE_URL =
	"https://raw.githubusercontent.com/suttacentral/sc-data/master/structure/text_extra_info.json";

const dryRun = process.argv.includes("--dry-run");

function collectSlugsFromDir(root, ext) {
	const slugs = new Set();
	if (!existsSync(root)) return slugs;
	for (const collection of readdirSync(root, { withFileTypes: true })) {
		if (!collection.isDirectory()) continue;
		const dir = path.join(root, collection.name);
		for (const file of readdirSync(dir)) {
			if (!file.endsWith(ext)) continue;
			slugs.add(file.slice(0, -ext.length));
		}
	}
	return slugs;
}

function collectSiteSlugs() {
	const slugs = new Set([
		...collectSlugsFromDir(EN_ROOT, ".mdx"),
		...collectSlugsFromDir(REF_ROOT, ".md"),
		...collectSlugsFromDir(CATALOG_ROOT, ".yaml"),
	]);
	return slugs;
}

/** Expand a range slug into constituent uids (mirrors slugDiscourseCount.ts). */
function expandRangeSlug(slug) {
	const dhpMatch = slug.match(/^dhp(\d+)-(\d+)$/i);
	if (dhpMatch) {
		const start = Number(dhpMatch[1]);
		const end = Number(dhpMatch[2]);
		if (end >= start) {
			return Array.from(
				{ length: end - start + 1 },
				(_, i) => `dhp${start + i}`,
			);
		}
	}
	const decimalRangeMatch = slug.match(/^([a-z]+\d+)\.(\d+)-(\d+)$/i);
	if (decimalRangeMatch) {
		const [, prefix, startStr, endStr] = decimalRangeMatch;
		const start = Number(startStr);
		const end = Number(endStr);
		if (end >= start) {
			return Array.from(
				{ length: end - start + 1 },
				(_, i) => `${prefix}.${start + i}`,
			);
		}
	}
	return [slug];
}

function isPtsVolpage(volpage) {
	if (!volpage || typeof volpage !== "string") return false;
	const trimmed = volpage.trim();
	// Keep Pali PTS refs; skip Taishō / manuscript / other editions.
	return /^PTS\b/i.test(trimmed);
}

function entryFromRow(row) {
	const entry = { volpage: String(row.volpage).trim() };
	if (row.alt_volpage && isPtsVolpage(row.alt_volpage)) {
		entry.altVolpage = String(row.alt_volpage).trim();
	}
	return entry;
}

function cloneEntry(entry) {
	const out = { volpage: entry.volpage };
	if (entry.altVolpage) out.altVolpage = entry.altVolpage;
	if (entry.endVolpage) out.endVolpage = entry.endVolpage;
	return out;
}

async function main() {
	console.log("Fetching", SOURCE_URL);
	const res = await fetch(SOURCE_URL);
	if (!res.ok) {
		throw new Error(`Failed to fetch text_extra_info.json: ${res.status}`);
	}
	const rows = await res.json();
	if (!Array.isArray(rows)) {
		throw new Error("Unexpected text_extra_info.json shape");
	}

	const siteSlugs = collectSiteSlugs();
	console.log(`Site discourse slugs: ${siteSlugs.size}`);

	/** @type {Record<string, { volpage: string; altVolpage?: string }>} */
	const fullPts = {};
	let ptsRows = 0;

	for (const row of rows) {
		const uid = row?.uid;
		const volpage = row?.volpage;
		if (!uid || !isPtsVolpage(volpage)) continue;
		ptsRows++;
		fullPts[uid] = entryFromRow(row);
	}

	/** @type {Record<string, { volpage: string; altVolpage?: string; endVolpage?: string }>} */
	const bySlug = {};
	let exact = 0;
	let synthesized = 0;

	for (const slug of siteSlugs) {
		if (fullPts[slug]) {
			bySlug[slug] = cloneEntry(fullPts[slug]);
			exact++;
		}

		const ids = expandRangeSlug(slug);
		if (ids.length < 2) continue;

		let first;
		let last;
		for (const id of ids) {
			const hit = fullPts[id];
			if (!hit) continue;
			if (!first) first = hit;
			last = hit;
		}

		if (!bySlug[slug] && first) {
			bySlug[slug] = cloneEntry(first);
			synthesized++;
		}

		if (bySlug[slug] && last) {
			// Cap the range at the last constituent so missing neighbors
			// cannot stretch the citation across later vaggas.
			bySlug[slug].endVolpage = last.volpage;
		}
	}

	const sortedSlugs = Object.keys(bySlug).sort((a, b) =>
		a.localeCompare(b, undefined, { numeric: true }),
	);
	const sorted = Object.fromEntries(sortedSlugs.map((s) => [s, bySlug[s]]));

	console.log(`PTS rows in source: ${ptsRows}`);
	console.log(`Exact site-slug matches: ${exact}`);
	console.log(`Synthesized from range constituents: ${synthesized}`);
	console.log(`Entries written: ${sortedSlugs.length}`);

	const header = `// This file is auto-generated by scripts/import-pts-references.mjs — do not edit directly
// Source: suttacentral/sc-data structure/text_extra_info.json (PTS volpages only)

export type PtsReferenceEntry = {
	volpage: string;
	altVolpage?: string;
	/** Last constituent start page for range slugs (an1.1-10, …). */
	endVolpage?: string;
};

/** slug → PTS volume/page reference from SuttaCentral */
export const ptsReferences: Record<string, PtsReferenceEntry> = `;

	const body = `${JSON.stringify(sorted, null, "\t")} as const satisfies Record<string, PtsReferenceEntry>;
`;

	if (dryRun) {
		console.log(`[dry-run] would write ${sortedSlugs.length} entries to ${OUT_PATH}`);
		const sample = ["an1.1-10", "an1.11-20", "an1.21-30", "an1.31-40"].filter(
			(s) => sorted[s],
		);
		console.log(
			"Sample ranges:",
			sample.map((s) => [s, sorted[s]]),
		);
		return;
	}

	mkdirSync(path.dirname(OUT_PATH), { recursive: true });
	writeFileSync(OUT_PATH, header + body, "utf8");
	console.log(`Wrote ${sortedSlugs.length} PTS refs → ${path.relative(PROJECT_ROOT, OUT_PATH)}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
