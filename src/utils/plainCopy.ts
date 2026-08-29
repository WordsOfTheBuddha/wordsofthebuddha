/**
 * Plain-text copy for discourse pages.
 *
 * Native Cmd/Ctrl+C (and `selection.toString()`) concatenates adjacent `<p>`s
 * with nothing in between — `What four?1.)` — while `<br>` inside verses still
 * becomes a newline. `range.cloneContents()` for a mid-`<p>` → mid-`<p>`
 * selection unwraps those paragraphs, so walking the clone also glues. Cmd+C
 * therefore walks **live** `.english-paragraph` / `.pali-paragraph` blocks
 * that intersect the selection and joins them with `\n\n`.
 *
 * Paragraph numbers are real `.paragraph-num` nodes (not CSS `::before`).
 *
 * Layout / ListenLayout inline a classic capture handler. The `copy` event
 * (document + window capture) is the primary path — Edit menu Copy and Cmd+C
 * both fire it. Do not skip contenteditable in `.md-content` / `#highlight-root`.
 * The module listener is a backup.
 */

export const COPY_CHROME_SELECTOR =
	"button, script, style, .tm-lookup-btn, .listen-para-actions, .english-pair-spacer, .paragraph-num";

const COPY_BLOCK_SELECTOR =
	"p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, .english-paragraph, .pali-paragraph, .listen-paragraph";

const BLOCK_TAGS = new Set([
	"p",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"li",
	"blockquote",
	"pre",
]);

const COPYING_CLASS = "copying-discourse";

let installed = false;
let sanitizing = false;

export function shouldSkipCopyElement(el: HTMLElement): boolean {
	if (el.getAttribute("aria-hidden") === "true") return true;
	try {
		return el.matches(COPY_CHROME_SELECTOR);
	} catch {
		return false;
	}
}

function shouldSkipPali(el: HTMLElement): boolean {
	if (typeof document === "undefined") return false;
	if (document.documentElement.classList.contains("pali-on")) return false;
	return el.classList.contains("pali-paragraph") || el.id === "panel2";
}

function isCopyBlock(el: HTMLElement): boolean {
	if (BLOCK_TAGS.has(el.tagName.toLowerCase())) return true;
	return (
		el.classList.contains("listen-paragraph") ||
		el.classList.contains("english-paragraph") ||
		el.classList.contains("pali-paragraph")
	);
}

function shouldIncludeCopyBlock(el: HTMLElement): boolean {
	if (!isCopyBlock(el)) return false;
	if (el.getAttribute("aria-hidden") === "true") return false;
	if (el.classList.contains("english-pair-spacer")) return false;
	if (shouldSkipPali(el)) return false;
	return true;
}

function normalizeCopiedPlainText(text: string): string {
	return text
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n[ \t]+/g, "\n")
		.replace(/\n{2,}/g, "\n\n")
		.trim();
}

/** WebKit `intersectsNode` can return false for valid selections; use contains/comparePoint too. */
function rangeIntersectsNode(range: Range, node: Node): boolean {
	if (!node) return false;
	try {
		if (range.intersectsNode(node)) return true;
	} catch {
		/* WebKit false negatives */
	}

	const start = range.startContainer;
	const end = range.endContainer;
	if (node === start || node === end) return true;

	if (node.nodeType === Node.ELEMENT_NODE) {
		const el = node as Element;
		if (el.contains(start) || el.contains(end)) return true;
	}
	if (start.nodeType === Node.ELEMENT_NODE && (start as Element).contains(node)) {
		return true;
	}
	if (end.nodeType === Node.ELEMENT_NODE && (end as Element).contains(node)) {
		return true;
	}

	try {
		const endOffset =
			node.nodeType === Node.TEXT_NODE
				? (node as Text).data.length
				: node.childNodes.length;
		if (range.comparePoint(node, 0) === 0) return true;
		if (range.comparePoint(node, endOffset) === 0) return true;
		if (
			range.comparePoint(node, 0) < 0 &&
			range.comparePoint(node, endOffset) > 0
		) {
			return true;
		}
	} catch {
		/* ignore */
	}

	return false;
}

const DISCOURSE_ROOT_SELECTOR =
	".md-content, .listen-stage, #panel1, #panel2, .split-panel, #highlight-root";

function discourseRootFromElement(el: Element | null | undefined): HTMLElement | null {
	if (!el?.closest) return null;
	const scoped = el.closest(DISCOURSE_ROOT_SELECTOR);
	return scoped ? (scoped as HTMLElement) : null;
}

