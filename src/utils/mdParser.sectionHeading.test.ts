import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarkdown } from "./mdParser";

describe("parseMarkdown section headings", () => {
	it("renders numeric ids with data-section", async () => {
		const html = await parseMarkdown("#### 2.11\n\nBody.");
		assert.match(html, /data-section="2\.11"/);
		assert.match(html, /<h4[^>]*>2\.11<\/h4>/);
	});
});
