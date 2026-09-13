import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mermaidBlockHtml } from "./researchReportSanitize";
import { bakeResearchReportMermaid } from "./researchReportMermaidServer";

describe("bakeResearchReportMermaid", () => {
	it("turns a flowchart listing into SVG", { timeout: 60_000 }, async () => {
		const html = mermaidBlockHtml("flowchart TD\n  A[Start] --> B[End]");
		const baked = await bakeResearchReportMermaid(html, false);
		assert.match(baked, /<svg[\s>]/i);
		assert.match(baked, /ai-report-diagram/);
		assert.doesNotMatch(baked, /<script/i);
		assert.doesNotMatch(baked, /data-ai-mermaid/);
	});
});
