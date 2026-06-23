import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.timestamp-cache.json');

interface CacheData {
    [filepath: string]: string; // ISO date strings
}

let globalCache: CacheData | null = null;

function normalizeFilePath(filepath: string): string {
    // Simplify path normalization to match cache format
    return filepath.startsWith('src/')
        ? filepath
        : path.join('src', filepath).replace(/\\/g, '/');
}

function loadCache(): CacheData {
    if (globalCache) return globalCache;

    try {
        if (!fs.existsSync(CACHE_FILE)) {
            return {};
        }
        globalCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        return globalCache || {};
    } catch (error) {
        console.warn('[getLastModified] Cache load error:', error);
        return {};
    }
}

export function getLastModified(filepath: string): Date {
    if (!filepath) return new Date();

    const normalizedPath = normalizeFilePath(filepath);

    // In dev, prefer live filesystem mtime so "last updated" tracks edits.
    if (import.meta.env.DEV) {
        try {
            const absPath = path.join(process.cwd(), normalizedPath);
            if (fs.existsSync(absPath)) {
                return fs.statSync(absPath).mtime;
            }
        } catch {
            // Fall through to git-based cache.
        }
    }

    const cache = loadCache();
    const cachedDate = cache[normalizedPath];

    if (!cachedDate && import.meta.env.DEV) {
        console.warn(`[getLastModified] No cache for: ${normalizedPath}`);
    }

    return cachedDate ? new Date(cachedDate) : new Date();
}
