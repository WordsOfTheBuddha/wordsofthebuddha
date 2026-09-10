import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeDiscourseHits } from "./aiDiscourseHits";
import {
	AI_ASK_SEARCH_OPTIONS,
	AI_SEARCH_CANDIDATE_LIMIT,
	annotateAskSearchHits,
	fallbackQueriesForResultSlugs,
	queriesForResultSlugs,
} from "./aiDiscourseSearch";
import {
	collectDirectDiscourseIds,
	formatDirectDiscourseIds,
	formatPrefixedDiscourseIds,
	isPrefixedAiDiscourseIdOnlyQuery,
	isPrefixedAiDiscourseIdQuery,
	isWeakAiSearchQuery,
	namedTermSearchQueries,
	normalizeAiSearchQuery,
	prefixedAiDiscourseIdsInQuery,
	prefixedAiDiscourseIdsInQueries,
	prefixedAiDiscourseIdsInText,
	queryOccursAsTermInQuestion,
	relaxSearchQuery,
	topicalFallbackQueries,
} from "./aiSearchQuery";

function hit(slug: string): { slug: string; title: string; description: string; contentSnippet: string | null } {
	return {
		slug,
		title: slug,
		description: "",
		contentSnippet: null,
	};
}

describe("AI_SEARCH_CANDIDATE_LIMIT", () => {
	it("is wide enough for Gemini rerank pools", () => {
		assert.ok(AI_SEARCH_CANDIDATE_LIMIT >= 500);
	});
});

describe("AI_ASK_SEARCH_OPTIONS", () => {
	it("requests highlighted snippets so the ranker is not guessing from titles", () => {
		assert.equal(AI_ASK_SEARCH_OPTIONS.includeContent, true);
		assert.equal(AI_ASK_SEARCH_OPTIONS.highlight, true);
	});
});

describe("fallbackQueriesForResultSlugs", () => {
	it("keeps only fallbacks that surfaced a final result", () => {
		assert.deepEqual(
			fallbackQueriesForResultSlugs(
				["self after death", "anatta", "empty miss"],
				[
					{ query: "self", slugs: ["mn72"] },
					{ query: "self after death", slugs: ["mn72", "sn44.10"] },
					{ query: "anatta", slugs: ["mn22"] },
					{ query: "empty miss", slugs: ["dn1"] },
				],
				["mn72", "sn44.10"],
			),
			["self after death"],
		);
	});

	it("returns empty when no fallback contributed", () => {
		assert.deepEqual(
			fallbackQueriesForResultSlugs(
				["broader"],
				[{ query: "broader", slugs: ["dn1"] }],
				["mn10"],
			),
			[],
		);
	});

	it("drops a primary ID chip whose hit the rescorer rejected", () => {
		assert.deepEqual(
			queriesForResultSlugs(
				["householder", "^AN samadhibhavana", "AN 8.41", "DN 31"],
				[
					{ query: "householder", slugs: ["dn31", "an8.54"] },
					{ query: "^an samadhibhavana", slugs: ["an4.41"] },
					{ query: "an8.41", slugs: ["an8.41"] },
					{ query: "dn31", slugs: ["dn31"] },
				],
				["dn31", "an8.54", "an4.41"],
			),
			["householder", "^AN samadhibhavana", "DN 31"],
		);
	});
});

describe("mergeDiscourseHits", () => {
	it("ranks multi-batch hits above single-batch ones (RRF)", () => {
		const merged = mergeDiscourseHits(
			[
				{ query: "anger", hits: [hit("mn2"), hit("sn1.71")] },
				{ query: "kodha", hits: [hit("mn2"), hit("an4.184")] },
			],
			12,
		);
		assert.equal(merged[0]?.slug, "mn2");
		assert.deepEqual(
			new Set(merged.map((item) => item.slug)),
			new Set(["mn2", "sn1.71", "an4.184"]),
		);
	});

	it("breaks score ties by earlier first-seen order", () => {
		const merged = mergeDiscourseHits(
			[
				{ query: "a", hits: [hit("sn1.71")] },
				{ query: "b", hits: [hit("an4.184")] },
			],
			12,
		);
		assert.deepEqual(
			merged.map((item) => item.slug),
			["sn1.71", "an4.184"],
		);
	});

	it("respects the merged limit", () => {
		const merged = mergeDiscourseHits(
			[{ query: "a", hits: [hit("a"), hit("b"), hit("c")] }],
			2,
		);
		assert.deepEqual(
			merged.map((item) => item.slug),
			["a", "b"],
		);
	});
});

