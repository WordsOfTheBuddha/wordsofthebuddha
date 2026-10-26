/**
 * The Word of the Buddha is eight chapter files. Each heading with passages
 * of its own is a page. A heading that only introduces child sections keeps
 * its place in the contents; its URL opens the first child that has passages.
 */
import fs from "node:fs";
import path from "node:path";
import { WOTB_SLUG } from "./anthologySlugs";
import { allocateUniqueSlug, slugify } from "./slugify";

export type WotbProse = { type: "prose"; text: string };
export type WotbPassage = {
	type: "passage";
	slug: string;
	cite: string;
	start?: number;
	end?: number;
	note?: string;
};
export type WotbBlock = WotbProse | WotbPassage;

export type WotbNode = {
	title: string;
	slug: string;
	/** Path segments after `/anthologies/the-word-of-the-buddha/`. */
	segments: string[];
	/** `src/content/word-of-the-buddha/<file>` for last-updated lookups. */
	file: string;
	description: string;
	blocks: WotbBlock[];
	children: WotbNode[];
};

const CHAPTER_DIR = path.join(
	process.cwd(),
	"src/content/word-of-the-buddha",
);

const BOOK_PREFIX = `/anthologies/${WOTB_SLUG}`;

let cached: { stamp: string; chapters: WotbNode[] } | null = null;

export function wotbHref(segments: string[]): string {
	return `${BOOK_PREFIX}/${segments.join("/")}`;
}

/** Drop a leading "The" so section URLs stay short. Chapter slugs are unchanged. */
export function wotbSectionSlug(title: string): string {
	return slugify(title.replace(/^The\s+/u, ""));
}

export function loadWotbBook(): WotbNode[] {
	const stamp = chapterStamp();
	if (cached?.stamp === stamp) return cached.chapters;
	const chapters = readChapters().sort(
		(a, b) => a.order - b.order,
	).map((chapter) => parseChapter(chapter));
	cached = { stamp, chapters };
	return chapters;
}

export function findWotbNode(segments: string[]): WotbNode | null {
	if (segments.length === 0) return null;
	let node: WotbNode | undefined = loadWotbBook().find(
		(chapter) => chapter.slug === segments[0],
	);
	if (!node) return null;
	for (const slug of segments.slice(1)) {
		node = node.children.find((child) => child.slug === slug);
		if (!node) return null;
	}
	return node;
}

export function wotbChapter(node: WotbNode): WotbNode {
	return findWotbNode([node.segments[0]]) ?? node;
}

/** First page in reading order at or under this node. */
export function firstWotbPage(node: WotbNode): WotbNode | null {
	if (node.blocks.length > 0) return node;
	for (const child of node.children) {
		const found = firstWotbPage(child);
		if (found) return found;
	}
	return null;
}

export function wotbPageHref(node: WotbNode): string {
	const page = firstWotbPage(node);
	return wotbHref((page ?? node).segments);
}

export function wotbPages(chapters: WotbNode[] = loadWotbBook()): WotbNode[] {
	const pages: WotbNode[] = [];
	const walk = (node: WotbNode) => {
		if (node.blocks.length > 0) pages.push(node);
		for (const child of node.children) walk(child);
	};
	for (const chapter of chapters) walk(chapter);
	return pages;
}

export function resolveWotb(segments: string[]): {
	node: WotbNode;
	redirectTo: string | null;
} | null {
	const node = findWotbNode(segments);
	if (!node) return null;
	if (node.blocks.length > 0) return { node, redirectTo: null };
	const page = firstWotbPage(node);
	if (!page) return null;
	return { node: page, redirectTo: wotbHref(page.segments) };
}

export function wotbNeighbors(node: WotbNode): {
	prev: WotbNode | null;
	next: WotbNode | null;
} {
	const pages = wotbPages();
	const key = node.segments.join("/");
	const index = pages.findIndex((page) => page.segments.join("/") === key);
	return {
		prev: index > 0 ? pages[index - 1] : null,
		next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : null,
	};
}

export function wotbDescription(node: WotbNode): string {
	const prose = node.blocks.find((block) => block.type === "prose");
	const text =
		prose && prose.type === "prose"
			? prose.text
			: wotbChapter(node).description;
	if (text.length <= 200) return text;
	const cut = text.slice(0, 197).replace(/\s+\S*$/u, "");
	return `${cut}…`;
}

