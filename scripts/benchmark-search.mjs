#!/usr/bin/env node

/**
 * Benchmark /api/search with and without references=true.
 *
 * Usage:
 *   node scripts/benchmark-search.mjs
 *   node scripts/benchmark-search.mjs --base-url http://localhost:4321
 *   node scripts/benchmark-search.mjs --runs 5
 *
 * Requires a running dev server (astro dev).
 */

const BASE_URL =
	process.argv.find((a, i) => process.argv[i - 1] === "--base-url") ||
	process.env.SEARCH_BENCH_URL ||
	"http://localhost:4321";

const RUNS = Number(
	process.argv.find((a, i) => process.argv[i - 1] === "--runs") || "3",
);

const QUERIES = [
	"craving",
	"a",
	"āsavānaṁ",
	"āsavānaṁ khayā",
	"^SN22 āsavānaṁ",
	'^SN "āsavānaṁ khaya"',
	"^SN āsavānaṁ khaya",
];

async function search(query, references) {
	const params = new URLSearchParams({
		q: query,
		limit: "50",
		categories: "false",
		discourses: "true",
	});
	if (references) params.set("references", "true");

	const url = `${BASE_URL}/api/search?${params}`;
	const t0 = performance.now();
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} for ${query} (references=${references})`);
	}
	const data = await res.json();
	const clientMs = Math.round(performance.now() - t0);
	return {
		query,
		references,
		clientMs,
		total: data.timing?.total ?? clientMs,
		discourses: data.timing?.discourses,
		refIndexLoad: data.timing?.refIndexLoad,
		refDocCount: data.timing?.refDocCount,
		refContentScan: data.timing?.refContentScan,
		count: data.results?.length ?? 0,
	};
}

function median(nums) {
	const sorted = [...nums].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(nums) {
	const sorted = [...nums].sort((a, b) => a - b);
	const idx = Math.ceil(sorted.length * 0.95) - 1;
	return sorted[Math.max(0, idx)];
}

async function benchQuery(query) {
	const nativeRuns = [];
	const refRuns = [];

	for (let i = 0; i < RUNS; i++) {
		nativeRuns.push(await search(query, false));
		refRuns.push(await search(query, true));
	}

	const nativeTotals = nativeRuns.map((r) => r.total);
	const refTotals = refRuns.map((r) => r.total);
	const lastRef = refRuns[refRuns.length - 1];

	return {
		query,
		native: {
			p50: median(nativeTotals),
			p95: p95(nativeTotals),
			count: nativeRuns[0].count,
		},
		references: {
			p50: median(refTotals),
			p95: p95(refTotals),
			count: refRuns[0].count,
			refIndexLoad: lastRef.refIndexLoad,
			refDocCount: lastRef.refDocCount,
			refContentScan: lastRef.refContentScan,
		},
		deltaP50: median(refTotals) - median(nativeTotals),
	};
}

async function main() {
	console.log(`Search benchmark → ${BASE_URL} (${RUNS} runs per query)\n`);

	try {
		const health = await fetch(`${BASE_URL}/api/search?q=test&limit=1`);
		if (!health.ok) throw new Error(`health check failed: ${health.status}`);
	} catch (e) {
		console.error(
			`Cannot reach ${BASE_URL}. Start dev server: npm run dev\n`,
			e.message,
		);
		process.exit(1);
	}

	const rows = [];
	for (const query of QUERIES) {
		process.stdout.write(`  ${query} ... `);
		const row = await benchQuery(query);
		rows.push(row);
		console.log(
			`native p50=${row.native.p50}ms | refs p50=${row.references.p50}ms (+${row.deltaP50}ms)`,
		);
	}

	console.log("\n## Summary (API timing.total, ms)\n");
	console.log(
		"| Query | Native p50 | Native p95 | Refs p50 | Refs p95 | Δ p50 | Ref docs | Ref load |",
	);
	console.log(
		"|-------|----------:|----------:|---------:|---------:|------:|---------:|---------:|",
	);
	for (const row of rows) {
		const q = row.query.replace(/\|/g, "\\|");
		console.log(
			`| ${q} | ${row.native.p50} | ${row.native.p95} | ${row.references.p50} | ${row.references.p95} | +${row.deltaP50} | ${row.references.refDocCount ?? "—"} | ${row.references.refIndexLoad ?? "—"} |`,
		);
	}

	// Bundle size estimate
	try {
		const { statSync, existsSync } = await import("node:fs");
		const { join, dirname } = await import("node:path");
		const { fileURLToPath } = await import("node:url");
		const root = join(dirname(fileURLToPath(import.meta.url)), "..");
		const nativeKb =
			statSync(join(root, "generated/search-index.json")).size / 1024;
		const refKb = existsSync(join(root, "generated/reference-search-index.json"))
			? statSync(join(root, "generated/reference-search-index.json")).size / 1024
			: 0;
		console.log(
			`\nIndex sizes: search-index.json ${nativeKb.toFixed(0)} KB | reference-search-index.json ${refKb.toFixed(0)} KB`,
		);
	} catch {
		// optional
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
