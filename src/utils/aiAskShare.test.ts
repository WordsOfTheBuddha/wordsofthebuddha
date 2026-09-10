import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ASK_SHARE_SLUG_MAX,
	askShareIsSameSnapshot,
	askSharePath,
	askShareSeo,
	askShareSlugCandidate,
	askShareSlugCollisionCandidates,
	askShareSlugWithNumericSuffix,
	askShareTurnsForRestore,
	formatAskShareSlugUtcDate,
	formatAskShareSlugUtcHour,
	deriveAskShareSlug,
	normalizeAskShareSlug,
	resolveAskShareSlug,
	sanitizeAskShareSnapshot,
	uniquifyAskShareSlug,
	type AskShareIdentityInput,
} from "./aiAskShare";

const SEP_10_2026_14H = Date.UTC(2026, 8, 10, 14, 0, 0);

function shareHit(slug: string) {
	return {
		slug,
		title: slug,
		description: "",
		contentSnippet: null,
		referenceOnly: false,
		href: `/${slug}`,
	};
}

function shareIdent(
	question: string,
	resultSlugs: string[],
	summary = "These discourses treat the question.",
): AskShareIdentityInput {
	return {
		question,
		summary,
		results: resultSlugs.map((slug) => shareHit(slug)),
	};
}

describe("normalizeAskShareSlug", () => {
	it("accepts readable kebab slugs", () => {
		assert.equal(
			normalizeAskShareSlug("Mindfulness of the Body"),
			"mindfulness-of-the-body",
		);
		assert.equal(normalizeAskShareSlug("not-self"), "not-self");
		assert.equal(
			normalizeAskShareSlug("four-foundations-of-mindfulness"),
			"four-foundations-of-mindfulness",
		);
	});

	it("rejects ambiguous or oversized junk", () => {
		assert.equal(normalizeAskShareSlug("ab"), null);
		assert.equal(normalizeAskShareSlug("---"), null);
		assert.equal(
			normalizeAskShareSlug("x".repeat(80))?.length,
			48,
		);
	});

	it("keeps readable numeric disambiguators", () => {
		assert.equal(
			normalizeAskShareSlug("mindfulness-of-the-body-2"),
			"mindfulness-of-the-body-2",
		);
		assert.equal(
			normalizeAskShareSlug("mindfulness-of-the-body-10"),
			"mindfulness-of-the-body-10",
		);
	});
});

describe("deriveAskShareSlug", () => {
	it("prefers lookingFor, then topical words from the question", () => {
		assert.equal(
			deriveAskShareSlug("mindfulness of the body", "what about sati?"),
			"mindfulness-of-the-body",
		);
		assert.equal(
			deriveAskShareSlug("", "What did the Buddha teach about not-self?"),
			"buddha-teach-not-self",
		);
	});
});

describe("resolveAskShareSlug", () => {
	it("uses a valid preferred slug from the model", () => {
		assert.equal(
			resolveAskShareSlug(
				"dependent-arising-and-suffering",
				"craving",
				"how does craving lead to suffering?",
			),
			"dependent-arising-and-suffering",
		);
	});

	it("collapses two questions on the same theme to the same preferred slug", () => {
		const theme = "mindfulness-of-the-body";
		assert.equal(
			resolveAskShareSlug(
				theme,
				"mindfulness of the body",
				"How do I practice mindfulness of the body?",
			),
			theme,
		);
		assert.equal(
			resolveAskShareSlug(
				theme,
				"kāyagatāsati",
				"What is kayagata-sati?",
			),
			theme,
		);
	});
});

describe("formatAskShareSlugUtcDate", () => {
	it("uses a lowercase UTC month-day-year", () => {
		assert.equal(formatAskShareSlugUtcDate(SEP_10_2026_14H), "sep-10-2026");
		assert.equal(formatAskShareSlugUtcHour(SEP_10_2026_14H), "sep-10-2026-14h");
	});
});

describe("askShareSlugCollisionCandidates", () => {
	it("tries the clean slug, then the date, then the hour", () => {
		assert.deepEqual(
			askShareSlugCollisionCandidates(
				"mindfulness-of-the-body",
				SEP_10_2026_14H,
			),
			[
				"mindfulness-of-the-body",
				"mindfulness-of-the-body-sep-10-2026",
				"mindfulness-of-the-body-sep-10-2026-14h",
			],
		);
	});
});

describe("askShareSlugWithNumericSuffix", () => {
	it("appends -2, -3 without changing the theme stem", () => {
		assert.equal(
			askShareSlugCandidate("mindfulness-of-the-body", 1),
			"mindfulness-of-the-body",
		);
		assert.equal(
			askShareSlugWithNumericSuffix("mindfulness-of-the-body", 2),
			"mindfulness-of-the-body-2",
		);
		assert.equal(
			askShareSlugCandidate("mindfulness-of-the-body", 3),
			"mindfulness-of-the-body-3",
		);
	});

	it("keeps suffixed slugs within the public max length", () => {
		const base = "a".repeat(ASK_SHARE_SLUG_MAX);
		const suffixed = askShareSlugWithNumericSuffix(base, 2);
		assert.ok(suffixed.length <= ASK_SHARE_SLUG_MAX);
		assert.equal(normalizeAskShareSlug(suffixed), suffixed);
		assert.match(suffixed, /-2$/);
	});
});

