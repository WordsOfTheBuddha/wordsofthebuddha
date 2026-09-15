import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	clipResearchContext,
	countContextWords,
	formatAttachedMaterialBlock,
	formatContextChipLabel,
	hasResearchCompositionContent,
	MAX_RESEARCH_CONTEXT_CHARS,
	MAX_RESEARCH_CONTEXT_WORDS,
	parseResearchCompositionPayload,
	RESEARCH_CONTEXT_AUTO_ATTACH_CHARS,
	sanitizeResearchContextImages,
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

	it("auto-attach threshold is 500 chars", () => {
		assert.equal(RESEARCH_CONTEXT_AUTO_ATTACH_CHARS, 500);
	});

	it("includes attached material in prompt block", () => {
		assert.match(
			formatAttachedMaterialBlock("Reader notes here"),
			/Attached material \(3 words\)/,
		);
	});
});

describe("plan limits", () => {
	it("raises Ask writer tokens to 4096", () => {
		assert.equal(ASK_WRITER_MAX_TOKENS, 4096);
	});

	it("keeps revise instruction cap at 2000", () => {
		assert.equal(RESEARCH_REVISE_INSTRUCTION_MAX, 2000);
	});
});
