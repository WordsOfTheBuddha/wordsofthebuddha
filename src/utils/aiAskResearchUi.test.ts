import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toResearchJobPublic } from "./aiAskResearchJob";
import {
	applyResearchJobToTurn,
	askComposerMeterIsResearch,
	askFollowPlaceholder,
	askMeterLabel,
	ASK_COMPOSER_LABEL,
	ASK_DELETE_CONFIRM,
	ASK_FOLLOW_PLACEHOLDER,
	ASK_HISTORY_HINT_PINNED,
	ASK_HISTORY_HINT_RECENT,
	ASK_HISTORY_LABEL,
	ASK_LIMITS_NOTE,
	ASK_PIN_ACCOUNT_TITLE,
	ASK_SHARE_ACCOUNT_TITLE,
	ASK_PLACEHOLDER,
	ASK_WAITING_PLACEHOLDER,
	ASK_NEW_LABEL,
	researchHistoryExcerpt,
	REVIEW_ROOM_ASK_EMPTY,
	REVIEW_ROOM_ASK_NEW_LABEL,
	REVIEW_ROOM_REPORT_EMPTY,
	REVIEW_ROOM_REPORT_NEW_LABEL,
	RESEARCH_COMPOSER_LABEL,
	RESEARCH_DELETE_ACTION,
	RESEARCH_DELETE_CONFIRM,
	RESEARCH_FOLLOW_PLACEHOLDER,
	RESEARCH_HISTORY_LABEL,
	RESEARCH_INVITE_AFTER_ASK,
	RESEARCH_LIMITS_NOTE,
	RESEARCH_PIN_ACCOUNT_TITLE,
	RESEARCH_PIN_ACTION,
	RESEARCH_PLACEHOLDER,
	RESEARCH_SHARE_ACCOUNT_TITLE,
	RESEARCH_SIGNIN_BODY,
	RESEARCH_SIGNIN_EMPTY_NOTE,
	RESEARCH_SIGNIN_TITLE,
	RESEARCH_UNPIN_ACTION,
	RESEARCH_NEW_LABEL,
	canShowResearchChip,
	isAskResearchEnabled,
	RESEARCH_EMAIL_PENDING_NOTE,
	researchHistoryTimestamp,
	researchJobToHistoryEntry,
	wrapAskAnswerHtml,
	researchVerifyStepText,
	isIncompleteResearchTurn,
	researchEditAskInsteadLabel,
	researchRetrySubmitLabel,
	sameResearchRetryQuestion,
	shouldUseResearchAsk,
	type ResearchTurnFields,
} from "./aiAskResearchUi";

const RESEARCH_FLAG = "PUBLIC_AI_RESEARCH";

function withResearchFlag(value: string | undefined, fn: () => void): void {
	const prev = process.env[RESEARCH_FLAG];
	try {
		if (value === undefined) delete process.env[RESEARCH_FLAG];
		else process.env[RESEARCH_FLAG] = value;
		fn();
	} finally {
		if (prev === undefined) delete process.env[RESEARCH_FLAG];
		else process.env[RESEARCH_FLAG] = prev;
	}
}

describe("askFollowPlaceholder", () => {
	it("does not invite a follow-up while the question is still open", () => {
		assert.equal(
			askFollowPlaceholder({ pending: true }),
			ASK_WAITING_PLACEHOLDER,
		);
		assert.equal(
			askFollowPlaceholder({ pending: true, researchFollow: true }),
			ASK_WAITING_PLACEHOLDER,
		);
	});

	it("uses follow-up copy after the question is resolved", () => {
		assert.equal(
			askFollowPlaceholder({ pending: false }),
			ASK_FOLLOW_PLACEHOLDER,
		);
		assert.equal(
			askFollowPlaceholder({ pending: false, researchFollow: true }),
			RESEARCH_FOLLOW_PLACEHOLDER,
		);
	});
});

