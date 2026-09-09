import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	applyAskThinkingStreamPatch,
	askReasoningIsLong,
	askResultsCaption,
	askSendShortcutLabel,
	askShouldSurviveDisconnect,
	buildAskProcessSteps,
	displayAskReasoning,
	formatAskRoutingDevHtml,
	isAskSendShortcut,
	mergeAskTurnReasoning,
	renderAskThinkingHtml,
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

describe("askResultsCaption", () => {
	it("names the shown count and the pool it came from", () => {
		assert.equal(
			askResultsCaption({ resultCount: 12, candidateCount: 186 }),
			"Showing 12 discourses · picked from 186",
		);
		assert.equal(askResultsCaption({ resultCount: 1 }), "Showing 1 discourse");
		assert.equal(askResultsCaption({ resultCount: 0, candidateCount: 40 }), "");
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
		assert.equal(writing[2]?.text, "Crunched 186 discourses");
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
		assert.equal(done[2]?.text, "Crunched 186 discourses");
		assert.doesNotMatch(done[2]?.text || "", /showing/);
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
