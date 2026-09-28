import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { compareDiscourseIds } from "./discourseSort";

const GU_ROOT = path.join(process.cwd(), "src/content/gu");

/** Blank-line blocks, same split the sample translator uses on `src/content/pli`. */
export function splitDiscourseBlocks(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((block) => block.trim())
		.filter((block) => block.length > 0 && !block.startsWith("---"));
}

/**
 * True when every Gujarati block lines up with the Pali block at the same
 * index, including headings. A mismatch means the discourse stays off `/gu`.
 */
export function blocksAlign(paliBody: string, guBody: string): boolean {
	const pali = splitDiscourseBlocks(paliBody);
	const gu = splitDiscourseBlocks(guBody);
	if (pali.length === 0 || pali.length !== gu.length) return false;
	return pali.every(
		(block, index) => block.startsWith("#") === gu[index].startsWith("#"),
	);
}

export type GuReviewFile = {
	slug: string;
	title: string;
	filePath: string;
};

/** Published sample files under `src/content/gu`, in discourse order. */
export function listGuReviewFiles(root = GU_ROOT): GuReviewFile[] {
	if (!fs.existsSync(root)) return [];
	const files: GuReviewFile[] = [];
	for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const dir = path.join(root, entry.name);
		for (const name of fs.readdirSync(dir)) {
			if (!name.endsWith(".md")) continue;
			const abs = path.join(dir, name);
			const { data } = matter(fs.readFileSync(abs, "utf-8"));
			const slug =
				typeof data.slug === "string" ? data.slug : name.replace(/\.md$/, "");
			const title =
				typeof data.title === "string" && data.title.trim()
					? data.title
					: slug;
			files.push({
				slug,
				title,
				filePath: path.relative(process.cwd(), abs).replace(/\\/g, "/"),
			});
		}
	}
	files.sort((a, b) => compareDiscourseIds(a.slug, b.slug));
	return files;
}

/** Prev/next inside the published Gujarati sample, not the whole canon. */
export function guReviewNeighbors(
	slug: string,
	files: readonly { slug: string }[],
): { prevId: string | null; nextId: string | null } {
	const index = files.findIndex((file) => file.slug === slug);
	if (index < 0) return { prevId: null, nextId: null };
	return {
		prevId: index > 0 ? files[index - 1].slug : null,
		nextId: index + 1 < files.length ? files[index + 1].slug : null,
	};
}
