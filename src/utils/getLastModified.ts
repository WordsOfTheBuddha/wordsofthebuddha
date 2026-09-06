import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), ".timestamp-cache.json");

export type TimestampCacheEntry =
	| string
	| {
			modified?: string | null;
			added?: string | null;
	  };

interface CacheData {
	[filepath: string]: TimestampCacheEntry;
}

let globalCache: CacheData | null = null;

function normalizeFilePath(filepath: string): string {
	return filepath.startsWith("src/")
		? filepath.replace(/\\/g, "/")
		: path.join("src", filepath).replace(/\\/g, "/");
}

function loadCache(): CacheData {
	if (globalCache) return globalCache;

	try {
		if (!fs.existsSync(CACHE_FILE)) {
			return {};
		}
		globalCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
		return globalCache || {};
	} catch (error) {
		console.warn("[getLastModified] Cache load error:", error);
		return {};
	}
}

function modifiedIso(entry: TimestampCacheEntry | undefined): string | undefined {
	if (!entry) return undefined;
	if (typeof entry === "string") return entry;
	return entry.modified || undefined;
}

function liveStat(normalizedPath: string): fs.Stats | null {
	try {
		const absPath = path.join(process.cwd(), normalizedPath);
		if (fs.existsSync(absPath)) return fs.statSync(absPath);
	} catch {
		// ignore
	}
	return null;
}

export function getLastModified(filepath: string): Date {
	if (!filepath) return new Date();

	const normalizedPath = normalizeFilePath(filepath);

	// In dev, prefer live filesystem mtime so "last updated" tracks edits.
	if (import.meta.env.DEV) {
		const st = liveStat(normalizedPath);
		if (st) return st.mtime;
	}

	const cache = loadCache();
	const cachedDate = modifiedIso(cache[normalizedPath]);

	if (!cachedDate && import.meta.env.DEV) {
		console.warn(`[getLastModified] No cache for: ${normalizedPath}`);
	}

	return cachedDate ? new Date(cachedDate) : new Date();
}
