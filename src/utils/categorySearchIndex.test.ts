import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAllContent } from "./discover-data";
import {
	applyCategoryDescriptions,
	decodeCategorySearchIndex,
	encodeCategorySearchIndex,
} from "./categorySearchIndex";

const allItems = () =>
	buildAllContent(["topics", "qualities", "similes", "persons"]);
const jsonRoundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("category search index", () => {
	it("decodes to the same items buildAllContent produces", () => {
		const items = allItems();
		const { index, descriptions } = jsonRoundTrip(
			encodeCategorySearchIndex(items),
		);
		const decoded = decodeCategorySearchIndex(index);
		applyCategoryDescriptions(decoded.discourses, descriptions);
		assert.deepEqual(jsonRoundTrip(decoded.items), jsonRoundTrip(items));
	});

	it("matches everything but discourse descriptions before they load", () => {
		const items = allItems();
		const { index } = jsonRoundTrip(encodeCategorySearchIndex(items));
		const withoutDescriptions = jsonRoundTrip(items).map((item) => ({
			...item,
			discourses: item.discourses.map(({ description: _, ...rest }) => rest),
		}));
		assert.deepEqual(
			jsonRoundTrip(decodeCategorySearchIndex(index).items),
			withoutDescriptions,
		);
	});

	it("stores shared discourse rows once", () => {
		const items = allItems();
		const refs = items.reduce((n, item) => n + item.discourses.length, 0);
		const { index, descriptions } = encodeCategorySearchIndex(items);
		assert.ok(index.discourses.length < refs);
		assert.equal(descriptions.length, index.discourses.length);
	});

	it("rejects mismatched descriptions and unknown versions", () => {
		const { discourses } = decodeCategorySearchIndex({
			version: 1,
			discourses: [{ id: "mn1", title: "T", collection: "mn" }],
			items: [],
		});
		assert.throws(() => applyCategoryDescriptions(discourses, []));
		assert.throws(() => decodeCategorySearchIndex({ version: 2 } as never));
	});
});
