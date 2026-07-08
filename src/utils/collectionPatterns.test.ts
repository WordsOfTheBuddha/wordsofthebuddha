import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createSearchPattern,
	slugMatchesCollectionPattern,
} from "./collectionPatterns";

describe("collectionPatterns MN vagga ranges", () => {
	it("matches discourse slugs within a vagga range", () => {
		assert.equal(slugMatchesCollectionPattern("mn5", "mn1-10"), true);
		assert.equal(slugMatchesCollectionPattern("mn10", "mn1-10"), true);
		assert.equal(slugMatchesCollectionPattern("mn11", "mn1-10"), false);
	});

	it("does not collide with paṇṇāsa ranges or other vaggas", () => {
		assert.equal(slugMatchesCollectionPattern("mn1", "mn1-10"), true);
		assert.equal(slugMatchesCollectionPattern("mn25", "mn1-10"), false);
		assert.equal(slugMatchesCollectionPattern("mn25", "mn1-50"), true);
		assert.equal(slugMatchesCollectionPattern("mn25", "mn21-30"), true);
		assert.equal(slugMatchesCollectionPattern("mn11", "mn1-10"), false);
	});

	it("builds search patterns for vagga collection pages", () => {
		const pattern = createSearchPattern("mn1-10");
		assert.match(pattern ?? "", /slug:mn1\$/);
		assert.match(pattern ?? "", /slug:mn10\$/);
		assert.doesNotMatch(pattern ?? "", /slug:mn11\$/);
	});
});

describe("collectionPatterns AN book vagga ranges", () => {
	it("matches discourse slugs within an4 vagga ranges", () => {
		assert.equal(slugMatchesCollectionPattern("an4.5", "an4.1-10"), true);
		assert.equal(slugMatchesCollectionPattern("an4.10", "an4.1-10"), true);
		assert.equal(slugMatchesCollectionPattern("an4.11", "an4.1-10"), false);
		assert.equal(slugMatchesCollectionPattern("an4.81", "an4.81-90"), true);
		assert.equal(slugMatchesCollectionPattern("an4.90", "an4.81-90"), true);
		assert.equal(slugMatchesCollectionPattern("an4.80", "an4.81-90"), false);
	});

	it("does not treat book slug as vagga range match", () => {
		assert.equal(slugMatchesCollectionPattern("an4.5", "an4"), true);
		assert.equal(slugMatchesCollectionPattern("an5.57", "an5.51-60"), true);
	});

	it("builds search patterns for an4 vagga sections", () => {
		const pattern = createSearchPattern("an4.1-10");
		assert.match(pattern ?? "", /slug:an4\.1\$/);
		assert.match(pattern ?? "", /slug:an4\.10\$/);
		assert.doesNotMatch(pattern ?? "", /slug:an4\.11\$/);
	});
});
