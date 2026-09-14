import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import { toResearchJobPublic } from "./aiAskResearchJob";
import { RESEARCH_REPORT_LENGTH_NOTE_MD } from "./aiAskResearchReportLength";
import {
	applyResearchJobToTurn,
	mergeResearchJobVersionMetadata,
	findReportBlockElement,
	isResearchReviseClarifying,
	nextReviseClarifyDraft,
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
	askSponsorNoteVisible,
	ASK_PIN_ACCOUNT_TITLE,
	ASK_SHARE_ACCOUNT_TITLE,
	ASK_PLACEHOLDER,
	ASK_WAITING_PLACEHOLDER,
	ASK_NEW_LABEL,
	researchHistoryExcerpt,
	researchHistoryCardStatsLabel,
	researchHistoryStatsLabel,
	REVIEW_ROOM_ASK_EMPTY,
	REVIEW_ROOM_ASK_NEW_LABEL,
	REVIEW_ROOM_REPORT_EMPTY,
	REVIEW_ROOM_REPORT_NEW_LABEL,
	RESEARCH_COMPOSER_LABEL,
	RESEARCH_CHIP_TITLE,
	RESEARCH_DELETE_ACTION,
	RESEARCH_DELETE_CONFIRM,
	RESEARCH_FOLLOW_PLACEHOLDER,
	RESEARCH_REVISE_PLACEHOLDER,
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
	askHistoryCardMenuFlags,
	openAskTurnActionFlags,
	RESEARCH_EMAIL_PENDING_NOTE,
	researchHistoryTimestamp,
	researchJobToHistoryEntry,
	wrapAskAnswerHtml,
	askAnswerCopyButtonHtml,
	ASK_CLIPBOARD_COPIED_LABEL,
	ASK_CLIPBOARD_FAILED_LABEL,
	ASK_CLIPBOARD_COPIED_MS,
	ASK_CLIPBOARD_FAILED_MS,
	flashAskButtonFeedback,
	readAskButtonIdle,
	restoreAskButtonIdle,
	researchVerifyStepText,
	isIncompleteResearchTurn,
	researchEditAskInsteadLabel,
	researchRetrySubmitLabel,
	sameResearchRetryQuestion,
	shouldReviseResearchFollow,
	shouldUseResearchAsk,
	followComposerClickShouldExpand,
	followComposerFocusShouldExpand,
	followComposerShouldExpand,
	researchEmptyComposerGated,
	isResearchReviseInProgress,
	researchReportFollowChrome,
	reportFollowToggleLabel,
	RESEARCH_SIGNED_OUT_PLACEHOLDER,
	SEARCH_TERMS_SOURCING_LABEL,
	dedupeSourcingSearchTerms,
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
		assert.equal(
			askFollowPlaceholder({ pending: false, reviseFollow: true }),
			RESEARCH_REVISE_PLACEHOLDER,
		);
	});
});

describe("reportFollowToggleLabel", () => {
	it("switches between Ask a follow-up instead and Revise this report instead", () => {
		assert.equal(reportFollowToggleLabel(false), "Ask a follow-up instead");
		assert.equal(reportFollowToggleLabel(true), "Revise this report instead");
	});
});

describe("followComposerShouldExpand", () => {
	it("stays compact until focus, typed text, or a Revising chip", () => {
		assert.equal(
			followComposerShouldExpand({
				focused: false,
				hasText: false,
				hasReviseChip: false,
			}),
			false,
		);
		assert.equal(
			followComposerShouldExpand({
				focused: true,
				hasText: false,
				hasReviseChip: false,
			}),
			true,
		);
		assert.equal(
			followComposerShouldExpand({
				focused: false,
				hasText: true,
				hasReviseChip: false,
			}),
			true,
		);
		assert.equal(
			followComposerShouldExpand({
				focused: false,
				hasText: false,
				hasReviseChip: true,
			}),
			true,
		);
		assert.equal(
			followComposerShouldExpand({
				focused: false,
				hasText: false,
				hasReviseChip: false,
				pinnedOpen: true,
			}),
			true,
		);
	});
});

describe("followComposerFocusShouldExpand", () => {
	it("ignores focus on the pause/stop send button", () => {
		const { document } = new JSDOM(
			`<!doctype html><body>
				<button class="ai-send" data-ai-stop="1"></button>
				<textarea></textarea>
			</body></html>`,
		).window;
		const stop = document.querySelector("button")!;
		const textarea = document.querySelector("textarea")!;
		assert.equal(followComposerFocusShouldExpand(stop), false);
		assert.equal(followComposerFocusShouldExpand(textarea), true);
	});
});

