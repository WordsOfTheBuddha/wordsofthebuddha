#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllContent } from "./discover-data";
import { encodeCategorySearchIndex } from "./categorySearchIndex";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const jsonOutFile = path.join(
	repoRoot,
	"generated",
	"category-search-index.json",
);

async function main() {
	const start = Date.now();
	const items = buildAllContent(["topics", "qualities", "similes", "persons"]);
	const payload = encodeCategorySearchIndex(items);

	await mkdir(path.dirname(jsonOutFile), { recursive: true });
	const json = JSON.stringify(payload);
	await writeFile(jsonOutFile, json, "utf8");

	const kb = Buffer.byteLength(json, "utf8") / 1024;
	console.log(
		`category-search-index: wrote ${payload.items.length} categories, ${payload.discourses.length} unique discourse rows to generated/category-search-index.json (${kb.toFixed(1)} KB) in ${Date.now() - start}ms`,
	);
}

const isDirectRun = process.argv[1]?.includes("generateCategorySearchIndex");
if (isDirectRun) {
	main().catch((err) => {
		console.error("category-search-index generation failed:", err);
		process.exit(1);
	});
}

export { main as generateCategorySearchIndex };
