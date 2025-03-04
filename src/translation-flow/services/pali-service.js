import fetch from "node-fetch";
import chalk from "chalk";

const API_ENDPOINT = "/api/pali/batch-lookup";
const MAX_BATCH_SIZE = 1000;

/**
 * Gets the base URL for API calls
 * @returns {string} Base URL
 */
function getApiBaseUrl() {
	// Use localhost in development
	return process.env.API_BASE_URL || "https://wordsofthebuddha.org";
}

/**
 * Performs a batch lookup of Pali words
 * @param {string[]} words Array of Pali words to look up
 * @returns {Promise<Object>} Dictionary of word meanings
 */
export async function batchLookupWords(words) {
	try {
		// Deduplicate words
		const uniqueWords = [...new Set(words)];

		// Process in batches to avoid overloading the API
		const batches = [];
		for (let i = 0; i < uniqueWords.length; i += MAX_BATCH_SIZE) {
			batches.push(uniqueWords.slice(i, i + MAX_BATCH_SIZE));
		}

		let results = {};

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			console.log(
				chalk.dim(
					`Processing batch ${i + 1} of ${batches.length} (${
						batch.length
					} words)`
				)
			);

			const batchResults = await lookupBatch(batch);
			results = { ...results, ...batchResults };
		}

		return results;
	} catch (error) {
		console.error(`Error looking up words: ${error.message}`);
		return {};
	}
}

/**
 * Performs a single batch API call
 * @param {string[]} words Batch of words to look up
 * @returns {Promise<Object>} Word meanings dictionary
 */
async function lookupBatch(words) {
	try {
		const baseUrl = getApiBaseUrl();
		const url = `${baseUrl}${API_ENDPOINT}`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ words }),
		});

		if (!response.ok) {
			throw new Error(
				`API returned ${response.status}: ${response.statusText}`
			);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		console.error(`API error: ${error.message}`);
		throw error;
	}
}
