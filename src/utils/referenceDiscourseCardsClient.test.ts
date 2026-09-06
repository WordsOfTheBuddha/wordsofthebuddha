import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { referenceEntriesToAppend } from "./referenceEntriesToAppend";

describe("referenceEntriesToAppend", () => {
	const entries = [
		{ slug: "mn35" },
		{ slug: "sn22.88" },
	];

	it("keeps SSR reference cards instead of treating them as native EN slugs", () => {
		const nativeSlugs = new Set<string>();
		const shownRefSlugs = new Set(["mn35", "sn22.88"]);
		assert.deepEqual(
			referenceEntriesToAppend(entries, nativeSlugs, shownRefSlugs),
			[],
		);
	});

	it("appends refs after they have been removed by See Refs off", () => {
		assert.deepEqual(
			referenceEntriesToAppend(entries, new Set(), new Set()),
			entries,
		);
	});

	it("does not append a reference that already has a native card", () => {
		assert.deepEqual(
			referenceEntriesToAppend(
				entries,
				new Set(["mn35"]),
				new Set<string>(),
			).map((entry) => entry.slug),
			["sn22.88"],
		);
	});
});
