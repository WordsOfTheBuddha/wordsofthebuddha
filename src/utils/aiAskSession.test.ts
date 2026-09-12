import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AI_ASK_SESSION_LIMIT,
	AI_RESEARCH_SESSION_LIMIT,
	ASK_HISTORY_FIRESTORE_LIMIT_BYTES,
	ASK_HISTORY_FIRESTORE_TARGET_BYTES,
	ASK_HISTORY_PREVIEW_LIMIT,
	askHistoryFirestoreBytes,
	askHistoryLaneEntries,
	attachResearchToHistoryThread,
	askHistoryEntriesForRestore,
	askHistoryEntriesForTab,
	clearActiveAskThread,
	clearAskResumeFromDiscourse,
	clearAskThreadResumeIntent,
	markAskResumeFromDiscourse,
	shouldRestoreActiveAskThread,
	shouldRestoreDroppedResearchJob,
	shouldResumeAskFromDiscourse,
	findAiAskSessionEntry,
	formatAskRelativeTime,
	mergeAskHistoryEntries,
	mergeResearchUnreadFlag,
	preservePendingResearchHistory,
	normalizeAskQuestionKey,
	pinnedAskHistoryEntries,
	priorResearchJobIdsInThread,
	readActiveAskThread,
	resolveAskHistoryTab,
	removeAskHistoryEntriesByJobIds,
	removeAskHistoryEntriesByQuestions,
	isAskHistoryDocumentSizeError,
	researchHistoryNeedsJobRestore,
	sanitizeAskHistoryEntry,
	slimAskHistoryEntriesForSync,
	slimAskHistoryEntryForSync,
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

	it("keeps a finished empty-result Research job restorable by id", () => {
		const clean = sanitizeAskHistoryEntry({
			question: "What is satipaṭṭhāna?",
			lookingFor: "",
			queries: ["satipaṭṭhāna", "ānāpānasati", "sati"],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			at: 1,
			research: true,
			researchJobId: "0305ad4a-56cb-409f-835d-2683530a7dac",
		});
		assert.ok(clean);
		assert.equal(clean.results.length, 0);
		assert.equal(clean.researchJobId, "0305ad4a-56cb-409f-835d-2683530a7dac");
		const slim = slimAskHistoryEntryForSync(clean);
		assert.ok(slim);
		assert.equal(slim.report, undefined);
		assert.equal(slim.researchJobId, clean.researchJobId);
		assert.equal(researchHistoryNeedsJobRestore(slim), true);
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

	it("round-trips research process hops", () => {
		const clean = sanitizeAskHistoryEntry(
			entry("survey feeling", 1, {
				research: true,
				researchJobId: "job-hops",
				processNotes: [
					"Searching again · 3 of 3 queries",
					"Reading MN 70 in full…",
					"Searching · 2 of 8 queries",
				],
			}),
		);
		assert.deepEqual(clean?.processNotes, [
			"Searching again · 3 of 3 queries",
			"Reading MN 70 in full…",
		]);
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

	it("round-trips a research card excerpt", () => {
		const clean = sanitizeAskHistoryEntry(
			entry("survey feeling", 1, {
				research: true,
				researchJobId: "job-ex",
				reportExcerpt: "The discourses treat vedanā as feeling tone.",
			}),
		);
		assert.equal(
			clean?.reportExcerpt,
			"The discourses treat vedanā as feeling tone.",
		);
		assert.equal(clean?.report, undefined);
	});

	it("round-trips stored report stats without the full report", () => {
		const clean = sanitizeAskHistoryEntry(
			entry("survey feeling", 1, {
				research: true,
				researchJobId: "job-stats",
				reportStats: { words: 4962, cited: 37, additional: 21 },
			}),
		);
		assert.deepEqual(clean?.reportStats, {
			words: 4962,
			cited: 37,
			additional: 21,
		});
		assert.equal(clean?.report, undefined);
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

describe("attachResearchToHistoryThread", () => {
	it("keeps follow-up research as the last turn of the conversation", () => {
		const first = entry("Who is a trainee?", 1);
		const research = entry("What is the bare minimum?", 2, {
			research: true,
			researchJobId: "job-follow",
			report: "## Report",
		});
		const attached = attachResearchToHistoryThread(research, null, [
			first,
			research,
		]);
		assert.equal(attached.thread?.length, 2);
		assert.equal(attached.thread?.[0]?.question, "Who is a trainee?");
		assert.equal(attached.thread?.[1]?.researchJobId, "job-follow");
		assert.deepEqual(
			askHistoryEntriesForRestore(attached).map((item) => item.question),
			["Who is a trainee?", "What is the bare minimum?"],
		);
	});

	it("reuses the saved thread when the live page is gone", () => {
		const first = entry("Who is a trainee?", 1);
		const pending = entry("What is the bare minimum?", 2, {
			research: true,
			researchJobId: "job-follow",
			researchPending: true,
		});
		pending.results = [];
		const existing = {
			thread: [first, pending],
		};
		const finished = entry("What is the bare minimum?", 3, {
			research: true,
			researchJobId: "job-follow",
			report: "## Report",
		});
		const attached = attachResearchToHistoryThread(finished, existing);
		assert.equal(attached.thread?.length, 2);
		assert.equal(attached.thread?.[0]?.question, "Who is a trainee?");
		assert.equal(attached.thread?.[1]?.report, "## Report");
	});

	it("leaves a first-turn research report standalone", () => {
		const research = entry("Survey feeling", 1, {
			research: true,
			researchJobId: "job-solo",
			report: "## Feeling",
		});
		const attached = attachResearchToHistoryThread(research, null, [research]);
		assert.equal(attached.thread, undefined);
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

	it("keeps separate research jobs with the same question", () => {
		const first = entry("Who is a trainee?", 10, {
			research: true,
			researchJobId: "job-a",
			report: "## A",
		});
		const second = entry("Who is a trainee?", 20, {
			research: true,
			researchJobId: "job-b",
			report: "## B",
			researchUnread: true,
		});
		const merged = mergeAskHistoryEntries([first], [second]);
		assert.equal(merged.length, 2);
		assert.deepEqual(
			merged.map((item) => item.researchJobId).sort(),
			["job-a", "job-b"],
		);
	});

	it("does not resurrect unread after a report has been opened", () => {
		const read = entry("Who is a trainee?", 10, {
			research: true,
			researchJobId: "job-a",
			report: "## A",
		});
		const unread = entry("Who is a trainee?", 10, {
			research: true,
			researchJobId: "job-a",
			report: "## A",
			researchUnread: true,
		});
		const merged = mergeAskHistoryEntries([read], [unread]);
		assert.equal(merged.length, 1);
		assert.equal(merged[0]?.researchUnread, undefined);
		assert.equal(
			mergeResearchUnreadFlag(read, unread),
			false,
		);
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

describe("Ask vs Research history lanes", () => {
	it("uses the same 20-row cap as Ask", () => {
		assert.equal(AI_RESEARCH_SESSION_LIMIT, AI_ASK_SESSION_LIMIT);
		assert.equal(AI_ASK_SESSION_LIMIT, 20);
	});

	it("keeps an Ask and a Research with the same question as separate rows", () => {
		const ask = entry("What is feeling?", 1);
		const report = entry("What is feeling?", 2, {
			research: true,
			researchJobId: "job-feeling",
			report: "## Feeling",
		});
		const merged = upsertAiAskSessionEntry(
			upsertAiAskSessionEntry([], ask),
			report,
		);
		assert.equal(merged.length, 2);
		assert.equal(
			askHistoryLaneEntries(merged, false).map((item) => item.question)[0],
			"What is feeling?",
		);
		assert.equal(askHistoryLaneEntries(merged, true).length, 1);
		assert.equal(
			findAiAskSessionEntry(merged, "What is feeling?", { research: true })
				?.researchJobId,
			"job-feeling",
		);
		assert.equal(
			findAiAskSessionEntry(merged, "What is feeling?", { research: false })
				?.research,
			undefined,
		);
	});

	it("keeps separate Research jobs that share a question", () => {
		let entries: AiAskSessionEntry[] = [];
		for (const id of ["job-a", "job-b", "job-c"]) {
			entries = upsertAiAskSessionEntry(
				entries,
				entry("Who is a trainee?", 1, {
					research: true,
					researchJobId: id,
					report: "## Report",
				}),
			);
		}
		assert.equal(askHistoryLaneEntries(entries, true).length, 3);
		const first = entry("Who is a trainee?", 1, {
			research: true,
			researchJobId: "job-a",
			report: "## First",
		});
		const second = entry("Who is a trainee?", 2, {
			research: true,
			researchJobId: "job-b",
			report: "## Second",
			researchUnread: true,
		});
		assert.equal(mergeAskHistoryEntries([first], [second]).length, 2);
	});

	it("replaces the same Research job without dropping an older job", () => {
		const first = entry("Who is a trainee?", 1, {
			research: true,
			researchJobId: "job-a",
			report: "## First",
		});
		const pending = entry("Who is a trainee?", 2, {
			research: true,
			researchJobId: "job-b",
			researchPending: true,
		});
		const ready = entry("Who is a trainee?", 2, {
			research: true,
			researchJobId: "job-b",
			report: "## Ready",
			researchUnread: true,
		});
		const merged = upsertAiAskSessionEntry(
			upsertAiAskSessionEntry(upsertAiAskSessionEntry([], first), pending),
			ready,
		);
		assert.equal(merged.length, 2);
		const jobB = merged.find((item) => item.researchJobId === "job-b");
		assert.equal(jobB?.report, "## Ready");
		assert.equal(jobB?.researchUnread, true);
		assert.equal(jobB?.researchPending, undefined);
		assert.ok(merged.some((item) => item.researchJobId === "job-a"));
	});

	it("does not resurrect Research ready after the report was opened", () => {
		const unread = entry("Who is a trainee?", 10, {
			research: true,
			researchJobId: "job-a",
			report: "## Ready",
			researchUnread: true,
		});
		const read = entry("Who is a trainee?", 10, {
			research: true,
			researchJobId: "job-a",
			report: "## Ready",
		});
		const afterOpen = upsertAiAskSessionEntry([unread], read);
		assert.equal(afterOpen[0]?.researchUnread, undefined);
		const synced = mergeAskHistoryEntries(afterOpen, [unread]);
		assert.equal(synced.length, 1);
		assert.equal(synced[0]?.researchUnread, undefined);
	});

	it("deletes one Research job without removing another with the same question", () => {
		const entries = [
			entry("Who is a trainee?", 1, {
				research: true,
				researchJobId: "job-a",
				report: "## A",
			}),
			entry("Who is a trainee?", 2, {
				research: true,
				researchJobId: "job-b",
				report: "## B",
			}),
		];
		const next = removeAskHistoryEntriesByJobIds(entries, ["job-b"]);
		assert.equal(next.length, 1);
		assert.equal(next[0]?.researchJobId, "job-a");
	});

	it("deletes an empty-result Research job without removing a same-question sibling", () => {
		const empty = sanitizeAskHistoryEntry({
			question: "Who is a trainee?",
			lookingFor: "",
			queries: ["sati"],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			at: 2,
			research: true,
			researchJobId: "job-empty",
		});
		assert.ok(empty);
		const entries = [
			entry("Who is a trainee?", 1, {
				research: true,
				researchJobId: "job-a",
				report: "## A",
			}),
			empty,
		];
		const next = removeAskHistoryEntriesByJobIds(entries, ["job-empty"]);
		assert.equal(next.length, 1);
		assert.equal(next[0]?.researchJobId, "job-a");
		assert.equal(
			removeAskHistoryEntriesByQuestions(entries, ["Who is a trainee?"], {
				research: true,
			}).length,
			0,
		);
	});

	it("restores a missing job only when another report still has that question", () => {
		const kept = entry("Who is a trainee?", 1, {
			research: true,
			researchJobId: "job-a",
			report: "## A",
		});
		assert.equal(
			shouldRestoreDroppedResearchJob([kept], {
				id: "job-b",
				question: "Who is a trainee?",
			}),
			true,
		);
		assert.equal(
			shouldRestoreDroppedResearchJob([kept], {
				id: "job-c",
				question: "What is radical attention?",
			}),
			false,
		);
		assert.equal(
			shouldRestoreDroppedResearchJob([], {
				id: "job-b",
				question: "Who is a trainee?",
			}),
			false,
		);
	});

	it("lists earlier jobs in a follow-up thread so they can be folded into the tip", () => {
		const follow = entry("And stream-entry?", 2, {
			research: true,
			researchJobId: "job-follow",
			report: "## Follow",
			thread: [
				entry("Who is a trainee?", 1, {
					research: true,
					researchJobId: "job-root",
					report: "## Root",
				}),
				entry("And stream-entry?", 2, {
					research: true,
					researchJobId: "job-follow",
					report: "## Follow",
				}),
			],
		});
		assert.deepEqual(priorResearchJobIdsInThread(follow), ["job-root"]);
	});

	it("trims 20 Asks and 20 reports independently", () => {
		let entries: AiAskSessionEntry[] = [];
		for (let i = 0; i < AI_ASK_SESSION_LIMIT + 2; i++) {
			entries = upsertAiAskSessionEntry(entries, entry(`ask ${i}`, i));
		}
		for (let i = 0; i < AI_RESEARCH_SESSION_LIMIT + 2; i++) {
			entries = upsertAiAskSessionEntry(
				entries,
				entry(`report ${i}`, 100 + i, {
					research: true,
					researchJobId: `job-${i}`,
					report: "## Report",
				}),
			);
		}
		assert.equal(askHistoryLaneEntries(entries, false).length, AI_ASK_SESSION_LIMIT);
		assert.equal(
			askHistoryLaneEntries(entries, true).length,
			AI_RESEARCH_SESSION_LIMIT,
		);
		assert.equal(
			entries.length,
			AI_ASK_SESSION_LIMIT + AI_RESEARCH_SESSION_LIMIT,
		);
	});

	it("deletes only the matching lane", () => {
		const entries = [
			entry("same", 1),
			entry("same", 2, {
				research: true,
				researchJobId: "job-same",
				report: "## Same",
			}),
		];
		const afterAsk = removeAskHistoryEntriesByQuestions(entries, ["same"], {
			research: false,
		});
		assert.equal(afterAsk.length, 1);
		assert.equal(afterAsk[0]?.research, true);
		const afterReport = removeAskHistoryEntriesByQuestions(entries, ["same"], {
			research: true,
		});
		assert.equal(afterReport.length, 1);
		assert.equal(afterReport[0]?.research, undefined);
	});

	it("keeps a pinned report when newer unpinned reports overflow", () => {
		let entries: AiAskSessionEntry[] = [
			entry("pinned report", 1, {
				research: true,
				researchJobId: "job-pin",
				report: "## Pinned",
				saved: true,
			}),
		];
		for (let i = 0; i < AI_RESEARCH_SESSION_LIMIT; i++) {
			entries = upsertAiAskSessionEntry(
				entries,
				entry(`new report ${i}`, 10 + i, {
					research: true,
					researchJobId: `job-n-${i}`,
					report: "## New",
				}),
			);
		}
		const reports = askHistoryLaneEntries(entries, true);
		assert.equal(reports.length, AI_RESEARCH_SESSION_LIMIT);
		assert.ok(
			reports.some((item) => item.question === "pinned report" && item.saved),
		);
	});

	it("does not restore a Research thread from the Ask key", () => {
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
		writeActiveAskThread(
			[
				entry("survey feeling", 1, {
					research: true,
					researchJobId: "job-1",
					report: "## Feeling",
				}),
			],
			storage,
			{ research: true },
		);
		assert.equal(readActiveAskThread(storage).length, 0);
		assert.equal(readActiveAskThread(storage, { research: true }).length, 1);
	});

	it("keeps Back-from-discourse resume on the matching pane", () => {
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
		markAskResumeFromDiscourse(storage, { research: true });
		assert.equal(shouldResumeAskFromDiscourse(storage), false);
		assert.equal(shouldResumeAskFromDiscourse(storage, { research: true }), true);
		clearAskResumeFromDiscourse(storage, { research: true });
		assert.equal(shouldResumeAskFromDiscourse(storage, { research: true }), false);
	});
});

describe("slim Ask history for Firestore", () => {
	it("drops the full research report and keeps card fields", () => {
		const fat = entry("survey feeling", 1, {
			research: true,
			researchJobId: "job-slim",
			researchUnread: true,
			saved: true,
			report: "## Feeling\n\nThe discourses treat **vedanā** as a feeling tone ([SN 36.1](/sn36.1)).",
			reasoning: "hidden chain of thought ".repeat(80),
			processNotes: [
				"Searching again · 3 of 3 queries",
				"Reading MN 70 in full…",
			],
			results: Array.from({ length: 40 }, (_, i) => ({
				slug: `mn${i + 1}`,
				title: `Discourse ${i + 1}`,
				description: "x".repeat(200),
				contentSnippet: "y".repeat(200),
				referenceOnly: false,
				href: `/mn${i + 1}`,
			})),
		});
		const slim = slimAskHistoryEntryForSync(fat);
		assert.ok(slim);
		assert.equal(slim.report, undefined);
		assert.equal(slim.reasoning, "");
		assert.equal(slim.processNotes, undefined);
		assert.equal(slim.researchJobId, "job-slim");
		assert.equal(slim.researchUnread, true);
		assert.equal(slim.saved, true);
		assert.match(slim.reportExcerpt || "", /feeling tone/i);
		assert.ok(slim.reportStats);
		assert.equal(slim.reportStats?.cited, 1);
		assert.ok((slim.reportStats?.words || 0) > 0);
		assert.equal(slim.reportStats?.additional, 40);
		const slimAgain = sanitizeAskHistoryEntry({
			...slim,
			report: undefined,
			results: slim.results,
		});
		assert.deepEqual(slimAgain?.reportStats, slim.reportStats);
		assert.ok((slim.results.length || 0) <= 6);
		assert.ok(slim.results.every((hit) => hit.contentSnippet === null));
		assert.equal(slim.candidateCount, 40);
		assert.equal(researchHistoryNeedsJobRestore(slim), true);
		assert.equal(researchHistoryNeedsJobRestore(fat), false);
	});

	it("does not resurrect unread when both copies are slim finished jobs", () => {
		const unread = slimAskHistoryEntryForSync(
			entry("Who is a trainee?", 10, {
				research: true,
				researchJobId: "job-a",
				report: "## Ready",
				researchUnread: true,
			}),
		);
		const read = slimAskHistoryEntryForSync(
			entry("Who is a trainee?", 10, {
				research: true,
				researchJobId: "job-a",
				report: "## Ready",
			}),
		);
		assert.ok(unread);
		assert.ok(read);
		assert.equal(unread.report, undefined);
		assert.equal(read.researchUnread, undefined);
		const afterOpen = upsertAiAskSessionEntry([unread], read);
		assert.equal(afterOpen[0]?.researchUnread, undefined);
		const synced = mergeAskHistoryEntries(afterOpen, [unread]);
		assert.equal(synced[0]?.researchUnread, undefined);
		assert.equal(mergeResearchUnreadFlag(read, unread), false);
	});

	it("keeps a local full report when merging a slim server copy", () => {
		const local = entry("Who is a trainee?", 10, {
			research: true,
			researchJobId: "job-a",
			report: "## Full local report",
		});
		const remote = slimAskHistoryEntryForSync(local);
		assert.ok(remote);
		assert.equal(remote.report, undefined);
		const merged = preservePendingResearchHistory([local], [remote]);
		assert.equal(merged[0]?.report, "## Full local report");
		assert.equal(merged[0]?.researchJobId, "job-a");
	});

	it("clips Ask thread snapshots on the server payload", () => {
		const root = entry("What is mindfulness?", 1, {
			reasoning: "long ".repeat(200),
			results: Array.from({ length: 20 }, (_, i) => ({
				slug: `sn47.${i + 1}`,
				title: "Satipatthana",
				description: "d".repeat(80),
				contentSnippet: "s".repeat(200),
				referenceOnly: false,
				href: `/sn47.${i + 1}`,
			})),
		});
		const follow = entry("What about the second one?", 2, {
			thread: [root, entry("What about the second one?", 2)],
			reasoning: "more ".repeat(200),
		});
		const slim = slimAskHistoryEntryForSync(follow);
		assert.ok(slim);
		assert.ok((slim.reasoning || "").length <= 400);
		assert.ok((slim.thread?.length || 0) <= 6);
		assert.ok(
			(slim.thread || []).every(
				(turn) =>
					!turn.report &&
					(turn.results || []).every((hit) => hit.contentSnippet === null),
			),
		);
	});

	it("keeps 20 fat research rows under the Firestore budget", () => {
		const fat = Array.from({ length: AI_RESEARCH_SESSION_LIMIT }, (_, i) =>
			entry(`report ${i}`, i + 1, {
				research: true,
				researchJobId: `job-${i}`,
				researchUnread: i % 2 === 0,
				report: `# Title\n\n${"word ".repeat(18_000)}`,
				reasoning: "r".repeat(4000),
				processNotes: Array.from({ length: 8 }, () => "Reading MN 70 in full…"),
				results: Array.from({ length: 80 }, (_, j) => ({
					slug: `mn${j + 1}`,
					title: "T".repeat(80),
					description: "D".repeat(80),
					contentSnippet: "S".repeat(200),
					referenceOnly: false,
					href: `/mn${j + 1}`,
				})),
			}),
		);
		assert.ok(
			askHistoryFirestoreBytes(fat) > ASK_HISTORY_FIRESTORE_LIMIT_BYTES,
		);
		const slim = slimAskHistoryEntriesForSync(fat);
		assert.equal(slim.length, AI_RESEARCH_SESSION_LIMIT);
		assert.ok(
			askHistoryFirestoreBytes(slim) < ASK_HISTORY_FIRESTORE_TARGET_BYTES,
		);
		assert.ok(slim.every((item) => !item.report));
		assert.ok(slim.every((item) => Boolean(item.researchJobId)));
		assert.equal(slim.filter((item) => item.researchUnread).length, 10);
	});

	it("recognizes Firestore document-size errors", () => {
		assert.equal(
			isAskHistoryDocumentSizeError({
				code: 3,
				message:
					"3 INVALID_ARGUMENT: Document 'projects/x/documents/users/u/askHistory/entries' cannot be written because its size (1276657 bytes) exceeds the maximum allowed size of 1048576 bytes.",
			}),
			true,
		);
		assert.equal(isAskHistoryDocumentSizeError(new Error("permission-denied")), false);
	});

	it("keeps in-flight process hops on a pending slim row", () => {
		const pending = slimAskHistoryEntryForSync({
			question: "Who is a sekha?",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "thinking",
			at: 1,
			research: true,
			researchJobId: "job-pending",
			researchPending: true,
			processNotes: [
				"Searching again · 3 of 3 queries",
				"Reading MN 70 in full…",
				"Going deeper…",
			],
		});
		assert.ok(pending);
		assert.equal(pending.researchPending, true);
		assert.equal(pending.report, undefined);
		assert.ok((pending.processNotes || []).length > 0);
		assert.ok((pending.processNotes || []).length <= 2);
	});

	it("keeps 20 Asks plus 20 reports under the Firestore budget", () => {
		const mixed = [
			...Array.from({ length: AI_ASK_SESSION_LIMIT }, (_, i) =>
				entry(`ask ${i}`, i, {
					summary: "briefing ".repeat(200),
					reasoning: "think ".repeat(200),
					thread: [
						entry(`ask ${i} root`, i, {
							results: Array.from({ length: 20 }, (_, j) => ({
								slug: `an${j + 1}`,
								title: "T",
								description: "d".repeat(80),
								contentSnippet: "s".repeat(200),
								referenceOnly: false,
								href: `/an${j + 1}`,
							})),
						}),
						entry(`ask ${i}`, i),
					],
				}),
			),
			...Array.from({ length: AI_RESEARCH_SESSION_LIMIT }, (_, i) =>
				entry(`report ${i}`, 100 + i, {
					research: true,
					researchJobId: `job-mix-${i}`,
					report: `# Title\n\n${"word ".repeat(8_000)}`,
					results: Array.from({ length: 40 }, (_, j) => ({
						slug: `mn${j + 1}`,
						title: "T",
						description: "d".repeat(80),
						contentSnippet: "s".repeat(200),
						referenceOnly: false,
						href: `/mn${j + 1}`,
					})),
				}),
			),
		];
		const slim = slimAskHistoryEntriesForSync(mixed);
		assert.equal(slim.length, AI_ASK_SESSION_LIMIT + AI_RESEARCH_SESSION_LIMIT);
		assert.ok(
			askHistoryFirestoreBytes(slim) < ASK_HISTORY_FIRESTORE_TARGET_BYTES,
		);
	});
});
