import { calculateMenuPosition } from '../utils/dom';

export function isSelectionValid(selection: RangySelection): boolean {
    if (!selection.rangeCount) return false;
    const range = selection.getRangeAt(0).nativeRange;
    if (!range) return false;
    const textContent = range.toString().trim();
    return textContent.length > 0;
}

export function updateMenuPosition(
    selection: RangySelection,
    element: HTMLElement,
    rootElement: HTMLElement | null,
    currentRange: Range | null,
    menu: HTMLElement,
    highlighter: Highlighter | null
): { savedRange: Range | null } {
    let savedRange: Range | null = null;

    if (!selection?.rangeCount || !rootElement) {
        element.style.display = "none";
        return { savedRange };
    }

    const range = selection.getRangeAt(0).nativeRange;
    if (!range) {
        element.style.display = "none";
        return { savedRange };
    }

    savedRange = range.cloneRange();
    const endRange = document.createRange();
    endRange.setStart(range.endContainer, range.endOffset);
    endRange.collapse(true);

    const endRects = endRange.getClientRects();
    let finalRect: DOMRect | null = endRects.length > 0
        ? endRects[endRects.length - 1]
        : null;

    // If the collapsed endpoint range didn't produce rects (browser inconsistency),
    // fall back to the last rect of the selection's getClientRects() — this gives
    // the last line of selected text, which is where the endpoint visually sits.
    // Avoid getBoundingClientRect() here as it returns the bounding box of the
    // entire selection, which misplaces the menu for multi-line selections.
    if (!finalRect) {
        const selectionRects = range.getClientRects();
        if (selectionRects.length > 0) {
            finalRect = selectionRects[selectionRects.length - 1];
        }
    }

    if (!finalRect && currentRange) {
        const rects = currentRange.getClientRects();
        finalRect = rects.length > 0
            ? rects[rects.length - 1]
            : null;
    }

    if (finalRect && finalRect.height > 0) {
        calculateMenuPosition(element, finalRect, rootElement);
        element.style.display = "block";

        // Handle eraser visibility
        const eraser = document.getElementById("highlight-eraser");
        if (eraser && highlighter) {
            const existing = highlighter.getHighlightsInSelection(selection);
            eraser.style.display = existing.length > 0 ? "flex" : "none";
        }
    }

    return { savedRange };
}
