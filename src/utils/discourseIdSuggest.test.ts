import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	compactDiscourseIdQuery,
	isDiscourseIdPrefix,
	isDiscourseIdQuery,
	shortDiscourseTitle,
	splitDiscourseTitle,
	suggestDiscourses,
	uniqueExactDiscourse,
	type DiscourseSuggestEntry,
} from "./discourseIdSuggest";

const entries: DiscourseSuggestEntry[] = [
	{ slug: "mn1", title: "Mūlapariyāyasutta - The Root Sequence", referenceOnly: false },
	{ slug: "mn10", title: "Satipaṭṭhānasutta - Establishments of Mindfulness", referenceOnly: false },
	{ slug: "mn11", title: "Cūḷasīhanādasutta - The Shorter Discourse on the Lion’s Roar", referenceOnly: false },
	{ slug: "mn100", title: "Saṅgāravasutta - With Saṅgārava", referenceOnly: true },
	{ slug: "an6.1", title: "Āhuneyyasutta - Worthy of Offerings", referenceOnly: false },
	{ slug: "an6.2", title: "Sāraṇīyasutta", referenceOnly: false },
	{ slug: "an6.10", title: "Mahānāmasutta", referenceOnly: false },
	{ slug: "an6.12", title: "Sāraṇīyasutta", referenceOnly: true },
	{ slug: "an60", title: "Fake", referenceOnly: false },
	{ slug: "dn1", title: "Brahmajālasutta - The Prime Net", referenceOnly: true },
	{ slug: "dn10", title: "Subhasutta", referenceOnly: false },
	{ slug: "iti4", title: "Kodhasutta - Anger", referenceOnly: false },
	{ slug: "iti40", title: "Vijjāsutta", referenceOnly: false },
	{ slug: "iti41", title: "Paññāsutta", referenceOnly: false },
	{ slug: "sn4.41", title: "Somadattasutta", referenceOnly: false },
	{ slug: "an4.41", title: "Samādhibhāvanāsutta - Accomplishment in Wise Attention", referenceOnly: false },
	{ slug: "sn10.1", title: "Indakasutta", referenceOnly: false },
	{ slug: "sn1.1", title: "Oghataraṇa sutta - Crossing the Flood", referenceOnly: false },
	{ slug: "sn1.10", title: "Arañña sutta - Wilderness", referenceOnly: false },
	{ slug: "an1.1-10", title: "Cittapariyādāna vagga", referenceOnly: false },
	{ slug: "sn36.3", title: "Pahāna sutta - Abandoned", referenceOnly: false },
	{ slug: "sn36.31", title: "Nirāmisasutta", referenceOnly: false },
	{ slug: "ud1.1", title: "Bodhisutta", referenceOnly: false },
	{ slug: "snp1.1", title: "Uragasutta", referenceOnly: false },
];

describe("compactDiscourseIdQuery", () => {
	it("accepts spaced and compact IDs", () => {
		assert.equal(compactDiscourseIdQuery("MN 10"), "mn10");
		assert.equal(compactDiscourseIdQuery("an6"), "an6");
		assert.equal(compactDiscourseIdQuery("AN 6.12"), "an6.12");
		assert.equal(compactDiscourseIdQuery("sn12.2"), "sn12.2");
		assert.equal(compactDiscourseIdQuery("36.3"), "36.3");
		assert.equal(compactDiscourseIdQuery("36. 3"), "36.3");
		assert.equal(compactDiscourseIdQuery("10"), "10");
	});

	it("rejects terms and collection-only input", () => {
		assert.equal(compactDiscourseIdQuery("mettā"), null);
		assert.equal(compactDiscourseIdQuery("an"), null);
		assert.equal(compactDiscourseIdQuery("radical attention"), null);
		assert.equal(isDiscourseIdQuery("MN 10"), true);
		assert.equal(isDiscourseIdQuery("36.3"), true);
		assert.equal(isDiscourseIdQuery("yoniso"), false);
	});
});

describe("isDiscourseIdPrefix", () => {
	it("does not treat mn10 as a prefix of mn100", () => {
		assert.equal(isDiscourseIdPrefix("mn100", "mn10"), false);
		assert.equal(isDiscourseIdPrefix("mn11", "mn1"), false);
	});

	it("treats an6 as a prefix of an6.1, not an60", () => {
		assert.equal(isDiscourseIdPrefix("an6.1", "an6"), true);
		assert.equal(isDiscourseIdPrefix("an60", "an6"), false);
	});

	it("allows last-segment growth after a dotted query", () => {
		assert.equal(isDiscourseIdPrefix("an6.12", "an6.1"), true);
		assert.equal(isDiscourseIdPrefix("an6.2", "an6.1"), false);
	});
});