describe("askComposerMeterIsResearch", () => {
	it("uses Ask credits after a finished report unless Research is on again", () => {
		assert.equal(
			askComposerMeterIsResearch({ chipOn: false }),
			false,
		);
		assert.equal(
			askComposerMeterIsResearch({
				chipOn: false,
				clarifying: false,
				researchPending: false,
			}),
			false,
		);
		assert.equal(askComposerMeterIsResearch({ chipOn: true }), true);
		assert.equal(
			askComposerMeterIsResearch({ chipOn: false, clarifying: true }),
			true,
		);
		assert.equal(
			askComposerMeterIsResearch({
				chipOn: false,
				researchPending: true,
			}),
			true,
		);
	});
});

describe("askMeterLabel", () => {
	it("shows Ask remaining after a finished research when the chip is off", () => {
		assert.equal(
			askMeterLabel({
				signedIn: true,
				researchOn: askComposerMeterIsResearch({ chipOn: false }),
				askRemaining: 12,
				researchRemaining: 0,
			}),
			"12 Asks left today",
		);
	});

	it("shows only the active mode’s remaining count", () => {
		assert.equal(
			askMeterLabel({
				signedIn: true,
				researchOn: false,
				askRemaining: 13,
				researchRemaining: 2,
			}),
			"13 Asks left today",
		);
		assert.equal(
			askMeterLabel({
				signedIn: true,
				researchOn: true,
				askRemaining: 13,
				researchRemaining: 1,
			}),
			"1 research report available today",
		);
		assert.equal(
			askMeterLabel({
				signedIn: true,
				researchOn: true,
				askRemaining: 13,
				researchRemaining: 1,
				hideResearchRemaining: true,
			}),
			"",
		);
	});
});

describe("research leave-tab copy", () => {
	it("invites the reader to leave without sounding like the tab must close", () => {
		assert.match(RESEARCH_EMAIL_PENDING_NOTE, /Feel free to leave/);
	});
});

describe("isAskResearchEnabled", () => {
	it("stays off unless PUBLIC_AI_RESEARCH is set", () => {
		withResearchFlag(undefined, () => {
			assert.equal(isAskResearchEnabled(), false);
		});
		withResearchFlag("1", () => {
			assert.equal(isAskResearchEnabled(), true);
		});
	});
});

describe("canShowResearchChip", () => {
	it("hides Research unless the reader is signed in with a verified email", () => {
		withResearchFlag("1", () => {
			assert.equal(
				canShowResearchChip({
					signedIn: false,
					hasResearchQuota: false,
				}),
				false,
			);
			assert.equal(
				canShowResearchChip({
					signedIn: true,
					needsEmailVerification: true,
					hasResearchQuota: true,
				}),
				false,
			);
			assert.equal(
				canShowResearchChip({
					signedIn: true,
					needsEmailVerification: false,
					hasResearchQuota: true,
				}),
				true,
			);
		});
	});

	it("stays hidden when the feature flag is off", () => {
		withResearchFlag(undefined, () => {
			assert.equal(
				canShowResearchChip({
					signedIn: true,
					hasResearchQuota: true,
				}),
				false,
			);
		});
	});
});

describe("shouldUseResearchAsk", () => {
	it("uses Research only when the chip is on — a running or finished job does not keep it on for the follow-up", () => {
		assert.equal(
			shouldUseResearchAsk({
				chipOn: true,
				followUp: false,
				lastTurnResearch: false,
			}),
			true,
		);
		assert.equal(
			shouldUseResearchAsk({
				chipOn: false,
				followUp: true,
				lastTurnResearch: true,
			}),
			false,
		);
		assert.equal(
			shouldUseResearchAsk({
				chipOn: false,
				followUp: false,
				lastTurnResearch: true,
			}),
			false,
		);
		assert.equal(
			shouldUseResearchAsk({
				chipOn: false,
				followUp: true,
				lastTurnResearch: false,
			}),
			false,
		);
		assert.equal(
			shouldUseResearchAsk({
				chipOn: false,
				followUp: true,
				lastTurnResearch: true,
				retryIncompleteResearch: true,
			}),
			true,
		);
		assert.equal(
			shouldUseResearchAsk({
				chipOn: true,
				followUp: true,
				lastTurnResearch: true,
				retryIncompleteResearch: true,
				forceAsk: true,
			}),
			false,
		);
	});
});

