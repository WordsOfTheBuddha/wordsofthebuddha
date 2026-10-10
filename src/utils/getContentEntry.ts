import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getCollection, getEntry } from "astro:content";
import { isAnthologySlug } from "./anthologySlugs";

export type ContentEntryData = {
	title?: string;
	slug?: string;
	description?: string;
	qualities?: string;
	theme?: string;
	simile?: string;
	commentary?: string | string[];
	priority?: number;
	image?: string;
	imageCaption?: string;
	[key: string]: unknown;
};

export type ContentEntryLike = {
	id: string;
	slug?: string;
	body: string;
	data: ContentEntryData;
	filePath?: string;
};

const EN_ROOT = path.join(process.cwd(), "src/content/en");
const PLI_ROOT = path.join(process.cwd(), "src/content/pli");
const SUJATO_ROOT = path.join(
	process.cwd(),
	"src/content/references/sujato",
);
const PLI_MS_ROOT = path.join(
	process.cwd(),
	"src/content/references/pli-ms",
);
const GU_ROOT = path.join(process.cwd(), "src/content/gu");

function resolveEnglishPath(slug: string, hintPath?: string): string | null {
	const cwd = process.cwd();
	if (hintPath) {
		const abs = path.join(cwd, hintPath);
		if (fs.existsSync(abs)) return abs;
	}

	const prefix = slug.match(/^([a-z]+)/i)?.[1]?.toLowerCase();
	if (prefix) {
		const direct = path.join(EN_ROOT, prefix, `${slug}.mdx`);
		if (fs.existsSync(direct)) return direct;
	}

	// Root-level files (e.g. index.mdx) live directly under EN_ROOT.
	const rootFile = path.join(EN_ROOT, `${slug}.mdx`);
	if (fs.existsSync(rootFile)) return rootFile;

	try {
		for (const entry of fs.readdirSync(EN_ROOT, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const candidate = path.join(EN_ROOT, entry.name, `${slug}.mdx`);
			if (fs.existsSync(candidate)) return candidate;
		}
	} catch {
		// EN_ROOT missing in tests or unusual cwd
	}

	return null;
}

function resolveReferencePath(
	root: string,
	slug: string,
	hintPath?: string,
): string | null {
	const cwd = process.cwd();
	if (hintPath) {
		const abs = path.join(cwd, hintPath);
		if (fs.existsSync(abs)) return abs;
	}

	const prefix = slug.match(/^([a-z]+)/i)?.[1]?.toLowerCase();
	if (prefix) {
		const direct = path.join(root, prefix, `${slug}.md`);
		if (fs.existsSync(direct)) return direct;
	}

	return null;
}

function resolvePaliPath(slug: string, hintPath?: string): string | null {
	const cwd = process.cwd();
	if (hintPath) {
		const abs = path.join(cwd, hintPath);
		if (fs.existsSync(abs)) return abs;
	}

	const prefix = slug.match(/^([a-z]+)/i)?.[1]?.toLowerCase();
	if (prefix) {
		const direct = path.join(PLI_ROOT, prefix, `${slug}.md`);
		if (fs.existsSync(direct)) return direct;
	}

	const enPath = resolveEnglishPath(slug);
	if (enPath) {
		const rel = path.relative(EN_ROOT, enPath);
		const paliPath = path.join(
			PLI_ROOT,
			path.dirname(rel),
			`${path.basename(rel, path.extname(rel))}.md`,
		);
		if (fs.existsSync(paliPath)) return paliPath;
	}

	return null;
}

function readMarkdownEntry(
	absPath: string,
	id: string,
): ContentEntryLike {
	const raw = fs.readFileSync(absPath, "utf-8");
	const { data, content } = matter(raw);
	const filePath = path.relative(process.cwd(), absPath).replace(/\\/g, "/");
	const slug =
		typeof data.slug === "string"
			? data.slug
			: path.basename(absPath, path.extname(absPath));

	return {
		id,
		slug,
		body: content.trimStart(),
		data: data as ContentEntryData,
		filePath,
	};
}

type StoredCollectionName =
	| "all"
	| "pliAll"
	| "referenceSujato"
	| "referencePliMs"
	| "gu";

type StoredEntry = NonNullable<Awaited<ReturnType<typeof getEntry>>>;

/**
 * `getEntry` misses (e.g. reference-only discourses have no English entry) used
 * to fall back to `getCollection(...).find(...)` on every request, loading and
 * scanning the whole collection each time. Build the fallback index once per
 * warm function instance instead, so a miss is an O(1) map lookup.
 */
const fallbackIndexes = new Map<
	StoredCollectionName,
	Promise<Map<string, StoredEntry>>
>();

function getFallbackIndex(
	collection: StoredCollectionName,
): Promise<Map<string, StoredEntry>> {
	// Dev: content changes live, so never reuse a stale index.
	let index = import.meta.env.DEV ? undefined : fallbackIndexes.get(collection);
	if (!index) {
		index = (async () => {
			const map = new Map<string, StoredEntry>();
			const entries = (await getCollection(
				collection as "all",
			)) as unknown as StoredEntry[];
			for (const item of entries) {
				const data = item.data as { slug?: string };
				if (!map.has(item.id)) map.set(item.id, item);
				if (data.slug && !map.has(data.slug)) map.set(data.slug, item);
				const tail = item.id.slice(item.id.lastIndexOf("/") + 1);
				if (!map.has(tail)) map.set(tail, item);
			}
			return map;
		})().catch((err) => {
			fallbackIndexes.delete(collection);
			throw err;
		});
		if (!import.meta.env.DEV) fallbackIndexes.set(collection, index);
	}
	return index;
}

async function findStoredEntry(
	collection: StoredCollectionName,
	slug: string,
) {
	try {
		const entry = await getEntry(collection as "all", slug);
		if (entry) return entry;
		return (await getFallbackIndex(collection)).get(slug) ?? null;
	} catch {
		return null;
	}
}

async function findStoredEnglishEntry(slug: string) {
	return findStoredEntry("all", slug);
}

async function findStoredPaliEntry(slug: string) {
	// Skip content-store lookups that only produce "Entry … was not found" noise.
	if (isAnthologySlug(slug) || slug === "index") return null;
	return findStoredEntry("pliAll", slug);
}

async function findStoredReferenceEntry(
	collection: "referenceSujato" | "referencePliMs" | "gu",
	slug: string,
) {
	return findStoredEntry(collection, slug);
}

function storedToLike(entry: {
	id: string;
	slug?: string;
	body: string;
	data: Record<string, unknown>;
	filePath?: string;
}): ContentEntryLike {
	return {
		id: entry.id,
		slug: entry.slug,
		body: entry.body,
		data: entry.data,
		filePath: entry.filePath,
	};
}

// TEMP-PROD-PROBE — remove after measurement (Vercel function-size work).
// Counts production disk-fallback reads to decide whether the src/content fs
// fallback (~46 MB traced into _render.func) can be DEV-gated. Intentionally
// log-only: adds no new static src/content path strings, so bundle tracing
// is unchanged by this probe.
function probeContentFallback(
	kind: "en" | "pli" | "sujato" | "plims" | "gu",
	slug: string,
	stored: unknown,
	diskPath: string | null,
): void {
	if (import.meta.env.DEV) return;
	if (!diskPath) return;
	console.warn(
		`[content-fallback] HIT kind=${kind} slug=${slug} stored=${stored ? "hit" : "miss"}`,
	);
}

/**
 * Resolve an English discourse entry. In dev, always reads the MDX file from
 * disk when present so edits show immediately without restarting Astro's
 * content store.
 */
export async function getEnglishEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	const diskPath = resolveEnglishPath(slug);

	// Dev: read the file directly before touching the content store. The stored
	// entry would be discarded in favor of the disk read anyway, and consulting
	// the store forces evaluation of the whole data-store module (~100 MB inline
	// JSON), which Astro re-invalidates after every content edit — the main
	// source of multi-second page loads in dev.
	if (import.meta.env.DEV && diskPath) {
		return readMarkdownEntry(diskPath, slug);
	}

	const stored = await findStoredEnglishEntry(slug);

	if (stored) return storedToLike(stored);

	probeContentFallback("en", slug, stored, diskPath);
	if (diskPath) return readMarkdownEntry(diskPath, slug);
	return null;
}

