import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	attachTableOfContents,
	detachTableOfContents,
	DISCOURSE_TOC_HEADING_SELECTOR,
	DISCOURSE_TOC_MIN_HEADINGS,
	findVisibleElementById,
	RESEARCH_TOC_CONTENT_SELECTOR,
	RESEARCH_TOC_HEADING_SELECTOR,
	RESEARCH_TOC_MIN_HEADINGS,
	TOC_ACTIVE_SLACK_PX,
	TOC_SCROLL_OFFSET_PX,
	headingLabel,
	isNamedSectionHeading,
	namedSectionHeadingsFromMarkdown,
	pickActiveHeadingId,
	researchTableOfContentsOptions,
	scrollYToAlignHeading,
	shouldShowDiscourseToc,
	slugifyHeading,
	tocBaseLevel,
	tocLinkClass,
} from "./tocClient";

describe("headingLabel", () => {
	it("strips gloss markup used in section titles", () => {
		assert.equal(
			headingLabel(
				"22. The |Four Great References::the hermeneutical standards [cattāro mahāpadesā]|",
			),
			"22. The Four Great References",
		);
	});

	it("collapses extra whitespace", () => {
		assert.equal(headingLabel("  1.  Observing   the Body  "), "1. Observing the Body");
	});
});

describe("isNamedSectionHeading", () => {
	it("accepts titled MN/DN sections", () => {
		assert.equal(isNamedSectionHeading("1. The Brahmin Vassakāra"), true);
		assert.equal(isNamedSectionHeading("Observing the Body"), true);
		assert.equal(isNamedSectionHeading("1.1. Body Contemplation with Breathing"), true);
		assert.equal(isNamedSectionHeading("Paṭhama vagga - First Chapter"), true);
	});

	it("rejects verse numbers and AN range ids", () => {
		assert.equal(isNamedSectionHeading("179"), false);
		assert.equal(isNamedSectionHeading("1.268"), false);
		assert.equal(isNamedSectionHeading("2.180–184"), false);
	});
});

describe("research report ToC labels", () => {
	it("decodes apostrophe entities in data-report-heading", () => {
		const dom = new JSDOM(
			`<!doctype html><html><body>
				<nav id="post-toc"></nav>
				<div class="ai-turn"><div class="ai-report"><div class="ai-answer-body">
					<h2 id="rh-trainer" data-report-heading="The trainer&#39;s-eye view">The trainer&#39;s-eye view</h2>
					<p>Body</p>
					<h2 id="rh-next" data-report-heading="Next">Next</h2>
					<p>More</p>
				</div></div></div>
			</body></html>`,
		);
		const { window } = dom;
		const previous = {
			window: globalThis.window,
			document: globalThis.document,
		};
		globalThis.window = window as unknown as Window & typeof globalThis;
		globalThis.document = window.document;
		globalThis.AbortController = window.AbortController;
		try {
			const options = researchTableOfContentsOptions();
			assert.equal(attachTableOfContents(options), true);
			const link = window.document.querySelector(
				'#post-toc a[href="#rh-trainer"]',
			);
			assert.equal(link?.textContent, "The trainer's-eye view");
		} finally {
			detachTableOfContents("post-toc");
			globalThis.window = previous.window;
			globalThis.document = previous.document;
		}
	});
});

describe("slugifyHeading", () => {
	it("matches the markdown heading id style", () => {
		assert.equal(
			slugifyHeading("1. Observing the Body"),
			"1-observing-the-body",
		);
	});

	it("folds Pāli diacritics to ASCII instead of hyphens", () => {
		assert.equal(
			slugifyHeading("2. Citta Hatthisāriputta and Poṭṭhapāda"),
			"2-citta-hatthisariputta-and-potthapada",
		);
		assert.equal(slugifyHeading("Paṭhama vagga"), "pathama-vagga");
	});
});

