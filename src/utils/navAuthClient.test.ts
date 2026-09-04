import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	NAV_AUTH_STORAGE_KEY,
	clearNavAuthCache,
	navAuthSlotMatches,
	readNavAuthCache,
	renderNavAuthSlot,
	seedNavAuthCacheFromSlot,
	signedInNavAuthHtml,
	signedOutNavAuthHtml,
	writeNavAuthCache,
} from "./navAuthClient";

describe("navAuthClient", () => {
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
	});

	it("round-trips signed-in and signed-out cache", () => {
		assert.equal(readNavAuthCache(), null);
		writeNavAuthCache({ signedIn: true, displayName: "Siddhartha" });
		assert.deepEqual(readNavAuthCache(), {
			signedIn: true,
			displayName: "Siddhartha",
		});
		writeNavAuthCache({ signedIn: false });
		assert.deepEqual(readNavAuthCache(), { signedIn: false });
		clearNavAuthCache();
		assert.equal(readNavAuthCache(), null);
		assert.equal(storage.has(NAV_AUTH_STORAGE_KEY), false);
	});

	it("ignores invalid cache payloads", () => {
		storage.set(NAV_AUTH_STORAGE_KEY, "{not json");
		assert.equal(readNavAuthCache(), null);
		storage.set(NAV_AUTH_STORAGE_KEY, JSON.stringify({ signedIn: true }));
		assert.equal(readNavAuthCache(), null);
		storage.set(
			NAV_AUTH_STORAGE_KEY,
			JSON.stringify({ signedIn: true, displayName: "   " }),
		);
		assert.equal(readNavAuthCache(), null);
	});

	it("escapes untrusted names and return URLs in signed-in markup", () => {
		const html = signedInNavAuthHtml(
			`<img src=x onerror=alert(1)>`,
			`/mn1"><script>`,
		);
		assert.equal(html.includes("<img src"), false);
		assert.equal(html.includes("<script>"), false);
		assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
		assert.match(html, /value="\/mn1&quot;&gt;&lt;script&gt;"/);
	});

	it("escapes the register href", () => {
		const html = signedOutNavAuthHtml(`/register?returnTo="><script>`);
		assert.equal(html.includes("<script>"), false);
		assert.match(html, /href="\/register\?returnTo=&quot;&gt;&lt;script&gt;"/);
	});

	it("renders signed-in markup into a pending slot", () => {
		const { window } = new JSDOM(
			`<div id="nav-auth-slot" data-state="pending" aria-busy="true"></div>`,
		);
		const slot = window.document.getElementById("nav-auth-slot");
		assert.ok(slot);
		renderNavAuthSlot(slot, { signedIn: true, displayName: "Ānanda" }, {
			registerHref: "/register",
			returnTo: "/mn1/",
			hideGuestCta: false,
		});
		assert.equal(slot.getAttribute("data-state"), "signed-in");
		assert.equal(slot.hasAttribute("aria-busy"), false);
		assert.equal(
			slot.querySelector("#user-menu-button span")?.textContent,
			"Ānanda",
		);
		assert.equal(navAuthSlotMatches(slot, { signedIn: true, displayName: "Ānanda" }), true);
		assert.equal(
			navAuthSlotMatches(slot, { signedIn: true, displayName: "Sāriputta" }),
			false,
		);
	});

	it("keeps guest CTA hidden when requested", () => {
		const { window } = new JSDOM(
			`<div id="nav-auth-slot" data-state="pending"></div>`,
		);
		const slot = window.document.getElementById("nav-auth-slot");
		assert.ok(slot);
		renderNavAuthSlot(slot, { signedIn: false }, {
			registerHref: "/register",
			returnTo: "/",
			hideGuestCta: true,
		});
		assert.equal(slot.getAttribute("data-state"), "signed-out");
		assert.equal(slot.innerHTML, "");
	});

	it("seeds cache from server-rendered slots", () => {
		const { window } = new JSDOM(
			`<div id="nav-auth-slot" data-state="signed-in"><button id="user-menu-button"><span>Moggallāna</span></button></div>`,
		);
		const slot = window.document.getElementById("nav-auth-slot");
		assert.ok(slot);
		seedNavAuthCacheFromSlot(slot);
		assert.deepEqual(readNavAuthCache(), {
			signedIn: true,
			displayName: "Moggallāna",
		});

		slot.setAttribute("data-state", "signed-out");
		slot.innerHTML = "";
		seedNavAuthCacheFromSlot(slot);
		assert.deepEqual(readNavAuthCache(), { signedIn: false });

		slot.setAttribute("data-state", "pending");
		seedNavAuthCacheFromSlot(slot);
		assert.deepEqual(readNavAuthCache(), { signedIn: false });
	});
});
