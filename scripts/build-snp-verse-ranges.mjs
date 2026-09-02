#!/usr/bin/env node
/**
 * Build Snp verse→slug ranges for PED citation linking (hosted discourses only).
 * Source: SuttaCentral /api/suttaplex/snp verseNo fields.
 */
import { readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src/data/snpVerseRanges.generated.ts");
const SNP_DIR = join(ROOT, "src/content/en/snp");
const API = "https://suttacentral.net/api/suttaplex/snp?language=en";

async function main() {
	const hosted = new Set(
		(await readdir(SNP_DIR))
			.filter((f) => f.endsWith(".mdx"))
			.map((f) => f.replace(/\.mdx$/, "")),
	);
	const res = await fetch(API, { headers: { "User-Agent": "suttas-with-astro" } });
	if (!res.ok) throw new Error(`SC API failed: ${res.status}`);
	const data = await res.json();
	const rows = [];
	for (const item of data) {
		const uid = item?.uid;
		const vn = item?.verseNo || "";
		const m = String(vn).match(/(\d+)\s*[–-]\s*(\d+)/);
		if (!uid || !hosted.has(uid) || !m) continue;
		rows.push({ slug: uid, start: Number(m[1]), end: Number(m[2]) });
	}
	rows.sort((a, b) => a.start - b.start);
	const body = rows
		.map((r) => `\t{ start: ${r.start}, end: ${r.end}, slug: "${r.slug}" },`)
		.join("\n");
	await writeFile(
		OUT,
		`// Auto-generated from SuttaCentral suttaplex verseNo for hosted Snp discourses.
// Used to resolve PED “Snp verse N” citations to native /{slug} links.
// Regenerate: node scripts/build-snp-verse-ranges.mjs

export type SnpVerseRange = { start: number; end: number; slug: string };

export const SNP_VERSE_RANGES: SnpVerseRange[] = [
${body}
];
`,
	);
	console.log(`Wrote ${OUT} (${rows.length} hosted ranges)`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
