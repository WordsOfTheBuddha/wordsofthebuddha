import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	lookupPedFromLemmas,
	lookupPedHeadword,
	stripLemmaSenseNumber,
} from "./pedLookup";

describe("stripLemmaSenseNumber", () => {
	it("strips DPD sense suffixes", () => {
		assert.equal(stripLemmaSenseNumber("sakka 1"), "sakka");
		assert.equal(stripLemmaSenseNumber("vutta 1.1"), "vutta");
		assert.equal(stripLemmaSenseNumber("sakkāya"), "sakkāya");
	});
});

describe("lookupPedHeadword", () => {
	it("finds common PED headwords via DPD-style lemmas", async () => {
		const dukkha = await lookupPedHeadword("dukkha 1");
		assert.ok(dukkha);
		assert.equal(dukkha!.word, "dukkha");
		assert.match(dukkha!.html, /dukkha/i);

		const attamana = await lookupPedFromLemmas(["attamanā", "attamana"]);
		assert.ok(attamana);
		assert.equal(attamana!.word, "attamana");
	});

	it("maps niggahīta construction parts to PED headwords (atthaṁ → attha)", async () => {
		const hit = await lookupPedHeadword("atthaṁ");
		assert.ok(hit);
		assert.equal(hit!.word, "attha");
	});

	it("returns null for missing headwords", async () => {
		assert.equal(await lookupPedHeadword("anicca"), null);
	});
});
