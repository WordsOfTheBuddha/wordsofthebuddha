import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { directoryStructure } from "../data/directoryStructure";
import { routes } from "./routes";
import {
	collectionSearch,
	discourseAlsoKnown,
	discourseDocumentTitle,
	discourseMetaDescription,
	discourseSearch,
	foldSearchText,
	oftenRead,
	organicSearchRedirects,
	topicSearch,
} from "./organicSearch";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);

function reservedSlugs(): Set<string> {
	const reserved = new Set<string>(routes);
	const walk = (map: Record<string, { children?: Record<string, unknown> }>) => {
		for (const [key, node] of Object.entries(map)) {
			reserved.add(key);
			const children = node?.children;
			if (children && typeof children === "object") {
				walk(children as Record<string, { children?: Record<string, unknown> }>);
			}
		}
	};
	walk(directoryStructure as Record<string, { children?: Record<string, unknown> }>);

	for (const name of readdirSync(path.join(repoRoot, "src/pages"))) {
		if (name.startsWith("[")) continue;
		reserved.add(name.replace(/\.astro$/, ""));
	}
	for (const name of readdirSync(path.join(repoRoot, "src/pages/posts"))) {
		reserved.add(name.replace(/\.(md|mdx)$/, ""));
	}
	return reserved;
}

describe("organic search titles", () => {
	it("puts the wording people type at the front of famous discourses", () => {
		assert.equal(
			discourseDocumentTitle("an3.65"),
			"AN 3.65 Kālāma Sutta — Advice to the Kālāmas",
		);
		assert.equal(
			discourseDocumentTitle("sn45.8"),
			"SN 45.8 Noble Eightfold Path — Vibhaṅga Sutta",
		);
		assert.match(
			discourseDocumentTitle("mn10") ?? "",
			/Establishments of Mindfulness/,
		);
		assert.equal(discourseDocumentTitle("mn1"), null);
	});

	it("keeps document titles short enough to show in a search result", () => {
		for (const [id, entry] of Object.entries(discourseSearch)) {
			assert.ok(
				entry.title.length <= 70,
				`${id} title is ${entry.title.length} characters: ${entry.title}`,
			);
		}
		for (const [slug, entry] of Object.entries(collectionSearch)) {
			assert.ok(entry.title.length <= 70, `${slug}: ${entry.title}`);
			assert.ok(entry.description.length <= 200, slug);
		}
		for (const [slug, entry] of Object.entries(topicSearch)) {
			assert.ok(entry.title.length <= 80, `${slug}: ${entry.title}`);
		}
	});

	it("adds the common name to the meta description only when the page omits it", () => {
		const kalama =
			"When the Kālāmas, perplexed by conflicting teachers, ask the Buddha how to know truth from falsehood.";
		assert.match(
			discourseMetaDescription("an3.65", kalama) ?? "",
			/^The Kālāma Sutta\./,
		);
		const eightfold =
			"The Buddha explains in detail each factor of the noble eightfold path.";
		assert.equal(discourseMetaDescription("sn45.8", eightfold), eightfold);
	});

	it("shows an also-known line only when the search phrase is missing on the page", () => {
		assert.equal(
			discourseAlsoKnown(
				"an3.65",
				"Kesamutti sutta - With the Kālāmas of Kesamutta",
				"When the Kālāmas ask how to know truth from falsehood.",
			),
			"Also known as the Kālāma Sutta.",
		);
		assert.equal(
			discourseAlsoKnown(
				"mn10",
				"Satipaṭṭhāna sutta - Establishments of Mindfulness",
				"",
			),
			null,
		);
		assert.equal(foldSearchText("Kālāma"), "kalama");
	});
});

describe("organic search redirects", () => {
	it("sends each common name to one real page and no existing route", () => {
		const reserved = reservedSlugs();
		const seen = new Set<string>();
		for (const [from, to] of Object.entries(organicSearchRedirects)) {
			assert.ok(from.startsWith("/"), from);
			assert.equal(seen.has(from), false, from);
			seen.add(from);
			const slug = from.slice(1);
			assert.equal(reserved.has(slug), false, `${from} collides with an existing route`);
			if (to.startsWith("/on/")) {
				assert.ok(topicSearch[to.slice(4)], to);
			} else {
				const id = to.slice(1);
				assert.ok(
					discourseSearch[id] || collectionSearch[id],
					`${to} is not a known discourse or collection`,
				);
				if (discourseSearch[id]) assert.ok(routes.includes(id), id);
			}
		}
		assert.equal(organicSearchRedirects["/metta-sutta"], "/snp1.8");
		assert.equal(organicSearchRedirects["/four-noble-truths"], "/sn56.11");
		assert.equal(
			organicSearchRedirects["/dependent-origination"],
			"/on/dependent-co-arising",
		);
		assert.equal(organicSearchRedirects["/five-aggregates"], "/sn22");
	});

	it("links the homepage to the same primary URLs", () => {
		const hrefs = oftenRead.map((entry) => entry.href);
		assert.deepEqual(new Set(hrefs).size, hrefs.length);
		assert.ok(hrefs.includes("/mn10"));
		assert.ok(hrefs.includes("/sn56.11"));
		assert.ok(hrefs.includes("/dhp"));
	});
});
