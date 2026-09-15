import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	applyAskProcessStreamPatch,
	applyAskThinkingStreamPatch,
	askReasoningIsLong,
	askResultsCaption,
	askSendShortcutLabel,
	askShouldSurviveDisconnect,
	buildAskProcessSteps,
	displayAskReasoning,
	firstRangeClientRect,
	lastRangeClientRect,
	markChangedReportBlocks,
	markReportBlockDiff,
	reportBlockDiff,
	stampReportBlockKeys,
	reportChangeCount,
	expectedReviseBaseVersionN,
	researchReviseBaseVersionN,
	shouldHydrateReviseBase,
	stampReviseDiffBase,
	reportChangedKeys,
	researchChangesChipLabel,
	researchChangesChipLabelForTurn,
	researchChangesChipVisible,
	researchVersionChangesChipHtml,
	researchVersionRowHtml,
	researchSourcesBlockHtml,
	formatAskRoutingDevHtml,
	isAskSendShortcut,
	mergeAskTurnReasoning,
	renderAskThinkingHtml,
	reviseFloatOffset,
	researchJobApiPath,
	researchPollDelayMs,
	RESEARCH_API_PATH,
	RESEARCH_POLL_RAMP_MS,
	RESEARCH_POLL_START_MS,
	RESEARCH_POLL_STEADY_MS,
	RESEARCH_REVISE_API_PATH,
	aiJsonRequestInit,
	isAiJsonResponse,
	fetchAiJson,
	scrollAskProcessToLatest,
	takeAskSseEvents,
	buildAskFollowUpHistory,
	abbreviateReviseQuote,
	reviseScopeLabel,
	isAiTimeoutError,
	AI_JSON_TIMEOUT_MS,
	AI_JSON_WRITE_TIMEOUT_MS,
	AI_SERVER_TIMEOUT_MESSAGE,
} from "./aiModeClient";
import { researchApiFailureMessage } from "./appApiPath";

function key(
	partial: Partial<
		Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing">
	>,
) {
	return {
		key: "Enter",
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		isComposing: false,
		...partial,
	};
}

describe("isAskSendShortcut", () => {
	it("sends with ⌘Enter or Ctrl+Enter", () => {
		assert.equal(isAskSendShortcut(key({ metaKey: true })), true);
		assert.equal(isAskSendShortcut(key({ ctrlKey: true })), true);
	});

	it("does not send on Enter or Shift+Enter", () => {
		assert.equal(isAskSendShortcut(key({})), false);
		assert.equal(isAskSendShortcut(key({ key: "Enter" })), false);
	});

	it("ignores Alt+Enter and IME composition", () => {
		assert.equal(isAskSendShortcut(key({ altKey: true, metaKey: true })), false);
		assert.equal(isAskSendShortcut(key({ metaKey: true, isComposing: true })), false);
	});
});

describe("askSendShortcutLabel", () => {
	it("uses ⌘ on Apple platforms and Ctrl elsewhere", () => {
		assert.equal(askSendShortcutLabel("MacIntel"), "Send (⌘Enter)");
		assert.equal(askSendShortcutLabel("Win32"), "Send (Ctrl+Enter)");
	});
});

describe("mergeAskTurnReasoning", () => {
	it("streams deltas, clears discarded attempts, and keeps accepted plan reasoning", () => {
		let reasoning = mergeAskTurnReasoning(
			"",
			{ type: "reasoning", delta: "kattikā puṇṇamā\n- ^MN puṇṇama (already tried)" },
		);
		reasoning = mergeAskTurnReasoning(reasoning, { type: "reasoning", reset: true });
		assert.equal(reasoning, "");
		reasoning = mergeAskTurnReasoning(reasoning, {
			type: "plan",
			reasoning: "",
		});
		assert.equal(reasoning, "");
	});

	it("replaces leftover planner notes when Gemini’s empty plan arrives", () => {
		const leftover =
			"The user wants unique awakening narratives under a full moon.\n- ^MN puṇṇama (already tried)";
		assert.equal(
			mergeAskTurnReasoning(leftover, { type: "plan", reasoning: "" }),
			"",
		);
		assert.equal(
			mergeAskTurnReasoning(leftover, {
				type: "plan",
				reasoning: "Prefer SN 51 for bases of power.",
			}),
			"Prefer SN 51 for bases of power.",
		);
	});
});

describe("displayAskReasoning", () => {
	it("hides Gemini/OpenRouter status notes and keeps real reasoning", () => {
		assert.equal(
			displayAskReasoning(
				"(OpenRouter was busy — rewriting with Gemini…)\n(Rewritten with Gemini.)\n(Results re-ranked with Gemini.)",
			),
			"",
		);
		assert.equal(
			displayAskReasoning(
				"Prefer SN 47 for daily mindfulness.\n(Results re-ranked with Gemini.)",
			),
			"Prefer SN 47 for daily mindfulness.",
		);
	});

	it("hides chip and JSON format meta", () => {
		assert.equal(
			displayAskReasoning(
				"Focus on satipaṭṭhāna practice.\nqueries: sati, satipatthana\nReturn JSON only\n{\"lookingFor\":\"mindfulness\"}",
			),
			"Focus on satipaṭṭhāna practice.",
		);
	});

	it("keeps prose that merely starts with a schema word", () => {
		const text =
			"Queries should target the Satipaṭṭhāna Saṃyutta.\nLooking for practical technique rather than doctrine.\nCount on MN 10 and SN 47.19 being present.";
		assert.equal(displayAskReasoning(text), text);
	});

	it("keeps paragraph breaks in the thinking", () => {
		assert.equal(
			displayAskReasoning("First thought.\n\nSecond thought.\n\n\n\nThird."),
			"First thought.\n\nSecond thought.\n\nThird.",
		);
	});
});

describe("renderAskThinkingHtml", () => {
	it("renders paragraphs, lists and inline marks; escapes HTML", () => {
		const html = renderAskThinkingHtml(
			"The user wants **technique**, not doctrine <script>.\n\n- prefer `SN 47`\n- skip verse\n\n### Plan\nUse MN 10 first.",
		);
		assert.match(html, /^<p>The user wants <strong>technique<\/strong>, not doctrine &lt;script&gt;\.<\/p>/);
		assert.match(html, /<ul><li>prefer <code>SN 47<\/code><\/li><li>skip verse<\/li><\/ul>/);
		assert.match(html, /<p><strong>Plan<\/strong><br>Use MN 10 first\.<\/p>/);
		assert.doesNotMatch(html, /<script>/);
	});

	it("handles numbered lists and returns empty for blank input", () => {
		assert.match(renderAskThinkingHtml("1. one\n2) two"), /<ol><li>one<\/li><li>two<\/li><\/ol>/);
		assert.equal(renderAskThinkingHtml("  \n "), "");
	});
});

