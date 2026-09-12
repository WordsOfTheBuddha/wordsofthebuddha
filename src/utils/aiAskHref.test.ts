import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askAuthPageHref,
	askAuthReturnTo,
	canonicalizeAskSearchHref,
	isAskSearchMode,
	isAskSurfaceMode,
	isResearchSearchMode,
	askHistoryOpenParam,
	askResearchJobParam,
	askSampleParam,
	openAskHistoryHref,
	openAskResearchHref,
	reviewRoomAsksHashId,
	reviewRoomHistoryLaneFromHash,
	REVIEW_ROOM_ASKS_HASH,
	REVIEW_ROOM_REPORTS_HASH,
	searchAskHref,
	searchResearchHref,
	withAskHistoryOpenParam,
	withAskResearchParam,
	withAskSampleParam,
	withAskSurfaceParams,
} from "./aiAskHref";

describe("openAskResearchHref", () => {
	it("opens a private research job on Research", () => {
		assert.equal(
			openAskResearchHref("job-1"),
			"/search?mode=research&research=job-1",
		);
	});
});

describe("withAskResearchParam", () => {
	it("puts a live job on the Research pane", () => {
		assert.equal(
			withAskResearchParam("mode=ask", "job-1").get("research"),
			"job-1",
		);
		assert.equal(
			withAskResearchParam("mode=ai", "job-1").get("mode"),
			"research",
		);
		assert.equal(
			withAskResearchParam("mode=research&research=job-1", null).get("research"),
			null,
		);
		assert.equal(
			withAskResearchParam("mode=research&research=job-1", null).get("mode"),
			"research",
		);
		assert.equal(
			withAskResearchParam("mode=research&open=feeling", "job-1").get("open"),
			null,
		);
		assert.equal(
			withAskResearchParam("mode=research&sample=what-is-radical-attention", "job-1").get(
				"sample",
			),
			null,
		);
	});
});

describe("withAskSampleParam", () => {
	it("puts a sample on the current pane and clears job/open", () => {
		const params = withAskSampleParam(
			"mode=research&research=job-1&open=feeling",
			"what-is-radical-attention",
		);
		assert.equal(params.get("sample"), "what-is-radical-attention");
		assert.equal(params.get("research"), null);
		assert.equal(params.get("open"), null);
		assert.equal(params.get("mode"), "research");
		assert.equal(
			withAskSampleParam("mode=research&sample=what-is-radical-attention", null).get(
				"sample",
			),
			null,
		);
		assert.equal(askSampleParam("mode=research&sample=short"), "");
	});
});

describe("withAskSurfaceParams", () => {
	it("opens a report from the Research menu without dropping other flags", () => {
		const opened = withAskSurfaceParams("mode=research&pli=true&ref=true", {
			jobId: "job-1",
			open: null,
		});
		assert.equal(opened.get("mode"), "research");
		assert.equal(opened.get("research"), "job-1");
		assert.equal(opened.get("pli"), "true");
		assert.equal(opened.get("ref"), "true");
		assert.equal(opened.get("open"), null);
	});

	it("returns to the menu by clearing job, sample, and open params", () => {
		const menu = withAskSurfaceParams(
			"mode=research&research=job-1&pli=true",
			{ jobId: null, open: null, sample: null },
		);
		assert.equal(menu.get("mode"), "research");
		assert.equal(menu.get("research"), null);
		assert.equal(menu.get("open"), null);
		assert.equal(menu.get("sample"), null);
		assert.equal(menu.get("pli"), "true");
		const fromSample = withAskSurfaceParams(
			"mode=research&sample=what-is-radical-attention&pli=true",
			{ jobId: null, open: null, sample: null },
		);
		assert.equal(fromSample.get("sample"), null);
		assert.equal(fromSample.get("pli"), "true");
	});

	it("opens a stored Ask from the Ask menu", () => {
		const opened = withAskSurfaceParams("mode=ask", {
			jobId: null,
			open: "why anger",
		});
		assert.equal(opened.get("open"), "why anger");
		assert.equal(askHistoryOpenParam(opened), "why anger");
		assert.equal(opened.get("research"), null);
		assert.equal(opened.get("sample"), null);
	});

	it("opens a curated sample without dropping other flags", () => {
		const opened = withAskSurfaceParams("mode=research&pli=true", {
			sample: "what-is-radical-attention",
			jobId: null,
			open: null,
		});
		assert.equal(opened.get("sample"), "what-is-radical-attention");
		assert.equal(askSampleParam(opened), "what-is-radical-attention");
		assert.equal(opened.get("research"), null);
		assert.equal(opened.get("open"), null);
		assert.equal(opened.get("pli"), "true");
	});
});

