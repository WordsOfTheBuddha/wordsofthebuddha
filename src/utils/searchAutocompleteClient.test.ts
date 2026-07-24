import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDropdownLeft } from "./searchAutocompleteClient";

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
