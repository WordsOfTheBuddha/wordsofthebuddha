import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askReasoningIsLong,
	askResultsCaption,
	askSendShortcutLabel,
	buildAskProcessSteps,
	displayAskReasoning,
	formatAskRoutingDevHtml,
	isAskSendShortcut,
	renderAskThinkingHtml,
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
				"minimax/minimax-m3:free",
				"z-ai/glm-5.2:free",
			],
			attempts: ["nvidia/nemotron-3-ultra-550b-a55b:free"],
			skippedCooldown: [],
			failed: [],
			used: "nvidia/nemotron-3-ultra-550b-a55b:free",
			provider: "openrouter",
			degraded: true,
			degradedReason: "no_json",
			reranker: "gemini-3.5-flash-lite",
		});
		assert.match(html, /ai-dev-routing/);
		assert.match(html, /DEV · called/);
		assert.match(html, /nemotron-3-ultra-550b-a55b/);
		assert.match(html, /planner nemotron-3-ultra-550b-a55b/);
		assert.match(html, /rerank gemini-3\.5-flash-lite/);
		assert.match(html, /simplified \(no_json\)/);
		assert.doesNotMatch(html, /minimax-m3/);
		assert.equal(formatAskRoutingDevHtml(undefined), "");
	});
});

describe("askReasoningIsLong", () => {
	it("flags many lines or long text", () => {
		assert.equal(askReasoningIsLong("short"), false);
		assert.equal(askReasoningIsLong("a\nb\nc\nd\ne\nf\ng"), true);
		assert.equal(askReasoningIsLong("x".repeat(700)), true);
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
