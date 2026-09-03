import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

describe("isAskSearchMode", () => {
	it("reads the mode flag", () => {
		assert.equal(isAskSearchMode("mode=ai"), true);
		assert.equal(isAskSearchMode("q=anger"), false);
		assert.equal(isAskSearchMode("?mode=ai&q=x"), true);
	});
});