describe("formatAskRoutingDevHtml", () => {
	it("renders a compact DEV routing line for models actually called", () => {
		const html = formatAskRoutingDevHtml({
			requested: "nvidia/nemotron-3-ultra-550b-a55b:free",
			queue: [
				"nvidia/nemotron-3-ultra-550b-a55b:free",
				"nvidia/nemotron-3.5-lightning:free",
			],
			attempts: ["nvidia/nemotron-3-ultra-550b-a55b:free"],
			skippedCooldown: [],
			failed: [],
			used: "nvidia/nemotron-3-ultra-550b-a55b:free",
			provider: "openrouter",
			degraded: true,
			degradedReason: "no_json",
			reranker: "gemini-3.5-flash-lite",
			writer: "nvidia/nemotron-3-ultra-550b-a55b:free",
		});
		assert.match(html, /ai-dev-routing/);
		assert.match(html, /DEV · called/);
		assert.match(html, /nemotron-3-ultra-550b-a55b/);
		assert.match(html, /planner nemotron-3-ultra-550b-a55b/);
		assert.match(html, /rerank gemini-3\.5-flash-lite/);
		assert.match(html, /write nemotron-3-ultra-550b-a55b/);
		assert.match(html, /simplified \(no_json\)/);
		assert.equal(formatAskRoutingDevHtml(undefined), "");
	});
});

describe("askReasoningIsLong", () => {
	it("flags many lines or long text", () => {
		assert.equal(askReasoningIsLong("short"), false);
		assert.equal(askReasoningIsLong("a\nb\nc\nd\ne"), false);
		assert.equal(askReasoningIsLong("a\nb\nc\nd\ne\nf"), true);
		assert.equal(askReasoningIsLong("x".repeat(700)), true);
	});
});

describe("askShouldSurviveDisconnect", () => {
	it("keeps ranked hits or an off-topic plan when the stream drops", () => {
		assert.equal(askShouldSurviveDisconnect({ results: [] }), false);
		assert.equal(
			askShouldSurviveDisconnect({ results: [{ slug: "mn53" }] }),
			true,
		);
		assert.equal(
			askShouldSurviveDisconnect({ results: [], offTopic: true }),
			true,
		);
	});
});

describe("takeAskSseEvents", () => {
	it("holds a partial frame and emits it when the stream ends", () => {
		const partial = takeAskSseEvents('data: {"type":"results","results":[{"slug":"mn70"}]}');
		assert.equal(partial.events.length, 0);
		assert.match(partial.rest, /mn70/);
		const done = takeAskSseEvents(partial.rest, true);
		assert.equal(done.events[0]?.type, "results");
		assert.equal(done.events[0]?.results?.[0]?.slug, "mn70");
	});
});

describe("askResultsCaption", () => {
	it("names the shown count and the pool it came from", () => {
		assert.equal(
			askResultsCaption({ resultCount: 12, candidateCount: 186 }),
			"Showing 12 discourses · picked from 186",
		);
		assert.equal(askResultsCaption({ resultCount: 1 }), "Showing 1 discourse");
		assert.equal(askResultsCaption({ resultCount: 0, candidateCount: 40 }), "");
		assert.equal(
			askResultsCaption({
				resultCount: 12,
				candidateCount: 186,
				research: true,
			}),
			"Sources · 12 discourses · picked from 186",
		);
	});
});

describe("researchSourcesBlockHtml", () => {
	it("wraps Ask and Research hits in a collapsed details block", () => {
		const research = researchSourcesBlockHtml(
			"Sources · 2 discourses",
			`<div data-result-type="discourse">MN 70</div>`,
		);
		assert.match(research, /<details class="ai-sources">/);
		assert.match(research, /<summary>Sources · 2 discourses<\/summary>/);
		assert.doesNotMatch(research, /\sopen[\s>]/);
		assert.match(research, /MN 70/);

		const ask = researchSourcesBlockHtml(
			"Showing 12 discourses · picked from 186",
			`<div data-result-type="discourse">MN 10</div>`,
		);
		assert.match(ask, /<details class="ai-sources">/);
		assert.match(ask, /<summary>Showing 12 discourses · picked from 186<\/summary>/);
	});
});

