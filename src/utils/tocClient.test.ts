import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DISCOURSE_TOC_MIN_HEADINGS,
	TOC_ACTIVE_SLACK_PX,
	headingLabel,
	isNamedSectionHeading,
	namedSectionHeadingsFromMarkdown,
	pickActiveHeadingId,
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

	it("keeps essay h3 nested under h2", () => {
		const base = tocBaseLevel("H3");
		assert.equal(tocLinkClass("H2", base, 0), "");
		assert.equal(tocLinkClass("H3", base, 0), "toc-h3");
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
