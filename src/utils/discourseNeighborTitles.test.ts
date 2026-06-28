import { test } from "node:test";
import assert from "node:assert/strict";
import {
	getDiscourseNeighborTitle,
	seedDiscourseNeighborTitles,
} from "./discourseNeighborTitles.ts";

test("getDiscourseNeighborTitle returns reference catalog title", () => {
	const title = getDiscourseNeighborTitle("an4.2");
	assert.ok(title.length > 0);
	assert.equal(title, "Fallen");
});

test("seedDiscourseNeighborTitles overlays EN titles", () => {
	seedDiscourseNeighborTitles([["an4.1", "Preceded by"]]);
	assert.equal(getDiscourseNeighborTitle("an4.1"), "Preceded by");
});
