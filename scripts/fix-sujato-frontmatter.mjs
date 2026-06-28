#!/usr/bin/env node
/**
 * Normalize Sujato reference frontmatter to single-line description and
 * unquoted comma-separated qualities/theme lists.
 *
 * Usage:
 *   node scripts/fix-sujato-frontmatter.mjs --collection=an4
 *   node scripts/fix-sujato-frontmatter.mjs --collection=an4 --dry-run
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { globSync } from "glob";
import {
	buildSujatoMarkdown,
} from "./lib/sujato-frontmatter.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SUJATO_ROOT = join(ROOT, "src/content/references/sujato");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const collectionArg = args.find((a) => a.startsWith("--collection="));
const collection = collectionArg?.split("=")[1];
if (!collection) {
	console.error("Usage: node scripts/fix-sujato-frontmatter.mjs --collection=an4");
	process.exit(1);
}

const slugPrefix = collection.includes(".") ? collection : `${collection}.`;
const files = globSync(join(SUJATO_ROOT, "**", "*.md"), { nodir: true }).filter(
	(f) => {
		const slug = f.split("/").pop().replace(/\.md$/, "");
		return slug === collection || slug.startsWith(slugPrefix);
	},
);

let updated = 0;
let skipped = 0;

for (const filePath of files.sort()) {
	const raw = readFileSync(filePath, "utf8");
	const { data, content } = matter(raw);
	const next = buildSujatoMarkdown({ ...data, body: content });
	if (next === raw) {
		skipped++;
		continue;
	}
	if (dryRun) {
		console.log(`[dry-run] would update ${filePath}`);
	} else {
		writeFileSync(filePath, next, "utf8");
	}
	updated++;
}

console.log(
	`${dryRun ? "[dry-run] " : ""}Updated ${updated} file(s), skipped ${skipped}.`,
);
