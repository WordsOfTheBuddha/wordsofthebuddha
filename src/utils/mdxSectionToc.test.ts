import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractMdxSectionToc } from "./mdxSectionToc";

describe("extractMdxSectionToc", () => {
	it("reads a toc comment on the following line", () => {
		const { body, sectionToc } = extractMdxSectionToc(`
#### 2.11
{/* toc: Two powers */}

Text.
`);
		assert.equal(body.includes("{/*"), false);
		assert.equal(sectionToc["2.11"], "Two powers");
	});

	it("reads inline toc comments on the heading line", () => {
		const { sectionToc } = extractMdxSectionToc(
			"#### 2.16 {/* toc: After Death */}\n",
		);
		assert.equal(sectionToc["2.16"], "After Death");
	});

	it("reads toc after blank lines between interleaved headings", () => {
		const { body, sectionToc } = extractMdxSectionToc(`
#### 2.11

#### 2.11
{/* toc: Two Powers */}

Text.
`);
		assert.equal(sectionToc["2.11"], "Two Powers");
		assert.doesNotMatch(body, /toc:/);
	});
});
