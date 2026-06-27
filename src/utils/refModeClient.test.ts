import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
	getStoredRefMode,
	initRefModeFromUrl,
	resolveRefMode,
	setStoredRefMode,
	REF_MODE_STORAGE_KEY,
} from "./refModeClient";

describe("refModeClient", () => {
	const storage = new Map<string, string>();

	beforeEach(() => {
		storage.clear();
		(globalThis as { localStorage?: Storage }).localStorage = {
			getItem: (key) => storage.get(key) ?? null,
			setItem: (key, value) => {
				storage.set(key, value);
			},
			removeItem: (key) => {
				storage.delete(key);
			},
			clear: () => storage.clear(),
			key: () => null,
			length: 0,
		};
	});

	afterEach(() => {
		delete (globalThis as { localStorage?: Storage }).localStorage;
		delete (globalThis as { window?: unknown }).window;
	});

	it("resolveRefMode prefers URL over localStorage", () => {
		setStoredRefMode(true);
		assert.equal(
			resolveRefMode(new URLSearchParams("ref=false")),
			false,
		);
		assert.equal(
			resolveRefMode(new URLSearchParams("ref=true")),
			true,
		);
	});

	it("resolveRefMode falls back to localStorage when URL omits ref", () => {
		assert.equal(resolveRefMode(new URLSearchParams()), false);
		setStoredRefMode(true);
		assert.equal(resolveRefMode(new URLSearchParams()), true);
	});

	it("setStoredRefMode removes the key when disabled", () => {
		setStoredRefMode(true);
		assert.equal(storage.has(REF_MODE_STORAGE_KEY), true);
		setStoredRefMode(false);
		assert.equal(storage.has(REF_MODE_STORAGE_KEY), false);
		assert.equal(getStoredRefMode(), false);
	});

	it("initRefModeFromUrl syncs URL ref to localStorage", () => {
		(globalThis as { window?: { location: { href: string }; history: { replaceState: (...args: unknown[]) => void } } }).window = {
			location: { href: "https://example.test/an4?ref=true" },
			history: { replaceState: () => {} },
		};
		const replaced: string[] = [];
		globalThis.window!.history.replaceState = () => {
			replaced.push(globalThis.window!.location.href);
		};

		assert.equal(initRefModeFromUrl(), true);
		assert.equal(getStoredRefMode(), true);
		assert.equal(replaced.length, 0);
	});

	it("initRefModeFromUrl applies stored ref to URL when absent", () => {
		setStoredRefMode(true);
		(globalThis as { window?: { location: { href: string }; history: { replaceState: (...args: unknown[]) => void } } }).window = {
			location: { href: "https://example.test/an4" },
			history: {
				replaceState: (_state, _title, url) => {
					globalThis.window!.location.href = String(url);
				},
			},
		};

		assert.equal(initRefModeFromUrl(), true);
		assert.equal(
			globalThis.window!.location.href,
			"https://example.test/an4?ref=true",
		);
	});

	it("initRefModeFromUrl clears storage for explicit ref=false", () => {
		setStoredRefMode(true);
		(globalThis as { window?: { location: { href: string }; history: { replaceState: (...args: unknown[]) => void } } }).window = {
			location: { href: "https://example.test/an4?ref=false" },
			history: { replaceState: () => {} },
		};

		assert.equal(initRefModeFromUrl(), false);
		assert.equal(getStoredRefMode(), false);
	});
});
