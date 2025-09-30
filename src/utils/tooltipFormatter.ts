/**
 * Tooltip Formatter Utility
 *
 * Shared formatting logic for tooltips used by both CopyButton and PrintFormatter components.
 * Supports both inline and footnoted tooltip formatting based on content length threshold.
 * Includes duplicate term tracking to avoid redundant annotations.
 */

export function getFormattedContainer(
	range: Range,
	threshold?: number
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

	// Track processed terms to avoid duplicates
	const processedTerms = new Set<string>();
	const footnotes: Array<{ text: string; content: string; refNum: number }> =
		[];
	let footnoteCounter = 1;

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

		const termText = textContent.trim().toLowerCase();

		// Skip if this term has already been processed
		if (processedTerms.has(termText)) {
			// For duplicates, just keep the bold formatting without tooltip processing
			const span = document.createElement("span");
			span.innerHTML = `${textContent}`;
			if (element.parentNode) {
				element.parentNode.replaceChild(span, element);
			}
			return;
		}

		// Mark this term as processed
		processedTerms.add(termText);

		const span = document.createElement("span");

		if (tooltipContent.length <= actualThreshold) {
			// Inline format: <b>term</b> (definition)
			span.innerHTML = `<b>${textContent}</b> (${tooltipContent})`;
		} else {
			// Footnote format now omits the inline reference marker: <b>term</b>
			span.innerHTML = `<b>${textContent}</b>`;
			footnotes.push({
				text: textContent,
				content: tooltipContent,
				refNum: footnoteCounter,
			});
			footnoteCounter++;
		}

		if (element.parentNode) {
			element.parentNode.replaceChild(span, element);
		}
	});

	// Add footnotes section if there are any footnoted tooltips
	if (footnotes.length > 0) {
		const footnotesDiv = document.createElement("div");

		footnotes.forEach(({ text, content, refNum }) => {
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
