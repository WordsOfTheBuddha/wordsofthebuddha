import fetch from "node-fetch";
import chalk from "chalk";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Try to load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../../");
const envPath = path.join(projectRoot, ".env");

if (fs.existsSync(envPath)) {
	dotenv.config({ path: envPath });
}

const API_BASE_URL = "https://api.deepseek.com";
const API_VERSION = "v1";
const MAX_RETRIES = 1;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Service for interacting with DeepSeek API
 */
export class DeepseekService {
	constructor() {
		this.apiKey = process.env.DEEPSEEK_API_KEY;

		if (!this.apiKey) {
			console.warn(
				chalk.yellow(
					"DEEPSEEK_API_KEY environment variable not set. DeepSeek service may not work."
				)
			);
		}
	}

	/**
	 * Get the correct model name to use with the API
	 * @param {string} modelOption - Model option (from CLI)
	 * @returns {string} The API model identifier
	 */
	getModelName(modelOption) {
		if (modelOption === "deepseek-chat") {
			return "deepseek-chat";
		}
		return "deepseek-reasoner";
	}

	/**
	 * Sleep for a specified number of milliseconds
	 * @param {number} ms - Milliseconds to sleep
	 * @returns {Promise<void>}
	 */
	async sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Safely parse JSON with better error handling
	 * @param {string} text - JSON string to parse
	 * @returns {Object} Parsed JSON object
	 * @throws {Error} Improved error with context
	 */
	safeJsonParse(text) {
		try {
			return JSON.parse(text);
		} catch (error) {
			// Log a portion of the text to help debug
			console.error("JSON parse error. Response excerpt:");
			console.error(text.substring(0, 500) + "...");
			console.error("End of excerpt");

			// Try to analyze and fix common JSON issues
			let fixedText = text;

			// Check if it's wrapped in single quotes instead of double quotes
			if (text.startsWith("'") && text.endsWith("'")) {
				fixedText = text.substring(1, text.length - 1);
				console.log(
					"Attempting to fix JSON: Removing surrounding single quotes"
				);
			}

			// Check for unescaped newlines in strings
			if (fixedText.includes('"\n"')) {
				fixedText = fixedText.replace(/"\n"/g, "\\n");
				console.log(
					"Attempting to fix JSON: Escaping newlines in strings"
				);
			}

			// Try parsing the fixed text
			try {
				return JSON.parse(fixedText);
			} catch (secondError) {
				// If that still fails, throw a more descriptive error
				throw new Error(
					`Failed to parse JSON response: ${error.message}`
				);
			}
		}
	}

	/**
	 * Translates text using DeepSeek API with retry logic
	 * @param {string} prompt - The translation prompt
	 * @param {Object} options - Options for translation (optional)
	 * @param {string} options.model - Model name to use (default: deepseek-reasoner)
	 * @returns {Promise<string>} Translated text
	 */
	async translate(prompt, options = {}) {
		let lastError = null;
		let retries = 0;

		while (retries < MAX_RETRIES) {
			try {
				if (!this.apiKey) {
					throw new Error(
						"DEEPSEEK_API_KEY environment variable not set"
					);
				}

				if (retries > 0) {
					console.log(
						chalk.yellow(
							`Retry attempt ${retries}/${MAX_RETRIES}...`
						)
					);
					await this.sleep(RETRY_DELAY * retries); // Exponential backoff
				}

				// Debug prompt content - uncomment when debugging
				// console.log(chalk.dim("Prompt content:"));
				// console.log(chalk.dim(prompt.substring(0, 200) + "...")); // First 200 chars

				console.log(chalk.dim("Making API request to DeepSeek..."));
				const response = await fetch(
					`${API_BASE_URL}/${API_VERSION}/chat/completions`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${this.apiKey}`,
						},
						body: JSON.stringify({
							model: this.getModelName(options.model),
							messages: [{ role: "user", content: prompt }],
							temperature: 0.2, // Lower for more deterministic outputs
							top_p: 0.9,
							max_tokens: 4000, // Allow for detailed translation
						}),
					}
				);

				if (!response.ok) {
					const errorText = await response.text();
					console.error(
						chalk.red(`API error response: ${errorText}`)
					);
					throw new Error(
						`DeepSeek API error: ${response.status} - ${errorText}`
					);
				}

				// Read text from response
				const text = await response.text();
				console.log(
					chalk.dim(`Received ${text.length} bytes from API`)
				);

				// For debugging, write the full response to a temp file
				const debugDir = path.join(__dirname, "../../.debug");
				if (!fs.existsSync(debugDir)) {
					fs.mkdirSync(debugDir, { recursive: true });
				}
				const debugFile = path.join(
					debugDir,
					`deepseek-response-${Date.now()}.json`
				);
				fs.writeFileSync(debugFile, text, "utf8");
				console.log(chalk.dim(`Full response saved to ${debugFile}`));

				// Parse the response with improved error handling
				const data = this.safeJsonParse(text);

				// More robust checks on response structure
				if (!data) {
					throw new Error("Empty response from API");
				}

				if (
					!data.choices ||
					!Array.isArray(data.choices) ||
					data.choices.length === 0
				) {
					console.error(
						"Unexpected API response structure:",
						JSON.stringify(data, null, 2)
					);
					throw new Error("API response missing 'choices' array");
				}

				const firstChoice = data.choices[0];
				if (
					!firstChoice ||
					!firstChoice.message ||
					!firstChoice.message.content
				) {
					console.error(
						"Unexpected choice structure:",
						JSON.stringify(firstChoice, null, 2)
					);
					throw new Error("API response missing message content");
				}

				// Success! Return the content
				return firstChoice.message.content;
			} catch (error) {
				lastError = error;
				console.error(
					chalk.red(
						`DeepSeek API error (attempt ${
							retries + 1
						}/${MAX_RETRIES}): ${error.message}`
					)
				);
				retries++;

				// If we've reached max retries, break and throw the error
				if (retries >= MAX_RETRIES) {
					break;
				}
			}
		}

		// If we get here, all retries failed
		throw new Error(
			`DeepSeek translation failed after ${MAX_RETRIES} attempts: ${lastError.message}`
		);
	}
}
