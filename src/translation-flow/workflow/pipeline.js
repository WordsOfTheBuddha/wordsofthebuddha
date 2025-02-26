import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import {
	loadPaliText,
	checkTranslationExists,
	loadTranslation,
	loadRawTranslation,
	saveTranslation,
} from "../services/file-service.js";
import { parseParagraphs, extractWords } from "../utils/paragraph-parser.js";
import { batchLookupWords } from "../services/pali-service.js";
import { buildPrompt, formatCurl } from "../utils/prompt-builder.js";
import { getLlmService } from "../services/llm-registry.js";

/**
 * Creates a translation pipeline based on options
 * @param {Object} options CLI options
 * @returns {Object} Pipeline with execute method
 */
export function getTranslationPipeline(options) {
	return {
		// The main execution function for the pipeline
		async execute(suttaId) {
			// Step 1: Load the Pali text
			const paliText = await loadPaliText(suttaId);
			if (!paliText) {
				throw new Error(`Could not find Pali text for ${suttaId}`);
			}

			// Step 2: Check if translation exists and load if available
			const translationExists = await checkTranslationExists(suttaId);
			let existingTranslation = null;
			if (translationExists) {
				existingTranslation = await loadTranslation(suttaId);
				console.log(
					chalk.yellow(`Found existing translation for ${suttaId}`)
				);
			}

			// Step 3: Parse paragraphs from Pali text
			const { paragraphs: paliParagraphs, title: paliTitle } =
				parseParagraphs(paliText);
			console.log(
				chalk.blue(
					`Found ${paliParagraphs.length} paragraphs to process`
				)
			);
			if (paliTitle) {
				console.log(chalk.blue(`Extracted Pali title: "${paliTitle}"`));
			}

			// Step 4: Get LLM service based on options
			const llmService = getLlmService(options.model);

			// Step 5: Prepare for processing
			let translatedParagraphs = [];
			let existingRawOutputs = [];
			let englishTitle = null;

			// Try to load existing raw translations to preserve them
			const rawTranslation = await loadRawTranslation(suttaId);
			if (rawTranslation) {
				existingRawOutputs = rawTranslation.split("\n\n---\n\n");
				console.log(
					chalk.yellow(
						`Found ${existingRawOutputs.length} previous raw translations`
					)
				);
			}

			if (existingTranslation) {
				// Parse existing translation for paragraphs
				const { paragraphs: existingParagraphs } =
					parseParagraphs(existingTranslation);
				translatedParagraphs = [...existingParagraphs]; // Create a copy to avoid reference issues

				// Extract title from front matter if it exists
				const titleMatch =
					existingTranslation.match(/title:\s*([^\n]+)/);
				if (titleMatch && titleMatch[1]) {
					const fullTitle = titleMatch[1].trim();
					// If title contains " - ", the part after is the English title
					if (fullTitle.includes(" - ")) {
						englishTitle = fullTitle.split(" - ")[1].trim();
						console.log(
							chalk.blue(`Found English title: "${englishTitle}"`)
						);
					}
				}
			}

			// Step 6: Process title separately if not already translated
			if (paliTitle && !englishTitle && paliParagraphs.length > 0) {
				console.log(chalk.bold(`\nTranslating title: "${paliTitle}"`));

				// Extract words from title and look them up
				const titleWords = extractWords(paliTitle);
				console.log(
					chalk.blue(
						`Looking up ${titleWords.length} words from title...`
					)
				);
				const titleWordMeanings = await batchLookupWords(titleWords);

				// Build prompt specifically for the title
				const titlePrompt = buildPrompt({
					paragraph: paliTitle,
					wordMeanings: titleWordMeanings,
					previousPali: [],
					previousTranslations: [],
					isTitle: true,
				});

				// Translate the title
				console.log(
					chalk.blue(
						`Sending title to ${options.model} for translation...`
					)
				);
				try {
					const titleTranslation = await llmService.translate(
						titlePrompt,
						{ model: options.model }
					);

					console.log(chalk.green("\nTitle Translation:"));
					console.log(titleTranslation);

					// Extract the translated title from the output (looking for the refined translation)
					const titleMatch = titleTranslation.match(
						/# Pass 2: Refined Translation\s+([\s\S]+?)(?:$|(?=# ))/i
					);
					if (titleMatch && titleMatch[1]) {
						englishTitle = titleMatch[1].trim();
						console.log(
							chalk.green(
								`Using English title: "${englishTitle}"`
							)
						);
					} else {
						// Fallback: just use the whole output
						englishTitle = titleTranslation.trim();
					}

					// Add to the raw outputs array
					if (existingRawOutputs.length === 0) {
						existingRawOutputs.push(titleTranslation);
					}
				} catch (error) {
					console.error(
						chalk.red(`Error translating title: ${error.message}`)
					);
					console.log(
						chalk.yellow("Continuing without translated title")
					);
				}
			}

			// Step 7: Process each paragraph
			for (let i = 0; i < paliParagraphs.length; i++) {
				console.log(
					chalk.bold(
						`\nProcessing paragraph ${i + 1} of ${
							paliParagraphs.length
						}`
					)
				);

				// If additional instruction is provided, always process the last translated paragraph
				const hasAdditionalInstruction = !!options.instruction;
				const isLastTranslated = i === translatedParagraphs.length - 1;

				// Special handling for instruction mode
				if (hasAdditionalInstruction && isLastTranslated) {
					console.log(
						chalk.blue(
							`Re-translating last paragraph with additional instruction:`
						)
					);
					console.log(chalk.cyan(`"${options.instruction}"`));

					// When we're in instruction mode, we should log which paragraph we're updating
					console.log(
						chalk.blue(
							`Targeting paragraph ${translatedParagraphs.length} of ${paliParagraphs.length}`
						)
					);
				}

				// Skip if already translated and not forced, unless it's the last translated paragraph and we have additional instructions
				if (
					i < translatedParagraphs.length &&
					!options.force &&
					!(hasAdditionalInstruction && isLastTranslated)
				) {
					console.log(
						chalk.yellow(
							`Paragraph ${
								i + 1
							} already translated. Use --force to retranslate.`
						)
					);
					continue;
				}

				// Current paragraph to translate
				const paragraph = paliParagraphs[i];

				// Extract words and make batch lookup
				const words = extractWords(paragraph);
				console.log(chalk.blue(`Looking up ${words.length} words...`));
				const wordMeanings = await batchLookupWords(words);

				// Build the prompt with previous context
				// Use only translated paragraphs for context, not raw outputs
				const previousTranslations = translatedParagraphs.slice(0, i);
				const previousPali = paliParagraphs.slice(0, i);
				const prompt = buildPrompt({
					paragraph,
					wordMeanings,
					previousPali,
					previousTranslations,
					additionalInstruction: options.instruction,
				});

				// Save the curl command for later display
				const curlCommand = formatCurl(prompt, options.model);

				// Flag to track if we're showing prompt details only
				let showPromptMode = false;
				let translation = "";
				let finalTranslation = "";
				let action = "accept"; // Default action

				try {
					do {
						// If we're not just showing the prompt, make the API call
						if (!showPromptMode) {
							// Send to LLM for translation
							console.log(
								chalk.blue(
									`Sending to ${options.model} for translation...`
								)
							);
							translation = await llmService.translate(prompt, {
								model: options.model,
							});
							finalTranslation = translation;

							// Show translation
							console.log(chalk.green("\nTranslation:"));
							console.log(translation);

							if (options.debug) {
								console.log(chalk.dim("\nDebug Info:"));
								console.log(
									chalk.dim("Curl command to reproduce:")
								);
								console.log(chalk.dim(curlCommand));
							}
						}

						// Reset the flag
						showPromptMode = false;

						// Prompt user for action
						const response = await inquirer.prompt([
							{
								type: "list",
								name: "action",
								message: "What would you like to do?",
								choices: [
									{
										name: "Accept and continue",
										value: "accept",
									},
									{
										name: "Edit before saving",
										value: "edit",
									},
									{
										name: "Show prompt used",
										value: "prompt",
									},
									{
										name: "Retry with different settings",
										value: "retry",
									},
									{
										name: "Skip this paragraph",
										value: "skip",
									},
								],
							},
						]);

						action = response.action;

						if (action === "prompt") {
							// Just show the prompt without making an API call
							console.log(chalk.dim("\nPrompt used:"));
							console.log(chalk.dim(prompt));
							console.log(chalk.dim("\nCurl command:"));
							console.log(chalk.dim(curlCommand));
							showPromptMode = true; // Set flag to prevent API call on next loop
						} else if (action === "edit") {
							// Ask for editor preference
							const { editorChoice } = await inquirer.prompt([
								{
									type: "list",
									name: "editorChoice",
									message: "Choose editor:",
									choices: [
										{ name: "Use VSCode", value: "vscode" },
										{
											name: "Use default editor",
											value: "default",
										},
									],
								},
							]);

							if (editorChoice === "vscode") {
								// Create a temporary file and open in VSCode
								const os = await import("os");
								const fs = await import("fs/promises");
								const { exec } = await import("child_process");
								const { promisify } = await import("util");
								const execPromise = promisify(exec);

								const tempFile = path.join(
									os.tmpdir(),
									`translation-${Date.now()}.md`
								);
								await fs.writeFile(
									tempFile,
									translation,
									"utf8"
								);

								console.log(
									chalk.blue(`Opening in VSCode: ${tempFile}`)
								);
								await execPromise(`code -w "${tempFile}"`);

								// Read back the edited content
								try {
									finalTranslation = await fs.readFile(
										tempFile,
										"utf8"
									);
									console.log(
										chalk.dim(
											"VSCode edit content loaded, length: " +
												finalTranslation.length +
												" characters"
										)
									);
								} catch (fsError) {
									console.error(
										chalk.red(
											`Error reading back edited file: ${fsError.message}`
										)
									);
									throw new Error(
										`Failed to read back edited file: ${fsError.message}`
									);
								}

								// Clean up
								try {
									await fs.unlink(tempFile);
								} catch (err) {
									console.log(
										chalk.yellow(
											`Note: Couldn't delete temp file: ${tempFile}`
										)
									);
								}

								// Debug logs
								console.log(
									chalk.blue("Content from VSCode editor:")
								);
								console.log(
									chalk.dim(
										finalTranslation.substring(0, 100) +
											"..."
									)
								); // Show first 100 chars
							} else {
								// Use default inquirer editor
								const { edited } = await inquirer.prompt([
									{
										type: "editor",
										name: "edited",
										message: "Edit the translation:",
										default: translation,
									},
								]);
								finalTranslation = edited;
							}
							break; // Exit the loop after editing
						} else if (action === "retry") {
							i--; // Stay on same paragraph
							break; // Exit the loop to retry
						} else if (action === "skip") {
							break; // Exit the loop to skip
						} else {
							// Accept
							break; // Exit the loop to accept
						}
					} while (showPromptMode); // Continue loop only when showing prompt

					// Check if we need to retry or skip
					if (action === "retry" || action === "skip") {
						continue;
					}

					// Update raw outputs array
					if (hasAdditionalInstruction && isLastTranslated) {
						// In instruction mode, replace the existing raw translation for the last paragraph
						// Find the correct index in raw outputs (account for title if present)
						const rawIndex = englishTitle ? i + 1 : i;

						// Store the raw translation at the appropriate index for later reference
						if (rawIndex < existingRawOutputs.length) {
							existingRawOutputs[rawIndex] = finalTranslation;
						} else {
							// If the index is out of bounds, just append
							// This won't affect the refined output's paragraph placement
							existingRawOutputs.push(finalTranslation);
						}
					} else {
						// Store raw output at current paragraph index (for reference only)
						// This is decoupled from the refined output's paragraph placement
						const rawIndex = englishTitle ? i + 1 : i;
						if (rawIndex < existingRawOutputs.length) {
							existingRawOutputs[rawIndex] = finalTranslation;
						} else {
							existingRawOutputs.push(finalTranslation);
						}
					}

					// Validate raw outputs array doesn't exceed expected length
					const expectedMaxLength =
						paliParagraphs.length + (englishTitle ? 1 : 0);
					if (existingRawOutputs.length > expectedMaxLength) {
						console.log(
							chalk.yellow(
								`Warning: Raw outputs array (${existingRawOutputs.length}) exceeds expected length (${expectedMaxLength}). Trimming extra entries.`
							)
						);
						existingRawOutputs = existingRawOutputs.slice(
							0,
							expectedMaxLength
						);
					}

					// Debugging output before saving
					console.log(
						chalk.dim(
							`Raw outputs array length: ${existingRawOutputs.length}`
						)
					);

					// Save progress after each paragraph
					const saveResult = await saveTranslation(
						suttaId,
						existingRawOutputs,
						englishTitle,
						hasAdditionalInstruction && isLastTranslated, // Pass flag for instruction mode
						i, // Pass the current paragraph index from Pali text
						finalTranslation // Pass the actual content directly to avoid confusion
					);
					if (saveResult) {
						console.log(
							chalk.green(
								`✓ Successfully saved paragraph ${i + 1}/${
									paliParagraphs.length
								}`
							)
						);
					} else {
						console.log(
							chalk.red(
								`✗ Failed to save paragraph ${i + 1}/${
									paliParagraphs.length
								}`
							)
						);
					}
				} catch (error) {
					console.error(
						chalk.red(
							`Error translating paragraph ${i + 1}: ${
								error.message
							}`
						)
					);
					if (options.debug) {
						console.error(error);
					}

					// Give more specific options when an error occurs
					const { errorAction } = await inquirer.prompt([
						{
							type: "list",
							name: "errorAction",
							message: "What would you like to do?",
							choices: [
								{
									name: "Retry API translation for this paragraph",
									value: "retry-api",
								},
								{
									name: "Continue with current translation (will save it)",
									value: "continue",
								},
								{
									name: "Edit manually before saving",
									value: "edit",
								},
								{
									name: "Skip this paragraph (will not save it)",
									value: "skip",
								},
							],
							default: "retry-api",
						},
					]);

					if (errorAction === "retry-api") {
						i--; // Stay on same paragraph to retry
					} else if (errorAction === "edit") {
						// Use default editor to avoid external editor errors
						const { edited } = await inquirer.prompt([
							{
								type: "editor",
								name: "edited",
								message: "Edit the translation:",
								default:
									translation ||
									"Enter your translation here...",
							},
						]);
						finalTranslation = edited;

						// Store it in raw outputs for reference only
						// The actual paragraph placement in the refined output is handled by saveTranslation
						const rawIndex = englishTitle ? i + 1 : i;
						if (rawIndex < existingRawOutputs.length) {
							existingRawOutputs[rawIndex] = finalTranslation;
						} else {
							existingRawOutputs.push(finalTranslation);
						}

						// Save progress, passing the current paragraph index
						await saveTranslation(
							suttaId,
							existingRawOutputs,
							englishTitle,
							false, // Not in instruction mode
							i // Current paragraph index
						);
						console.log(
							chalk.green(
								`Saved manually edited paragraph ${i + 1}`
							)
						);
					} else if (errorAction === "continue" && translation) {
						// Save the current translation even though there was an error
						// Store it in raw outputs for reference only
						const rawIndex = englishTitle ? i + 1 : i;
						if (rawIndex < existingRawOutputs.length) {
							existingRawOutputs[rawIndex] = translation;
						} else {
							existingRawOutputs.push(translation);
						}

						// Save progress, passing the current paragraph index
						await saveTranslation(
							suttaId,
							existingRawOutputs,
							englishTitle,
							false, // Not in instruction mode
							i // Current paragraph index
						);
						console.log(
							chalk.green(
								`Saved current translation for paragraph ${
									i + 1
								} despite error`
							)
						);
					} else if (errorAction === "skip") {
						console.log(
							chalk.yellow(`Skipping paragraph ${i + 1}`)
						);
					}
				}
			}

			console.log(
				chalk.bold.green(`\n✅ Translation of ${suttaId} completed!`)
			);
		},
	};
}
