/**
 * Plain copy for /person: only the selected heading and discourse lines,
 * never hover-description popovers or neighboring cards.
 */

function rangeIntersectsNode(range: Range, node: Node): boolean {
	try {
		const nodeRange = document.createRange();
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent || "";
			if (!text.length) return false;
			nodeRange.selectNodeContents(node);
		} else {
			nodeRange.selectNodeContents(node);
		}
		return (
			range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
			range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
		);
	} catch {
		return false;
	}
}

function headingLine(item: Element): string {
	const fromAttr = item.getAttribute("data-copy-heading")?.trim() || "";
	if (fromAttr) return fromAttr;
	const heading = item.querySelector("h3");
	return (heading?.textContent || "").replace(/\s+/g, " ").trim();
}

function isCopyableDiscourseRow(row: Element): boolean {
	if (row.classList.contains("hidden")) return false;
	if (
		row.classList.contains("person-discourse-extra") &&
		!row.closest(".person-discourses")?.classList.contains("is-expanded")
	) {
		return false;
	}
	return true;
}

function selectedDiscourseLines(item: Element, range: Range): string[] {
	return [...item.querySelectorAll(".person-discourses > [data-copy-line]")]
		.filter(
			(row) =>
				isCopyableDiscourseRow(row) && rangeIntersectsNode(range, row),
		)
		.map((row) => row.getAttribute("data-copy-line") || "")
		.filter(Boolean);
}

function personItemIntersects(item: Element, range: Range): boolean {
	const heading = item.querySelector("h3");
	if (heading && rangeIntersectsNode(range, heading)) return true;
	return selectedDiscourseLines(item, range).length > 0;
}

/** Lines to put on the clipboard for a selection on the person index, or null. */
export function plainLinesFromPersonSelection(
	range: Range,
	root: ParentNode = document,
): string[] | null {
	const ancestor = range.commonAncestorContainer;
	const ancestorEl =
		ancestor instanceof Element ? ancestor : ancestor.parentElement;
	if (ancestorEl?.closest(".popover-content")) {
		const popover = ancestorEl.closest(".popover-content");
		const popoverLine = popover?.getAttribute("data-copy-line") || "";
		return popoverLine ? [popoverLine] : null;
	}

	const inside = ancestorEl?.closest(".person-item");
	const items = inside
		? [inside]
		: [...root.querySelectorAll(".person-item")].filter((item) =>
				personItemIntersects(item, range),
			);
	if (items.length === 0) return null;

	const lines: string[] = [];
	for (const item of items) {
		const heading = item.querySelector("h3");
		const headingSelected = Boolean(
			heading && rangeIntersectsNode(range, heading),
		);
		const selected = selectedDiscourseLines(item, range);
		if (!headingSelected && selected.length === 0) continue;
		if (headingSelected) {
			const name = headingLine(item);
			if (name) lines.push(name);
		}
		lines.push(...selected);
	}
	return lines.length > 0 ? lines : null;
}

/** Layout's classic copy script calls this, then writes clipboardData itself. */
export function preparePersonIndexCopy(): string | null {
	if (typeof window === "undefined") return null;
	const selection = window.getSelection();
	if (!selection?.rangeCount || selection.isCollapsed) return null;
	const lines = plainLinesFromPersonSelection(selection.getRangeAt(0));
	return lines ? lines.join("\n") : null;
}

export function writePersonIndexClipboard(
	event: ClipboardEvent,
	lines: string[],
): void {
	const text = lines.join("\n");
	event.preventDefault();
	event.stopImmediatePropagation();
	if (event.clipboardData) {
		try {
			event.clipboardData.setData("text/plain", text);
		} catch {
			/* WebKit may throw on clipboardData writes */
		}
	}
	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		void navigator.clipboard.writeText(text).catch(() => {});
	}
}
