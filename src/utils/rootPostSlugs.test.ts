import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isRootPostCandidate,
	parsePostSlugFromGlobPath,
	slugIsRootPost,
} from "./rootPostSlugs";

describe("parsePostSlugFromGlobPath", () => {
	it("strips a pages-relative glob path", () => {
		assert.equal(
			parsePostSlugFromGlobPath("./posts/mindfulness.mdx"),
			"mindfulness",
		);
	});

	it("strips a utils-relative glob path and .md", () => {
		assert.equal(
			parsePostSlugFromGlobPath("../pages/posts/fire-draft.md"),
			"fire-draft",
		);
	});
});

describe("isRootPostCandidate", () => {
	it("allows a published post slug", () => {
		assert.equal(
			isRootPostCandidate("fire", { isDiscourse: false }),
			true,
		);
	});

	it("allows a frontmatter draft when includeDrafts is true", () => {
		assert.equal(
			isRootPostCandidate("mindfulness", {
				draft: true,
				includeDrafts: true,
				isDiscourse: false,
			}),
			true,
		);
	});

	it("hides a frontmatter draft from the sitemap when includeDrafts is false", () => {
		assert.equal(
			isRootPostCandidate("mindfulness", {
				draft: true,
				includeDrafts: false,
				isDiscourse: false,
			}),
			false,
		);
	});

	it("never serves -draft or -testcases filenames at the root", () => {
		assert.equal(
			isRootPostCandidate("fire-draft", { isDiscourse: false }),
			false,
		);
		assert.equal(
			isRootPostCandidate("fire-testcases", { isDiscourse: false }),
			false,
		);
	});

	it("never collides with a discourse id", () => {
		assert.equal(
			isRootPostCandidate("mn10", { isDiscourse: true }),
			false,
		);
	});
});

describe("slugIsRootPost", () => {
	const posts = [
		{ slug: "fire", draft: false },
		{ slug: "mindfulness", draft: true },
		{ slug: "fire-draft", draft: false },
	];

	it("lets a draft post claim /mindfulness so /on/mindfulness stays the quality page", () => {
		assert.equal(
			slugIsRootPost("mindfulness", posts, {
				includeDrafts: true,
				discourseSlugs: [],
			}),
			true,
		);
	});

	it("does not treat an unknown slug as a post", () => {
		assert.equal(
			slugIsRootPost("collectedness", posts, {
				includeDrafts: true,
				discourseSlugs: [],
			}),
			false,
		);
	});
});
