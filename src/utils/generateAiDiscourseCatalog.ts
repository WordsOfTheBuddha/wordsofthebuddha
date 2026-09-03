#!/usr/bin/env node

/**
 * Compact ID + Pāli + English title list for Ask rewrite prompts.
 * Includes discourses with frontmatter `priority`, plus all DN / MN / Snp
 * (native English when present; otherwise reference-only titles).
 * Reads search-meta + reference-search-index; writes ai-discourse-catalog.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	AI_CATALOG_ALWAYS_COLLECTIONS,
	AI_CATALOG_DISCOURSE_SLUG,
	buildAiDiscourseCatalogEntries,
	collectionFromDiscourseSlug,
	formatAiDiscourseCatalogPromptBlock,
	type AiDiscourseCatalogSourceDoc,
} from "./aiDiscourseCatalog";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const generatedDir = path.join(repoRoot, "generated");
const metaFile = path.join(generatedDir, "search-meta.json");
const referenceFile = path.join(generatedDir, "reference-search-index.json");
const outFile = path.join(generatedDir, "ai-discourse-catalog.json");

async function readDocs(file: string): Promise<AiDiscourseCatalogSourceDoc[]> {
	try {
		const raw = await readFile(file, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as AiDiscourseCatalogSourceDoc[]) : [];
	} catch {
		return [];
	}
}

function mergeCatalogSources(
	native: readonly AiDiscourseCatalogSourceDoc[],
	reference: readonly AiDiscourseCatalogSourceDoc[],
): AiDiscourseCatalogSourceDoc[] {
	const bySlug = new Map<string, AiDiscourseCatalogSourceDoc>();
	for (const doc of native) {
		const slug = (doc.slug || "").trim();
		if (!slug || !AI_CATALOG_DISCOURSE_SLUG.test(slug)) continue;
		bySlug.set(slug.toLowerCase(), doc);
	}
	for (const doc of reference) {
		const slug = (doc.slug || "").trim();
		if (!slug || !AI_CATALOG_DISCOURSE_SLUG.test(slug)) continue;
		const key = slug.toLowerCase();
		if (bySlug.has(key)) continue;
		// Fill DN / MN / Snp gaps that exist only as reference translations.
		if (!AI_CATALOG_ALWAYS_COLLECTIONS.has(collectionFromDiscourseSlug(slug))) {
			continue;
		}
		bySlug.set(key, { slug, title: doc.title });
	}
	return [...bySlug.values()];
}

async function main(): Promise<void> {
	const start = Date.now();
	const native = await readDocs(metaFile);
	if (native.length === 0) {
		console.error(
			"[ai-discourse-catalog] Missing search-meta.json — run generateSearchIndex first.",
		);
		process.exit(1);
	}
	const reference = await readDocs(referenceFile);
	const docs = mergeCatalogSources(native, reference);
	const entries = buildAiDiscourseCatalogEntries(docs);
	const promptBlock = formatAiDiscourseCatalogPromptBlock(entries);
	await mkdir(generatedDir, { recursive: true });
	const payload = {
		generatedAt: new Date().toISOString(),
		count: entries.length,
		entries,
		promptBlock,
	};
	await writeFile(outFile, `${JSON.stringify(payload)}\n`, "utf8");
	const kb = Buffer.byteLength(JSON.stringify(payload), "utf8") / 1024;
	console.log(
		`ai-discourse-catalog: wrote ${entries.length} discourses (${kb.toFixed(1)} KB) in ${Date.now() - start}ms`,
	);
}

main().catch((error) => {
	console.error("[ai-discourse-catalog] Failed:", error);
	process.exit(1);
});
