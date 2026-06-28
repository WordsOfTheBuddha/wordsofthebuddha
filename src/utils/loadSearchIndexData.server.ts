import { readFile } from "node:fs/promises";
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
