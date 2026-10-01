import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DISCOURSE_ASK_PAGE_THREAD_TURN_LIMIT,
	discourseAskPageHasThread,
	discourseAskPageThreadKey,
	readDiscourseAskPageThread,
	writeDiscourseAskPageThread,
} from "./discourseAskPageThread";

function memoryStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (key) => (map.has(key) ? map.get(key)! : null),
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => {
			map.delete(key);
		},
		setItem: (key, value) => {
			map.set(key, value);
		},
	};
}

const hit = {
	slug: "sn10.8",
	title: "Sudatta",
	description: "With Anāthapiṇḍika.",
	contentSnippet: "ignored snippet",
	referenceOnly: false,
	href: "/sn10.8#3",
};

describe("discourseAskPageThread", () => {
	it("keys a discourse once regardless of slash, case, or query", () => {
		assert.equal(
			discourseAskPageThreadKey("SN10.8"),
			discourseAskPageThreadKey("/sn10.8?pli=true"),
		);
		assert.equal(discourseAskPageThreadKey("sn10.8"), "dask-page-thread-v1:sn10.8");
		assert.equal(discourseAskPageThreadKey(""), "");
	});

	it("round-trips a settled ask and keeps threads apart by page", () => {
		const storage = memoryStorage();
		writeDiscourseAskPageThread(
			"sn10.8",
			[
				{
					question: "What follows Sudatta?",
					originalQuestion: "What follows Sudatta?",
					lookingFor: "later discourses",
					queries: ["anathapindika"],
					fallbackQueries: [],
					offTopic: false,
					results: [hit],
					summary: "See MN 143.\n\nThen AN 4.61.",
					model: "test",
					candidateCount: 592,
					phase: "done",
					pending: false,
				},
			],
			storage,
		);
		writeDiscourseAskPageThread(
			"mn1",
			[
				{
					question: "Other page",
					summary: "Only here.",
					results: [{ ...hit, slug: "mn1", href: "/mn1" }],
					phase: "done",
				},
			],
			storage,
		);
		const turns = readDiscourseAskPageThread("sn10.8", storage);
		assert.equal(turns.length, 1);
		assert.equal(turns[0]?.question, "What follows Sudatta?");
		assert.equal(turns[0]?.summary, "See MN 143.\n\nThen AN 4.61.");
		assert.equal(turns[0]?.results[0]?.href, "/sn10.8#3");
		assert.equal(turns[0]?.results[0]?.contentSnippet, null);
		assert.equal(turns[0]?.candidateCount, 592);
		assert.equal(readDiscourseAskPageThread("mn1", storage)[0]?.question, "Other page");
		assert.equal(discourseAskPageHasThread("/SN10.8", storage), true);
		assert.equal(discourseAskPageHasThread("dn1", storage), false);
	});

	it("drops in-flight turns and keeps an error", () => {
		const storage = memoryStorage();
		writeDiscourseAskPageThread(
			"sn10.8",
			[
				{
					question: "Kept",
					summary: "Answer.",
					results: [hit],
					phase: "done",
				},
				{
					question: "Still working",
					summary: "",
					results: [],
					pending: true,
					phase: "search",
				},
				{
					question: "Failed",
					summary: "",
					results: [],
					error: "Network error. Try again.",
					phase: "search",
				},
			],
			storage,
		);
		const turns = readDiscourseAskPageThread("sn10.8", storage);
		assert.deepEqual(
			turns.map((turn) => turn.question),
			["Kept", "Failed"],
		);
		assert.equal(turns[1]?.error, "Network error. Try again.");
		assert.equal(turns[1]?.phase, "search");
	});

	it("clears the page when the thread is emptied", () => {
		const storage = memoryStorage();
		writeDiscourseAskPageThread(
			"sn10.8",
			[{ question: "Q", summary: "A", results: [hit], phase: "done" }],
			storage,
		);
		writeDiscourseAskPageThread("sn10.8", [], storage);
		assert.equal(discourseAskPageHasThread("sn10.8", storage), false);
		assert.equal(storage.length, 0);
	});

	it("keeps only the latest turns", () => {
		const storage = memoryStorage();
		const turns = Array.from(
			{ length: DISCOURSE_ASK_PAGE_THREAD_TURN_LIMIT + 1 },
			(_, index) => ({
				question: `Q${index}`,
				summary: "A",
				results: [hit],
				phase: "done" as const,
			}),
		);
		writeDiscourseAskPageThread("sn10.8", turns, storage);
		const stored = readDiscourseAskPageThread("sn10.8", storage);
		assert.equal(stored.length, DISCOURSE_ASK_PAGE_THREAD_TURN_LIMIT);
		assert.equal(stored[0]?.question, "Q1");
		assert.equal(stored.at(-1)?.question, "Q6");
	});

	it("ignores junk", () => {
		const storage = memoryStorage();
		storage.setItem(discourseAskPageThreadKey("sn10.8"), "{");
		assert.deepEqual(readDiscourseAskPageThread("sn10.8", storage), []);
		storage.setItem(
			discourseAskPageThreadKey("sn10.8"),
			JSON.stringify({ turns: [{ question: "" }, null, { pending: true }] }),
		);
		assert.equal(discourseAskPageHasThread("sn10.8", storage), false);
	});
});
