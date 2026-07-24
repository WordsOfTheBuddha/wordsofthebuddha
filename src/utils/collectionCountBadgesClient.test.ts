import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countForRefMode } from "./collectionCountBadgesClient";

describe("collectionCountBadgesClient", () => {
	it("countForRefMode uses translated count when ref is off", () => {
		assert.equal(
			countForRefMode({ translated: 47, readable: 50 }, false),
			47,
		);
	});

	it("countForRefMode uses readable count when ref is on", () => {
		assert.equal(
			countForRefMode({ translated: 47, readable: 50 }, true),
			50,
		);
	});
});