describe("isIncompleteResearchTurn", () => {
	it("treats a stopped research with no report as a research retry", () => {
		assert.equal(
			isIncompleteResearchTurn({
				research: true,
				pending: false,
				report: "",
			}),
			true,
		);
		assert.equal(
			isIncompleteResearchTurn({
				research: true,
				pending: false,
				report: "## Report\n\nDone.",
			}),
			false,
		);
		assert.equal(
			isIncompleteResearchTurn({
				research: false,
				pending: false,
			}),
			false,
		);
	});
});

describe("research retry copy", () => {
	it("names the same operation the reader already started", () => {
		assert.equal(researchRetrySubmitLabel(true), "Research again");
		assert.equal(researchRetrySubmitLabel(false), "Ask again");
		assert.equal(researchEditAskInsteadLabel(), "Ask instead");
		assert.equal(
			sameResearchRetryQuestion("Who is a trainee?", {
				question: "Who is a trainee?",
			}),
			true,
		);
		assert.equal(
			sameResearchRetryQuestion("something else", {
				question: "Who is a trainee?",
			}),
			false,
		);
	});
});

describe("researchVerifyStepText", () => {
	it("shows the scout verdict after verify", () => {
		assert.equal(
			researchVerifyStepText({ phase: "rewrite" }).text,
			"Check first hits",
		);
		assert.equal(
			researchVerifyStepText({ phase: "verify" }).state,
			"active",
		);
		assert.equal(
			researchVerifyStepText({
				phase: "search",
				onTrack: true,
				verifyNote: "On track · vedanā",
			}).text,
			"On track · vedanā",
		);
		assert.equal(
			researchVerifyStepText({
				phase: "search",
				onTrack: false,
				verifyNote: "Adjusted searches · added SN 36",
			}).text,
			"Adjusted searches · added SN 36",
		);
	});
});

describe("applyResearchJobToTurn", () => {
	it("maps a public job onto the pending Ask turn without a run token", () => {
		const job = toResearchJobPublic({
			id: "job-1",
			status: "verify",
			question: "feeling?",
			lookingFor: "vedanā",
			verifyNote: "On track · vedanā",
			onTrack: true,
			reasoning: "scout looks right",
		});
		const turn: ResearchTurnFields = {
			question: "feeling?",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			pending: true,
			phase: "rewrite",
		};
		applyResearchJobToTurn(turn, job);
		assert.equal(turn.research, true);
		assert.equal(turn.researchJobId, "job-1");
		assert.equal(turn.phase, "search");
		assert.equal(turn.verifyNote, "On track · vedanā");
		assert.equal(turn.pending, true);
		assert.equal("runToken" in turn, false);
	});

	it("copies process hops onto the turn", () => {
		const job = toResearchJobPublic({
			id: "job-hops",
			status: "complete",
			question: "feeling?",
			processNotes: [
				"Searching again · 3 of 3 queries",
				"Reading MN 70 in full…",
			],
		});
		const turn: ResearchTurnFields = {
			question: "feeling?",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			pending: true,
			phase: "rewrite",
		};
		applyResearchJobToTurn(turn, job);
		assert.deepEqual(turn.processNotes, [
			"Searching again · 3 of 3 queries",
			"Reading MN 70 in full…",
		]);
	});
});

