import { test } from "node:test";
import assert from "node:assert/strict";
import {
	findDiscourseNeighbors,
	findPageDiscourseNeighbors,
	getRoutableDiscourseSlugs,
} from "./discourseNeighbors.ts";

test("an4.2 neighbors include EN prev and reference next", () => {
	const slugs = getRoutableDiscourseSlugs();
	const { prevId, nextId } = findDiscourseNeighbors("an4.2", slugs);
	assert.equal(prevId, "an4.1");
	assert.equal(nextId, "an4.3");
});

test("an4.1 next reaches reference-only an4.2", () => {
	const slugs = getRoutableDiscourseSlugs();
	const { nextId } = findDiscourseNeighbors("an4.1", slugs);
	assert.equal(nextId, "an4.2");
});

test("sn48.52 neighbors walk routable sn48 discourses", () => {
	const slugs = getRoutableDiscourseSlugs();
	const { prevId, nextId } = findDiscourseNeighbors("sn48.52", slugs);
	assert.equal(prevId, "sn48.51");
	assert.equal(nextId, "sn48.53");
});

test("unknown collection returns nulls", () => {
	const slugs = getRoutableDiscourseSlugs();
	const { prevId, nextId } = findDiscourseNeighbors("xx99.1", slugs);
	assert.equal(prevId, null);
	assert.equal(nextId, null);
});

test("refMode false uses EN-only neighbors for an4.1", () => {
	const { prevId, nextId } = findPageDiscourseNeighbors("an4.1", false);
	assert.equal(prevId, "an3.139");
	assert.equal(nextId, "an4.5");
});

test("refMode true includes reference-only an4.2 after an4.1", () => {
	const { nextId } = findPageDiscourseNeighbors("an4.1", true);
	assert.equal(nextId, "an4.2");
});

test("refMode false walks EN sn48 discourses only", () => {
	const { prevId, nextId } = findPageDiscourseNeighbors("sn48.52", false);
	assert.equal(prevId, "sn48.50");
	assert.equal(nextId, "sn48.53");
});

test("refMode true matches full routable sn48 neighbors", () => {
	const { prevId, nextId } = findPageDiscourseNeighbors("sn48.52", true);
	assert.equal(prevId, "sn48.51");
	assert.equal(nextId, "sn48.53");
});
