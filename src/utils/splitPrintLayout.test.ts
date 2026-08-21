import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import {
	SPLIT_PRINT_FULL_CLASS,
	SPLIT_PRINT_PAIR_CLASS,
	pairSplitWrapperForPrint,
} from "./splitPrintLayout";

function wrapperFrom(html: string): HTMLElement {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
	const el = dom.window.document.querySelector(".split-wrapper");
	assert.ok(el instanceof dom.window.HTMLElement);
	return el;
}

describe("pairSplitWrapperForPrint", () => {
	it("rewrites two tall columns into EN/Pāli pair rows", () => {
		const wrapper = wrapperFrom(`
			<div class="split-wrapper">
				<article id="panel1">
					<p class="english-paragraph" data-pair-id="0">Hello</p>
					<p class="english-paragraph" data-pair-id="1">World</p>
				</article>
				<article id="panel2">
					<p class="pali-paragraph" data-pair-id="0">Namo</p>
					<p class="pali-paragraph" data-pair-id="1">Loka</p>
				</article>
			</div>
		`);

		assert.equal(pairSplitWrapperForPrint(wrapper), true);
		assert.equal(wrapper.querySelector("#panel1"), null);
		assert.equal(wrapper.querySelector("#panel2"), null);

		const rows = [...wrapper.querySelectorAll(`.${SPLIT_PRINT_PAIR_CLASS}`)];
		assert.equal(rows.length, 2);
		assert.match(rows[0]?.textContent ?? "", /Hello/);
		assert.match(rows[0]?.textContent ?? "", /Namo/);
		assert.match(rows[1]?.textContent ?? "", /World/);
		assert.match(rows[1]?.textContent ?? "", /Loka/);
		assert.ok(
			rows[0]?.querySelector(".english-paragraph") &&
				rows[0]?.querySelector(".pali-paragraph"),
			"each row holds English and Pāli cells",
		);
		assert.doesNotMatch(
			wrapper.textContent ?? "",
			/Hello[\s\S]*World[\s\S]*Namo/,
			"must not print all English then all Pāli",
		);
		assert.equal(wrapper.style.display, "block");
		assert.equal(getComputedStyleLike(rows[0]!), "grid");
	});

	it("keeps English-only headings as full-width rows", () => {
		const wrapper = wrapperFrom(`
			<div class="split-wrapper">
				<article id="panel1">
					<h2>A heading</h2>
					<p class="english-paragraph" data-pair-id="0">Body</p>
				</article>
				<article id="panel2">
					<p class="pali-paragraph" data-pair-id="0">Kāya</p>
				</article>
			</div>
		`);

		pairSplitWrapperForPrint(wrapper);
		const full = wrapper.querySelector(`.${SPLIT_PRINT_FULL_CLASS}`);
		assert.ok(full);
		assert.match(full.textContent ?? "", /A heading/);
		const pair = wrapper.querySelector(`.${SPLIT_PRINT_PAIR_CLASS}`);
		assert.match(pair?.textContent ?? "", /Body/);
		assert.match(pair?.textContent ?? "", /Kāya/);
	});

	it("is idempotent once pair rows exist", () => {
		const wrapper = wrapperFrom(`
			<div class="split-wrapper">
				<article id="panel1">
					<p class="english-paragraph" data-pair-id="0">Hello</p>
				</article>
				<article id="panel2">
					<p class="pali-paragraph" data-pair-id="0">Namo</p>
				</article>
			</div>
		`);
		assert.equal(pairSplitWrapperForPrint(wrapper), true);
		const html = wrapper.innerHTML;
		assert.equal(pairSplitWrapperForPrint(wrapper), true);
		assert.equal(wrapper.innerHTML, html);
	});
});

function getComputedStyleLike(el: Element): string {
	return (el as HTMLElement).style.display;
}
