/**
 * Read path for the encyclopedia: generated index plus the git YAML overlay.
 * The generator merges before it writes; this applies the overlay again so a
 * YAML edit is visible before the next regen.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { decodeMaybeGzip } from "./gzipJsonFile";
import { getIndexFilePath } from "./loadSearchIndexData.server";
import {
	encyclopediaPath,
	mergeEncyclopediaItems,
	mergeOverlayIntoIndex,
	overlayItemsFromDocument,
	queryEncyclopedia,
	resolveEncyclopediaNorm,
	summarizeEncyclopedia,
	type EncyclopediaQuery,
	type EncyclopediaQueryResult,
} from "./encyclopedia";
import type {
	EncyclopediaEntry,
	EncyclopediaIndexFile,
	EncyclopediaItem,
	EncyclopediaMeta,
} from "../types/encyclopedia";

const INDEX_FILE = "encyclopedia-index.json";

export function encyclopediaOverlayDir(root = process.cwd()): string {
	return path.join(root, "src", "data", "encyclopedia");
}

export function loadEncyclopediaOverlay(
	root = process.cwd(),
): Map<string, EncyclopediaItem[]> {
	const overlay = new Map<string, EncyclopediaItem[]>();
	const dir = encyclopediaOverlayDir(root);
	let files: string[] = [];
	try {
		files = readdirSync(dir)
			.filter((name) => name.endsWith(".yaml") || name.endsWith(".yml"))
			.sort();
	} catch {
		return overlay;
	}

	for (const name of files) {
		const filePath = path.join(dir, name);
		const fallbackNorm = name.replace(/\.ya?ml$/, "");
		try {
			const doc = yaml.load(readFileSync(filePath, "utf8"));
			const parsed = overlayItemsFromDocument(doc, fallbackNorm);
			if (!parsed) continue;
			const previous = overlay.get(parsed.norm);
			overlay.set(
				parsed.norm,
				previous
					? mergeEncyclopediaItems(parsed.items, previous)
					: parsed.items,
			);
		} catch (err) {
			console.warn(`encyclopedia: skipped overlay ${name}`, err);
		}
	}
	return overlay;
}

function readRawIndex(): EncyclopediaIndexFile | null {
	const filePath = getIndexFilePath(INDEX_FILE);
	if (!filePath) return null;
	try {
		const json = JSON.parse(
			decodeMaybeGzip(filePath, readFileSync(filePath)),
		) as EncyclopediaIndexFile;
		if (!json || typeof json !== "object" || !json.entries) return null;
		return { version: 1, entries: json.entries };
	} catch (err) {
		console.error("encyclopedia: failed to read index", err);
		return null;
	}
}

function mtime(filePath: string): number {
	try {
		return statSync(filePath).mtimeMs;
	} catch {
		return 0;
	}
}

function cacheStamp(root = process.cwd()): string {
	const indexPath = getIndexFilePath(INDEX_FILE);
	const parts = [`index:${indexPath ? mtime(indexPath) : 0}`];
	const dir = encyclopediaOverlayDir(root);
	try {
		for (const name of readdirSync(dir).sort()) {
			if (!name.endsWith(".yaml") && !name.endsWith(".yml")) continue;
			const filePath = path.join(dir, name);
			parts.push(`${name}:${mtime(filePath)}`);
		}
	} catch {
		parts.push("overlay:missing");
	}
	return parts.join("|");
}

let cache: { stamp: string; index: EncyclopediaIndexFile } | null = null;

export function loadEncyclopediaIndex(
	root = process.cwd(),
): EncyclopediaIndexFile {
	const stamp = cacheStamp(root);
	if (cache?.stamp === stamp) return cache.index;
	const raw = readRawIndex() ?? { version: 1, entries: {} };
	const index = mergeOverlayIntoIndex(raw, loadEncyclopediaOverlay(root));
	cache = { stamp, index };
	return index;
}

export function loadEncyclopediaMeta(root = process.cwd()): EncyclopediaMeta {
	return summarizeEncyclopedia(loadEncyclopediaIndex(root));
}

export function queryEncyclopediaIndex(
	query: EncyclopediaQuery,
	root = process.cwd(),
): EncyclopediaQueryResult {
	return queryEncyclopedia(loadEncyclopediaIndex(root), query);
}

export function encyclopediaQueryFromUrl(url: URL): EncyclopediaQuery {
	const limitRaw = url.searchParams.get("limit");
	const limit =
		limitRaw == null || limitRaw === "" ? undefined : Number(limitRaw);
	const pageRaw = url.searchParams.get("page");
	const page =
		pageRaw == null || pageRaw === "" ? undefined : Number(pageRaw);
	return {
		q: url.searchParams.get("q") ?? "",
		kind: url.searchParams.get("kind"),
		status: url.searchParams.get("status"),
		limit: Number.isFinite(limit) ? limit : undefined,
		page: Number.isFinite(page) ? page : undefined,
	};
}

export function getEncyclopediaEntry(
	rawNorm: string,
	root = process.cwd(),
): { entry: EncyclopediaEntry; canonical: string } | null {
	const index = loadEncyclopediaIndex(root);
	const canonical = resolveEncyclopediaNorm(rawNorm, index.entries);
	if (!canonical) return null;
	const entry = index.entries[canonical];
	if (!entry) return null;
	return { entry, canonical };
}

/** Index plus seeded and reviewed term URLs. Raw clusters stay out of the sitemap. */
export function encyclopediaSitemapPaths(root = process.cwd()): string[] {
	const paths = ["/encyclopedia"];
	try {
		const index = loadEncyclopediaIndex(root);
		const norms = Object.values(index.entries)
			.filter((entry) => entry.status === "seeded" || entry.status === "reviewed")
			.map((entry) => entry.norm)
			.sort();
		for (const norm of norms) paths.push(encyclopediaPath(norm));
	} catch (err) {
		console.warn("encyclopedia: sitemap skipped term URLs", err);
	}
	return paths;
}
