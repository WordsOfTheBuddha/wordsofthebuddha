import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	MAX_ASK_EXPORT_DISCOURSES,
	askExportCollectionUrl,
	parseAskExportRequest,
	sanitizeAskExportSharePath,
} from "./askExportRequest";

describe("parseAskExportRequest", () => {
	it("keeps turn order and dedupes slugs within a turn", () => {
		const parsed = parseAskExportRequest({
			turns: [
				{
					question: "What is mindfulness?",
					summary: "Start with MN 10.",
					selectedDiscourseSlugs: ["MN10", "mn10", "sn47.1"],
				},
				{
					question: "And daily life?",
					selectedDiscourseSlugs: ["sn47.19"],
				},
			],
		});
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.value.turns.length, 2);
		assert.deepEqual(parsed.value.turns[0]?.selectedDiscourseSlugs, [
			"mn10",
			"sn47.1",
		]);
		assert.equal(parsed.value.turns[1]?.question, "And daily life?");
	});

	it("drops turns with no discourses and requires at least one", () => {
		const empty = parseAskExportRequest({
			turns: [{ question: "Hi", selectedDiscourseSlugs: [] }],
		});
		assert.equal(empty.ok, false);
		if (empty.ok) return;
		assert.match(empty.error, /at least one discourse/);

		const mixed = parseAskExportRequest({
			turns: [
				{ question: "Skip", selectedDiscourseSlugs: [] },
				{ question: "Keep", selectedDiscourseSlugs: ["ud1.1"] },
			],
		});
		assert.equal(mixed.ok, true);
		if (!mixed.ok) return;
		assert.equal(mixed.value.turns.length, 1);
		assert.equal(mixed.value.turns[0]?.question, "Keep");
	});

	it("rejects oversized discourse lists", () => {
		const slugs = Array.from(
			{ length: MAX_ASK_EXPORT_DISCOURSES + 1 },
			(_, i) => `mn${i + 1}`,
		);
		const parsed = parseAskExportRequest({
			turns: [{ question: "All", selectedDiscourseSlugs: slugs }],
		});
		assert.equal(parsed.ok, false);
	});

	it("keeps research markdown instead of flattening it to Ask prose", () => {
		const parsed = parseAskExportRequest({
			kind: "research",
			turns: [
				{
					question: "Who is a trainee?",
					summary: "## Thesis\n\nSee **MN 53**.\n\n- one\n- two",
					selectedDiscourseSlugs: ["mn53"],
				},
			],
		});
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.value.kind, "research");
		assert.match(parsed.value.turns[0]?.summary || "", /## Thesis/);
		assert.match(parsed.value.turns[0]?.summary || "", /\n- one\n/);
	});

	it("allows a research report with no discourses", () => {
		const parsed = parseAskExportRequest({
			kind: "research",
			turns: [
				{
					question: "What is sati?",
					summary: "## Thesis\n\nMindfulness is established.",
					selectedDiscourseSlugs: [],
				},
			],
		});
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.value.turns.length, 1);
		assert.deepEqual(parsed.value.turns[0]?.selectedDiscourseSlugs, []);
		assert.match(parsed.value.turns[0]?.summary || "", /## Thesis/);
	});

	it("rejects a research request with neither report nor discourses", () => {
		const parsed = parseAskExportRequest({
			kind: "research",
			turns: [{ question: "Empty", selectedDiscourseSlugs: [] }],
		});
		assert.equal(parsed.ok, false);
		if (parsed.ok) return;
		assert.match(parsed.error, /Nothing to download/);
	});
});

describe("sanitizeAskExportSharePath", () => {
	it("accepts public Ask paths and Ask home", () => {
		assert.equal(
			sanitizeAskExportSharePath("/ask/mindfulness-of-the-body"),
			"/ask/mindfulness-of-the-body",
		);
		assert.equal(
			sanitizeAskExportSharePath("/research/yonisomanasikara"),
			"/research/yonisomanasikara",
		);
		assert.equal(sanitizeAskExportSharePath("/search?mode=ai"), "/search?mode=ask");
		assert.equal(sanitizeAskExportSharePath("/search?mode=ask"), "/search?mode=ask");
		assert.equal(
			sanitizeAskExportSharePath("/search?mode=research"),
			"/search?mode=research",
		);
		assert.equal(sanitizeAskExportSharePath("/mn10"), undefined);
		assert.equal(sanitizeAskExportSharePath("https://evil.example/"), undefined);
	});
});

describe("askExportCollectionUrl", () => {
	it("uses the share path when present", () => {
		assert.equal(
			askExportCollectionUrl("/ask/mindfulness-of-the-body"),
			"www.wordsofthebuddha.org/ask/mindfulness-of-the-body",
		);
		assert.equal(
			askExportCollectionUrl(),
			"www.wordsofthebuddha.org/search?mode=ask",
		);
		assert.equal(
			askExportCollectionUrl(undefined, "research"),
			"www.wordsofthebuddha.org/search?mode=research",
		);
	});
});