describe("buildAskProcessSteps", () => {
	it("keeps crunching and showing as separate steps", () => {
		const ranking = buildAskProcessSteps({
			pending: true,
			phase: "rerank",
			question: "what is mindfulness?",
			lookingFor: "mindfulness",
			candidateCount: 186,
			showCount: 10,
		});
		assert.equal(ranking.length, 4);
		assert.equal(ranking[2]?.state, "active");
		assert.equal(ranking[2]?.text, "Crunching 186 discourses…");
		assert.doesNotMatch(ranking[2]?.text || "", /showing/);
		assert.equal(ranking[3]?.state, "todo");
		assert.match(ranking[3]?.text || "", /Show the best matches/);

		const writing = buildAskProcessSteps({
			pending: true,
			phase: "answer",
			question: "what is mindfulness?",
			lookingFor: "mindfulness",
			candidateCount: 186,
			showCount: 12,
		});
		assert.equal(writing[2]?.state, "done");
		assert.equal(writing[2]?.text, "Picked 12 discourses");
		assert.equal(writing[3]?.state, "active");
		assert.match(writing[3]?.text || "", /Writing from the selected discourses/);

		const done = buildAskProcessSteps({
			pending: false,
			phase: "done",
			question: "what is mindfulness?",
			lookingFor: "mindfulness",
			candidateCount: 186,
			resultCount: 12,
		});
		assert.equal(done.length, 3);
		assert.equal(done[0]?.text, "Understood · mindfulness");
		assert.match(done[1]?.text || "", /Searched the library · 186 discourses/);
		assert.equal(done[2]?.text, "Picked 12 discourses");
	});

	it("shows research continue notes as live progress", () => {
		const review = buildAskProcessSteps({
			pending: true,
			phase: "answer",
			question: "feeling?",
			research: true,
			progressNote: "Reviewing the report…",
			candidateCount: 80,
			showCount: 12,
		});
		assert.equal(review[3]?.state, "done");
		assert.equal(review[3]?.text, "Reviewed the evidence");
		assert.equal(review[4]?.state, "active");
		assert.equal(review[4]?.text, "Reviewing the report…");

		const deeper = buildAskProcessSteps({
			pending: true,
			phase: "search",
			question: "feeling?",
			research: true,
			progressNote: "Going deeper…",
			candidateCount: 80,
		});
		assert.equal(deeper[1]?.state, "active");
		assert.equal(deeper[1]?.text, "Going deeper…");
	});

	it("does not insert a plan-verify step for Research", () => {
		const pending = buildAskProcessSteps({
			pending: true,
			phase: "search",
			question: "feeling?",
			lookingFor: "vedanā",
			research: true,
		});
		assert.equal(pending.length, 5);
		assert.equal(pending[0]?.state, "done");
		assert.equal(pending[1]?.state, "active");
		assert.equal(pending[1]?.text, "Searching widely…");
		assert.equal(pending[2]?.text, "Rank and pick");
		assert.equal(pending[3]?.text, "Review evidence");
		assert.equal(pending[3]?.state, "todo");
		assert.equal(pending[4]?.text, "Write the report");
		assert.equal(
			pending.some((step) => /on track|first hits|verify/i.test(step.text)),
			false,
		);

		const done = buildAskProcessSteps({
			pending: false,
			phase: "done",
			question: "feeling?",
			lookingFor: "vedanā",
			research: true,
			candidateCount: 186,
			resultCount: 18,
		});
		assert.equal(done.length, 5);
		assert.equal(
			done[1]?.text,
			"Searched widely, found 186 discourse matches",
		);
		assert.equal(done[2]?.text, "Ranked and picked 18 discourses");
		assert.equal(done[3]?.text, "Reviewed the evidence");
		assert.equal(done[4]?.text, "Wrote the report");
	});

	it("appends live revise hops after Wrote the report", () => {
		const revising = buildAskProcessSteps({
			pending: true,
			phase: "answer",
			question: "feeling?",
			lookingFor: "vedanā",
			research: true,
			hasReport: true,
			candidateCount: 186,
			showCount: 18,
			resultCount: 18,
			progressNote: "Revising the report…",
			processNotes: [
				"Reading MN 70 in full…",
				"Considering the revision…",
				"Looking up additional discourses…",
			],
		});
		assert.deepEqual(
			revising.map((step) => `${step.state}:${step.text}`),
			[
				"done:Understood · vedanā",
				"done:Searched widely, found 186 discourse matches",
				"done:Ranked and picked 18 discourses",
				"done:Reviewed the evidence",
				"done:Read MN 70 in full",
				"done:Wrote the report",
				"done:Started v2 revision",
				"done:Considered the revision",
				"done:Looked up additional discourses",
				"active:Revising the report…",
			],
		);

		const done = buildAskProcessSteps({
			pending: false,
			phase: "done",
			question: "feeling?",
			lookingFor: "vedanā",
			research: true,
			hasReport: true,
			candidateCount: 186,
			resultCount: 18,
			processNotes: [
				"Reading MN 70 in full…",
				"Considering the revision…",
				"Revising the report…",
			],
		});
		assert.equal(done.at(-1)?.text, "Revised the report");
		assert.equal(done.at(-2)?.text, "Considered the revision");
		assert.equal(done.at(-3)?.text, "Started v2 revision");
		assert.ok(done.some((step) => step.text === "Wrote the report"));
	});

	it("keeps further searches and reads on the finished research strip", () => {
		const done = buildAskProcessSteps({
			pending: false,
			phase: "done",
			question: "feeling?",
			lookingFor: "vedanā",
			research: true,
			candidateCount: 186,
			resultCount: 18,
			processNotes: [
				"Searching again · 3 of 3 queries",
				"Reading MN 70, SN 48.53 in Pāli and English…",
				"Reading MN 70 in full…",
			],
		});
		assert.deepEqual(
			done.map((step) => step.text),
			[
				"Understood · vedanā",
				"Searched widely, found 186 discourse matches",
				"Ranked and picked 18 discourses",
				"Reviewed the evidence",
				"Searched again · 3 of 3 queries",
				"Read MN 70, SN 48.53 in Pāli and English",
				"Read MN 70 in full",
				"Wrote the report",
			],
		);

		const writing = buildAskProcessSteps({
			pending: true,
			phase: "answer",
			question: "feeling?",
			research: true,
			progressNote: "Reading MN 70 in full…",
			candidateCount: 80,
			showCount: 12,
			processNotes: [
				"Searching again · 3 of 3 queries",
				"Reading MN 70 in full…",
			],
		});
		assert.equal(writing[3]?.text, "Reviewed the evidence");
		assert.equal(writing[4]?.text, "Searched again · 3 of 3 queries");
		assert.equal(writing[5]?.text, "Reading MN 70 in full…");
		assert.equal(
			writing.some((step) => step.text === "Read MN 70 in full"),
			false,
		);
	});

	it("shows unique search matches separately from the ranked set", () => {
		const done = buildAskProcessSteps({
			pending: false,
			phase: "done",
			question: "feeling?",
			lookingFor: "vedanā",
			research: true,
			candidateCount: 546,
			resultCount: 146,
		});
		assert.equal(
			done[1]?.text,
			"Searched widely, found 546 discourse matches",
		);
		assert.equal(done[2]?.text, "Ranked and picked 146 discourses");
	});

	it("keeps finished hops while Research is still writing", () => {
		const steps = buildAskProcessSteps({
			pending: true,
			phase: "search",
			question: "Who is a trainee?",
			lookingFor: "Trainee (sekkha): definition, qualities, minimum attainment",
			research: true,
			candidateCount: 505,
			showCount: 160,
			processNotes: [
				"Read AN 3.85, SN 48.53 in full",
				"Going deeper",
			],
		});
		assert.equal(steps[0]?.state, "done");
		assert.equal(steps[1]?.state, "active");
		assert.match(steps[1]?.text || "", /Searching widely/);
		assert.equal(steps[2]?.text, "Ranked and picked 160 discourses");
		assert.equal(steps[3]?.text, "Reviewed the evidence");
		assert.ok(steps.some((step) => step.text === "Going deeper"));
		assert.equal(steps.at(-1)?.state, "todo");
		assert.equal(steps.at(-1)?.text, "Write the report");
	});

	it("names the clarifying wait on the first Research step", () => {
		const steps = buildAskProcessSteps({
			pending: true,
			phase: "rewrite",
			question: "feeling?",
			research: true,
			clarifyPending: true,
		});
		assert.equal(steps[0]?.text, "Understanding the research request…");
		assert.equal(steps[0]?.state, "active");
	});

	it("surfaces live research progress on the active step", () => {
		const searching = buildAskProcessSteps({
			pending: true,
			phase: "search",
			question: "feeling?",
			research: true,
			progressNote: "Searching · 3 of 8 queries · 40 so far",
		});
		assert.equal(searching[1]?.text, "Searching · 3 of 8 queries · 40 so far");
		const scouting = buildAskProcessSteps({
			pending: true,
			phase: "review",
			question: "feeling?",
			research: true,
			progressNote: "Reviewing the evidence…",
			candidateCount: 80,
			showCount: 12,
		});
		assert.equal(scouting[2]?.state, "done");
		assert.equal(scouting[3]?.state, "active");
		assert.equal(scouting[3]?.text, "Reviewing the evidence…");
		assert.equal(scouting[4]?.state, "todo");
		assert.equal(scouting[4]?.text, "Write the report");
		const planning = buildAskProcessSteps({
			pending: true,
			phase: "rewrite",
			question: "feeling?",
			research: true,
		});
		assert.equal(planning[0]?.text, "Planning searches…");
	});

	it("names requested discourse IDs on the search step", () => {
		const fromQuestion = buildAskProcessSteps({
			pending: true,
			phase: "search",
			question:
				"Check SN 12.49, SN 48.9, and MN 70 on whether a saddhānusārī is a trainee.",
			research: true,
			queries: ["saddhanusari | dhammanusari"],
		});
		assert.equal(fromQuestion[1]?.state, "active");
		assert.equal(fromQuestion[1]?.text, "Requesting SN 12.49, SN 48.9, MN 70");

		const searching = buildAskProcessSteps({
			pending: true,
			phase: "search",
			question: "Can a saddhānusārī be a trainee?",
			research: true,
			queries: ["SN 12.49 | SN 48.9", "MN 70"],
			progressNote: "Searching · 2 of 4 queries",
		});
		assert.equal(
			searching[1]?.text,
			"Requesting SN 12.49, SN 48.9, MN 70 · Searching · 2 of 4 queries",
		);

		const reading = buildAskProcessSteps({
			pending: true,
			phase: "answer",
			question: "Can a saddhānusārī be a trainee?",
			research: true,
			queries: ["MN 70"],
			progressNote: "Reading MN 70 in full…",
			candidateCount: 80,
			showCount: 12,
		});
		assert.equal(reading[3]?.text, "Reviewed the evidence");
		assert.equal(reading[4]?.text, "Reading MN 70 in full…");
	});
});

