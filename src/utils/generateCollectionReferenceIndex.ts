/**
 * Build collection reference index from Sujato reference frontmatter (+ catalog fallback).
 * Outputs src/data/collectionReferenceIndex.ts for search/collection pages.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { globSync } from "glob";
import yaml from "js-yaml";
import matter from "gray-matter";
import { validateCatalogFiles } from "./validateCatalog";
import { slugMatchesCollectionPattern } from "./collectionPatterns";
import { referenceOnlyRoutes } from "./referenceOnlyRoutes";

const ROOT = resolve(process.cwd());
const CATALOG_ROOT = join(ROOT, "src/content/catalog");
const SUJATO_ROOT = join(ROOT, "src/content/references/sujato");
const OUT_FILE = join(ROOT, "src/data/collectionReferenceIndex.ts");
const OUT_TITLES_FILE = join(
	ROOT,
	"src/data/discourseReferenceTitles.generated.ts",
);

export interface CollectionReferenceEntry {
	slug: string;
	title: string;
	description: string;
	content: string;
	referenceOnly: true;
	priority?: number;
	qualities?: string;
	theme?: string;
}

interface SujatoMeta {
	title: string;
	description?: string;
	body: string;
	qualities?: string;
	theme?: string;
	priority?: number;
}

function readSujatoMeta(slug: string): SujatoMeta | null {
	const collection = slug.match(/^[a-z]+/)?.[0];
	if (!collection) return null;
	const filePath = join(SUJATO_ROOT, collection, `${slug}.md`);
	if (!existsSync(filePath)) return null;
	const raw = readFileSync(filePath, "utf8");
	const { data, content } = matter(raw);
	return {
		title: (data.title as string) || slug,
		description: (data.description as string) || undefined,
		body: content.trim(),
		qualities: (data.qualities as string) || undefined,
		theme: (data.theme as string) || undefined,
		priority:
			typeof data.priority === "number"
				? data.priority
				: typeof data.priority === "string"
					? Number.parseFloat(data.priority) || undefined
					: undefined,
	};
}

function readCatalogMeta(slug: string): {
	title?: string;
	description?: string;
	qualities?: string;
	theme?: string;
	priority?: number;
} | null {
	const collection = slug.match(/^[a-z]+/)?.[0];
	if (!collection) return null;
	const filePath = join(CATALOG_ROOT, collection, `${slug}.yaml`);
	if (!existsSync(filePath)) return null;
	const catalog = yaml.load(readFileSync(filePath, "utf8")) as {
		title?: string;
		description?: string;
		qualities?: string;
		theme?: string;
		priority?: number;
	};
	return catalog;
}

function buildEntry(
	slug: string,
	sujato: SujatoMeta | null,
	catalog: ReturnType<typeof readCatalogMeta>,
): CollectionReferenceEntry | null {
	if (!sujato && !catalog?.description) return null;

	const title =
		catalog?.title?.trim() || sujato?.title || slug;
	const description =
		sujato?.description?.trim() || catalog?.description?.trim() || "";
	if (!description) return null;

	return {
		slug,
		title,
		description,
		content: sujato?.body ?? "",
		referenceOnly: true,
		...(sujato?.qualities || catalog?.qualities
			? { qualities: sujato?.qualities || catalog?.qualities }
			: {}),
		...(sujato?.theme || catalog?.theme
			? { theme: sujato?.theme || catalog?.theme }
			: {}),
		...(typeof (sujato?.priority ?? catalog?.priority) === "number"
			? { priority: sujato?.priority ?? catalog?.priority }
			: {}),
	};
}

function listSlugsForCollection(filterCollection?: string): string[] {
	const slugs = new Set<string>();

	for (const slug of referenceOnlyRoutes) {
		if (
			!filterCollection ||
			slugMatchesCollectionPattern(slug, filterCollection)
		) {
			slugs.add(slug);
		}
	}

	if (existsSync(CATALOG_ROOT)) {
		let catalogFiles = globSync(join(CATALOG_ROOT, "**", "*.yaml"), {
			nodir: true,
		});
		if (filterCollection) {
			catalogFiles = catalogFiles.filter((f) => {
				const slug = f.split("/").pop()!.replace(/\.ya?ml$/, "");
				return slugMatchesCollectionPattern(slug, filterCollection);
			});
		}
		for (const filePath of catalogFiles) {
			const slugFromName = filePath
				.split("/")
				.pop()!
				.replace(/\.ya?ml$/, "");
			const catalog = yaml.load(readFileSync(filePath, "utf8")) as {
				slug?: string;
			};
			slugs.add(catalog.slug ?? slugFromName);
		}
	}

	return [...slugs].sort();
}

export function loadCatalogEntries(
	filterCollection?: string,
): CollectionReferenceEntry[] {
	const slugs = listSlugsForCollection(filterCollection);
	const entries: CollectionReferenceEntry[] = [];

	for (const slug of slugs) {
		const sujato = readSujatoMeta(slug);
		const catalog = readCatalogMeta(slug);
		const entry = buildEntry(slug, sujato, catalog);
		if (entry) entries.push(entry);
	}

	return entries;
}

/** Metadata-only rows for SSR (search content lives in reference-search-index.json). */
function toMetadataOnly(
	entries: CollectionReferenceEntry[],
): Omit<CollectionReferenceEntry, "content">[] {
	return entries.map(
		({ slug, title, description, referenceOnly, priority, qualities, theme }) => ({
			slug,
			title,
			description,
			referenceOnly,
			...(priority !== undefined ? { priority } : {}),
			...(qualities ? { qualities } : {}),
			...(theme ? { theme } : {}),
		}),
	);
}