describe("researchJobToHistoryEntry", () => {
	it("keeps an in-flight job restorable from Recent", () => {
		const job = toResearchJobPublic({
			id: "job-3",
			status: "searching",
			question: "Who is a sekha?",
			createdAt: 1_700_000_000_000,
		});
		const entry = researchJobToHistoryEntry(job);
		assert.equal(entry.research, true);
		assert.equal(entry.researchJobId, "job-3");
		assert.equal(entry.researchPending, true);
		assert.equal(entry.question, "Who is a sekha?");
		assert.equal(entry.processNotes, undefined);
		assert.equal(entry.results.length, 0);
		assert.equal(entry.at, 1_700_000_000_000);
	});

	it("keeps process hops on a finished research history entry", () => {
		const job = toResearchJobPublic({
			id: "job-hops",
			status: "complete",
			question: "Who is a sekha?",
			processNotes: [
				"Searching again · 3 of 3 queries",
				"Reading MN 70 in full…",
			],
		});
		const entry = researchJobToHistoryEntry(job);
		assert.deepEqual(entry.processNotes, [
			"Searching again · 3 of 3 queries",
			"Reading MN 70 in full…",
		]);
	});

	it("does not restamp when a later poll updates the same job", () => {
		const job = toResearchJobPublic({
			id: "job-4",
			status: "complete",
			question: "Who is a sekha?",
			createdAt: 9,
		});
		const entry = researchJobToHistoryEntry(job, { at: 5 });
		assert.equal(entry.at, 5);
	});

	it("keeps a conversation thread when a follow-up job updates", () => {
		const priorAsk = {
			question: "Who is a trainee?",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [
				{
					slug: "mn70",
					title: "Kitagiri",
					description: "",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn70",
				},
			],
			model: "",
			reasoning: "",
			at: 1,
		};
		const job = toResearchJobPublic({
			id: "job-follow",
			status: "complete",
			question: "What is the bare minimum?",
			createdAt: 2,
			result: {
				question: "What is the bare minimum?",
				lookingFor: "sekha",
				queries: ["sekha"],
				fallbackQueries: [],
				offTopic: false,
				results: [
					{
						slug: "sn48.53",
						title: "Sekha",
						description: "",
						contentSnippet: null,
						referenceOnly: false,
						href: "/sn48.53",
					},
				],
				model: "",
				reasoning: "",
				report: "## Report",
			},
		});
		const entry = researchJobToHistoryEntry(job, {
			at: 2,
			thread: [
				priorAsk,
				{
					...priorAsk,
					question: "What is the bare minimum?",
					research: true,
					researchJobId: "job-follow",
				},
			],
		});
		assert.equal(entry.thread?.length, 2);
		assert.equal(entry.thread?.[0]?.question, "Who is a trainee?");
	});

	it("walks a completion restamp back to createdAt", () => {
		const job = toResearchJobPublic({
			id: "job-5",
			status: "complete",
			question: "Who is a sekha?",
			createdAt: 5,
		});
		const entry = researchJobToHistoryEntry(job, { at: 99 });
		assert.equal(entry.at, 5);
	});
});

describe("researchHistoryTimestamp", () => {
	it("prefers the original ask time over now", () => {
		assert.equal(
			researchHistoryTimestamp({ existingAt: 10, createdAt: 20, now: 99 }),
			10,
		);
		assert.equal(researchHistoryTimestamp({ createdAt: 20, now: 99 }), 20);
		assert.equal(researchHistoryTimestamp({ now: 99 }), 99);
		assert.equal(
			researchHistoryTimestamp({ existingAt: 99, createdAt: 20, now: 99 }),
			20,
		);
	});
});

describe("wrapAskAnswerHtml", () => {
	it("puts a static copy control at both ends of a report", () => {
		const html = wrapAskAnswerHtml({
			kind: "report",
			kicker: "Research report",
			turnIndex: 0,
			bodyHtml: "<p>Hello</p>",
		});
		assert.match(html, /ai-answer-toolbar-start/);
		assert.match(html, /ai-answer-toolbar-end/);
		assert.equal([...html.matchAll(/data-ai-copy-answer/g)].length, 2);
		assert.match(html, /Research report/);
	});

	it("puts a single copy control at the end of an ask answer", () => {
		const html = wrapAskAnswerHtml({
			kind: "answer",
			turnIndex: 1,
			bodyHtml: "<p>Hello</p>",
		});
		assert.doesNotMatch(html, /ai-answer-toolbar-start/);
		assert.match(html, /ai-answer-toolbar-end/);
		assert.equal([...html.matchAll(/data-ai-copy-answer/g)].length, 1);
	});
});

