import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	askSendShortcutLabel,
	displayAskReasoning,
	isAskSendShortcut,
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
});
