import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	aiSourceRowHtml,
	askInlineAnswerHtml,
	askInlineChipsHtml,
	askInlineEmptyHtml,
	askInlineProcessHtml,
	askInlineSourcesHtml,
	formatAskAnswerCopyMarkdown,
	type AskInlineTurn,
} from "./aiAskCards";

function turn(over: Partial<AskInlineTurn> = {}): AskInlineTurn {
	return {
		question: "What is mindfulness?",
		lookingFor: "mindfulness definition",
		queries: ["sati"],
		fallbackQueries: [],
		offTopic: false,
		results: [],
		summary: "",
		pending: true,
		phase: "rewrite",
		...over,
	};
}

function hit(
	over: Partial<{
		slug: string;
		title: string;
		description: string;
		contentSnippet: string | null;
		referenceOnly: boolean;
		href: string;
	}> = {},
): {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
	referenceOnly: boolean;
	href: string;
} {
	return {
		slug: "mn10",
		title: "t",
		description: "",
		contentSnippet: null,
		referenceOnly: false,
		href: "/mn10",
		...over,
	};
}

describe("askInlineProcessHtml", () => {
	it("shows a single active step while rewriting", () => {
		const html = askInlineProcessHtml(turn());
		assert.ok(html.includes("Understanding the question…"));
		assert.ok(html.includes("is-active"));
		assert.ok(html.includes("Search the library"));
	});

	it("shows done strip with counts when finished", () => {
		const html = askInlineProcessHtml(
			turn({
				pending: false,
				phase: "done",
				candidateCount: 120,
				results: [hit()],
			}),
		);
		assert.ok(html.includes("Understood · mindfulness definition"));
		assert.ok(html.includes("Searched the library · 120 discourses"));
		assert.ok(html.includes("Picked 1 discourses"));
	});

	it("renders one off-topic row when done", () => {
		const html = askInlineProcessHtml(
			turn({ pending: false, phase: "done", offTopic: true, lookingFor: "" }),
		);
		assert.ok(html.includes("Outside the early discourses"));
	});

	it("keeps the death phase on error instead of an all-done strip", () => {
		const html = askInlineProcessHtml(
			turn({ pending: false, phase: "search", error: "The model timed out." }),
		);
		assert.ok(html.includes("Understood · mindfulness definition"));
		assert.ok(html.includes("Searching the library…"));
		assert.ok(html.includes("is-active"));
		assert.ok(!html.includes("No matching discourses"));
		assert.ok(!html.includes("Picked"));
	});
});

describe("aiSourceRowHtml", () => {
	it("renders a tab-parity row with popover data attributes", () => {
		const html = aiSourceRowHtml({
			slug: "sn47.10",
			title: "Some title",
			description: "A description.",
			contentSnippet: null,
			referenceOnly: false,
			href: "/sn47.10",
		});
		assert.match(html, /^<li data-result-type="discourse">/);
		assert.match(html, /ai-source-ref/);
		assert.match(html, />SN 47.10<\/span>/);
		assert.match(html, /data-cite-title="SN 47.10 - Some title"/);
		assert.match(html, /data-cite-desc="A description\."/);
	});

	it("skips hits without a usable title", () => {
		const html = aiSourceRowHtml({
			slug: "mn10",
			title: "",
			description: "",
			contentSnippet: null,
			referenceOnly: false,
			href: "/mn10",
		});
		assert.ok(html.includes("MN 10"));
	});
});

describe("askInlineAnswerHtml", () => {
	it("annotates answer links for the citation popover", () => {
		const html = askInlineAnswerHtml(
			{
				summary: "SN 47.10 describes mindfulness.",
				results: [
					{
						slug: "sn47.10",
						title: "Some title",
						description: "Desc.",
						contentSnippet: null,
						referenceOnly: false,
						href: "/sn47.10",
					},
				],
			},
			0,
		);
		assert.ok(html.includes("ai-summary-ref"));
		assert.ok(html.includes('data-cite-title="SN 47.10 - Some title"'));
		assert.ok(html.includes("Copy"));
	});
});

describe("formatAskAnswerCopyMarkdown", () => {
	const results = [
		{
			slug: "sn47.10",
			title: "Some title",
			description: "",
			contentSnippet: null,
			referenceOnly: false,
			href: "/sn47.10",
		},
	];

	it("copies question, linkified answer, and sources as markdown", () => {
		const md = formatAskAnswerCopyMarkdown({
			question: "What is sati?",
			summary: "SN 47.10 describes mindfulness practice.",
			results,
			origin: "https://example.org",
		});
		assert.ok(md.includes("What is sati?"));
		assert.ok(
			md.includes("[SN 47.10](https://example.org/sn47.10)"),
		);
		assert.ok(
			md.includes("- [SN 47.10 - Some title](https://example.org/sn47.10)"),
		);
	});

	it("links each discourse only once", () => {
		const md = formatAskAnswerCopyMarkdown({
			question: "q",
			summary: "SN 47.10 says this. SN 47.10 says that.",
			results,
			origin: "https://example.org",
		});
		const links = md.match(/\[SN 47\.10\]\(/g) || [];
		assert.equal(links.length, 1);
	});

	it("returns empty for empty input", () => {
		assert.equal(
			formatAskAnswerCopyMarkdown({ question: "", summary: "", results: [] }),
			"",
		);
	});
});

describe("askInlineSourcesHtml", () => {
	it("wraps rows in a captioned disclosure", () => {
		const html = askInlineSourcesHtml({
			results: [hit()],
			candidateCount: 40,
		});
		assert.ok(html.includes("<details"));
		assert.ok(html.includes("Showing 1 discourse · picked from 40"));
	});

	it("returns empty without results", () => {
		assert.equal(askInlineSourcesHtml({ results: [], candidateCount: 0 }), "");
	});
});

describe("askInlineChipsHtml", () => {
	it("renders sourcing chips", () => {
		const html = askInlineChipsHtml({
			queries: ["sati"],
			fallbackQueries: [],
			offTopic: false,
			results: [hit()],
		});
		assert.ok(html.includes("ai-query-chip"));
		assert.ok(html.includes("/search?q=sati"));
	});
});

describe("askInlineEmptyHtml", () => {
	it("links to search", () => {
		const html = askInlineEmptyHtml({
			queries: [],
			lookingFor: "",
			question: "xyz",
		});
		assert.ok(html.includes("No discourses matched"));
		assert.ok(html.includes("/search?q=xyz"));
	});
});
