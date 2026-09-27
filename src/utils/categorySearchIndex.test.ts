import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAllContent } from "./discover-data";
import {
	decodeCategorySearchIndex,
	encodeCategorySearchIndex,
} from "./categorySearchIndex";

describe("category search index", () => {
	it("decodes to the same items buildAllContent produces", () => {
		const items = buildAllContent(["topics", "qualities", "similes", "persons"]);
		const encoded = JSON.parse(
			JSON.stringify(encodeCategorySearchIndex(items)),
		);
		assert.deepEqual(
			decodeCategorySearchIndex(encoded),
			JSON.parse(JSON.stringify(items)),
		);
	});

	it("stores shared discourse rows once", () => {
		const items = buildAllContent(["topics", "qualities", "similes", "persons"]);
		const refs = items.reduce((n, item) => n + item.discourses.length, 0);
		const encoded = encodeCategorySearchIndex(items);
		assert.ok(encoded.discourses.length < refs);
	});

	it("gives each item its own discourse objects", () => {
		const [a, b] = decodeCategorySearchIndex({
			version: 1,
			discourses: [
				{ id: "mn1", title: "T", description: "D", collection: "mn" },
			],
			items: [
				{ id: "x", slug: "x", type: "topic", title: "X", discourses: [0] },
				{ id: "y", slug: "y", type: "topic", title: "Y", discourses: [0] },
			],
		});
		assert.notEqual(a.discourses[0], b.discourses[0]);
	});

	it("rejects unknown versions", () => {
		assert.throws(() =>
			decodeCategorySearchIndex({ version: 2 } as never),
		);
	});
});
