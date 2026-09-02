import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	parsePedCitation,
	resolvePedCitation,
} from "./pedCitationLinks";

describe("parsePedCitation", () => {
	it("parses four-nikaya dotted citations without a pts: directive", () => {
		assert.deepEqual(parsePedCitation("DN.ii.224"), {
			kind: "pts",
			nikaya: "dn",
			volume: 2,
			page: 224,
		});
		assert.deepEqual(parsePedCitation("AN.v.110"), {
			kind: "pts",
			nikaya: "an",
			volume: 5,
			page: 110,
		});
		assert.deepEqual(parsePedCitation("MN i 205"), {
			kind: "pts",
			nikaya: "mn",
			volume: 1,
			page: 205,
		});
	});

	it("rejects Vinaya / Jātaka / Milinda and unmapped verse wording", () => {
		assert.equal(parsePedCitation("Vin.i.206"), null);
		assert.equal(parsePedCitation("Ja.i.9"), null);
		assert.equal(parsePedCitation("Mil.354"), null);
		assert.equal(parsePedCitation("Thig verse 314"), null);
	});

	it("treats Dhp.N as a verse citation", () => {
		assert.deepEqual(parsePedCitation("Dhp.117"), {
			kind: "dhp-verse",
			verse: 117,
		});
	});

	it("parses Snp verse citations", () => {
		assert.deepEqual(parsePedCitation("Snp verse 609"), {
			kind: "snp-verse",
			verse: 609,
		});
		assert.deepEqual(parsePedCitation("Sn verse 264"), {
			kind: "snp-verse",
			verse: 264,
		});
		assert.deepEqual(parsePedCitation("Snp v. 655"), {
			kind: "snp-verse",
			verse: 655,
		});
	});
});

describe("resolvePedCitation", () => {
	it("links DN/MN pages to native slugs", () => {
		const dn = resolvePedCitation("DN.ii.224");
		assert.ok(dn);
		assert.equal(dn!.href, "/dn19");
		assert.deepEqual(dn!.slugs, ["dn19"]);

		const mn = resolvePedCitation("MN.i.205");
		assert.ok(mn);
		assert.equal(mn!.href, "/mn31");
	});

	it("maps Dhp and Snp verses to hosted slugs", () => {
		const dhp = resolvePedCitation("Dhp.117");
		assert.ok(dhp);
		assert.equal(dhp!.href, "/dhp116-128");

		const metta = resolvePedCitation("Snp verse 145");
		assert.ok(metta);
		assert.equal(metta!.href, "/snp1.8");

		const mid = resolvePedCitation("Snp verse 590");
		assert.ok(mid);
		assert.equal(mid!.href, "/snp3.8");

		const late = resolvePedCitation("Sn verse 1040");
		assert.ok(late);
		assert.equal(late!.href, "/snp5.2");
	});

	it("leaves Snp verses for unhosted suttas unlinked", () => {
		// snp3.9 (600–662) is not on the site yet
		assert.equal(resolvePedCitation("Snp verse 609"), null);
	});

	it("leaves unsupported collections unlinked", () => {
		assert.equal(resolvePedCitation("Vin.i.206"), null);
		assert.equal(resolvePedCitation("Thig.314"), null);
	});
});
