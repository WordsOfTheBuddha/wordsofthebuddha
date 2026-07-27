/**
 * Builds the two-column split view in the browser.
 *
 * Every discourse page ships one interleaved copy of the text (Pāli block
 * followed by its English block, both carrying the same `data-pair-id`). The
 * split panels are clones of those nodes, assembled the first time split view
 * becomes visible, so the page does not have to carry a second prerendered copy
 * of the whole discourse.
 */

/** Empty `#panel1` / `#panel2` markup, captured before the first build. */
let pristinePanels: string | null = null;

function getWrapper(): HTMLElement | null {
	return document.querySelector<HTMLElement>(".split-wrapper");
}

/**
 * The interleaved article the panels are cloned from. Reference-fallback pages
 * render a second, Pāli-only `.interleaved-article` in a separate container, so
 * the lookup stays scoped to the wrapper's own parent.
 */
function getInterleavedSource(wrapper: HTMLElement): HTMLElement | null {
	const parent = wrapper.parentElement;
	if (!parent) return null;
	return parent.querySelector<HTMLElement>(":scope > .interleaved-article");
}

/**
 * Placeholder for a Pāli paragraph whose English counterpart was skipped (e.g.
 * abbreviated peyyāla passages). Alignment gives it the height of its Pāli
 * partner so the English column does not collapse.
 */
function createPairSpacer(pairId: string): HTMLParagraphElement {
	const spacer = document.createElement("p");
	spacer.className = "english-paragraph english-pair-spacer";
	spacer.setAttribute("data-pair-id", pairId);
	spacer.setAttribute("aria-hidden", "true");
	const inner = document.createElement("span");
	inner.className = "english-pair-spacer-inner";
	inner.textContent = "\u200B";
	spacer.appendChild(inner);
	return spacer;
}

/**
 * Number the rows of a panel from zero, the way the server used to number each
 * split column with its own counter.
 *
 * The interleaved article shares one `data-pair-id` between a Pāli block and its
 * English block, so its ids drift apart from a per-column count wherever an
 * English paragraph has no Pāli counterpart (a paragraph-count mismatch between
 * the two source files). Counting per column keeps the two columns aligned in
 * those cases, which is what the prerendered split view did.
 */
function renumberRows(panel: HTMLElement): void {
	let row = 0;
	for (const block of Array.from(panel.children)) {
		if (!block.hasAttribute("data-pair-id")) continue;
		block.setAttribute("data-pair-id", String(row++));
	}
}

function fillPanels(wrapper: HTMLElement, source: HTMLElement): boolean {
	const englishPanel = wrapper.querySelector<HTMLElement>("#panel1");
	const paliPanel = wrapper.querySelector<HTMLElement>("#panel2");
	if (!englishPanel || !paliPanel) return false;

	const englishNodes: Node[] = [];
	const paliNodes: Node[] = [];
	/** Pāli block seen but not yet matched by an English block of the same pair. */
	let unpairedPaliId: string | null = null;

	const closeUnpairedPali = () => {
		if (unpairedPaliId === null) return;
		englishNodes.push(createPairSpacer(unpairedPaliId));
		unpairedPaliId = null;
	};

	for (const block of Array.from(source.children)) {
		if (block.classList.contains("pali-paragraph")) {
			closeUnpairedPali();
			paliNodes.push(block.cloneNode(true));
			// A block without a pair id (e.g. a heading) cannot be aligned, so
			// it never gets an English spacer.
			unpairedPaliId = block.getAttribute("data-pair-id");
			continue;
		}

		if (block.classList.contains("english-paragraph")) {
			const pairId = block.getAttribute("data-pair-id");
			if (unpairedPaliId !== null && pairId === unpairedPaliId) {
				unpairedPaliId = null;
			} else {
				closeUnpairedPali();
			}
			englishNodes.push(block.cloneNode(true));
			continue;
		}

		// Headings, images and notices only ever exist in English.
		closeUnpairedPali();
		englishNodes.push(block.cloneNode(true));
	}
	closeUnpairedPali();

	englishPanel.replaceChildren(...englishNodes);
	paliPanel.replaceChildren(...paliNodes);
	renumberRows(englishPanel);
	renumberRows(paliPanel);
	return true;
}

/**
 * Assemble the split panels if they are not already in sync with the
 * interleaved article. Safe to call on every layout change and on pages that
 * have no split view at all.
 */
export function ensureSplitPanels(): boolean {
	const wrapper = getWrapper();
	if (!wrapper) return false;
	const source = getInterleavedSource(wrapper);
	if (!source) return false;

	if (pristinePanels === null) pristinePanels = wrapper.innerHTML;

	const panelsPresent = Boolean(
		wrapper.querySelector("#panel1") && wrapper.querySelector("#panel2"),
	);
	const sourceSignature = String(source.children.length);
	if (panelsPresent && wrapper.dataset.splitBuilt === sourceSignature) {
		return true;
	}
	// Print formatting replaces the wrapper's contents; start from the panels
	// the server rendered so their scoped styles survive.
	if (!panelsPresent) wrapper.innerHTML = pristinePanels;

	if (!fillPanels(wrapper, source)) return false;
	wrapper.dataset.splitBuilt = sourceSignature;
	return true;
}
