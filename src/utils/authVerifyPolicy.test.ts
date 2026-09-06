import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldCheckSessionRevoked } from "./authVerifyPolicy";

describe("shouldCheckSessionRevoked", () => {
	const interval = 5 * 60 * 1000;

	it("skips the revocation list on the first local JWT verify", () => {
		assert.equal(shouldCheckSessionRevoked(undefined, 1_000, false, interval), false);
	});

	it("checks when forceRefresh is set", () => {
		assert.equal(shouldCheckSessionRevoked(undefined, 1_000, true, interval), true);
		assert.equal(shouldCheckSessionRevoked(500, 600, true, interval), true);
	});

	it("checks again only after the interval", () => {
		const last = 10_000;
		assert.equal(
			shouldCheckSessionRevoked(last, last + interval - 1, false, interval),
			false,
		);
		assert.equal(
			shouldCheckSessionRevoked(last, last + interval, false, interval),
			true,
		);
	});
});
