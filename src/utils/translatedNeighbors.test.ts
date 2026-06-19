import { test } from "node:test";
import assert from "node:assert/strict";
import { findNearestTranslatedNeighbors } from "./translatedNeighbors.ts";
import { routes } from "./routes.ts";

test("sn48.52 neighbors among translated discourses", () => {
	const { prevId, nextId } = findNearestTranslatedNeighbors("sn48.52", routes);
	assert.equal(prevId, "sn48.50");
	assert.equal(nextId, "sn48.53");
});

test("untranslated between translated discourses", () => {
	const { prevId, nextId } = findNearestTranslatedNeighbors("sn48.51", routes);
	assert.equal(prevId, "sn48.50");
	assert.equal(nextId, "sn48.53");
});

test("unknown collection returns nulls", () => {
	const { prevId, nextId } = findNearestTranslatedNeighbors("xx99.1", routes);
	assert.equal(prevId, null);
	assert.equal(nextId, null);
});