type ChapterSource = {
	order: number;
	slug: string;
	title: string;
	description: string;
	file: string;
	body: string;
};

function chapterStamp(): string {
	if (!fs.existsSync(CHAPTER_DIR)) return "";
	return fs
		.readdirSync(CHAPTER_DIR)
		.filter((name) => name.endsWith(".mdx"))
		.map((name) => {
			const stat = fs.statSync(path.join(CHAPTER_DIR, name));
			return `${name}:${stat.mtimeMs}`;
		})
		.sort()
		.join("|");
}

function readChapters(): ChapterSource[] {
	return fs
		.readdirSync(CHAPTER_DIR)
		.filter((name) => name.endsWith(".mdx"))
		.map((name) => {
			const raw = fs.readFileSync(path.join(CHAPTER_DIR, name), "utf8");
			const split = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u.exec(raw);
			const data = parseFrontmatter(split?.[1] ?? "");
			return {
				order: Number(data.order ?? "0"),
				slug: data.slug || name.replace(/\.mdx$/, ""),
				title: data.title || data.slug || name,
				description: data.description ?? "",
				file: `content/word-of-the-buddha/${name}`,
				body: split?.[2] ?? raw,
			};
		});
}

function parseFrontmatter(raw: string): Record<string, string> {
	const data: Record<string, string> = {};
	for (const line of raw.split("\n")) {
		const match = /^([A-Za-z]+):\s*(.*)$/u.exec(line);
		if (!match) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		data[match[1]] = value;
	}
	return data;
}

function parseChapter(source: ChapterSource): WotbNode {
	const root: WotbNode = {
		title: source.title,
		slug: source.slug,
		segments: [source.slug],
		file: source.file,
		description: source.description,
		blocks: [],
		children: [],
	};
	const stack: Array<WotbNode & { level: number }> = [
		Object.assign(root, { level: 1 }),
	];
	let buffer: string[] = [];

	const flush = () => {
		const node = stack[stack.length - 1];
		node.blocks.push(...parseBlocks(buffer.join("\n")));
		buffer = [];
	};

	for (const line of source.body.split("\n")) {
		const heading = /^(#{2,6})\s+(.+?)\s*$/u.exec(line);
		if (!heading) {
			buffer.push(line);
			continue;
		}
		flush();
		const level = heading[1].length;
		while (stack.length > 1 && stack[stack.length - 1].level >= level) {
			stack.pop();
		}
		const parent = stack[stack.length - 1];
		const title = heading[2].trim();
		const used = new Set(parent.children.map((child) => child.slug));
		const slug = allocateUniqueSlug(title, used, wotbSectionSlug);
		const node: WotbNode & { level: number } = {
			title,
			slug,
			segments: [...parent.segments, slug],
			file: source.file,
			description: source.description,
			blocks: [],
			children: [],
			level,
		};
		parent.children.push(node);
		stack.push(node);
	}
	flush();
	return root;
}

function parseBlocks(text: string): WotbBlock[] {
	const blocks: WotbBlock[] = [];
	for (const chunk of text.split(/\n{2,}/u)) {
		const trimmed = chunk.trim();
		if (!trimmed || trimmed.startsWith("import ")) continue;
		const passage = parsePassage(trimmed);
		if (passage) {
			blocks.push(passage);
			continue;
		}
		blocks.push({
			type: "prose",
			text: trimmed.replace(/\s*\n\s*/gu, " "),
		});
	}
	return blocks;
}

function parsePassage(raw: string): WotbPassage | null {
	const match = /^<Passage\s+([\s\S]*?)\s*\/>$/u.exec(raw);
	if (!match) return null;
	const attrs = match[1];
	const str = (name: string) =>
		new RegExp(`${name}="([^"]*)"`, "u").exec(attrs)?.[1];
	const num = (name: string) => {
		const value = new RegExp(`${name}=\\{(\\d+)\\}`, "u").exec(attrs)?.[1];
		return value == null ? undefined : Number(value);
	};
	const slug = str("slug");
	const cite = str("cite");
	if (!slug || !cite) return null;
	return {
		type: "passage",
		slug,
		cite,
		start: num("start"),
		end: num("end"),
		note: str("note"),
	};
}
