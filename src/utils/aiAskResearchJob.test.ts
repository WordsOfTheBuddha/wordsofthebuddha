import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isResearchJobRetryable,
	isResearchJobTerminal,
	parseResearchJobStatus,
	researchJobPhase,
	researchJobRetryReusesCredit,
	toResearchJobPublic,
} from "./aiAskResearchJob";

describe("research job status machine", () => {
	it("maps statuses onto Ask process phases", () => {
		assert.equal(researchJobPhase("queued"), "rewrite");
		assert.equal(researchJobPhase("running"), "rewrite");
		assert.equal(researchJobPhase("verify"), "search");
		assert.equal(researchJobPhase("searching"), "search");
		assert.equal(researchJobPhase("crunching"), "rerank");
		assert.equal(researchJobPhase("answering"), "answer");
		assert.equal(researchJobPhase("complete"), "done");
		assert.equal(researchJobPhase("failed"), "done");
		assert.equal(researchJobPhase("cancelled"), "done");
	});

	it("treats complete/failed/cancelled as terminal", () => {
		assert.equal(isResearchJobTerminal("complete"), true);
		assert.equal(isResearchJobRetryable("cancelled"), true);
		assert.equal(isResearchJobRetryable("failed"), true);
		assert.equal(isResearchJobRetryable("complete"), false);
		assert.equal(
			researchJobRetryReusesCredit({ quotaSettled: true, quotaRefunded: false }),
			true,
		);
		assert.equal(
			researchJobRetryReusesCredit({ quotaSettled: true, quotaRefunded: true }),
			false,
		);
		assert.equal(isResearchJobTerminal("searching"), false);
		assert.equal(parseResearchJobStatus("nope"), null);
		assert.equal(parseResearchJobStatus("verify"), "verify");
	});

	it("keeps a markdown report on the public result", () => {
		const view = toResearchJobPublic({
			id: "job-2",
			status: "complete",
			question: "feeling?",
			result: {
				question: "feeling?",
				lookingFor: "vedanā",
				queries: ["vedana"],
				fallbackQueries: [],
				offTopic: false,
				results: [
					{
						slug: "sn36.1",
						title: "Feeling",
						description: "",
						contentSnippet: null,
						referenceOnly: false,
						href: "/sn36.1",
					},
				],
				model: "glm",
				reasoning: "",
				report: "## Feeling\n\nSN 36.1.\n",
			},
		});
		assert.match(view.result?.report || "", /## Feeling/);
	});

	it("strips the run token from the public view", () => {
		const view = toResearchJobPublic({
			id: "job-1",
			status: "verify",
			question: "feeling?",
			lookingFor: "vedanā",
			verifyNote: "On track · vedanā",
			onTrack: true,
			reasoning: "scout looks right",
		});
		assert.equal(view.pending, true);
		assert.equal(view.phase, "search");
		assert.equal(view.verifyNote, "On track · vedanā");
		assert.equal("runToken" in view, false);
	});

	it("exposes a live progress note", () => {
		const view = toResearchJobPublic({
			id: "job-4",
			status: "searching",
			question: "feeling?",
			progressNote: "Searching · 2 of 8 queries",
		});
		assert.equal(view.progressNote, "Searching · 2 of 8 queries");
		assert.equal(view.phase, "search");
	});

	it("exposes createdAt for history recency", () => {
		const view = toResearchJobPublic({
			id: "job-6",
			status: "searching",
			question: "feeling?",
			createdAt: 1_700_000_000_000,
		});
		assert.equal(view.createdAt, 1_700_000_000_000);
	});

	it("keeps description and PTS on public hits", () => {
		const view = toResearchJobPublic({
			id: "job-5",
			status: "complete",
			question: "Devadaha?",
			result: {
				question: "Devadaha?",
				lookingFor: "devadaha",
				queries: ["devadaha"],
				fallbackQueries: [],
				offTopic: false,
				results: [
					{
						slug: "mn101",
						title: "Devadaha sutta - At Devadaha",
						description:
							"The Buddha critiques the Nigaṇṭhas’ belief that all suffering is determined by past deeds.",
						contentSnippet: null,
						referenceOnly: false,
						href: "/mn101",
						volpage: "PTS 2.214–2.227",
					},
				],
				model: "glm",
				reasoning: "",
				report: "## Report\n\nMN 101.\n",
			},
		});
		assert.equal(view.result?.results[0]?.volpage, "PTS 2.214–2.227");
		assert.match(view.result?.results[0]?.description || "", /Nigaṇṭhas/);
		assert.equal("draftResult" in view, false);
	});
});
