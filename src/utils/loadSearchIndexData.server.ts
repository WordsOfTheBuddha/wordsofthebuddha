import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { SearchIndexDoc } from "./loadSearchIndexData";

function publicJsonCandidates(filename: string): string[] {
	const cwd = process.cwd();
	return [
		path.join(cwd, "generated", filename),
		path.join(cwd, "public", filename),
		path.join(cwd, ".vercel", "output", "static", filename),
	];
}

/** Resolved path for the first existing index file (dev cache invalidation). */
export function getIndexFilePath(filename: string): string | null {
	for (const filePath of publicJsonCandidates(filename)) {
		if (existsSync(filePath)) return filePath;
	}
	return null;
}

/** mtimeMs of the on-disk index, or 0 if missing (dev cache invalidation). */
export async function getIndexMtimeFromDisk(
	filename: string,
): Promise<number> {
	const filePath = getIndexFilePath(filename);
	if (!filePath) return 0;
	const fileStat = await stat(filePath);
	return fileStat.mtimeMs;
}

/** Read search index JSON from disk (SSR / build only — not for client bundles). */
export async function readIndexFromDisk(
	filename: string,
): Promise<SearchIndexDoc[] | null> {
	for (const filePath of publicJsonCandidates(filename)) {
		if (!existsSync(filePath)) continue;
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as SearchIndexDoc[];
	}
	return null;
}
