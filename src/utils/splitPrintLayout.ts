/**
 * Browser print for split (two-column) Pāli layout.
 *
 * On screen, split view is two tall columns (`#panel1` English, `#panel2` Pāli)
 * in a CSS grid. Print engines fragment that as “all of column 1, then all of
 * column 2”, and `@media (max-width: 767px)` also stacks the columns. Rewriting
 * into one row per `data-pair-id` keeps English and Pāli side by side on each
 * printed page — the same pairing as collection PDF `pdf-poly-row`.
 *
 * Must run synchronously inside `beforeprint` (not in a timeout). Chrome
 * snapshots the layout when that handler returns.
 */

export const SPLIT_PRINT_PAIR_CLASS = "paragraph-pair-grid";
export const SPLIT_PRINT_FULL_CLASS = "heading-row";

function pairSelector(pairId: string): string {
	return `[data-pair-id="${pairId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

function styleOf(el: Element): CSSStyleDeclaration | undefined {
	return (el as { style?: CSSStyleDeclaration }).style;
}

function isElement(node: Node): node is Element {
	return node.nodeType === 1;
}

function stylePairRow(row: Element): void {
	const style = styleOf(row);
	if (!style) return;
	style.display = "grid";
	style.gridTemplateColumns = "1fr 1fr";
	style.gap = "1rem";
	style.alignItems = "start";
	style.marginBottom = "1.5rem";
	style.pageBreakInside = "avoid";
	style.breakInside = "avoid";
}

function styleFullRow(row: Element): void {
	const style = styleOf(row);
	if (!style) return;
	style.marginBottom = "1rem";
	style.pageBreakAfter = "avoid";
}

function setDisplayBlock(el: Element): void {
	const style = styleOf(el);
	if (style) style.display = "block";
}

function isAlreadyPaired(container: Element): boolean {
	return Boolean(
		container.querySelector(`.${SPLIT_PRINT_PAIR_CLASS}`) &&
			!container.querySelector("#panel1"),
	);
}

/**
 * Replace `#panel1` / `#panel2` with pair rows. Returns whether the container
 * is in (or already was in) print-row form.
 */
export function pairSplitWrapperForPrint(container: Element): boolean {
	if (isAlreadyPaired(container)) {
		setDisplayBlock(container);
		return true;
	}

	const panel1 = container.querySelector("#panel1");
	const panel2 = container.querySelector("#panel2");
	if (!panel1 || !panel2) return false;

	const doc = container.ownerDocument;
	const fragment = doc.createDocumentFragment();
	const usedPali = new Set<Element>();

	for (const element of Array.from(panel1.children)) {
		if (!isElement(element)) continue;
		const pairId = element.getAttribute("data-pair-id");

		if (pairId) {
			const paliPara = panel2.querySelector(pairSelector(pairId));
			const pairGrid = doc.createElement("div");
			pairGrid.className = SPLIT_PRINT_PAIR_CLASS;
			pairGrid.appendChild(element.cloneNode(true));
			if (paliPara) {
				usedPali.add(paliPara);
				pairGrid.appendChild(paliPara.cloneNode(true));
			} else {
				const empty = doc.createElement("div");
				empty.className = "split-print-cell-empty";
				pairGrid.appendChild(empty);
			}
			stylePairRow(pairGrid);
			pairGrid.querySelectorAll("[data-pair-id]").forEach((child) => {
				const childStyle = styleOf(child);
				if (childStyle) childStyle.margin = "0";
			});
			fragment.appendChild(pairGrid);
			continue;
		}

		const headingRow = doc.createElement("div");
		headingRow.className = SPLIT_PRINT_FULL_CLASS;
		headingRow.appendChild(element.cloneNode(true));
		styleFullRow(headingRow);
		fragment.appendChild(headingRow);
	}

	for (const pali of Array.from(panel2.children)) {
		if (!isElement(pali) || usedPali.has(pali)) continue;
		const pairGrid = doc.createElement("div");
		pairGrid.className = SPLIT_PRINT_PAIR_CLASS;
		const empty = doc.createElement("div");
		empty.className = "split-print-cell-empty";
		pairGrid.appendChild(empty);
		pairGrid.appendChild(pali.cloneNode(true));
		stylePairRow(pairGrid);
		fragment.appendChild(pairGrid);
	}

	const trailingSections = Array.from(container.children).filter(
		(el) =>
			isElement(el) &&
			el.tagName === "DIV" &&
			el !== panel1 &&
			el !== panel2,
	);
	trailingSections.forEach((section, index) => {
		const sectionClone = section.cloneNode(true);
		if (!isElement(sectionClone)) return;
		const sectionStyle = styleOf(sectionClone);
		if (sectionStyle) {
			sectionStyle.marginTop = index === 0 ? "2rem" : "1rem";
			sectionStyle.paddingTop = "1rem";
			sectionStyle.borderTop = "1px solid #333";
		}
		fragment.appendChild(sectionClone);
	});

	container.replaceChildren(fragment);
	setDisplayBlock(container);
	return true;
}
