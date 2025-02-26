import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { parseParagraphs } from "../utils/paragraph-parser.js";
import { normalizeRawOutputsArray } from "../utils/translation-extractor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const PALI_CONTENT_DIR = path.join(PROJECT_ROOT, "src/content/pli");
const ENGLISH_CONTENT_DIR = path.join(PROJECT_ROOT, "src/content/en");
const TRANSLATION_WORK_DIR = path.join(__dirname, "../.work");

/**
 * Parses a sutta ID into collection and filename
 * @param {string} suttaId - The sutta ID (e.g., an3.131)
 * @returns {Object} Object containing collection and filename
 */
function parseSuttaId(suttaId) {
	// Extract collection prefix (an, sn, mn, etc.)
	const collection = suttaId.match(/^[a-z]+/)[0];

	return { collection };
}

/**
 * Gets file paths for a sutta
 * @param {string} suttaId - The sutta ID (e.g., an3.131)
 * @returns {Object} Object containing paths for different file types
 */
function getSuttaPaths(suttaId) {
	const { collection } = parseSuttaId(suttaId);

	return {
		pali: path.join(PALI_CONTENT_DIR, collection, `${suttaId}.md`),
		rawTranslation: path.join(TRANSLATION_WORK_DIR, `${suttaId}.md`),
		refinedTranslation: path.join(
			ENGLISH_CONTENT_DIR,
			collection,
			`${suttaId}.mdx`
		),
		translationDir: path.join(ENGLISH_CONTENT_DIR, collection),
		workDir: TRANSLATION_WORK_DIR,
	};
}

/**
 * Loads the Pali text for a given sutta ID
 * @param {string} suttaId - The sutta ID (e.g., an3.131)
 * @returns {Promise<string|null>} The Pali text or null if not found
 */
export async function loadPaliText(suttaId) {
	try {
		const { pali: filePath } = getSuttaPaths(suttaId);

		// Check if file exists
		try {
			await fs.access(filePath);
		} catch (error) {
			console.error(`Pali file not found: ${filePath}`);
			return null;
		}

		// Read file content
		const content = await fs.readFile(filePath, "utf-8");
		return content;
	} catch (error) {
		console.error(`Error loading Pali text: ${error.message}`);
		return null;
	}
}

/**
 * Checks if a translation exists for a given sutta ID
 * @param {string} suttaId - The sutta ID (e.g., an3.131)
 * @returns {Promise<boolean>} True if translation exists
 */
export async function checkTranslationExists(suttaId) {
	try {
		const { refinedTranslation: filePath } = getSuttaPaths(suttaId);

		try {
			await fs.access(filePath);
			return true;
		} catch (error) {
			return false;
		}
	} catch (error) {
		console.error(`Error checking translation: ${error.message}`);
		return false;
	}
}

/**
 * Loads the English translation for a given sutta ID
 * @param {string} suttaId - The sutta ID (e.g., an3.131)
 * @returns {Promise<string|null>} The translation or null if not found
 */
export async function loadTranslation(suttaId) {
	try {
		const { refinedTranslation: filePath } = getSuttaPaths(suttaId);

		try {
			await fs.access(filePath);
		} catch (error) {
			return null;
		}

		const content = await fs.readFile(filePath, "utf-8");
		return content;
	} catch (error) {
		console.error(`Error loading translation: ${error.message}`);
		return null;
	}
}

/**
 * Loads the raw translation work file if it exists
 * @param {string} suttaId - The sutta ID
 * @returns {Promise<string|null>} Raw translation content or null
 */
export async function loadRawTranslation(suttaId) {
	try {
		const { rawTranslation: filePath } = getSuttaPaths(suttaId);

		try {
			await fs.access(filePath);
		} catch (error) {
			return null;
		}

		const content = await fs.readFile(filePath, "utf-8");
		return content;
	} catch (error) {
		console.error(`Error loading raw translation: ${error.message}`);
		return null;
	}
}

/**
 * Extracts the Pass 2 translation from raw LLM output
 * @param {string} rawOutput - Raw LLM output containing both translation passes
 * @returns {string} The refined (Pass 2) translation only
 */
function extractRefinedTranslation(rawOutput) {
	// Look for the Pass 2 section with more robust pattern matching
	const pass2Match = rawOutput.match(
		/# Pass 2: Refined Translation\s+([\s\S]+?)(?:$|(?=# )|(?=---\s*Key Adjustments))/i
	);

	if (pass2Match && pass2Match[1]) {
		// Get only the refined translation text, ensuring 1-1 mapping with original
		return pass2Match[1].trim();
	}

	// Fallback: if no match, return the whole text (better than nothing)
	return rawOutput.trim();
}

