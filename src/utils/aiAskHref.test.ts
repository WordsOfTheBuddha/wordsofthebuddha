import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askAuthPageHref,
	askAuthReturnTo,
	isAskSearchMode,
	askResearchJobParam,
	openAskHistoryHref,
	openAskResearchHref,
	searchAskHref,
	withAskResearchParam,
} from "./aiAskHref";

describe("openAskResearchHref", () => {
	it("opens a private research job on Ask", () => {
		assert.equal(
			openAskResearchHref("job-1"),
			"/search?mode=ai&research=job-1",
		);
	});
});

describe("withAskResearchParam", () => {
	it("sets and clears the research param on Ask", () => {
		assert.equal(
			withAskResearchParam("mode=ai", "job-1").get("research"),
			"job-1",
		);
		assert.equal(
			withAskResearchParam("mode=ai&research=job-1", null).get("research"),
			null,
		);
		assert.equal(withAskResearchParam("q=anger", "job-2").get("mode"), "ai");
	});
});

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

describe("askResearchJobParam", () => {
	it("reads a research job id from the Ask URL", () => {
		assert.equal(
			askResearchJobParam("mode=ai&research=30042cc5-e76c-44b0-8c53-7df1a76e8ed5"),
			"30042cc5-e76c-44b0-8c53-7df1a76e8ed5",
		);
		assert.equal(askResearchJobParam("mode=ai"), "");
		assert.equal(askResearchJobParam("?research=  job-1  "), "job-1");
	});
});

describe("isAskSearchMode", () => {
	it("reads the mode flag", () => {
		assert.equal(isAskSearchMode("mode=ai"), true);
		assert.equal(isAskSearchMode("q=anger"), false);
		assert.equal(isAskSearchMode("?mode=ai&q=x"), true);
	});
});
