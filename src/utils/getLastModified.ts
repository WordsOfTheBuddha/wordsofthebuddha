import fs from 'fs';
import path from 'path';

const CACHE_FILE = '.timestamp-cache.json';

interface CacheData {
    [filepath: string]: string; // ISO date strings
}

let globalCache: CacheData | null = null;

function normalizeFilePath(filepath: string): string {
    const projectRoot = process.cwd();
    const absolutePath = path.isAbsolute(filepath)
        ? filepath
        : path.join(projectRoot, filepath);
    return path.relative(projectRoot, absolutePath);
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

    const normalizedPath = normalizeFilePath(filepath);
    const cache = loadCache();
    const cachedDate = cache[normalizedPath];

    return cachedDate ? new Date(cachedDate) : new Date();
}