describe("buildAskFollowUpHistory", () => {
	it("sends turn 1 with result slugs on a follow-up", () => {
		const history = buildAskFollowUpHistory([
			{
				question: "What is mindfulness?",
				lookingFor: "mindfulness",
				queries: ["sati", "satipatthana"],
				results: [{ slug: "sn47.19" }, { slug: "mn10" }],
				summary: "These discourses develop satipaṭṭhāna in practice.",
			},
		]);
		assert.equal(history.length, 1);
		assert.equal(history[0]?.question, "What is mindfulness?");
		assert.deepEqual(history[0]?.resultSlugs, ["sn47.19", "mn10"]);
		assert.match(history[0]?.summary || "", /satipaṭṭhāna/);
	});
});

describe("applyAskThinkingStreamPatch", () => {
	function liveThread() {
		const dom = new JSDOM(`<!DOCTYPE html><html><body>
			<div data-ai-thread>
				<section class="ai-turn" data-pending="0">
					<p class="ai-summary">Hmm, these are diverse but don't relate.</p>
				</section>
				<section class="ai-turn" data-pending="1">
					<ol class="ai-process">
						<li class="is-active"><span>Understanding the question…</span></li>
						<li class="is-todo"><span>Search the library</span></li>
					</ol>
					<div class="ai-skel"></div>
				</section>
			</div>
		</body></html>`);
		const thread = dom.window.document.querySelector("[data-ai-thread]");
		assert.ok(thread);
		return { document: dom.window.document, window: dom.window, thread };
	}

	it("keeps earlier-turn nodes (and their selection) while thinking streams", () => {
		const { document, window, thread } = liveThread();
		const summary = thread.querySelector(".ai-summary");
		assert.ok(summary);
		const range = document.createRange();
		range.selectNodeContents(summary);
		const selection = window.getSelection();
		assert.ok(selection);
		selection.removeAllRanges();
		selection.addRange(range);
		assert.match(selection.toString(), /diverse/);

		assert.equal(
			applyAskThinkingStreamPatch(
				thread,
				{ pending: true, reasoning: "Looking for a full-moon awakening scene." },
				1,
			),
			true,
		);
		assert.equal(thread.querySelector(".ai-summary"), summary);
		assert.match(selection.toString(), /diverse/);
		assert.match(
			thread.querySelector(".ai-process-thinking-text")?.innerHTML || "",
			/full-moon/,
		);
		assert.equal(thread.querySelector(".ai-skel"), null);

		assert.equal(
			applyAskThinkingStreamPatch(
				thread,
				{
					pending: true,
					reasoning:
						"Looking for a full-moon awakening scene.\n\nMN 21 is about anger, not the moon.",
				},
				1,
			),
			true,
		);
		assert.equal(thread.querySelector(".ai-summary"), summary);
		assert.match(selection.toString(), /diverse/);
		assert.equal(thread.querySelectorAll(".ai-process-thinking").length, 1);
		assert.match(
			thread.querySelector(".ai-process-thinking-text")?.innerHTML || "",
			/MN 21/,
		);
	});

	it("adds the show-all toggle once thinking is long, without replacing earlier turns", () => {
		const { thread } = liveThread();
		const earlier = thread.querySelector(".ai-turn");
		const long = Array.from(
			{ length: 8 },
			(_, i) => `Line ${i} of the model’s thinking.`,
		).join("\n");
		assert.equal(askReasoningIsLong(long), true);
		assert.equal(
			applyAskThinkingStreamPatch(thread, { pending: true, reasoning: long }, 1),
			true,
		);
		assert.equal(thread.querySelector(".ai-turn"), earlier);
		const thinking = thread.querySelector(".ai-process-thinking");
		assert.ok(thinking?.classList.contains("is-live"));
		assert.ok(thinking?.classList.contains("is-clamped"));
		const toggle = thread.querySelector("[data-ai-toggle-thinking]");
		assert.equal(toggle?.textContent, "Show all thinking");

		assert.equal(
			applyAskThinkingStreamPatch(
				thread,
				{ pending: true, reasoning: long, reasoningExpanded: true },
				1,
			),
			true,
		);
		assert.equal(thread.querySelector(".ai-turn"), earlier);
		assert.equal(thinking?.classList.contains("is-clamped"), false);
		assert.equal(thinking?.classList.contains("is-expanded"), true);
		assert.equal(toggle?.textContent, "Show less");
	});

	it("removes the thinking pane when a discarded stream is cleared", () => {
		const { thread } = liveThread();
		const earlier = thread.querySelector(".ai-summary");
		applyAskThinkingStreamPatch(
			thread,
			{ pending: true, reasoning: "First attempt notes." },
			1,
		);
		assert.ok(thread.querySelector(".ai-process-thinking"));
		assert.equal(
			applyAskThinkingStreamPatch(thread, { pending: true, reasoning: "" }, 1),
			true,
		);
		assert.equal(thread.querySelector(".ai-process-thinking"), null);
		assert.equal(thread.querySelector(".ai-summary"), earlier);
	});

	it("removes the thinking pane when reasoning is cleared, and does not show a fallback note", () => {
		const { thread } = liveThread();
		applyAskThinkingStreamPatch(
			thread,
			{
				pending: true,
				reasoning:
					"- ^MN puṇṇama (already tried)\n- ^DN puṇṇama (already tried)",
			},
			1,
		);
		assert.match(
			thread.querySelector(".ai-process-thinking-text")?.textContent || "",
			/puṇṇama/,
		);

		assert.equal(
			applyAskThinkingStreamPatch(
				thread,
				{
					pending: false,
					reasoning: "",
				},
				1,
			),
			true,
		);
		assert.equal(thread.querySelector(".ai-process-thinking"), null);
		assert.equal(thread.querySelector(".ai-process-thinking-note"), null);
		assert.doesNotMatch(
			thread.querySelector(".ai-process")?.textContent || "",
			/puṇṇama|GLM|DeepSeek|timed out|planned with/i,
		);
		assert.equal(thread.querySelector("[data-ai-toggle-thinking]"), null);
	});
});

