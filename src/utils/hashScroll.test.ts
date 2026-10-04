import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	hashScrollBehavior,
	isHashTargetAligned,
	scheduleInitialHashScroll,
} from "./hashScroll";

function mount() {
	const dom = new JSDOM(`<!doctype html><html><body><h2 id="section">Section</h2></body></html>`, {
		url: "https://example.test/dn15#section",
	});
	const { window } = dom;
	const previous = {
		window: globalThis.window,
		document: globalThis.document,
	};
	globalThis.window = window as unknown as Window & typeof globalThis;
	globalThis.document = window.document;
	Object.defineProperty(window, "scrollY", {
		value: 0,
		writable: true,
		configurable: true,
	});
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
		onchange: null,
	})) as unknown as typeof window.matchMedia;
	window.requestAnimationFrame = () => 1;
	Object.defineProperty(window.document, "visibilityState", {
		configurable: true,
		get: () => "visible",
	});
	Object.defineProperty(window.document, "fonts", {
		configurable: true,
		value: { ready: new Promise(() => {}) },
	});
	return {
		window,
		section: window.document.getElementById("section") as HTMLElement,
		restore() {
			globalThis.window = previous.window;
			globalThis.document = previous.document;
		},
	};
}

describe("hashScrollBehavior", () => {
	let ctx: ReturnType<typeof mount>;
	afterEach(() => ctx?.restore());

	it("jumps instantly on the first load", () => {
		ctx = mount();
		assert.equal(hashScrollBehavior(false), "auto");
	});

	it("jumps instantly while the tab is in the background", () => {
		ctx = mount();
		Object.defineProperty(ctx.window.document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		assert.equal(hashScrollBehavior(true), "auto");
	});

	it("animates an in-page click in a visible tab", () => {
		ctx = mount();
		Object.defineProperty(ctx.window.document, "visibilityState", {
			configurable: true,
			get: () => "visible",
		});
		assert.equal(hashScrollBehavior(true), "smooth");
	});
});

describe("isHashTargetAligned", () => {
	let ctx: ReturnType<typeof mount>;
	afterEach(() => ctx?.restore());

	it("treats an unlaid-out box as not aligned", () => {
		ctx = mount();
		ctx.section.getBoundingClientRect = () =>
			({ top: 0, width: 0, height: 0 }) as DOMRect;
		assert.equal(isHashTargetAligned(ctx.section, 96), false);
	});

	it("is aligned when the target sits on the reading line", () => {
		ctx = mount();
		ctx.section.getBoundingClientRect = () =>
			({ top: 100, width: 40, height: 20 }) as DOMRect;
		assert.equal(isHashTargetAligned(ctx.section, 96), true);
	});

	it("is aligned when the target is already as high as the page allows", () => {
		ctx = mount();
		ctx.section.getBoundingClientRect = () =>
			({ top: 20, width: 40, height: 20 }) as DOMRect;
		assert.equal(isHashTargetAligned(ctx.section, 96), true);
	});
});

describe("scheduleInitialHashScroll", () => {
	let ctx: ReturnType<typeof mount>;
	let cancel: (() => void) | null = null;
	afterEach(() => {
		cancel?.();
		cancel = null;
		ctx?.restore();
	});

	it("scrolls again after load when the first jump was dropped", async () => {
		ctx = mount();
		let calls = 0;
		cancel = scheduleInitialHashScroll({
			align: () => {
				calls += 1;
			},
			aligned: () => false,
			loadRetryDelaysMs: [0],
		});
		assert.equal(calls, 1);
		ctx.window.dispatchEvent(new ctx.window.Event("load"));
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.equal(calls, 2);
	});

	it("does not yank a tab the reader has already scrolled", async () => {
		ctx = mount();
		let calls = 0;
		cancel = scheduleInitialHashScroll({
			align: () => {
				calls += 1;
			},
			aligned: () => false,
			loadRetryDelaysMs: [0],
		});
		ctx.window.dispatchEvent(new ctx.window.Event("wheel"));
		ctx.window.dispatchEvent(new ctx.window.Event("load"));
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.equal(calls, 1);
	});

	it("still corrects a browser fragment scroll the reader did not make", async () => {
		ctx = mount();
		let calls = 0;
		cancel = scheduleInitialHashScroll({
			align: () => {
				calls += 1;
			},
			aligned: () => false,
			loadRetryDelaysMs: [0],
		});
		ctx.window.scrollY = 400;
		ctx.window.dispatchEvent(new ctx.window.Event("load"));
		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.equal(calls, 2);
	});

	it("corrects a fragment scroll the reader did not cause", () => {
		ctx = mount();
		let calls = 0;
		cancel = scheduleInitialHashScroll({
			align: () => {
				calls += 1;
			},
			aligned: () => false,
			loadRetryDelaysMs: [],
		});
		const afterStart = calls;
		ctx.window.dispatchEvent(new ctx.window.Event("scroll"));
		assert.equal(calls, afterStart + 1);
	});

	it("scrolls when a background tab becomes visible", () => {
		ctx = mount();
		let visibility: DocumentVisibilityState = "hidden";
		Object.defineProperty(ctx.window.document, "visibilityState", {
			configurable: true,
			get: () => visibility,
		});
		let calls = 0;
		cancel = scheduleInitialHashScroll({
			align: () => {
				calls += 1;
			},
			aligned: () => false,
			loadRetryDelaysMs: [],
		});
		const afterStart = calls;
		ctx.window.scrollY = 200;
		visibility = "visible";
		ctx.window.document.dispatchEvent(new ctx.window.Event("visibilitychange"));
		assert.equal(calls, afterStart + 1);
	});
});
