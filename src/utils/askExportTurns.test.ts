import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askExportSharePathFromTurns,
	askTurnsForExport,
} from "./askExportTurns";

const hit = {
	slug: "mn10",
	title: "Satipaṭṭhāna",
	description: "The establishments of mindfulness.",
	contentSnippet: null,
	referenceOnly: false,
	href: "/mn10",
};

describe("askTurnsForExport", () => {
	it("includes every successful turn, including references", () => {
		const turns = askTurnsForExport([
			{ question: "Pending", pending: true, results: [hit] },
			{
				question: "What is mindfulness?",
				summary: "MN 10 is the root text.",
				results: [hit],
			},
			{
				question: "A reference hit",
				results: [
					{
						...hit,
						slug: "dn1",
						title: "Brahmajāla",
						referenceOnly: true,
					},
				],
			},
			{ question: "Empty", results: [] },
			{ question: "Errored", error: "nope", results: [hit] },
		]);
		assert.equal(turns.length, 2);
		assert.equal(turns[0]?.question, "What is mindfulness?");
		assert.equal(turns[0]?.discourses[0]?.slug, "mn10");
		assert.equal(turns[1]?.discourses[0]?.isReference, true);
	});
});

describe("askExportSharePathFromTurns", () => {
	it("prefers the current /ask/ URL, then a turn share path", () => {
		assert.equal(
			askExportSharePathFromTurns(
				[{ question: "Q", results: [hit], sharePath: "/ask/from-turn" }],
				"/ask/from-page",
			),
			"/ask/from-page",
		);
		assert.equal(
			askExportSharePathFromTurns([
				{ question: "Q", results: [hit], sharePath: "/ask/from-turn" },
			]),
			"/ask/from-turn",
		);
	});
});
