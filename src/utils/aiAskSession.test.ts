import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AI_ASK_SESSION_LIMIT,
	ASK_HISTORY_PREVIEW_LIMIT,
	askHistoryEntriesForRestore,
	askHistoryEntriesForTab,
	clearActiveAskThread,
	clearAskResumeFromDiscourse,
	clearAskThreadResumeIntent,
	markAskResumeFromDiscourse,
	shouldRestoreActiveAskThread,
	shouldResumeAskFromDiscourse,
	findAiAskSessionEntry,
	formatAskRelativeTime,
	mergeAskHistoryEntries,
	preservePendingResearchHistory,
	normalizeAskQuestionKey,
	pinnedAskHistoryEntries,
	readActiveAskThread,
	resolveAskHistoryTab,
	removeAskHistoryEntriesByQuestions,
	sanitizeAskHistoryEntry,
	trimAskHistoryEntries,
	upsertAiAskSessionEntry,
	visibleAskHistoryEntries,
	writeActiveAskThread,
	type AiAskSessionEntry,
} from "./aiAskSession";

function entry(
	question: string,
	at = 1,
	extra: Partial<AiAskSessionEntry> = {},
): AiAskSessionEntry {
	return {
		question,
		lookingFor: question,
		queries: [question],
		fallbackQueries: [],
		offTopic: false,
		results: [
			{
				slug: "mn10",
				title: "Satipaṭṭhāna",
				description: "",
				contentSnippet: null,
				referenceOnly: false,
				href: "/mn10",
			},
		],
		model: "test",
		reasoning: "",
		at,
		saved: false,
		...extra,
	};
}

describe("normalizeAskQuestionKey", () => {
	it("collapses space and case", () => {
		assert.equal(
			normalizeAskQuestionKey("  Why  Anger  "),
			"why anger",
		);
	});
});

describe("upsertAiAskSessionEntry", () => {
	it("keeps newest first and dedupes by question", () => {
		const first = upsertAiAskSessionEntry([], entry("why anger", 1));
		const second = upsertAiAskSessionEntry(first, entry("what is sati", 2));
		const again = upsertAiAskSessionEntry(
			second,
			entry("Why anger", 3),
		);
		assert.equal(again[0]?.question, "Why anger");
		assert.equal(again.length, 2);
		assert.equal(again[1]?.question, "what is sati");
	});

	it("caps at the session limit", () => {
		let entries: AiAskSessionEntry[] = [];
		for (let i = 0; i < AI_ASK_SESSION_LIMIT + 3; i++) {
			entries = upsertAiAskSessionEntry(entries, entry(`q ${i}`, i));
		}
		assert.equal(entries.length, AI_ASK_SESSION_LIMIT);
		assert.equal(entries[0]?.question, `q ${AI_ASK_SESSION_LIMIT + 2}`);
	});
});

describe("trimAskHistoryEntries", () => {
	it("keeps saved Asks when trimming past the limit", () => {
		const entries = [
			entry("newest", 100),
			entry("saved old", 50, { saved: true }),
			...Array.from({ length: AI_ASK_SESSION_LIMIT }, (_, i) =>
				entry(`filler ${i}`, 40 - i),
			),
		];
		const trimmed = trimAskHistoryEntries(entries, AI_ASK_SESSION_LIMIT);
		assert.equal(trimmed.length, AI_ASK_SESSION_LIMIT);
		assert.ok(trimmed.some((item) => item.question === "saved old" && item.saved));
		assert.ok(trimmed.some((item) => item.question === "newest"));
	});
});