describe("followComposerClickShouldExpand", () => {
	it("expands on shell clicks but not on pause or tool buttons", () => {
		const { document } = new JSDOM(
			`<!doctype html><body>
				<div class="ai-box">
					<textarea></textarea>
					<button class="ai-send" data-ai-stop="1"></button>
				</div>
			</body></html>`,
		).window;
		const textarea = document.querySelector("textarea")!;
		const stop = document.querySelector("button")!;
		assert.equal(followComposerClickShouldExpand(textarea), true);
		assert.equal(followComposerClickShouldExpand(stop), false);
	});
});

describe("isResearchReviseInProgress", () => {
	it("is true only while a report revise is pending", () => {
		assert.equal(
			isResearchReviseInProgress({
				research: true,
				pending: true,
				hasReport: true,
			}),
			true,
		);
		assert.equal(
			isResearchReviseInProgress({
				research: true,
				pending: true,
				hasReport: false,
			}),
			false,
		);
	});
});

describe("researchReportFollowChrome", () => {
	it("keeps the report dock visible during a pending revise so the reader can stop", () => {
		const accepted = researchReportFollowChrome({
			research: true,
			pending: true,
			hasReport: true,
		});
		assert.equal(accepted.reportDock, true);
		assert.equal(accepted.revisingReport, true);
		assert.equal(accepted.followCompact, true);
	});

	it("uses the compact report dock only after the job is finished", () => {
		const idle = researchReportFollowChrome({
			research: true,
			pending: false,
			hasReport: true,
		});
		assert.equal(idle.reportDock, true);
		assert.equal(idle.revisingReport, false);
		assert.equal(idle.followCompact, true);
	});
});

describe("researchEmptyComposerGated", () => {
	it("gates the empty Research composer until sign-in", () => {
		assert.equal(
			researchEmptyComposerGated({
				researchPane: true,
				hasThread: false,
				quotaReady: true,
				signedIn: false,
			}),
			true,
		);
		assert.equal(
			researchEmptyComposerGated({
				researchPane: true,
				hasThread: false,
				quotaReady: true,
				signedIn: true,
			}),
			false,
		);
		assert.equal(
			researchEmptyComposerGated({
				researchPane: true,
				hasThread: false,
				quotaReady: false,
				signedIn: false,
			}),
			false,
		);
		assert.equal(
			researchEmptyComposerGated({
				researchPane: false,
				hasThread: false,
				quotaReady: true,
				signedIn: false,
			}),
			false,
		);
	});
});

