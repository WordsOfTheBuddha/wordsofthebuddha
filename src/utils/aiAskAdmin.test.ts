import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { askAdminApiGate, getAskAdminEmails, isAskAdminEmail } from "./aiAskAdmin";

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

describe("askAdminApiGate", () => {
	it("allows only the configured allowlist", () => {
		const previous = process.env.ASK_ADMIN_EMAILS;
		process.env.ASK_ADMIN_EMAILS = "admin@example.com";
		try {
			const denied = askAdminApiGate("reader@example.com");
			assert.equal(denied.ok, false);
			if (!denied.ok) assert.equal(denied.status, 403);
			const allowed = askAdminApiGate("Admin@example.com");
			assert.equal(allowed.ok, true);
			if (allowed.ok) assert.equal(allowed.email, "admin@example.com");
		} finally {
			if (previous === undefined) delete process.env.ASK_ADMIN_EMAILS;
			else process.env.ASK_ADMIN_EMAILS = previous;
		}
	});
});