/**
 * Resolve a Pāli discourse entry. In dev, reads from disk when present.
 */
export async function getPaliEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	// Dev: disk-first, same rationale as getEnglishEntry — avoid the content
	// store (and its full re-evaluation after each edit) when the file exists.
	const devDiskPath = import.meta.env.DEV ? resolvePaliPath(slug) : null;
	if (devDiskPath) {
		return readMarkdownEntry(devDiskPath, slug);
	}

	const stored = await findStoredPaliEntry(slug);
	const diskPath = resolvePaliPath(slug, stored?.filePath);

	if (import.meta.env.DEV && diskPath) {
		return readMarkdownEntry(diskPath, stored?.id ?? slug);
	}

	if (stored) return storedToLike(stored);

	probeContentFallback("pli", slug, stored, diskPath);
	if (diskPath) return readMarkdownEntry(diskPath, slug);
	return null;
}

/**
 * Resolve a Sujato reference translation entry (glob ids may be `an/an4.10`).
 */
export async function getReferenceSujatoEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	// Dev: disk-first, same rationale as getEnglishEntry.
	const devDiskPath = import.meta.env.DEV
		? resolveReferencePath(SUJATO_ROOT, slug)
		: null;
	if (devDiskPath) {
		return readMarkdownEntry(devDiskPath, slug);
	}

	const stored = await findStoredReferenceEntry("referenceSujato", slug);
	const diskPath = resolveReferencePath(SUJATO_ROOT, slug, stored?.filePath);

	if (import.meta.env.DEV && diskPath) {
		return readMarkdownEntry(diskPath, stored?.id ?? slug);
	}

	if (stored) return storedToLike(stored);

	probeContentFallback("sujato", slug, stored, diskPath);
	if (diskPath) return readMarkdownEntry(diskPath, slug);
	return null;
}

