import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askSharePath,
	deriveAskShareSlug,
	normalizeAskShareSlug,
	resolveAskShareSlug,
	sanitizeAskShareSnapshot,
} from "./aiAskShare";

describe("normalizeAskShareSlug", () => {
	it("accepts readable kebab slugs", () => {
		assert.equal(
			normalizeAskShareSlug("Mindfulness of the Body"),
			"mindfulness-of-the-body",
		);
		assert.equal(normalizeAskShareSlug("not-self"), "not-self");
		assert.equal(
			normalizeAskShareSlug("four-foundations-of-mindfulness"),
			"four-foundations-of-mindfulness",
		);
	});

	it("rejects ambiguous or oversized junk", () => {
		assert.equal(normalizeAskShareSlug("ab"), null);
		assert.equal(normalizeAskShareSlug("---"), null);
		assert.equal(
			normalizeAskShareSlug("x".repeat(80))?.length,
			48,
		);
	});
});

describe("deriveAskShareSlug", () => {
	it("prefers lookingFor, then topical words from the question", () => {
		assert.equal(
			deriveAskShareSlug("mindfulness of the body", "what about sati?"),
			"mindfulness-of-the-body",
		);
		assert.equal(
			deriveAskShareSlug("", "What did the Buddha teach about not-self?"),
			"buddha-teach-not-self",
		);
	});
});

describe("resolveAskShareSlug", () => {
	it("uses a valid preferred slug from the model", () => {
		assert.equal(
			resolveAskShareSlug(
				"dependent-arising-and-suffering",
				"craving",
				"how does craving lead to suffering?",
			),
			"dependent-arising-and-suffering",
		);
	});
});

describe("sanitizeAskShareSnapshot", () => {
	it("keeps a public snapshot with results", () => {
		const snap = sanitizeAskShareSnapshot({
			slug: "mindfulness-of-the-body",
			question: "What is mindfulness of the body?",
			lookingFor: "mindfulness of the body",
			queries: ["kāyagatāsati"],
			results: [
				{
					slug: "mn119",
					title: "Mindfulness of the Body",
					description: "…",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn119",
				},
			],
			summary: "These discourses…",
			model: "google/gemma-4-31b-it:free",
			createdAt: 1,
		});
		assert.ok(snap);
		assert.equal(snap?.slug, "mindfulness-of-the-body");
		assert.equal(askSharePath(snap!.slug), "/ask/mindfulness-of-the-body");
	});
});
