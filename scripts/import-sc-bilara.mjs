#!/usr/bin/env node
/**
 * Import Pali root text and Sujato reference translations from SuttaCentral bilara-data.
 *
 * - Pali (paragraph) → src/content/pli/{collection}/{id}.md
 *     SC paragraph structure via html/ cognate markup; replaces files previously
 *     imported from bilara (source: suttacentral/bilara-data). Skips curated pli.
 * - Pali (segments)  → src/content/references/pli-ms/{collection}/{id}.md
 *     One bilara segment per paragraph; used for Sujato reference pairing.
 * - Sujato           → src/content/references/sujato/{collection}/{id}.md
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
const PLI_MS_DIR = path.join(PROJECT_ROOT, "src/content/references/pli-ms");
const REF_DIR = path.join(PROJECT_ROOT, "src/content/references/sujato");

const DEFAULT_COLLECTIONS = ["dhp", "iti", "ud", "mn", "snp", "sn", "an", "kp", "dn"];
const BILARA_REPO = "https://github.com/suttacentral/bilara-data.git";
const BILARA_BRANCH = "published";
const SPARSE_PATHS = [
	"root/pli/ms/sutta",
	"html/pli/ms/sutta",
	"translation/en/sujato/sutta",
];

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
		execSync(
			`git -C "${CACHE_DIR}" sparse-checkout set ${SPARSE_PATHS.join(" ")}`,
			{ stdio: "inherit" },
		);
		return;
	}

	mkdirSync(path.dirname(CACHE_DIR), { recursive: true });
	console.log("Cloning bilara-data (sparse, published branch)…");
	execSync(
		`git clone --filter=blob:none --sparse --branch ${BILARA_BRANCH} --depth 1 ${BILARA_REPO} "${CACHE_DIR}"`,
		{ stdio: "inherit" },
	);
	execSync(`git -C "${CACHE_DIR}" sparse-checkout set ${SPARSE_PATHS.join(" ")}`, {
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

/** Verse-line segments (including the closing line) join with newlines. */
function isVerseLineSegment(tpl) {
	return typeof tpl === "string" && tpl.includes("verse-line");
}

/** Verse-line spans without <p> tags continue the current paragraph. */
function isInlineVerseLineTemplate(tpl) {
	if (typeof tpl !== "string") return false;
	return (
		tpl.includes("verse-line") &&
		!tpl.includes("<p") &&
		!tpl.includes("</p>")
	);
}

/** Expand sparse bilara html.json templates to <p> boundaries (matches SC API). */
function expandHtmlTemplate(tpl) {
	const template = tpl ?? " {} ";
	const [open, close] = template.split("{}");
	if (open.includes("<p") || close.includes("</p>")) {
		return { open, close };
	}
	if (isInlineVerseLineTemplate(template)) {
		return { open: "", close: "" };
	}
	if (/^\s+\{\}\s+$/.test(template)) {
		return { open: "<p>", close: "</p>" };
	}
	if (/^\s+\{\}$/.test(template)) {
		return { open: "<p>", close: "" };
	}
	if (template === "{}" || (open === "" && close === "")) {
		return { open: "", close: "" };
	}
	if (/^\{\}\s+$/.test(template)) {
		return { open: "", close: "</p>" };
	}
	return { open: "<p>", close: "</p>" };
}

function extractMeta(segments) {
	const meta = {};
	for (const [key, raw] of Object.entries(segments)) {
		const part = key.split(":")[1] ?? "";
		if (part.startsWith("0.")) {
			meta[part] = stripBilaraMarkup(raw);
		}
	}
	const title =
		meta["0.3"] ||
		meta["0.2"] ||
		meta["0.1"]?.replace(/\s+\d+[\d.]*\s*$/, "").trim() ||
		undefined;
	const normalizedTitle =
		title && title !== "~" && title.trim() !== "" ? title : undefined;
	return { meta, title: normalizedTitle };
}

function orderedContentKeys(segments) {
	return Object.keys(segments)
		.filter((key) => {
			const part = key.split(":")[1] ?? "";
			return part && !part.startsWith("0.") && !key.startsWith("_");
		})
		.sort(compareSegmentKeys);
}

/** One bilara segment → one paragraph (for pli-ms / Sujato pairing). */
function segmentsToSegmentParagraphs(segments) {
	const paragraphs = [];
	for (const key of orderedContentKeys(segments)) {
		const text = stripBilaraMarkup(segments[key]);
		if (!text || isEndMarker(text)) continue;
		paragraphs.push(text);
	}
	return paragraphs;
}

/** Merge segments using html/ cognate markup (SC paragraph view). */
function segmentsToParagraphs(segments, htmlMarkup) {
	const paragraphs = [];
	let current = "";

	for (const key of orderedContentKeys(segments)) {
		const text = stripBilaraMarkup(segments[key]);
		if (!text || isEndMarker(text)) continue;

		const tpl = htmlMarkup?.[key];
		const { open, close } = expandHtmlTemplate(tpl);
		if (open.includes("<p")) current = "";
		if (current && text) {
			current += isVerseLineSegment(tpl) ? `\n${text}` : ` ${text}`;
		} else {
			current += text;
		}
		if (close.includes("</p>")) {
			paragraphs.push(current);
			current = "";
		}
	}

	if (current) paragraphs.push(current);
	return paragraphs;
}