describe("normalizeAiSearchQuery", () => {
	it("compacts spaced discourse IDs from the catalog", () => {
		assert.equal(normalizeAiSearchQuery("MN 109"), "mn109");
		assert.equal(normalizeAiSearchQuery("SN 22.82"), "sn22.82");
		assert.equal(normalizeAiSearchQuery("Puṇṇama"), "Puṇṇama");
		assert.equal(isPrefixedAiDiscourseIdQuery("MN 109"), true);
		assert.equal(isPrefixedAiDiscourseIdQuery("full moon night"), false);
	});
});

describe("prefixed discourse ID queries", () => {
	it("treats OR’d IDs as a direct request of each discourse", () => {
		assert.equal(isPrefixedAiDiscourseIdOnlyQuery("SN 12.49 | SN 48.9"), true);
		assert.equal(isPrefixedAiDiscourseIdOnlyQuery("saddhanusari | dhammanusari"), false);
		assert.deepEqual(prefixedAiDiscourseIdsInQuery("SN 12.49 | SN 48.9"), [
			"sn12.49",
			"sn48.9",
		]);
		assert.deepEqual(
			prefixedAiDiscourseIdsInQueries([
				"saddhanusari | dhammanusari",
				"SN 12.49 | SN 48.9",
				"MN 70",
			]),
			["sn12.49", "sn48.9", "mn70"],
		);
		assert.equal(
			formatPrefixedDiscourseIds(["SN 12.49 | SN 48.9", "MN 70"]),
			"SN 12.49, SN 48.9, MN 70",
		);
	});

	it("extracts named IDs from the question without planner query chips", () => {
		const question =
			"Check SN 12.49, SN 12.50, SN 48.53, SN 6.13, nibbedhika in SN 48.9's faculty of wisdom, and MN 70.";
		assert.deepEqual(prefixedAiDiscourseIdsInText(question), [
			"sn12.49",
			"sn12.50",
			"sn48.53",
			"sn6.13",
			"sn48.9",
			"mn70",
		]);
		assert.deepEqual(prefixedAiDiscourseIdsInText("leave it 27 and an extra note"), []);
		assert.deepEqual(
			collectDirectDiscourseIds({
				question,
				queries: ["saddhanusari | dhammanusari"],
			}),
			["sn12.49", "sn12.50", "sn48.53", "sn6.13", "sn48.9", "mn70"],
		);
		assert.equal(
			formatDirectDiscourseIds({ question: "See MN 70 and SN 12.49." }),
			"MN 70, SN 12.49",
		);
	});
});

describe("isWeakAiSearchQuery", () => {
	it("flags full sentences but not short topical queries", () => {
		assert.equal(isWeakAiSearchQuery("mindfulness"), false);
		assert.equal(isWeakAiSearchQuery("SN 22.82"), false);
		assert.equal(
			isWeakAiSearchQuery(
				"I would like for an enumeration of all the other mind fulless coins there are not included",
			),
			true,
		);
	});
});

describe("topicalFallbackQueries", () => {
	it("extracts short terms and repairs common typos", () => {
		const terms = topicalFallbackQueries(
			"mind fulless coins in these dis courses about technique",
		);
		assert.ok(terms.some((term) => /mindfulness|satipa/i.test(term)));
		assert.ok(terms.every((term) => term.split(/\s+/).length <= 3));
	});

	it("seeds satipaṭṭhāna cluster for mindfulness questions", () => {
		const terms = topicalFallbackQueries(
			"I would like an enumeration of other mindfulness kinds and techniques",
		);
		assert.ok(terms.some((term) => /satipa/i.test(term)));
	});
});

