import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	shouldFallbackRerankToOpenRouter,
	shouldFallbackRewriteToGemini,
} from "./gemini";

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

describe("shouldFallbackRerankToOpenRouter", () => {
	it("falls back on Gemini daily quota and rate limits", () => {
		const quota = new Error("RESOURCE_EXHAUSTED: Quota exceeded") as Error & {
			status?: number;
		};
		quota.status = 429;
		assert.equal(shouldFallbackRerankToOpenRouter(quota), true);
		const exhausted = new Error("You exceeded your current quota");
		assert.equal(shouldFallbackRerankToOpenRouter(exhausted), true);
		const auth = new Error("API key not valid") as Error & { status?: number };
		auth.status = 401;
		assert.equal(shouldFallbackRerankToOpenRouter(auth), false);
	});
});
