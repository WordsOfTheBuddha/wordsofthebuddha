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

	it("includes the card title when only the sutta line is selected", () => {
		const { document } = installDom(PERSON_HTML);
		const link = document.getElementById("mn94")!;
		const range = document.createRange();
		range.selectNodeContents(link);
		assert.deepEqual(plainLinesFromPersonSelection(range, document), [
			"Venerable Udena Bhikkhu",
			"MN 94 - Ghoṭamukha sutta - With Ghoṭamukha",
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