describe("openAskHistoryHref", () => {
	it("targets a stored ask via the open param", () => {
		assert.equal(
			openAskHistoryHref("  why   anger "),
			"/search?mode=ask&open=why+anger",
		);
		assert.equal(openAskHistoryHref("   "), "/search?mode=ask");
	});
});

describe("searchAskHref", () => {
	it("points Ask at search with mode=ask", () => {
		assert.equal(searchAskHref(), "/search?mode=ask");
		assert.equal(
			searchAskHref("why anger"),
			"/search?mode=ask&q=why+anger",
		);
	});
});

describe("askAuthReturnTo", () => {
	it("carries a pending question onto Ask", () => {
		assert.equal(askAuthReturnTo("  why   anger "), "/search?mode=ask&q=why+anger");
	});

	it("keeps the current page when there is no pending question", () => {
		assert.equal(askAuthReturnTo("", "/search?mode=ask"), "/search?mode=ask");
		assert.equal(askAuthReturnTo("   "), "/search?mode=ask");
		assert.equal(
			askAuthReturnTo("feeling?", "/search?mode=research"),
			"/search?mode=research&q=feeling%3F",
		);
		assert.equal(isResearchSearchMode("/search?mode=research"), true);
	});

	it("rewrites leftover mode=ai onto mode=ask", () => {
		assert.equal(
			askAuthReturnTo("", "/search?mode=ai"),
			"/search?mode=ask",
		);
		assert.equal(
			canonicalizeAskSearchHref("/search?mode=ai&q=feeling%3F"),
			"/search?mode=ask&q=feeling%3F",
		);
	});
});

describe("searchResearchHref", () => {
	it("points Research at search with mode=research", () => {
		assert.equal(searchResearchHref(), "/search?mode=research");
		assert.equal(isResearchSearchMode("mode=research"), true);
		assert.equal(isAskSurfaceMode("mode=research"), true);
		assert.equal(isAskSurfaceMode("mode=ask"), true);
		assert.equal(isAskSurfaceMode("mode=ai"), true);
		assert.equal(isAskSurfaceMode(""), false);
	});
});

describe("askAuthPageHref", () => {
	it("nests the Ask return path on register and sign-in", () => {
		assert.equal(
			askAuthPageHref("/register", "why anger"),
			"/register?returnTo=%2Fsearch%3Fmode%3Dask%26q%3Dwhy%2Banger",
		);
		assert.equal(
			askAuthPageHref("/signin", "why anger"),
			"/signin?returnTo=%2Fsearch%3Fmode%3Dask%26q%3Dwhy%2Banger",
		);
	});
});

describe("askHistoryOpenParam", () => {
	it("reads the stored Ask to reopen", () => {
		assert.equal(askHistoryOpenParam("mode=ask&open=why+anger"), "why anger");
		assert.equal(askHistoryOpenParam("mode=research"), "");
	});
});

describe("askResearchJobParam", () => {
	it("reads a research job id from the Ask URL", () => {
		assert.equal(
			askResearchJobParam("mode=ask&research=30042cc5-e76c-44b0-8c53-7df1a76e8ed5"),
			"30042cc5-e76c-44b0-8c53-7df1a76e8ed5",
		);
		assert.equal(askResearchJobParam("mode=ask"), "");
		assert.equal(askResearchJobParam("?research=  job-1  "), "job-1");
	});
});

describe("reviewRoomHistoryLaneFromHash", () => {
	it("maps Review Room hashes onto the inner Asks | Reports lane", () => {
		assert.equal(reviewRoomHistoryLaneFromHash("#asks"), "ask");
		assert.equal(reviewRoomHistoryLaneFromHash("reports"), "research");
		assert.equal(reviewRoomHistoryLaneFromHash("#Reports"), "research");
		assert.equal(reviewRoomHistoryLaneFromHash("#overview"), null);
		assert.equal(reviewRoomAsksHashId(false), REVIEW_ROOM_ASKS_HASH);
		assert.equal(reviewRoomAsksHashId(true), REVIEW_ROOM_REPORTS_HASH);
	});
});

describe("isAskSearchMode", () => {
	it("reads the mode flag", () => {
		assert.equal(isAskSearchMode("mode=ask"), true);
		assert.equal(isAskSearchMode("mode=ai"), true);
		assert.equal(isAskSearchMode("q=anger"), false);
		assert.equal(isAskSearchMode("?mode=ask&q=x"), true);
		assert.equal(isAskSearchMode("mode=research"), false);
	});
});
