import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createCombinedMarkdown, toSmartQuotes } from "./contentParser";
import { transformId } from "./transformId";
import {
	compareBilaraSegmentKeys,
	filterReferenceSegmentPairs,
	hasSegmentMarkers,
	parseReferenceSegmentContent,
	parseSegmentMarkedBody,
	segmentKeyToSectionHeading,
} from "./referenceSegmentParser";
import {
	compareSegmentKeys,
	markedBlocksToBody,
	orderedContentKeys,
	segmentsToMarkedBlocks,
	stripBilaraMarkup,
} from "../../scripts/import-sc-bilara.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "../../.cache/bilara-data");

function loadBilaraFixture(id: string) {
	const findJson = (root: string, suffix: string) => {
		const stack = [root];
		while (stack.length) {
			const dir = stack.pop()!;
			for (const name of readdirSync(dir)) {
				const full = path.join(dir, name);
				if (statSync(full).isDirectory()) stack.push(full);
				else if (name === `${id}${suffix}`) {
					return JSON.parse(readFileSync(full, "utf-8"));
				}
			}
		}
		throw new Error(`fixture not found: ${id}${suffix}`);
	};
	return {
		pli: findJson(
			path.join(CACHE_DIR, "root/pli/ms/sutta"),
			"_root-pli-ms.json",
		),
		en: findJson(
			path.join(CACHE_DIR, "translation/en/sujato/sutta"),
			"_translation-en-sujato.json",
		),
	};
}

function buildMarkedBodies(id: string) {
	const { pli, en } = loadBilaraFixture(id);
	const pliBody = markedBlocksToBody(segmentsToMarkedBlocks(pli));
	const enBody = markedBlocksToBody(
		segmentsToMarkedBlocks(en, { includeEmpty: true }),
	);
	return { pliBody, enBody };
}

describe("referenceSegmentParser", () => {
	it("segmentKeyToSectionHeading formats full discourse numbers", () => {
		assert.equal(
			segmentKeyToSectionHeading("an2.180-184:1.0"),
			"#### 2.180\u2013184",
		);
		assert.equal(
			segmentKeyToSectionHeading("an1.576-582:1.0"),
			"#### 1.576\u2013582",
		);
		assert.equal(segmentKeyToSectionHeading("an2.11:1.0"), "#### 2.11");
		assert.equal(segmentKeyToSectionHeading("an2.11:1.1"), null);
	});

	it("detects segment markers", () => {
		assert.equal(
			hasSegmentMarkers("<!-- @segment an4.101:1.1 -->\n\nHello"),
			true,
		);
		assert.equal(hasSegmentMarkers("Plain paragraph text"), false);
	});

	it("round-trips segment markers", () => {
		const body =
			"<!-- @segment an4.101:1.1 -->\n\nFirst\n\n<!-- @segment an4.101:1.2 -->\n\nSecond";
		const parsed = parseSegmentMarkedBody(body);
		assert.deepEqual(parsed, [
			{ key: "an4.101:1.1", text: "First" },
			{ key: "an4.101:1.2", text: "Second" },
		]);
	});

	it("an4.101 pairs by segment key without index drift", () => {
		const { pliBody, enBody } = buildMarkedBodies("an4.101");
		const pairs = parseReferenceSegmentContent(
			{ body: pliBody },
			{ body: enBody },
			toSmartQuotes,
		);

		const pliSegmentCount = orderedContentKeys(loadBilaraFixture("an4.101").pli)
			.map((key) => stripBilaraMarkup(loadBilaraFixture("an4.101").pli[key]))
			.filter(
				(text) =>
					text &&
					!/^(Paṭhama|Dutiya|Tatiya|Catuttha|Pañcama|Chaṭṭha|Sattama|Aṭṭhama|Navama|Dasama|Ekādasama)\.(ṁ)?$/.test(
						text.trim(),
					),
			).length;

		assert.equal(pairs.length, pliSegmentCount);

		const pair35 = pairs.find((pair) =>
			pair.pali?.includes("tathūpamāhaṁ, bhikkhave, imaṁ puggalaṁ"),
		);
		assert.ok(pair35);
		assert.equal(pair35!.english, "");
		assert.match(
			pairs.find((pair) => pair.english.includes("doer, not a talker"))!
				.pali!,
			/kattā hoti, no bhāsitā/,
		);
	});

	it("split layout emits spacers for empty English segments", () => {
		const { pliBody, enBody } = buildMarkedBodies("an4.101");
		const pairs = parseReferenceSegmentContent(
			{ body: pliBody },
			{ body: enBody },
			toSmartQuotes,
		);
		const split = createCombinedMarkdown(pairs, true, "split");
		assert.match(split.english, /english-pair-spacer/);
		const spacerCount = (
			split.english.match(/class="english-paragraph english-pair-spacer"/g) ||
			[]
		).length;
		const emptyEnCount = pairs.filter((p) => !p.english.trim()).length;
		assert.equal(spacerCount, emptyEnCount);
	});

	it("an2.180-229 groups nested peyyāla segments by sutta prefix", () => {
		const { pli } = loadBilaraFixture("an2.180-229");
		const keys = orderedContentKeys(pli);
		assert.equal(keys[0], "an2.180-184:1.0");
		assert.equal(keys[1], "an2.180-184:1.1");
		assert.equal(keys[4], "an2.180-184:1.4");
		assert.equal(keys[5], "an2.185-189:1.0");
		assert.equal(compareSegmentKeys("an2.180-184:1.1", "an2.185-189:1.0"), -1);

		const { pliBody, enBody } = buildMarkedBodies("an2.180-229");
		const pairs = parseReferenceSegmentContent(
			{ body: pliBody },
			{ body: enBody },
			toSmartQuotes,
		);
		const firstGroup = pairs.slice(0, 5).map((pair) => pair.english.trim());
		assert.equal(firstGroup[0], "#### 2.180\u2013184");
		assert.match(firstGroup[1], /There are these two things/);
		assert.equal(firstGroup[2], "What two?");
		assert.match(firstGroup[3], /Anger and acrimony/);
		assert.match(firstGroup[4], /These are the two things/);
		assert.equal(
			parseSegmentMarkedBody(pliBody)[1].key,
			"an2.180-184:1.1",
		);
	});

	it("compareBilaraSegmentKeys preserves single-sutta key order", () => {
		const keys = orderedContentKeys(loadBilaraFixture("an4.101").pli);
		const sorted = [...keys].sort(compareBilaraSegmentKeys);
		assert.deepEqual(keys, sorted);
	});

	it("filterReferenceSegmentPairs supports partial discourse URLs", () => {
		const { pliBody, enBody } = buildMarkedBodies("an2.180-229");
		const pairs = parseReferenceSegmentContent(
			{ body: pliBody },
			{ body: enBody },
			toSmartQuotes,
		);
		const fullRef = transformId("an2.180-229");

		const section = filterReferenceSegmentPairs(pairs, {
			sectionNumber: "2.180",
			fullRef,
			hrf: "an2.180",
		});
		assert.equal(section[0]?.english, "#### 2.180\u2013184");
		assert.match(section[1]?.english ?? "", /There are these two things/);
		assert.match(section.at(-1)?.english ?? "", /View full text for:/);

		const range = filterReferenceSegmentPairs(pairs, {
			discourseRange: { start: "2.185", end: "2.189" },
			fullRef,
			hrf: "an2.185-189",
		});
		assert.equal(range[0]?.english, "#### 2.185\u2013189");
	});
});
