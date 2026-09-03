import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeAuthReturnUrl } from "./authReturnTo";

const REQUEST = "https://www.wordsofthebuddha.org/api/auth/signin";

describe("safeAuthReturnUrl", () => {
	it("keeps Ask mode on /search", () => {
		const url = safeAuthReturnUrl("/search?mode=ai", REQUEST);
		assert.equal(url.pathname, "/search");
		assert.equal(url.searchParams.get("mode"), "ai");
	});

	it("rejects off-origin redirects", () => {
		const url = safeAuthReturnUrl("https://evil.example/phish", REQUEST);
		assert.equal(url.pathname, "/review-room");
	});

	it("falls back when returnTo is empty", () => {
		const url = safeAuthReturnUrl("", REQUEST);
		assert.equal(url.pathname, "/review-room");
	});

	it("supports a custom fallback for sign-out", () => {
		const url = safeAuthReturnUrl("", REQUEST, "/");
		assert.equal(url.pathname, "/");
		assert.equal(url.search, "");
	});

	it("keeps Ask mode query on sign-out return", () => {
		const url = safeAuthReturnUrl(
			"/search?mode=ai",
			"https://www.wordsofthebuddha.org/api/auth/signout",
			"/",
		);
		assert.equal(url.pathname, "/search");
		assert.equal(url.searchParams.get("mode"), "ai");
	});
});
