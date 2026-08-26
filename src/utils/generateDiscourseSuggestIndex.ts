#!/usr/bin/env node

/**
 * Compact discourse ID+title list plus navigable site pages for autosuggest.
 * Reads generated search indexes; output: generated/discourse-suggest-index.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import matter from "gray-matter";
import type { DiscourseSuggestEntry } from "./discourseIdSuggest";
import { buildAllContent, canonicalOnSlug } from "./discover-data";
import {
	dedupePageEntries,
	SITE_PAGE_SUGGESTIONS,
	type PageSuggestEntry,
} from "./pageSuggest";
import {
	isRootPostCandidate,
	parsePostSlugFromGlobPath,
} from "./rootPostSlugs";

const DISCOURSE_SLUG = /^[a-z]{2,5}\d/i;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const generatedDir = path.join(repoRoot, "generated");
const nativeIndexFile = path.join(generatedDir, "search-index.json");
const referenceIndexFile = path.join(generatedDir, "reference-search-index.json");
const jsonOutFile = path.join(generatedDir, "discourse-suggest-index.json");
const postsDir = path.join(repoRoot, "src", "pages", "posts");

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

async function loadEssayEntries(): Promise<PageSuggestEntry[]> {
	const files = await glob("*.{md,mdx}", { cwd: postsDir, absolute: true });
	const out: PageSuggestEntry[] = [];
	for (const file of files) {
		const slug = parsePostSlugFromGlobPath(file);
		let draft = false;
		let title = slug;
		let hideHeader = false;
		try {
			const parsed = matter(await readFile(file, "utf8"));
			draft = parsed.data.draft === true;
			hideHeader = parsed.data.hideHeader === true;
			if (typeof parsed.data.title === "string" && parsed.data.title.trim()) {
				title = parsed.data.title.trim();
			}
		} catch {
			continue;
		}
		if (hideHeader) continue; // utility posts like iti-reddit-index are not essays
		if (
			!isRootPostCandidate(slug, {
				draft,
				includeDrafts: true,
				isDiscourse: false,
			})
		) {
			continue;
		}
		out.push({
			kind: "essay",
			title,
			href: `/${slug}`,
			aliases: [slug, slug.replace(/-/g, " ")],
		});
	}
	return out;
}

function loadCatalogEntries(): PageSuggestEntry[] {
	const items = buildAllContent(["topics", "qualities", "similes"]);
	const out: PageSuggestEntry[] = [];
	for (const item of items) {
		if (
			item.type !== "topic" &&
			item.type !== "quality" &&
			item.type !== "simile"
		) {
			continue;
		}
		const aliases = [
			item.slug,
			item.slug.replace(/-/g, " "),
			...(item.pali ?? []),
			...(item.synonyms ?? []),
			...(item.redirects ?? []),
		].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
		out.push({
			kind: item.type,
			title: item.title,
			href: `/on/${canonicalOnSlug(item.slug)}`,
			aliases,
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
	const pages = dedupePageEntries([
		...(await loadEssayEntries()),
		...loadCatalogEntries(),
		...SITE_PAGE_SUGGESTIONS,
	]);
	const payload = { version: 2 as const, entries, pages };

	await mkdir(generatedDir, { recursive: true });
	const json = JSON.stringify(payload);
	await writeFile(jsonOutFile, json, "utf8");

	const kb = Buffer.byteLength(json, "utf8") / 1024;
	const essays = pages.filter((page) => page.kind === "essay").length;
	const catalog = pages.filter((page) =>
		page.kind === "topic" || page.kind === "quality" || page.kind === "simile",
	).length;
	const site = pages.filter((page) => page.kind === "page").length;
	console.log(
		`discourse-suggest-index: wrote ${entries.length} discourses (native ${native.length}, reference ${reference.length}) and ${pages.length} pages (essay ${essays}, catalog ${catalog}, site ${site}) to generated/discourse-suggest-index.json (${kb.toFixed(1)} KB) in ${Date.now() - start}ms`,
	);
}

const isDirectRun = process.argv[1]?.includes("generateDiscourseSuggestIndex");
if (isDirectRun) {
	generateDiscourseSuggestIndex().catch((err) => {
		console.error("discourse-suggest-index generation failed:", err);
		process.exit(1);
	});
}
