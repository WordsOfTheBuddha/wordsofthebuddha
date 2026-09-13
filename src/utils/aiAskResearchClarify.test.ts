import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	canStartResearchClarify,
	formatResearchClarifyBrief,
	parseResearchClarify,
	parseResearchClarifyAnswers,
	RESEARCH_CLARIFY_MAX_OTHER,
	RESEARCH_CLARIFY_NO_PREF_ID,
	RESEARCH_CLARIFY_OTHER_ID,
	RESEARCH_CLARIFY_SYSTEM,
	RESEARCH_DECLINE_OFF_CORPUS,
	researchClarifyAnswersOutOfScope,
} from "./aiAskResearchClarify";

describe("parseResearchClarify", () => {
	it("reads in-scope questions and appends Other and No preference", () => {
		const parsed = parseResearchClarify(
			JSON.stringify({
				inScope: true,
				questions: [
					{
						id: "focus",
						prompt: "What to emphasize?",
						choices: [
							{ id: "survey", label: "A wide survey" },
							{ id: "passages", label: "Key passages" },
						],
					},
					{
						id: "pali",
						prompt: "How should the answer handle Pali terms?",
						choices: [
							{ id: "quote", label: "Quote key Pali passages" },
							{ id: "gloss", label: "English with brief glosses" },
						],
					},
				],
			}),
		);
		assert.equal(parsed.inScope, true);
		assert.equal(parsed.questions.length, 2);
		const ids = parsed.questions[0]?.choices.map((choice) => choice.id) || [];
		assert.ok(ids.includes(RESEARCH_CLARIFY_NO_PREF_ID));
		assert.ok(ids.includes(RESEARCH_CLARIFY_OTHER_ID));
	});

	it("declines off-corpus research without questions", () => {
		const parsed = parseResearchClarify(
			JSON.stringify({
				inScope: false,
				decline: {
					kind: "off_corpus",
					message: "Custom decline.",
				},
				questions: [],
			}),
		);
		assert.equal(parsed.inScope, false);
		assert.equal(parsed.decline?.kind, "off_corpus");
		assert.equal(parsed.decline?.message, "Custom decline.");
		assert.deepEqual(parsed.questions, []);
	});

	it("falls back to stock questions when JSON is missing", () => {
		const parsed = parseResearchClarify("not json");
		assert.equal(parsed.inScope, true);
		assert.ok(parsed.questions.length >= 2);
		assert.match(parsed.questions[0]?.prompt || "", /emphasize/i);
	});

	it("uses default copy when decline message is empty", () => {
		const parsed = parseResearchClarify(
			'{"inScope":false,"decline":{"kind":"off_corpus","message":""}}',
		);
		assert.equal(parsed.decline?.message, RESEARCH_DECLINE_OFF_CORPUS);
	});
});

describe("research clarify harness", () => {
	it("tells the model to decline later layers instead of polling source scope", () => {
		assert.match(RESEARCH_CLARIFY_SYSTEM, /Decide inScope first/i);
		assert.match(RESEARCH_CLARIFY_SYSTEM, /decline the whole topic/i);
		assert.match(RESEARCH_CLARIFY_SYSTEM, /Never ask about source scope/i);
		assert.match(RESEARCH_CLARIFY_SYSTEM, /Do not ask for a word count/i);
		assert.doesNotMatch(RESEARCH_CLARIFY_SYSTEM, /Only add a source-scope/i);
	});
});

