import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { researchAuthFailure } from "./aiAskResearchAuth";

describe("researchAuthFailure", () => {
	it("blocks unsigned and unverified users without reaching GLM", () => {
		assert.equal(researchAuthFailure(null)?.error, "Sign in to use Research.");
		assert.equal(
			researchAuthFailure({ uid: "u1", emailVerified: false })?.error,
			"Verify your email to use Research.",
		);
		assert.equal(researchAuthFailure({ uid: "u1", emailVerified: true }), null);
	});
});