/**
 * Resolve a Pāli MS segment reference entry (glob ids may be `an/an4.10`).
 */
export async function getReferencePliMsEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	// Dev: disk-first, same rationale as getEnglishEntry.
	const devDiskPath = import.meta.env.DEV
		? resolveReferencePath(PLI_MS_ROOT, slug)
		: null;
	if (devDiskPath) {
		return readMarkdownEntry(devDiskPath, slug);
	}

	const stored = await findStoredReferenceEntry("referencePliMs", slug);
	const diskPath = resolveReferencePath(PLI_MS_ROOT, slug, stored?.filePath);

	if (import.meta.env.DEV && diskPath) {
		return readMarkdownEntry(diskPath, stored?.id ?? slug);
	}

	if (stored) return storedToLike(stored);

	probeContentFallback("plims", slug, stored, diskPath);
	if (diskPath) return readMarkdownEntry(diskPath, slug);
	return null;
}

/**
 * Resolve a sample Gujarati entry (glob ids may be `sn/sn56.11`).
 * Missing or unaligned discourses are not in this collection.
 */
export async function getGuEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	// Dev: disk-first, same rationale as getEnglishEntry.
	const devDiskPath = import.meta.env.DEV
		? resolveReferencePath(GU_ROOT, slug)
		: null;
	if (devDiskPath) {
		return readMarkdownEntry(devDiskPath, slug);
	}

	const stored = await findStoredReferenceEntry("gu", slug);
	const diskPath = resolveReferencePath(GU_ROOT, slug, stored?.filePath);

	if (import.meta.env.DEV && diskPath) {
		return readMarkdownEntry(diskPath, stored?.id ?? slug);
	}

	if (stored) return storedToLike(stored);

	probeContentFallback("gu", slug, stored, diskPath);
	if (diskPath) return readMarkdownEntry(diskPath, slug);
	return null;
}

/** Resolve a neighbor entry for footer navigation (EN, Sujato ref, or Pāli). */
export async function getDiscourseNeighborEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	const english = await getEnglishEntry(slug);
	if (english) return { ...english, id: slug };

	const reference = await getReferenceSujatoEntry(slug);
	if (reference) {
		return {
			...reference,
			id: slug,
			data: {
				...reference.data,
				title: reference.data.title || slug,
			},
		};
	}

	const pali = await getPaliEntry(slug);
	if (pali) {
		return {
			...pali,
			id: slug,
			data: {
				...pali.data,
				title: (pali.data.title as string | undefined) || slug,
			},
		};
	}

	return null;
}