describe("Research pane copy", () => {
	it("keeps Ask and Research wording on separate lanes", () => {
		assert.equal(ASK_PLACEHOLDER, "Ask a question about the discourses…");
		assert.equal(
			RESEARCH_PLACEHOLDER,
			"Ask for a cited report from the discourses…",
		);
		assert.equal(ASK_COMPOSER_LABEL, "Ask a question");
		assert.equal(RESEARCH_COMPOSER_LABEL, "Ask for a cited report");
		assert.equal(ASK_HISTORY_LABEL, "Recent Asks");
		assert.equal(RESEARCH_HISTORY_LABEL, "Recent reports");
		assert.equal(ASK_LIMITS_NOTE, "Experimental AI search · limited free Asks");
		assert.equal(
			RESEARCH_LIMITS_NOTE,
			"Experimental AI research",
		);
		assert.equal(
			ASK_HISTORY_HINT_RECENT,
			"Older ones drop off · pin to keep",
		);
		assert.equal(ASK_HISTORY_HINT_PINNED, "Stay until you unpin");
		assert.equal(
			ASK_DELETE_CONFIRM,
			"Delete this Ask from Recent Asks? This cannot be undone.",
		);
		assert.equal(
			RESEARCH_DELETE_CONFIRM,
			"Delete this report from Recent reports? This cannot be undone.",
		);
		assert.equal(RESEARCH_PIN_ACTION, "Pin this report");
		assert.equal(RESEARCH_UNPIN_ACTION, "Unpin this report");
		assert.equal(RESEARCH_DELETE_ACTION, "Delete this report");
		assert.equal(ASK_PIN_ACCOUNT_TITLE, "Create an account to pin Asks");
		assert.equal(
			RESEARCH_PIN_ACCOUNT_TITLE,
			"Create an account to pin this report",
		);
		assert.equal(ASK_SHARE_ACCOUNT_TITLE, "Create an account to share this Ask");
		assert.equal(
			RESEARCH_SHARE_ACCOUNT_TITLE,
			"Create an account to share this report",
		);
		assert.equal(RESEARCH_SIGNIN_TITLE, "Sign in to run Research");
		assert.match(RESEARCH_SIGNIN_BODY, /do not use your credits/);
		assert.equal(
			RESEARCH_SIGNIN_EMPTY_NOTE,
			"Create an account or sign in to run Research.",
		);
		assert.equal(
			RESEARCH_INVITE_AFTER_ASK,
			"Looking for a wider search and a longer cited report? Try Research.",
		);
		assert.equal(ASK_NEW_LABEL, "+ New Ask");
		assert.equal(RESEARCH_NEW_LABEL, "+ New Research");
		assert.equal(REVIEW_ROOM_ASK_NEW_LABEL, "+ Ask");
		assert.equal(REVIEW_ROOM_REPORT_NEW_LABEL, "+ Research");
		assert.equal(REVIEW_ROOM_ASK_EMPTY, "No asks yet.");
		assert.equal(REVIEW_ROOM_REPORT_EMPTY, "No research reports yet.");
	});
});

describe("researchHistoryExcerpt", () => {
	it("keeps the opening lines of a report, not citation chips", () => {
		assert.equal(researchHistoryExcerpt(""), "");
		assert.equal(
			researchHistoryExcerpt(
				"# Body\n\nThe discourses treat **mindfulness of the body** as a path ([MN 10](/mn10)).",
			),
			"Body The discourses treat mindfulness of the body as a path (MN 10).",
		);
		const long = `${"word ".repeat(80)}end`;
		const excerpt = researchHistoryExcerpt(long, 40);
		assert.ok(excerpt.length <= 40);
		assert.equal(excerpt.includes("end"), false);
	});
});
