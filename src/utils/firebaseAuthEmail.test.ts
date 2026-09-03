import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { humanizeFirebaseAuthError } from "./firebaseAuthEmail";
import {
	isGmailDotAliasPair,
	verificationSentStatus,
} from "./emailVerificationCopy";

describe("humanizeFirebaseAuthError", () => {
	it("explains rate limits clearly", () => {
		assert.match(
			humanizeFirebaseAuthError("TOO_MANY_ATTEMPTS_TRY_LATER"),
			/already sent recently/i,
		);
	});
});

describe("isGmailDotAliasPair", () => {
	it("treats gmail dots as the same mailbox", () => {
		assert.equal(
			isGmailDotAliasPair(
				"siddharthlatest@gmail.com",
				"siddharth.latest@gmail.com",
			),
			true,
		);
		assert.equal(isGmailDotAliasPair("a@gmail.com", "b@gmail.com"), false);
		assert.equal(
			isGmailDotAliasPair("user@example.com", "u.ser@example.com"),
			false,
		);
	});
});

describe("verificationSentStatus", () => {
	it("names the destination without Gmail coaching", () => {
		const message = verificationSentStatus("sid.d@gmail.com");
		assert.equal(message, "Sent to sid.d@gmail.com. Check inbox and spam.");
		assert.doesNotMatch(message, /ignores dots|same inbox|To: field/i);
	});
});