function findDiscourseRoot(range: Range, selection?: Selection | null): HTMLElement | null {
	const anchor = selection?.anchorNode;
	const anchorEl =
		anchor == null
			? null
			: anchor.nodeType === Node.ELEMENT_NODE
				? (anchor as Element)
				: anchor.parentElement;

	const ancestor = range.commonAncestorContainer;
	const ancestorEl =
		ancestor.nodeType === Node.ELEMENT_NODE
			? (ancestor as Element)
			: ancestor.parentElement;

	const fromAnchor = discourseRootFromElement(anchorEl);
	if (fromAnchor) return fromAnchor;
	const fromAncestor = discourseRootFromElement(ancestorEl);
	if (fromAncestor) return fromAncestor;

	if (typeof document === "undefined") return null;
	for (const candidate of document.querySelectorAll<HTMLElement>(
		".md-content, .listen-stage, #panel1, #panel2",
	)) {
		if (rangeIntersectsNode(range, candidate)) return candidate;
	}
	return null;
}

function sliceTextForRange(textNode: Text, range: Range): string {
	let start = 0;
	let end = textNode.data.length;
	if (range.startContainer === textNode) start = range.startOffset;
	if (range.endContainer === textNode) end = range.endOffset;
	if (start >= end) return "";
	return textNode.data.slice(start, end);
}

function ownerDocumentOf(node: Node): Document {
	return node.ownerDocument ?? document;
}

function getDiscourseRoot(range: Range): HTMLElement | null {
	return findDiscourseRoot(range);
}

/** Extract plain text from one block, preserving verse `<br>` as `\n`. */
function extractBlockPlainText(block: HTMLElement, range: Range): string {
	const doc = ownerDocumentOf(block);
	const walker = doc.createTreeWalker(
		block,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		{
			acceptNode(node: Node): number {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const el = node as HTMLElement;
					if (shouldSkipCopyElement(el)) {
						return NodeFilter.FILTER_REJECT;
					}
					if (el.tagName.toLowerCase() === "br") {
						return rangeIntersectsNode(range, el)
							? NodeFilter.FILTER_ACCEPT
							: NodeFilter.FILTER_REJECT;
					}
					return NodeFilter.FILTER_SKIP;
				}
				const text = node as Text;
				if (!rangeIntersectsNode(range, text)) {
					return NodeFilter.FILTER_REJECT;
				}
				return NodeFilter.FILTER_ACCEPT;
			},
		},
	);

	let out = "";
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			out += "\n";
			continue;
		}
		out += sliceTextForRange(node as Text, range);
	}
	return out.replace(/[ \t]+$/gm, "").replace(/^[ \t]+/gm, "");
}

/** Skip inner blocks already covered by an ancestor copy block (h1 > .pali-paragraph). */
function isNestedCopyBlock(el: HTMLElement, included: HTMLElement[]): boolean {
	return included.some((other) => other !== el && other.contains(el));
}

/**
 * Iterate live discourse blocks under the selection root. Adjacent blocks are
 * joined with `\n\n`. Verse `<br>` inside a block stays a single `\n`.
 * Never walk `cloneContents()` fragments — partial `<p>` selections unwrap.
 */
function serializeCopyTree(root: Node, range: Range): string {
	if (root.nodeType === Node.TEXT_NODE) {
		return normalizeCopiedPlainText(sliceTextForRange(root as Text, range));
	}

	const rootEl =
		root.nodeType === Node.ELEMENT_NODE
			? (root as HTMLElement)
			: root.parentElement;
	if (!rootEl) return "";

	const searchRoot =
		rootEl.isConnected === false
			? rootEl
			: (getDiscourseRoot(range) ?? rootEl);
	const blocks = Array.from(
		searchRoot.querySelectorAll<HTMLElement>(COPY_BLOCK_SELECTOR),
	).filter(shouldIncludeCopyBlock);

	const parts: string[] = [];
	for (const block of blocks) {
		if (!rangeIntersectsNode(range, block)) continue;
		if (isNestedCopyBlock(block, blocks)) continue;
		const text = extractBlockPlainText(block, range)
			.replace(/[ \t]{2,}/g, " ")
			.trim();
		if (text) parts.push(text);
	}

	if (parts.length === 0) {
		const fallback = extractBlockPlainText(rootEl, range)
			.replace(/[ \t]{2,}/g, " ")
			.trim();
		return fallback ? normalizeCopiedPlainText(fallback) : "";
	}

	return normalizeCopiedPlainText(parts.join("\n\n"));
}

function getCopyScope(range: Range): Node {
	const discourse = getDiscourseRoot(range);
	if (discourse) return discourse;

	const ancestor = range.commonAncestorContainer;
	const ancestorEl =
		ancestor.nodeType === Node.ELEMENT_NODE
			? (ancestor as Element)
			: ancestor.parentElement;
	if (!ancestorEl) return ancestor;
	return ancestor.nodeType === Node.TEXT_NODE ? ancestorEl : ancestor;
}

/** Plain text from a cloned subtree that still has block wrappers (Rich copy). */
export function getPlainTextFromContainer(container: HTMLElement): string {
	const range = ownerDocumentOf(container).createRange();
	range.selectNodeContents(container);
	return serializeCopyTree(container, range);
}

