import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	finishResearchReportLength,
	requestedResearchReportWords,
	researchReportExceedsWordHint,
	researchReportLengthGuidance,
	RESEARCH_REPORT_LENGTH_GUIDANCE,
	RESEARCH_REPORT_LENGTH_NOTE,
	RESEARCH_REPORT_LENGTH_NOTE_MD,
	RESEARCH_REPORT_WORD_HINT_MAX,
	stripResearchReportLengthNote,
	withResearchReportLengthNote,
} from "./aiAskResearchReportLength";

describe("requestedResearchReportWords", () => {
	it("reads comma, k, and thousand forms", () => {
		assert.equal(requestedResearchReportWords("a 10,000 word report"), 10_000);
		assert.equal(requestedResearchReportWords("write 10000 words"), 10_000);
		assert.equal(requestedResearchReportWords("a 10k-word survey"), 10_000);
		assert.equal(requestedResearchReportWords("about 10 thousand words"), 10_000);
		assert.equal(requestedResearchReportWords("20 000 words on vedanā"), 20_000);
		assert.equal(requestedResearchReportWords("a 50,000-word treatment"), 50_000);
	});

	it("keeps the largest request across strings", () => {
		assert.equal(
			requestedResearchReportWords(
				"also 10k words",
				"make it 20,000 words",
			),
			20_000,
		);
	});

	it("ignores counts that are not word counts", () => {
		assert.equal(requestedResearchReportWords("mindfulness of breathing"), 0);
		assert.equal(requestedResearchReportWords("10,000 discourses on feeling"), 0);
		assert.equal(requestedResearchReportWords("AN 10.60"), 0);
		assert.equal(requestedResearchReportWords("in other words, MN 10"), 0);
	});

	it("treats 8,000 as in-band and anything above as over the hint", () => {
		assert.equal(requestedResearchReportWords("8,000 words"), 8_000);
		assert.equal(requestedResearchReportWords("8k words"), 8_000);
		assert.equal(researchReportExceedsWordHint("8,000 words"), false);
		assert.equal(researchReportExceedsWordHint("8,001 words"), true);
		assert.equal(researchReportExceedsWordHint("10,000 word report"), true);
		assert.ok(RESEARCH_REPORT_WORD_HINT_MAX === 8_000);
	});
});

describe("researchReportLengthGuidance", () => {
	it("is empty unless they asked for more than one pass can hold", () => {
		assert.equal(researchReportLengthGuidance("vedanā in the nikāyas"), "");
		assert.equal(researchReportLengthGuidance("a 5,000 word report"), "");
		assert.equal(
			researchReportLengthGuidance("a 20,000 word report"),
			RESEARCH_REPORT_LENGTH_GUIDANCE,
		);
	});
});

describe("research report length note", () => {
	it("prepends once and strips for a later rewrite", () => {
		const body = "## Attention\n\nMN 10 sets out the establishments.";
		const once = withResearchReportLengthNote(body);
		assert.equal(once.startsWith(RESEARCH_REPORT_LENGTH_NOTE_MD), true);
		assert.equal(withResearchReportLengthNote(once), once);
		assert.equal(stripResearchReportLengthNote(once), body);
	});

	it("adds the note only when the request is over the hint", () => {
		const body = "## Attention\n\nMN 10 sets out the establishments.";
		assert.equal(
			finishResearchReportLength(body, {
				question: "mindfulness of the body",
			}),
			body,
		);
		const long = finishResearchReportLength(body, {
			question: "10,000 word report on mindfulness of the body",
		});
		assert.match(long, new RegExp(RESEARCH_REPORT_LENGTH_NOTE));
		assert.match(long, /## Attention/);
		assert.equal(
			finishResearchReportLength("", {
				question: "50,000 words on feeling",
			}),
			"",
		);
	});

	it("still sees the request on the original wording after a rewrite", () => {
		const body = "## Feeling\n\nSN 36.1 lists kinds of feeling.";
		const finished = finishResearchReportLength(body, {
			question: "What does the Buddha say about feeling?",
			originalQuestion: "Write a 20,000 word report on feeling",
		});
		assert.match(finished, new RegExp(RESEARCH_REPORT_LENGTH_NOTE));
	});
});
