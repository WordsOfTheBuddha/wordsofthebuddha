import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getEffectiveVaggaSections,
	getMnVaggaRedirects,
	groupDiscoursesByVaggaSection,
} from "./vaggaSections";

describe("vaggaSections", () => {
	it("returns vagga sections for MN paṇṇāsa leaf collections", () => {
		const sections = getEffectiveVaggaSections("mn1-50");
		assert.ok(sections?.["mn1-10"]);
		assert.ok(sections?.["mn41-50"]);
		assert.equal(Object.keys(sections ?? {}).length, 5);
	});

	it("aggregates vagga sections for top-level MN", () => {
		const sections = getEffectiveVaggaSections("mn");
		assert.ok(sections?.["mn1-10"]);
		assert.ok(sections?.["mn91-100"]);
		assert.ok(sections?.["mn143-152"]);
		assert.equal(Object.keys(sections ?? {}).length, 15);
	});

	it("returns AN book vagga sections unchanged", () => {
		const sections = getEffectiveVaggaSections("an4");
		assert.ok(sections?.["an4.1-10"]);
	});

	it("groups discourses into vagga buckets in sort order", () => {
		const sections = getEffectiveVaggaSections("an4");
		const grouped = groupDiscoursesByVaggaSection(
			[
				{ slug: "an4.12", title: "12" },
				{ slug: "an4.2", title: "2" },
				{ slug: "an4.11", title: "11" },
			],
			sections,
		);
		const firstSection = grouped.find((s) => s.slug === "an4.1-10");
		const secondSection = grouped.find((s) => s.slug === "an4.11-20");
		assert.deepEqual(
			firstSection?.posts.map((p) => p.slug),
			["an4.2"],
		);
		assert.deepEqual(
			secondSection?.posts.map((p) => p.slug),
			["an4.11", "an4.12"],
		);
	});

	it("keeps empty vagga sections for ref-only chapters", () => {
		const sections = getEffectiveVaggaSections("an4");
		const grouped = groupDiscoursesByVaggaSection(
			[{ slug: "an4.2", title: "2" }],
			sections,
		);
		const refOnlySection = grouped.find((s) => s.slug === "an4.81-90");
		assert.ok(refOnlySection);
		assert.deepEqual(refOnlySection?.posts, []);
		assert.equal(grouped.length, Object.keys(sections ?? {}).length);
	});

	it("builds MN vagga redirect targets to parent paṇṇāsa anchors", () => {
		const redirects = getMnVaggaRedirects();
		assert.equal(redirects["/mn1-10"], "/mn1-50#mn1-10");
		assert.equal(redirects["/mn91-100"], "/mn51-100#mn91-100");
	});
});
