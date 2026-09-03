import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAskAdminEmails, isAskAdminEmail } from "./aiAskAdmin";

describe("getAskAdminEmails", () => {
	it("parses a comma allowlist", () => {
		assert.deepEqual(getAskAdminEmails(" A@x.com, b@y.com "), [
			"a@x.com",
			"b@y.com",
		]);
		assert.deepEqual(getAskAdminEmails(""), []);
	});
});

describe("isAskAdminEmail", () => {
	it("matches case-insensitively", () => {
		assert.equal(isAskAdminEmail("A@x.com", ["a@x.com"]), true);
		assert.equal(isAskAdminEmail("other@x.com", ["a@x.com"]), false);
		assert.equal(isAskAdminEmail(null, ["a@x.com"]), false);
	});
});
