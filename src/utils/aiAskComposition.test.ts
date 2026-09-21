import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clipResearchContext,
	COMPOSITION_CHIP_PAD_CHAR,
	COMPOSITION_CONTEXT_CHIP_MARKER,
	countContextWords,
	formatAttachedMaterialBlock,
	formatContextChipLabel,
	guessImageMimeFromName,
	hasResearchCompositionContent,
	isCompositionImageFile,
	MAX_RESEARCH_CONTEXT_CHARS,
	MAX_RESEARCH_CONTEXT_WORDS,
	parseResearchCompositionPayload,
	RESEARCH_CONTEXT_AUTO_ATTACH_CHARS,
	shouldAttachPasteAsCompositionContext,
	shouldAutoAttachPasteText,
	compositionChipPadCount,
	compositionLineStart,
	compositionContextInsertPosition,
	insertCompositionContextClip,
	mergeCompositionContexts,
	compositionMarkerRegions,
	stripCompositionChipMarkers,
	sanitizeResearchContextImages,
	compositionCollapsedDeleteChipIndex,
	compositionEditDeleteSelection,
	compositionMarkerRegion,
	normalizeCompositionCaret,
	compositionMarkerArrowAdjust,
	parseResearchCompositionDraft,
	serializeResearchCompositionDraft,
	MAX_RESEARCH_CONTEXT_IMAGES,
	MAX_RESEARCH_CONTEXT_IMAGES_TOTAL_BYTES,
	RESEARCH_COMPOSITION_CONTEXT_TOO_LARGE_MSG,
	RESEARCH_COMPOSITION_CONTEXT_TRIM_MSG,
	RESEARCH_COMPOSITION_IMAGE_TOO_LARGE_MSG,
	RESEARCH_COMPOSITION_IMAGES_TOTAL_FULL_MSG,
	RESEARCH_COMPOSITION_MAX_IMAGES_MSG,
	RESEARCH_COMPOSITION_UNSUPPORTED_IMAGE_MSG,
	compositionImagesTotalBytes,
	contextWasClipped,
	formatCompositionImagesPartialAdd,
	researchContextImageByteLength,
	resolveResearchSubmitAttachments,
	wouldExceedCompositionImageTotalBytes,
} from "./aiAskComposition";
import { RESEARCH_REVISE_INSTRUCTION_MAX } from "./aiAskResearchRevise";
import { ASK_WRITER_MAX_TOKENS } from "./openrouter";

