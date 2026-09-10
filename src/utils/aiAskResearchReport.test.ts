import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	fallbackResearchReport,
	formatResearchHitTitle,
	formatResearchSourceLine,
	parseResearchReportMarkdown,
	renderResearchReportHtml,
	replaceResearchSourcesSection,
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

	it("escapes raw HTML from the model", () => {
		const html = renderResearchReportHtml(
			`Hello <script>alert(1)</script> MN 10`,
			[{ slug: "mn10", href: "/mn10" }],
		);
		assert.match(html, /&lt;script&gt;/);
		assert.doesNotMatch(html, /<script>/);
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
