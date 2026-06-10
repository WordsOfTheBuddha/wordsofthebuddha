#!/usr/bin/env node
/**
 * Import Pali root text and Sujato reference translations from SuttaCentral bilara-data.
 *
 * - Pali  → src/content/pli/{collection}/{id}.md       (skips existing files)
 * - Sujato → src/content/references/sujato/{collection}/{id}.md
 *
 * Usage:
 *   node scripts/import-sc-bilara.mjs
 *   node scripts/import-sc-bilara.mjs --collections an,sn
 *   node scripts/import-sc-bilara.mjs --references-only
 *   node scripts/import-sc-bilara.mjs --force-pali
 */

import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(PROJECT_ROOT, ".cache/bilara-data");
const PLI_DIR = path.join(PROJECT_ROOT, "src/content/pli");
const REF_DIR = path.join(PROJECT_ROOT, "src/content/references/sujato");

const DEFAULT_COLLECTIONS = ["dhp", "iti", "ud", "mn", "snp", "sn", "an", "kp", "dn"];
const BILARA_REPO = "https://github.com/suttacentral/bilara-data.git";
const BILARA_BRANCH = "published";

const args = process.argv.slice(2);
const collections = getArgValues("--collections") ?? DEFAULT_COLLECTIONS;
const referencesOnly = args.includes("--references-only");
const paliOnly = args.includes("--pali-only");
const forcePali = args.includes("--force-pali");
const dryRun = args.includes("--dry-run");

