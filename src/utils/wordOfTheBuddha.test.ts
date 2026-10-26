import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBreadcrumbTrail } from "./breadcrumbTrail";
import {
	findWotbNode,
	loadWotbBook,
	resolveWotb,
	wotbHref,
	wotbNeighbors,
	wotbPages,
} from "./wordOfTheBuddha";

describe("word of the buddha pages", () => {
	it("keeps the eight chapters and the Roman numerals in the four truth titles", () => {
		const titles = loadWotbBook().map((chapter) => chapter.title);
		assert.deepEqual(titles, [
			"Introduction",
			"The Four Noble Truths",
			"I. The Noble Truth of Suffering",
			"II. The Noble Truth of the Origin of Suffering",
			"III. The Noble Truth of the Extinction of Suffering",
			"IV. The Path that Leads to the Extinction of Suffering",
			"Gradual Development of the Eightfold Path",
			"The Path as a Chain of Causes",
		]);
	});

	it("nests consciousness under suffering and gives each level its own slug", () => {
		const node = findWotbNode([
			"suffering",
			"group-of-consciousness",
			"dependent-origination-of-consciousness",
		]);
		assert.equal(node?.title, "Dependent Origination of Consciousness");
		assert.equal(
			wotbHref(node!.segments),
			"/anthologies/the-word-of-the-buddha/suffering/group-of-consciousness/dependent-origination-of-consciousness",
		);
		assert.ok(node!.blocks.some((block) => block.type === "passage"));
	});

	it("opens a heading with no passages at its first section", () => {
		assert.equal(
			resolveWotb(["origin", "karma"])?.redirectTo,
			"/anthologies/the-word-of-the-buddha/origin/karma/present-karma-results",
		);
		assert.equal(
			resolveWotb(["path", "right-effort"])?.redirectTo,
			"/anthologies/the-word-of-the-buddha/path/right-effort/effort-to-avoid",
		);
		assert.equal(
			resolveWotb([
				"path",
				"right-mindfulness",
				"contemplation-of-the-body",
			])?.redirectTo,
			"/anthologies/the-word-of-the-buddha/path/right-mindfulness/contemplation-of-the-body/mindfulness-of-breathing",
		);
	});

	it("walks previous and next in contents order, including across chapters", () => {
		const suffering = findWotbNode(["suffering"]);
		assert.ok(suffering);
		const { next } = wotbNeighbors(suffering);
		assert.equal(next?.slug, "five-groups-of-existence");
		const samsara = findWotbNode(["suffering", "samsara"]);
		assert.equal(wotbNeighbors(samsara!).next?.slug, "origin");
		const intro = findWotbNode(["introduction"]);
		assert.equal(wotbNeighbors(intro!).prev, null);
	});

	it("keeps repeated section names on distinct paths", () => {
		const pages = wotbPages();
		const hrefs = pages.map((page) => wotbHref(page.segments));
		assert.equal(new Set(hrefs).size, hrefs.length);
		const nibbana = hrefs.filter((href) => href.endsWith("/nibbana"));
		assert.equal(nibbana.length, 3);
	});

	it("reads a passage note and paragraph range from the chapter source", () => {
		const intro = findWotbNode(["introduction"]);
		const passage = intro?.blocks.find((block) => block.type === "passage");
		assert.equal(passage?.type === "passage" && passage.slug, "kp1");
		const noted = intro?.blocks.find(
			(block) => block.type === "passage" && block.note,
		);
		assert.equal(
			noted?.type === "passage" && noted.note,
			"refuge, and the five precepts as the great gifts",
		);
		const origin = findWotbNode([
			"suffering",
			"group-of-consciousness",
			"dependent-origination-of-consciousness",
		]);
		const ranged = origin?.blocks.find((block) => block.type === "passage");
		assert.equal(ranged?.type === "passage" && ranged.start, 28);
		assert.equal(ranged?.type === "passage" && ranged.end, 30);
	});
});

describe("word of the buddha breadcrumbs", () => {
	it("shows the book, the chapter, and the current section", () => {
		const trail = buildBreadcrumbTrail(
			"anthologies/the-word-of-the-buddha/suffering/group-of-consciousness/dependent-origination-of-consciousness",
			"/anthologies/the-word-of-the-buddha/suffering/group-of-consciousness/dependent-origination-of-consciousness",
		);
		assert.deepEqual(
			trail.map((crumb) => crumb.label),
			[
				"Discover",
				"Anthologies",
				"The Word of the Buddha",
				"I. The Noble Truth of Suffering",
				"Dependent Origination of Consciousness",
			],
		);
		assert.equal(
			trail.at(-1)?.path,
			"/anthologies/the-word-of-the-buddha/suffering/group-of-consciousness/dependent-origination-of-consciousness",
		);
		assert.equal(
			trail.at(-2)?.path,
			"/anthologies/the-word-of-the-buddha/suffering",
		);
	});
});