describe("shouldShowDiscourseToc", () => {
	it("shows a ToC when there are enough named sections", () => {
		const markdown = `
#### 1. The Brahmin Vassakāra
text
#### 2. Principles That Prevent Decline
text
#### 3. Principles That Prevent Decline Among the Bhikkhus
text
`;
		assert.equal(shouldShowDiscourseToc(markdown), true);
		assert.equal(
			namedSectionHeadingsFromMarkdown(markdown).length >=
				DISCOURSE_TOC_MIN_HEADINGS,
			true,
		);
	});

	it("hides a ToC for verse-number-only headings", () => {
		const markdown = `
#### 179
verse
#### 180
verse
#### 181
verse
`;
		assert.equal(shouldShowDiscourseToc(markdown), false);
	});

	it("hides a ToC when there are fewer named sections than the minimum", () => {
		const markdown = `
### Setting
text
`;
		assert.equal(shouldShowDiscourseToc(markdown), false);
	});

	it("counts h1 through h5 named headings, but not h6", () => {
		const markdown = `
# Opening
## Unused
##### 4.5.1. Exposition of the Truth of Suffering
###### 4.3.1.1. The Shorter Section
`;
		assert.deepEqual(namedSectionHeadingsFromMarkdown(markdown), [
			"Opening",
			"Unused",
			"4.5.1. Exposition of the Truth of Suffering",
		]);
	});
});

describe("tocLinkClass", () => {
	it("treats h1 and h2 as top-level like h3 on discourses", () => {
		const base = tocBaseLevel("H4");
		assert.equal(tocLinkClass("H1", base, 0), "");
		assert.equal(tocLinkClass("H2", base, 0), "");
		assert.equal(tocLinkClass("H3", base, 0), "");
		assert.equal(tocLinkClass("H4", base, 0), "toc-h3");
		assert.equal(tocLinkClass("H5", base, 0), "toc-h5");
	});

	it("keeps essay h3–h5 nested under h2", () => {
		const base = tocBaseLevel("H3");
		assert.equal(tocLinkClass("H2", base, 0), "");
		assert.equal(tocLinkClass("H3", base, 0), "toc-h3");
		assert.equal(tocLinkClass("H4", base, 0), "toc-h5");
		assert.equal(tocLinkClass("H5", base, 0), "toc-h5");
	});

	it("does not indent a flat list of h4 or h5 headings", () => {
		assert.equal(tocLinkClass("H4", 3, 1), "");
		assert.equal(tocLinkClass("H5", 3, 2), "");
	});
});

describe("pickActiveHeadingId", () => {
	const headings = [
		{ id: "one", top: 40 },
		{ id: "two", top: 400 },
		{ id: "three", top: 900 },
	];

	it("keeps the last passed heading active until the next title reaches the line", () => {
		assert.equal(pickActiveHeadingId(headings, 100), "one");
		assert.equal(pickActiveHeadingId(headings, 399), "one");
		assert.equal(pickActiveHeadingId(headings, 400), "two");
		assert.equal(pickActiveHeadingId(headings, 800), "two");
		assert.equal(pickActiveHeadingId(headings, 900), "three");
	});

	it("highlights nothing before the first title has reached the line", () => {
		assert.equal(pickActiveHeadingId(headings, 0), null);
		assert.equal(pickActiveHeadingId(headings, 39), null);
		assert.equal(
			pickActiveHeadingId(
				[
					{ id: "one", top: 500 },
					{ id: "two", top: 900 },
				],
				100,
			),
			null,
		);
	});

	it("activates the first heading once it reaches the line", () => {
		assert.equal(pickActiveHeadingId(headings, 40), "one");
	});

	it("counts a heading a few pixels below the line when slack is set", () => {
		const landedShort = [
			{ id: "one", top: 40 },
			{ id: "two", top: 104 },
		];
		assert.equal(pickActiveHeadingId(landedShort, 100), "one");
		assert.equal(
			pickActiveHeadingId(landedShort, 100, TOC_ACTIVE_SLACK_PX),
			"two",
		);
	});

	it("returns null when there are no headings", () => {
		assert.equal(pickActiveHeadingId([], 100), null);
	});
});

describe("researchTableOfContentsOptions", () => {
	it("targets the last report body with stamped headings", () => {
		const options = researchTableOfContentsOptions();
		assert.equal(options.contentSelector, RESEARCH_TOC_CONTENT_SELECTOR);
		assert.equal(options.headingSelector, RESEARCH_TOC_HEADING_SELECTOR);
		assert.equal(options.nestedTag, "H3");
		assert.equal(options.minHeadings, RESEARCH_TOC_MIN_HEADINGS);
		assert.equal(options.placement, "fixed");
		assert.equal(options.requireNamed, false);
	});
});