describe("applyAskProcessStreamPatch", () => {
	it("updates process status in place without replacing earlier turns", () => {
		const dom = new JSDOM(`<!DOCTYPE html><html><body>
			<div data-ai-thread>
				<section class="ai-turn" data-pending="0">
					<p class="ai-summary">Earlier answer.</p>
				</section>
				<section class="ai-turn" data-pending="1">
					<ol class="ai-process">
						<li class="is-done"><span class="ai-process-mark">✓</span><span>Understood the question</span></li>
						<li class="is-todo"><span class="ai-process-mark">○</span><span>Search widely</span></li>
						<li class="is-todo"><span class="ai-process-mark">○</span><span>Rank and pick</span></li>
						<li class="is-todo"><span class="ai-process-mark">○</span><span>Review evidence</span></li>
						<li class="is-todo"><span class="ai-process-mark">○</span><span>Write the report</span></li>
					</ol>
				</section>
			</div>
		</body></html>`);
		const thread = dom.window.document.querySelector("[data-ai-thread]");
		assert.ok(thread);
		const earlier = thread.querySelector(".ai-summary");
		const firstTurn = thread.querySelector(".ai-turn");
		assert.equal(
			applyAskProcessStreamPatch(
				thread,
				{
					pending: true,
					phase: "search",
					question: "Can a saddhānusārī be a trainee?",
					lookingFor: "saddhanusari | dhammanusari",
					queries: ["SN 12.49 | SN 48.9", "MN 70"],
					offTopic: false,
					results: [],
					research: true,
					researchJobId: "job-1",
					progressNote: "Searching · 2 of 4 queries",
					reasoning: "Checking whether named IDs are requested.",
				},
				1,
			),
			true,
		);
		assert.equal(thread.querySelector(".ai-summary"), earlier);
		assert.equal(thread.querySelector(".ai-turn"), firstTurn);
		const steps = [...thread.querySelectorAll(".ai-process > li")].filter(
			(li) =>
				!li.classList.contains("ai-process-thinking") &&
				!li.classList.contains("ai-process-dev"),
		);
		assert.match(steps[0]?.textContent || "", /Understood/);
		assert.match(
			steps[1]?.textContent || "",
			/Requesting SN 12\.49, SN 48\.9, MN 70 · Searching · 2 of 4 queries/,
		);
		assert.ok(steps[1]?.classList.contains("is-active"));
	});
});

describe("firstRangeClientRect", () => {
	it("uses the first non-empty client rect instead of the full bounding box", () => {
		const first = {
			left: 40,
			top: 80,
			right: 180,
			bottom: 102,
			width: 140,
			height: 22,
		};
		const later = {
			left: 20,
			top: 220,
			right: 360,
			bottom: 280,
			width: 340,
			height: 60,
		};
		const rect = firstRangeClientRect({
			getClientRects: () => [first, later],
			getBoundingClientRect: () => ({
				left: 20,
				top: 80,
				right: 360,
				bottom: 280,
				width: 340,
				height: 200,
			}),
		});
		assert.equal(rect, first);
	});

	it("skips empty wrap artifacts then falls back to the bounding box", () => {
		const box = {
			left: 10,
			top: 20,
			right: 110,
			bottom: 60,
			width: 100,
			height: 40,
		};
		assert.equal(
			firstRangeClientRect({
				getClientRects: () => [{ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }],
				getBoundingClientRect: () => box,
			}),
			box,
		);
	});
});

