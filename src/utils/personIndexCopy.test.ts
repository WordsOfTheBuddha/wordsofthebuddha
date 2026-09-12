import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";
import { plainLinesFromPersonSelection } from "./personIndexCopy";

function installDom(html: string): { document: Document; window: Window } {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
	const { window } = dom;
	globalThis.window = window as unknown as Window & typeof globalThis;
	globalThis.document = window.document;
	globalThis.Node = window.Node;
	globalThis.Element = window.Element;
	globalThis.Range = window.Range;
	return { document: window.document, window: window as unknown as Window };
}

const PERSON_HTML = `
<div class="person-item" data-copy-heading="Uggaha, Meṇḍaka’s grandson Lay follower">
  <h3><a>Uggaha, Meṇḍaka’s grandson</a><span class="person-class-label"> Lay follower</span></h3>
  <div class="person-discourses">
    <div data-copy-line="AN 5.33 - Uggaha sutta - With Uggaha">
      <a>AN 5.33 - Uggaha sutta - With Uggaha</a>
      <div class="popover-content popover-content--description" data-copy-line="AN 5.33 - Uggaha sutta - With Uggaha" aria-hidden="true">
        <p>Uggaha invites the Buddha for a meal.</p>
      </div>
    </div>
  </div>
</div>
<div class="person-item" data-copy-heading="Venerable Udena Bhikkhu">
  <h3><a>Venerable Udena</a><span class="person-class-label"> Bhikkhu</span></h3>
  <div class="person-discourses">
    <div data-copy-line="MN 94 - Ghoṭamukha sutta - With Ghoṭamukha">
      <a id="mn94">MN 94 - Ghoṭamukha sutta - With Ghoṭamukha</a>
      <div class="popover-content popover-content--description" data-copy-line="MN 94 - Ghoṭamukha sutta - With Ghoṭamukha" aria-hidden="true">
        <p>Venerable Udena answers the brahmin Ghoṭamukha, who doubted any principled renunciate life exists, with a sequence of similes showing how a true practitioner restrains body, speech, and mind.</p>
      </div>
    </div>
  </div>
</div>
`;

describe("plainLinesFromPersonSelection", () => {
	it("copies the visible name, class, and selected sutta line", () => {
		const { document } = installDom(PERSON_HTML);
		const heading = document.querySelectorAll(".person-item")[1]!.querySelector("h3")!;
		const link = document.getElementById("mn94")!;
		const range = document.createRange();
		range.setStart(heading, 0);
		range.setEnd(link, link.childNodes.length);
		assert.deepEqual(plainLinesFromPersonSelection(range, document), [
			"Venerable Udena Bhikkhu",
			"MN 94 - Ghoṭamukha sutta - With Ghoṭamukha",
		]);
	});

	it("does not copy a neighboring person or the hover description", () => {
		const { document } = installDom(PERSON_HTML);
		const heading = document.querySelectorAll(".person-item")[1]!.querySelector("h3")!;
		const link = document.getElementById("mn94")!;
		const range = document.createRange();
		range.setStart(heading, 0);
		range.setEnd(link, link.childNodes.length);
		const lines = plainLinesFromPersonSelection(range, document) || [];
		assert.equal(
			lines.some((line) => /Uggaha/.test(line)),
			false,
		);
		assert.equal(
			lines.some((line) => /doubted any principled/.test(line)),
			false,
		);
	});

	it("copies only the sutta line when the heading is not selected", () => {
		const { document } = installDom(PERSON_HTML);
		const link = document.getElementById("mn94")!;
		const range = document.createRange();
		range.selectNodeContents(link);
		assert.deepEqual(plainLinesFromPersonSelection(range, document), [
			"MN 94 - Ghoṭamukha sutta - With Ghoṭamukha",
		]);
	});

	it("does not copy collapsed extra discourses or the previous card", () => {
		const { document } = installDom(`
<div class="person-item" data-copy-heading="Wanderer Jambukhādaka Wanderer">
  <h3><a>Wanderer Jambukhādaka</a><span class="person-class-label"> Wanderer</span></h3>
  <div class="person-discourses">
    <div data-copy-line="SN 38.1 - Nibbānapañhā sutta - A Question On Nibbāna">
      <a>SN 38.1 - Nibbānapañhā sutta - A Question On Nibbāna</a>
    </div>
    <div class="person-discourse-extra hidden" data-copy-line="SN 38.16 - Dukkarapañhā sutta - Questions on What is Difficult to Do">
      <a>SN 38.16 - Dukkarapañhā sutta - Questions on What is Difficult to Do</a>
    </div>
  </div>
</div>
<div class="person-item" data-copy-heading="Deity Jantu Deities & Gods">
  <h3><a>Deity Jantu</a><span class="person-class-label"> Deities & Gods</span></h3>
  <div class="person-discourses">
    <div data-copy-line="SN 2.25 - Jantu sutta - With Jantu">
      <a id="sn225">SN 2.25 - Jantu sutta - With Jantu</a>
    </div>
  </div>
</div>
`);
		const link = document.getElementById("sn225")!;
		const range = document.createRange();
		range.selectNodeContents(link);
		assert.deepEqual(plainLinesFromPersonSelection(range, document), [
			"SN 2.25 - Jantu sutta - With Jantu",
		]);
	});

	it("copies expanded extra discourses when they are selected", () => {
		const { document } = installDom(`
<div class="person-item" data-copy-heading="Layman Isidatta Lay follower">
  <h3><a>Layman Isidatta</a><span class="person-class-label"> Lay follower</span></h3>
  <div class="person-discourses is-expanded">
    <div data-copy-line="AN 6.44 - Migasālā sutta - Migasālā">
      <a>AN 6.44 - Migasālā sutta - Migasālā</a>
    </div>
    <div class="person-discourse-extra" data-copy-line="SN 55.6 - Thapati sutta - The Chamberlains">
      <a id="sn556">SN 55.6 - Thapati sutta - The Chamberlains</a>
    </div>
  </div>
</div>
`);
		const link = document.getElementById("sn556")!;
		const range = document.createRange();
		range.selectNodeContents(link);
		assert.deepEqual(plainLinesFromPersonSelection(range, document), [
			"SN 55.6 - Thapati sutta - The Chamberlains",
		]);
	});

	it("copies the full card title from the name link", () => {
		const { document } = installDom(PERSON_HTML);
		const nameLink = document
			.querySelectorAll(".person-item")[1]!
			.querySelector("h3 a")!;
		const range = document.createRange();
		range.selectNodeContents(nameLink);
		assert.deepEqual(plainLinesFromPersonSelection(range, document), [
			"Venerable Udena Bhikkhu",
		]);
	});
});