describe("suggestDiscourses", () => {
	it("pins exact MN 10 first and still offers MN 100 as a number continuation", () => {
		const hits = suggestDiscourses(entries, "MN 10");
		assert.equal(hits[0]?.slug, "mn10");
		assert.equal(hits[0]?.exact, true);
		assert.ok(hits.some((hit) => hit.slug === "mn100"));
		assert.equal(hits.find((hit) => hit.slug === "mn100")?.exact, false);
	});

	it("lists AN 6.* for prefix AN6, native before later refs, not AN 60", () => {
		const hits = suggestDiscourses(entries, "AN6");
		assert.deepEqual(
			hits.map((hit) => hit.slug),
			["an6.1", "an6.2", "an6.10", "an6.12"],
		);
		assert.equal(hits.find((hit) => hit.slug === "an6.12")?.referenceOnly, true);
	});

	it("continues undotted numbers: MN 1 lists MN 1 then MN 10, MN 11", () => {
		const hits = suggestDiscourses(entries, "MN 1");
		assert.deepEqual(
			hits.map((hit) => hit.slug),
			["mn1", "mn10", "mn11", "mn100"],
		);
		assert.equal(hits[0]?.exact, true);
		assert.equal(hits[1]?.exact, false);
	});

	it("continues undotted numbers for Iti 4", () => {
		const hits = suggestDiscourses(entries, "iti4");
		assert.deepEqual(
			hits.map((hit) => hit.slug),
			["iti4", "iti40", "iti41"],
		);
	});

	it("does not treat AN 1 as a prefix of AN 10.*", () => {
		const withAn1: DiscourseSuggestEntry[] = [
			...entries,
			{ slug: "an10.1", title: "Saddhāsutta", referenceOnly: false },
		];
		const hits = suggestDiscourses(withAn1, "AN1");
		assert.ok(hits.some((hit) => hit.slug === "an1.1-10"));
		assert.ok(!hits.some((hit) => hit.slug === "an10.1"));
	});

	it("surfaces reference-only DN 1 as an exact hit", () => {
		const hits = suggestDiscourses(entries, "dn1");
		assert.equal(hits[0]?.slug, "dn1");
		assert.equal(hits[0]?.referenceOnly, true);
		assert.equal(hits[0]?.href, "/dn1");
	});

	it("matches numeral-only IDs across collections, exact first", () => {
		const hits = suggestDiscourses(entries, "36.3");
		assert.deepEqual(
			hits.map((hit) => hit.slug),
			["sn36.3", "sn36.31"],
		);
		assert.equal(hits[0]?.exact, true);
		assert.equal(hits[0]?.idLabel, "SN 36.3");
		assert.equal(hits[1]?.exact, false);
	});

	it("lists every collection that shares a dotted number", () => {
		const hits = suggestDiscourses(entries, "4.41");
		assert.deepEqual(
			hits.map((hit) => hit.slug),
			["sn4.41", "an4.41"],
		);
		assert.equal(hits.every((hit) => hit.exact), true);
	});

	it("pins exact undotted numbers before other collections' chapter listings", () => {
		const hits = suggestDiscourses(entries, "10");
		assert.equal(hits[0]?.slug, "mn10");
		assert.equal(hits[0]?.exact, true);
		assert.ok(hits.some((hit) => hit.slug === "sn10.1"));
		assert.ok(!hits.some((hit) => hit.slug === "mn100"));
	});

	it("surfaces range files after exacts and before last-segment growth", () => {
		const hits = suggestDiscourses(entries, "1.1");
		assert.deepEqual(
			hits.map((hit) => hit.slug),
			["sn1.1", "snp1.1", "ud1.1", "an1.1-10", "sn1.10"],
		);
		assert.equal(hits.find((hit) => hit.slug === "an1.1-10")?.exact, true);
		assert.equal(hits.find((hit) => hit.slug === "sn1.10")?.exact, false);
	});

	it("matches in-between and end boundary values inside a range file", () => {
		assert.deepEqual(
			suggestDiscourses(entries, "1.8").map((hit) => hit.slug),
			["an1.1-10"],
		);
		assert.deepEqual(
			suggestDiscourses(entries, "1.10").map((hit) => hit.slug),
			["sn1.10", "an1.1-10"],
		);
		assert.deepEqual(
			suggestDiscourses(entries, "an1.8").map((hit) => hit.slug),
			["an1.1-10"],
		);
		assert.deepEqual(
			suggestDiscourses(entries, "an1.10").map((hit) => hit.slug),
			["an1.1-10"],
		);
	});
});

