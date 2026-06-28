/**
 * Validates reference metadata in Sujato frontmatter (primary) and catalog YAML (fallback).
 * Run: npx tsx src/utils/validateCatalog.ts [--collection=an4]
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import yaml from "js-yaml";
import matter from "gray-matter";
import { globSync } from "glob";
import { slugMatchesCollectionPattern } from "./collectionPatterns";

const ROOT = resolve(process.cwd());
const CATALOG_ROOT = join(ROOT, "src/content/catalog");
const SUJATO_ROOT = join(ROOT, "src/content/references/sujato");
const QUALITIES_PATH = join(ROOT, "src/data/qualities.json");
const THEMES_PATH = join(ROOT, "src/data/themes.json");

interface CatalogEntry {
	slug?: string;
	title?: string;
	description?: string;
	qualities?: string;
	theme?: string;
}

function loadValidQualities(): Set<string> {
	const data = JSON.parse(readFileSync(QUALITIES_PATH, "utf8")) as {
		positive: string[];
		negative: string[];
		neutral: string[];
	};
	return new Set([...data.positive, ...data.negative, ...data.neutral]);
}

function loadValidThemes(): Set<string> {
	const data = JSON.parse(readFileSync(THEMES_PATH, "utf8")) as Record<
		string,
		unknown
	>;
	return new Set(Object.keys(data));
}

function parseList(value: string | undefined): string[] {
	if (!value?.trim()) return [];
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function validateMetaFields(
	rel: string,
	entry: CatalogEntry,
	validQualities: Set<string>,
	validThemes: Set<string>,
	errors: string[],
) {
	if (!entry.title?.trim()) {
		errors.push(`${rel}: missing title`);
	}
	if (!entry.description?.trim()) {
		errors.push(`${rel}: missing description`);
	} else if (entry.description.length < 40) {
		errors.push(`${rel}: description too short (< 40 chars)`);
	}

	for (const q of parseList(entry.qualities)) {
		if (!validQualities.has(q)) {
			errors.push(`${rel}: unknown quality "${q}"`);
		}
	}

	for (const t of parseList(entry.theme)) {
		if (!validThemes.has(t)) {
			errors.push(`${rel}: unknown theme "${t}"`);
		}
	}

	if (!entry.theme?.trim()) {
		errors.push(`${rel}: missing theme`);
	}
	if (!entry.qualities?.trim()) {
		errors.push(`${rel}: missing qualities`);
	}
}

function readSujatoEntry(slug: string): CatalogEntry | null {
	const collection = slug.match(/^[a-z]+/)?.[0] ?? "";
	const sujatoPath = join(SUJATO_ROOT, collection, `${slug}.md`);
	if (!existsSync(sujatoPath)) return null;
	const { data } = matter(readFileSync(sujatoPath, "utf8"));
	return {
		slug,
		title: data.title as string | undefined,
		description: data.description as string | undefined,
		qualities: data.qualities as string | undefined,
		theme: data.theme as string | undefined,
	};
}

export function validateCatalogFiles(
	filterCollection?: string,
): { errors: string[]; fileCount: number } {
	const validQualities = loadValidQualities();
	const validThemes = loadValidThemes();
	const errors: string[] = [];
	const validatedSlugs = new Set<string>();

	let catalogFiles: string[] = [];
	if (existsSync(CATALOG_ROOT)) {
		catalogFiles = globSync(join(CATALOG_ROOT, "**", "*.yaml"), {
			nodir: true,
		});
		if (filterCollection) {
			catalogFiles = catalogFiles.filter((f) => {
				const slug = f.split("/").pop()!.replace(/\.ya?ml$/, "");
				return slugMatchesCollectionPattern(slug, filterCollection);
			});
		}
	}

	for (const filePath of catalogFiles.sort()) {
		const rel = filePath.replace(ROOT + "/", "");
		let catalog: CatalogEntry;
		try {
			catalog = yaml.load(readFileSync(filePath, "utf8")) as CatalogEntry;
		} catch (e) {
			errors.push(`${rel}: invalid YAML (${e})`);
			continue;
		}

		const slugFromName = filePath
			.split("/")
			.pop()!
			.replace(/\.ya?ml$/, "");
		const slug = catalog.slug ?? slugFromName;
		validatedSlugs.add(slug);

		if (catalog.slug && catalog.slug !== slugFromName) {
			errors.push(`${rel}: slug "${catalog.slug}" does not match filename`);
		}

		const sujato = readSujatoEntry(slug);
		if (!sujato) {
			errors.push(`${rel}: no Sujato reference for ${slug}`);
			continue;
		}

		const merged: CatalogEntry = {
			title: sujato.title || catalog.title,
			description: sujato.description || catalog.description,
			qualities: sujato.qualities || catalog.qualities,
			theme: sujato.theme || catalog.theme,
		};
		validateMetaFields(rel, merged, validQualities, validThemes, errors);
	}

	// Also validate Sujato files with curated metadata not backed by catalog YAML
	let sujatoFiles = globSync(join(SUJATO_ROOT, "**", "*.md"), { nodir: true });
	if (filterCollection) {
		sujatoFiles = sujatoFiles.filter((f) => {
			const slug = f.split("/").pop()!.replace(/\.md$/, "");
			return slugMatchesCollectionPattern(slug, filterCollection);
		});
	}

	for (const filePath of sujatoFiles.sort()) {
		const slug = filePath.split("/").pop()!.replace(/\.md$/, "");
		if (validatedSlugs.has(slug)) continue;

		const sujato = readSujatoEntry(slug);
		if (!sujato?.description?.trim()) continue;

		const rel = filePath.replace(ROOT + "/", "");
		validateMetaFields(rel, sujato, validQualities, validThemes, errors);
		validatedSlugs.add(slug);
	}

	return { errors, fileCount: validatedSlugs.size };
}

function main() {
	const collectionArg = process.argv.find((a) => a.startsWith("--collection="));
	const collection = collectionArg?.split("=")[1];
	const { errors, fileCount } = validateCatalogFiles(collection);

	if (fileCount === 0) {
		console.warn("No catalog/reference metadata files found.");
	}

	if (errors.length) {
		console.error(`Catalog validation failed (${errors.length} issues):`);
		for (const e of errors) console.error(`  • ${e}`);
		process.exit(1);
	}

	console.log(`✅ Validated ${fileCount} reference metadata file(s).`);
}

const isDirectRun = process.argv[1]?.includes("validateCatalog");
if (isDirectRun) main();
