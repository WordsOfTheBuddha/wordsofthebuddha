import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	normalizePersonMatchKey,
	personMatchKeys,
	personQuestionKeys,
	questionNamesPerson,
	resolveAskPersonHits,
	sanitizeAskPersonHits,
} from "./aiAskPersons";

const FULL_MOON_ASK =
	"A discourses where the Buddha talks about a special occasion for awakening, I think in reference to a certain special full moon. It sounded a bit magical for him to make this reference. He was in conversation with other bhikkhus on this topic. Can you help find it?";

const DEITY_MOON = {
	slug: "moon",
	title: "Deity Moon",
	description: "",
	discourseIds: ["sn2.9", "an4.17"],
	sampleDescription: "",
};

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

	it("does not show a planner person the question never named", () => {
		const hits = resolveAskPersonHits({
			personSlugs: ["suciloma"],
			lookingFor: "yakkha scares the Buddha",
			queries: ["suciloma", "yakkha", "alavaka"],
			correctedQuestion:
				"discourses about two spirits talking with the Buddha trying to scare him",
		});
		assert.equal(hits.length, 0);
	});

	it("does not match a person from query chips or lookingFor alone", () => {
		const hits = resolveAskPersonHits({
			lookingFor: "Sakka",
			queries: ["sakka"],
			fallbackQueries: ["sakka lord of the gods"],
			correctedQuestion:
				"How should one practice mindfulness of breathing in daily life?",
		});
		assert.equal(hits.length, 0);
	});

	it("does not attach Deity Moon to a full-moon / puṇṇama / Bhaddekaratta ask", () => {
		const hits = resolveAskPersonHits({
			correctedQuestion: FULL_MOON_ASK,
			lookingFor: "Bhaddekaratta full moon",
			queries: ["MN 131", "Bhaddekaratta", "^MN puṇṇama"],
			personSlugs: ["moon"],
		});
		assert.equal(
			hits.some((hit) => hit.slug === "moon" || /moon/i.test(hit.title)),
			false,
		);
	});

	it("attaches Deity Moon when the question names that figure or Candimā", () => {
		const questions = [
			"Who is Deity Moon?",
			"discourses with the Moon deity",
			"Who is the Moon god?",
			"Who is Candimā?",
			"Tell me about Candimasa",
			"Who is the Moon?",
		];
		for (const correctedQuestion of questions) {
			const hits = resolveAskPersonHits({ correctedQuestion });
			assert.ok(
				hits.some((hit) => hit.slug === "moon"),
				`expected Deity Moon for: ${correctedQuestion}`,
			);
		}
	});
});

describe("questionNamesPerson", () => {
	it("requires the name in the question text", () => {
		const sakka = {
			slug: "sakka-lord-of-the-gods",
			title: "Sakka, Lord of the Gods",
			description: "",
			discourseIds: ["dn21"],
			sampleDescription: "",
		};
		assert.equal(questionNamesPerson("Who is Sakka?", sakka), true);
		assert.equal(
			questionNamesPerson("discourses with Sakka", sakka),
			true,
		);
		assert.equal(
			questionNamesPerson("two spirits try to scare the Buddha", sakka),
			false,
		);
		assert.equal(
			questionNamesPerson(
				"two spirits talking with the Buddha trying to scare him",
				{
					slug: "buddha-kassapa",
					title: "Buddha Kassapa",
					description: "",
					discourseIds: [],
					sampleDescription: "",
				},
			),
			false,
		);
	});

	it("does not treat incidental moon / puṇṇama wording as Deity Moon", () => {
		assert.equal(questionNamesPerson(FULL_MOON_ASK, DEITY_MOON), false);
		assert.equal(
			questionNamesPerson(
				"Is this the Bhaddekaratta sutta about a special full moon or puṇṇama?",
				DEITY_MOON,
			),
			false,
		);
		assert.equal(questionNamesPerson("Who is Deity Moon?", DEITY_MOON), true);
		assert.equal(questionNamesPerson("Who is Candimā?", DEITY_MOON), true);
		assert.equal(
			questionNamesPerson("discourses with the Moon deity", DEITY_MOON),
			true,
		);
	});
});

describe("personQuestionKeys", () => {
	it("keeps distinctive Moon-deity names and drops bare moon", () => {
		const keys = personQuestionKeys(DEITY_MOON);
		assert.equal(keys.includes("moon"), false);
		assert.ok(keys.includes("deity moon"));
		assert.ok(keys.includes("moon deity"));
		assert.ok(keys.includes("candima"));
		assert.ok(keys.includes("candimasa"));
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