describe("relaxSearchQuery", () => {
	it("strips exact quotes and collection prefixes", () => {
		assert.equal(relaxSearchQuery('"letting go"'), "letting go");
		assert.equal(relaxSearchQuery("^SN anger"), "anger");
		assert.equal(relaxSearchQuery("'sammāsati"), "sammāsati");
		assert.equal(relaxSearchQuery("illusion | ignorance"), "illusion ignorance");
		assert.equal(
			relaxSearchQuery("^AN urgency !mindfulness"),
			"urgency mindfulness",
		);
	});
});

describe("queryOccursAsTermInQuestion", () => {
	const question =
		"Share a gloss for vimuttikkhandho based on all the discourses this term appears in";
	const glossFollowUp =
		"But how do I gloss them? If I use: |aggregate of liberation::the realized fact of freedom within the lived body and mind. [vimuttikkhandha]| as the gloss for vimuttikkhandha, what should be the gloss for aggregate of wisdom. And likewise, what should be a gloss for aggregate of collectedness. Cite suttas extensively and compile the glosses based on that.";

	it("matches the named compound, not a stem or English backup", () => {
		assert.equal(queryOccursAsTermInQuestion("vimuttikkhandho", question), true);
		assert.equal(queryOccursAsTermInQuestion("vimutti", question), false);
		assert.equal(queryOccursAsTermInQuestion("liberation", question), false);
		assert.equal(queryOccursAsTermInQuestion("this", question), false);
		assert.deepEqual(
			namedTermSearchQueries(question, [
				"vimuttikkhandho",
				"vimutti khandha",
				"liberation",
			]),
			["vimuttikkhandho"],
		);
	});

	it("matches inflected / bracket lemmas and uses planner termQueries on follow-ups", () => {
		assert.equal(
			queryOccursAsTermInQuestion("vimuttikkhandho", glossFollowUp),
			true,
		);
		assert.equal(
			queryOccursAsTermInQuestion("liberation", glossFollowUp),
			false,
		);
		assert.equal(
			queryOccursAsTermInQuestion("samadikkhandho", glossFollowUp),
			false,
		);
		assert.deepEqual(
			namedTermSearchQueries(
				glossFollowUp,
				[
					"samadikkhandho",
					"pannakkhandho",
					"vimuttikkhandho",
					"^AN",
					"^SN",
					"liberation",
					"vimutti khandha",
				],
				["samadikkhandho", "pannakkhandho", "vimuttikkhandho", "^AN"],
			),
			["samadikkhandho", "pannakkhandho", "vimuttikkhandho"],
		);
	});
});

describe("annotateAskSearchHits", () => {
	it("records matched queries and prefers the named-term snippet", () => {
		const hits = annotateAskSearchHits(
			[
				{
					slug: "sn47.13",
					title: "Cunda",
					description: "grief",
					contentSnippet: "broader liberation snippet",
				},
			],
			[
				{
					query: "vimuttikkhandho",
					hits: [
						{
							slug: "sn47.13",
							title: "Cunda",
							description: "grief",
							contentSnippet: "aggregate of liberation [vimuttikkhandha]",
						},
					],
				},
				{
					query: "liberation",
					hits: [
						{
							slug: "sn47.13",
							title: "Cunda",
							description: "grief",
							contentSnippet: "broader liberation snippet",
						},
					],
				},
			],
			{
				question:
					"Share a gloss for vimuttikkhandho based on all the discourses this term appears in",
				primaryQueries: ["vimuttikkhandho", "liberation"],
			},
		);
		assert.deepEqual(hits[0]?.matchedQueries, ["vimuttikkhandho", "liberation"]);
		assert.match(hits[0]?.contentSnippet || "", /vimuttikkhandha/);
	});
});
