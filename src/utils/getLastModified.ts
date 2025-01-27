import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = '.timestamp-cache.json';

interface CacheData {
    [filepath: string]: string; // ISO date strings
}

// Normalize filepath to be relative to project root
function normalizeFilePath(filepath: string): string {
    const projectRoot = process.cwd();
    const absolutePath = path.isAbsolute(filepath)
        ? filepath
        : path.join(projectRoot, filepath);
    return path.relative(projectRoot, absolutePath);
}

let globalCache: CacheData = {};
let isInitialized = false;

function initializeCache(): void {
    if (isInitialized) return;

    try {
        // First load existing cache
        try {
            globalCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        } catch {
            globalCache = {};
        }

        // Get all file modifications in a single git command
        const gitLog = execSync(
            'git ls-files --stage | cut -f3- | xargs git log -1 --format="%H %ct %aI %s" --',
            { encoding: 'utf-8' }
        );

        // Parse and update cache
        gitLog.trim().split('\n').forEach(line => {
            if (!line) return;
            const [hash, timestamp, isoDate] = line.split(' ');
            const filepath = execSync(
                `git diff-tree --no-commit-id --name-only -r ${hash}`,
                { encoding: 'utf-8' }
            ).trim();
            if (filepath) {
                globalCache[filepath] = isoDate;
            }
        });

        // Save updated cache
        fs.writeFileSync(CACHE_FILE, JSON.stringify(globalCache, null, 2));
        isInitialized = true;
    } catch (error) {
        console.error('Error initializing git cache:', error);
        isInitialized = true; // Prevent retrying
    }
}

export function getLastModified(filepath: string): Date {
    if (!isInitialized) {
        initializeCache();
    }

    const normalizedPath = normalizeFilePath(filepath);
    const cachedDate = globalCache[normalizedPath];

    if (cachedDate) {
        return new Date(cachedDate);
    }

    return new Date(); // Fallback to current date if not found
}
