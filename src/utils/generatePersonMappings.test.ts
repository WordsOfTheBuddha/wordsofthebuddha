import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatReferenceDiscourseTitle,
	paliTitleToSuttaHeading,
} from "./generatePersonMappings";

describe("paliTitleToSuttaHeading", () => {
	it("inserts a space before a fused sutta suffix", () => {
		assert.equal(paliTitleToSuttaHeading("Vacchagottasutta"), "Vacchagotta sutta");
		assert.equal(paliTitleToSuttaHeading("Upatissasutta"), "Upatissa sutta");
	});

	it("keeps the Pali half of an already-combined title", () => {
		assert.equal(
			paliTitleToSuttaHeading("Saṅgārava sutta - With Saṅgārava"),
			"Saṅgārava sutta",
		);
	});
});

describe("formatReferenceDiscourseTitle", () => {
	it("pairs the Pali heading with the Sujato title", () => {
		assert.equal(
			formatReferenceDiscourseTitle("Vacchagottasutta", "With Vacchagotta"),
			"Vacchagotta sutta - With Vacchagotta",
		);
	});
});
