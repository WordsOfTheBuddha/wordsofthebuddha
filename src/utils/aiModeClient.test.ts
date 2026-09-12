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
	researchSourcesBlockHtml,
	formatAskRoutingDevHtml,
	isAskSendShortcut,
	mergeAskTurnReasoning,
	renderAskThinkingHtml,
	takeAskSseEvents,
	buildAskFollowUpHistory,
} from "./aiModeClient";

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
			/puṇṇama|GLM|timed out|planned with/i,
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