describe("uniqueExactDiscourse", () => {
	it("returns the exact native hit for Enter", () => {
		const hit = uniqueExactDiscourse(entries, "mn 10");
		assert.equal(hit?.slug, "mn10");
		assert.equal(hit?.idLabel, "MN 10");
		assert.equal(hit?.shortTitle, "Establishments of Mindfulness");
	});

	it("returns the unique numeral hit when only one collection has that number", () => {
		const hit = uniqueExactDiscourse(entries, "36.3");
		assert.equal(hit?.slug, "sn36.3");
		assert.equal(hit?.idLabel, "SN 36.3");
	});

	it("returns null when more than one collection has that numeral", () => {
		assert.equal(uniqueExactDiscourse(entries, "4.41"), null);
		assert.equal(uniqueExactDiscourse(entries, "10"), null);
	});

	it("returns null for a prefix-only query", () => {
		assert.equal(uniqueExactDiscourse(entries, "an6"), null);
	});
});

describe("shortDiscourseTitle", () => {
	it("uses the English side of a dashed title", () => {
		assert.equal(
			shortDiscourseTitle("Satipaṭṭhānasutta - Establishments of Mindfulness"),
			"Establishments of Mindfulness",
		);
	});
});

describe("splitDiscourseTitle", () => {
	it("splits dashed native titles", () => {
		assert.deepEqual(
			splitDiscourseTitle("Satipaṭṭhānasutta - Establishments of Mindfulness"),
			{ pali: "Satipaṭṭhānasutta", english: "Establishments of Mindfulness" },
		);
	});

	it("treats undashed sutta names as Pāli-only", () => {
		assert.deepEqual(splitDiscourseTitle("Sāraṇīyasutta"), {
			pali: "Sāraṇīyasutta",
			english: "",
		});
	});

	it("treats spaced undashed titles as English-only", () => {
		assert.deepEqual(splitDiscourseTitle("With Saṅgārava"), {
			pali: "",
			english: "With Saṅgārava",
		});
	});
});

describe("suggestDiscourses title search", () => {
	it("matches a Pāli title prefix without diacritics", () => {
		const hits = suggestDiscourses(entries, "satipatthana");
		assert.equal(hits[0]?.slug, "mn10");
		assert.equal(hits[0]?.paliTitle, "Satipaṭṭhānasutta");
		assert.equal(hits[0]?.englishTitle, "Establishments of Mindfulness");
	});

	it("matches an English title word prefix", () => {
		const hits = suggestDiscourses(entries, "establishments");
		assert.equal(hits[0]?.slug, "mn10");
	});

	it("does not steal ID matching when the query is ID-shaped", () => {
		const hits = suggestDiscourses(entries, "mn10");
		assert.equal(hits[0]?.slug, "mn10");
		assert.equal(hits[0]?.exact, true);
	});

	it("keeps a title hit as further words are typed", () => {
		const withPhrase: DiscourseSuggestEntry[] = [
			...entries,
			{
				slug: "an4.41",
				title: "Samādhibhāvanāsutta - Accomplishment in Wise Attention",
				referenceOnly: false,
			},
		];
		assert.equal(suggestDiscourses(withPhrase, "att")[0]?.slug, "an4.41");
		assert.equal(suggestDiscourses(withPhrase, "wise att")[0]?.slug, "an4.41");
		assert.equal(
			suggestDiscourses(withPhrase, "wise attention")[0]?.slug,
			"an4.41",
		);
		assert.equal(
			suggestDiscourses(withPhrase, "accomplishment wise")[0]?.slug,
			"an4.41",
		);
	});

	it("does not match query words out of title order", () => {
		const withPhrase: DiscourseSuggestEntry[] = [
			...entries,
			{
				slug: "an4.41",
				title: "Samādhibhāvanāsutta - Accomplishment in Wise Attention",
				referenceOnly: false,
			},
		];
		assert.ok(
			!suggestDiscourses(withPhrase, "attention wise").some(
				(hit) => hit.slug === "an4.41",
			),
		);
	});
});
