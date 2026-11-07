import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import yaml from "js-yaml";
import {
	automationKeyForText,
	discourseCountLabel,
	extractGlossHits,
	glossLineDistinctFromLabel,
	mergeEncyclopediaItems,
	mergeHumanOverlay,
	overlayItemsFromDocument,
	queryEncyclopedia,
} from "./encyclopedia";
import { normalizeEncyclopediaPathname } from "./encyclopediaPath";
import type { EncyclopediaEntry, EncyclopediaItem } from "../types/encyclopedia";

describe("extractGlossHits", () => {
	it("reads bracketed Pāli, skips vocatives and markdown links, and keeps the discourse", () => {
		const source = `---
title: "Two Things"
slug: an2.3
---

|Bhikkhus,::::| |desire::aspiration, goal [chanda]| and |lust::intense desire [rāga, lobha]|.
|mindfulness::four foundations. [Read more in MN 10](/mn10) [cattāro + satipaṭṭhānā]|
|Dhamma::teachings of the Buddha [dhamma]::dah-muh|
`;
		const hits = extractGlossHits(source);
		const norms = hits.map((hit) => hit.norm).sort();
		assert.deepEqual(norms, [
			"cattaro + satipatthana",
			"chanda",
			"dhamma",
			"lobha",
			"raga",
		]);

		const chanda = hits.find((hit) => hit.norm === "chanda");
		assert.equal(chanda?.discourseId, "an2.3");
		assert.equal(chanda?.discourseTitle, "Two Things");
		assert.equal(chanda?.label, "desire");
		assert.equal(chanda?.gloss, "aspiration, goal [chanda]");
		assert.equal(chanda?.pali, "chanda");

		const dhamma = hits.find((hit) => hit.norm === "dhamma");
		assert.equal(dhamma?.gloss, "teachings of the Buddha [dhamma]");
		assert.equal(dhamma?.gloss.includes("dah-muh"), false);

		assert.equal(
			hits.some((hit) => hit.norm.includes("read") || hit.label.startsWith("Bhikkhus")),
			false,
		);
		assert.equal(
			automationKeyForText("Intense desire [rāga]"),
			automationKeyForText("intense desire [raga]"),
		);
	});
});

describe("mergeEncyclopediaItems", () => {
	it("does not clobber a human sense and updates occurrences on its own sense", () => {
		const human: EncyclopediaItem = {
			id: "h1",
			origin: "human",
			source: "editor",
			automationKey: "human gloss",
			gloss: "kept as written [chanda]",
			occurrences: [{ id: "mn1", title: "Human" }],
		};
		const previous: EncyclopediaItem = {
			id: "a1",
			origin: "automation",
			source: "tooltip",
			automationKey: "auto gloss",
			gloss: "auto [chanda]",
			occurrences: [{ id: "an1", title: "Old" }],
		};
		const clobber: EncyclopediaItem = {
			id: "nope",
			origin: "automation",
			source: "tooltip",
			automationKey: "human gloss",
			gloss: "OVERWRITE",
			occurrences: [{ id: "sn1", title: "Nope" }],
		};
		const updated: EncyclopediaItem = {
			id: "a2",
			origin: "automation",
			source: "tooltip",
			automationKey: "auto gloss",
			gloss: "auto [chanda]",
			occurrences: [
				{ id: "an1", title: "Old" },
				{ id: "an2", title: "New" },
			],
		};
		const added: EncyclopediaItem = {
			id: "a3",
			origin: "automation",
			source: "tooltip",
			automationKey: "third gloss",
			gloss: "third [chanda]",
			occurrences: [{ id: "sn9", title: "Added" }],
		};

		const merged = mergeEncyclopediaItems(
			[clobber, updated, added],
			[human, previous],
		);

		assert.equal(
			merged.find((item) => item.automationKey === "human gloss"),
			human,
		);
		const auto = merged.find((item) => item.automationKey === "auto gloss");
		assert.equal(auto?.id, "a1");
		assert.deepEqual(
			auto?.occurrences?.map((occurrence) => occurrence.id),
			["an1", "an2"],
		);
		assert.equal(
			merged.some((item) => item.automationKey === "third gloss"),
			true,
		);
		assert.equal(merged.length, 3);
	});

	it("keeps the committed chanda overlay when automation repeats that key", () => {
		const file = path.join(
			process.cwd(),
			"src/data/encyclopedia/chanda.yaml",
		);
		const parsed = overlayItemsFromDocument(
			yaml.load(readFileSync(file, "utf8")),
			"chanda",
		);
		assert.ok(parsed);
		assert.equal(parsed.norm, "chanda");
		assert.equal(parsed.items[0]?.origin, "human");
		assert.equal(
			parsed.items[0]?.gloss,
			"a wholesome motivation to act [chanda]",
		);

		const entry: EncyclopediaEntry = {
			norm: "chanda",
			pali: "chanda",
			labels: ["aspiration"],
			kind: "topic",
			status: "seeded",
			related: [{ slug: "desire", kind: "topic", title: "Desire" }],
			dictionary: null,
			items: [
				{
					id: "tooltip:auto",
					origin: "automation",
					source: "tooltip",
					automationKey: "aspiration goal [chanda]",
					gloss: "aspiration, goal [chanda]",
					occurrences: [{ id: "sn51.15", title: "Uṇṇābha" }],
				},
			],
		};
		const attack: EncyclopediaItem = {
			id: "tooltip:human",
			origin: "automation",
			source: "tooltip",
			automationKey: parsed.items[0].automationKey,
			gloss: "OVERWRITE",
			occurrences: [{ id: "mn1", title: "Nope" }],
		};
		const once = mergeHumanOverlay(
			{ ...entry, items: [...entry.items, attack] },
			parsed.items,
		);
		const human = once.items.find((item) => item.origin === "human");
		assert.equal(human?.gloss, "a wholesome motivation to act [chanda]");
		assert.equal(
			once.items.some((item) => item.gloss === "OVERWRITE"),
			false,
		);
		assert.equal(
			once.items.some((item) => item.automationKey === "aspiration goal [chanda]"),
			true,
		);
		assert.equal(once.status, "reviewed");
		assert.equal(once.kind, "topic");
		assert.equal(once.labels[0], "desire");

		const twice = mergeHumanOverlay(once, parsed.items);
		assert.equal(
			twice.items.filter((item) => item.origin === "human").length,
			1,
		);
	});
});

