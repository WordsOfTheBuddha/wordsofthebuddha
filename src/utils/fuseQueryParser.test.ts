import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFuseQuery } from "./fuseQueryParser";

describe("buildFuseQuery slug prefix routing", () => {
	it("routes ^SN collection prefix to slugPrefixFilter", () => {
		const result = buildFuseQuery("^SN āsavānaṁ");
		assert.deepEqual(result.slugPrefixFilter, ["sn"]);
		assert.ok(
			!JSON.stringify(result.query).includes("^SN"),
			"^SN should not become a Fuse metadata clause",
		);
	});

	it("routes ^SN22 discourse prefix to slugPrefixFilter", () => {
		const result = buildFuseQuery("^SN22 āsavānaṁ");
		assert.deepEqual(result.slugPrefixFilter, ["sn22"]);
		assert.ok(
			!JSON.stringify(result.query).includes("^SN22"),
			"^SN22 should not become a Fuse metadata clause",
		);
	});

	it("merges ^sn 22 into sn22 slugPrefixFilter", () => {
		const result = buildFuseQuery("^sn 22 āsavānaṁ");
		assert.deepEqual(result.slugPrefixFilter, ["sn22"]);
	});

	it("routes ^sn12.1 dotted prefix to slugPrefixFilter", () => {
		const result = buildFuseQuery("^sn12.1 consciousness");
		assert.deepEqual(result.slugPrefixFilter, ["sn12.1"]);
	});

	it("routes ^mn38 prefix to slugPrefixFilter", () => {
		const result = buildFuseQuery("^mn38 craving");
		assert.deepEqual(result.slugPrefixFilter, ["mn38"]);
	});

	it("does not add slug-prefix caret terms to highlightTerms", () => {
		const result = buildFuseQuery("^SN22 āsavānaṁ");
		assert.deepEqual(result.slugPrefixFilter, ["sn22"]);
		assert.ok(
			!result.highlightTerms.some((ht) => ht.term === "SN22"),
			"^SN22 should not become a content highlight term",
		);
	});
});
