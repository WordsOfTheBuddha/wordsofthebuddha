#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAllContent } from "./discover-data";
import { encodeCategorySearchIndex } from "./categorySearchIndex";
import { writeGzipCompanion } from "./gzipJsonFile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const generatedDir = path.join(repoRoot, "generated");
const indexOutFile = path.join(generatedDir, "category-search-index.json");
const descriptionsOutFile = path.join(
	generatedDir,
	"category-discourse-descriptions.json",
);

async function main() {
	const start = Date.now();
	const items = buildAllContent(["topics", "qualities", "similes", "persons"]);
	const { index, descriptions } = encodeCategorySearchIndex(items);

	await mkdir(generatedDir, { recursive: true });
	const indexJson = JSON.stringify(index);
	const descriptionsJson = JSON.stringify(descriptions);
	await Promise.all([
		writeFile(indexOutFile, indexJson, "utf8"),
		// /api/search reads the gzip companion inside the Vercel function.
		writeGzipCompanion(indexOutFile, indexJson),
		writeFile(descriptionsOutFile, descriptionsJson, "utf8"),
	]);

	const kb = (json: string) =>
		(Buffer.byteLength(json, "utf8") / 1024).toFixed(1);
	console.log(
		`category-search-index: wrote ${index.items.length} categories, ${index.discourses.length} unique discourse rows (${kb(indexJson)} KB) and descriptions (${kb(descriptionsJson)} KB) in ${Date.now() - start}ms`,
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
