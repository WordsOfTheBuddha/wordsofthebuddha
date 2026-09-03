import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	LINK_HINT_LABELS,
	LINK_HINT_STICKY_MS,
	assignLinkHintLabels,
	collectActiveLinkHintAssignments,
	collectDictionaryHintTargets,
	collectViewportCollectionPostLinks,
	isElementInViewport,
	isLinkHintModifierHeld,
	isLinkHintModifierKey,
	resolveLinkHintLabelKey,
	shouldHandleLinkHintActivationKey,
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

describe("LINK_HINT_STICKY_MS", () => {
	it("keeps hints armed for a few seconds after modifier release", () => {
		assert.equal(LINK_HINT_STICKY_MS, 3000);
	});
});

describe("shouldHandleLinkHintActivationKey", () => {
	it("accepts bare digits only while hints are armed", () => {
		assert.equal(
			shouldHandleLinkHintActivationKey(key({ key: "1" }), true, null),
			"1",
		);
		assert.equal(
			shouldHandleLinkHintActivationKey(key({ key: "1" }), false, null),
			null,
		);
	});

	it("rejects ⌘/Alt/Ctrl chords so browser shortcuts stay free", () => {
		assert.equal(
			shouldHandleLinkHintActivationKey(
				key({ key: "1", metaKey: true }),
				true,
				null,
			),
			null,
		);
		assert.equal(
			shouldHandleLinkHintActivationKey(
				key({ key: "2", altKey: true }),
				true,
				null,
			),
			null,
		);
		assert.equal(
			shouldHandleLinkHintActivationKey(
				key({ key: "a", ctrlKey: true }),
				true,
				null,
			),
			null,
		);
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
	it("maps elements to 1–9 then letters with a kind", () => {
		const dom = new JSDOM("<!doctype html><a></a><a></a><a></a>");
		const links = [
			...dom.window.document.querySelectorAll("a"),
		] as HTMLAnchorElement[];
		const assigned = assignLinkHintLabels(links, "navigate");
		assert.deepEqual(
			assigned.map((entry) => entry.label),
			["1", "2", "3"],
		);
		assert.equal(assigned[0]?.kind, "navigate");
	});
});

describe("collectViewportCollectionPostLinks", () => {
	it("returns visible viewport post-links from collection grids and search cards", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div id="collections-grid">
					<article class="post-item"><a class="post-link" href="/mn">MN</a></article>
					<article class="post-item hidden"><a class="post-link" href="/sn">SN</a></article>
				</div>
				<div id="drawer-disc-cards">
					<article class="post-item"><a class="post-link" href="/an1.1">AN 1.1</a></article>
				</div>
				<a class="search-discourse-card" data-search-result href="/dn22">DN 22</a>
				<div id="other"><a class="post-link" href="/x">X</a></div>
			</body></html>`);
		const { document } = dom.window;

		const visible = document.querySelector(
			"#collections-grid .post-item:not(.hidden) a.post-link",
		) as HTMLAnchorElement;
		const hidden = document.querySelector(
			"#collections-grid .post-item.hidden a.post-link",
		) as HTMLAnchorElement;
		const qualityDisc = document.querySelector(
			"#drawer-disc-cards a.post-link",
		) as HTMLAnchorElement;
		const searchCard = document.querySelector(
			"a.search-discourse-card",
		) as HTMLAnchorElement;
		const outside = document.querySelector(
			"#other a.post-link",
		) as HTMLAnchorElement;

		stubVisibleGeometry(dom, [
			visible,
			hidden,
			qualityDisc,
			searchCard,
			outside,
			document.querySelector("#collections-grid")!,
			document.querySelector("#drawer-disc-cards")!,
		]);

		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;

		try {
			const links = collectViewportCollectionPostLinks(document);
			assert.deepEqual(
				links.map((link) => link.getAttribute("href")),
				["/mn", "/an1.1", "/dn22"],
			);
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
		}
	});
});

function stubVisibleGeometry(dom: JSDOM, elements: Element[]) {
	const { HTMLElement } = dom.window;
	for (const [index, el] of elements.entries()) {
		(el as HTMLElement).getBoundingClientRect = () =>
			({
				top: 20,
				left: 20 + index * 80,
				bottom: 60,
				right: 90 + index * 80,
				width: 70,
				height: 40,
				x: 20 + index * 80,
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
	dom.window.getComputedStyle = ((el: Element) => {
		const display =
			el.classList.contains("hidden") || el.closest?.(".hidden")
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
}

describe("collectDictionaryHintTargets", () => {
	it("returns DPD/PED tabs and PED chips when the drawer is open on PED", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div class="bottom-popover visible">
					<div class="dict-shell" data-dict-active="ped">
						<button data-dict-panel="dpd">DPD</button>
						<button data-dict-panel="ped">PED</button>
						<div class="ped-part-chips">
							<button data-ped-part="0">sam</button>
							<button data-ped-part="1">mod</button>
							<button data-ped-part="2">aniya</button>
						</div>
					</div>
				</div>
			</body></html>`);
		const { document } = dom.window;
		const elements = [
			...document.querySelectorAll("[data-dict-panel], [data-ped-part]"),
			document.querySelector(".dict-shell")!,
			document.querySelector(".bottom-popover")!,
		];
		stubVisibleGeometry(dom, elements);

		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;
		try {
			const targets = collectDictionaryHintTargets(document);
			assert.deepEqual(
				targets.map((el) => el.textContent?.trim()),
				["DPD", "PED", "sam", "mod", "aniya"],
			);
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
		}
	});

	it("omits chip hints when only one chip exists, and skips chips on DPD", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div class="bottom-popover visible">
					<div class="dict-shell" data-dict-active="dpd">
						<button data-dict-panel="dpd">DPD</button>
						<button data-dict-panel="ped">PED</button>
						<div class="ped-part-chips hidden">
							<button data-ped-part="0">only</button>
						</div>
					</div>
				</div>
			</body></html>`);
		const { document } = dom.window;
		stubVisibleGeometry(dom, [
			...document.querySelectorAll("[data-dict-panel]"),
			document.querySelector(".dict-shell")!,
			document.querySelector(".bottom-popover")!,
		]);

		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;
		try {
			const targets = collectDictionaryHintTargets(document);
			assert.deepEqual(
				targets.map((el) => el.textContent?.trim()),
				["DPD", "PED"],
			);
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
		}
	});

	it("uses construction PED switcher chips when fallback chips are absent", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div class="bottom-popover visible">
					<div class="dict-shell" data-dict-active="ped">
						<button data-dict-panel="dpd">DPD</button>
						<button data-dict-panel="ped">PED</button>
						<span class="construction construction--ped-switcher">
							<button class="construction-part--ped" data-ped-part="0" data-lookup-word="nāma">nāma</button>
							<button class="construction-part--ped" data-ped-part="1" data-lookup-word="rūpa">rūpa</button>
						</span>
					</div>
				</div>
			</body></html>`);
		const { document } = dom.window;
		stubVisibleGeometry(dom, [
			...document.querySelectorAll("[data-dict-panel], [data-ped-part]"),
			document.querySelector(".dict-shell")!,
			document.querySelector(".bottom-popover")!,
		]);

		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;
		try {
			const targets = collectDictionaryHintTargets(document);
			assert.deepEqual(
				targets.map((el) => el.textContent?.trim()),
				["DPD", "PED", "nāma", "rūpa"],
			);
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
		}
	});
});

describe("collectActiveLinkHintAssignments", () => {
	it("prefers dictionary chrome over collection cards while the drawer is open", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div id="collections-grid">
					<article class="post-item"><a class="post-link" href="/mn">MN</a></article>
				</div>
				<div class="bottom-popover visible">
					<div class="dict-shell" data-dict-active="dpd">
						<button data-dict-panel="dpd">DPD</button>
						<button data-dict-panel="ped">PED</button>
					</div>
				</div>
			</body></html>`);
		const { document } = dom.window;
		stubVisibleGeometry(dom, [
			...document.querySelectorAll(
				"a.post-link, [data-dict-panel], .dict-shell, .bottom-popover, #collections-grid",
			),
		]);

		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;
		try {
			const assigned = collectActiveLinkHintAssignments(document);
			assert.deepEqual(
				assigned.map((entry) => entry.element.textContent?.trim()),
				["DPD", "PED"],
			);
			assert.equal(assigned[0]?.kind, "click");
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
		}
	});
});