describe("lastRangeClientRect", () => {
	it("returns the last non-empty line box", () => {
		const first = { left: 10, top: 20, right: 300, bottom: 44, width: 290, height: 24 };
		const last = { left: 10, top: 48, right: 120, bottom: 72, width: 110, height: 24 };
		const rect = lastRangeClientRect({
			getClientRects: () => [
				first,
				last,
				{ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
			],
		});
		assert.equal(rect, last);
	});
});

describe("reviseFloatOffset", () => {
	const origin = { left: 16, top: 40 };
	const chip = { width: 100, height: 28 };
	const column = { left: 60, right: 700 };

	it("sits just after the end of the selection when the line has room", () => {
		const lastLine = { left: 80, top: 120, right: 320, bottom: 144, height: 24 };
		const pos = reviseFloatOffset(lastLine, origin, chip, column);
		assert.equal(pos.placement, "after");
		assert.equal(pos.left, 320 + 8 - 16);
		assert.equal(pos.top, 120 + (24 - 28) / 2 - 40);
	});

	it("drops to the next row, right-aligned under the selection end, when it would overflow", () => {
		const lastLine = { left: 80, top: 120, right: 660, bottom: 144, height: 24 };
		const pos = reviseFloatOffset(lastLine, origin, chip, column);
		assert.equal(pos.placement, "below");
		assert.equal(pos.left, 660 - 100 - 16);
		assert.equal(pos.top, 144 + 6 - 40);
	});

	it("never leaves the column on the left", () => {
		const lastLine = { left: 60, top: 120, right: 90, bottom: 144, height: 24 };
		const pos = reviseFloatOffset(lastLine, origin, chip, { left: 60, right: 150 });
		assert.equal(pos.placement, "below");
		assert.equal(pos.left, 60 - 16);
	});
});

describe("researchVersionRowHtml", () => {
	it("shows the reader's ask, the changelog, and stats with deltas", () => {
		const v1 = {
			n: 1,
			at: Date.now() - 60_000,
			instruction: "",
			changelog: "Original report.",
			from: null,
			stats: { words: 6000, cited: 50, additional: 115 },
		};
		const v2 = {
			n: 2,
			at: Date.now(),
			instruction: "Add quotes on faculties",
			changelog: "Rewrote the faculties paragraph with two SN 48.42 quotations.",
			from: 1,
			heading: "Faculties",
			stats: { words: 6312, cited: 52, additional: 115 },
		};
		const html = researchVersionRowHtml(v2, { current: true, previous: v1 });
		assert.match(html, /ai-versions-tag">current</);
		assert.match(html, /You asked/);
		assert.match(html, /Add quotes on faculties/);
		assert.match(html, /in Faculties/);
		assert.match(html, /ai-versions-body/);
		assert.match(html, /Rewrote the faculties paragraph/);
		assert.match(html, /6,312 words \(\+312\)/);
		assert.match(html, /52 cited \(\+2\)/);
		assert.doesNotMatch(html, /additional sources \(/);
		// Not a <button>: the ask must stay selectable, with a copy control.
		assert.match(html, /data-ai-version-n="2"/);
		assert.match(html, /role="button" tabindex="0"/);
		assert.match(html, /data-ai-version-previewable="true"/);
		assert.doesNotMatch(html, /<button type="button" data-ai-version-n/);
		assert.match(html, /data-ai-versions-copy/);
		assert.match(html, /data-ai-versions-ask>“Add quotes on faculties”/);
	});

	it("uses fallback stats for the current row and no deltas without a base", () => {
		const html = researchVersionRowHtml(
			{ n: 1, at: Date.now(), instruction: "", changelog: "Original report.", from: null },
			{ fallbackStats: { words: 10, cited: 2, additional: 0 } },
		);
		assert.match(html, /10 words · 2 cited/);
		assert.doesNotMatch(html, /\(\+/);
	});

	it("marks metadata-only rows as non-interactive", () => {
		const html = researchVersionRowHtml(
			{
				n: 3,
				at: Date.now(),
				instruction: "Tighten the intro",
				changelog: "Shortened the opening paragraph.",
				from: 2,
			},
			{ previewable: false },
		);
		assert.match(html, /is-metadata-only/);
		assert.match(html, /changelog only/);
		assert.match(html, /data-ai-version-previewable="false"/);
		assert.match(html, /aria-disabled="true"/);
		assert.doesNotMatch(html, /role="button"/);
		assert.doesNotMatch(html, /tabindex="0"/);
	});

	it("shows the changes chip only when requested for the selected current row", () => {
		const row = {
			n: 8,
			at: Date.now(),
			instruction: "Add blockquotes",
			changelog: "Converted inline quotations.",
			from: 7,
		};
		const without = researchVersionRowHtml(row, { current: true, preview: true });
		assert.doesNotMatch(without, /data-ai-changes/);

		const withChip = researchVersionRowHtml(row, {
			current: true,
			preview: true,
			changesChip: { label: "35 changes", pressed: false },
		});
		assert.match(withChip, /ai-versions-changes-wrap/);
		assert.match(withChip, /data-ai-changes/);
		assert.match(withChip, /aria-pressed="false"/);
		assert.match(withChip, />35 changes</);
	});
});

describe("researchVersionChangesChipHtml", () => {
	it("reflects pressed state in aria and title", () => {
		const off = researchVersionChangesChipHtml({
			label: "3 changes",
			pressed: false,
		});
		assert.match(off, /aria-pressed="false"/);
		assert.match(off, /Highlight what changed in this version/);

		const on = researchVersionChangesChipHtml({
			label: "3 changes",
			pressed: true,
		});
		assert.match(on, /aria-pressed="true"/);
		assert.match(on, /Hide change highlights/);
	});
});

describe("revise composer chip", () => {
	it("keeps short selections verbatim and shows start … end of long ones", () => {
		assert.equal(abbreviateReviseQuote("  a short   quote "), "a short quote");
		const long =
			"Another text traces the chain of dependency from the five sense faculties to Nibbāna, situating mindfulness as the indispensable bridge between the mind and liberation, and closes with the experience of hindrances.";
		const short = abbreviateReviseQuote(long, 80);
		assert.ok(short.length <= 84, short);
		assert.match(short, /^Another text traces the chain/);
		assert.match(short, / … /);
		assert.match(short, /experience of hindrances\.$/);
		// Cuts fall on word boundaries.
		assert.doesNotMatch(short, /\w … \w*[^ ]\w… /);
	});

	it("labels heading scopes and quoted selections", () => {
		assert.equal(reviseScopeLabel("Faculties", "ignored"), "Revising · Faculties");
		assert.equal(reviseScopeLabel("", "two words"), "Revising · “two words”");
		assert.equal(reviseScopeLabel("", ""), "");
	});
});

describe("AI JSON request timeouts", () => {
	it("attaches a timeout signal, longer for writes, unless one is supplied", () => {
		const read = aiJsonRequestInit();
		assert.ok(read.signal instanceof AbortSignal);
		const write = aiJsonRequestInit({ method: "POST" });
		assert.ok(write.signal instanceof AbortSignal);
		const own = new AbortController();
		assert.equal(aiJsonRequestInit({ signal: own.signal }).signal, own.signal);
		assert.ok(AI_JSON_WRITE_TIMEOUT_MS > AI_JSON_TIMEOUT_MS);
	});

	it("recognises a timed-out fetch", () => {
		const timeout = new DOMException("timed out", "TimeoutError");
		assert.equal(isAiTimeoutError(timeout), true);
		assert.equal(isAiTimeoutError(new Error("boom")), false);
		assert.equal(
			researchApiFailureMessage({ status: 0, code: "timeout", error: AI_SERVER_TIMEOUT_MESSAGE }),
			AI_SERVER_TIMEOUT_MESSAGE,
		);
	});
});

describe("report change marks", () => {
	it("counts blocks the new version added, removed, or rewrote", () => {
		const base = "## A\n\nFirst paragraph stays the same here.\n\nSecond paragraph will change a lot.";
		const next =
			"## A\n\nFirst paragraph stays the same here.\n\nSecond paragraph now quotes SN 48.42 directly.\n\nA brand new closing paragraph appears.";
		assert.equal(reportChangeCount({ report: next, reviseBase: base }), 3);
		assert.equal(reportChangeCount({ report: base, reviseBase: base }), 0);
		assert.equal(reportChangeCount({ report: next }), 0);
	});

	it("labels the chip", () => {
		assert.equal(researchChangesChipLabel(1), "1 change");
		assert.equal(researchChangesChipLabel(3), "3 changes");
	});

	it("shows the chip while reviseBase is still loading", () => {
		const turn = {
			report: "new report body here with enough words to count",
			research: true as const,
			researchJobId: "job-1",
			versionIndex: [
				{ n: 1, at: 1, instruction: "", changelog: "", from: null },
				{ n: 2, at: 2, instruction: "", changelog: "", from: 1 },
			],
		};
		assert.equal(researchChangesChipVisible(turn, { isLatestTurn: true }), true);
		assert.equal(researchChangesChipLabelForTurn(turn), "Changes");
	});

	it("knows when to hydrate reviseBase after reload", () => {
		assert.equal(researchReviseBaseVersionN([{ n: 1, at: 1, instruction: "", changelog: "", from: null }]), null);
		assert.equal(
			researchReviseBaseVersionN([
				{ n: 1, at: 1, instruction: "", changelog: "", from: null },
				{ n: 2, at: 2, instruction: "x", changelog: "y", from: 1 },
			]),
			1,
		);
		// A "revise from v8" while head was v9 diffs v10 against v8, not v9.
		assert.equal(
			researchReviseBaseVersionN([
				{ n: 8, at: 8, instruction: "", changelog: "", from: 7 },
				{ n: 9, at: 9, instruction: "", changelog: "", from: 8 },
				{ n: 10, at: 10, instruction: "", changelog: "", from: 8 },
			]),
			8,
		);
		assert.equal(
			shouldHydrateReviseBase({
				report: "new",
				research: true,
				researchJobId: "job-1",
				versionIndex: [{ n: 1, at: 1, instruction: "", changelog: "", from: null }, { n: 2, at: 2, instruction: "", changelog: "", from: 1 }],
			}),
			true,
		);
		assert.equal(
			shouldHydrateReviseBase({
				report: "new",
				reviseBase: "old",
				reviseBaseVersionN: 1,
				research: true,
				researchJobId: "job-1",
				versionIndex: [{ n: 1, at: 1, instruction: "", changelog: "", from: null }, { n: 2, at: 2, instruction: "", changelog: "", from: 1 }],
			}),
			false,
		);
		assert.equal(
			shouldHydrateReviseBase({
				report: "v16 head body with enough words to count",
				reviseBase: "v14 stale baseline from an earlier revision",
				research: true,
				researchJobId: "job-1",
				versionIndex: [
					{ n: 14, at: 14, instruction: "", changelog: "", from: 13 },
					{ n: 15, at: 15, instruction: "", changelog: "", from: 14 },
					{ n: 16, at: 16, instruction: "", changelog: "", from: 15 },
				],
			}),
			true,
		);
	});

	it("stamps reviseBase against the version the head was revised from", () => {
		const turn = {
			report: "## Mindfulness In The Divine Abidings\n\nSame paragraph throughout.",
			versionIndex: [
				{ n: 15, at: 15, instruction: "", changelog: "", from: 14 },
				{ n: 16, at: 16, instruction: "", changelog: "", from: 15 },
			],
		};
		stampReviseDiffBase(
			turn,
			"## Mindfulness in the divine abidings\n\nSame paragraph throughout.",
			15,
		);
		assert.equal(turn.reviseBaseVersionN, 15);
		assert.equal(
			reportChangeCount({
				report: turn.report,
				reviseBase: turn.reviseBase,
			}),
			0,
		);
	});

	it("resolves the expected diff baseline from versionIndex.from", () => {
		assert.equal(
			expectedReviseBaseVersionN({
				versionIndex: [
					{ n: 15, at: 15, instruction: "", changelog: "", from: 14 },
					{ n: 16, at: 16, instruction: "", changelog: "", from: 15 },
				],
			}),
			15,
		);
	});

	it("tags the rendered blocks that match changed keys", () => {
		const base = "## A\n\nFirst paragraph stays the same here.\n\n- old item one here\n- old item two here";
		const next =
			"## A\n\nFirst paragraph stays the same here.\n\nA rewritten paragraph citing [SN 48.42](/sn48.42) in full.\n\n- old item one here\n- new item two, with more words";
		const dom = new JSDOM(
			`<div class="ai-answer-body"><h2>A</h2><p>First paragraph stays the same here.</p><p>A rewritten paragraph citing <a href="/sn48.42">SN 48.42</a> in full.</p><ul><li>old item one here</li><li>new item two, with more words</li></ul></div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		const diff = reportBlockDiff({ report: next, reviseBase: base });
		stampReportBlockKeys(body, next);
		assert.equal(markReportBlockDiff(body, diff, base), 2);
		const changed = [...body.querySelectorAll(".is-change-edited, .is-change-added")].map(
			(el) => el.textContent,
		);
		assert.deepEqual(changed, [
			"A rewritten paragraph citing SN 48.42 in full.",
			"new item two, with more words",
		]);
		assert.ok(body.querySelector("p.is-first-change"));
		assert.equal(markReportBlockDiff(body, null), 0);
		assert.equal(body.querySelectorAll(".is-change-edited, .is-change-added").length, 0);
	});

	it("stamps block keys so citation markup still matches the markdown block", () => {
		const base =
			"## A\n\nFirst paragraph stays the same here.\n\nSecond paragraph cites SN 48.42 in full.";
		const next =
			"## A\n\nFirst paragraph stays the same here.\n\nSecond paragraph cites [SN 48.42](/sn48.42) in full.";
		const dom = new JSDOM(
			`<div class="ai-answer-body"><h2>A</h2><p>First paragraph stays the same here.</p><p>Second paragraph cites <a href="/sn48.42" class="ai-summary-ref" data-cite-title="Sabbasava Sutta">SN 48.42</a> in full.</p></div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		const diff = reportBlockDiff({ report: next, reviseBase: base });
		stampReportBlockKeys(body, next);
		assert.equal(markReportBlockDiff(body, diff, base), 0);
		assert.equal(
			body.querySelectorAll("p")[1]?.getAttribute("data-report-block-key"),
			"paragraph:secondparagraphcitessn4842infull",
		);
		assert.equal(body.querySelectorAll(".is-change-edited, .is-change-added").length, 0);
	});

	it("places removals before a list when the anchor is a list item", () => {
		const base =
			"## Section\n\nAlpha paragraph remains in place.\n\n- **Removed bullet** stays in the old version.\n\nBeta paragraph remains in place.";
		const next =
			"## Section\n\nAlpha paragraph remains in place.\n\nBeta paragraph remains in place.";
		const dom = new JSDOM(
			`<div class="ai-answer-body"><h2>Section</h2><p>Alpha paragraph remains in place.</p><p>Beta paragraph remains in place.</p></div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		const diff = reportBlockDiff({ report: next, reviseBase: base });
		stampReportBlockKeys(body, next);
		markReportBlockDiff(body, diff, base);
		const removed = body.querySelector("details.ai-change-removed");
		assert.ok(removed);
		assert.equal(removed.nextElementSibling?.textContent, "Beta paragraph remains in place.");
	});

	it("places removals before the next block even when a table sits between them", () => {
		const base =
			"## Section\n\nAlpha paragraph remains in place.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n**Removed emphasis stays markdown.**\n\nBeta paragraph remains in place.";
		const next =
			"## Section\n\nAlpha paragraph remains in place.\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\nBeta paragraph remains in place.";
		const dom = new JSDOM(
			`<div class="ai-answer-body"><h2>Section</h2><p>Alpha paragraph remains in place.</p><div class="ai-report-table-wrap"><table><tr><td>1</td></tr></table></div><p>Beta paragraph remains in place.</p></div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		const diff = reportBlockDiff({ report: next, reviseBase: base });
		stampReportBlockKeys(body, next);
		markReportBlockDiff(body, diff, base);
		const removed = body.querySelector("details.ai-change-removed");
		assert.ok(removed);
		assert.equal(removed.nextElementSibling?.textContent, "Beta paragraph remains in place.");
	});

	it("renders removed markdown before its next surviving block", () => {
		const base =
			"## Section\n\nAlpha paragraph remains in place.\n\n**Removed emphasis stays markdown.**\n\nBeta paragraph remains in place.";
		const next =
			"## Section\n\nA new opening paragraph was inserted.\n\nAlpha paragraph remains in place.\n\nBeta paragraph remains in place.";
		const dom = new JSDOM(
			`<div class="ai-answer-body"><h2>Section</h2><p>A new opening paragraph was inserted.</p><p>Alpha paragraph remains in place.</p><p>Beta paragraph remains in place.</p></div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		const diff = reportBlockDiff({ report: next, reviseBase: base });
		stampReportBlockKeys(body, next);
		markReportBlockDiff(body, diff, base);
		const removed = body.querySelector("details.ai-change-removed");
		assert.ok(removed);
		assert.equal(removed.nextElementSibling?.textContent, "Beta paragraph remains in place.");
		assert.equal(removed.querySelector(".ai-change-removed-body strong")?.textContent, "Removed emphasis stays markdown.");
		assert.equal(removed.hasAttribute("open"), false);
	});

	it("marks blockquote wrappers, not inner paragraphs, when a quote was replaced", () => {
		const base = "## A\n\nLead-in.\n\n> old quote SN 48.42";
		const next = "## A\n\nLead-in.\n\n> new quote SN 48.42";
		const dom = new JSDOM(
			`<div class="ai-answer-body"><h2>A</h2><p>Lead-in.</p><blockquote><p>new quote SN 48.42</p></blockquote></div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		const diff = reportBlockDiff({ report: next, reviseBase: base });
		stampReportBlockKeys(body, next);
		assert.equal(markReportBlockDiff(body, diff, base), 1);
		assert.ok(body.querySelector("blockquote.is-change-added.is-first-change"));
		assert.equal(body.querySelectorAll("blockquote p.is-change-added").length, 0);
		assert.equal(body.querySelectorAll("details.ai-change-removed").length, 1);
	});

	it("tracks a fenced Mermaid diagram as one changed report block", () => {
		const base =
			"## Diagram\n\n```mermaid\nflowchart LR\n A[Old] --> B\n```\n\nClosing paragraph stays exactly the same.";
		const next =
			'## Diagram\n\n```mermaid\nflowchart LR\n A["New label"] --> B\n```\n\nClosing paragraph stays exactly the same.';
		const dom = new JSDOM(
			`<div class="ai-answer-body"><h2>Diagram</h2><pre class="ai-report-mermaid" data-ai-mermaid>flowchart LR\n A["New label"] --&gt; B</pre><p>Closing paragraph stays exactly the same.</p></div>`,
		);
		const body = dom.window.document.querySelector(".ai-answer-body")!;
		const diff = reportBlockDiff({ report: next, reviseBase: base });
		stampReportBlockKeys(body, next);
		assert.equal(markReportBlockDiff(body, diff, base), 1);
		assert.ok(body.querySelector("pre.ai-report-mermaid.is-change-added"));
		assert.equal(
			body.querySelectorAll(
				"p.is-change-added, p.is-change-edited, details.ai-change-removed p",
			).length,
			0,
		);
	});
});

describe("researchJobApiPath", () => {
	it("always uses a rooted /api path and encodes the job id", () => {
		const id = "b6a24e6f-62f8-42e4-95cc-6f1d45991044";
		assert.equal(researchJobApiPath(id), `${RESEARCH_API_PATH}/${id}`);
		assert.equal(researchJobApiPath(id).startsWith("/"), true);
		assert.doesNotMatch(researchJobApiPath(id), /^api\//);
		assert.equal(
			researchJobApiPath("a/b"),
			`${RESEARCH_API_PATH}/${encodeURIComponent("a/b")}`,
		);
		assert.equal(researchJobApiPath(id, 2), `${RESEARCH_API_PATH}/${id}?version=2`);
		assert.equal(RESEARCH_REVISE_API_PATH, "/api/ai/research/revise");
	});
});

describe("researchPollDelayMs", () => {
	it("starts fast and backs off to the steady cadence", () => {
		assert.equal(researchPollDelayMs(0), RESEARCH_POLL_START_MS);
		assert.equal(
			researchPollDelayMs(RESEARCH_POLL_RAMP_MS - 1),
			RESEARCH_POLL_START_MS,
		);
		assert.equal(researchPollDelayMs(RESEARCH_POLL_RAMP_MS), RESEARCH_POLL_STEADY_MS);
		assert.equal(researchPollDelayMs(5 * 60_000), RESEARCH_POLL_STEADY_MS);
		assert.ok(RESEARCH_POLL_STEADY_MS >= RESEARCH_POLL_START_MS);
	});
});

describe("fetch redirect handling", () => {
	it("refuses HTML, redirects, and opaque redirects as API JSON", () => {
		assert.equal(aiJsonRequestInit().redirect, "error");
		assert.equal(
			isAiJsonResponse(
				new Response(JSON.stringify({ ok: true }), {
					status: 202,
					headers: { "Content-Type": "application/json" },
				}),
			),
			true,
		);
		assert.equal(
			isAiJsonResponse(
				new Response("<!doctype html>", {
					status: 200,
					headers: { "Content-Type": "text/html" },
				}),
			),
			false,
		);
		assert.equal(
			isAiJsonResponse({
				redirected: true,
				type: "basic",
				status: 200,
				headers: { get: () => "application/json" },
			}),
			false,
		);
		assert.equal(
			isAiJsonResponse({
				redirected: false,
				type: "opaqueredirect",
				status: 0,
				headers: { get: () => "" },
			}),
			false,
		);
	});

	it("throws when fetch returns HTML instead of JSON", async () => {
		const original = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response("<html>search</html>", {
				status: 200,
				headers: { "Content-Type": "text/html" },
			})) as typeof fetch;
		try {
			await assert.rejects(
				() => fetchAiJson("/api/ai/research/revise"),
				(error: unknown) =>
					error instanceof Error && error.name === "AiJsonResponseError",
			);
		} finally {
			globalThis.fetch = original;
		}
	});
});

describe("scrollAskProcessToLatest", () => {
	it("scrolls and focuses the latest active process hop", () => {
		const dom = new JSDOM(`<!DOCTYPE html><html><body>
			<ol class="ai-process">
				<li class="is-done"><span class="ai-process-mark">✓</span><span>Wrote the report</span></li>
				<li class="is-active"><span class="ai-process-mark">●</span><span>Considering the revision…</span></li>
				<li class="ai-process-thinking"><span class="ai-process-mark"></span><span>hidden</span></li>
			</ol>
		</body></html>`);
		const process = dom.window.document.querySelector(".ai-process");
		assert.ok(process);
		const hops = [...process.querySelectorAll(":scope > li")].filter(
			(li) =>
				!li.classList.contains("ai-process-thinking") &&
				!li.classList.contains("ai-process-dev"),
		);
		const active = hops[1] as HTMLElement;
		let focused = false;
		active.focus = () => {
			focused = true;
		};
		Object.defineProperty(process, "scrollHeight", { value: 400 });
		Object.defineProperty(process, "clientHeight", { value: 120 });
		scrollAskProcessToLatest(process, { focus: true });
		assert.equal(focused, true);
		assert.equal((process as HTMLElement).scrollTop, 400);
	});
});
