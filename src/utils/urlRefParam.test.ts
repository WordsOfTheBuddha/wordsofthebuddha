import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getRefParamFromUrl,
	urlHasRefParam,
} from "./urlRefParam";

describe("urlRefParam", () => {
	it("getRefParamFromUrl returns null when ref is absent", () => {
		assert.equal(getRefParamFromUrl(new URLSearchParams()), null);
	});

	it("getRefParamFromUrl reads ref=true case-insensitively", () => {
		assert.equal(
			getRefParamFromUrl(new URLSearchParams("ref=true")),
			true,
		);
		assert.equal(
			getRefParamFromUrl(new URLSearchParams("REF=true")),
			true,
		);
	});

	it("getRefParamFromUrl reads legacy all=true", () => {
		assert.equal(
			getRefParamFromUrl(new URLSearchParams("all=true")),
			true,
		);
	});

	it("getRefParamFromUrl returns false for explicit non-true values", () => {
		assert.equal(
			getRefParamFromUrl(new URLSearchParams("ref=false")),
			false,
		);
	});

	it("urlHasRefParam matches getRefParamFromUrl true only", () => {
		const params = new URLSearchParams("ref=true");
		assert.equal(urlHasRefParam(params), true);
		assert.equal(getRefParamFromUrl(params), true);
		assert.equal(urlHasRefParam(new URLSearchParams("ref=false")), false);
	});
});
