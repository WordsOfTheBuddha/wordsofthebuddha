import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	fallbackResearchReport,
	formatResearchHitTitle,
	formatResearchSourceLine,
	parseResearchReportMarkdown,
	renderAskBriefingHtml,
	renderResearchReportHtml,
	replaceResearchSourcesSection,
	RESEARCH_REPORT_SYSTEM,
	takeResearchReadPaliRequest,
} from "./aiAskResearchReport";

describe("renderResearchReportHtml", () => {
	it("renders headings, tables, and linked citations", () => {
		const html = renderResearchReportHtml(
			`## Body mindfulness

MN 10 sets out the four establishments.

| Discourse | Facet |
| --- | --- |
| MN 10 | body |
| SN 47.19 | simile |

- Keep **sati** in view
`,
			[
				{ slug: "mn10", href: "/mn10" },
				{ slug: "sn47.19", href: "/sn47.19" },
			],
		);
		assert.match(html, /<h2>/);
		assert.match(html, /ai-report-table/);
		assert.match(html, /href="\/mn10"/);
		assert.match(html, /href="\/sn47\.19"/);
		assert.match(html, /<strong>sati<\/strong>/);
		assert.match(html, /<ul>/);
		assert.doesNotMatch(html, /<script>/);
		assert.doesNotMatch(html, /data-cite-title/);
	});

	it("does not link discourse IDs in headings", () => {
		const html = renderResearchReportHtml(
			`## Chapter 6 — Arising and Passing: SN 47.42's Conditional Analysis

SN 47.42 teaches the arising.

## Body: [MN 10](/mn10)

MN 10 sets out the four establishments.
`,
			[
				{ slug: "sn47.42", href: "/sn47.42" },
				{ slug: "mn10", href: "/mn10" },
			],
		);
		const headingIds = [...html.matchAll(/<h[23]>([\s\S]*?)<\/h[23]>/g)].map(
			(match) => match[1] || "",
		);
		assert.equal(headingIds.length, 2);
		for (const heading of headingIds) {
			assert.doesNotMatch(heading, /<a\b/);
		}
		assert.match(headingIds[0] || "", /SN 47\.42/);
		assert.match(headingIds[1] || "", /MN 10/);
		assert.match(html, /<p><a class="ai-summary-ref" href="\/sn47\.42">SN 47\.42<\/a>/);
		assert.match(html, /<p><a class="ai-summary-ref" href="\/mn10">MN 10<\/a>/);
	});

	it("annotates on-screen citations with title and description", () => {
		const html = renderResearchReportHtml(
			"MN 58 answers the dilemma.",
			[
				{
					slug: "mn58",
					href: "/mn58",
					title: "Abhayarājakumāra sutta - To Prince Abhaya",
					description:
						"Prince Abhaya, coached by Nigaṇṭha Nāṭaputta, tries to trap the Buddha.",
				},
			],
			{ citationPopovers: true },
		);
		assert.match(
			html,
			/data-cite-title="MN 58 - Abhayarājakumāra sutta - To Prince Abhaya"/,
		);
		assert.match(html, /data-cite-desc="Prince Abhaya, coached/);
	});

	it("keeps export hrefs so PDF and EPUB citations stay clickable", () => {
		const html = renderResearchReportHtml(
			"MN 10 sets out the four establishments, and SN 47.19 is the simile.",
			[
				{ slug: "mn10", href: "#d-t0-mn10" },
				{ slug: "sn47.19", href: "d-t0-sn47.19.xhtml" },
			],
		);
		assert.match(html, /href="#d-t0-mn10"/);
		assert.match(html, /href="d-t0-sn47\.19\.xhtml"/);
		assert.doesNotMatch(html, /href="\/mn10"/);
	});

	it("keeps a paragraph fragment on EPUB export hrefs", () => {
		const html = renderResearchReportHtml(
			"[MN 21 ¶21](/mn21#21) is the simile.",
			[{ slug: "mn21", href: "d-t0-mn21.xhtml" }],
		);
		assert.match(html, /href="d-t0-mn21\.xhtml#21"/);
		assert.doesNotMatch(html, /href="\/mn21/);
	});

	it("renders paragraph-level citations and links a discourse once per paragraph", () => {
		const html = renderResearchReportHtml(
			`MN 21 ¶21 gives the simile, and MN 21 repeats it.

[MN 10 ¶6–50](/mn10#6-50) maps the body section.

MN 10 is named again in a new paragraph.
`,
			[
				{ slug: "mn21", href: "/mn21" },
				{ slug: "mn10", href: "/mn10" },
			],
		);
		assert.match(
			html,
			/<a class="ai-summary-ref" href="\/mn21#21">MN 21 ¶21<\/a> gives the simile, and MN 21 repeats it/,
		);
		assert.equal([...html.matchAll(/href="\/mn21(?:#21)?"/g)].length, 1);
		assert.match(html, /href="\/mn10#6-50"/);
		assert.match(
			html,
			/<p><a class="ai-summary-ref" href="\/mn10">MN 10<\/a> is named again/,
		);
	});

	it("renders block quotes and bold that contains italics", () => {
		const html = renderResearchReportHtml(
			`The Buddha's answer is brief:

> "'He trains' (*sikkhati*), therefore he is called a trainee (*sekha*)."

- **The trainee is contrasted with the Arahant (the "adept," *asekha*).** SN 48.53 frames the question.
`,
			[{ slug: "sn48.53", href: "/sn48.53" }],
		);
		assert.match(html, /<blockquote>/);
		assert.doesNotMatch(html, /^[^<]*>\s*'/m);
		assert.match(html, /<strong>/);
		assert.match(html, /<em>asekha<\/em>/);
		assert.doesNotMatch(html, /\*\*The trainee/);
	});

	it("omits the markdown Sources list from the on-screen report", () => {
		const html = renderResearchReportHtml(
			`## Thesis

MN 10 is the root text.

## Sources

- MN 10 — Satipaṭṭhāna sutta — The Establishments of Mindfulness`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(html, /Thesis/);
		assert.doesNotMatch(html, /Sources/);
		assert.doesNotMatch(html, /Establishments of Mindfulness/);
	});

	it("strips script tags from model HTML instead of executing them", () => {
		const html = renderResearchReportHtml(
			`Hello <script>alert(1)</script> MN 10`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.doesNotMatch(html, /<script>/i);
		assert.doesNotMatch(html, /alert\(1\)/);
		assert.match(html, /Hello/);
		assert.match(html, /href="\/mn10"/);
	});

	it("renders mermaid, SVG, and HTML diagram fences", () => {
		const html = renderResearchReportHtml(
			`## Map

\`\`\`mermaid
flowchart TD
  A[MN 10] --> B[SN 47.19]
\`\`\`

\`\`\`svg
<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="#333"/><script>alert(1)</script></svg>
\`\`\`

\`\`\`html
<figure onclick="alert(1)"><p>MN 10</p><a href="https://evil.example">x</a></figure>
\`\`\`
`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(html, /<pre class="ai-report-mermaid" data-ai-mermaid>/);
		assert.match(html, /flowchart TD/);
		assert.match(html, /<div class="ai-report-html">/);
		assert.match(html, /<circle /);
		assert.doesNotMatch(html, /<script>/i);
		assert.doesNotMatch(html, /alert\(1\)/);
		assert.doesNotMatch(html, /onclick/i);
		assert.doesNotMatch(html, /evil\.example/);
		assert.match(html, /<figure>/);
	});

	it("treats an unlabeled flowchart fence as mermaid", () => {
		const html = renderResearchReportHtml(
			"```\nflowchart LR\n  A --> B\n```",
		);
		assert.match(html, /data-ai-mermaid/);
		assert.match(html, /flowchart LR/);
		assert.doesNotMatch(html, /ai-report-code/);
	});

	it("keeps mermaid line breaks when a paragraph follows the fence", () => {
		const html = renderResearchReportHtml(
			`A short lead:

\`\`\`mermaid
flowchart LR
  A[Start] --> B[End]
\`\`\`

Then MN 10 continues.
`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(html, /<pre class="ai-report-mermaid" data-ai-mermaid>/);
		assert.match(html, /flowchart LR\n {2}A\[Start\] --&gt; B\[End\]/);
		assert.doesNotMatch(html, /flowchart LR A\[Start\]/);
	});

	it("renders #### headings, rules, and italics without eating spaces", () => {
		const html = renderResearchReportHtml(
			`### Strict check, qualification by qualification

---

#### 1. Higher virtue (*adhisīla*)

None of the defining passages for the *saddhānusārī* or *dhammānusārī* in the excerpts.
`,
		);
		assert.match(html, /<h3>Strict check, qualification by qualification<\/h3>/);
		assert.match(html, /<hr class="ai-report-rule">/);
		assert.doesNotMatch(html, /####/);
		assert.match(html, /<em>adhisīla<\/em>/);
		assert.match(html, /<em>saddhānusārī<\/em>/);
		assert.match(html, /None of the defining passages for the/);
		assert.doesNotMatch(html, /Noneof/);
		assert.doesNotMatch(html, /virtue\(adhisīla\)/);
	});

	it("joins soft-wrapped paragraph lines with spaces", () => {
		const html = renderResearchReportHtml(
			`None of the defining passages for the\nexcerpts explicitly states a virtue qualification.`,
		);
		assert.match(html, /the excerpts explicitly/);
		assert.doesNotMatch(html, /theexcerpts/);
		assert.doesNotMatch(html, /<br>/);
	});
});

describe("renderAskBriefingHtml", () => {
	it("keeps ordinary Ask briefings as paragraphs", () => {
		const html = renderAskBriefingHtml("Start with MN 10, then SN 47.19.", [
			{ slug: "mn10", href: "/mn10" },
			{ slug: "sn47.19", href: "/sn47.19" },
		]);
		assert.match(html, /<p>/);
		assert.doesNotMatch(html, /<table>/);
		assert.match(html, /href="\/mn10"/);
	});

	it("renders a requested table or list", () => {
		const html = renderAskBriefingHtml(
			`| Discourse | Facet |\n| --- | --- |\n| MN 10 | body |\n\n- Keep sati in view`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(html, /ai-report-table/);
		assert.match(html, /<ul>/);
		assert.match(html, /href="\/mn10"/);
	});
});

describe("parseResearchReportMarkdown", () => {
	it("strips fences and think tags", () => {
		const parsed = parseResearchReportMarkdown(
			"<think>hidden</think>\n```markdown\n## Hello\n```",
		);
		assert.match(parsed, /## Hello/);
		assert.doesNotMatch(parsed, /hidden/);
	});
});

describe("takeResearchReadPaliRequest", () => {
	it("strips the harness line and keeps the requested IDs", () => {
		const taken = takeResearchReadPaliRequest(
			`## Thesis

MN 70 distinguishes the faith-follower.

readPali: MN 70, SN 12.49
`,
		);
		assert.match(taken.report, /faith-follower/);
		assert.doesNotMatch(taken.report, /readPali/);
		assert.deepEqual(taken.readPali, ["MN 70", "SN 12.49"]);
	});

	it("omits a leaked readPali line from the on-screen report", () => {
		const html = renderResearchReportHtml(
			`## Thesis

MN 70 distinguishes the faith-follower.

readPali: MN 70`,
			[{ slug: "mn70", href: "/mn70" }],
		);
		assert.match(html, /faith-follower/);
		assert.doesNotMatch(html, /readPali/i);
	});
});

describe("research source lines", () => {
	it("puts Pāli then English after the ID", () => {
		assert.equal(
			formatResearchSourceLine({
				slug: "mn53",
				title: "Sekha sutta - Disciple in Training",
			}),
			"MN 53 — Sekha sutta — Disciple in Training",
		);
	});

	it("appends a PTS citation when present", () => {
		assert.equal(
			formatResearchSourceLine({
				slug: "mn101",
				title: "Devadaha sutta - At Devadaha",
				volpage: "PTS 2.214–2.227",
			}),
			"MN 101 — Devadaha sutta — At Devadaha · PTS 2.214–2.227",
		);
	});

	it("formats Search-style card titles", () => {
		assert.equal(
			formatResearchHitTitle("Devadaha sutta - At Devadaha"),
			"Devadaha sutta - At Devadaha",
		);
	});

	it("replaces a model Sources section with a bilingual list", () => {
		const md = replaceResearchSourcesSection(
			`## Thesis\n\nMN 53 is the root text.\n\n## Sources\n\n- MN 53 — Sekha`,
			[{ slug: "mn53", title: "Sekha sutta - Disciple in Training" }],
		);
		assert.match(md, /## Thesis/);
		assert.match(md, /Sekha sutta — Disciple in Training/);
		assert.doesNotMatch(md, /MN 53 — Sekha$/m);
	});
});

describe("fallbackResearchReport", () => {
	it("builds bilingual source lines from hits", () => {
		const md = fallbackResearchReport({
			question: "feeling",
			hits: [
				{
					slug: "sn36.1",
					title: "Vedanā sutta - Feeling",
					description: "",
					contentSnippet: null,
					referenceOnly: false,
					href: "/sn36.1",
				},
			],
		});
		assert.match(md, /## Sources/);
		assert.match(md, /SN 36\.1 — Vedanā sutta — Feeling/);
	});

	it("explains an empty library result", () => {
		const md = fallbackResearchReport({
			question: "weather in paris",
			hits: [],
		});
		assert.match(md, /did not return matching discourses/i);
	});
});

describe("RESEARCH_REPORT_SYSTEM", () => {
	it("asks for reader-facing hidden thinking", () => {
		assert.match(RESEARCH_REPORT_SYSTEM, /shown to the reader/);
		assert.match(RESEARCH_REPORT_SYSTEM, /When you can/);
		assert.match(RESEARCH_REPORT_SYSTEM, /readPali:/);
		assert.match(RESEARCH_REPORT_SYSTEM, /thorough report/);
		assert.match(RESEARCH_REPORT_SYSTEM, /typically a few thousand words/);
		assert.match(RESEARCH_REPORT_SYSTEM, /Do not pad to hit a requested word count/);
		assert.match(RESEARCH_REPORT_SYSTEM, /more than about 8,000 words/);
		assert.match(RESEARCH_REPORT_SYSTEM, /other selected titles as further sources/);
		assert.match(
			RESEARCH_REPORT_SYSTEM,
			/form english terms from core translations/i,
		);
		assert.match(RESEARCH_REPORT_SYSTEM, /\[core\].*\[reference\]/s);
		assert.match(
			RESEARCH_REPORT_SYSTEM,
			/keep a single english rendering for each/i,
		);
		assert.match(
			RESEARCH_REPORT_SYSTEM,
			/a different topic.*may use a different rendering/i,
		);
		assert.match(RESEARCH_REPORT_SYSTEM, /```mermaid/);
		assert.match(RESEARCH_REPORT_SYSTEM, /Quote node labels/);
		assert.match(RESEARCH_REPORT_SYSTEM, /inline SVG/);
		assert.match(RESEARCH_REPORT_SYSTEM, /no scripts, forms, event handlers/);
		assert.match(RESEARCH_REPORT_SYSTEM, /\[MN 21 ¶21\]\(\/mn21#21\)/);
		assert.match(RESEARCH_REPORT_SYSTEM, /link a given discourse only once/);
	});
});
