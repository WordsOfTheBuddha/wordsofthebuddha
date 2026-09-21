import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	deleteResearchAttachments,
	loadResearchAttachments,
	mergeStoredResearchAttachments,
	pruneResearchAttachments,
	readResearchAttachmentsMemoryForTests,
	researchAttachmentsByteLength,
	resetResearchAttachmentsMemoryForTests,
	saveResearchAttachments,
	toStoredResearchAttachments,
} from "./researchAttachmentStore";

const IMAGE_A = { mime: "image/png", data: "aGVsbG8=" };
const IMAGE_B = { mime: "image/jpeg", data: "d29ybGQ=" };

describe("researchAttachmentStore", () => {
	it("normalizes a record with derived preview, label, and counts", () => {
		const stored = toStoredResearchAttachments({
			jobId: " job-1 ",
			contextFull: "line one\nline two\nline three",
			images: [IMAGE_A, IMAGE_B],
		});
		assert.ok(stored);
		assert.equal(stored?.jobId, "job-1");
		assert.equal(stored?.images.length, 2);
		assert.equal(stored?.imageCount, 2);
		assert.match(stored?.contextAttachmentLabel || "", /3 lines/);
		assert.ok((stored?.contextPreview || "").length > 0);
		assert.equal(stored?.contextWordCount, 6);
	});

	it("rejects empty records and blank job ids", () => {
		assert.equal(
			toStoredResearchAttachments({ jobId: "job-x", contextFull: "  " }),
			null,
		);
		assert.equal(
			toStoredResearchAttachments({ jobId: "   ", images: [IMAGE_A] }),
			null,
		);
	});

	it("merges without letting empty incoming wipe stored bytes", () => {
		const stored = toStoredResearchAttachments({
			jobId: "job-2",
			contextFull: "original notes",
			images: [IMAGE_A],
		});
		const incoming = toStoredResearchAttachments({
			jobId: "job-2",
			contextPreview: "original notes",
			contextAttachmentLabel: "Notes (2 words)",
			imageCount: 1,
		});
		assert.ok(stored && incoming);
		const merged = mergeStoredResearchAttachments(stored, incoming!);
		assert.equal(merged.contextFull, "original notes");
		assert.equal(merged.images.length, 1);
		assert.equal(merged.contextAttachmentLabel, "Notes (2 words)");
	});

	it("prefers the longer context and the richer image set", () => {
		const stored = toStoredResearchAttachments({
			jobId: "job-3",
			contextFull: "short",
			images: [IMAGE_A],
		});
		const incoming = toStoredResearchAttachments({
			jobId: "job-3",
			contextFull: "a much longer set of notes",
			images: [IMAGE_A, IMAGE_B],
		});
		const merged = mergeStoredResearchAttachments(stored, incoming!);
		assert.equal(merged.contextFull, "a much longer set of notes");
		assert.equal(merged.images.length, 2);
	});

	it("round-trips through save and load", async () => {
		resetResearchAttachmentsMemoryForTests();
		await saveResearchAttachments({
			jobId: "job-4",
			contextFull: "line one\nline two",
			images: [IMAGE_A],
		});
		const loaded = await loadResearchAttachments("job-4");
		assert.equal(loaded?.jobId, "job-4");
		assert.match(loaded?.contextFull || "", /line one/);
		assert.equal(loaded?.images.length, 1);
		await deleteResearchAttachments("job-4");
		assert.equal(await loadResearchAttachments("job-4"), null);
	});

	it("keeps stored bytes when a metadata-only save lands later", async () => {
		resetResearchAttachmentsMemoryForTests();
		await saveResearchAttachments({
			jobId: "job-5",
			contextFull: "full notes",
			images: [IMAGE_A],
		});
		await saveResearchAttachments({
			jobId: "job-5",
			contextPreview: "full notes",
			imageCount: 1,
		});
		const loaded = await loadResearchAttachments("job-5");
		assert.equal(loaded?.contextFull, "full notes");
		assert.equal(loaded?.images.length, 1);
	});

	it("measures payload bytes for pruning budgets", () => {
		const stored = toStoredResearchAttachments({
			jobId: "job-6",
			contextFull: "hello",
			images: [IMAGE_A],
		});
		assert.ok((researchAttachmentsByteLength(stored!) || 0) > 5);
	});

	it("prunes oldest records past the entry budget but keeps history jobs", async () => {
		resetResearchAttachmentsMemoryForTests();
		for (let i = 0; i < 11; i++) {
			await saveResearchAttachments(
				{
					jobId: `job-prune-${i}`,
					contextFull: `notes ${i}`,
					updatedAt: 1_000 + i,
				},
				{ keepJobIds: ["job-prune-0"] },
			);
		}
		await pruneResearchAttachments(["job-prune-0"]);
		assert.ok(readResearchAttachmentsMemoryForTests("job-prune-0"));
		assert.ok(readResearchAttachmentsMemoryForTests("job-prune-10"));
		assert.equal(readResearchAttachmentsMemoryForTests("job-prune-1"), null);
		resetResearchAttachmentsMemoryForTests();
	});
});
