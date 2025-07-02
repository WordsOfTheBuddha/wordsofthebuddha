/**
 * Tooltip Formatter Utility
 *
 * Shared formatting logic for tooltips used by both CopyButton and PrintFormatter components.
 * Supports both inline and footnoted tooltip formatting based on content length threshold.
 */

export function getFormattedContainer(range: Range, threshold?: number): HTMLDivElement {
    const container = document.createElement("div");
    const originalContent = range.cloneContents();
    container.appendChild(originalContent);

    const tooltips = Array.from(
        container.querySelectorAll(".tooltip-text")
    );

    const actualThreshold = threshold ?? parseInt(
        localStorage.getItem("tooltipThreshold") || "35"
    );

    const inlineTooltips: Array<{ element: Element; content: string }> = [];
    const footnotedTooltips: Array<{
        element: Element;
        content: string;
        text: string;
        refNum: number;
    }> = [];

    // Categorize tooltips by content length
    tooltips.forEach((tooltip) => {
        const text = tooltip.textContent || "";
        const tooltipContent =
            tooltip.getAttribute("data-tooltip-content") || "";

        if (tooltipContent.length <= actualThreshold) {
            inlineTooltips.push({
                element: tooltip,
                content: tooltipContent,
            });
        } else {
            footnotedTooltips.push({
                element: tooltip,
                content: tooltipContent,
                text: text,
                refNum: footnotedTooltips.length + 1,
            });
        }
    });

    // Process inline tooltips (existing logic)
    inlineTooltips.forEach(({ element, content }, index) => {
        const text = element.textContent || "";
        const originalHTML = element.innerHTML;
        const formatted = `<b>${text}</b> (${content})`;
        const span = document.createElement("span");
        span.innerHTML = formatted;

        if (element.parentNode) {
            element.parentNode.replaceChild(span, element);
        }
    });

    // Process footnoted tooltips with numbered references
    footnotedTooltips.forEach(({ element, text, refNum }, index) => {
        const originalHTML = element.innerHTML;
        const formatted = `<b>${text}</b> [${refNum}]`;
        const span = document.createElement("span");
        span.innerHTML = formatted;

        if (element.parentNode) {
            element.parentNode.replaceChild(span, element);
        }
    });

    // Add footnotes section if there are any footnoted tooltips
    if (footnotedTooltips.length > 0) {
        const footnotesDiv = document.createElement("div");

        footnotedTooltips.forEach(({ text, content, refNum }, index) => {
            // Extract Pali term from content if it exists (pattern: [paliTerm])
            const paliMatch = content.match(/\[([^\]]+)\]$/);
            const paliTerm = paliMatch ? paliMatch[1] : null;
            const cleanContent = paliTerm
                ? content.replace(/\s*\[([^\]]+)\]$/, "")
                : content;

            // Create individual footnote paragraph
            const footnoteP = document.createElement("p");
            footnoteP.style.margin = "0.5em 0";

            // Format footnote content with ≈ symbol
            if (paliTerm) {
                footnoteP.innerHTML = `[${refNum}] ${text} [${paliTerm}] ≈ ${cleanContent}`;
            } else {
                footnoteP.innerHTML = `[${refNum}] ${text} ≈ ${cleanContent}`;
            }

            footnotesDiv.appendChild(footnoteP);
        });

        container.appendChild(footnotesDiv);
    }

    return container;
}