/**
 * Process translation content to include frontmatter with translated title
 * @param {string} suttaId - The sutta ID
 * @param {string} translatedContents - Array of Pass 2 translations
 * @param {string} originalContent - The original Pali content
 * @param {string|null} englishTitle - Translated title if available
 * @returns {Promise<string>} Processed content with frontmatter
 */
async function processTranslationWithFrontmatter(
	suttaId,
	translatedContents,
	originalContent,
	englishTitle = null
) {
	// Check if original content has frontmatter
	if (!originalContent.startsWith("---")) {
		return translatedContents.join("\n\n");
	}

	const secondDash = originalContent.indexOf("---", 3);
	if (secondDash === -1) {
		return translatedContents.join("\n\n");
	}

	// Extract original frontmatter
	const originalFrontmatter = originalContent.substring(0, secondDash + 3);

	// Extract original title from frontmatter
	const titleMatch = originalFrontmatter.match(/title:\s*([^\n]+)/);
	if (!titleMatch || !titleMatch[1]) {
		return translatedContents.join("\n\n");
	}

	const originalTitle = titleMatch[1].trim();

	// Create new frontmatter with both original and English titles
	let newFrontmatter = "";
	if (englishTitle) {
		// Replace the title line with original title + English title
		newFrontmatter = originalFrontmatter.replace(
			/title:\s*([^\n]+)/,
			`title: ${originalTitle} - ${englishTitle}`
		);
	} else {
		// Keep original frontmatter as is
		newFrontmatter = originalFrontmatter;
	}

	// Combine new frontmatter with processed content
	// Ensure we maintain 1-1 mapping with original paragraphs
	return `${newFrontmatter}\n${translatedContents.join("\n\n")}`;
}

