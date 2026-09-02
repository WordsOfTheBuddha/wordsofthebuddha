import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	LINK_HINT_LABELS,
	assignLinkHintLabels,
	collectViewportCollectionPostLinks,
	isElementInViewport,
	isLinkHintModifierHeld,
	isLinkHintModifierKey,
	resolveLinkHintLabelKey,
} from "./collectionLinkHints";

function key(
	partial: Partial<{
		key: string;
		ctrlKey: boolean;
		metaKey: boolean;
		altKey: boolean;
	}> & { key: string },
) {
	return {
		ctrlKey: false,
		metaKey: false,
		altKey: false,
		...partial,
	};
}

describe("LINK_HINT_LABELS", () => {
	it("starts with 1–9 then a–z", () => {
		assert.deepEqual([...LINK_HINT_LABELS.slice(0, 9)], [
			"1",
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
		]);
		assert.equal(LINK_HINT_LABELS[9], "a");
		assert.equal(LINK_HINT_LABELS.at(-1), "z");
		assert.equal(LINK_HINT_LABELS.length, 35);
	});
});

describe("isLinkHintModifierHeld", () => {
	it("uses ⌘ on Apple platforms", () => {
		assert.equal(
			isLinkHintModifierHeld(key({ key: "Meta", metaKey: true }), true),
			true,
		);
		assert.equal(
			isLinkHintModifierHeld(key({ key: "Alt", altKey: true }), true),
			false,
		);
	});

	it("uses Alt on Windows and Linux", () => {
		assert.equal(
			isLinkHintModifierHeld(key({ key: "Alt", altKey: true }), false),
			true,
		);
		assert.equal(
			isLinkHintModifierHeld(key({ key: "Meta", metaKey: true }), false),
			false,
		);
	});

	it("ignores Ctrl chords", () => {
		assert.equal(
			isLinkHintModifierHeld(
				key({ key: "Meta", metaKey: true, ctrlKey: true }),
				true,
			),
			false,
		);
	});
});

describe("isLinkHintModifierKey", () => {
	it("matches Meta on Apple and Alt elsewhere", () => {
		assert.equal(isLinkHintModifierKey(key({ key: "Meta" }), true), true);
		assert.equal(isLinkHintModifierKey(key({ key: "Alt" }), true), false);
		assert.equal(isLinkHintModifierKey(key({ key: "Alt" }), false), true);
		assert.equal(isLinkHintModifierKey(key({ key: "Meta" }), false), false);
	});
});

describe("resolveLinkHintLabelKey", () => {
	it("accepts digits 1–9 and letters a–z", () => {
		assert.equal(resolveLinkHintLabelKey(key({ key: "1" })), "1");
		assert.equal(resolveLinkHintLabelKey(key({ key: "9" })), "9");
		assert.equal(resolveLinkHintLabelKey(key({ key: "A" })), "a");
		assert.equal(resolveLinkHintLabelKey(key({ key: "z" })), "z");
	});

	it("rejects 0, symbols, and navigation keys", () => {
		assert.equal(resolveLinkHintLabelKey(key({ key: "0" })), null);
		assert.equal(resolveLinkHintLabelKey(key({ key: "ArrowUp" })), null);
		assert.equal(resolveLinkHintLabelKey(key({ key: "Enter" })), null);
	});
});

describe("isElementInViewport", () => {
	it("detects overlap with the viewport box", () => {
		const dom = new JSDOM("<!doctype html><div id='t'></div>");
		const el = dom.window.document.getElementById("t")!;
		el.getBoundingClientRect = () =>
			({
				top: 10,
				left: 10,
				bottom: 40,
				right: 80,
				width: 70,
				height: 30,
				x: 10,
				y: 10,
				toJSON() {},
			}) as DOMRect;

		assert.equal(
			isElementInViewport(el, {
				top: 0,
				left: 0,
				right: 100,
				bottom: 100,
			}),
			true,
		);
		assert.equal(
			isElementInViewport(el, {
				top: 50,
				left: 0,
				right: 100,
				bottom: 100,
			}),
			false,
		);
	});
});

describe("assignLinkHintLabels", () => {
	it("maps links to 1–9 then letters", () => {
		const dom = new JSDOM("<!doctype html><a></a><a></a><a></a>");
		const links = [
			...dom.window.document.querySelectorAll("a"),
		] as HTMLAnchorElement[];
		const assigned = assignLinkHintLabels(links);
		assert.deepEqual(
			assigned.map((entry) => entry.label),
			["1", "2", "3"],
		);
	});
});

describe("collectViewportCollectionPostLinks", () => {
	it("returns visible viewport post-links from collection grids only", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div id="collections-grid">
					<article class="post-item"><a class="post-link" href="/mn">MN</a></article>
					<article class="post-item hidden"><a class="post-link" href="/sn">SN</a></article>
				</div>
				<div id="other"><a class="post-link" href="/x">X</a></div>
			</body></html>`);
		const { document, HTMLElement } = dom.window;

		// jsdom has no layout; stub visibility + geometry for the visible card.
		const visible = document.querySelector(
			"#collections-grid .post-item:not(.hidden) a.post-link",
		) as HTMLAnchorElement;
		const hidden = document.querySelector(
			"#collections-grid .post-item.hidden a.post-link",
		) as HTMLAnchorElement;
		const outside = document.querySelector(
			"#other a.post-link",
		) as HTMLAnchorElement;

		for (const link of [visible, hidden, outside]) {
			link.getBoundingClientRect = () =>
				({
					top: 20,
					left: 20,
					bottom: 60,
					right: 120,
					width: 100,
					height: 40,
					x: 20,
					y: 20,
					toJSON() {},
				}) as DOMRect;
		}

		Object.defineProperty(HTMLElement.prototype, "getClientRects", {
			configurable: true,
			value() {
				return [{}, {}, {}];
			},
		});
		const styleProto = dom.window.CSSStyleDeclaration.prototype;
		const originalGetProperty = styleProto.getPropertyValue;
		styleProto.getPropertyValue = function (prop: string) {
			if (prop === "display") return "block";
			if (prop === "visibility") return "visible";
			return originalGetProperty.call(this, prop);
		};

		// Patch getComputedStyle used by isElementVisible.
		dom.window.getComputedStyle = ((el: Element) => {
			const display =
				el.classList.contains("hidden") ||
				el.closest?.(".hidden")
					? "none"
					: "block";
			return {
				display,
				visibility: "visible",
				getPropertyValue(prop: string) {
					if (prop === "display") return display;
					if (prop === "visibility") return "visible";
					return "";
				},
			} as CSSStyleDeclaration;
		}) as typeof getComputedStyle;

		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;

		try {
			const links = collectViewportCollectionPostLinks(document);
			assert.equal(links.length, 1);
			assert.equal(links[0]?.getAttribute("href"), "/mn");
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
		}
	});
});
