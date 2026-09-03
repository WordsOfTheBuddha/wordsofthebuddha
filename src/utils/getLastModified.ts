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

export type GitTimestamps = {
	modified: Date;
	added: Date | null;
};

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

function addedIso(entry: TimestampCacheEntry | undefined): string | undefined {
	if (!entry || typeof entry === "string") return undefined;
	return entry.added || undefined;
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

/** First-added date from git (or filesystem for untracked files). Null if unknown. */
export function getAddedDate(filepath: string): Date | null {
	if (!filepath) return null;
	const { added } = getGitTimestamps(filepath);
	return added;
}

/**
 * Git-based timestamps for the recent-feed (ignores noisy local mtimes for
 * tracked files). Untracked files in dev use birthtime/mtime.
 */
export function getGitTimestamps(filepath: string): GitTimestamps {
	if (!filepath) return { modified: new Date(), added: null };

	const normalizedPath = normalizeFilePath(filepath);
	const cache = loadCache();
	const entry = cache[normalizedPath];
	const modifiedCached = modifiedIso(entry);
	const addedCached = addedIso(entry);

	if (modifiedCached || addedCached) {
		const modified = modifiedCached
			? new Date(modifiedCached)
			: addedCached
				? new Date(addedCached)
				: new Date(0);
		return {
			modified,
			added: addedCached ? new Date(addedCached) : null,
		};
	}

	// Cache miss with a populated cache ≈ untracked new file (dev).
	const cachePopulated = Object.keys(cache).length > 0;
	if (import.meta.env.DEV && cachePopulated) {
		const st = liveStat(normalizedPath);
		if (st) {
			const added =
				st.birthtime && st.birthtime.getTime() > 0 ? st.birthtime : st.mtime;
			return { modified: st.mtime, added };
		}
	}

	return { modified: new Date(0), added: null };
}
