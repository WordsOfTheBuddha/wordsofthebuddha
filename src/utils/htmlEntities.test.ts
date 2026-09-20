import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeHtmlEntities } from "./htmlEntities";

describe("decodeHtmlEntities", () => {
	it("decodes named and numeric entities", () => {
		assert.equal(decodeHtmlEntities("trainer&#39;s-eye"), "trainer's-eye");
		assert.equal(decodeHtmlEntities("trainer&#x27;s-eye"), "trainer's-eye");
		assert.equal(decodeHtmlEntities("&apos;quoted&apos;"), "'quoted'");
		assert.equal(decodeHtmlEntities("&lt;tag&gt; &amp; &quot;x&quot;"), '<tag> & "x"');
	});
});