describe("aiAskComposition", () => {
	it("clips context at char and word ceilings", () => {
		const long = "word ".repeat(MAX_RESEARCH_CONTEXT_WORDS + 100);
		const clipped = clipResearchContext(long);
		assert.ok(clipped.length <= MAX_RESEARCH_CONTEXT_CHARS);
		assert.equal(countContextWords(clipped), MAX_RESEARCH_CONTEXT_WORDS);
	});

	it("formats clipboard chip labels", () => {
		assert.match(
			formatContextChipLabel("line one\nline two\nline three"),
			/Clipboard \(3 lines\)/,
		);
		assert.match(formatContextChipLabel("one two three"), /Notes \(3 words\)/);
	});

	it("parses research composition payloads", () => {
		const parsed = parseResearchCompositionPayload({
			question: "  What is satipaṭṭhāna?  ",
			context: "notes\n\nhere",
			images: [
				{
					mime: "image/jpeg",
					data: "aGVsbG8=",
				},
			],
		});
		assert.equal(parsed.question, "What is satipaṭṭhāna?");
		assert.equal(parsed.context, "notes\n\nhere");
		assert.equal(parsed.images.length, 1);
	});

	it("rejects invalid images", () => {
		assert.equal(
			sanitizeResearchContextImages([
				{ mime: "text/plain", data: "aGVsbG8=" },
			]).length,
			0,
		);
	});

	it("requires question, context, or images", () => {
		assert.equal(hasResearchCompositionContent({ question: "", context: "" }), false);
		assert.equal(
			hasResearchCompositionContent({ question: "", context: "notes" }),
			true,
		);
	});

	it("documents overflow threshold constant", () => {
		assert.equal(RESEARCH_CONTEXT_AUTO_ATTACH_CHARS, 500);
	});

	it("auto-attaches long paste text", () => {
		assert.equal(shouldAutoAttachPasteText("x".repeat(501)), true);
		assert.equal(shouldAutoAttachPasteText("short"), false);
	});

	it("keeps short paste in the composer when a chip already exists", () => {
		assert.equal(
			shouldAttachPasteAsCompositionContext("short", {
				composerTextLength: 10,
				selectionLength: 0,
			}),
			false,
		);
	});

	it("adds multiple context clips without merging chip labels", () => {
		const clips = insertCompositionContextClip([], "line one\nline two", 0);
		const next = insertCompositionContextClip(clips, "alpha beta", 1);
		assert.equal(next.length, 2);
		assert.match(formatContextChipLabel(next[0]), /2 lines/);
		assert.match(formatContextChipLabel(next[1]), /2 words/);
		assert.match(mergeCompositionContexts(next), /line one/);
		assert.match(mergeCompositionContexts(next), /alpha beta/);
	});

	it("resolves explicit re-send attachments explicit-first", () => {
		const override = { mime: "image/png", data: "aGVsbG8=" };
		const global = { mime: "image/jpeg", data: "d29ybGQ=" };
		const resolved = resolveResearchSubmitAttachments({
			globalImages: [global],
			globalContexts: ["global notes here and more words"],
			overrideImages: [override],
			overrideContext: "explicit notes",
		});
		assert.equal(resolved.images.length, 2);
		assert.deepEqual(resolved.images[0], override);
		assert.match(resolved.context, /explicit notes/);
		assert.match(resolved.context, /global notes/);
		assert.ok(
			resolved.context.indexOf("explicit notes") <
				resolved.context.indexOf("global notes"),
		);
	});

	it("resolves empty overrides to the live composer state", () => {
		const global = { mime: "image/jpeg", data: "d29ybGQ=" };
		const resolved = resolveResearchSubmitAttachments({
			globalImages: [global],
			globalContexts: ["  "],
			overrideContext: "   ",
		});
		assert.equal(resolved.images.length, 1);
		assert.equal(resolved.context, "");
		assert.deepEqual(resolved.contexts, []);
	});

	it("caps resolved images at the composition limit", () => {
		const make = (data: string) => ({ mime: "image/png", data });
		const resolved = resolveResearchSubmitAttachments({
			globalImages: [make("Z2xvYmFs")],
			overrideImages: [
				make("bzE="),
				make("bzI="),
				make("bzM="),
				make("bzQ="),
				make("bzU="),
			],
		});
		assert.equal(resolved.images.length, MAX_RESEARCH_CONTEXT_IMAGES);
		assert.equal(resolved.images[0]?.data, "bzE=");
	});

	it("supports multiple inline chip markers", () => {
		const marked = `a${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(2)}b${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(3)}c`;
		assert.equal(compositionMarkerRegions(marked).length, 2);
	});

	it("finds the start of the current composer line", () => {
		assert.equal(compositionLineStart("alpha\nbeta", 6), 6);
		assert.equal(compositionLineStart("alpha\nbeta", 3), 0);
	});

	it("never shrinks an existing chip pad estimate", () => {
		assert.equal(compositionChipPadCount(120, 10, 18), 18);
		assert.equal(compositionChipPadCount(120, 10, 0), 13);
	});

	it("inserts the next chip after an existing chip region", () => {
		const marked = `${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(4)}`;
		const inside = compositionContextInsertPosition(marked, 2);
		assert.equal(inside.at, 5);
		assert.equal(inside.insertIndex, 1);
	});

	it("strips invisible context chip markers from questions", () => {
		const marked = `before${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(3)}after`;
		assert.equal(stripCompositionChipMarkers(marked), "beforeafter");
	});

	it("detects image files without mime types", () => {
		assert.equal(
			isCompositionImageFile({ name: "shot.png", type: "" } as File),
			true,
		);
		assert.equal(guessImageMimeFromName("shot.png"), "image/png");
	});

	it("includes attached material in prompt block", () => {
		assert.match(
			formatAttachedMaterialBlock("Reader notes here"),
			/Attached material \(3 words\)/,
		);
	});

	it("keeps the caret out of the inline context chip marker", () => {
		const marked = `before${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(4)}after`;
		const region = compositionMarkerRegion(marked);
		assert.ok(region);
		const firstPad = normalizeCompositionCaret(
			marked,
			region!.start + 1,
			region!.start + 1,
		);
		assert.equal(firstPad.start, region!.start);
		const deeperPad = normalizeCompositionCaret(
			marked,
			region!.start + 3,
			region!.start + 3,
		);
		assert.equal(deeperPad.start, region!.end);
		assert.equal(
			compositionMarkerArrowAdjust(marked, "ArrowLeft", region!.end, region!.end)?.start,
			region!.start,
		);
		const inside = compositionMarkerArrowAdjust(
			marked,
			"ArrowLeft",
			region!.start + 2,
			region!.start + 2,
		);
		assert.equal(inside?.start, region!.start);
	});

	it("skips adjacent chips when moving the caret with arrow keys", () => {
		const chip = `${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(2)}`;
		const marked = `${chip}${chip}tail`;
		const regions = compositionMarkerRegions(marked);
		assert.equal(regions.length, 2);
		const second = regions[1];
		const leftFromBoundary = compositionMarkerArrowAdjust(
			marked,
			"ArrowLeft",
			second.start,
			second.start,
		);
		assert.equal(leftFromBoundary?.start, regions[0].start);
		const rightFromBoundary = compositionMarkerArrowAdjust(
			marked,
			"ArrowRight",
			regions[0].end,
			regions[0].end,
		);
		assert.equal(rightFromBoundary?.start, second.end);
	});

	it("deletes chips intersecting a selection", () => {
		const chip = `${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(3)}`;
		const marked = `${chip}hello${chip}world`;
		const first = compositionMarkerRegions(marked)[0];
		const second = compositionMarkerRegions(marked)[1];
		const all = compositionEditDeleteSelection(marked, 0, marked.length);
		assert.equal(all?.value, "");
		assert.equal(all?.caret, 0);
		assert.deepEqual(all?.removedChipIndices, [0, 1]);
		const partial = compositionEditDeleteSelection(
			marked,
			first.start,
			first.end + 2,
		);
		assert.equal(partial?.value, "llo" + chip + "world");
		assert.deepEqual(partial?.removedChipIndices, [0]);
		const between = compositionEditDeleteSelection(
			marked,
			first.end,
			second.start,
		);
		assert.equal(between, null);
	});

	it("maps collapsed delete keys to chip indices", () => {
		const chip = `${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(2)}`;
		const marked = `${chip}after`;
		const region = compositionMarkerRegion(marked);
		assert.ok(region);
		assert.equal(
			compositionCollapsedDeleteChipIndex(marked, region!.end, "backward"),
			0,
		);
		assert.equal(
			compositionCollapsedDeleteChipIndex(marked, region!.start, "forward"),
			0,
		);
	});

	it("round-trips a research composition draft without pasted context", () => {
		const raw = serializeResearchCompositionDraft({
			question: "What is satipaṭṭhāna?",
			context: "notes\n\nhere",
			images: [{ mime: "image/jpeg", data: "aGVsbG8=" }],
		});
		const parsed = parseResearchCompositionDraft(raw);
		assert.equal(parsed?.question, "What is satipaṭṭhāna?");
		assert.equal(parsed?.context, "");
		assert.equal(parsed?.images.length, 1);
	});

	it("strips invisible chip markers from restored questions", () => {
		const marked = `before${COMPOSITION_CONTEXT_CHIP_MARKER}${COMPOSITION_CHIP_PAD_CHAR.repeat(2)}after`;
		const parsed = parseResearchCompositionDraft(
			JSON.stringify({ question: marked, context: "notes", images: [] }),
		);
		assert.equal(parsed?.question, "beforeafter");
		assert.equal(parsed?.context, "");
	});

	it("caps draft images at four", () => {
		const images = Array.from({ length: 6 }, () => ({
			mime: "image/jpeg",
			data: "aGVsbG8=",
		}));
		const parsed = parseResearchCompositionDraft(
			serializeResearchCompositionDraft({
				question: "",
				context: "notes",
				images,
			}),
		);
		assert.equal(parsed?.images.length, MAX_RESEARCH_CONTEXT_IMAGES);
	});

	it("detects when pasted context was clipped", () => {
		const long = "word ".repeat(MAX_RESEARCH_CONTEXT_WORDS + 10);
		const clipped = clipResearchContext(long);
		assert.equal(contextWasClipped(long, clipped), true);
		assert.equal(contextWasClipped("short note", "short note"), false);
		assert.equal(contextWasClipped("short note", clipResearchContext("short note")), false);
	});

	it("exports attachment status messages", () => {
		assert.equal(RESEARCH_COMPOSITION_MAX_IMAGES_MSG, "Max 4 images at a time.");
		assert.match(
			RESEARCH_COMPOSITION_UNSUPPORTED_IMAGE_MSG,
			/JPEG, PNG, WebP, and GIF/,
		);
		assert.equal(
			RESEARCH_COMPOSITION_IMAGE_TOO_LARGE_MSG,
			"That image is too large to attach.",
		);
		assert.equal(
			RESEARCH_COMPOSITION_IMAGES_TOTAL_FULL_MSG,
			"Total attached image size is full.",
		);
		assert.match(RESEARCH_COMPOSITION_CONTEXT_TRIM_MSG, /50,000 words/);
		assert.equal(
			RESEARCH_COMPOSITION_CONTEXT_TOO_LARGE_MSG,
			"That paste is too large to attach as notes.",
		);
	});

	it("formats partial image add notices", () => {
		assert.equal(
			formatCompositionImagesPartialAdd(2),
			"Added 2 images. Max 4 images at a time.",
		);
		assert.equal(
			formatCompositionImagesPartialAdd(1),
			"Added 1 image. Max 4 images at a time.",
		);
	});

	it("tracks total attached image bytes", () => {
		const image = { mime: "image/jpeg", data: "aGVsbG8=" };
		assert.equal(researchContextImageByteLength(image), 5);
		assert.equal(compositionImagesTotalBytes([image, image]), 10);
		assert.equal(
			wouldExceedCompositionImageTotalBytes(
				[{ mime: "image/jpeg", data: "a".repeat(2_666_664) }],
				500_000,
			),
			true,
		);
		assert.equal(
			wouldExceedCompositionImageTotalBytes([], MAX_RESEARCH_CONTEXT_IMAGES_TOTAL_BYTES),
			false,
		);
	});
});

describe("plan limits", () => {
	it("raises Ask writer tokens to 4096", () => {
		assert.equal(ASK_WRITER_MAX_TOKENS, 4096);
	});

	it("keeps revise instruction cap at 12000", () => {
		assert.equal(RESEARCH_REVISE_INSTRUCTION_MAX, 12_000);
	});
});
