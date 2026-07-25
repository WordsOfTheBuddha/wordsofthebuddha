import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	addSearchHistory,
	clearSearchHistory,
	filterRecentSearches,
	getRecentSearchQueries,
	getSearchHistory,
	highlightRecentSearchQuery,
	MAX_SEARCH_HISTORY_ENTRIES,
	SEARCH_HISTORY_KEY,
} from "./searchHistoryClient";

describe("searchHistoryClient", () => {
	const storage = new Map<string, string>();

	beforeEach(() => {
		storage.clear();
		(globalThis as { localStorage?: Storage }).localStorage = {
			getItem: (key) => storage.get(key) ?? null,
			setItem: (key, value) => {
				storage.set(key, value);
			},
			removeItem: (key) => {
				storage.delete(key);
			},
			clear: () => storage.clear(),
			key: () => null,
			length: 0,
		};
	});

	afterEach(() => {
		delete (globalThis as { localStorage?: Storage }).localStorage;
	});

	it("starts empty", () => {
		assert.deepEqual(getRecentSearchQueries(), []);
	});

	it("adds queries with newest first and dedupes case-insensitively", () => {
		addSearchHistory("four noble truths");
		addSearchHistory("mindfulness");
		addSearchHistory("Four Noble Truths");

		assert.deepEqual(getRecentSearchQueries(), [
			"Four Noble Truths",
			"mindfulness",
		]);
	});

	it("caps history length", () => {
		for (let i = 0; i < MAX_SEARCH_HISTORY_ENTRIES + 10; i++) {
			addSearchHistory(`query-${i}`);
		}
		assert.equal(getSearchHistory().length, MAX_SEARCH_HISTORY_ENTRIES);
		assert.equal(getRecentSearchQueries()[0], `query-${MAX_SEARCH_HISTORY_ENTRIES + 9}`);
	});

	it("ignores blank queries", () => {
		addSearchHistory("   ");
		assert.deepEqual(getRecentSearchQueries(), []);
	});

	it("ignores queries shorter than four characters", () => {
		addSearchHistory("a");
		addSearchHistory("ab");
		addSearchHistory("abc");
		assert.deepEqual(getRecentSearchQueries(), []);
		addSearchHistory("abcd");
		assert.deepEqual(getRecentSearchQueries(), ["abcd"]);
	});

	it("returns recents in order when prefix is empty", () => {
		const queries = ["four noble truths", "fire simile", "form"];
		assert.deepEqual(filterRecentSearches(queries, ""), queries);
		assert.deepEqual(filterRecentSearches(queries, "", 2), [
			"four noble truths",
			"fire simile",
		]);
	});

	it("prioritizes prefix, then word-start, then contains for one-character filters", () => {
		const queries = [
			"four noble truths",
			"fire simile",
			"impermanence",
			"form",
		];

		assert.deepEqual(filterRecentSearches(queries, "f"), [
			"four noble truths",
			"fire simile",
			"form",
		]);

		assert.deepEqual(filterRecentSearches(queries, "t"), [
			"four noble truths",
		]);

		assert.deepEqual(
			filterRecentSearches(["four noble truths", "contentment"], "t"),
			["four noble truths", "contentment"],
		);

		assert.deepEqual(filterRecentSearches(queries, "n"), [
			"four noble truths",
			"impermanence",
		]);
	});

	it("fills up to max shown with lower-tier matches", () => {
		const queries = [
			"alpha",
			"beta",
			"gamma",
			"delta",
			"epsilon",
			"zeta",
			"eta",
			"theta",
			"impermanence",
		];

		assert.deepEqual(filterRecentSearches(queries, "a", 8), [
			"alpha",
			"beta",
			"gamma",
			"delta",
			"zeta",
			"eta",
			"theta",
			"impermanence",
		]);
	});

	it("highlights prefix, word-start, and in-word matches", () => {
		assert.equal(
			highlightRecentSearchQuery("four noble truths", "f"),
			'<mark class="search-suggest-mark">f</mark>our noble truths',
		);
		assert.equal(
			highlightRecentSearchQuery("four noble truths", "t"),
			'four noble <mark class="search-suggest-mark">t</mark>ruths',
		);
		assert.equal(
			highlightRecentSearchQuery("impermanence", "n"),
			'imperma<mark class="search-suggest-mark">n</mark>ence',
		);
	});

	it("clears history", () => {
		addSearchHistory("impermanence");
		clearSearchHistory();
		assert.equal(storage.has(SEARCH_HISTORY_KEY), false);
		assert.deepEqual(getRecentSearchQueries(), []);
	});
});
