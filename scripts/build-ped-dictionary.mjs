#!/usr/bin/env node
/**
 * Build a compact PED (PTS Pali-English Dictionary) headword map for offline
 * client lookup. Source: SuttaCentral sc-data pli2en_pts.json (CC BY-NC 3.0 PTS).
 *
 * Usage:
 *   node scripts/build-ped-dictionary.mjs
 *   node scripts/build-ped-dictionary.mjs --from tmp/pli2en_pts.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src/data/pedDictionary.generated.json");
const SOURCE_URL =
	"https://raw.githubusercontent.com/suttacentral/sc-data/main/dictionaries/complex/en/pli2en_pts.json";

function normalizeKey(word) {
	return word
		.normalize("NFC")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
}

async function loadSource(fromPath) {
	if (fromPath) {
		return JSON.parse(await readFile(fromPath, "utf8"));
	}
	console.log("Downloading", SOURCE_URL);
	const res = await fetch(SOURCE_URL);
	if (!res.ok) {
		throw new Error(`Download failed: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

function buildMap(entries) {
	/** @type {Record<string, string>} */
	const map = {};
	let dups = 0;
	for (const entry of entries) {
		const key = normalizeKey(entry.word || "");
		const text = (entry.text || "").trim();
		if (!key || !text) continue;
		if (map[key]) dups++;
		if (!map[key] || text.length > map[key].length) {
			map[key] = text;
		}
	}
	return { map, dups };
}

async function main() {
	const fromIdx = process.argv.indexOf("--from");
	const fromPath = fromIdx >= 0 ? process.argv[fromIdx + 1] : null;
	const entries = await loadSource(fromPath);
	if (!Array.isArray(entries)) {
		throw new Error("Expected PED source to be a JSON array");
	}
	const { map, dups } = buildMap(entries);
	await mkdir(dirname(OUT), { recursive: true });
	const payload = {
		_meta: {
			source: "suttacentral/sc-data dictionaries/complex/en/pli2en_pts.json",
			license: "CC BY-NC 3.0 (Pali Text Society Pali-English Dictionary)",
			generatedAt: new Date().toISOString(),
			entries: Object.keys(map).length,
		},
		entries: map,
	};
	await writeFile(OUT, JSON.stringify(payload), "utf8");
	const bytes = Buffer.byteLength(JSON.stringify(payload));
	console.log(
		`Wrote ${OUT} (${Object.keys(map).length} headwords, ${dups} duplicate keys resolved, ${(bytes / 1e6).toFixed(1)} MB)`,
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
