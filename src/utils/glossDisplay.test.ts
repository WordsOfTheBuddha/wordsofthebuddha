import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	capitalizeAfterOmittedVocative,
	isParagraphStartPrefix,
	isSentenceStartPrefix,
	replaceGlossMarkup,
	resolveGlossForDisplay,
	splitGlossRest,
} from "./glossDisplay";

function visible(text: string): string {
	return replaceGlossMarkup(text, (term) => term);
}

describe("isParagraphStartPrefix", () => {
	it("treats empty, quotes, and whitespace as paragraph start", () => {
		assert.equal(isParagraphStartPrefix(""), true);
		assert.equal(isParagraphStartPrefix("“"), true);
		assert.equal(isParagraphStartPrefix("'"), true);
		assert.equal(isParagraphStartPrefix("‘"), true);
		assert.equal(isParagraphStartPrefix(" "), true);
	});

	it("treats a vocative after a blank line as a new paragraph start", () => {
		assert.equal(isParagraphStartPrefix("Previous sentence.\n\n“"), true);
	});

	it("rejects mid-sentence prefixes", () => {
		assert.equal(isParagraphStartPrefix("If"), false);
		assert.equal(isParagraphStartPrefix("“If"), false);
		assert.equal(isParagraphStartPrefix("Being asked thus, "), false);
	});
});

describe("isSentenceStartPrefix", () => {
	it("treats a vocative after a period as a sentence start", () => {
		assert.equal(isSentenceStartPrefix("in hell. "), true);
		assert.equal(isSentenceStartPrefix("in hell."), true);
		assert.equal(isSentenceStartPrefix("What three? "), true);
	});

	it("treats a vocative after a period and opening quote as a sentence start", () => {
		assert.equal(isSentenceStartPrefix("in hell. “"), true);
	});

	it("rejects a vocative after a comma", () => {
		assert.equal(isSentenceStartPrefix("Being asked thus, "), false);
	});
});

describe("capitalizeAfterOmittedVocative", () => {
	it("capitalizes after an opening quote and drops leftover space", () => {
		assert.equal(
			capitalizeAfterOmittedVocative("“there are these three"),
			"“There are these three",
		);
		assert.equal(
			capitalizeAfterOmittedVocative("“ there are these three"),
			"“There are these three",
		);
	});

	it("capitalizes a bare first word and drops a leading space", () => {
		assert.equal(
			capitalizeAfterOmittedVocative(" there are these three"),
			"There are these three",
		);
	});
});

describe("splitGlossRest", () => {
	it("splits a two-part gloss as tooltip only", () => {
		assert.deepEqual(splitGlossRest("intense desire [rāga]"), {
			tooltip: "intense desire [rāga]",
			tts: "",
		});
	});

	it("splits four colons into an empty tooltip and TTS override", () => {
		assert.deepEqual(splitGlossRest("::"), { tooltip: "", tts: "" });
		assert.deepEqual(splitGlossRest("::,"), { tooltip: "", tts: "," });
		assert.deepEqual(splitGlossRest("::almsfood"), {
			tooltip: "",
			tts: "almsfood",
		});
	});
});

describe("resolveGlossForDisplay", () => {
	it("omits |bhikkhus,::::| (empty TTS)", () => {
		assert.deepEqual(resolveGlossForDisplay("bhikkhus,", "::"), {
			kind: "omit",
			text: "",
		});
	});

	it("omits |, bhikkhus,::::| (empty TTS)", () => {
		assert.deepEqual(resolveGlossForDisplay(", bhikkhus,", "::"), {
			kind: "omit",
			text: "",
		});
	});

	it("replaces |, bhikkhus,::::,| with the punctuation TTS", () => {
		assert.deepEqual(resolveGlossForDisplay(", bhikkhus,", "::,"), {
			kind: "omit",
			text: ",",
		});
	});

	it("keeps pronunciation-only four-colon glosses", () => {
		assert.deepEqual(resolveGlossForDisplay("alms food", "::almsfood"), {
			kind: "plain",
			text: "alms food",
		});
		assert.deepEqual(resolveGlossForDisplay("jhānas", "::jah-naas"), {
			kind: "plain",
			text: "jhānas",
		});
	});

	it("keeps ordinary tooltip glosses", () => {
		assert.deepEqual(
			resolveGlossForDisplay("Passion", "intense desire [rāga]"),
			{
				kind: "tooltip",
				term: "Passion",
				tooltip: "intense desire [rāga]",
			},
		);
	});
});