export function writeCollectionReferenceIndex(
	entries: CollectionReferenceEntry[],
) {
	mkdirSync(join(ROOT, "src/data"), { recursive: true });
	const metadata = toMetadataOnly(entries);
	const json = JSON.stringify(metadata);
	const ts = `// Auto-generated by generateCollectionReferenceIndex.ts. Do not edit.
export type CollectionReferenceEntry = {
	slug: string;
	title: string;
	description: string;
	referenceOnly: true;
	priority?: number;
	qualities?: string;
	theme?: string;
};
const collectionReferenceIndex: CollectionReferenceEntry[] = ${json} as const;
export default collectionReferenceIndex;
`;
	writeFileSync(OUT_FILE, ts, "utf8");

	const titleMap = Object.fromEntries(
		entries.map((e) => [e.slug, e.title]),
	);
	const titlesTs = `// Auto-generated by generateCollectionReferenceIndex.ts. Do not edit.
export const discourseReferenceTitles: Readonly<Record<string, string>> = ${JSON.stringify(titleMap)};
`;
	writeFileSync(OUT_TITLES_FILE, titlesTs, "utf8");
}

export function generateCollectionReferenceIndex(options?: {
	skipValidation?: boolean;
	collection?: string;
}) {
	if (!options?.skipValidation) {
		const { errors, fileCount } = validateCatalogFiles(options?.collection);
		if (fileCount > 0 && errors.length) {
			throw new Error(
				`Catalog validation failed:\n${errors.map((e) => `  • ${e}`).join("\n")}`,
			);
		}
	}

	const entries = loadCatalogEntries(options?.collection);
	writeCollectionReferenceIndex(entries);
	return entries.length;
}

function main() {
	const collectionArg = process.argv.find((a) => a.startsWith("--collection="));
	const collection = collectionArg?.split("=")[1];
	const skipValidation = process.argv.includes("--skip-validation");
	const count = generateCollectionReferenceIndex({
		skipValidation,
		collection,
	});
	console.log(`reference-index: wrote ${count} entries`);
}

const isDirectRun = process.argv[1]?.includes(
	"generateCollectionReferenceIndex",
);
if (isDirectRun) main();
