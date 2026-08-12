#!/usr/bin/env node

/**
 * Compact discourse ID+title list for home (and later /search) autosuggest.
 * Reads generated search indexes; output: generated/discourse-suggest-index.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DiscourseSuggestEntry } from "./discourseIdSuggest";

const DISCOURSE_SLUG = /^[a-z]{2,5}\d/i;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const generatedDir = path.join(repoRoot, "generated");
const nativeIndexFile = path.join(generatedDir, "search-index.json");
const referenceIndexFile = path.join(generatedDir, "reference-search-index.json");
const jsonOutFile = path.join(generatedDir, "discourse-suggest-index.json");

interface IndexDoc {
	slug: string;
	title?: string;
}

async function readDocs(file: string): Promise<IndexDoc[]> {
	try {
		const raw = await readFile(file, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as IndexDoc[]) : [];
	} catch {
		return [];
	}
}

function toEntries(
	docs: IndexDoc[],
	referenceOnly: boolean,
): DiscourseSuggestEntry[] {
	const out: DiscourseSuggestEntry[] = [];
	for (const doc of docs) {
		if (!doc?.slug || !DISCOURSE_SLUG.test(doc.slug)) continue;
		out.push({
			slug: doc.slug,
			title: typeof doc.title === "string" ? doc.title : doc.slug,
			referenceOnly,
		});
	}
	return out;
}

export async function generateDiscourseSuggestIndex(): Promise<void> {
	const start = Date.now();
	const native = toEntries(await readDocs(nativeIndexFile), false);
	const nativeSlugs = new Set(native.map((entry) => entry.slug));
	const reference = toEntries(await readDocs(referenceIndexFile), true).filter(
		(entry) => !nativeSlugs.has(entry.slug),
	);
	const entries = [...native, ...reference];
	const payload = { version: 1 as const, entries };

	await mkdir(generatedDir, { recursive: true });
	const json = JSON.stringify(payload);
	await writeFile(jsonOutFile, json, "utf8");

	const kb = Buffer.byteLength(json, "utf8") / 1024;
	console.log(
		`discourse-suggest-index: wrote ${entries.length} entries (native ${native.length}, reference ${reference.length}) to generated/discourse-suggest-index.json (${kb.toFixed(1)} KB) in ${Date.now() - start}ms`,
	);
}

const isDirectRun = process.argv[1]?.includes("generateDiscourseSuggestIndex");
if (isDirectRun) {
	generateDiscourseSuggestIndex().catch((err) => {
		console.error("discourse-suggest-index generation failed:", err);
		process.exit(1);
	});
}
