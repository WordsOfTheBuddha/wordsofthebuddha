import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { APIContext } from "astro";
import { researchApiContextWithParams } from "./researchApiDispatch";

describe("researchApiContextWithParams", () => {
	it("does not enumerate lazy context getters such as session", () => {
		let sessionReads = 0;
		const base: Record<string, unknown> = {
			url: new URL("https://example.com/api/ai/research/j1"),
			params: {},
			locals: { marker: "kept" },
		};
		Object.defineProperty(base, "session", {
			enumerable: true,
			configurable: true,
			get() {
				sessionReads += 1;
				return undefined;
			},
		});

		const view = researchApiContextWithParams(
			base as unknown as APIContext,
			{ id: "j1" },
		);

		assert.equal(sessionReads, 0);
		assert.equal(view.params.id, "j1");
		assert.equal(view.url.pathname, "/api/ai/research/j1");
		assert.deepEqual(view.locals, { marker: "kept" });
	});

	it("keeps the original context on the prototype chain", () => {
		const base = { params: { id: "old" } };
		const view = researchApiContextWithParams(base as unknown as APIContext, {
			id: "new",
		});
		assert.equal(Object.getPrototypeOf(view), base);
		assert.equal(view.params.id, "new");
		assert.equal((base as { params: { id: string } }).params.id, "old");
	});
});