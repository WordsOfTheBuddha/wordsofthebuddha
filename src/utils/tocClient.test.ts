import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DISCOURSE_TOC_MIN_HEADINGS,
	headingLabel,
	isNamedSectionHeading,
	namedSectionHeadingsFromMarkdown,
	pickActiveHeadingId,
	shouldShowDiscourseToc,
	slugifyHeading,
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

	it("hides a ToC when there are fewer than three named sections", () => {
		const markdown = `
### Setting
text
### Preservation of Truth
text
`;
		assert.equal(shouldShowDiscourseToc(markdown), false);
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

	it("uses the first heading before any title has reached the line", () => {
		assert.equal(pickActiveHeadingId(headings, 0), "one");
	});

	it("returns null when there are no headings", () => {
		assert.equal(pickActiveHeadingId([], 100), null);
	});
});
