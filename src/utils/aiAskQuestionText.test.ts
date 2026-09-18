import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	MAX_ASK_QUESTION_CHARS_SIGNED_IN,
	MAX_QUESTION_CHARS,
	clipAiQuestion,
	maxAskQuestionChars,
} from "./aiAskQuestionText";

describe("maxAskQuestionChars", () => {
	it("keeps guests on the shorter ceiling", () => {
		assert.equal(maxAskQuestionChars(false), MAX_QUESTION_CHARS);
	});

	it("raises the ceiling for signed-in readers", () => {
		assert.equal(maxAskQuestionChars(true), MAX_ASK_QUESTION_CHARS_SIGNED_IN);
		assert.ok(MAX_ASK_QUESTION_CHARS_SIGNED_IN > MAX_QUESTION_CHARS);
	});
});

describe("clipAiQuestion", () => {
	it("clips signed-in questions at 32k", () => {
		const long = "a".repeat(MAX_ASK_QUESTION_CHARS_SIGNED_IN + 100);
		assert.equal(
			clipAiQuestion(long, MAX_ASK_QUESTION_CHARS_SIGNED_IN).length,
			MAX_ASK_QUESTION_CHARS_SIGNED_IN,
		);
	});
});
