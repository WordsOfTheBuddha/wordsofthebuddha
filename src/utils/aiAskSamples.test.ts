import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_SAMPLE_NOTE,
	ASK_SAMPLE_PLAYBACK,
	askSampleConfirmMessage,
	askSampleKeyFingerprint,
	askSampleMatchesQuestion,
	askSamplePlaybackPatch,
	canMarkAskAsSample,
	deriveAskSampleSlug,
	findAskSample,
	findAskSampleForExample,
	sanitizeAskSamplePublic,
	upsertAskSampleLocal,
} from "./aiAskSamples";

const HIT = {
	slug: "mn119",
	title: "Mindfulness of the Body",
	description: "",
	contentSnippet: null,
	referenceOnly: false,
	href: "/mn119",
};

function sample(question: string, slug?: string) {
	return sanitizeAskSamplePublic({
		slug: slug || deriveAskSampleSlug(question),
		question,
		questionKey: question.replace(/\s+/g, " ").trim().toLowerCase(),
		lookingFor: "after death",
		queries: ["death"],
		fallbackQueries: [],
		summary: "These discourses treat what follows death for an uninstructed person.",
		results: [HIT],
		model: "test",
		updatedAt: 1,
	});
}

describe("deriveAskSampleSlug", () => {
	it("slugifies the full question, not a short theme", () => {
		assert.equal(
			deriveAskSampleSlug(
				"What happens after death for an ordinary person?",
			),
			"what-happens-after-death-for-an-ordinary-person",
		);
	});

	it("falls back to a fingerprint when the question has no usable words", () => {
		const key = "???";
		assert.equal(deriveAskSampleSlug(key), `ask-${askSampleKeyFingerprint("???")}`);
	});
});

describe("findAskSample", () => {
	const afterDeath = sample(
		"What happens after death for an ordinary person?",
	)!;

	it("hydrates only when the chip text matches the stored question", () => {
		assert.equal(
			findAskSample(
				[afterDeath],
				"What happens after death for an ordinary person?",
			),
			afterDeath,
		);
		assert.equal(
			findAskSample(
				[afterDeath],
				"  What happens after death for an ordinary person?  ",
			),
			afterDeath,
		);
	});

	it("does not hydrate after the chip wording changes", () => {
		assert.equal(
			findAskSample(
				[afterDeath],
				"What happens after death for a worldling?",
			),
			null,
		);
		assert.equal(
			askSampleMatchesQuestion(
				afterDeath,
				"What happens after death for a worldling?",
			),
			false,
		);
	});

	it("hydrates a research sample only on the Research pane", () => {
		const report = sample("Survey how the discourses describe feeling")!;
		report.research = true;
		report.report = "## Feeling";
		assert.equal(
			findAskSampleForExample([report], report.question, { research: false }),
			null,
		);
		assert.equal(
			findAskSampleForExample([report], report.question, { research: true })
				?.report,
			"## Feeling",
		);
	});

	it("does not hydrate an Ask sample as Research", () => {
		assert.equal(
			findAskSampleForExample(
				[afterDeath],
				"What happens after death for an ordinary person?",
				{ researchChipOn: true },
			),
			null,
		);
		assert.ok(
			findAskSampleForExample(
				[afterDeath],
				"What happens after death for an ordinary person?",
				{ researchChipOn: false },
			),
		);
	});
});

describe("canMarkAskAsSample", () => {
	it("is only for allowlisted admins on a finished live Ask", () => {
		assert.equal(
			canMarkAskAsSample({
				isAdmin: true,
				resultCount: 3,
			}),
			true,
		);
		assert.equal(
			canMarkAskAsSample({
				isAdmin: false,
				resultCount: 3,
			}),
			false,
		);
		assert.equal(
			canMarkAskAsSample({
				isAdmin: true,
				resultCount: 3,
				fromSample: true,
			}),
			false,
		);
		assert.equal(
			canMarkAskAsSample({
				isAdmin: true,
				resultCount: 3,
				research: true,
			}),
			false,
		);
		assert.equal(
			canMarkAskAsSample({
				isAdmin: true,
				resultCount: 3,
				research: true,
				hasReport: true,
			}),
			true,
		);
		assert.equal(
			canMarkAskAsSample({
				isAdmin: true,
				resultCount: 0,
			}),
			false,
		);
	});
});

describe("askSampleConfirmMessage", () => {
	it("warns when replacing an existing example", () => {
		assert.match(askSampleConfirmMessage(false), /does not use their Ask credits/);
		assert.match(askSampleConfirmMessage(true), /Replace the current example/);
		assert.match(
			askSampleConfirmMessage(false, { research: true }),
			/does not use their Research credits/,
		);
	});
});

describe("upsertAskSampleLocal", () => {
	it("replaces the same questionKey", () => {
		const first = sample("Where does the Buddha answer on a full-moon night?")!;
		const second = sample("Where does the Buddha answer on a full-moon night?")!;
		second.summary = "A later run.";
		const next = upsertAskSampleLocal([first], second);
		assert.equal(next.length, 1);
		assert.equal(next[0]?.summary, "A later run.");
	});
});

describe("ask sample playback", () => {
	it("holds the process steps for a few seconds before revealing hits", () => {
		assert.equal(ASK_SAMPLE_PLAYBACK[0]?.phase, "rewrite");
		assert.equal(ASK_SAMPLE_PLAYBACK.at(-1)?.phase, "done");
		assert.equal(ASK_SAMPLE_PLAYBACK.at(-1)?.atMs, 3000);
		const demo = sample("What happens after death for an ordinary person?")!;
		demo.lookingFor = "after death";
		demo.candidateCount = 40;
		const rewrite = askSamplePlaybackPatch(demo, "rewrite");
		assert.equal(rewrite.pending, true);
		assert.equal(rewrite.results.length, 0);
		assert.equal(rewrite.lookingFor, "");
		const search = askSamplePlaybackPatch(demo, "search");
		assert.equal(search.pending, true);
		assert.equal(search.lookingFor, "after death");
		assert.equal(search.results.length, 0);
		const done = askSamplePlaybackPatch(demo, "done");
		assert.equal(done.pending, false);
		assert.equal(done.results.length, 1);
		assert.match(ASK_SAMPLE_NOTE, /illustrative response from a prior ask/);
	});
});
