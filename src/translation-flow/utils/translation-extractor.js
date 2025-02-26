/**
 * Utilities for extracting and processing translations from LLM outputs
 */

/**
 * Extracts the Pass 2 (refined) translation from raw LLM output
 *
 * @param {string} rawOutput - Raw LLM output containing translation passes
 * @returns {string} The refined (Pass 2) translation only
 */
export function extractRefinedTranslation(rawOutput) {
	if (!rawOutput) return "";

	// Look for the Pass 2 section specifically
	const pass2Match = rawOutput.match(
		/# Pass 2: Refined Translation\s+([\s\S]+?)(?:$|(?=# )|(?=---\s*Key Adjustments))/i
	);

	if (pass2Match && pass2Match[1]) {
		// Remove any markdown formatting that might have been added
		const refinedText = pass2Match[1]
			.trim()
			.replace(/^\s*["']|["']\s*$/g, ""); // Remove enclosing quotes if present

		return refinedText;
	}

	// If no Pass 2 section is found, try to find any translated content
	// Look for content between the Pass 1 section and any other section
	const pass1EndMatch = rawOutput.match(
		/# Pass 1: Analytical Translation[\s\S]+?(?=\n\n|\n---)/i
	);
	if (pass1EndMatch) {
		const remainingContent = rawOutput.substring(
			pass1EndMatch.index + pass1EndMatch[0].length
		);
		const nextSectionMatch = remainingContent.match(/\n# |\n---/);
		if (nextSectionMatch) {
			const extractedContent = remainingContent
				.substring(0, nextSectionMatch.index)
				.trim();
			if (extractedContent) return extractedContent;
		}
	}

	// Fallback: return the whole text cleaned up
	return rawOutput
		.replace(
			/# Pass 1: Analytical Translation[\s\S]+?(?=\n\n# Pass 2|\n---)/i,
			""
		)
		.replace(/# Pass 2: Refined Translation\s*/i, "")
		.replace(/---\s*Key Adjustments[\s\S]+$/i, "")
		.trim();
}

/**
 * Determines if a string is likely to be a title translation
 *
 * @param {string} content - The string to evaluate
 * @returns {boolean} True if likely a title
 */
export function isLikelyTitle(content) {
	// Title characteristics: short, no periods within the text, often starts with "The"
	return (
		content.length < 100 &&
		!content.includes(".") &&
		!content.includes("\n") &&
		!/^\d+\./.test(content)
	); // Not starting with a numbered list
}

/**
 * Validates and normalizes a raw translations array
 *
 * @param {string[]} rawOutputs - Array of raw translation outputs
 * @param {number} expectedParagraphs - Expected number of paragraphs
 * @param {boolean} hasTitle - Whether the first item is a title translation
 * @returns {string[]} Normalized array with correct length
 */
export function normalizeRawOutputsArray(
	rawOutputs,
	expectedParagraphs,
	hasTitle = false
) {
	if (!Array.isArray(rawOutputs)) return [];

	// Calculate expected length including title if present
	const expectedLength = expectedParagraphs + (hasTitle ? 1 : 0);

	// If array is too long, trim it
	if (rawOutputs.length > expectedLength) {
		return rawOutputs.slice(0, expectedLength);
	}

	// If array is too short, pad it with empty strings
	if (rawOutputs.length < expectedLength) {
		return [
			...rawOutputs,
			...Array(expectedLength - rawOutputs.length).fill(""),
		];
	}

	return rawOutputs;
}
