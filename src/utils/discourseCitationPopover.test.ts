import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	annotateResearchCitationLinks,
	formatDiscourseCitationTitle,
	installDiscourseCitationPopovers,
	slugFromCitationHref,
} from "./discourseCitationPopover";

describe("formatDiscourseCitationTitle", () => {
	it("matches the persons-index title row", () => {
		assert.equal(
			formatDiscourseCitationTitle(
				"mn58",
				"Abhayarājakumāra sutta - To Prince Abhaya",
			),
			"MN 58 - Abhayarājakumāra sutta - To Prince Abhaya",
		);
	});

	it("does not duplicate an ID already in the title", () => {
		assert.equal(
			formatDiscourseCitationTitle(
				"mn58",
				"MN 58 - Abhayarājakumāra sutta - To Prince Abhaya",
			),
			"MN 58 - Abhayarājakumāra sutta - To Prince Abhaya",
		);
	});

	it("falls back to the display ID when the title is just the slug", () => {
		assert.equal(formatDiscourseCitationTitle("sn47.12", "sn47.12"), "SN 47.12");
		assert.equal(formatDiscourseCitationTitle("mn10", ""), "MN 10");
	});
});

describe("slugFromCitationHref", () => {
	it("reads the discourse slug from on-screen hrefs", () => {
		assert.equal(slugFromCitationHref("/mn58"), "mn58");
		assert.equal(slugFromCitationHref("/sn47.12#p3"), "sn47.12");
		assert.equal(slugFromCitationHref("#d-t0-mn10"), "");
	});
});

describe("annotateResearchCitationLinks", () => {
	it("adds title and description to known citation links", () => {
		const html = annotateResearchCitationLinks(
			`<p>See <a class="ai-summary-ref" href="/mn58">MN 58</a>.</p>`,
			[
				{
					slug: "mn58",
					href: "/mn58",
					title: "Abhayarājakumāra sutta - To Prince Abhaya",
					description:
						"Prince Abhaya, coached by Nigaṇṭha Nāṭaputta, tries to trap the Buddha.",
				},
			],
		);
		assert.match(
			html,
			/data-cite-title="MN 58 - Abhayarājakumāra sutta - To Prince Abhaya"/,
		);
		assert.match(html, /data-cite-desc="Prince Abhaya, coached/);
		assert.match(html, /href="\/mn58"/);
	});

	it("leaves unknown IDs and export hrefs alone", () => {
		const html = annotateResearchCitationLinks(
			`<p><a class="ai-summary-ref" href="/mn10">MN 10</a> <a class="ai-summary-ref" href="#d-t0-mn58">MN 58</a></p>`,
			[
				{
					slug: "mn58",
					href: "/mn58",
					title: "Abhayarājakumāra sutta - To Prince Abhaya",
					description: "A dilemma about harsh speech.",
				},
			],
		);
		assert.doesNotMatch(html, /data-cite-title/);
	});

	it("escapes quotes in popover copy", () => {
		const html = annotateResearchCitationLinks(
			`<a class="ai-summary-ref" href="/mn1">MN 1</a>`,
			[
				{
					slug: "mn1",
					href: "/mn1",
					title: `Mūlapariyāya sutta - "The Root Sequence"`,
					description: `He says "this is not mine".`,
				},
			],
		);
		assert.match(html, /data-cite-title="[^"]*&quot;The Root Sequence&quot;"/);
		assert.match(html, /data-cite-desc="He says &quot;this is not mine&quot;\."/);
	});
});

describe("installDiscourseCitationPopovers", () => {
	it("shows the shared panel for compact source rows inside .ai-hits", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div id="thread">
					<details class="ai-sources" open>
						<summary>Sources · 1 discourse</summary>
						<ol class="ai-hits ai-sources-list">
							<li data-result-type="discourse"><a href="/dn2" class="search-discourse-card ai-source-ref" data-search-result data-cite-title="DN 2 - Sāmaññaphala sutta" data-cite-desc="King Ajātasattu visits."><span class="ai-source-id">DN 2</span><span class="ai-source-title">Sāmaññaphala sutta</span></a></li>
						</ol>
					</details>
				</div>
			</body></html>`);
		const { document } = dom.window;
		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		const previousElement = (globalThis as Record<string, unknown>).Element;
		const previousAnchor = (globalThis as Record<string, unknown>)
			.HTMLAnchorElement;
		const previousHtmlElement = (globalThis as Record<string, unknown>)
			.HTMLElement;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;
		(globalThis as Record<string, unknown>).Element = dom.window.Element;
		(globalThis as Record<string, unknown>).HTMLAnchorElement =
			dom.window.HTMLAnchorElement;
		(globalThis as Record<string, unknown>).HTMLElement =
			dom.window.HTMLElement;
		try {
			const thread = document.querySelector("#thread")!;
			installDiscourseCitationPopovers(thread);
			const link = thread.querySelector(
				"a.ai-source-ref",
			) as HTMLAnchorElement;
			link.dispatchEvent(
				new dom.window.MouseEvent("mouseover", { bubbles: true }),
			);
			const panel = document.getElementById("ai-citation-popover");
			assert.ok(panel?.classList.contains("is-shown"));
			assert.equal(
				panel?.querySelector(".ai-citation-popover-title")?.textContent,
				"DN 2 - Sāmaññaphala sutta",
			);
			assert.equal(
				panel?.querySelector(".ai-citation-popover-desc")?.textContent,
				"King Ajātasattu visits.",
			);
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
			(globalThis as Record<string, unknown>).Element = previousElement;
			(globalThis as Record<string, unknown>).HTMLAnchorElement =
				previousAnchor;
			(globalThis as Record<string, unknown>).HTMLElement =
				previousHtmlElement;
		}
	});

	it("ignores source rows outside .ai-hits", () => {
		const dom = new JSDOM(`<!doctype html>
			<html><body>
				<div id="thread">
					<p><a href="/dn2" class="ai-source-ref" data-cite-title="DN 2 - Sāmaññaphala sutta">DN 2</a></p>
				</div>
			</body></html>`);
		const { document } = dom.window;
		const previousWindow = globalThis.window;
		const previousDocument = globalThis.document;
		const previousElement = (globalThis as Record<string, unknown>).Element;
		const previousAnchor = (globalThis as Record<string, unknown>)
			.HTMLAnchorElement;
		const previousHtmlElement = (globalThis as Record<string, unknown>)
			.HTMLElement;
		globalThis.window = dom.window as unknown as Window & typeof globalThis;
		globalThis.document = document;
		(globalThis as Record<string, unknown>).Element = dom.window.Element;
		(globalThis as Record<string, unknown>).HTMLAnchorElement =
			dom.window.HTMLAnchorElement;
		(globalThis as Record<string, unknown>).HTMLElement =
			dom.window.HTMLElement;
		try {
			const thread = document.querySelector("#thread")!;
			installDiscourseCitationPopovers(thread);
			const link = thread.querySelector(
				"a.ai-source-ref",
			) as HTMLAnchorElement;
			link.dispatchEvent(
				new dom.window.MouseEvent("mouseover", { bubbles: true }),
			);
			const panel = document.getElementById("ai-citation-popover");
			assert.ok(!panel || !panel.classList.contains("is-shown"));
		} finally {
			globalThis.window = previousWindow;
			globalThis.document = previousDocument;
			(globalThis as Record<string, unknown>).Element = previousElement;
			(globalThis as Record<string, unknown>).HTMLAnchorElement =
				previousAnchor;
			(globalThis as Record<string, unknown>).HTMLElement =
				previousHtmlElement;
		}
	});
});
