import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DiscourseSuggestHit } from "./discourseIdSuggest";
import {
	composeNavSuggestions,
	dedupePageEntries,
	hasCatalogKindFilter,
	matchPageEntries,
	normalizePageKey,
	SITE_PAGE_SUGGESTIONS,
	type PageSuggestEntry,
} from "./pageSuggest";

function discourse(
	slug: string,
	title: string,
	exact = false,
): DiscourseSuggestHit {
	return {
		slug,
		title,
		referenceOnly: false,
		idLabel: slug.toUpperCase(),
		paliTitle: "",
		englishTitle: title,
		shortTitle: title,
		href: `/${slug}`,
		exact,
	};
}

const fireEssay: PageSuggestEntry = {
	kind: "essay",
	title: "Fire: Investigating Recurrent Experience",
	href: "/fire",
	aliases: ["fire"],
};

const mindfulnessEssay: PageSuggestEntry = {
	kind: "essay",
	title: "What You Might Not Know About Mindfulness & Sati",
	href: "/mindfulness",
	aliases: ["mindfulness"],
};

const mindfulnessTopic: PageSuggestEntry = {
	kind: "topic",
	title: "Mindfulness",
	href: "/on/mindfulness",
	aliases: ["sati"],
};

const cravingQuality: PageSuggestEntry = {
	kind: "quality",
	title: "Craving",
	href: "/on/craving",
	aliases: ["tanha"],
};

const raftSimile: PageSuggestEntry = {
	kind: "simile",
	title: "Raft",
	href: "/on/raft",
	aliases: [],
};

const diligenceQuality: PageSuggestEntry = {
	kind: "quality",
	title: "Diligence",
	href: "/on/diligence",
	aliases: [],
};

const radicalAttentionTopic: PageSuggestEntry = {
	kind: "topic",
	title: "Radical Attention",
	href: "/on/radical-attention",
	aliases: [],
};

const solitudeQuality: PageSuggestEntry = {
	kind: "quality",
	title: "Solitude",
	href: "/on/solitude",
	aliases: ["privacy", "seclusion"],
};

const gangesSimile: PageSuggestEntry = {
	kind: "simile",
	title: "Ganges River",
	href: "/on/ganges-river",
	aliases: [],
};

const privacyPage: PageSuggestEntry = {
	kind: "page",
	title: "Privacy Policy",
	href: "/privacy",
	aliases: ["privacy"],
};

const similesIndex: PageSuggestEntry = {
	kind: "page",
	title: "Similes",
	href: "/simile",
	aliases: ["simile"],
};

const supportPage: PageSuggestEntry = {
	kind: "page",
	title: "Support",
	href: "/support",
	aliases: ["give", "gift", "donate"],
};

const discoverPage: PageSuggestEntry = {
	kind: "page",
	title: "Discover",
	href: "/discover",
	aliases: ["explore"],
};

const anthology: PageSuggestEntry = {
	kind: "page",
	title: "In the Buddha's Words",
	href: "/anthologies/in-the-buddhas-words",
	aliases: ["in the buddhas words"],
	label: "Anthology",
};

const pages: PageSuggestEntry[] = [
	fireEssay,
	mindfulnessEssay,
	mindfulnessTopic,
	cravingQuality,
	diligenceQuality,
	radicalAttentionTopic,
	solitudeQuality,
	raftSimile,
	gangesSimile,
	supportPage,
	discoverPage,
	privacyPage,
	similesIndex,
	anthology,
];

describe("normalizePageKey", () => {
	it("drops apostrophes and punctuation", () => {
		assert.equal(
			normalizePageKey("In the Buddha's Words"),
			"in the buddhas words",
		);
		assert.equal(
			normalizePageKey("Fire: Investigating Recurrent Experience"),
			"fire investigating recurrent experience",
		);
	});
});

