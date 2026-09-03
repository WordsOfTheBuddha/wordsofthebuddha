import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldFallbackRewriteToGemini } from "./gemini";

describe("shouldFallbackRewriteToGemini", () => {
	it("falls back on rate limits and outages", () => {
		const rate = new Error("Rate limit") as Error & { status?: number };
		rate.status = 429;
		assert.equal(shouldFallbackRewriteToGemini(rate), true);
		const busy = new Error("model overloaded");
		assert.equal(shouldFallbackRewriteToGemini(busy), true);
		const auth = new Error("bad key") as Error & { status?: number };
		auth.status = 401;
		assert.equal(shouldFallbackRewriteToGemini(auth), false);
	});
});