/**
 * Saves both raw and refined translations for a given sutta ID
 * @param {string} suttaId - The sutta ID (e.g., an3.131)
 * @param {string[]} rawContents - Array of raw LLM outputs
 * @param {string} englishTitle - Translated title (if available)
 * @param {boolean} isInstructionMode - Whether we're in instruction mode (only updating last paragraph)
 * @param {number} currentParagraphIndex - Index of the paragraph being processed in Pali text
 * @param {string} directContent - Direct content to use (for instruction mode)
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveTranslation(
	suttaId,
	rawContents,
	englishTitle = null,
	isInstructionMode = false,
	currentParagraphIndex = -1,
	directContent = null
) {
	try {
		const { translationDir, rawTranslation, refinedTranslation, workDir } =
			getSuttaPaths(suttaId);

		// Ensure directories exist
		try {
			await fs.access(translationDir);
		} catch (error) {
			await fs.mkdir(translationDir, { recursive: true });
		}

		try {
			await fs.access(workDir);
		} catch (error) {
			await fs.mkdir(workDir, { recursive: true });
		}

		// Load the original Pali content to get paragraph count
		const originalContent = await loadPaliText(suttaId);
		const { paragraphs: paliParagraphs } = parseParagraphs(originalContent);

		// Normalize raw contents to match expected paragraph count
		const normalizedRawContents = normalizeRawOutputsArray(
			rawContents,
			paliParagraphs.length,
			!!englishTitle
		);

		// Save raw content (full LLM output)
		await fs.writeFile(
			rawTranslation,
			normalizedRawContents.join("\n\n---\n\n"),
			"utf-8"
		);

		// Load existing content first (if any) to avoid overwriting
		let existingContent = null;
		try {
			await fs.access(refinedTranslation);
			existingContent = await fs.readFile(refinedTranslation, "utf-8");
			console.log(
				`Found existing refined translation to update: ${refinedTranslation}`
			);
		} catch (error) {
			// File doesn't exist, will create new
		}

		// Extract refined translations only
		const refinedContents = rawContents.map((raw) =>
			extractRefinedTranslation(raw)
		);

		// If we already have content and frontmatter, just ensure we keep it
		if (existingContent && existingContent.startsWith("---")) {
			const secondDash = existingContent.indexOf("---", 3);
			if (secondDash !== -1) {
				// Get the existing frontmatter
				const existingFrontmatter = existingContent.substring(
					0,
					secondDash + 3
				);

				// Get the existing content paragraphs
				const { paragraphs: existingParagraphs } =
					parseParagraphs(existingContent);

				console.log(
					chalk.dim(
						`Existing paragraphs count: ${existingParagraphs.length}`
					)
				);

				// Log details of existing paragraphs
				for (let j = 0; j < existingParagraphs.length; j++) {
					const excerpt = existingParagraphs[j]
						.substring(0, 30)
						.replace(/\n/g, " ");
					console.log(
						chalk.dim(`Existing para ${j + 1}: "${excerpt}..."`)
					);
				}

				// Merge the new refined translations with existing paragraphs
				const mergedParagraphs = [...existingParagraphs];

				// Skip the first element of refinedContents if it's the title
				const contentToMerge = refinedContents.slice(
					englishTitle ? 1 : 0
				);
				console.log(
					chalk.dim(
						`New content paragraphs to merge: ${contentToMerge.length}`
					)
				);

				// Special handling for instruction mode - only update the last paragraph
				if (isInstructionMode && existingParagraphs.length > 0) {
					console.log(
						chalk.blue(
							`Instruction mode: Updating only the last paragraph`
						)
					);

					// Always use the last existing paragraph, regardless of raw outputs indexing
					const lastIndex = existingParagraphs.length - 1;

					// Log the paragraph being updated for clarity
					console.log(
						chalk.blue(
							`Replacing paragraph ${
								lastIndex + 1
							} with new refined translation`
						)
					);

					// Use directContent if provided, otherwise use the last content in contentToMerge
					// This fixes the issue with using the wrong content in instruction mode
					let rawNewContent =
						directContent ||
						(contentToMerge.length > 0
							? contentToMerge[contentToMerge.length - 1]
							: null);

					if (rawNewContent) {
						// Extract only the refined translation part from the raw content
						const refinedNewContent =
							extractRefinedTranslation(rawNewContent);

						const excerpt = refinedNewContent
							.substring(0, 30)
							.replace(/\n/g, " ");
						console.log(
							chalk.dim(`New refined content: "${excerpt}..."`)
						);

						mergedParagraphs[lastIndex] = refinedNewContent;
					} else {
						console.log(
							chalk.yellow(
								"Warning: New content is empty or undefined"
							)
						);
					}
				} else {
					// In normal mode, we're processing a specific Pali paragraph
					if (currentParagraphIndex >= 0) {
						console.log(
							chalk.dim(
								`Normal mode: Processing Pali paragraph ${
									currentParagraphIndex + 1
								}`
							)
						);

						// Always use directContent, with no fallbacks
						if (directContent) {
							// Extract only the refined translation
							const refinedContent =
								extractRefinedTranslation(directContent);

							const excerpt = refinedContent
								.substring(0, 30)
								.replace(/\n/g, " ");

							if (
								currentParagraphIndex >=
								existingParagraphs.length
							) {
								// Adding a new paragraph
								console.log(
									chalk.dim(
										`Adding new paragraph at index ${
											currentParagraphIndex + 1
										}: "${excerpt}..."`
									)
								);

								// Fill gaps with empty paragraphs if needed
								while (
									mergedParagraphs.length <
									currentParagraphIndex
								) {
									mergedParagraphs.push("");
								}

								mergedParagraphs.push(refinedContent);
							} else {
								// Replacing existing paragraph
								console.log(
									chalk.dim(
										`Replacing paragraph at index ${
											currentParagraphIndex + 1
										}: "${excerpt}..."`
									)
								);

								mergedParagraphs[currentParagraphIndex] =
									refinedContent;
							}
						} else {
							// If no directContent is provided, this is a serious error
							console.log(
								chalk.red(
									`Error: No direct content provided for paragraph ${
										currentParagraphIndex + 1
									}. This indicates an error in the pipeline.`
								)
							);
						}
					} else {
						// Fallback: sequential update (unchanged old behavior)
						for (let i = 0; i < contentToMerge.length; i++) {
							if (i < mergedParagraphs.length) {
								mergedParagraphs[i] = contentToMerge[i];
							} else {
								mergedParagraphs.push(contentToMerge[i]);
							}
						}
					}
				}

				console.log(
					chalk.dim(
						`Final merged paragraphs count: ${mergedParagraphs.length}`
					)
				);

				// Combine with existing frontmatter - ensure a proper newline after the frontmatter
				const combinedContent = `${existingFrontmatter}\n\n${mergedParagraphs.join(
					"\n\n"
				)}`;

				// Write the file
				try {
					await fs.writeFile(
						refinedTranslation,
						combinedContent,
						"utf-8"
					);
					console.log(
						chalk.green(
							`Successfully wrote ${combinedContent.length} characters to ${refinedTranslation}`
						)
					);
					return true;
				} catch (writeError) {
					console.error(
						chalk.red(`Error writing file: ${writeError.message}`)
					);
					throw writeError;
				}
			}
		}

		// If we don't have existing content or couldn't extract frontmatter,
		// process content with frontmatter from scratch
		const processedContent = await processTranslationWithFrontmatter(
			suttaId,
			refinedContents,
			originalContent,
			englishTitle
		);

		// Ensure there's always a newline after the frontmatter
		let finalContent = processedContent;
		if (finalContent.includes("---\n")) {
			finalContent = finalContent.replace("---\n", "---\n\n");
		}

		await fs.writeFile(refinedTranslation, finalContent, "utf-8");
		return true;
	} catch (error) {
		console.error(`Error saving translation: ${error.message}`);
		return false;
	}
}
