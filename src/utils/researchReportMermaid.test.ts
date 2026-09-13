import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mermaidBlockHtml } from "./researchReportSanitize";
import { bakeResearchReportMermaid } from "./researchReportMermaidServer";
import {
	isMermaidErrorSvg,
	normalizeMermaidSource,
} from "./researchReportMermaidNormalize";

describe("normalizeMermaidSource", () => {
	it("quotes labels that contain br tags or semicolons", () => {
		const source = `flowchart TD
    V[Purified virtue<br/>SN 47.3; good conduct] --> G[Next]`;
		const out = normalizeMermaidSource(source);
		assert.match(out, /V\["Purified virtue\nSN 47\.3; good conduct"\]/);
		assert.match(out, /G\[Next\]/);
	});

	it("leaves already-quoted subgraph titles intact", () => {
		const source = `flowchart LR
    subgraph descent["The descending chain"]
        A2[Start] --> B2[End]
    end`;
		assert.match(
			normalizeMermaidSource(source),
			/subgraph descent\["The descending chain"\]/,
		);
	});
});

describe("isMermaidErrorSvg", () => {
	it("detects mermaid's syntax-error drawing", () => {
		assert.equal(
			isMermaidErrorSvg(
				'<svg><text class="error-text">Syntax error in text</text></svg>',
			),
			true,
		);
		assert.equal(isMermaidErrorSvg('<svg class="flowchart"></svg>'), false);
	});
});

describe("bakeResearchReportMermaid", () => {
	it("turns a flowchart listing into SVG", { timeout: 60_000 }, async () => {
		const html = mermaidBlockHtml("flowchart TD\n  A[Start] --> B[End]");
		const baked = await bakeResearchReportMermaid(html, false);
		assert.match(baked, /<svg[\s>]/i);
		assert.match(baked, /ai-report-diagram/);
		assert.doesNotMatch(baked, /data-ai-mermaid/);
		assert.doesNotMatch(baked, /Syntax error in text/);
	});

	it(
		"renders labels that used HTML br and semicolons",
		{ timeout: 60_000 },
		async () => {
			const html = mermaidBlockHtml(`flowchart TD
    V[Purified virtue and straight view<br/>SN 47.3; good conduct] --> G[Gradual training]
    G --> L[Liberation]`);
			const baked = await bakeResearchReportMermaid(html, false);
			assert.match(baked, /<svg[\s>]/i);
			assert.match(baked, /ai-report-diagram/);
			assert.doesNotMatch(baked, /Syntax error in text/);
			assert.doesNotMatch(baked, /data-ai-mermaid/);
		},
	);

	it("keeps the listing when mermaid source is invalid", { timeout: 60_000 }, async () => {
		const html = mermaidBlockHtml("flowchart TD\n  this is not { valid mermaid");
		const baked = await bakeResearchReportMermaid(html, false);
		assert.doesNotMatch(baked, /Syntax error in text/);
		assert.match(baked, /data-ai-mermaid/);
		assert.match(baked, /this is not/);
	});
});
