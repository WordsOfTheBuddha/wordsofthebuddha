import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	discourseIdsForReadSlug,
	isSlugFullyRead,
	markReadPages,
	unmarkReadPages,
} from "./readPages";

describe("discourseIdsForReadSlug", () => {
	it("expands a Dhp chapter and a decimal range file", () => {
		assert.deepEqual(discourseIdsForReadSlug("dhp1-20").slice(0, 3), [
			"dhp1",
			"dhp2",
			"dhp3",
		]);
		assert.equal(discourseIdsForReadSlug("/dhp1-20").length, 20);
		assert.deepEqual(discourseIdsForReadSlug("an1.1-10"), [
			"an1.1",
			"an1.2",
			"an1.3",
			"an1.4",
			"an1.5",
			"an1.6",
			"an1.7",
			"an1.8",
			"an1.9",
			"an1.10",
		]);
	});

	it("keeps a single verse or sutta as one id", () => {
		assert.deepEqual(discourseIdsForReadSlug("dhp1"), ["dhp1"]);
		assert.deepEqual(discourseIdsForReadSlug("mn10"), ["mn10"]);
	});
});

describe("markReadPages", () => {
	it("writes every verse when a chapter is marked", () => {
		const marked = markReadPages({}, "dhp1-3", 1000);
		assert.deepEqual(marked, { dhp1: 1000, dhp2: 1000, dhp3: 1000 });
		assert.equal("dhp1-3" in marked, false);
	});

	it("writes one id for a verse landing", () => {
		assert.deepEqual(markReadPages({}, "dhp1", 1000), { dhp1: 1000 });
	});

	it("does not move existing timestamps", () => {
		const marked = markReadPages({ dhp1: 50, dhp2: 50 }, "dhp1-3", 999);
		assert.equal(marked.dhp1, 50);
		assert.equal(marked.dhp2, 50);
		assert.equal(marked.dhp3, 999);
	});

	it("drops a leftover range key after expanding", () => {
		const marked = markReadPages({ "dhp1-3": 40 }, "dhp1-3", 40);
		assert.equal("dhp1-3" in marked, false);
		assert.equal(marked.dhp1, 40);
		assert.equal(marked.dhp2, 40);
		assert.equal(marked.dhp3, 40);
	});
});

describe("unmarkReadPages", () => {
	it("removes one verse after a chapter mark", () => {
		const chapter = markReadPages({}, "dhp1-3", 1000);
		const after = unmarkReadPages(chapter, "dhp1");
		assert.deepEqual(after, { dhp2: 1000, dhp3: 1000 });
	});

	it("removes a leftover range key when one verse is unmarked", () => {
		const after = unmarkReadPages(
			{ "dhp1-3": 9, dhp1: 9, dhp2: 9, dhp3: 9 },
			"dhp1",
		);
		assert.deepEqual(after, { dhp2: 9, dhp3: 9 });
		assert.equal(isSlugFullyRead(after, "dhp1-3"), false);
		assert.equal(isSlugFullyRead(after, "dhp1"), false);
	});
});

describe("isSlugFullyRead", () => {
	it("requires every child for a range file", () => {
		const partial = { dhp1: 1, dhp2: 1 };
		assert.equal(isSlugFullyRead(partial, "dhp1-3"), false);
		assert.equal(isSlugFullyRead(partial, "dhp1"), true);
		const full = markReadPages(partial, "dhp1-3", 2);
		assert.equal(isSlugFullyRead(full, "dhp1-3"), true);
	});

	it("does not treat a leftover range key as filling an unmarked verse", () => {
		const pages = { "dhp1-3": 9, dhp2: 9, dhp3: 9 };
		assert.equal(isSlugFullyRead(pages, "dhp1"), false);
		assert.equal(isSlugFullyRead(pages, "dhp1-3"), false);
	});

	it("follows mark verse, mark chapter, unmark verse", () => {
		let pages = markReadPages({}, "dhp1", 10);
		pages = markReadPages(pages, "dhp1-3", 20);
		pages = unmarkReadPages(pages, "dhp1");
		assert.equal(isSlugFullyRead(pages, "dhp1"), false);
		assert.equal(isSlugFullyRead(pages, "dhp1-3"), false);
		assert.equal(isSlugFullyRead(pages, "dhp2"), true);
	});

	it("treats Dhp 1-20 as unread after unmarking Dhp 1", () => {
		let pages = markReadPages({}, "dhp1", 10);
		pages = markReadPages(pages, "dhp1-20", 20);
		pages = unmarkReadPages(pages, "dhp1");
		assert.equal(isSlugFullyRead(pages, "dhp1"), false);
		assert.equal(isSlugFullyRead(pages, "dhp1-20"), false);
		assert.equal(discourseIdsForReadSlug("dhp1-20").length, 20);
		assert.equal(Object.keys(pages).length, 19);
	});
});
