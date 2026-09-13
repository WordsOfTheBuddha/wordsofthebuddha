/**
 * Visible paragraph markers (`¶ N`) as real DOM nodes.
 *
 * CSS `::before { content }` is copied by WebKit into text/plain (the old
 * `Park.¶ 2Then` bug). Real `aria-hidden` nodes with `user-select: none` are
 * skipped by native copy and by the plain-text clipboard walker.
 *
 * Paragraph separators (`\n\n` between sibling `<p>`s) are added by the
 * discourse plain-copy handler, not by trailing `<br>` nodes in the HTML.
 */

export const PARAGRAPH_NUM_CLASS = "paragraph-num";
export const SHOW_PARAGRAPH_NUMBERS_KEY = "showParagraphNumbers";

/** Top-level report blocks that get a visible ¶ N (matches revise block ids). */
export const REPORT_PARAGRAPH_SELECTOR =
	":scope > p, :scope > blockquote, :scope > ul, :scope > ol";

export function readShowParagraphNumbers(): boolean {
	if (typeof localStorage === "undefined") return false;
	const stored = localStorage.getItem(SHOW_PARAGRAPH_NUMBERS_KEY);
	return stored === "true";
}

export function writeShowParagraphNumbers(show: boolean): void {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(SHOW_PARAGRAPH_NUMBERS_KEY, show ? "true" : "false");
}

export function paragraphNumberLabel(num: string | number): string {
	return `¶ ${num}`;
}

export function paragraphNumberMarkerHtml(num: string | number): string {
	return `<span class="${PARAGRAPH_NUM_CLASS}" aria-hidden="true" unselectable="on">${paragraphNumberLabel(num)}</span>`;
}

export function createParagraphNumberElement(
	num: string | number,
): HTMLSpanElement {
	const el = document.createElement("span");
	el.className = PARAGRAPH_NUM_CLASS;
	el.setAttribute("aria-hidden", "true");
	el.setAttribute("unselectable", "on");
	el.textContent = paragraphNumberLabel(num);
	return el;
}

/**
 * Rangy highlighter bookmarks are character offsets in the document. Marker
 * text would shift those offsets, so serialize/deserialize with them detached.
 */
/** Remove ¶ markers from a rendered report body before re-decorating. */
export function stripReportParagraphNumbers(body: ParentNode): void {
	body.querySelectorAll(`.${PARAGRAPH_NUM_CLASS}`).forEach((node) => node.remove());
	body.querySelectorAll<HTMLElement>("[data-paragraph-number]").forEach((el) => {
		delete el.dataset.paragraphNumber;
	});
}

/** Insert discourse-style `¶ N` markers on each top-level report block. */
export function decorateReportParagraphNumbers(body: ParentNode): number {
	stripReportParagraphNumbers(body);
	let num = 0;
	body.querySelectorAll<HTMLElement>(REPORT_PARAGRAPH_SELECTOR).forEach((el) => {
		num += 1;
		el.dataset.paragraphNumber = String(num);
		el.insertBefore(createParagraphNumberElement(num), el.firstChild);
	});
	return num;
}

export function withoutParagraphNumberMarkers<T>(fn: () => T): T {
	if (typeof document === "undefined") return fn();
	const markers = Array.from(
		document.querySelectorAll(`.${PARAGRAPH_NUM_CLASS}`),
	);
	const stash = markers.map((node) => ({
		parent: node.parentNode,
		next: node.nextSibling,
		node,
	}));
	for (const m of markers) m.remove();
	try {
		return fn();
	} finally {
		for (const { parent, next, node } of stash) {
			parent?.insertBefore(node, next);
		}
	}
}
