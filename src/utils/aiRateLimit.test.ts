import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clientIpFromRequest,
	consumeAiAskQuota,
	resetAiAskQuotaForTests,
} from "./aiRateLimit";

describe("consumeAiAskQuota", () => {
	it("allows up to the limit then rejects", () => {
		resetAiAskQuotaForTests();
		const first = consumeAiAskQuota("1.1.1.1", 2);
		const second = consumeAiAskQuota("1.1.1.1", 2);
		const third = consumeAiAskQuota("1.1.1.1", 2);
		assert.equal(first.allowed, true);
		assert.equal(first.remaining, 1);
		assert.equal(second.allowed, true);
		assert.equal(second.remaining, 0);
		assert.equal(third.allowed, false);
	});

	it("tracks IPs separately", () => {
		resetAiAskQuotaForTests();
		assert.equal(consumeAiAskQuota("10.0.0.1", 1).allowed, true);
		assert.equal(consumeAiAskQuota("10.0.0.2", 1).allowed, true);
		assert.equal(consumeAiAskQuota("10.0.0.1", 1).allowed, false);
	});
});

describe("clientIpFromRequest", () => {
	it("uses the first forwarded address", () => {
		const request = new Request("http://localhost/api/ai/ask", {
			headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
		});
		assert.equal(clientIpFromRequest(request), "203.0.113.1");
	});
});
