import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { researchEmptyComposerGated } from "./aiAskResearchUi";

describe("research home layout defaults", () => {
	it("keeps the Research composer compact until quota confirms sign-in", () => {
		assert.equal(
			researchEmptyComposerGated({
				researchPane: true,
				hasThread: false,
				quotaReady: false,
				signedIn: false,
			}),
			true,
		);
		assert.equal(
			researchEmptyComposerGated({
				researchPane: true,
				hasThread: false,
				quotaReady: true,
				signedIn: true,
			}),
			false,
		);
	});
});