describe("scrollYToAlignHeading", () => {
	it("scrolls far enough that the heading is at or above the reading line", () => {
		assert.equal(scrollYToAlignHeading(500, 0), 404);
		assert.equal(scrollYToAlignHeading(500.4, 0), 405);
		assert.equal(scrollYToAlignHeading(100, 0), 4);
	});

	it("does not scroll above the page top", () => {
		assert.equal(scrollYToAlignHeading(50, 0), 0);
	});
});

function discourseTableOfContentsOptions() {
	return {
		contentSelector: ".interleaved-article",
		headingSelector: DISCOURSE_TOC_HEADING_SELECTOR,
		nestedTag: "H4",
		minHeadings: DISCOURSE_TOC_MIN_HEADINGS,
		requireNamed: true,
		placement: "fixed" as const,
		desktopNavId: "post-toc",
		mobileNavId: "mobile-toc-nav",
		mobileToggleId: "mobile-toc-toggle",
		mobileOverlayId: "mobile-toc-overlay",
		mobileCloseId: "mobile-toc-close",
		activeClass: "has-toc",
	};
}

function stubRect(top: number): DOMRect {
	return {
		top,
		bottom: top + 20,
		left: 0,
		right: 0,
		width: 0,
		height: 20,
		x: 0,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}

describe("attachTableOfContents scroll spy", () => {
	function mountResearchReportToc() {
		const dom = new JSDOM(
			`<!doctype html><html class="pali-on split"><body>
				<nav id="post-toc"></nav>
				<div class="ai-turn">
					<div class="ai-report">
						<div class="ai-answer-body">
							<h2 id="rh-one" data-report-heading="One">One</h2>
							<p>First</p>
							<h2 id="rh-two" data-report-heading="Two">Two</h2>
							<p>Second</p>
						</div>
					</div>
				</div>
			</body></html>`,
			{ url: "https://example.test/search?mode=research" },
		);
		const { window } = dom;
		const previous = {
			window: globalThis.window,
			document: globalThis.document,
			localStorage: globalThis.localStorage,
			requestAnimationFrame: globalThis.requestAnimationFrame,
			HTMLElement: globalThis.HTMLElement,
		};
		globalThis.window = window as unknown as Window & typeof globalThis;
		globalThis.document = window.document;
		globalThis.localStorage = window.localStorage;
		globalThis.AbortController = window.AbortController;
		globalThis.HTMLElement = window.HTMLElement;
		window.localStorage.setItem("layout", "split");
		window.HTMLElement.prototype.checkVisibility = () => true;
		globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
			cb(0);
			return 1;
		};
		Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
		Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
		window.scrollTo = () => {};
		return {
			window,
			restore() {
				detachTableOfContents("post-toc");
				globalThis.window = previous.window;
				globalThis.document = previous.document;
				globalThis.localStorage = previous.localStorage;
				globalThis.requestAnimationFrame = previous.requestAnimationFrame;
				globalThis.HTMLElement = previous.HTMLElement;
			},
		};
	}

	it("finds research headings even when split layout is stored", () => {
		const ctx = mountResearchReportToc();
		try {
			assert.equal(findVisibleElementById("rh-two")?.id, "rh-two");
		} finally {
			ctx.restore();
		}
	});

	it("highlights the section at the reading line and updates on scroll", () => {
		const ctx = mountResearchReportToc();
		try {
			const options = researchTableOfContentsOptions();
			assert.equal(attachTableOfContents(options), true);
			const nav = ctx.window.document.getElementById("post-toc");
			assert.ok(nav);
			const links = [...nav.querySelectorAll("a")];
			assert.equal(links.length, 2);

			const one = ctx.window.document.getElementById("rh-one");
			const two = ctx.window.document.getElementById("rh-two");
			assert.ok(one && two);
			one.getBoundingClientRect = () =>
				({ top: 40, bottom: 60, left: 0, right: 0, width: 0, height: 20, x: 0, y: 40, toJSON: () => ({}) }) as DOMRect;
			two.getBoundingClientRect = () =>
				({ top: 900, bottom: 920, left: 0, right: 0, width: 0, height: 20, x: 0, y: 900, toJSON: () => ({}) }) as DOMRect;

			ctx.window.dispatchEvent(new ctx.window.Event("scroll"));
			assert.equal(
				nav.querySelector('a[href="#rh-one"]')?.classList.contains("active"),
				true,
			);
			assert.equal(
				nav.querySelector('a[href="#rh-two"]')?.classList.contains("active"),
				false,
			);

			one.getBoundingClientRect = () =>
				({ top: -200, bottom: -180, left: 0, right: 0, width: 0, height: 20, x: 0, y: -200, toJSON: () => ({}) }) as DOMRect;
			two.getBoundingClientRect = () =>
				({ top: TOC_SCROLL_OFFSET_PX, bottom: TOC_SCROLL_OFFSET_PX + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: TOC_SCROLL_OFFSET_PX, toJSON: () => ({}) }) as DOMRect;
			ctx.window.dispatchEvent(new ctx.window.Event("scroll"));
			assert.equal(
				nav.querySelector('a[href="#rh-two"]')?.classList.contains("active"),
				true,
			);
		} finally {
			ctx.restore();
		}
	});

	function mountDiscourseSplitToc() {
		const dom = new JSDOM(
			`<!doctype html><html class="pali-on split"><body>
				<nav id="post-toc"></nav>
				<article class="interleaved-article" aria-hidden="true">
					<h3 id="1-observing-the-body">1. Observing the Body</h3>
					<h4 id="14-contemplating-the-disagreeable-in-the-body">1.4. Contemplating the Disagreeable in the Body</h4>
				</article>
				<div class="split-wrapper" aria-hidden="false">
					<article id="panel1" class="split-panel">
						<h3 id="1-observing-the-body">1. Observing the Body</h3>
						<h4 id="14-contemplating-the-disagreeable-in-the-body">1.4. Contemplating the Disagreeable in the Body</h4>
					</article>
					<article id="panel2" class="split-panel"></article>
				</div>
			</body></html>`,
			{ url: "https://example.test/mn/mn10/" },
		);
		const { window } = dom;
		const previous = {
			window: globalThis.window,
			document: globalThis.document,
			localStorage: globalThis.localStorage,
			requestAnimationFrame: globalThis.requestAnimationFrame,
			HTMLElement: globalThis.HTMLElement,
		};
		globalThis.window = window as unknown as Window & typeof globalThis;
		globalThis.document = window.document;
		globalThis.localStorage = window.localStorage;
		globalThis.AbortController = window.AbortController;
		globalThis.HTMLElement = window.HTMLElement;
		window.localStorage.setItem("layout", "split");
		window.HTMLElement.prototype.checkVisibility = function () {
			return !this.closest('[aria-hidden="true"]');
		};
		globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
			cb(0);
			return 1;
		};
		Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
		Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
		window.scrollTo = () => {};
		return {
			window,
			restore() {
				detachTableOfContents("post-toc");
				globalThis.window = previous.window;
				globalThis.document = previous.document;
				globalThis.localStorage = previous.localStorage;
				globalThis.requestAnimationFrame = previous.requestAnimationFrame;
				globalThis.HTMLElement = previous.HTMLElement;
			},
		};
	}

	it("highlights the visible split-panel heading, not the hidden interleaved copy", () => {
		const ctx = mountDiscourseSplitToc();
		try {
			assert.equal(attachTableOfContents(discourseTableOfContentsOptions()), true);
			const nav = ctx.window.document.getElementById("post-toc");
			assert.ok(nav);
			assert.equal(nav.querySelectorAll("a").length, 2);

			const panel = ctx.window.document.getElementById("panel1");
			assert.ok(panel);
			const one = panel.querySelector<HTMLElement>(
				'[id="1-observing-the-body"]',
			);
			const two = panel.querySelector<HTMLElement>(
				'[id="14-contemplating-the-disagreeable-in-the-body"]',
			);
			assert.ok(one && two);
			one.getBoundingClientRect = () => stubRect(-400);
			two.getBoundingClientRect = () => stubRect(40);

			ctx.window.dispatchEvent(new ctx.window.Event("scroll"));
			assert.equal(
				nav
					.querySelector('a[href="#14-contemplating-the-disagreeable-in-the-body"]')
					?.classList.contains("active"),
				true,
			);
			assert.equal(
				nav
					.querySelector('a[href="#1-observing-the-body"]')
					?.classList.contains("active"),
				false,
			);
		} finally {
			ctx.restore();
		}
	});
});
