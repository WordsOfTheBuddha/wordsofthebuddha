import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toResearchJobPublic } from "./aiAskResearchJob";
import {
	applyResearchJobToTurn,
	askComposerMeterIsResearch,
	askMeterLabel,
	canShowResearchChip,
	isAskResearchEnabled,
	RESEARCH_EMAIL_PENDING_NOTE,
	researchJobToHistoryEntry,
	researchVerifyStepText,
	isIncompleteResearchTurn,
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
			"1 research left today",
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
});

describe("researchJobToHistoryEntry", () => {
	it("keeps an in-flight job restorable from Recent", () => {
		const job = toResearchJobPublic({
			id: "job-3",
			status: "searching",
			question: "Who is a sekha?",
		});
		const entry = researchJobToHistoryEntry(job);
		assert.equal(entry.research, true);
		assert.equal(entry.researchJobId, "job-3");
		assert.equal(entry.researchPending, true);
		assert.equal(entry.question, "Who is a sekha?");
		assert.equal(entry.results.length, 0);
	});
});
