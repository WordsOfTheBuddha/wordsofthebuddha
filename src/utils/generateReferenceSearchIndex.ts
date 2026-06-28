#!/usr/bin/env node

/**
 * Build reference-only search index (Sujato EN + matching Pali).
 * Excludes slugs already in the native searchIndex.
 * Output: public/reference-search-index.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { loadCatalogEntries } from "./generateCollectionReferenceIndex";

export interface ReferenceSearchDoc {
	slug: string;
	title: string;
	description?: string;
	content: string;
	contentPali?: string;
	priority?: number;
	referenceOnly: true;
	contentSearchable?: boolean;
}

function normalizeMdContent(md: string): string {
	if (!md) return "";
	let s = md.replace(/\r\n?/g, "\n");
	s = s.replace(/[ \t]+$/gm, "");
	return s;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const pliRoot = path.join(repoRoot, "src", "content", "pli");
const generatedDir = path.join(repoRoot, "generated");
const nativeIndexFile = path.join(generatedDir, "search-index.json");
const jsonOutFile = path.join(generatedDir, "reference-search-index.json");

async function loadNativeSlugs(): Promise<Set<string>> {
	try {
		const existing = await readFile(nativeIndexFile, "utf8");
		const docs = JSON.parse(existing) as { slug: string }[];
		return new Set(docs.map((d) => d.slug));
	} catch {
		// Native index may not exist yet during first build
	}
	return new Set();
}

function getPaliPathForSlug(slug: string): string {
	const collection = slug.match(/^[a-z]+/)?.[0];
	if (!collection) return "";
	const base = `${slug}.md`;
	return path.join(pliRoot, collection, base);
}

async function readPaliContent(slug: string): Promise<string | undefined> {
	const paliPath = getPaliPathForSlug(slug);
	if (!paliPath || !existsSync(paliPath)) return undefined;
	try {
		const raw = await readFile(paliPath, "utf8");
		const parsed = matter(raw);
		const content = normalizeMdContent(parsed.content || "");
		return content || undefined;
	} catch {
		return undefined;
	}
}

export async function buildReferenceSearchIndex(): Promise<ReferenceSearchDoc[]> {
	const nativeSlugs = await loadNativeSlugs();
	const entries = loadCatalogEntries();
	const docs: ReferenceSearchDoc[] = [];

	for (const entry of entries) {
		if (nativeSlugs.has(entry.slug)) continue;

		const contentPali = await readPaliContent(entry.slug);

		const doc: ReferenceSearchDoc = {
			slug: entry.slug,
			title: entry.title,
			description: entry.description,
			content: normalizeMdContent(entry.content),
			referenceOnly: true,
		};
		if (entry.priority !== undefined) doc.priority = entry.priority;
		if (contentPali) doc.contentPali = contentPali;
		docs.push(doc);
	}

	docs.sort((a, b) =>
		a.slug.localeCompare(b.slug, undefined, {
			numeric: true,
			sensitivity: "base",
		}),
	);

	return docs;
}

async function writeReferenceSearchIndex(docs: ReferenceSearchDoc[]) {
	await mkdir(generatedDir, { recursive: true });
	const json = JSON.stringify(docs);
	await writeFile(jsonOutFile, json, "utf8");
	return json;
}

export async function fullBuild() {
	const start = Date.now();
	const nativeSlugs = await loadNativeSlugs();
	console.log(
		`reference-search-index: native index has ${nativeSlugs.size} slugs`,
	);

	const docs = await buildReferenceSearchIndex();
	const json = await writeReferenceSearchIndex(docs);

	const bytes = Buffer.byteLength(json, "utf8");
	const kb = bytes / 1024;
	const withPali = docs.filter((d) => d.contentPali).length;
	const ms = Date.now() - start;
	console.log(
		`reference-search-index: wrote ${docs.length} docs (${withPali} with Pali, ${kb.toFixed(1)} KB) in ${ms}ms`,
	);
}

const isDirectRun = process.argv[1]?.includes("generateReferenceSearchIndex");
if (isDirectRun) {
	fullBuild().catch((err) => {
		console.error("reference-search-index generation failed:", err);
		process.exit(1);
	});
}
