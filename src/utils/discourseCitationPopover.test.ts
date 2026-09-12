import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	annotateResearchCitationLinks,
	formatDiscourseCitationTitle,
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