describe("sanitizeAskHistoryEntry research", () => {
	it("round-trips a Research history badge", () => {
		const clean = sanitizeAskHistoryEntry(
			entry("survey feeling", 1, {
				research: true,
				researchJobId: "job-1",
			}),
		);
		assert.equal(clean?.research, true);
		assert.equal(clean?.researchJobId, "job-1");
	});

	it("round-trips in-progress and unread research", () => {
		const pending = sanitizeAskHistoryEntry({
			question: "Who is a sekha?",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			at: 1,
			research: true,
			researchJobId: "job-2",
			researchPending: true,
		});
		assert.equal(pending?.researchPending, true);
		assert.equal(pending?.researchJobId, "job-2");
		const unread = sanitizeAskHistoryEntry(
			entry("Who is a sekha?", 2, {
				research: true,
				researchJobId: "job-2",
				researchUnread: true,
			}),
		);
		assert.equal(unread?.researchUnread, true);
	});

	it("round-trips a research report", () => {
		const clean = sanitizeAskHistoryEntry(
			entry("survey feeling", 1, {
				research: true,
				report: "## Feeling\n\nSN 36.1",
			}),
		);
		assert.match(clean?.report || "", /## Feeling/);
	});
});

describe("preservePendingResearchHistory", () => {
	it("keeps a local in-flight research job the server list dropped", () => {
		const pending = sanitizeAskHistoryEntry({
			question: "Who is a sekha?",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			at: 9,
			research: true,
			researchJobId: "job-keep",
			researchPending: true,
		});
		assert.ok(pending);
		const remote = [entry("older ask", 1)];
		const kept = preservePendingResearchHistory([pending], remote);
		assert.equal(
			kept.some((item) => item.researchJobId === "job-keep" && item.researchPending),
			true,
		);
	});
});

describe("sanitizeAskHistoryEntry saved", () => {
	it("round-trips the saved flag", () => {
		const saved = sanitizeAskHistoryEntry(entry("keep me", 1, { saved: true }));
		assert.equal(saved?.saved, true);
		const plain = sanitizeAskHistoryEntry(entry("plain", 1));
		assert.equal(plain?.saved, false);
	});
});

describe("ask conversation thread snapshots", () => {
	it("round-trips a multi-turn thread on a history entry", () => {
		const root = entry("What is mindfulness?", 1);
		const follow = entry("What about the second one?", 2, {
			saved: true,
			thread: [root, entry("What about the second one?", 2)],
		});
		const clean = sanitizeAskHistoryEntry(follow);
		assert.equal(clean?.saved, true);
		assert.equal(clean?.thread?.length, 2);
		assert.equal(clean?.thread?.[0]?.question, "What is mindfulness?");
		assert.equal(
			clean?.thread?.[1]?.question,
			"What about the second one?",
		);
		// Nested thread must not nest further.
		assert.equal(clean?.thread?.[1]?.thread, undefined);
	});

	it("restores the full conversation from a pinned follow-up", () => {
		const root = entry("What is mindfulness?", 1);
		const follow = entry("What about the second one?", 2, {
			thread: [root, entry("What about the second one?", 2)],
		});
		const restored = askHistoryEntriesForRestore(follow);
		assert.deepEqual(
			restored.map((item) => item.question),
			["What is mindfulness?", "What about the second one?"],
		);
	});

	it("restores a solo Ask when no thread snapshot exists", () => {
		const solo = entry("What is anger?", 1);
		assert.deepEqual(
			askHistoryEntriesForRestore(solo).map((item) => item.question),
			["What is anger?"],
		);
	});
});

describe("findAiAskSessionEntry", () => {
	it("finds a prior question case-insensitively", () => {
		const entries = [entry("Is there a self?")];
		assert.ok(findAiAskSessionEntry(entries, "is there a self?"));
		assert.equal(findAiAskSessionEntry(entries, "other"), undefined);
	});

	it("matches the original typo when display wording was corrected", () => {
		const entries = [
			{
				...entry("Is there a discourse where the Buddha takes questions from the bhikkhus?"),
				originalQuestion:
					"is there a discourse where the Buddha takes questions from the weeknds",
			},
		];
		assert.ok(
			findAiAskSessionEntry(
				entries,
				"is there a discourse where the Buddha takes questions from the weeknds",
			),
		);
	});
});

describe("sanitizeAskHistoryEntry", () => {
	it("drops entries without results", () => {
		assert.equal(
			sanitizeAskHistoryEntry({
				question: "anger",
				results: [],
				at: 1,
			}),
			null,
		);
	});

	it("keeps a wide research set and paragraph briefing", () => {
		const results = Array.from({ length: 50 }, (_, index) => ({
			slug: `mn${index + 1}`,
			title: `Discourse ${index + 1}`,
			description: "",
			contentSnippet: null,
			referenceOnly: false,
			href: `/mn${index + 1}`,
		}));
		const clean = sanitizeAskHistoryEntry({
			question: "research satipatthana",
			lookingFor: "satipatthana",
			queries: ["sati"],
			fallbackQueries: [],
			offTopic: false,
			results,
			summary: "First point.\n\nSecond point.",
			model: "test",
			reasoning: "",
			at: 1,
		});
		assert.equal(clean?.results.length, 50);
		assert.equal(clean?.summary, "First point.\n\nSecond point.");
	});
});

describe("mergeAskHistoryEntries", () => {
	it("keeps the newer ask for the same question", () => {
		const older = entry("anger", 10);
		const newer = { ...entry("anger", 20), lookingFor: "fresh" };
		const merged = mergeAskHistoryEntries([older], [newer]);
		assert.equal(merged.length, 1);
		assert.equal(merged[0]?.lookingFor, "fresh");
	});
});

describe("removeAskHistoryEntriesByQuestions", () => {
	it("removes matching questions so edits can replace history", () => {
		const entries = [entry("old wording", 1), entry("keep me", 2)];
		const next = removeAskHistoryEntriesByQuestions(entries, ["Old Wording"]);
		assert.equal(next.length, 1);
		assert.equal(next[0]?.question, "keep me");
	});
});

describe("formatAskRelativeTime", () => {
	it("formats recent times", () => {
		const now = Date.parse("2026-09-03T12:00:00.000Z");
		assert.equal(formatAskRelativeTime(now - 30_000, now), "just now");
		assert.equal(formatAskRelativeTime(now - 5 * 60_000, now), "5m ago");
		assert.equal(formatAskRelativeTime(now - 3 * 60 * 60_000, now), "3h ago");
		assert.equal(formatAskRelativeTime(now - 23 * 60 * 60_000, now), "23h ago");
		assert.equal(formatAskRelativeTime(now - 24 * 60 * 60_000, now), "1d ago");
		assert.equal(formatAskRelativeTime(now - 33 * 60 * 60_000, now), "1d ago");
		assert.equal(formatAskRelativeTime(now - 39 * 60 * 60_000, now), "1d ago");
		assert.equal(formatAskRelativeTime(now - 2 * 24 * 60 * 60_000, now), "2d ago");
	});
});

describe("Ask resume from discourse", () => {
	it("tracks resume intent in sessionStorage", () => {
		const store = new Map<string, string>();
		const storage = {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			},
		} as Storage;
		assert.equal(shouldResumeAskFromDiscourse(storage), false);
		markAskResumeFromDiscourse(storage);
		assert.equal(shouldResumeAskFromDiscourse(storage), true);
		clearAskResumeFromDiscourse(storage);
		assert.equal(shouldResumeAskFromDiscourse(storage), false);
	});

	it("clears thread and resume intent together", () => {
		const store = new Map<string, string>();
		const storage = {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			},
		} as Storage;
		writeActiveAskThread([entry("mindfulness", 1)], storage);
		markAskResumeFromDiscourse(storage);
		clearAskThreadResumeIntent(storage);
		assert.deepEqual(readActiveAskThread(storage), []);
		assert.equal(shouldResumeAskFromDiscourse(storage), false);
	});
});

