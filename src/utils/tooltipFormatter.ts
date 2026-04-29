/**
 * Tooltip Formatter Utility
 *
 * Shared formatting logic for tooltips used by both CopyButton and PrintFormatter components.
 * Supports inline and appendix tooltip formatting based on content length threshold.
 * Includes duplicate term tracking to avoid redundant annotations.
 */

/** Drop punctuation that appears after a gloss term boundary. */
function sanitizeGlossTerm(text: string): string {
	return text.trim().replace(/[;:,.!?…)"'\]\u201d\u2019]+$/u, "").trim();
}

/** Replace heading tags with a normal paragraph whose text is bold (better paste targets). */
function flattenHeadingsToBoldParagraphs(container: HTMLElement): void {
	for (const heading of container.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
		const p = document.createElement("p");
		const strong = document.createElement("strong");
		strong.innerHTML = heading.innerHTML;
		p.appendChild(strong);
		heading.parentNode?.replaceChild(p, heading);
	}
}

export function getFormattedContainer(
	range: Range,
	threshold?: number,
	options?: { includeSeparator?: boolean }
): HTMLDivElement {
	const container = document.createElement("div");
	const originalContent = range.cloneContents();
	container.appendChild(originalContent);

	// If Pali mode isn't active, strip Pali elements so hidden text isn't copied.
	const htmlRoot = document.documentElement;
	const paliOn = htmlRoot.classList.contains("pali-on");
	if (!paliOn) {
		// Remove individual interleaved Pali paragraphs
		container
			.querySelectorAll(".pali-paragraph")
			.forEach((el) => el.remove());
		// Remove split-view second panel if present in the selection
		const panel2 = container.querySelector("#panel2");
		if (panel2) panel2.remove();
		// Also remove any ancestor wrappers left empty after removals
		container.querySelectorAll(".split-wrapper").forEach((wrapper) => {
			if (
				!wrapper.querySelector("#panel1") ||
				!wrapper.querySelector("#panel2")
			) {
				// If only one panel remains, unwrap to just keep English
				const panel1 = wrapper.querySelector("#panel1");
				if (panel1) {
					wrapper.parentNode?.insertBefore(panel1, wrapper);
				}
				wrapper.remove();
			}
		});
	}

	// Support both .tooltip-text and [data-tooltip] elements
	const tooltipElements = Array.from(
		container.querySelectorAll(".tooltip-text, [data-tooltip]")
	);

	const actualThreshold =
		threshold ?? parseInt(localStorage.getItem("tooltipThreshold") || "18");

	const includeSeparator = options?.includeSeparator ?? true;
	// Track processed entries; dedupe only when BOTH term and meaning match.
	const processedEntries = new Set<string>();
	const keyTerms: Array<{ text: string; content: string }> = [];

	tooltipElements.forEach((element) => {
		// Get tooltip content from either attribute
		const tooltipContent =
			element.getAttribute("data-tooltip") ||
			element.getAttribute("data-tooltip-content") ||
			"";

		const textContent = element.textContent;

		// Skip if tooltip text or element text content is null/empty
		if (!tooltipContent || !textContent) {
			return;
		}

		const cleanTermText = sanitizeGlossTerm(textContent);
		const displayTerm = cleanTermText || textContent.trim();
		const cleanTooltipContent = tooltipContent.trim();
		const entryKey = `${displayTerm.toLowerCase()}||${cleanTooltipContent}`;

		// Skip only exact duplicate term+meaning pairs
		if (processedEntries.has(entryKey)) {
			// For duplicates, just keep the bold formatting without tooltip processing
			const span = document.createElement("span");
			span.innerHTML = `<b>${displayTerm}</b>`;
			if (element.parentNode) {
				element.parentNode.replaceChild(span, element);
			}
			return;
		}

		// Mark this term+meaning entry as processed
		processedEntries.add(entryKey);

		const span = document.createElement("span");

		if (cleanTooltipContent.length <= actualThreshold) {
			// Inline format: <b>term</b> (definition)
			span.innerHTML = `<b>${displayTerm}</b> (${cleanTooltipContent})`;
		} else {
			// Appendix format omits inline reference marker: <b>term</b>
			span.innerHTML = `<b>${displayTerm}</b>`;
			keyTerms.push({
				text: displayTerm,
				content: cleanTooltipContent,
			});
		}

		if (element.parentNode) {
			element.parentNode.replaceChild(span, element);
		}
	});

	// Add key terms section if there are any appendix tooltips
	if (keyTerms.length > 0) {
		const footnotesDiv = document.createElement("div");
		const headingRow = document.createElement("p");
		headingRow.innerHTML = "<b>Key Terms</b>:";
		headingRow.style.margin = "0.5em 0";
		const keyTermsList = document.createElement("ul");
		keyTermsList.className = "key-terms-list";
		keyTermsList.style.margin = "0.25em 0 0.5em 1.25em";

		keyTerms.forEach(({ text, content }) => {
			// Extract Pali term from content if it exists (pattern: [paliTerm])
			const paliMatch = content.match(/\[([^\]]+)\]$/);
			const paliTerm = paliMatch ? paliMatch[1] : null;
			const cleanContent = paliTerm
				? content.replace(/\s*\[([^\]]+)\]$/, "")
				: content;

			// Create key term list item
			const footnoteItem = document.createElement("li");
			footnoteItem.style.margin = "0.35em 0";

			// Format key term content with ≈ symbol
			if (paliTerm) {
				footnoteItem.innerHTML = `<b>${text}</b> [${paliTerm}] ≈ ${cleanContent}`;
			} else {
				footnoteItem.innerHTML = `<b>${text}</b> ≈ ${cleanContent}`;
			}

			keyTermsList.appendChild(footnoteItem);
		});

		if (includeSeparator) {
			const separatorRow = document.createElement("p");
			separatorRow.textContent = "---";
			separatorRow.style.margin = "0.5em 0";
			footnotesDiv.appendChild(separatorRow);
		}
		footnotesDiv.appendChild(headingRow);
		footnotesDiv.appendChild(keyTermsList);
		container.appendChild(footnotesDiv);
	}

	flattenHeadingsToBoldParagraphs(container);

	return container;
}
