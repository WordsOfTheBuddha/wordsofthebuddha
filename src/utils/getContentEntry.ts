import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { getCollection, getEntry } from "astro:content";

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

async function findStoredEnglishEntry(slug: string) {
	try {
		let entry = await getEntry("all", slug);
		if (entry) return entry;

		const allEntries = await getCollection("all");
		return (
			allEntries.find(
				(item) =>
					item.id === slug ||
					item.data.slug === slug ||
					item.id.endsWith(`/${slug}`),
			) ?? null
		);
	} catch {
		return null;
	}
}

async function findStoredPaliEntry(slug: string) {
	try {
		let entry = await getEntry("pliAll", slug);
		if (entry) return entry;

		const allEntries = await getCollection("pliAll");
		return (
			allEntries.find(
				(item) =>
					item.id === slug ||
					item.data.slug === slug ||
					item.id.endsWith(`/${slug}`),
			) ?? null
		);
	} catch {
		return null;
	}
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

/**
 * Resolve an English discourse entry. In dev, always reads the MDX file from
 * disk when present so edits show immediately without restarting Astro's
 * content store.
 */
export async function getEnglishEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	const stored = await findStoredEnglishEntry(slug);
	const diskPath = resolveEnglishPath(slug, stored?.filePath);

	if (import.meta.env.DEV && diskPath) {
		return readMarkdownEntry(diskPath, stored?.id ?? slug);
	}

	if (stored) return storedToLike(stored);

	if (diskPath) return readMarkdownEntry(diskPath, slug);
	return null;
}

/**
 * Resolve a Pāli discourse entry. In dev, reads from disk when present.
 */
export async function getPaliEntry(
	slug: string,
): Promise<ContentEntryLike | null> {
	const stored = await findStoredPaliEntry(slug);
	const diskPath = resolvePaliPath(slug, stored?.filePath);

	if (import.meta.env.DEV && diskPath) {
		return readMarkdownEntry(diskPath, stored?.id ?? slug);
	}

	if (stored) return storedToLike(stored);

	if (diskPath) return readMarkdownEntry(diskPath, slug);
	return null;
}