describe("shouldRestoreActiveAskThread", () => {
	it("restores only on Back from a discourse or reload", () => {
		assert.equal(shouldRestoreActiveAskThread("back_forward", true), true);
		assert.equal(shouldRestoreActiveAskThread("back_forward", false), false);
		assert.equal(shouldRestoreActiveAskThread("reload", false), true);
		assert.equal(shouldRestoreActiveAskThread("navigate", true), false);
	});
});

describe("active Ask thread", () => {
	it("round-trips the open thread in sessionStorage", () => {
		const store = new Map<string, string>();
		const storage = {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			},
		} as Storage;
		writeActiveAskThread([entry("mindfulness of the body", 5)], storage);
		const read = readActiveAskThread(storage);
		assert.equal(read.length, 1);
		assert.equal(read[0]?.question, "mindfulness of the body");
		clearActiveAskThread(storage);
		assert.deepEqual(readActiveAskThread(storage), []);
	});
});

describe("ask history tabs", () => {
	const entries = [
		entry("old pin", 1, { saved: true }),
		entry("mid", 2),
		entry("new", 3),
		entry("newer pin", 4, { saved: true }),
		entry("newest", 5),
		entry("q6", 6),
		entry("q7", 7),
	];

	it("keeps Recent in recency order instead of lifting pins", () => {
		assert.deepEqual(
			askHistoryEntriesForTab(entries, "recent").map((item) => item.question),
			["q7", "q6", "newest", "newer pin", "new", "mid", "old pin"],
		);
	});

	it("lists every pin newest-first on the Pinned tab", () => {
		assert.deepEqual(
			pinnedAskHistoryEntries(entries).map((item) => item.question),
			["newer pin", "old pin"],
		);
		assert.deepEqual(
			visibleAskHistoryEntries(entries, "pinned", false).map(
				(item) => item.question,
			),
			["newer pin", "old pin"],
		);
	});

	it("does not cap the Pinned tab at the Recent preview limit", () => {
		const manyPins = Array.from({ length: 8 }, (_, i) =>
			entry(`pin ${i}`, i + 1, { saved: true }),
		);
		assert.equal(
			visibleAskHistoryEntries(manyPins, "pinned", false).length,
			8,
		);
	});

	it("previews five Recent Asks until expanded", () => {
		assert.equal(ASK_HISTORY_PREVIEW_LIMIT, 5);
		assert.deepEqual(
			visibleAskHistoryEntries(entries, "recent", false).map(
				(item) => item.question,
			),
			["q7", "q6", "newest", "newer pin", "new"],
		);
		assert.equal(
			visibleAskHistoryEntries(entries, "recent", true).length,
			entries.length,
		);
	});

	it("falls back to Recent when nothing is pinned", () => {
		assert.equal(resolveAskHistoryTab(entries, "pinned"), "pinned");
		assert.equal(
			resolveAskHistoryTab(
				entries.map((item) => ({ ...item, saved: false })),
				"pinned",
			),
			"recent",
		);
	});
});