function htmlPathForRoot(rootPath) {
	return rootPath
		.replace(
			`${path.join(CACHE_DIR, "root/pli/ms/sutta")}`,
			`${path.join(CACHE_DIR, "html/pli/ms/sutta")}`,
		)
		.replace(/_root-pli-ms\.json$/, "_html.json");
}

function loadHtmlMarkup(rootPath) {
	const htmlPath = htmlPathForRoot(rootPath);
	if (!existsSync(htmlPath)) return null;
	return JSON.parse(readFileSync(htmlPath, "utf-8"));
}

function isBilaraImportedPali(filePath) {
	if (!existsSync(filePath)) return true;
	const content = readFileSync(filePath, "utf-8");
	return (
		/^source:\s*suttacentral\/bilara-data\s*$/m.test(content) &&
		/^edition:\s*ms\s*$/m.test(content)
	);
}

function yamlScalar(value) {
	const text = String(value);
	if (
		text.includes(":") ||
		text.includes("#") ||
		text.includes("'") ||
		text.includes('"') ||
		text.startsWith(" ") ||
		text.endsWith(" ") ||
		text.startsWith("[") ||
		text.startsWith("{") ||
		text.startsWith("@") ||
		text.startsWith("`") ||
		text.startsWith("|") ||
		text.startsWith(">") ||
		text === "*" ||
		text === "&" ||
		text === "!" ||
		text === "%" ||
		text === "~"
	) {
		return JSON.stringify(text);
	}
	return text;
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
		lines.push(`${key}: ${yamlScalar(value)}`);
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
		console.log(
			`[dry-run] would write ${label}: ${path.relative(PROJECT_ROOT, filePath)}`,
		);
		return existsSync(filePath) ? "updated" : "created";
	}
	mkdirSync(path.dirname(filePath), { recursive: true });
	const existed = existsSync(filePath);
	writeFileSync(filePath, content, "utf-8");
	return existed ? "updated" : "created";
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
		paliUpdated: 0,
		paliSkipped: 0,
		pliMsCreated: 0,
		pliMsUpdated: 0,
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

			const segments = JSON.parse(readFileSync(file, "utf-8"));
			const { title } = extractMeta(segments);
			const htmlMarkup = loadHtmlMarkup(file);

			const pliMsPath = path.join(PLI_MS_DIR, collection, `${id}.md`);
			const segmentParagraphs = segmentsToSegmentParagraphs(segments);
			const pliMsMarkdown = buildMarkdown({
				slug: id,
				title,
				body: segmentParagraphs,
				extraFrontmatter: { edition: "ms", granularity: "segment" },
			});
			const pliMsResult = writeIfNeeded(pliMsPath, pliMsMarkdown, {
				force: true,
				label: "pli-ms",
			});
			if (pliMsResult === "created") stats.pliMsCreated++;
			else if (pliMsResult === "updated") stats.pliMsUpdated++;

			const pliPath = path.join(PLI_DIR, collection, `${id}.md`);
			const mayWritePli =
				!existsSync(pliPath) || isBilaraImportedPali(pliPath);

			if (!mayWritePli) {
				stats.paliSkipped++;
				continue;
			}

			const mergedParagraphs = segmentsToParagraphs(segments, htmlMarkup);
			const pliMarkdown = buildMarkdown({
				slug: id,
				title,
				body: mergedParagraphs,
				extraFrontmatter: { edition: "ms", granularity: "paragraph" },
			});

			const existed = existsSync(pliPath);
			const pliResult = writeIfNeeded(pliPath, pliMarkdown, {
				force: forcePali,
				label: "pali",
			});
			if (pliResult === "created") stats.paliCreated++;
			else if (pliResult === "updated") stats.paliUpdated++;
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
			const { title } = extractMeta(segments);
			const paragraphs = segmentsToSegmentParagraphs(segments);
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
	console.log(`  Pali (paragraph) created: ${stats.paliCreated}`);
	console.log(`  Pali (paragraph) updated: ${stats.paliUpdated}`);
	console.log(`  Pali (paragraph) skipped (curated): ${stats.paliSkipped}`);
	console.log(`  Pli-ms (segment) created: ${stats.pliMsCreated}`);
	console.log(`  Pli-ms (segment) updated: ${stats.pliMsUpdated}`);
	console.log(`  Sujato references created: ${stats.refCreated}`);
	console.log(`  Sujato references updated: ${stats.refUpdated}`);
	console.log(`  Sujato references skipped: ${stats.refSkipped}`);
	console.log(`  Collections: ${collections.join(", ")}`);
}

export {
	compareSegmentKeys,
	expandHtmlTemplate,
	isInlineVerseLineTemplate,
	isVerseLineSegment,
	orderedContentKeys,
	segmentsToParagraphs,
	stripBilaraMarkup,
};

const isDirectRun = process.argv[1]?.endsWith("import-sc-bilara.mjs");
if (isDirectRun) main();
