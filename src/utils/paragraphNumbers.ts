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