describe("dedupePageEntries", () => {
	it("keeps the topic when a quality shares the same href", () => {
		const deduped = dedupePageEntries([
			{
				kind: "quality",
				title: "Mindfulness",
				href: "/on/mindfulness",
				aliases: [],
			},
			mindfulnessTopic,
		]);
		assert.equal(deduped.length, 1);
		assert.equal(deduped[0]?.kind, "topic");
	});
});

describe("composeNavSuggestions", () => {
	it("puts matching essays above discourses", () => {
		const items = composeNavSuggestions(
			"fire",
			[discourse("sn35.28", "Adittapariyaya - The Fire Sermon")],
			pages,
		);
		assert.deepEqual(
			items.map((item) =>
				item.type === "page" ? item.hit.href : item.hit.slug,
			),
			["/fire", "sn35.28"],
		);
	});

	it("matches an essay by a later title word", () => {
		const items = composeNavSuggestions("investigating", [], pages);
		assert.equal(items[0]?.type, "page");
		assert.equal(items[0]?.hit.href, "/fire");
	});

	it("shows an exact topic after a single discourse match", () => {
		const items = composeNavSuggestions(
			"craving",
			[discourse("sn22.31", "Craving")],
			pages,
		);
		assert.deepEqual(
			items.map((item) =>
				item.type === "page" ? item.hit.href : item.hit.slug,
			),
			["sn22.31", "/on/craving"],
		);
	});

	it("shows an exact catalog page when no discourse matches", () => {
		const items = composeNavSuggestions("raft", [], pages);
		assert.equal(items.length, 1);
		assert.equal(items[0]?.type, "page");
		assert.equal(items[0]?.hit.href, "/on/raft");
		assert.equal(items[0]?.hit.kindLabel, "Simile");
	});

	it("shows an exact catalog page after four discourse matches", () => {
		const items = composeNavSuggestions(
			"craving",
			[
				discourse("sn22.31", "Craving"),
				discourse("an4.199", "Craving"),
				discourse("iti58", "Craving"),
				discourse("sn1.63", "Craving"),
			],
			pages,
		);
		assert.deepEqual(
			items.map((item) =>
				item.type === "page" ? item.hit.href : item.hit.slug,
			),
			["sn22.31", "an4.199", "iti58", "sn1.63", "/on/craving"],
		);
	});

	it("hides catalog pages when more than four discourses match", () => {
		const items = composeNavSuggestions(
			"mindfulness",
			[
				discourse("mn10", "Establishments of Mindfulness"),
				discourse("sn47.1", "Mindfulness"),
				discourse("sn47.2", "Mindful"),
				discourse("mn118", "Mindfulness of Breathing"),
				discourse("an8.81", "Mindfulness"),
			],
			pages,
		);
		assert.deepEqual(
			items.map((item) =>
				item.type === "page" ? item.hit.href : item.hit.slug,
			),
			["/mindfulness", "mn10", "sn47.1", "sn47.2", "mn118", "an8.81"],
		);
	});

	it("surfaces a quality when the query includes quality or topic", () => {
		const many = [
			discourse("sn3.17", "Diligence"),
			discourse("sn3.18", "Diligence"),
			discourse("an10.15", "Diligence"),
			discourse("iti22", "Diligence"),
			discourse("dhp21", "Diligence"),
		];
		const qualityFirst = composeNavSuggestions("quality diligence", many, pages);
		assert.ok(
			qualityFirst.some(
				(item) => item.type === "page" && item.hit.href === "/on/diligence",
			),
		);
		const qualityLast = composeNavSuggestions("diligence quality", many, pages);
		assert.ok(
			qualityLast.some(
				(item) => item.type === "page" && item.hit.href === "/on/diligence",
			),
		);
	});

	it("surfaces a topic named in a topic/quality query", () => {
		const many = [
			discourse("mn2", "All the Taints"),
			discourse("mn10", "Establishments of Mindfulness"),
			discourse("sn47.1", "Mindfulness"),
			discourse("an4.41", "Wise Attention"),
			discourse("an10.61", "Ignorance"),
		];
		const items = composeNavSuggestions(
			"radical attention topic",
			many,
			pages,
		);
		assert.ok(
			items.some(
				(item) =>
					item.type === "page" && item.hit.href === "/on/radical-attention",
			),
		);
	});

	it("treats quality: and topic: prefixes like spaced kind hints", () => {
		const many = [
			discourse("mn2", "All the Taints"),
			discourse("mn10", "Establishments of Mindfulness"),
			discourse("sn47.1", "Mindfulness"),
			discourse("an4.41", "Wise Attention"),
			discourse("an10.61", "Ignorance"),
		];
		for (const query of [
			"quality:radical",
			"topic:radical",
			"quality: radical",
		]) {
			const items = composeNavSuggestions(query, many, pages);
			assert.ok(
				items.some(
					(item) =>
						item.type === "page" &&
						item.hit.href === "/on/radical-attention",
				),
				`expected Radical Attention for ${query}`,
			);
		}
	});

	it("still shows the essay when catalog pages are suppressed", () => {
		const items = composeNavSuggestions(
			"mindfulness",
			[
				discourse("mn10", "Establishments of Mindfulness"),
				discourse("sn47.1", "Mindfulness"),
				discourse("sn47.2", "Mindful"),
				discourse("mn118", "Mindfulness of Breathing"),
				discourse("an8.81", "Mindfulness"),
			],
			pages,
		);
		assert.equal(items[0]?.type, "page");
		assert.equal(items[0]?.hit.kind, "essay");
		assert.ok(!items.some((item) => item.type === "page" && item.hit.kind === "topic"));
	});

	it("shows exact site pages after discourses", () => {
		const items = composeNavSuggestions(
			"support",
			[discourse("an5.148", "Gifts of a True Person")],
			pages,
		);
		assert.deepEqual(
			items.map((item) =>
				item.type === "page" ? item.hit.href : item.hit.slug,
			),
			["an5.148", "/support"],
		);
	});

	it("shows Discover on the explore alias", () => {
		const items = composeNavSuggestions("explore", [], pages);
		assert.equal(items[0]?.type, "page");
		assert.equal(items[0]?.hit.href, "/discover");
	});

	it("shows Support on give, gift, and donate aliases", () => {
		for (const query of ["give", "gift", "donate"]) {
			const items = composeNavSuggestions(
				query,
				[],
				SITE_PAGE_SUGGESTIONS,
			);
			assert.equal(items[0]?.type, "page", query);
			assert.equal(items[0]?.hit.href, "/support", query);
			assert.equal(items[0]?.hit.title, "Support", query);
		}
	});

	it("matches an anthology title without the apostrophe", () => {
		const items = composeNavSuggestions("in the buddhas words", [], pages);
		assert.equal(items[0]?.type, "page");
		assert.equal(items[0]?.hit.href, "/anthologies/in-the-buddhas-words");
		assert.equal(items[0]?.hit.kindLabel, "Anthology");
	});

	it("shows the privacy page alongside a synonym quality", () => {
		const items = composeNavSuggestions("privacy", [], pages);
		assert.deepEqual(
			items.map((item) =>
				item.type === "page" ? `${item.hit.kindLabel} ${item.hit.href}` : item.hit.slug,
			),
			["Quality /on/solitude", "Page /privacy"],
		);
	});

	it("shows Public Domain and Offline site pages", () => {
		const publicDomain = composeNavSuggestions(
			"public domain",
			[],
			SITE_PAGE_SUGGESTIONS,
		);
		assert.equal(publicDomain[0]?.type, "page");
		assert.equal(publicDomain[0]?.hit.href, "/public-domain");

		const offline = composeNavSuggestions("offline", [], SITE_PAGE_SUGGESTIONS);
		assert.equal(offline[0]?.type, "page");
		assert.equal(offline[0]?.hit.href, "/offline");
	});

	it("does not prefix-match catalog or site pages at 4 characters", () => {
		assert.deepEqual(composeNavSuggestions("supp", [], pages), []);
		assert.deepEqual(composeNavSuggestions("crav", [], pages), []);
		assert.deepEqual(composeNavSuggestions("soli", [], pages), []);
		assert.deepEqual(composeNavSuggestions("gang", [], pages), []);
	});

	it("prefix-matches filtered quality/topic queries from 3 characters", () => {
		assert.deepEqual(composeNavSuggestions("rad", [], pages), []);
		assert.deepEqual(composeNavSuggestions("radi", [], pages), []);

		const filtered = composeNavSuggestions("quality:rad", [], pages);
		assert.ok(
			filtered.some(
				(item) =>
					item.type === "page" && item.hit.href === "/on/radical-attention",
			),
		);
		const simile = composeNavSuggestions("simile:raf", [], pages);
		assert.ok(
			simile.some(
				(item) => item.type === "page" && item.hit.href === "/on/raft",
			),
		);
	});

	it("prefix-matches catalog pages from 5 characters", () => {
		const solitude = composeNavSuggestions("solit", [], pages);
		assert.equal(solitude[0]?.type, "page");
		assert.equal(solitude[0]?.hit.href, "/on/solitude");
		assert.equal(solitude[0]?.hit.kindLabel, "Quality");

		const ganges = composeNavSuggestions("gange", [], pages);
		assert.equal(ganges[0]?.type, "page");
		assert.equal(ganges[0]?.hit.href, "/on/ganges-river");
		assert.equal(ganges[0]?.hit.kindLabel, "Simile");

		const theRaft = composeNavSuggestions("the raft", [], pages);
		assert.equal(theRaft[0]?.type, "page");
		assert.equal(theRaft[0]?.hit.href, "/on/raft");
	});

	it("shows the similes index after discourse title hits", () => {
		const items = composeNavSuggestions(
			"simile",
			[discourse("mn22", "Simile of the Water Snake")],
			pages,
		);
		assert.equal(items[0]?.type, "discourse");
		assert.equal(items[1]?.type, "page");
		assert.equal(items[1]?.hit.href, "/simile");
	});

	it("shows the qualities index for topic and topics queries", () => {
		const topics = composeNavSuggestions(
			"topics",
			[],
			SITE_PAGE_SUGGESTIONS,
		);
		assert.equal(topics[0]?.type, "page");
		assert.equal(topics[0]?.hit.href, "/qualities");

		const topic = composeNavSuggestions("topic", [], SITE_PAGE_SUGGESTIONS);
		assert.equal(topic[0]?.type, "page");
		assert.equal(topic[0]?.hit.href, "/qualities");
	});

	it("detects quality/topic/simile filters so token suggestions stay off", () => {
		assert.equal(hasCatalogKindFilter("quality:rad"), true);
		assert.equal(hasCatalogKindFilter("topic radical"), true);
		assert.equal(hasCatalogKindFilter("radical"), false);
	});

	it("leaves ID-shaped queries as discourse-only", () => {
		const items = composeNavSuggestions(
			"mn10",
			[discourse("mn10", "Establishments of Mindfulness", true)],
			pages,
		);
		assert.equal(items.length, 1);
		assert.equal(items[0]?.type, "discourse");
	});

	it("does not treat a pali alias as an exact catalog hit unless the query is exact", () => {
		assert.deepEqual(composeNavSuggestions("tanh", [], pages), []);
		const items = composeNavSuggestions("tanha", [], pages);
		assert.equal(items[0]?.type, "page");
		assert.equal(items[0]?.hit.href, "/on/craving");
	});
});

describe("matchPageEntries", () => {
	it("requires exact catalog matches in exact mode", () => {
		const queryNorm = normalizePageKey("mindfulness");
		const hits = matchPageEntries(pages, queryNorm, {
			kinds: ["topic", "quality", "simile"],
			mode: "exact",
		});
		assert.deepEqual(
			hits.map((hit) => hit.href),
			["/on/mindfulness"],
		);
	});
});
