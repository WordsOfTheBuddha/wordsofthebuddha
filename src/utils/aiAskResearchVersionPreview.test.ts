import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clearResearchPreviewVersion,
	readResearchPreviewVersion,
	RESEARCH_PREVIEW_VERSION_KEY,
	shareUrlWithVersion,
	writeResearchPreviewVersion,
} from "./aiAskResearchVersionPreview";

describe("aiAskResearchVersionPreview", () => {
	it("round-trips a job preview ref", () => {
		const storage = {
			data: new Map<string, string>(),
			setItem(k: string, v: string) {
				this.data.set(k, v);
			},
			getItem(k: string) {
				return this.data.get(k) ?? null;
			},
			removeItem(k: string) {
				this.data.delete(k);
			},
		} as Storage;
		writeResearchPreviewVersion({ jobId: "job-1", n: 13 }, storage);
		assert.deepEqual(readResearchPreviewVersion(storage), {
			jobId: "job-1",
			n: 13,
		});
		clearResearchPreviewVersion(storage);
		assert.equal(readResearchPreviewVersion(storage), null);
		assert.equal(storage.getItem(RESEARCH_PREVIEW_VERSION_KEY), null);
	});

	it("appends version to a share path", () => {
		assert.equal(
			shareUrlWithVersion("/research/mindfulness", 13),
			"/research/mindfulness?version=13",
		);
		assert.equal(shareUrlWithVersion("/research/mindfulness", null), "/research/mindfulness");
	});
});
