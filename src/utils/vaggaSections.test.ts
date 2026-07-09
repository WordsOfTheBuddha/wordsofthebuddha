import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { directoryStructure } from "../data/directoryStructure";
import {
	formatVaggaDisplayTitle,
	getEffectiveVaggaSections,
	getMnVaggaRedirects,
	groupDiscoursesByChildBooksAndVagga,
	groupDiscoursesByVaggaSection,
	usesBookScopedVaggaGrouping,
} from "./vaggaSections";

describe("vaggaSections", () => {
	it("splits concatenated Pali before trailing vagga in display titles", () => {
		assert.equal(formatVaggaDisplayTitle("Chetvāvagga"), "Chetvā vagga");
		assert.equal(
			formatVaggaDisplayTitle("Cittapariyādānavagga"),
			"Cittapariyādāna vagga",
		);
		assert.equal(
			formatVaggaDisplayTitle(
				"Chetvāvagga - The Chapter on Cutting Off",
			),
			"Chetvā vagga - The Chapter on Cutting Off",
		);
		assert.equal(
			formatVaggaDisplayTitle(
				"Cittapariyādāna vagga - The Chapter on Mental Enslavement",
			),
			"Cittapariyādāna vagga - The Chapter on Mental Enslavement",
		);
		assert.equal(
			formatVaggaDisplayTitle("Naḷavagga - The Chapter on a Reed"),
			"Naḷa vagga - The Chapter on a Reed",
		);
	});

	it("returns vagga sections for MN paṇṇāsa leaf collections", () => {
		const sections = getEffectiveVaggaSections("mn1-50");
		assert.ok(sections?.["mn1-10"]);
		assert.ok(sections?.["mn41-50"]);
		assert.equal(Object.keys(sections ?? {}).length, 5);
	});

	it("aggregates vagga sections for top-level MN", () => {
		const sections = getEffectiveVaggaSections("mn");
		assert.ok(sections?.["mn1-10"]);
		assert.ok(sections?.["mn91-100"]);
		assert.ok(sections?.["mn143-152"]);
		assert.equal(Object.keys(sections ?? {}).length, 15);
		assert.equal(usesBookScopedVaggaGrouping(sections), false);
	});

	it("detects book-scoped vagga sections for top-level AN", () => {
		const sections = getEffectiveVaggaSections("an");
		assert.ok(sections?.["an3.1-10"]);
		assert.ok(sections?.["an4.1-10"]);
		assert.equal(usesBookScopedVaggaGrouping(sections), true);
	});

	it("detects book-scoped vagga sections for SN range parents", () => {
		const children = directoryStructure.sn.children?.["sn1-11"]?.children;
		assert.ok(children?.sn1?.vaggaSections?.["sn1-nalavagga"]);
		assert.equal(
			usesBookScopedVaggaGrouping(undefined, children),
			true,
		);
	});

	it("groups top-level AN discourses by book then vagga", () => {
		const children = directoryStructure.an.children!;
		const grouped = groupDiscoursesByChildBooksAndVagga(
			[
				{ slug: "an1.1-10", title: "AN 1.1-10" },
				{ slug: "an2.5", title: "AN 2.5" },
				{ slug: "an3.2", title: "AN 3.2" },
				{ slug: "an4.1", title: "AN 4.1" },
				{ slug: "an4.12", title: "AN 4.12" },
			],
			children,
		);
		assert.deepEqual(
			grouped
				.filter((book) =>
					book.sections.some((section) => section.posts.length > 0),
				)
				.map((book) => book.bookSlug),
			["an1", "an2", "an3", "an4"],
		);
		const an1Flat = grouped.find((book) => book.bookSlug === "an1");
		assert.equal(an1Flat?.sections.length, 1);
		assert.equal(an1Flat?.sections[0]?.slug, "");
		assert.deepEqual(
			an1Flat?.sections[0]?.posts.map((post) => post.slug),
			["an1.1-10"],
		);
		const an3FirstVagga = grouped
			.find((book) => book.bookSlug === "an3")
			?.sections.find((section) => section.slug === "an3.1-10");
		const an4FirstVagga = grouped
			.find((book) => book.bookSlug === "an4")
			?.sections.find((section) => section.slug === "an4.1-10");
		assert.deepEqual(
			an3FirstVagga?.posts.map((post) => post.slug),
			["an3.2"],
		);
		assert.deepEqual(
			an4FirstVagga?.posts.map((post) => post.slug),
			["an4.1"],
		);
	});

	it("returns AN book vagga sections unchanged", () => {
		const sections = getEffectiveVaggaSections("an4");
		assert.ok(sections?.["an4.1-10"]);
	});

	it("groups discourses into vagga buckets in sort order", () => {
		const sections = getEffectiveVaggaSections("an4");
		const grouped = groupDiscoursesByVaggaSection(
			[
				{ slug: "an4.12", title: "12" },
				{ slug: "an4.2", title: "2" },
				{ slug: "an4.11", title: "11" },
			],
			sections,
		);
		const firstSection = grouped.find((s) => s.slug === "an4.1-10");
		const secondSection = grouped.find((s) => s.slug === "an4.11-20");
		assert.deepEqual(
			firstSection?.posts.map((p) => p.slug),
			["an4.2"],
		);
		assert.deepEqual(
			secondSection?.posts.map((p) => p.slug),
			["an4.11", "an4.12"],
		);
	});

	it("keeps empty vagga sections for ref-only chapters", () => {
		const sections = getEffectiveVaggaSections("an4");
		const grouped = groupDiscoursesByVaggaSection(
			[{ slug: "an4.2", title: "2" }],
			sections,
		);
		const refOnlySection = grouped.find((s) => s.slug === "an4.81-90");
		assert.ok(refOnlySection);
		assert.deepEqual(refOnlySection?.posts, []);
		assert.equal(grouped.length, Object.keys(sections ?? {}).length);
	});

	it("builds MN vagga redirect targets to parent paṇṇāsa anchors", () => {
		const redirects = getMnVaggaRedirects();
		assert.equal(redirects["/mn1-10"], "/mn1-50#mn1-10");
		assert.equal(redirects["/mn91-100"], "/mn51-100#mn91-100");
	});

	it("returns SN saṁyutta vagga sections", () => {
		const sections = getEffectiveVaggaSections("sn1");
		assert.ok(sections?.["sn1-nalavagga"]);
		assert.ok(sections?.["sn1-chetvavagga"]);
		assert.equal(Object.keys(sections ?? {}).length, 8);
	});

	it("groups SN discourses into vagga buckets by SC UID", () => {
		const sections = getEffectiveVaggaSections("sn1");
		const grouped = groupDiscoursesByVaggaSection(
			[
				{ slug: "sn1.12", title: "12" },
				{ slug: "sn1.2", title: "2" },
				{ slug: "sn1.75", title: "75" },
			],
			sections,
		);
		const nala = grouped.find((s) => s.slug === "sn1-nalavagga");
		const nandana = grouped.find((s) => s.slug === "sn1-nandanavagga");
		const chetva = grouped.find((s) => s.slug === "sn1-chetvavagga");
		assert.deepEqual(nala?.posts.map((p) => p.slug), ["sn1.2"]);
		assert.deepEqual(nandana?.posts.map((p) => p.slug), ["sn1.12"]);
		assert.deepEqual(chetva?.posts.map((p) => p.slug), ["sn1.75"]);
	});

	it("keeps empty SN vagga sections for ref-only chapters", () => {
		const sections = getEffectiveVaggaSections("sn4");
		const grouped = groupDiscoursesByVaggaSection(
			[{ slug: "sn4.2", title: "2" }],
			sections,
		);
		const refOnlySection = grouped.find((s) => s.slug === "sn4-tatiyavagga");
		assert.ok(refOnlySection);
		assert.deepEqual(refOnlySection?.posts, []);
		assert.equal(grouped.length, Object.keys(sections ?? {}).length);
	});
});
