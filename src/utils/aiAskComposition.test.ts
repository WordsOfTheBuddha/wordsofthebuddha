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
	compositionMarkerRegion,
	normalizeCompositionCaret,
	compositionMarkerArrowAdjust,
	parseResearchCompositionDraft,
	serializeResearchCompositionDraft,
	MAX_RESEARCH_CONTEXT_IMAGES,
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
		const inside = normalizeCompositionCaret(marked, region!.start + 2, region!.start + 2);
		assert.equal(inside.start, region!.end);
		assert.equal(
			compositionMarkerArrowAdjust(marked, "ArrowLeft", region!.end, region!.end)?.start,
			region!.start,
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
});

describe("plan limits", () => {
	it("raises Ask writer tokens to 4096", () => {
		assert.equal(ASK_WRITER_MAX_TOKENS, 4096);
	});

	it("keeps revise instruction cap at 12000", () => {
		assert.equal(RESEARCH_REVISE_INSTRUCTION_MAX, 12_000);
	});
});
