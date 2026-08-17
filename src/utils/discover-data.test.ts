import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	onSlugSearchQuery,
	resolveOnSlugFallback,
} from "./discover-data";

describe("onSlugSearchQuery", () => {
	it("turns hyphenated slugs into a readable query", () => {
		assert.equal(onSlugSearchQuery("personal-existence"), "personal existence");
	});

	it("decodes spaces and collapses separators", () => {
		assert.equal(
			onSlugSearchQuery("personal%20existence"),
			"personal existence",
		);
		assert.equal(onSlugSearchQuery("foo/bar_baz"), "foo bar baz");
	});

	it("returns empty for punctuation-only slugs", () => {
		assert.equal(onSlugSearchQuery("---"), "");
	});
});

describe("resolveOnSlugFallback", () => {
	it("301s a unique stem to the canonical /on/ slug", () => {
		assert.deepEqual(resolveOnSlugFallback("personal-existence"), {
			kind: "on",
			slug: "personal-existence-view",
		});
		assert.deepEqual(resolveOnSlugFallback("personal existence"), {
			kind: "on",
			slug: "personal-existence-view",
		});
	});

	it("resolves an exact quality slug", () => {
		assert.deepEqual(resolveOnSlugFallback("personal-existence-view"), {
			kind: "on",
			slug: "personal-existence-view",
		});
	});

	it("does not 301 when several slugs share the stem", () => {
		assert.deepEqual(resolveOnSlugFallback("right"), {
			kind: "search",
			query: "right",
		});
	});

	it("falls back to search when nothing unique matches", () => {
		assert.deepEqual(resolveOnSlugFallback("no-such-on-page-xyz"), {
			kind: "search",
			query: "no such on page xyz",
		});
	});

	it("returns not-found for an empty slug", () => {
		assert.deepEqual(resolveOnSlugFallback("---"), { kind: "not-found" });
		assert.deepEqual(resolveOnSlugFallback("   "), { kind: "not-found" });
	});
});
