import fs from 'fs';
import path from 'path';

const CACHE_FILE = '.timestamp-cache.json';

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
        globalCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        return globalCache || {};
    } catch (error) {
        console.warn('Could not load timestamp cache:', error);
        return {};
    }
}

export function getLastModified(filepath: string): Date {
    if (!filepath) return new Date();

    const debugInfo = {
        requestedPath: filepath,
        normalizedPath: normalizeFilePath(filepath),
        availableCacheKeys: Object.keys(loadCache()).length
    };

    console.log('[getLastModified] Debug info:', JSON.stringify(debugInfo));

    const cache = loadCache();
    const cachedDate = cache[debugInfo.normalizedPath];

    if (!cachedDate) {
        console.warn(`[getLastModified] No cache entry found for ${debugInfo.normalizedPath}`);
    }

    return cachedDate ? new Date(cachedDate) : new Date();
}
