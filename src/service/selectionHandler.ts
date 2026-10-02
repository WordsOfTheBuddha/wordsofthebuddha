import { calculateMenuPosition } from '../utils/dom';

export function isSelectionValid(selection: Selection | null): boolean {
    if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
    return selection.getRangeAt(0).toString().trim().length > 0;
}

/** Place the menu at the selection's end point. Returns false when there is nowhere to put it. */
export function updateMenuPosition(
    range: Range,
    element: HTMLElement,
    rootElement: HTMLElement | null,
): boolean {
    if (!rootElement) return false;

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

    if (!finalRect || finalRect.height <= 0) return false;
    calculateMenuPosition(element, finalRect, rootElement);
    return true;
}
