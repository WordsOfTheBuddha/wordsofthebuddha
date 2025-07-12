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

    // --- MINIMAL FIX ---
    // If the endpoint rectangle isn't found (can happen on first selection),
    // fall back to the bounding rectangle of the entire selection.
    // This ensures the menu always has a position without changing the logic.
    if (!finalRect) {
        finalRect = range.getBoundingClientRect();
    }
    // --- END FIX ---

    if (!finalRect && currentRange) {
        const rects = currentRange.getClientRects();
        finalRect = rects.length > 0
            ? rects[rects.length - 1]
            : currentRange.getBoundingClientRect();
    }

    if (finalRect) {
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
