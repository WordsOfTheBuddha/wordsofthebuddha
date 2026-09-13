import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	looksLikeHtmlBlock,
	looksLikeMermaidSource,
	mermaidBlockHtml,
	sanitizeResearchReportHtml,
	wrapResearchReportHtml,
} from "./researchReportSanitize";

describe("sanitizeResearchReportHtml", () => {
	it("keeps SVG primitives and fragment url() refs", () => {
		const html = sanitizeResearchReportHtml(
			`<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="url(#g)" marker-end="url(#m)"/></svg>`,
		);
		assert.match(html, /viewBox="0 0 10 10"/);
		assert.match(html, /<circle /);
		assert.match(html, /fill="url\(#g\)"/);
		assert.match(html, /marker-end="url\(#m\)"/);
	});

	it("preserves SVG camelCase tags", () => {
		const html = sanitizeResearchReportHtml(
			`<svg><clipPath id="c"><rect width="1" height="1"/></clipPath></svg>`,
		);
		assert.match(html, /<clipPath /);
		assert.match(html, /<\/clipPath>/);
	});

	it("drops scripts, handlers, and off-site URLs", () => {
		const html = sanitizeResearchReportHtml(
			`<div onclick="alert(1)"><p>ok</p><script>alert(1)</script><a href="https://evil.example">x</a><a href="/mn10">MN 10</a></div>`,
		);
		assert.match(html, /<p>ok<\/p>/);
		assert.match(html, /href="\/mn10"/);
		assert.doesNotMatch(html, /<script>/i);
		assert.doesNotMatch(html, /alert\(1\)/);
		assert.doesNotMatch(html, /onclick/i);
		assert.doesNotMatch(html, /evil\.example/);
	});

	it("drops style tags from model HTML", () => {
		const html = sanitizeResearchReportHtml(
			`<style>body{display:none}</style><p>keep</p>`,
		);
		assert.equal(html, "<p>keep</p>");
	});

	it("keeps mermaid class CSS when allowStyle is on", () => {
		const html = sanitizeResearchReportHtml(
			`<svg><style>#id{font-size:12px}</style><g></g></svg>`,
			{ allowStyle: true },
		);
		assert.match(html, /<style>#id\{font-size:12px\}<\/style>/);
		assert.doesNotMatch(
			sanitizeResearchReportHtml(
				`<svg><style>@import url("https://evil.example")</style></svg>`,
				{ allowStyle: true },
			),
			/<style>/,
		);
	});
});

describe("diagram fence helpers", () => {
	it("detects mermaid openings and html/svg blocks", () => {
		assert.equal(looksLikeMermaidSource("flowchart TD\n  A --> B"), true);
		assert.equal(looksLikeMermaidSource("graph LR\n  A --> B"), true);
		assert.equal(looksLikeMermaidSource("const graph = 1"), false);
		assert.equal(looksLikeHtmlBlock("<svg viewBox='0 0 1 1'></svg>"), true);
		assert.equal(looksLikeHtmlBlock("<figure><p>x</p></figure>"), true);
		assert.equal(looksLikeHtmlBlock("<p>x</p>"), false);
	});

	it("wraps sanitized HTML figures", () => {
		const html = wrapResearchReportHtml(
			`<figure><svg viewBox="0 0 2 2"><rect width="2" height="2"/></svg></figure>`,
		);
		assert.match(html, /class="ai-report-html"/);
		assert.match(html, /<rect /);
	});

	it("emits mermaid placeholders", () => {
		const html = mermaidBlockHtml("flowchart TD\n  A --> B");
		assert.match(html, /data-ai-mermaid/);
		assert.match(html, /flowchart TD/);
		assert.match(html, /A --&gt; B/);
	});
});
