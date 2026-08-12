import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildPtsSearchText,
	formatPtsDisplay,
	getPtsDisplay,
	hasPtsDirective,
	lookupPtsSlugs,
	parsePtsQuery,
	parsePtsVolpage,
} from "./ptsReferences";

describe("formatPtsDisplay", () => {
	it("strips PTS and edition markers", () => {
		assert.equal(formatPtsDisplay("PTS AN iii 174"), "AN iii 174");
		assert.equal(
			formatPtsDisplay("PTS (1st ed) SN i 1"),
			"SN i 1",
		);
		assert.equal(formatPtsDisplay("PTS Iti 27"), "Iti 27");
	});
});

describe("getPtsDisplay", () => {
	it("uses SC-style numeric PTS citations with ranges", () => {
		assert.equal(getPtsDisplay("an8.2"), "PTS 4.151–4.154");
		assert.equal(getPtsDisplay("an8.3"), "PTS 4.155");
		assert.equal(getPtsDisplay("mn1"), "PTS 1.1–1.5");
		assert.match(getPtsDisplay("sn47.21"), /^PTS 5\.\d+/);
	});

	it("resolves AN1 range slugs from first/last constituents", () => {
		assert.equal(getPtsDisplay("an1.1-10"), "PTS 1.1–1.2");
		assert.equal(getPtsDisplay("an1.11-20"), "PTS 1.3–1.4");
		assert.match(getPtsDisplay("an1.1-10"), /^PTS \d/);
		assert.match(getPtsDisplay("an1.11-20"), /^PTS \d/);
		assert.ok(getPtsDisplay("an1.1-10").length > 0);
		assert.ok(getPtsDisplay("an1.11-20").length > 0);
	});
});

describe("parsePtsVolpage", () => {
	it("parses volume nikayas", () => {
		assert.deepEqual(parsePtsVolpage("PTS AN iii 174"), {
			nikaya: "an",
			volume: 3,
			page: 174,
		});
		assert.deepEqual(parsePtsVolpage("PTS SN v 171"), {
			nikaya: "sn",
			volume: 5,
			page: 171,
		});
	});

	it("parses single-volume collections", () => {
		assert.deepEqual(parsePtsVolpage("PTS Iti 27"), {
			nikaya: "iti",
			page: 27,
		});
	});

	it("parses three-part numeric volpages when SC stores them", () => {
		assert.deepEqual(parsePtsVolpage("PTS 1.1.1"), {
			volume: 1,
			page: 1,
			para: 1,
		});
	});
});

describe("parsePtsQuery", () => {
	it("requires a directive", () => {
		assert.equal(hasPtsDirective("AN V. 91"), false);
		assert.equal(parsePtsQuery("AN V. 91"), null);
		assert.equal(parsePtsQuery("Iti 27"), null);
		assert.equal(parsePtsQuery("craving"), null);
		assert.equal(parsePtsQuery("an8.38"), null);
		assert.equal(parsePtsQuery("1.1"), null);
	});

	it("parses directed researcher forms", () => {
		assert.deepEqual(parsePtsQuery("pts:AN V. 91"), {
			nikaya: "an",
			volume: 5,
			page: 91,
		});
		assert.deepEqual(parsePtsQuery("volpage:SN ii 4"), {
			nikaya: "sn",
			volume: 2,
			page: 4,
		});
		assert.deepEqual(parsePtsQuery("PTS AN v 91"), {
			nikaya: "an",
			volume: 5,
			page: 91,
		});
		assert.deepEqual(parsePtsQuery("PTS 5.172"), {
			volume: 5,
			page: 172,
		});
		assert.deepEqual(parsePtsQuery("pts:4.152–4.155"), {
			volume: 4,
			page: 152,
		});
		assert.deepEqual(parsePtsQuery("pts-vp-pli5.172"), {
			volume: 5,
			page: 172,
		});
		assert.deepEqual(parsePtsQuery("pts:Iti 27"), {
			nikaya: "iti",
			page: 27,
		});
		assert.deepEqual(parsePtsQuery("pts:MN 2"), {
			nikaya: "mn",
			volume: 2,
		});
		assert.deepEqual(parsePtsQuery("PTS: MN 2"), {
			nikaya: "mn",
			volume: 2,
		});
		assert.deepEqual(parsePtsQuery("pts:MN ii"), {
			nikaya: "mn",
			volume: 2,
		});
	});
});

describe("lookupPtsSlugs", () => {
	it("finds exact start-page matches", () => {
		const slugs = lookupPtsSlugs({
			nikaya: "an",
			volume: 3,
			page: 174,
		});
		assert.ok(slugs.includes("an5.151"), `expected an5.151 in ${slugs}`);
	});

	it("covers mid-page citations (AN V. 91 → sutta starting at v 88)", () => {
		const slugs = lookupPtsSlugs({
			nikaya: "an",
			volume: 5,
			page: 91,
		});
		assert.ok(
			slugs.includes("an10.50") || slugs.includes("an10.49"),
			`expected an10.49/50 covering page 91, got ${slugs}`,
		);
		assert.ok(!slugs.includes("an10.51"), "an10.51 starts at 92");
	});

	it("resolves SN PTS 5.171/172 neighborhood", () => {
		const slugs = lookupPtsSlugs({
			nikaya: "sn",
			volume: 5,
			page: 171,
		});
		assert.ok(
			slugs.includes("sn47.21"),
			`expected sn47.21 in ${slugs}`,
		);
	});

	it("lists all discourses in a PTS volume when no page is given", () => {
		const slugs = lookupPtsSlugs({ nikaya: "mn", volume: 2 });
		assert.ok(slugs.includes("mn77"), `expected mn77 in ${slugs.slice(0, 5)}`);
		assert.ok(slugs.length > 10, `expected a volume listing, got ${slugs.length}`);
		assert.ok(!slugs.includes("mn1"), "mn1 is PTS volume 1");
	});

	it("returns volume listings in canonical discourse-ID order", () => {
		const slugs = lookupPtsSlugs({ nikaya: "mn", volume: 1 });
		assert.ok(slugs.includes("mn1") && slugs.includes("mn2") && slugs.includes("mn10"));
		assert.ok(
			slugs.indexOf("mn1") < slugs.indexOf("mn2"),
			`mn1 should precede mn2, got ${slugs.slice(0, 12).join(", ")}`,
		);
		assert.ok(
			slugs.indexOf("mn2") < slugs.indexOf("mn10"),
			`mn2 should precede mn10 (numeric, not lexicographic), got ${slugs.slice(0, 12).join(", ")}`,
		);
		for (let i = 1; i < slugs.length; i++) {
			assert.ok(
				slugs[i - 1] !== slugs[i],
				`duplicate slug ${slugs[i]}`,
			);
		}
	});
});

describe("buildPtsSearchText", () => {
	it("includes aliases", () => {
		const text = buildPtsSearchText({ volpage: "PTS AN iii 174" });
		assert.match(text, /AN iii 174/);
		assert.match(text, /AN 3\.174/);
		assert.match(text, /PTS 3\.174/);
	});
});
