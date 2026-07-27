#!/usr/bin/env node
/**
 * Post-build: write measured gzip byte sizes into offline-manifest.json.
 *
 * The offline UI used to sample the first 3 URLs per collection, which badly
 * skewed MN/SN estimates, and it omitted collection index pages that the
 * download actually caches. After this step the manifest carries true totals
 * matching what the service worker stores (HTML gzipped via CompressionStream).
 *
 * Writes to every copy of the manifest found under dist/ / .vercel/.
 */
import {
	existsSync,
	readFileSync,
	writeFileSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = process.cwd();

const MANIFEST_CANDIDATES = [
	join(ROOT, "dist/client/offline-manifest.json"),
	join(ROOT, ".vercel/output/static/offline-manifest.json"),
];

const CLIENT_ROOTS = [
	join(ROOT, "dist/client"),
	join(ROOT, ".vercel/output/static"),
];

function belongsToCollectionPath(p, key) {
	const prefix = `/${key}`;
	if (!p.startsWith(prefix)) return false;
	const next = p.slice(prefix.length);
	if (next.length === 0) return true;
	const ch = next.charAt(0);
	return ch === "/" || ch === "-" || (ch >= "0" && ch <= "9");
}

/** Resolve a site path like /mn26 to a built index.html on disk. */
function resolveHtml(clientRoot, urlPath) {
	const clean = urlPath.replace(/\/+$/, "") || "";
	const candidates = [
		join(clientRoot, clean.slice(1), "index.html"),
		join(clientRoot, `${clean.slice(1)}.html`),
	];
	if (clean === "" || clean === "/") {
		candidates.unshift(join(clientRoot, "index.html"));
	}
	for (const c of candidates) {
		if (existsSync(c) && statSync(c).isFile()) return c;
	}
	return null;
}

function gzipSize(filePath) {
	const raw = readFileSync(filePath);
	return gzipSync(raw, { level: 6 }).byteLength;
}

function sumUrls(clientRoot, urls) {
	let bytes = 0;
	let found = 0;
	const missing = [];
	for (const url of urls) {
		const file = resolveHtml(clientRoot, url);
		if (!file) {
			missing.push(url);
			continue;
		}
		bytes += gzipSize(file);
		found++;
	}
	return { bytes, found, missing };
}

function pickClientRoot() {
	for (const root of CLIENT_ROOTS) {
		if (existsSync(join(root, "offline-manifest.json"))) return root;
	}
	return null;
}

function enrichManifest(manifestPath, clientRoot) {
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	const discourseByCollection = manifest.discourseByCollection || {};
	const collectionPages = manifest.collectionPages || [];
	const onPages = manifest.onPages || [];

	const byCollection = {};
	let totalFound = 0;
	const allMissing = [];

	for (const key of Object.keys(discourseByCollection)) {
		const discourses = discourseByCollection[key] || [];
		const pages = collectionPages.filter((p) =>
			belongsToCollectionPath(p, key),
		);
		const urls = [...new Set([...discourses, ...pages])];
		const { bytes, found, missing } = sumUrls(clientRoot, urls);
		byCollection[key] = bytes;
		totalFound += found;
		allMissing.push(...missing);
	}

	const onUrls = ["/discover", ...onPages];
	const on = sumUrls(clientRoot, onUrls);
	totalFound += on.found;
	allMissing.push(...on.missing);

	manifest.sizes = {
		encoding: "gzip",
		measuredAt: new Date().toISOString(),
		byCollection,
		onPages: on.bytes,
	};

	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
	return {
		byCollection,
		onPages: on.bytes,
		totalFound,
		missing: allMissing,
	};
}

function formatMb(n) {
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function main() {
	const clientRoot = pickClientRoot();
	if (!clientRoot) {
		console.log(
			"enrich-offline-manifest-sizes: no dist client root found (skip)",
		);
		return;
	}

	const targets = MANIFEST_CANDIDATES.filter((p) => existsSync(p));
	if (targets.length === 0) {
		console.log(
			"enrich-offline-manifest-sizes: no offline-manifest.json in dist (skip)",
		);
		return;
	}

	let last = null;
	for (const path of targets) {
		// Prefer the client root that contains this manifest
		const root = path.includes(".vercel")
			? join(ROOT, ".vercel/output/static")
			: join(ROOT, "dist/client");
		last = enrichManifest(path, existsSync(root) ? root : clientRoot);
		console.log(
			`enrich-offline-manifest-sizes: wrote sizes → ${path.replace(ROOT + "/", "")}`,
		);
	}

	if (last) {
		const entries = Object.entries(last.byCollection).sort(
			(a, b) => b[1] - a[1],
		);
		for (const [k, bytes] of entries.slice(0, 12)) {
			console.log(`  ${k.padEnd(6)} ${formatMb(bytes)}`);
		}
		console.log(`  on     ${formatMb(last.onPages)}`);
		const all = entries.reduce((s, [, b]) => s + b, 0) + last.onPages;
		console.log(
			`  total  ${formatMb(all)}  (${last.totalFound} pages, ${last.missing.length} missing)`,
		);
		if (last.missing.length && last.missing.length <= 20) {
			console.log(`  missing: ${last.missing.join(", ")}`);
		}
	}
}

main();
