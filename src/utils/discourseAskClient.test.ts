import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DASK_MANUAL_RETRIES,
	daskPriorErrorCount,
} from "./discourseAskClient";

describe("daskPriorErrorCount", () => {
	it("caps manual retries at two per question", () => {
		assert.equal(DASK_MANUAL_RETRIES, 2);
		const failed = (question: string) => ({ question, error: "Timed out." });
		const ok = (question: string) => ({ question });
		assert.equal(daskPriorErrorCount([failed("a")], 0), 0);
		assert.equal(
			daskPriorErrorCount([failed("a"), failed("a")], 1),
			1,
		);
		assert.equal(
			daskPriorErrorCount([failed("a"), failed("a"), failed("a")], 2),
			2,
		);
	});

	it("resets on success or a different question", () => {
		const failed = (question: string) => ({ question, error: "Timed out." });
		assert.equal(
			daskPriorErrorCount(
				[failed("a"), { question: "a" }, failed("a")],
				2,
			),
			0,
		);
		assert.equal(daskPriorErrorCount([failed("a"), failed("b")], 1), 0);
		assert.equal(daskPriorErrorCount([], 0), 0);
	});

	it("matches case-insensitively like history keys", () => {
		const failed = (question: string) => ({ question, error: "Timed out." });
		assert.equal(daskPriorErrorCount([failed("What is Sati?")], 0), 0);
		assert.equal(
			daskPriorErrorCount(
				[failed("What is sati?"), failed("WHAT IS SATI?")],
				1,
			),
			1,
		);
	});
});