describe("canStartResearchClarify", () => {
	const questions = parseResearchClarify(
		JSON.stringify({
			inScope: true,
			questions: [
				{
					id: "focus",
					prompt: "Emphasis?",
					choices: [{ id: "survey", label: "Survey" }],
				},
				{
					id: "pali",
					prompt: "Pali?",
					choices: [
						{ id: "quote", label: "Quote" },
						{ id: "gloss", label: "Gloss" },
					],
				},
			],
		}),
	).questions;

	it("requires a choice on every question", () => {
		assert.equal(canStartResearchClarify(questions, []), false);
		assert.equal(
			canStartResearchClarify(questions, [
				{ questionId: "focus", choiceId: "survey" },
			]),
			false,
		);
		assert.equal(
			canStartResearchClarify(questions, [
				{ questionId: "focus", choiceId: "survey" },
				{ questionId: "pali", choiceId: "quote" },
			]),
			true,
		);
	});

	it("requires Other text when Other is selected", () => {
		assert.equal(
			canStartResearchClarify(questions, [
				{ questionId: "focus", choiceId: RESEARCH_CLARIFY_OTHER_ID },
				{ questionId: "pali", choiceId: "quote" },
			]),
			false,
		);
		assert.equal(
			canStartResearchClarify(questions, [
				{
					questionId: "focus",
					choiceId: RESEARCH_CLARIFY_OTHER_ID,
					otherText: "householders only",
				},
				{ questionId: "pali", choiceId: "quote" },
			]),
			true,
		);
	});
});

describe("researchClarifyAnswersOutOfScope", () => {
	it("detects an out-of-scope chip", () => {
		const questions = parseResearchClarify(
			JSON.stringify({
				inScope: true,
				questions: [
					{
						id: "focus",
						prompt: "Emphasis?",
						choices: [
							{ id: "survey", label: "Survey" },
							{ id: "web", label: "Open web", outOfScope: true },
						],
					},
					{
						id: "pali",
						prompt: "Pali?",
						choices: [{ id: "quote", label: "Quote" }],
					},
				],
			}),
		).questions;
		assert.equal(
			researchClarifyAnswersOutOfScope(questions, [
				{ questionId: "focus", choiceId: "survey" },
				{ questionId: "pali", choiceId: "quote" },
			]),
			false,
		);
		assert.equal(
			researchClarifyAnswersOutOfScope(questions, [
				{ questionId: "focus", choiceId: "web" },
				{ questionId: "pali", choiceId: "quote" },
			]),
			true,
		);
	});
});

describe("formatResearchClarifyBrief", () => {
	it("joins the topic with chosen labels", () => {
		const questions = parseResearchClarify(
			JSON.stringify({
				inScope: true,
				questions: [
					{
						id: "focus",
						prompt: "Emphasis?",
						choices: [{ id: "survey", label: "A wide survey" }],
					},
					{
						id: "pali",
						prompt: "Pali?",
						choices: [{ id: "quote", label: "Quote key passages" }],
					},
				],
			}),
		).questions;
		const brief = formatResearchClarifyBrief(
			"mindfulness of the body",
			questions,
			[
				{ questionId: "focus", choiceId: "survey" },
				{ questionId: "pali", choiceId: "quote" },
			],
		);
		assert.match(brief, /mindfulness of the body/);
		assert.match(brief, /A wide survey/);
		assert.match(brief, /Quote key passages/);
	});
});

describe("parseResearchClarifyAnswers", () => {
	it("keeps one answer per question and clips Other text", () => {
		const parsed = parseResearchClarifyAnswers([
			{ questionId: "focus", choiceId: "survey" },
			{ questionId: "focus", choiceId: "web" },
			{
				questionId: "pali",
				choiceId: "other",
				otherText: "  householders  ",
			},
		]);
		assert.equal(parsed.length, 2);
		assert.equal(parsed[0]?.choiceId, "survey");
		assert.equal(parsed[1]?.otherText, "householders");
	});

	it("keeps line breaks in Other notes", () => {
		const parsed = parseResearchClarifyAnswers([
			{
				questionId: "pali",
				choiceId: "other",
				otherText: "householders\nlay practice",
			},
		]);
		assert.equal(parsed[0]?.otherText, "householders\nlay practice");
	});

	it("clips Other text to the raised note cap", () => {
		const long = "householder practice ".repeat(40);
		const parsed = parseResearchClarifyAnswers([
			{
				questionId: "pali",
				choiceId: "other",
				otherText: long,
			},
		]);
		assert.ok((parsed[0]?.otherText || "").length <= RESEARCH_CLARIFY_MAX_OTHER);
		assert.equal((parsed[0]?.otherText || "").length, RESEARCH_CLARIFY_MAX_OTHER);
	});
});
