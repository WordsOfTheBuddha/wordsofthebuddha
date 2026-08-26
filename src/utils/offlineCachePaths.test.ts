import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	addPathVariantsToSet,
	anyVariantPresent,
	filterUncachedPaths,
} from "./offlineCachePaths";

describe("offlineCachePaths", () => {
	it("treats trailing-slash and index.html as the same page", () => {
		const set = new Set<string>();
		addPathVariantsToSet("/an", set);
		assert.equal(anyVariantPresent("/an/", set), true);
		assert.equal(anyVariantPresent("/an/index.html", set), true);
		assert.equal(anyVariantPresent("/an1", set), false);
	});

	it("does not treat a longer collection prefix as a hit", () => {
		const set = new Set<string>();
		addPathVariantsToSet("/sn", set);
		assert.equal(anyVariantPresent("/snp", set), false);
		assert.equal(anyVariantPresent("/sn1.1", set), false);
	});

	it("skips URLs already in cache and keeps the rest", () => {
		const cached = new Set<string>();
		addPathVariantsToSet("/an1.1", cached);
		addPathVariantsToSet("/an1.2/", cached);
		const missing = filterUncachedPaths(
			["/an1.1", "/an1.2", "/an1.3", "/an"],
			cached,
		);
		assert.deepEqual(missing, ["/an1.3", "/an"]);
	});

	it("returns the full list when the cache is empty", () => {
		assert.deepEqual(filterUncachedPaths(["/ud1.1", "/search"], new Set()), [
			"/ud1.1",
			"/search",
		]);
	});
});
