import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	computeDropdownLeft,
	discourseSuggestionActiveIndex,
	displaySuggestionText,
	shouldOfferIndexSuggestions,
} from "./searchAutocompleteClient";

describe("computeDropdownLeft", () => {
	const padding = 48;

	it("places dropdown at token offset when text is not scrolled", () => {
		assert.equal(computeDropdownLeft(padding, 320, 0), 368);
	});

	it("subtracts horizontal scroll so dropdown tracks the visible token", () => {
		assert.equal(computeDropdownLeft(padding, 320, 280), 88);
	});

	it("does not place dropdown left of the input padding", () => {
		assert.equal(computeDropdownLeft(padding, 400, 500), padding);
	});
});

describe("shouldOfferIndexSuggestions", () => {
	it("suppresses suggestions during PTS citation queries", () => {
		assert.equal(shouldOfferIndexSuggestions("pts: an 1.", "1."), false);
		assert.equal(shouldOfferIndexSuggestions("PTS AN v 91", "91"), false);
		assert.equal(shouldOfferIndexSuggestions("volpage:SN ii 4", "4"), false);
	});

	it("requires both characters to be letters for 2-char tokens", () => {
		assert.equal(shouldOfferIndexSuggestions("an", "an"), true);
		assert.equal(shouldOfferIndexSuggestions("1.", "1."), false);
		assert.equal(shouldOfferIndexSuggestions("a1", "a1"), false);
	});

	it("allows any 3-char token", () => {
		assert.equal(shouldOfferIndexSuggestions("sat", "sat"), true);
		assert.equal(shouldOfferIndexSuggestions("1.1", "1.1"), true);
	});

	it("still suggests for Pali/English tokens", () => {
		assert.equal(shouldOfferIndexSuggestions("craving", "craving"), true);
		assert.equal(shouldOfferIndexSuggestions("sati", "sati"), true);
	});
});

describe("discourseSuggestionActiveIndex", () => {
	it("preselects the first hit for ID-shaped queries", () => {
		assert.equal(discourseSuggestionActiveIndex(true, 1), 0);
		assert.equal(discourseSuggestionActiveIndex(true, 4), 0);
	});

	it("does not preselect title or empty lists", () => {
		assert.equal(discourseSuggestionActiveIndex(false, 3), -1);
		assert.equal(discourseSuggestionActiveIndex(true, 0), -1);
	});
});

describe("displaySuggestionText", () => {
	it("keeps the visible term and drops the gloss", () => {
		assert.equal(
			displaySuggestionText("|right view::view that is in line with the Dhamma|"),
			"right view",
		);
	});

	it("strips leftover pipes and secondary meanings after ::", () => {
		assert.equal(
			displaySuggestionText(
				"nijjara|. What ten? 1.) For one with |right view::view that is in line with the Dhamma",
			),
			"nijjara. What ten? 1.) For one with right view",
		);
	});

	it("drops pronunciation after ::::", () => {
		assert.equal(displaySuggestionText("|jhānas::::jah-naas|"), "jhānas");
	});
});
