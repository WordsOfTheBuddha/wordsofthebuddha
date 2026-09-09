import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askAuthPageHref,
	askAuthReturnTo,
	isAskSearchMode,
	openAskHistoryHref,
	searchAskHref,
} from "./aiAskHref";

describe("openAskHistoryHref", () => {
	it("targets a stored ask via the open param", () => {
		assert.equal(
			openAskHistoryHref("  why   anger "),
			"/search?mode=ai&open=why+anger",
		);
		assert.equal(openAskHistoryHref("   "), "/search?mode=ai");
	});
});

describe("searchAskHref", () => {
	it("points Ask at search with mode=ai", () => {
		assert.equal(searchAskHref(), "/search?mode=ai");
		assert.equal(
			searchAskHref("why anger"),
			"/search?mode=ai&q=why+anger",
		);
	});
});

describe("askAuthReturnTo", () => {
	it("carries a pending question onto Ask", () => {
		assert.equal(askAuthReturnTo("  why   anger "), "/search?mode=ai&q=why+anger");
	});

	it("keeps the current page when there is no pending question", () => {
		assert.equal(askAuthReturnTo("", "/search?mode=ai"), "/search?mode=ai");
		assert.equal(askAuthReturnTo("   "), "/search?mode=ai");
	});
});

describe("askAuthPageHref", () => {
	it("nests the Ask return path on register and sign-in", () => {
		assert.equal(
			askAuthPageHref("/register", "why anger"),
			"/register?returnTo=%2Fsearch%3Fmode%3Dai%26q%3Dwhy%2Banger",
		);
		assert.equal(
			askAuthPageHref("/signin", "why anger"),
			"/signin?returnTo=%2Fsearch%3Fmode%3Dai%26q%3Dwhy%2Banger",
		);
	});
});

describe("isAskSearchMode", () => {
	it("reads the mode flag", () => {
		assert.equal(isAskSearchMode("mode=ai"), true);
		assert.equal(isAskSearchMode("q=anger"), false);
		assert.equal(isAskSearchMode("?mode=ai&q=x"), true);
	});
});