function getArgValues(flag) {
	const idx = args.indexOf(flag);
	if (idx === -1) return null;
	const value = args[idx + 1];
	if (!value || value.startsWith("--")) return null;
	return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function ensureBilaraCache() {
	if (existsSync(path.join(CACHE_DIR, ".git"))) {
		console.log("Updating bilara-data cache…");
		execSync(`git -C "${CACHE_DIR}" fetch origin ${BILARA_BRANCH} --depth=1`, {
			stdio: "inherit",
		});
		execSync(`git -C "${CACHE_DIR}" checkout ${BILARA_BRANCH}`, {
			stdio: "inherit",
		});
		execSync(`git -C "${CACHE_DIR}" reset --hard origin/${BILARA_BRANCH}`, {
			stdio: "inherit",
		});
		return;
	}

	mkdirSync(path.dirname(CACHE_DIR), { recursive: true });
	console.log("Cloning bilara-data (sparse, published branch)…");
	execSync(
		`git clone --filter=blob:none --sparse --branch ${BILARA_BRANCH} --depth 1 ${BILARA_REPO} "${CACHE_DIR}"`,
		{ stdio: "inherit" },
	);
	execSync(`git -C "${CACHE_DIR}" sparse-checkout set root/pli/ms/sutta translation/en/sujato/sutta`, {
		stdio: "inherit",
	});
}

function walkJsonFiles(dir) {
	if (!existsSync(dir)) return [];
	const results = [];
	const stack = [dir];
	while (stack.length) {
		const current = stack.pop();
		for (const entry of readdirSync(current)) {
			const full = path.join(current, entry);
			const st = statSync(full);
			if (st.isDirectory()) stack.push(full);
			else if (entry.endsWith(".json")) results.push(full);
		}
	}
	return results;
}

function parseSuttaId(filename) {
	const base = path.basename(filename, ".json");
	const match = base.match(/^(.+?)_(?:root-pli-ms|translation-en-sujato)$/);
	return match?.[1] ?? null;
}

function collectionFromId(id) {
	return id.match(/^[a-z]+/)?.[0] ?? "";
}

function compareSegmentKeys(a, b) {
	const parse = (key) => {
		const seg = key.split(":")[1] ?? "";
		return seg.split(".").map((n) => Number.parseInt(n, 10) || 0);
	};
	const aa = parse(a);
	const bb = parse(b);
	for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
		const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

function stripBilaraMarkup(text) {
	return text
		.replace(/\*\*(.+?)\*\*/g, "$1")
		.replace(/\*(.+?)\*/g, "$1")
		.replace(/_(.+?)_/g, "$1")
		.replace(/#\d+/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function isEndMarker(text) {
	return /^(Paṭhama|Dutiya|Tatiya|Catuttha|Pañcama|Chaṭṭha|Sattama|Aṭṭhama|Navama|Dasama|Ekādasama)\.(ṁ)?$/.test(
		text.trim(),
	);
}

function segmentsToBody(segments, { includeHeaders = false } = {}) {
	const entries = Object.entries(segments).sort(([a], [b]) =>
		compareSegmentKeys(a, b),
	);

	const meta = {};
	for (const [key, raw] of entries) {
		const part = key.split(":")[1] ?? "";
		if (part.startsWith("0.")) {
			meta[part] = stripBilaraMarkup(raw);
		}
	}

	const paragraphs = [];
	for (const [key, raw] of entries) {
		const part = key.split(":")[1] ?? "";
		if (!part || part.startsWith("0.")) continue;
		const text = stripBilaraMarkup(raw);
		if (!text || isEndMarker(text)) continue;
		paragraphs.push(text);
	}

	const title =
		meta["0.3"] ||
		meta["0.2"] ||
		meta["0.1"]?.replace(/\s+\d+[\d.]*\s*$/, "").trim() ||
		undefined;

	return { paragraphs, title, meta };
}

function buildMarkdown({ slug, title, body, extraFrontmatter = {} }) {
	const fm = {
		slug,
		source: "suttacentral/bilara-data",
		...extraFrontmatter,
	};
	if (title) fm.title = title;

	const lines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		lines.push(`${key}: ${value}`);
	}
	lines.push("---", "");
	if (body.length) lines.push(body.join("\n\n"));
	return `${lines.join("\n")}\n`;
}

function writeIfNeeded(filePath, content, { force = false, label }) {
	if (existsSync(filePath) && !force) {
		return "skipped";
	}
	if (dryRun) {
		console.log(`[dry-run] would write ${label}: ${path.relative(PROJECT_ROOT, filePath)}`);
		return existsSync(filePath) ? "skipped" : "created";
	}
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, "utf-8");
	return existsSync(filePath) && force ? "updated" : "created";
}

function main() {
	ensureBilaraCache();

	const paliFiles = walkJsonFiles(path.join(CACHE_DIR, "root/pli/ms/sutta")).filter(
		(f) => f.endsWith("_root-pli-ms.json"),
	);
	const refFiles = walkJsonFiles(
		path.join(CACHE_DIR, "translation/en/sujato/sutta"),
	).filter((f) => f.endsWith("_translation-en-sujato.json"));

	const collectionSet = new Set(collections);
	const stats = {
		paliCreated: 0,
		paliSkipped: 0,
		refCreated: 0,
		refUpdated: 0,
		refSkipped: 0,
	};

	if (!referencesOnly) {
		for (const file of paliFiles) {
			const id = parseSuttaId(file);
			if (!id) continue;
			const collection = collectionFromId(id);
			if (!collectionSet.has(collection)) continue;

			// Dhp uses chapter files locally; skip bulk per-verse pali import.
			if (collection === "dhp") continue;

			const outPath = path.join(PLI_DIR, collection, `${id}.md`);
			if (existsSync(outPath) && !forcePali) {
				stats.paliSkipped++;
				continue;
			}

			const segments = JSON.parse(readFileSync(file, "utf-8"));
			const { paragraphs, title } = segmentsToBody(segments);
			const markdown = buildMarkdown({
				slug: id,
				title,
				body: paragraphs,
				extraFrontmatter: { edition: "ms" },
			});

			const result = writeIfNeeded(outPath, markdown, {
				force: forcePali,
				label: "pali",
			});
			if (result === "created" || result === "updated") stats.paliCreated++;
			else stats.paliSkipped++;
		}
	}

	if (!paliOnly) {
		for (const file of refFiles) {
			const id = parseSuttaId(file);
			if (!id) continue;
			const collection = collectionFromId(id);
			if (!collectionSet.has(collection)) continue;

			const outPath = path.join(REF_DIR, collection, `${id}.md`);
			const segments = JSON.parse(readFileSync(file, "utf-8"));
			const { paragraphs, title } = segmentsToBody(segments);
			const markdown = buildMarkdown({
				slug: id,
				title,
				body: paragraphs,
				extraFrontmatter: {
					translator: "sujato",
					license: "CC0",
				},
			});

			const existed = existsSync(outPath);
			const result = writeIfNeeded(outPath, markdown, {
				force: true,
				label: "reference",
			});
			if (result === "skipped") stats.refSkipped++;
			else if (existed) stats.refUpdated++;
			else stats.refCreated++;
		}
	}

	console.log("\nImport complete:");
	console.log(`  Pali created/updated: ${stats.paliCreated}`);
	console.log(`  Pali skipped (existing): ${stats.paliSkipped}`);
	console.log(`  References created: ${stats.refCreated}`);
	console.log(`  References updated: ${stats.refUpdated}`);
	console.log(`  References skipped: ${stats.refSkipped}`);
	console.log(`  Collections: ${collections.join(", ")}`);
}

main();
