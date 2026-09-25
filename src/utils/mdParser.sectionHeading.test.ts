import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarkdown } from "./mdParser";

describe("parseMarkdown section headings", () => {
	it("renders brace titles as ToC metadata only", async () => {
		const html = await parseMarkdown("#### 2.11 {Two powers}\n\nBody.");
		assert.match(html, /data-section="2\.11"/);
		assert.match(html, /data-toc-title="Two powers"/);
		assert.match(html, /<h4[^>]*>2\.11<\/h4>/);
		assert.doesNotMatch(html, /Two powers<\/h4>/);
	});
});