describe("shouldReviseResearchFollow", () => {
	it("revises a finished report unless Research or Ask-without-editing is on", () => {
		assert.equal(
			shouldReviseResearchFollow({
				lastTurnResearch: true,
				lastTurnPending: false,
				hasReport: true,
				researchChipOn: false,
			}),
			true,
		);
		assert.equal(
			shouldReviseResearchFollow({
				lastTurnResearch: true,
				lastTurnPending: false,
				hasReport: true,
				researchChipOn: true,
			}),
			false,
		);
		assert.equal(
			shouldReviseResearchFollow({
				lastTurnResearch: true,
				lastTurnPending: false,
				hasReport: true,
				researchChipOn: false,
				forceAsk: true,
			}),
			false,
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

	it("shows Ask remaining when the research chip is on but no job is running", () => {
		assert.equal(
			askMeterLabel({
				signedIn: true,
				researchOn: askComposerMeterIsResearch({ chipOn: true }),
				askRemaining: 2,
				researchRemaining: 1,
			}),
			"1 research report available today",
		);
		assert.equal(
			askMeterLabel({
				signedIn: true,
				researchOn: askComposerMeterIsResearch({
					chipOn: false,
					researchPending: false,
				}),
				askRemaining: 2,
				researchRemaining: 1,
			}),
			"2 Asks left today",
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

describe("openAskTurnActionFlags", () => {
	const emptyResearch = {
		isTip: true,
		research: true,
		researchJobId: "job-empty",
		resultCount: 0,
		isPinnableTip: false,
	};

	it("shows Delete on an empty-result Research job", () => {
		const flags = openAskTurnActionFlags(emptyResearch);
		assert.equal(flags.showDelete, true);
		assert.equal(flags.showPin, false);
		assert.equal(flags.showShare, false);
		assert.equal(flags.showDownload, false);
	});

	it("keeps Share and Download when the empty job still has a report", () => {
		const flags = openAskTurnActionFlags({
			...emptyResearch,
			hasReport: true,
		});
		assert.equal(flags.showDelete, true);
		assert.equal(flags.showShare, true);
		assert.equal(flags.showDownload, true);
		assert.equal(flags.showPin, false);
	});

	it("shows Download on a finished Research job with sources", () => {
		const flags = openAskTurnActionFlags({
			isTip: true,
			research: true,
			researchJobId: "job-hits",
			resultCount: 4,
			hasReport: true,
			isPinnableTip: true,
		});
		assert.equal(flags.showDownload, true);
		assert.equal(flags.showShare, true);
	});

	it("does not show Download on Ask — Copy and Share are enough", () => {
		assert.equal(
			openAskTurnActionFlags({
				isTip: true,
				research: false,
				resultCount: 6,
				hasReport: false,
				isPinnableTip: true,
			}).showDownload,
			false,
		);
	});

	it("shows Delete on a failed Research job", () => {
		const flags = openAskTurnActionFlags({
			...emptyResearch,
			error: "Research could not finish. Try again shortly.",
		});
		assert.equal(flags.showDelete, true);
		assert.equal(flags.showShare, false);
		assert.equal(flags.showPin, false);
	});

	it("hides Delete on samples, shares, and in-flight jobs", () => {
		assert.equal(
			openAskTurnActionFlags({ ...emptyResearch, fromSample: true }).showDelete,
			false,
		);
		assert.equal(
			openAskTurnActionFlags({ ...emptyResearch, fromShare: true }).showDelete,
			false,
		);
		assert.equal(
			openAskTurnActionFlags({ ...emptyResearch, pending: true }).showDelete,
			false,
		);
	});

	it("does not show Delete on an Ask with no results", () => {
		assert.equal(
			openAskTurnActionFlags({
				isTip: true,
				research: false,
				resultCount: 0,
				isPinnableTip: false,
			}).showDelete,
			false,
		);
	});
});

describe("askHistoryCardMenuFlags", () => {
	it("shows Delete on a Recent Research card even when signed out", () => {
		const flags = askHistoryCardMenuFlags({ sample: false, signedInForHistory: false });
		assert.equal(flags.showDelete, true);
		assert.equal(flags.showShare, true);
		assert.equal(flags.showPin, false);
	});

	it("hides sample Delete unless signed in", () => {
		assert.equal(
			askHistoryCardMenuFlags({ sample: true, signedInForHistory: false }).showDelete,
			false,
		);
		assert.equal(
			askHistoryCardMenuFlags({ sample: true, signedInForHistory: false }).showShare,
			true,
		);
		assert.equal(
			askHistoryCardMenuFlags({ sample: true, signedInForHistory: true }).showDelete,
			true,
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

	it("copies version index and the revised report onto the turn", () => {
		const job = toResearchJobPublic({
			id: "job-v2",
			status: "complete",
			question: "feeling?",
			result: {
				question: "feeling?",
				lookingFor: "vedanā",
				queries: ["feeling"],
				fallbackQueries: [],
				offTopic: false,
				results: [],
				model: "glm",
				reasoning: "",
				report: "## Revised\n",
			},
			versionIndex: [
				{ n: 1, at: 1, instruction: "", changelog: "Original report.", from: null },
				{ n: 2, at: 2, instruction: "add SN 48", changelog: "Added SN 48.", from: 1 },
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
			phase: "answer",
			report: "## Original\n",
		};
		applyResearchJobToTurn(turn, job);
		assert.equal(turn.pending, false);
		assert.equal(turn.report, "## Revised");
		assert.equal(turn.versionIndex?.[1]?.n, 2);
		assert.equal(turn.versionIndex?.[1]?.changelog, "Added SN 48.");
	});

	it("mergeResearchJobVersionMetadata upgrades a stale local v2 heal to the server index", () => {
		const job = toResearchJobPublic({
			id: "job-v16",
			status: "complete",
			question: "mindfulness?",
			createdAt: 1,
			versionIndex: Array.from({ length: 16 }, (_, i) => ({
				n: i + 1,
				at: i + 1,
				instruction: i === 0 ? "" : `revise ${i + 1}`,
				changelog: i === 0 ? "Original report." : `Change ${i + 1}.`,
				from: i === 0 ? null : i,
			})),
		});
		const turn: ResearchTurnFields = {
			question: "mindfulness?",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			pending: false,
			phase: "done",
			report: "# Cached report\n",
			versionIndex: [
				{ n: 1, at: 1, instruction: "", changelog: "Original report.", from: null },
				{ n: 2, at: 2, instruction: "", changelog: "Revised the report.", from: 1 },
			],
		};
		assert.equal(mergeResearchJobVersionMetadata(turn, job), true);
		assert.equal(turn.versionIndex?.length, 16);
		assert.equal(turn.versionIndex?.[15]?.n, 16);
		assert.equal(turn.report, "# Cached report\n");
	});

	it("recovers v2 when process hops show a revise but the index stayed on v1", () => {
		const job = toResearchJobPublic({
			id: "job-heal",
			status: "complete",
			question: "feeling?",
			processNotes: [
				"Started v2 revision",
				"Considered the revision",
				"Revised the report · v2",
			],
			result: {
				question: "feeling?",
				lookingFor: "vedanā",
				queries: ["feeling"],
				fallbackQueries: [],
				offTopic: false,
				results: [],
				model: "glm",
				reasoning: "",
				report: "## Revised\n",
			},
			versionIndex: [
				{ n: 1, at: 1, instruction: "", changelog: "Original report.", from: null },
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
			pending: false,
			phase: "done",
			report: "## Original\n",
		};
		applyResearchJobToTurn(turn, job);
		assert.equal(turn.versionIndex?.[1]?.n, 2);
		assert.equal(turn.versionIndex?.[1]?.changelog, "Revised the report.");
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
		assert.match(html, /data-ai-report-paragraphs/);
	});

	it("puts version and stats on the report toolbar without a kicker", () => {
		const html = wrapAskAnswerHtml({
			kind: "report",
			turnIndex: 0,
			versionStart: `<button type="button" class="ai-versions-btn">v2</button>`,
			stats: "18 words · 2 citations",
			bodyHtml: "<p>Hello</p>",
		});
		assert.match(html, /ai-answer-toolbar-start/);
		assert.match(html, /ai-versions-btn/);
		assert.match(html, /ai-report-stats-row/);
		assert.match(html, /ai-report-actions-group/);
		assert.match(html, /ai-report-stats/);
		assert.match(html, /18 words · 2 citations/);
		assert.doesNotMatch(html, /Research report/);
		assert.doesNotMatch(html, /ai-report-kicker/);
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

describe("flashAskButtonFeedback", () => {
	function copyButton(placement: "start" | "end"): HTMLButtonElement {
		const html = askAnswerCopyButtonHtml({
			turnIndex: 0,
			kind: "report",
			placement,
		});
		const { window } = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
		const button = window.document.querySelector("button");
		assert.ok(button);
		return button;
	}

	it("keeps the Copy label and swaps the icon to a tick", () => {
		const button = copyButton("start");
		const idle = readAskButtonIdle(button);
		const scheduled: Array<[() => void, number]> = [];
		flashAskButtonFeedback(
			button,
			ASK_CLIPBOARD_COPIED_LABEL,
			"copied",
			idle,
			(fn, ms) => scheduled.push([fn, ms]),
		);
		const label = button.querySelector<HTMLElement>(".ai-answer-copy-label");
		assert.ok(label);
		assert.equal(label.hidden, true);
		assert.equal(label.textContent, "Copy");
		assert.match(button.innerHTML, /m4\.5 12\.75 6 6 9-13\.5/);
		assert.equal(button.getAttribute("aria-label"), "Copied");
		assert.equal(button.getAttribute("title"), "Copied");
		assert.equal(button.classList.contains("is-copied"), true);
		assert.equal(button.classList.contains("is-copy-error"), false);
		assert.equal(button.disabled, true);
		assert.equal(scheduled[0]?.[1], ASK_CLIPBOARD_COPIED_MS);
		scheduled[0]?.[0]();
		const restored = button.querySelector<HTMLElement>(".ai-answer-copy-label");
		assert.ok(restored);
		assert.equal(restored.hidden, true);
		assert.equal(restored.textContent, "Copy");
		assert.doesNotMatch(button.innerHTML, /m4\.5 12\.75 6 6 9-13\.5/);
		assert.equal(button.getAttribute("aria-label"), "Copy report");
		assert.equal(button.disabled, false);
		assert.equal(button.classList.contains("is-copied"), false);
	});

	it("shows a distinct error state on Copy report", () => {
		const button = copyButton("end");
		const idle = readAskButtonIdle(button);
		const scheduled: Array<[() => void, number]> = [];
		flashAskButtonFeedback(
			button,
			ASK_CLIPBOARD_FAILED_LABEL,
			"error",
			idle,
			(fn, ms) => scheduled.push([fn, ms]),
		);
		const label = button.querySelector<HTMLElement>(".ai-answer-copy-label");
		assert.equal(label?.textContent, "Could not copy");
		assert.equal(button.classList.contains("is-copied"), false);
		assert.equal(button.classList.contains("is-copy-error"), true);
		assert.equal(scheduled[0]?.[1], ASK_CLIPBOARD_FAILED_MS);
		scheduled[0]?.[0]();
		assert.equal(
			button.querySelector(".ai-answer-copy-label")?.textContent,
			"Copy",
		);
		assert.equal(button.classList.contains("is-copy-error"), false);
	});

	it("restores a Share link control after Link copied", () => {
		const { window } = new JSDOM(
			`<!doctype html><html><body>
				<button type="button">
					<span class="ai-share-label-full">Share link</span>
					<span class="ai-share-label-short">Share</span>
				</button>
			</body></html>`,
		);
		const button = window.document.querySelector("button");
		assert.ok(button);
		const idle = readAskButtonIdle(button);
		flashAskButtonFeedback(button, "Link copied", "copied", idle, () => {});
		assert.equal(
			button.querySelector(".ai-share-label-full")?.textContent,
			"Link copied",
		);
		assert.equal(
			button.querySelector(".ai-share-label-short")?.textContent,
			"Link copied",
		);
		restoreAskButtonIdle(button, idle);
		assert.equal(
			button.querySelector(".ai-share-label-full")?.textContent,
			"Share link",
		);
	});
});

describe("Research pane copy", () => {
	it("keeps Ask and Research wording on separate lanes", () => {
		assert.equal(ASK_PLACEHOLDER, "Ask a question about the discourses…");
		assert.equal(
			RESEARCH_PLACEHOLDER,
			"Ask for a cited report based on the Words of the Buddha…",
		);
		assert.equal(
			RESEARCH_SIGNED_OUT_PLACEHOLDER,
			"Create an account or Sign in to start a research",
		);
		assert.equal(ASK_COMPOSER_LABEL, "Ask a question");
		assert.equal(RESEARCH_COMPOSER_LABEL, "Ask for a cited report");
		assert.equal(
			RESEARCH_CHIP_TITLE,
			"A few questions first, then a cited report based on the Words of the Buddha. We’ll email you when it’s ready.",
		);
		assert.equal(ASK_HISTORY_LABEL, "Recent Asks");
		assert.equal(RESEARCH_HISTORY_LABEL, "Recent reports");
		assert.equal(
			ASK_LIMITS_NOTE,
			"Freely accessible · made possible by generous donors",
		);
		assert.equal(RESEARCH_LIMITS_NOTE, ASK_LIMITS_NOTE);
		assert.equal(
			askSponsorNoteVisible({
				askSurface: true,
				research: false,
				signedIn: false,
			}),
			true,
		);
		assert.equal(
			askSponsorNoteVisible({
				askSurface: true,
				research: true,
				signedIn: false,
			}),
			true,
		);
		assert.equal(
			askSponsorNoteVisible({
				askSurface: true,
				research: false,
				signedIn: true,
				hasThread: true,
			}),
			false,
		);
		assert.equal(
			askSponsorNoteVisible({
				askSurface: false,
				research: false,
				signedIn: false,
			}),
			false,
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
		assert.equal(ASK_PIN_ACCOUNT_TITLE, "Pin Asks");
		assert.equal(
			RESEARCH_PIN_ACCOUNT_TITLE,
			"Pin this report",
		);
		assert.equal(ASK_SHARE_ACCOUNT_TITLE, "Share this Ask");
		assert.equal(
			RESEARCH_SHARE_ACCOUNT_TITLE,
			"Share this report",
		);
		assert.equal(RESEARCH_SIGNIN_TITLE, "Run Research");
		assert.equal(
			RESEARCH_SIGNIN_BODY,
			"Perform a deep search of the Words of the Buddha and get a cited report. Create a free account to get started with Research.",
		);
		assert.equal(
			RESEARCH_SIGNIN_EMPTY_NOTE,
			"Create an account to generate your own",
		);
		assert.equal(
			RESEARCH_INVITE_AFTER_ASK,
			"Looking for a wider search and a cited report? Try Research",
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

describe("researchHistoryCardStatsLabel", () => {
	it("prefixes the current version on history cards", () => {
		assert.equal(
			researchHistoryCardStatsLabel({
				report: "See MN 10 and SN 47.1 for more detail here.",
				versionIndex: [
					{ n: 1, at: 1, instruction: "", changelog: "", from: null },
					{ n: 2, at: 2, instruction: "", changelog: "", from: 1 },
				],
			}),
			"v2 · 10 words · 2 citations",
		);
	});
});

describe("researchHistoryStatsLabel", () => {
	it("reports word count, unique discourses cited, and leftover sources", () => {
		assert.equal(researchHistoryStatsLabel(""), "");
		assert.equal(researchHistoryStatsLabel("   "), "");
		const report = `## Attention

MN 10 sets out mindfulness of the body. SN 47.1 repeats the four establishments. MN 10 again.

## Sources

- MN 10 — Kayagata-sati
- SN 47.1 — Ambapali
- SN 46.2 — Food
`;
		assert.equal(
			researchHistoryStatsLabel(report),
			"18 words · 2 citations",
		);
		assert.equal(
			researchHistoryStatsLabel(report, [
				{ slug: "mn10" },
				{ slug: "sn47.1" },
				{ slug: "sn46.2" },
			]),
			"18 words · 2 citations · 1 additional source",
		);
		assert.equal(
			researchHistoryStatsLabel(report, [
				{ slug: "mn10" },
				{ slug: "sn47.1" },
				{ slug: "sn46.2" },
				{ slug: "sn46.51" },
			]),
			"18 words · 2 citations · 2 additional sources",
		);
		assert.equal(
			researchHistoryStatsLabel("See MN 10.", [{ slug: "mn10" }]),
			"3 words · 1 citation",
		);
		assert.equal(researchHistoryStatsLabel("No citations here."), "3 words");
		assert.equal(
			researchHistoryStatsLabel(
				`${RESEARCH_REPORT_LENGTH_NOTE_MD}\n\nNo citations here.`,
			),
			"3 words",
		);
		assert.equal(
			researchHistoryStatsLabel("No citations here.", [
				{ slug: "mn10" },
				{ slug: "sn47.1" },
			]),
			"3 words · 2 sources",
		);
		assert.equal(
			researchHistoryStatsLabel("", [], {
				words: 4962,
				cited: 37,
				additional: 21,
			}),
			"4,962 words · 37 citations · 21 additional sources",
		);
	});
});

describe("dedupeSourcingSearchTerms", () => {
	it("merges primary and fallback queries without duplicates", () => {
		assert.equal(SEARCH_TERMS_SOURCING_LABEL, "Search queries used for sourcing:");
		assert.deepEqual(
			dedupeSourcingSearchTerms(
				["sati", "mindfulness", "satipaṭṭhāna"],
				["mindfulness", "establishments of mindfulness", "satipaṭṭhāna"],
			),
			["sati", "mindfulness", "satipaṭṭhāna", "establishments of mindfulness"],
		);
	});

	it("dedupes case-insensitively while keeping the first spelling", () => {
		assert.deepEqual(
			dedupeSourcingSearchTerms(["Mindfulness"], ["mindfulness"]),
			["Mindfulness"],
		);
	});
});

describe("revise clarify on the turn", () => {
	const questions = [
		{
			id: "which",
			prompt: "Which paragraph repeats the other?",
			choices: [
				{ id: "a", label: "¶11 “The claim…”", blockId: "p11" },
				{ id: "b", label: "¶12 “Three further…”", blockId: "p12" },
				{ id: "other", label: "Other", other: true },
			],
			suggestedChoiceId: "b",
		},
	];
	const incoming = {
		id: "rc_1",
		questions,
		interpretation: "delete ¶12 (duplicate of ¶11)",
		fromVersion: 8,
		expiresAt: 10,
	};

	it("starts from the planner's suggestion and keeps the reader's picks across polls", () => {
		const first = nextReviseClarifyDraft(undefined, incoming);
		assert.deepEqual(first?.answers, { which: { choiceId: "b" } });
		const edited = { ...first!, answers: { which: { choiceId: "a" } } };
		const again = nextReviseClarifyDraft(edited, incoming);
		assert.deepEqual(again?.answers, { which: { choiceId: "a" } });
		const fresh = nextReviseClarifyDraft(edited, { ...incoming, id: "rc_2" });
		assert.deepEqual(fresh?.answers, { which: { choiceId: "b" } });
		assert.equal(nextReviseClarifyDraft(edited, undefined), undefined);
	});

	it("keeps process notes when a revise fails", () => {
		const turn = {
			question: "q",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			pending: true,
			phase: "answer" as const,
			research: true,
			report: "Alpha.",
			processNotes: [
				"Read MN 70 in full",
				"Started v13 revision…",
				"Considering the revision…",
				"Revising the report…",
			],
		};
		const failed = toResearchJobPublic({
			id: "j1",
			status: "complete",
			question: "q",
			error: "Could not revise the report. Try a shorter direction.",
			processNotes: turn.processNotes,
			result: {
				question: "q",
				lookingFor: "",
				queries: [],
				fallbackQueries: [],
				offTopic: false,
				results: [],
				model: "",
				reasoning: "",
				report: "Alpha.",
			},
		});
		applyResearchJobToTurn(turn, failed);
		assert.deepEqual(turn.processNotes, failed.processNotes);
	});

	it("surfaces a revise failure that returns complete with an error field", () => {
		const turn = {
			question: "q",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			pending: true,
			phase: "answer" as const,
			research: true,
			report: "Alpha.",
		};
		const failed = toResearchJobPublic({
			id: "j1",
			status: "complete",
			question: "q",
			error: "Could not revise the report. Try a shorter direction.",
			result: { question: "q", lookingFor: "", queries: [], fallbackQueries: [], offTopic: false, results: [], model: "", reasoning: "", report: "Alpha." },
		});
		applyResearchJobToTurn(turn, failed);
		assert.equal(turn.pending, false);
		assert.equal(turn.error, "Could not revise the report. Try a shorter direction.");
	});

	it("applyResearchJobToTurn carries the pause in and clears it on resume", () => {
		const turn = {
			question: "q",
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			model: "",
			reasoning: "",
			pending: false,
			phase: "done" as const,
			research: true,
			report: "Alpha.",
		};
		const paused = toResearchJobPublic({
			id: "j1",
			status: "revise-clarifying",
			question: "q",
			reviseClarify: incoming,
		});
		applyResearchJobToTurn(turn, paused);
		assert.equal(turn.pending, true);
		assert.equal(isResearchReviseClarifying(turn), true);
		assert.equal((turn as { reviseClarify?: { id: string } }).reviseClarify?.id, "rc_1");
		const resumed = toResearchJobPublic({ id: "j1", status: "revising", question: "q" });
		applyResearchJobToTurn(turn, resumed);
		assert.equal(isResearchReviseClarifying(turn), false);
		assert.equal((turn as { reviseClarify?: unknown }).reviseClarify, undefined);
	});

	it("finds the rendered block a choice points at", () => {
		const dom = new JSDOM(
			`<div class="ai-answer-body">
				<h2>One</h2>
				<p data-paragraph-number="1">Alpha</p>
				<blockquote data-paragraph-number="2">Quote</blockquote>
				<h3>Two</h3>
				<pre><code>mermaid</code></pre>
				<table><tr><td>t</td></tr></table>
				<p>Beta</p>
			</div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		assert.equal(findReportBlockElement(body, "p2")?.textContent, "Quote");
		// Undecorated bodies fall back to document order of the ¶ selector.
		assert.equal(findReportBlockElement(body, "p3")?.textContent, "Beta");
		assert.equal(findReportBlockElement(body, "h2")?.textContent, "Two");
		assert.equal(findReportBlockElement(body, "c1")?.tagName, "PRE");
		assert.equal(findReportBlockElement(body, "t1")?.tagName, "TABLE");
		assert.equal(findReportBlockElement(body, "p9"), null);
		assert.equal(findReportBlockElement(body, "junk"), null);
	});
});
