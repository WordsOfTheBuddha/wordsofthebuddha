import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildBreadcrumbTrail,
	currentBreadcrumbIndex,
	slugFromPath,
} from "./breadcrumbTrail";

describe("slugFromPath", () => {
	it("strips trailing slashes and index.html used in production builds", () => {
		assert.equal(slugFromPath("/dn22"), "dn22");
		assert.equal(slugFromPath("/dn22/"), "dn22");
		assert.equal(slugFromPath("/dn22/index.html"), "dn22");
		assert.equal(slugFromPath("dn/dn22"), "dn22");
	});
});

describe("buildBreadcrumbTrail", () => {
	it("does not append a blank crumb when the public URL has a trailing slash", () => {
		const trail = buildBreadcrumbTrail("dn/dn22", "/dn22/");
		assert.deepEqual(
			trail.map((crumb) => crumb.label),
			["Discover", "DN", "DN 14–23", "DN 22"],
		);
		assert.equal(
			currentBreadcrumbIndex(trail, "dn22"),
			trail.length - 1,
		);
		assert.equal(trail[trail.length - 2].path, "/dn14-23");
	});

	it("does not append an index.html crumb from prerendered static output", () => {
		const trail = buildBreadcrumbTrail("dn/dn22", "/dn22/index.html");
		assert.equal(trail.at(-1)?.path, "/dn22");
		assert.equal(trail.length, 4);
	});

	it("matches astro dev pathnames without a trailing slash", () => {
		const trail = buildBreadcrumbTrail("dn/dn22", "/dn22");
		assert.equal(trail.at(-1)?.path, "/dn22");
		assert.equal(trail.length, 4);
	});
});
