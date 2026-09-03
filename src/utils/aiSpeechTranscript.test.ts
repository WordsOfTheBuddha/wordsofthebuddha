import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assembleSpeechTranscript,
	lastSpeechResultIsFinal,
} from "./aiSpeechTranscript";

describe("assembleSpeechTranscript", () => {
	it("joins every result so earlier phrases stay visible", () => {
		const results = [
			{ 0: { transcript: "why does anger " }, isFinal: true },
			{ 0: { transcript: "keep coming back" }, isFinal: false },
		];
		assert.equal(
			assembleSpeechTranscript(results),
			"why does anger keep coming back",
		);
	});

	it("does not keep only the latest fragment", () => {
		const results = [
			{ 0: { transcript: "what did he teach about the body" }, isFinal: false },
		];
		assert.equal(
			assembleSpeechTranscript(results),
			"what did he teach about the body",
		);
		assert.notEqual(
			results[results.length - 1]?.[0]?.transcript,
			"body",
		);
	});
});

describe("lastSpeechResultIsFinal", () => {
	it("is true only when the latest result is final", () => {
		assert.equal(lastSpeechResultIsFinal([]), false);
		assert.equal(
			lastSpeechResultIsFinal([{ 0: { transcript: "a" }, isFinal: false }]),
			false,
		);
		assert.equal(
			lastSpeechResultIsFinal([
				{ 0: { transcript: "a" }, isFinal: true },
				{ 0: { transcript: "b" }, isFinal: false },
			]),
			false,
		);
		assert.equal(
			lastSpeechResultIsFinal([{ 0: { transcript: "a" }, isFinal: true }]),
			true,
		);
	});
});
