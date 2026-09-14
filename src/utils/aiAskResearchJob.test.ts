import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	dropOpenResearchRevisionCycle,
	revisionCycleShippedNote,
	isResearchJobReviseClarifying,
	isResearchJobRetryable,
	isResearchJobRevising,
	isResearchJobTerminal,
	parseResearchJobStatus,
	rememberResearchProcessNote,
	researchJobPhase,
	researchJobRetryReusesCredit,
	researchProcessHopLabels,
	researchRevisedLabel,
	splitResearchReviseHopLabels,
	interleaveResearchRevisionStartedHops,
	toResearchJobPublic,
} from "./aiAskResearchJob";

describe("research job status machine", () => {
	it("maps statuses onto Ask process phases", () => {
		assert.equal(researchJobPhase("queued"), "rewrite");
		assert.equal(researchJobPhase("running"), "rewrite");
		assert.equal(researchJobPhase("verify"), "search");
		assert.equal(researchJobPhase("searching"), "search");
		assert.equal(researchJobPhase("crunching"), "rerank");
		assert.equal(researchJobPhase("reviewing"), "review");
		assert.equal(researchJobPhase("answering"), "answer");
		assert.equal(researchJobPhase("revising"), "answer");
		assert.equal(parseResearchJobStatus("revising"), "revising");
		assert.equal(parseResearchJobStatus("reviewing"), "reviewing");
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
		assert.equal(isResearchJobTerminal("revising"), false);
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

	it("exposes a version changelog index on the public job", () => {
		const view = toResearchJobPublic({
			id: "job-v",
			status: "complete",
			question: "feeling?",
			versionIndex: [
				{
					n: 1,
					at: 1,
					instruction: "",
					changelog: "Original report.",
					from: null,
				},
				{
					n: 2,
					at: 2,
					instruction: "warmer",
					changelog: "Warmer tone.",
					from: 1,
				},
			],
		});
		assert.equal(view.versionIndex?.[1]?.changelog, "Warmer tone.");
		assert.equal(view.versionIndex?.[1]?.n, 2);
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

	it("exposes durable process hops on the public job", () => {
		const view = toResearchJobPublic({
			id: "job-7",
			status: "complete",
			question: "feeling?",
			processNotes: [
				"Searching again · 3 of 3 queries",
				"Reading MN 70 in Pāli and English…",
				"Reading MN 70 in full…",
			],
		});
		assert.deepEqual(view.processNotes, [
			"Searching again · 3 of 3 queries",
			"Reading MN 70 in Pāli and English…",
			"Reading MN 70 in full…",
		]);
	});
});

describe("rememberResearchProcessNote", () => {
	it("skips first-pass search, crunch, and write notes", () => {
		assert.deepEqual(
			rememberResearchProcessNote([], "Searching · 2 of 8 queries"),
			[],
		);
		assert.deepEqual(
			rememberResearchProcessNote([], "Crunching 80 discourses…"),
			[],
		);
		assert.deepEqual(
			rememberResearchProcessNote([], "Ranking 80 discourses…"),
			[],
		);
		assert.deepEqual(
			rememberResearchProcessNote([], "Writing the report…"),
			[],
		);
		assert.deepEqual(
			rememberResearchProcessNote([], "Reviewing the evidence…"),
			[],
		);
		assert.deepEqual(
			rememberResearchProcessNote([], "Started v2 revision…"),
			["Started v2 revision…"],
		);
		assert.deepEqual(
			researchProcessHopLabels(["Started v3 revision…", "Considering the revision…"]),
			["Started v3 revision", "Considered the revision"],
		);
	});

	it("replaces the last search-again note and keeps distinct reads", () => {
		let notes = rememberResearchProcessNote([], "Searching again…");
		notes = rememberResearchProcessNote(notes, "Searching again · 1 of 3 queries");
		notes = rememberResearchProcessNote(notes, "Searching again · 3 of 3 queries");
		notes = rememberResearchProcessNote(notes, "Reading MN 70 in full…");
		notes = rememberResearchProcessNote(
			notes,
			"Reading MN 70, SN 48.53 in Pāli and English…",
		);
		assert.deepEqual(notes, [
			"Searching again · 3 of 3 queries",
			"Reading MN 70 in full…",
			"Reading MN 70, SN 48.53 in Pāli and English…",
		]);
	});

	it("keeps every revision cycle's hops and only shows shipped revise hops", () => {
		let notes: string[] = ["Reading MN 70 in full…"];
		const cycle = (n: number) => {
			notes = rememberResearchProcessNote(notes, `Started v${n} revision…`);
			notes = rememberResearchProcessNote(notes, "Considering the revision…");
			notes = rememberResearchProcessNote(notes, "Reading SN 48.42 in full…");
			notes = rememberResearchProcessNote(notes, "Revising the report…");
			notes = rememberResearchProcessNote(notes, researchRevisedLabel(n));
		};
		cycle(2);
		cycle(3);
		// Identical hops in later cycles used to be deduped away, leaving only
		// a run of “Started vN revision” dividers.
		assert.equal(notes.filter((n) => /^Considering/.test(n)).length, 2);
		assert.equal(notes.filter((n) => /^Reading SN 48\.42/.test(n)).length, 2);
		assert.deepEqual(researchProcessHopLabels(notes), [
			"Read MN 70 in full",
			"Started v2 revision",
			"Considered the revision",
			"Read SN 48.42 in full",
			"Revised the report · v2",
			"Started v3 revision",
			"Considered the revision",
			"Read SN 48.42 in full",
			"Revised the report · v3",
		]);
		assert.equal(researchRevisedLabel(3), "Revised the report · v3");
	});

	it("does not treat an in-flight “Revising…” hop as a shipped version", () => {
		const notes = [
			"Started v13 revision…",
			"Considering the revision…",
			"Plan: fence ¶79 diagram",
			"Revising the report…",
		];
		assert.deepEqual(researchProcessHopLabels(notes), [
			"Started v13 revision",
			"Considered the revision",
			"Plan: fence ¶79 diagram",
		]);
	});

	it("labels finished hops in the past tense", () => {
		assert.deepEqual(
			researchProcessHopLabels(
				[
					"Reviewing the evidence…",
					"Searching again · 3 of 3 queries",
					"Going deeper · 2 of 2 queries",
					"Reading MN 70 in Pāli and English…",
					"Reading MN 70 in full…",
					"Reviewing the report…",
				],
				"Reading MN 70 in full…",
			),
			[
				"Searched again · 3 of 3 queries",
				"Going deeper · 2 of 2 queries",
				"Read MN 70 in Pāli and English",
				"Reviewed the report",
			],
		);
	});
});

describe("research job public extras", () => {
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

	it("keeps a Research-sized hit list, not Ask’s survey 55", () => {
		const hits = Array.from({ length: 80 }, (_, index) => ({
			slug: `mn${index + 1}`,
			title: `Discourse ${index + 1}`,
			description: "body",
			contentSnippet: null,
			referenceOnly: false,
			href: `/mn${index + 1}`,
		}));
		const view = toResearchJobPublic({
			id: "job-wide",
			status: "complete",
			question: "mindfulness?",
			result: {
				question: "mindfulness?",
				lookingFor: "satipaṭṭhāna",
				queries: ["satipaṭṭhāna"],
				fallbackQueries: [],
				offTopic: false,
				results: hits,
				model: "glm",
				reasoning: "",
				report: "## Report\n",
			},
		});
		assert.equal(view.result?.results.length, 80);
	});
});

describe("interleaveResearchRevisionStartedHops", () => {
	it("inserts Started v2 before the first considering hop", () => {
		assert.deepEqual(
			interleaveResearchRevisionStartedHops([
				"Considered the revision",
				"Looked up additional discourses",
				"Revised the report",
			]),
			[
				"Started v2 revision",
				"Considered the revision",
				"Looked up additional discourses",
				"Revised the report",
			],
		);
	});

	it("adds Started v3 when a second revise is in flight", () => {
		assert.deepEqual(
			interleaveResearchRevisionStartedHops(
				[
					"Started v2 revision",
					"Considered the revision",
					"Revised the report",
				],
				{ currentN: 2, revising: true },
			),
			[
				"Started v2 revision",
				"Considered the revision",
				"Revised the report",
				"Started v3 revision",
			],
		);
	});
});


describe("revise-clarifying: a revision paused on the planner's questions", () => {
	const clarify = {
		id: "rc_1",
		questions: [
			{
				id: "which",
				prompt: "Which paragraph repeats the other?",
				choices: [{ id: "a", label: "¶11 “The claim…”", blockId: "p11" }],
			},
		],
		interpretation: "delete p12 (duplicate of p11)",
		fromVersion: 8,
		expiresAt: Date.now() + 60_000,
	};

	it("is an open, non-terminal revising state in the answer phase", () => {
		assert.equal(parseResearchJobStatus("revise-clarifying"), "revise-clarifying");
		assert.equal(isResearchJobTerminal("revise-clarifying"), false);
		assert.equal(isResearchJobRevising("revise-clarifying"), true);
		assert.equal(isResearchJobReviseClarifying("revise-clarifying"), true);
		assert.equal(isResearchJobReviseClarifying("revising"), false);
		assert.equal(researchJobPhase("revise-clarifying"), "answer");
	});

	it("exposes the questions only while paused", () => {
		const paused = toResearchJobPublic({
			id: "j1",
			status: "revise-clarifying",
			question: "Mindfulness",
			reviseClarify: clarify,
		});
		assert.equal(paused.pending, true);
		assert.equal(paused.reviseClarify?.id, "rc_1");
		assert.equal(paused.reviseClarify?.interpretation, "delete ¶12 (duplicate of ¶11)");
		assert.equal(paused.reviseClarify?.fromVersion, 8);
		assert.equal(paused.reviseClarify?.questions[0].choices[0].blockId, "p11");
		// Other appended by the sanitizer; no “No preference” on a revise.
		assert.deepEqual(
			paused.reviseClarify?.questions[0].choices.map((c) => c.id),
			["a", "other"],
		);
		const resumed = toResearchJobPublic({
			id: "j1",
			status: "revising",
			question: "Mindfulness",
			reviseClarify: clarify,
		});
		assert.equal(resumed.reviseClarify, undefined);
	});

	it("keeps the plan as a hop but never the waiting note", () => {
		let notes = rememberResearchProcessNote([], "Started v11 revision…");
		notes = rememberResearchProcessNote(notes, "Considering the revision…");
		notes = rememberResearchProcessNote(notes, "Plan: delete ¶12 (duplicate of ¶11)");
		notes = rememberResearchProcessNote(notes, "Waiting for your answer…");
		assert.deepEqual(notes, [
			"Started v11 revision…",
			"Considering the revision…",
			"Plan: delete ¶12 (duplicate of ¶11)",
		]);
		// After the answers the planner runs again: the plan hop is replaced, not stacked.
		notes = rememberResearchProcessNote(notes, "Considering the revision…");
		notes = rememberResearchProcessNote(notes, "Plan: delete ¶12 · fence the diagram in ¶72");
		assert.deepEqual(notes.slice(-1), ["Plan: delete ¶12 · fence the diagram in ¶72"]);
		const labels = researchProcessHopLabels(notes);
		assert.deepEqual(labels, [
			"Started v11 revision",
			"Considered the revision",
			"Plan: delete ¶12 · fence the diagram in ¶72",
		]);
		assert.deepEqual(splitResearchReviseHopLabels(["Read MN 10", ...labels]).revise, labels);
	});

	it("drops an abandoned cycle's hops, but never a cycle that shipped a version", () => {
		const open = [
			"Read MN 10",
			"Started v10 revision…",
			"Considering the revision…",
			"Revising the report…",
			"Started v11 revision…",
			"Considering the revision…",
			"Plan: delete ¶12",
		];
		assert.deepEqual(dropOpenResearchRevisionCycle(open), open.slice(0, 4));
		const closed = [
			"Read MN 10",
			"Started v10 revision…",
			"Considering the revision…",
			"Revised the report · v10",
		];
		assert.deepEqual(dropOpenResearchRevisionCycle(closed), closed);
		assert.equal(revisionCycleShippedNote("Revised the report · v10"), true);
		assert.equal(revisionCycleShippedNote("Revising the report…"), false);
		assert.deepEqual(dropOpenResearchRevisionCycle(["Read MN 10"]), ["Read MN 10"]);
		assert.deepEqual(dropOpenResearchRevisionCycle(undefined), []);
	});
});
