import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import { isEditableTarget } from "./searchFocusShortcut";
import {
	isApplePlatform,
	isScrolledToTop,
	resolveParentNavAction,
	resolveParentNavHref,
	shouldHandleParentNavShortcut,
} from "./parentNavShortcut";

function key(
	partial: Partial<{
		key: string;
		ctrlKey: boolean;
		metaKey: boolean;
		altKey: boolean;
		shiftKey: boolean;
		defaultPrevented: boolean;
	}> & { key: string },
): Pick<
	KeyboardEvent,
	| "key"
	| "ctrlKey"
	| "metaKey"
	| "altKey"
	| "shiftKey"
	| "defaultPrevented"
> {
	return {
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		defaultPrevented: false,
		...partial,
	};
}

describe("isScrolledToTop", () => {
	it("treats the top of the page and overscroll as at top", () => {
		assert.equal(isScrolledToTop(0), true);
		assert.equal(isScrolledToTop(-12), true);
		assert.equal(isScrolledToTop(8), true);
	});

	it("treats mid-page scroll as not at top", () => {
		assert.equal(isScrolledToTop(9), false);
		assert.equal(isScrolledToTop(480), false);
	});
});

describe("isApplePlatform", () => {
	it("detects macOS and iOS", () => {
		assert.equal(isApplePlatform("MacIntel"), true);
		assert.equal(isApplePlatform("iPhone"), true);
		assert.equal(isApplePlatform("iPad"), true);
	});

	it("rejects Windows and Linux", () => {
		assert.equal(isApplePlatform("Win32"), false);
		assert.equal(isApplePlatform("Linux x86_64"), false);
	});
});

describe("shouldHandleParentNavShortcut", () => {
	it("handles ⌘↑ on Apple platforms", () => {
		assert.equal(
			shouldHandleParentNavShortcut(
				key({ key: "ArrowUp", metaKey: true }),
				null,
				true,
			),
			true,
		);
	});

	it("handles Alt+↑ on Windows and Linux", () => {
		assert.equal(
			shouldHandleParentNavShortcut(
				key({ key: "ArrowUp", altKey: true }),
				null,
				false,
			),
			true,
		);
	});

	it("ignores Win+↑ so the OS can snap or maximize", () => {
		assert.equal(
			shouldHandleParentNavShortcut(
				key({ key: "ArrowUp", metaKey: true }),
				null,
				false,
			),
			false,
		);
	});

	it("ignores Option+↑ on Apple platforms", () => {
		assert.equal(
			shouldHandleParentNavShortcut(
				key({ key: "ArrowUp", altKey: true }),
				null,
				true,
			),
			false,
		);
	});

	it("ignores unmodified ArrowUp so the page can still scroll", () => {
		assert.equal(
			shouldHandleParentNavShortcut(key({ key: "ArrowUp" }), null, true),
			false,
		);
	});

	it("ignores the shortcut while typing in an input", () => {
		const { window } = new JSDOM("<input />");
		const input = window.document.querySelector("input");
		assert.equal(isEditableTarget(input), true);
		assert.equal(
			shouldHandleParentNavShortcut(
				key({ key: "ArrowUp", metaKey: true }),
				input,
				true,
			),
			false,
		);
	});

	it("ignores extra modifiers and other keys", () => {
		assert.equal(
			shouldHandleParentNavShortcut(
				key({ key: "ArrowUp", metaKey: true, shiftKey: true }),
				null,
				true,
			),
			false,
		);
		assert.equal(
			shouldHandleParentNavShortcut(
				key({ key: "ArrowUp", metaKey: true, ctrlKey: true }),
				null,
				true,
			),
			false,
		);
		assert.equal(
			shouldHandleParentNavShortcut(key({ key: "u" }), null, true),
			false,
		);
	});
});

describe("resolveParentNavAction", () => {
	it("scrolls to top when the page is not already at the top", () => {
		assert.equal(resolveParentNavAction(false, "/mn"), "scroll-top");
		assert.equal(resolveParentNavAction(false, null), "scroll-top");
	});

	it("goes to the parent when already at the top", () => {
		assert.equal(resolveParentNavAction(true, "/mn"), "go-parent");
	});

	it("does nothing at the top when there is no parent", () => {
		assert.equal(resolveParentNavAction(true, null), "none");
	});
});

describe("resolveParentNavHref", () => {
	it("returns the marked parent breadcrumb href", () => {
		const { window } = new JSDOM(
			`<nav>
				<a href="/sn">SN</a>
				<a href="/sn12" data-nav-up>SN 12</a>
				<span>SN 12.2</span>
			</nav>`,
		);
		assert.equal(resolveParentNavHref(window.document), "/sn12");
	});

	it("returns null when the page has no parent crumb", () => {
		const { window } = new JSDOM(`<nav><span>Discover</span></nav>`);
		assert.equal(resolveParentNavHref(window.document), null);
	});
});
