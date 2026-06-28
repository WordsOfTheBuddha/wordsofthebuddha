#!/usr/bin/env node
/**
 * One-time migration: copy catalog YAML metadata into Sujato reference frontmatter.
 *
 * Usage:
 *   node scripts/migrate-catalog-to-sujato-frontmatter.mjs --collection an4
 *   node scripts/migrate-catalog-to-sujato-frontmatter.mjs --collection an4 --dry-run
 */
import {
	existsSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import yaml from "js-yaml";
import { globSync } from "glob";
import { buildSujatoMarkdown } from "./lib/sujato-frontmatter.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const CATALOG_ROOT = join(ROOT, "src/content/catalog");
const SUJATO_ROOT = join(ROOT, "src/content/references/sujato");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const collectionArg = args.find((a) => a.startsWith("--collection="));
const collection = collectionArg?.split("=")[1];
if (!collection) {
	console.error("Usage: node scripts/migrate-catalog-to-sujato-frontmatter.mjs --collection=an4");
	process.exit(1);
}

const slugPrefix = collection.includes(".") ? collection : `${collection}.`;

function listCatalogFiles() {
	return globSync(join(CATALOG_ROOT, "**", "*.yaml"), { nodir: true }).filter(
		(f) => {
			const slug = f.split("/").pop().replace(/\.ya?ml$/, "");
			return slug === collection || slug.startsWith(slugPrefix);
		},
	);
}

const META_KEYS = ["title", "description", "qualities", "theme", "simile", "topic", "priority"];

let migrated = 0;
let skipped = 0;

for (const catalogPath of listCatalogFiles().sort()) {
	const slugFromName = catalogPath.split("/").pop().replace(/\.ya?ml$/, "");
	const catalog = yaml.load(readFileSync(catalogPath, "utf8"));
	const slug = catalog.slug ?? slugFromName;
	const coll = slug.match(/^[a-z]+/)?.[0] ?? "";
	const sujatoPath = join(SUJATO_ROOT, coll, `${slug}.md`);

	if (!existsSync(sujatoPath)) {
		console.warn(`skip ${slug}: no Sujato file at ${sujatoPath}`);
		skipped++;
		continue;
	}

	const raw = readFileSync(sujatoPath, "utf8");
	const { data, content } = matter(raw);
	const next = { ...data };

	for (const key of META_KEYS) {
		if (catalog[key] !== undefined && catalog[key] !== null && catalog[key] !== "") {
			next[key] = catalog[key];
		}
	}

	const updated = buildSujatoMarkdown({ ...next, body: content });
	if (updated === raw) {
		skipped++;
		continue;
	}

	if (dryRun) {
		console.log(`[dry-run] would update ${sujatoPath}`);
	} else {
		writeFileSync(sujatoPath, updated, "utf8");
	}
	migrated++;
}

console.log(
	`${dryRun ? "[dry-run] " : ""}Migrated ${migrated} file(s), skipped ${skipped}.`,
);