describe("askShareIsSameSnapshot", () => {
	it("treats the same question, summary, and result slugs as one Ask", () => {
		const a = shareIdent("What is mindfulness of the body?", [
			"mn119",
			"mn10",
		]);
		assert.equal(askShareIsSameSnapshot(a, { ...a }), true);
	});

	it("treats a different research report as a different snapshot", () => {
		const question = "Who is a trainee?";
		const results = [{ slug: "mn70" }];
		assert.equal(
			askShareIsSameSnapshot(
				{
					question,
					summary: "Brief",
					results,
					report: "## First draft",
				},
				{
					question,
					summary: "Brief",
					results,
					report: "## Revised draft",
				},
			),
			false,
		);
	});

	it("treats a different result set as a different Ask", () => {
		const question = "What is mindfulness of the body?";
		assert.equal(
			askShareIsSameSnapshot(
				shareIdent(question, ["mn119", "mn10", "sn47.9"]),
				shareIdent(question, ["mn119"]),
			),
			false,
		);
	});
});

describe("uniquifyAskShareSlug", () => {
	it("reuses the slug when the same snapshot is shared again", async () => {
		const theme = "mindfulness-of-the-body";
		const snap = shareIdent("What is mindfulness of the body?", [
			"mn119",
			"mn10",
		]);
		const occupied = new Map<string, AskShareIdentityInput>([
			[theme, snap],
		]);
		const again = await uniquifyAskShareSlug(
			theme,
			snap,
			(slug) => occupied.get(slug) ?? null,
		);
		assert.equal(again.slug, theme);
		assert.equal(again.existing, snap);
	});

	it("appends a UTC date when two different questions share a theme slug", async () => {
		const theme = "mindfulness-of-the-body";
		const first = shareIdent(
			"How do I practice mindfulness of the body?",
			["mn119", "mn10", "sn47.9"],
		);
		const second = shareIdent("What is kayagata-sati?", ["mn119", "mn10"]);
		const occupied = new Map<string, AskShareIdentityInput>();
		const lookup = (slug: string) => occupied.get(slug) ?? null;
		const now = { now: SEP_10_2026_14H };

		const publishedFirst = await uniquifyAskShareSlug(
			theme,
			first,
			lookup,
			"",
			now,
		);
		occupied.set(publishedFirst.slug, first);
		const publishedSecond = await uniquifyAskShareSlug(
			theme,
			second,
			lookup,
			"",
			now,
		);
		occupied.set(publishedSecond.slug, second);

		assert.equal(publishedFirst.slug, theme);
		assert.equal(publishedSecond.slug, `${theme}-sep-10-2026`);
		assert.notEqual(first.results.length, second.results.length);
		assert.equal(occupied.get(theme)?.results.length, 3);
		assert.equal(occupied.get(`${theme}-sep-10-2026`)?.results.length, 2);
	});

	it("does not reuse a slug when the question matches but result counts differ", async () => {
		const theme = "mindfulness-of-the-body";
		const question = "What is mindfulness of the body?";
		const earlier = shareIdent(question, ["mn119", "mn10", "sn47.9"]);
		const later = shareIdent(question, ["mn119", "mn10"]);
		const occupied = new Map<string, AskShareIdentityInput>([
			[theme, earlier],
		]);
		const published = await uniquifyAskShareSlug(
			theme,
			later,
			(slug) => occupied.get(slug) ?? null,
			"",
			{ now: SEP_10_2026_14H },
		);
		assert.equal(published.slug, `${theme}-sep-10-2026`);
		assert.equal(published.existing, null);
		assert.equal(earlier.results.length, 3);
		assert.equal(later.results.length, 2);
	});

	it("uses the hour, then -2, when the date suffix is already taken", async () => {
		const theme = "mindfulness-of-the-body";
		const occupied = new Map<string, AskShareIdentityInput>([
			[theme, shareIdent("First?", ["mn10"])],
			[`${theme}-sep-10-2026`, shareIdent("Second?", ["mn10", "sn47.1"])],
		]);
		const third = await uniquifyAskShareSlug(
			theme,
			shareIdent("Third?", ["mn10", "mn119", "sn47.19"]),
			(slug) => occupied.get(slug) ?? null,
			"",
			{ now: SEP_10_2026_14H },
		);
		assert.equal(third.slug, `${theme}-sep-10-2026-14h`);

		occupied.set(third.slug, shareIdent("Third?", ["mn10", "mn119", "sn47.19"]));
		const fourth = await uniquifyAskShareSlug(
			theme,
			shareIdent("Fourth?", ["mn10", "mn119"]),
			(slug) => occupied.get(slug) ?? null,
			"",
			{ now: SEP_10_2026_14H },
		);
		assert.equal(fourth.slug, `${theme}-2`);
	});
});

