import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	parseSignupIntentFields,
	SIGNUP_INTENT_NOTE_MAX,
} from "./signupIntent";

describe("parseSignupIntentFields", () => {
	it("keeps a known intent and trims the note", () => {
		assert.deepEqual(
			parseSignupIntentFields({
				intent: " Practice ",
				note: "  Looking for satipaṭṭhāna  ",
			}),
			{ intent: "practice", note: "Looking for satipaṭṭhāna" },
		);
	});

	it("drops unknown intents", () => {
		assert.deepEqual(
			parseSignupIntentFields({ intent: "spam", note: "x" }),
			{ intent: null, note: "x" },
		);
	});

	it("caps note length", () => {
		const note = "a".repeat(SIGNUP_INTENT_NOTE_MAX + 40);
		assert.equal(
			parseSignupIntentFields({ intent: "other", note }).note.length,
			SIGNUP_INTENT_NOTE_MAX,
		);
	});
});
