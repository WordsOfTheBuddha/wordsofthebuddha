import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	applyAuthReturnPaths,
	hideSignInPrompt,
	installSignInPrompt,
	showSignInPrompt,
} from "./signInPrompt";

const PROMPT_HTML = `
	<div id="saveSignInPrompt" data-prompt hidden>
		<div class="site-dialog-sheet">
			<button type="button" class="close-prompt">×</button>
			<a class="site-dialog-primary" data-auth-href="/register" href="/register">Create an account</a>
			<a class="site-dialog-secondary" data-auth-href="/signin" href="/signin">Sign in</a>
		</div>
	</div>
	<div id="readLaterSignInPrompt" data-prompt hidden>
		<div class="site-dialog-sheet">
			<button type="button" class="close-prompt">×</button>
		</div>
	</div>
	<button id="saveButton" type="button">Save</button>
`;

let previousDocument: Document | undefined;
let previousWindow: Window | undefined;
let activeWindow: Window | undefined;

function withDom(): Document {
	const dom = new JSDOM(PROMPT_HTML, {
		url: "https://example.test/mn1/?p=2",
	});
	previousDocument = globalThis.document;
	previousWindow = globalThis.window;
	activeWindow = dom.window;
	globalThis.document = dom.window.document;
	(globalThis as { window?: Window }).window = dom.window;
	return dom.window.document;
}

afterEach(() => {
	if (previousDocument) globalThis.document = previousDocument;
	if (previousWindow) (globalThis as { window?: Window }).window = previousWindow;
	previousDocument = undefined;
	previousWindow = undefined;
	activeWindow?.close();
	activeWindow = undefined;
});

describe("signInPrompt", () => {
	it("shows one prompt, hides others, and moves it to body", () => {
		const document = withDom();
		const save = document.getElementById("saveSignInPrompt")!;
		const later = document.getElementById("readLaterSignInPrompt")!;
		later.hidden = false;
		const wrapper = document.createElement("div");
		wrapper.appendChild(save);
		document.body.appendChild(wrapper);

		showSignInPrompt("saveSignInPrompt");

		assert.equal(save.hidden, false);
		assert.equal(later.hidden, true);
		assert.equal(save.parentElement, document.body);
		assert.equal(save.getAttribute("aria-hidden"), "false");
	});

	it("stamps register and sign-in links with the current return path", () => {
		const document = withDom();
		const save = document.getElementById("saveSignInPrompt")!;
		applyAuthReturnPaths(save);
		const register = save.querySelector<HTMLAnchorElement>(
			'a[data-auth-href="/register"]',
		)!;
		const signin = save.querySelector<HTMLAnchorElement>(
			'a[data-auth-href="/signin"]',
		)!;
		assert.equal(
			register.getAttribute("href"),
			"/register?returnTo=%2Fmn1%2F%3Fp%3D2",
		);
		assert.equal(
			signin.getAttribute("href"),
			"/signin?returnTo=%2Fmn1%2F%3Fp%3D2",
		);
	});

	it("closes from the backdrop, close button, and Escape", () => {
		const document = withDom();
		const view = document.defaultView!;
		const save = document.getElementById("saveSignInPrompt")!;
		installSignInPrompt(save);
		showSignInPrompt("saveSignInPrompt");
		assert.equal(save.hidden, false);

		save.dispatchEvent(new view.Event("click", { bubbles: true }));
		assert.equal(save.hidden, true);

		showSignInPrompt("saveSignInPrompt");
		save.querySelector(".close-prompt")!.dispatchEvent(
			new view.Event("click", { bubbles: true }),
		);
		assert.equal(save.hidden, true);

		showSignInPrompt("saveSignInPrompt");
		document.dispatchEvent(
			new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
		assert.equal(save.hidden, true);
	});

	it("does not close when clicking inside the sheet", () => {
		const document = withDom();
		const view = document.defaultView!;
		const save = document.getElementById("saveSignInPrompt")!;
		installSignInPrompt(save);
		showSignInPrompt("saveSignInPrompt");
		save.querySelector(".site-dialog-sheet")!.dispatchEvent(
			new view.Event("click", { bubbles: true }),
		);
		assert.equal(save.hidden, false);
		hideSignInPrompt(save);
	});
});
