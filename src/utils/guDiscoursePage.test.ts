import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import matter from "gray-matter";
import { PUBLIC_SSR_ROUTE_PATTERNS } from "./edgeCache";
import {
	blocksAlign,
	guReviewNeighbors,
	listGuReviewFiles,
	splitDiscourseBlocks,
} from "./guReviewFiles";

const ROOT = process.cwd();
const PLI_ROOT = path.join(ROOT, "src/content/pli");

function paliPath(slug: string): string {
	const prefix = slug.match(/^([a-z]+)/i)?.[1]?.toLowerCase();
	if (!prefix) throw new Error(`no collection for ${slug}`);
	return path.join(PLI_ROOT, prefix, `${slug}.md`);
}

describe("Gujarati review pages", () => {
	const files = listGuReviewFiles();

	it("publishes the sample and pairs each block with Pali", () => {
		assert.ok(files.length > 0);
		for (const file of files) {
			const guRaw = fs.readFileSync(path.join(ROOT, file.filePath), "utf-8");
			const { content: guBody } = matter(guRaw);
			const pliRaw = fs.readFileSync(paliPath(file.slug), "utf-8");
			const { content: paliBody } = matter(pliRaw);
			assert.equal(
				blocksAlign(paliBody, guBody),
				true,
				`${file.slug} does not line up with src/content/pli`,
			);
			const paliBlocks = splitDiscourseBlocks(paliBody);
			const guBlocks = splitDiscourseBlocks(guBody);
			assert.equal(guBlocks.length, paliBlocks.length, file.slug);
			assert.ok(guBlocks.some((block) => /[\u0A80-\u0AFF]/.test(block)), file.slug);
		}
	});

	it("leaves a shifted discourse off the route", () => {
		assert.equal(blocksAlign("one\n\ntwo", "one"), false);
		assert.equal(blocksAlign("# heading\n\nbody", "body\n\n# heading"), false);
	});

	it("walks prev and next inside the sample", () => {
		const slugs = files.map((file) => file.slug);
		assert.deepEqual(guReviewNeighbors(slugs[0], files), {
			prevId: null,
			nextId: slugs[1] ?? null,
		});
		const middle = slugs[Math.min(3, slugs.length - 1)];
		const index = slugs.indexOf(middle);
		assert.deepEqual(guReviewNeighbors(middle, files), {
			prevId: index > 0 ? slugs[index - 1] : null,
			nextId: index + 1 < slugs.length ? slugs[index + 1] : null,
		});
		assert.ok(slugs.includes("sn56.11"));
	});

	it("is an on-demand public route", () => {
		assert.equal(PUBLIC_SSR_ROUTE_PATTERNS.has("/discourse-gu/[id]"), true);
	});
});
