import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	normalizePersonMatchKey,
	personMatchKeys,
	resolveAskPersonHits,
	sanitizeAskPersonHits,
} from "./aiAskPersons";

describe("normalizePersonMatchKey", () => {
	it("folds diacritics and punctuation", () => {
		assert.equal(normalizePersonMatchKey("Venerable Ānanda"), "venerable ananda");
		assert.equal(normalizePersonMatchKey("Sakka, Lord of the Gods"), "sakka lord of the gods");
	});
});

describe("resolveAskPersonHits", () => {
	it("matches Sakka from a short query", () => {
		const hits = resolveAskPersonHits({
			correctedQuestion: "Who is Sakka?",
			lookingFor: "Sakka",
			queries: ["sakka"],
		});
		assert.ok(hits.length >= 1);
		assert.ok(hits.some((hit) => hit.slug.includes("sakka")));
		assert.ok(hits[0]?.href.startsWith("/on/"));
		assert.ok(hits[0]?.title);
		assert.ok(hits[0]?.description);
	});

	it("matches from an explicit person slug", () => {
		const hits = resolveAskPersonHits({
			personSlugs: ["ananda"],
			queries: ["mindfulness"],
			correctedQuestion:
				"What did Ananda remember about the Buddha’s last days?",
		});
		assert.equal(hits[0]?.slug, "ananda");
		assert.match(hits[0]?.title || "", /Ānanda|Ananda/i);
	});

	it("does not match a long unrelated question without person probes", () => {
		const hits = resolveAskPersonHits({
			correctedQuestion:
				"How should one practice mindfulness of breathing in daily life?",
			lookingFor: "mindfulness of breathing",
			queries: ["anapanasati", "mindfulness of breathing"],
		});
		assert.equal(hits.length, 0);
	});
});

describe("personMatchKeys", () => {
	it("includes slug head and title before comma", () => {
		const keys = personMatchKeys({
			slug: "sakka-lord-of-the-gods",
			title: "Sakka, Lord of the Gods",
			description: "",
			discourseIds: ["dn21"],
			sampleDescription: "",
		});
		assert.ok(keys.includes("sakka"));
		assert.ok(keys.includes("sakka lord of the gods"));
	});
});

describe("sanitizeAskPersonHits", () => {
	it("keeps well-formed person cards only", () => {
		const hits = sanitizeAskPersonHits([
			{
				slug: "ananda",
				title: "Venerable Ānanda",
				description: "Foremost in learning.",
				discourseCount: 58,
				sampleIds: ["DN 16", "MN 26"],
				href: "/on/ananda",
			},
			{ slug: "bad", title: "Bad", href: "/mn10" },
		]);
		assert.equal(hits.length, 1);
		assert.equal(hits[0]?.slug, "ananda");
		assert.deepEqual(hits[0]?.sampleIds, ["DN 16", "MN 26"]);
	});
});
