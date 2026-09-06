/**
 * Plain copy for /person: visible name + class and selected discourse lines,
 * never hover-description popovers.
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
		const row = popoverLine
			? root.querySelector(
					`.person-item [data-copy-line="${CSS.escape(popoverLine)}"]`,
				)
			: null;
		const item = row?.closest(".person-item") || ancestorEl.closest(".person-item");
		if (!item) return popoverLine ? [popoverLine] : null;
		const name = headingLine(item);
		return name && popoverLine ? [name, popoverLine] : name ? [name] : [popoverLine];
	}

	const inside = ancestorEl?.closest(".person-item");
	const items = inside
		? [inside]
		: [...root.querySelectorAll(".person-item")].filter((item) => {
				const heading = item.querySelector("h3");
				if (heading && rangeIntersectsNode(range, heading)) return true;
				return [
					...item.querySelectorAll(".person-discourses > [data-copy-line]"),
				].some((row) => rangeIntersectsNode(range, row));
			});
	if (items.length === 0) return null;

	const lines: string[] = [];
	for (const item of items) {
		const name = headingLine(item);
		const selected = [
			...item.querySelectorAll(".person-discourses > [data-copy-line]"),
		]
			.filter((row) => rangeIntersectsNode(range, row))
			.map((row) => row.getAttribute("data-copy-line") || "")
			.filter(Boolean);
		if (selected.length > 0) {
			if (name) lines.push(name);
			lines.push(...selected);
			continue;
		}
		if (name) lines.push(name);
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