describe("replaceGlossMarkup (an3.68 / an3.36)", () => {
	it("strips vocatives with empty TTS in an3.68-style sentences", () => {
		assert.equal(
			visible("“If|, bhikkhus,::::| wanderers of other sects"),
			"“If wanderers of other sects",
		);
		assert.equal(
			visible("Being asked thus, |bhikkhus,::::| how would you answer"),
			"Being asked thus, how would you answer",
		);
		assert.equal(
			visible("“Then listen to this|, bhikkhus,::::| and pay close attention"),
			"“Then listen to this and pay close attention",
		);
	});

	it("keeps the comma from |, bhikkhus,::::,| in an3.36-style sentences", () => {
		assert.equal(
			visible("Here|, bhikkhus,::::,| a certain person engages"),
			"Here, a certain person engages",
		);
		assert.equal(
			visible("Then|, bhikkhus,::::,| King Yama says to him"),
			"Then, King Yama says to him",
		);
	});

	it("does not strip real tooltip terms in the same sentence", () => {
		assert.equal(
			visible(
				"Here|, bhikkhus,::::,| a certain person engages in |bodily misconduct::killing [kāyaduccarita]|",
			),
			"Here, a certain person engages in bodily misconduct",
		);
	});

	it("keeps four-colon pronunciation overrides visible", () => {
		assert.equal(
			visible("content with robes and |alms food::::almsfood| to sustain"),
			"content with robes and alms food to sustain",
		);
	});

	it("collapses the space left by a mid-sentence vocative", () => {
		assert.equal(
			visible("Just as |bhikkhus,::::| the twinkling of all the stars"),
			"Just as the twinkling of all the stars",
		);
	});

	it("capitalizes the first letter after a paragraph-start vocative (an3.36)", () => {
		assert.equal(
			visible(
				"“|Bhikkhus,::::| there are these three divine messengers. What three?",
			),
			"“There are these three divine messengers. What three?",
		);
	});

	it("capitalizes after a straight or single opening quote", () => {
		assert.equal(
			visible("\"|Bhikkhus,::::| there are these five kinds of gifts"),
			"\"There are these five kinds of gifts",
		);
		assert.equal(
			visible("'|Bhikkhus,::::| there are these five kinds of gifts"),
			"'There are these five kinds of gifts",
		);
		assert.equal(
			visible("‘|Bhikkhus,::::| there are these five kinds of gifts"),
			"‘There are these five kinds of gifts",
		);
	});

	it("capitalizes when the vocative is the first token of the paragraph", () => {
		assert.equal(
			visible("|Bhikkhus,::::| there are these three divine messengers."),
			"There are these three divine messengers.",
		);
	});

	it("capitalizes a later paragraph that starts with a vocative after a newline", () => {
		assert.equal(
			visible(
				"Here|, bhikkhus,::::,| a certain person engages.\n\n“|Bhikkhus,::::| there are these three divine messengers.",
			),
			"Here, a certain person engages.\n\n“There are these three divine messengers.",
		);
	});

	it("capitalizes the next word when the vocative starts a sentence (an3.36)", () => {
		assert.equal(
			visible(
				"in |hell::a place of intense suffering [niraya]|. |Bhikkhus,::::| then the hell wardens seize that person",
			),
			"in hell. Then the hell wardens seize that person",
		);
	});

	it("does not capitalize the next word after a mid-sentence vocative", () => {
		assert.equal(
			visible("Being asked thus, |bhikkhus,::::| how would you answer"),
			"Being asked thus, how would you answer",
		);
	});

	it("keeps punctuation-only TTS from four-colon glosses", () => {
		assert.equal(
			visible("frail|,::::;| bent like a rafter"),
			"frail; bent like a rafter",
		);
	});
});
