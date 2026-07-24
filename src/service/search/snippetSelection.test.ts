import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickContentSnippet } from "./search";

describe("pickContentSnippet", () => {
	const pali =
		'etaṁ <mark class="bg-yellow-100">santaṁ</mark> etaṁ <mark class="bg-yellow-100">paṇītaṁ</mark>';
	const english =
		'cessation, <mark class="bg-yellow-100">Nibbāna</mark>.';

	it("prefers Pali when it highlights more terms", () => {
		assert.equal(pickContentSnippet(pali, english, false), pali);
	});

	it("prefers English when it highlights more terms", () => {
		const sparsePali = 'etaṁ <mark class="bg-yellow-100">santaṁ</mark>';
		const richEnglish =
			'<mark>a</mark> <mark>b</mark> <mark>c</mark>';
		assert.equal(pickContentSnippet(sparsePali, richEnglish, false), richEnglish);
	});

	it("breaks ties toward Pali when query is pali-only", () => {
		const oneEachPali = 'etaṁ <mark class="bg-yellow-100">santaṁ</mark>';
		const oneEachEnglish = '<mark class="bg-yellow-100">Nibbāna</mark>.';
		assert.equal(
			pickContentSnippet(oneEachPali, oneEachEnglish, true),
			oneEachPali,
		);
	});
});
