import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAskDebugView,
	formatAskDebugDevHtml,
} from "./aiAskDebug";

describe("buildAskDebugView", () => {
	it("caps dropped named-term hits and counts the rest", () => {
		const hits = Array.from({ length: 20 }, (_, index) => ({
			slug: `sn1.${index + 1}`,
			rank: index + 10,
			snippet: index % 2 === 0,
			kept: false,
		}));
		const debug = buildAskDebugView({
			coverage: "brief",
			limit: 10,
			reasoning: "",
			planningNotes: "",
			rankingGuidance: "Keep exact vimuttikkhandho hits.",
			namedTermQueries: ["vimuttikkhandho"],
			namedTermHits: hits,
		});
		assert.equal(debug.namedTermHits, 20);
		assert.equal(debug.namedTermKept, 0);
		assert.equal(debug.dropped.length, 16);
		assert.equal(debug.droppedMore, 4);
		assert.equal(debug.reasoningChars, 0);
		assert.match(debug.rankingGuidancePreview || "", /exact vimuttikkhandho/);
	});
});

describe("formatAskDebugDevHtml", () => {
	it("renders think coverage and dropped ranks", () => {
		const html = formatAskDebugDevHtml(
			buildAskDebugView({
				coverage: "brief",
				limit: 10,
				reasoning: "",
				namedTermQueries: ["vimuttikkhandho"],
				namedTermHits: [
					{
						slug: "sn47.13",
						rank: 214,
						snippet: true,
						kept: false,
					},
					{
						slug: "dn33",
						rank: 180,
						snippet: false,
						kept: false,
					},
				],
			}),
		);
		assert.match(html, /think 0c/);
		assert.match(html, /coverage=brief/);
		assert.match(html, /term vimuttikkhandho/);
		assert.match(html, /kept 0/);
		assert.match(html, /SN 47\.13@214/);
		assert.match(html, /DN 33@180\(no-passage\)/);
	});

	it("returns empty when debug is missing", () => {
		assert.equal(formatAskDebugDevHtml(undefined), "");
	});
});