describe("normalizeEncyclopediaPathname", () => {
	it("keeps term URLs and pulls directory indexes off the search catch-all", () => {
		assert.equal(
			normalizeEncyclopediaPathname("/encyclopedia/chanda"),
			"/encyclopedia/chanda",
		);
		assert.equal(
			normalizeEncyclopediaPathname("/encyclopedia/chanda/"),
			"/encyclopedia/chanda",
		);
		assert.equal(
			normalizeEncyclopediaPathname("/encyclopedia/chanda/index.html"),
			"/encyclopedia/chanda",
		);
		assert.equal(
			normalizeEncyclopediaPathname("/encyclopedia/index.html"),
			"/encyclopedia",
		);
		assert.equal(
			normalizeEncyclopediaPathname("/Encyclopedia/chanda"),
			"/encyclopedia/chanda",
		);
		assert.equal(
			normalizeEncyclopediaPathname("encyclopedia/chanda/index.html"),
			"/encyclopedia/chanda",
		);
		assert.equal(
			normalizeEncyclopediaPathname("/encylopedia"),
			"/encyclopedia",
		);
		assert.equal(
			normalizeEncyclopediaPathname("/encylopedia/chanda"),
			"/encyclopedia/chanda",
		);
		assert.equal(normalizeEncyclopediaPathname("/mn10"), null);
	});
});

describe("queryEncyclopedia", () => {
	it("pages the list and clamps a page past the end", () => {
		const entries: Record<string, EncyclopediaEntry> = {};
		for (let i = 0; i < 5; i++) {
			entries[`t${i}`] = {
				norm: `t${i}`,
				pali: `t${i}`,
				labels: [],
				kind: "term",
				status: "raw",
				related: [],
				dictionary: null,
				items: [],
			};
		}
		const index = { version: 1 as const, entries };
		const page = queryEncyclopedia(index, { limit: 2, page: 2 });
		assert.equal(page.total, 5);
		assert.equal(page.page, 2);
		assert.equal(page.pageCount, 3);
		assert.equal(page.offset, 2);
		assert.deepEqual(
			page.results.map((item) => item.norm),
			["t2", "t3"],
		);
		const clamped = queryEncyclopedia(index, { limit: 2, page: 9 });
		assert.equal(clamped.page, 3);
		assert.deepEqual(
			clamped.results.map((item) => item.norm),
			["t4"],
		);
		assert.equal(discourseCountLabel(1), "1 discourse");
		assert.equal(discourseCountLabel(65), "65 discourses");
		assert.equal(glossLineDistinctFromLabel("desire", "desire"), false);
		assert.equal(
			glossLineDistinctFromLabel("desire", "a wholesome motivation to act"),
			true,
		);
	});
});