/**
 * @deprecated cloneContents() unwraps mid-`<p>` selections. Delegates to
 * {@link getPlainTextFromRange} (live block walk).
 */
export function getPlainTextFromRangeClone(range: Range): string {
	return getPlainTextFromRange(range);
}

/**
 * Walk live DOM blocks that intersect the selection and join them with `\n\n`.
 * This is the Cmd+C / copy-event path — not `cloneContents()`.
 */
export function getPlainTextFromRange(range: Range): string {
	return serializeCopyTree(getCopyScope(range), range);
}

const DISCOURSE_COPY_SELECTOR =
	".md-content, #highlight-root, .english-paragraph, .pali-paragraph, .listen-paragraph, .listen-stage, .split-panel, #panel1, #panel2, .interleaved-article";

export function isEditableCopyTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.closest("input, textarea, select")) return true;
	if (target.closest(DISCOURSE_COPY_SELECTOR)) return false;
	if (target.isContentEditable) return true;
	try {
		return !!target.closest(
			"[contenteditable]:not([contenteditable='false'])",
		);
	} catch {
		return false;
	}
}

export function selectionIsDiscourseText(selection: Selection): boolean {
	if (!selection.rangeCount) return false;
	const range = selection.getRangeAt(0);
	const discourseSelector =
		".md-content, .listen-stage, .split-panel, #panel1, #panel2, #highlight-root, .english-paragraph, .pali-paragraph, .listen-paragraph";

	const isDiscourseElement = (el: Element | null | undefined): boolean => {
		if (!el) return false;
		if (el.closest(".tm-popover-overlay, .bottom-popover, .highlight-menu")) {
			return false;
		}
		return !!el.closest(discourseSelector);
	};

	const anchor = selection.anchorNode;
	const anchorEl =
		anchor == null
			? null
			: anchor.nodeType === Node.ELEMENT_NODE
				? (anchor as Element)
				: anchor.parentElement;
	if (isDiscourseElement(anchorEl)) return true;

	const ancestor = range.commonAncestorContainer;
	const el =
		ancestor.nodeType === Node.ELEMENT_NODE
			? (ancestor as Element)
			: ancestor.parentElement;
	if (isDiscourseElement(el)) return true;

	return findDiscourseRoot(range, selection) !== null;
}

export function beginCopySanitization(): void {
	if (typeof document === "undefined" || sanitizing) return;
	sanitizing = true;
	document.documentElement.classList.add(COPYING_CLASS);
	void document.documentElement.offsetHeight;
}

export function endCopySanitization(): void {
	if (typeof document === "undefined" || !sanitizing) return;
	sanitizing = false;
	document.documentElement.classList.remove(COPYING_CLASS);
}

function writePlainClipboard(e: ClipboardEvent, plainText: string): void {
	e.preventDefault();
	e.stopImmediatePropagation();

	if (e.clipboardData) {
		try {
			e.clipboardData.setData("text/plain", plainText);
		} catch {
			/* WebKit may throw on clipboardData writes */
		}
	}

	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		void navigator.clipboard.writeText(plainText).catch(() => {});
	}
}

/**
 * Compute plain text for the current discourse selection.
 * Layout's classic script calls this and writes clipboardData itself so Safari
 * does not ignore setData from a module function.
 */
export function preparePlainCopy(e: ClipboardEvent): string | null {
	if (isEditableCopyTarget(e.target)) return null;
	const selection = window.getSelection();
	if (!selection?.rangeCount || selection.isCollapsed) return null;
	if (!selectionIsDiscourseText(selection)) return null;
	return getPlainTextFromRange(selection.getRangeAt(0)) || null;
}

function onCopy(e: ClipboardEvent): void {
	if (e.defaultPrevented) return;
	try {
		const plainText = preparePlainCopy(e);
		if (!plainText) return;
		writePlainClipboard(e, plainText);
	} catch {
		/* ignore */
	}
}

/** Idempotent. Safe to call from Layout and CopyButton. */
export function installDiscoursePlainCopy(): void {
	if (installed || typeof document === "undefined") return;
	installed = true;
	if (typeof window !== "undefined") {
		window.__suttaPlainCopy = onCopy;
		window.__suttaPlainCopyPrepare = preparePlainCopy;
	}
	document.addEventListener("copy", onCopy, true);
	if (typeof window !== "undefined") {
		window.addEventListener("copy", onCopy, true);
	}
}

/** Test-only: allow re-installing against a fresh JSDOM document. */
export function resetDiscoursePlainCopyForTests(): void {
	installed = false;
	sanitizing = false;
	if (typeof window !== "undefined") {
		delete window.__suttaPlainCopy;
		delete window.__suttaPlainCopyPrepare;
	}
}

declare global {
	interface Window {
		__suttaPlainCopy?: (e: ClipboardEvent) => void;
		__suttaPlainCopyPrepare?: (e: ClipboardEvent) => string | null;
	}
}
