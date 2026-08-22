import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	isEditableTarget,
	resolveSearchFocusTarget,
	shouldHandleSearchFocusShortcut,
} from "./searchFocusShortcut";

function key(
	partial: Partial<{
		key: string;
		ctrlKey: boolean;
		metaKey: boolean;
		altKey: boolean;
		defaultPrevented: boolean;
	}> & { key: string },
): Pick<
	KeyboardEvent,
	"key" | "ctrlKey" | "metaKey" | "altKey" | "defaultPrevented"
> {
	return {
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		defaultPrevented: false,
		...partial,
	};
}

describe("shouldHandleSearchFocusShortcut", () => {
	it("handles bare / when focus is not in a field", () => {
		assert.equal(shouldHandleSearchFocusShortcut(key({ key: "/" }), null), true);
	});

	it("ignores / while typing in an input", () => {
		const { window } = new JSDOM("<input />");
		const input = window.document.querySelector("input");
		assert.equal(isEditableTarget(input), true);
		assert.equal(shouldHandleSearchFocusShortcut(key({ key: "/" }), input), false);
	});

	it("ignores modifier combinations and other keys", () => {
		assert.equal(
			shouldHandleSearchFocusShortcut(key({ key: "/", ctrlKey: true }), null),
			false,
		);
		assert.equal(
			shouldHandleSearchFocusShortcut(key({ key: "/", metaKey: true }), null),
			false,
		);
		assert.equal(shouldHandleSearchFocusShortcut(key({ key: "?" }), null), false);
	});
});

describe("resolveSearchFocusTarget", () => {
	it("returns the first visible search input", () => {
		const { window } = new JSDOM(
			`<input id="hidden" /><input id="visible" />`,
		);
		const hidden = window.document.getElementById("hidden") as HTMLInputElement;
		const visible = window.document.getElementById("visible") as HTMLInputElement;
		const seen = new Set<HTMLElement>([visible]);
		const found = resolveSearchFocusTarget([hidden, visible], (el) =>
			seen.has(el),
		);
		assert.equal(found, visible);
	});

	it("returns null when every candidate is hidden", () => {
		const { window } = new JSDOM(`<input id="hidden" />`);
		const hidden = window.document.getElementById("hidden") as HTMLInputElement;
		assert.equal(resolveSearchFocusTarget([hidden], () => false), null);
	});
});