describe("sanitizeAskShareSnapshot", () => {
	it("keeps a public snapshot with results", () => {
		const snap = sanitizeAskShareSnapshot({
			slug: "mindfulness-of-the-body",
			question: "What is mindfulness of the body?",
			lookingFor: "mindfulness of the body",
			queries: ["kāyagatāsati"],
			results: [
				{
					slug: "mn119",
					title: "Mindfulness of the Body",
					description: "…",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn119",
				},
			],
			summary: "These discourses…",
			model: "google/gemma-4-31b-it:free",
			createdAt: 1,
		});
		assert.ok(snap);
		assert.equal(snap?.slug, "mindfulness-of-the-body");
		assert.equal(askSharePath(snap!.slug), "/ask/mindfulness-of-the-body");
	});

	it("accepts a date collision suffix on the public slug", () => {
		const snap = sanitizeAskShareSnapshot({
			slug: "mindfulness-of-the-body-sep-10-2026",
			question: "What is kayagata-sati?",
			lookingFor: "kāyagatāsati",
			queries: ["kayagata"],
			results: [
				{
					slug: "mn119",
					title: "Mindfulness of the Body",
					description: "…",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn119",
				},
			],
			summary: "A different briefing…",
			model: "test",
			createdAt: 1,
		});
		assert.ok(snap);
		assert.equal(snap?.slug, "mindfulness-of-the-body-sep-10-2026");
	});

	it("accepts a numeric collision suffix on the public slug", () => {
		const snap = sanitizeAskShareSnapshot({
			slug: "mindfulness-of-the-body-2",
			question: "What is kayagata-sati?",
			lookingFor: "kāyagatāsati",
			queries: ["kayagata"],
			results: [
				{
					slug: "mn119",
					title: "Mindfulness of the Body",
					description: "…",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn119",
				},
			],
			summary: "A different briefing…",
			model: "test",
			createdAt: 1,
		});
		assert.ok(snap);
		assert.equal(snap?.slug, "mindfulness-of-the-body-2");
		assert.equal(snap?.results.length, 1);
	});

	it("round-trips a multi-turn conversation prefix", () => {
		const hit = {
			slug: "mn10",
			title: "Satipatthana",
			description: "",
			contentSnippet: null,
			referenceOnly: false,
			href: "/mn10",
		};
		const snap = sanitizeAskShareSnapshot({
			slug: "faith-and-dhamma-followers",
			question: "What about the second one?",
			lookingFor: "follow-up",
			queries: ["sekha"],
			results: [hit],
			summary: "Continuing…",
			model: "test",
			createdAt: 1,
			thread: [
				{
					question: "Are faith-followers sekhas?",
					lookingFor: "sekha",
					queries: ["saddhanusari"],
					results: [hit],
					summary: "First answer…",
					model: "test",
					candidateCount: 120,
				},
				{
					question: "What about the second one?",
					lookingFor: "follow-up",
					queries: ["sekha"],
					results: [hit],
					summary: "Continuing…",
					model: "test",
					candidateCount: 80,
				},
			],
		});
		assert.ok(snap);
		assert.equal(snap?.thread?.length, 2);
		const restored = askShareTurnsForRestore(snap!);
		assert.deepEqual(
			restored.map((turn) => turn.question),
			["Are faith-followers sekhas?", "What about the second one?"],
		);
		assert.equal(restored[0]?.candidateCount, 120);
	});

	it("keeps a research report, reasoning, and candidate count", () => {
		const report = [
			"## Who Is a Trainee?",
			"",
			"> He trains (*sikkhati*), therefore he is called a trainee.",
			"",
			"- **The trainee is contrasted with the Arahant (*asekha*).**",
		].join("\n");
		const snap = sanitizeAskShareSnapshot({
			slug: "who-is-a-trainee",
			question: "Who is a trainee?",
			lookingFor: "sekkha",
			queries: ["sekkha"],
			results: [
				{
					slug: "mn70",
					title: "Kīṭāgiri sutta - At Kīṭāgiri",
					description: "",
					contentSnippet: null,
					referenceOnly: false,
					href: "/mn70",
				},
			],
			summary: "Flattened briefing",
			model: "test",
			research: true,
			report,
			reasoning: "The brief asks for the trainee grades.",
			candidateCount: 509,
			createdAt: 1,
		});
		assert.ok(snap);
		assert.equal(snap?.research, true);
		assert.match(snap?.report || "", /> He trains/);
		assert.match(snap?.report || "", /\*\*The trainee/);
		assert.equal(snap?.reasoning, "The brief asks for the trainee grades.");
		assert.equal(snap?.candidateCount, 509);
		const restored = askShareTurnsForRestore(snap!);
		assert.equal(restored[0]?.research, true);
		assert.equal(restored[0]?.report, snap?.report);
		assert.equal(restored[0]?.candidateCount, 509);
		const seo = askShareSeo(snap!);
		assert.match(seo.title, /Research Report/);
		assert.match(seo.description, /trainee/i);
	});
});
