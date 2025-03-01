import chalk from "chalk";

/**
 * The prompt template for translation
 */
const PROMPT_TEMPLATE = `
# Pali to English Translation Task

You are a highly skilled translator specializing in Pali Buddhist texts. Your task is to translate a paragraph from Pali to English with high fidelity while maintaining readability.

## Translation Process

Please translate the following Pali text in two passes:

### Pass 1: Analytical Translation
Break down the text at a sentence or sub-sentence level. Focus on capturing the grammatical structure and meaning accurately. Show your work by explaining key grammatical elements and word choices.

### Pass 2: Refined Translation
Create a more polished, readable translation that preserves the meaning while being natural English. Prioritize fidelity to the original Pali while enhancing flow. Choose from the provided translation meanings unless a more suitable alternative is clear. Ensure no Pāli text is omitted. For verses, maintain line-wise fidelity to the Pali text whenever possible.

## Word Meanings Dictionary
Below is a dictionary of word meanings to assist your translation:

{{WORD_MEANINGS}}

Below is the previous translated and approved text of prior paragraphs. Your translation should be consistent with the established terminology and style.

{{PREVIOUS_CONTEXT}}

## Pali Text to Translate

{{PARAGRAPH}}

## Output Format Requirements

Your final output must strictly adhere to the following format to facilitate automated extraction. Do not include any extra commentary outside these sections:

# Pass 1: Analytical Translation
[Your detailed analytical translation with explanations]

# Pass 2: Refined Translation
[Your polished English translation]
`;

/**
 * Formats word meanings for the prompt
 * @param {Object} wordMeanings Dictionary of word meanings
 * @returns {string} Formatted word meanings
 */
function formatWordMeanings(wordMeanings) {
	let result = "";

	for (const [word, meanings] of Object.entries(wordMeanings)) {
		result += `- ${word}: `;

		if (Array.isArray(meanings) && meanings.length > 0) {
			const definitionsList = meanings
				.map((m) => {
					let def = `${m.meaning || ""}`;
					if (m.lemma) def += ` [lemma: ${m.lemma}]`;
					if (m.meaning_lit) def += ` (lit: "${m.meaning_lit}")`;
					if (m.pos) def += ` (${m.pos})`;
					return def;
				})
				.join("; ");

			result += definitionsList;
		} else {
			result += "No definition available";
		}

		result += "\n";
	}

	return result;
}

/**
 * Save a prompt to a debug file with sutta ID and paragraph information
 * @param {string} prompt The prompt text to save
 * @param {string} debugDir The debug directory
 * @param {Object} fs Filesystem module
 * @param {Object} path Path module
 * @param {string} suttaId Optional sutta ID
 * @param {number} paragraphIndex Optional paragraph index
 */
function debugSavePrompt(prompt, debugDir, fs, path, suttaId, paragraphIndex) {
	// Use the suttaId if provided, or try to extract it from the prompt
	const extractedSuttaId =
		suttaId ||
		(() => {
			const match = prompt.match(
				/\b(an|sn|mn|dn|kp|dhp|ud|iti|snp)\d+(\.\d+)*\b/i
			);
			return match ? match[0].toLowerCase() : null;
		})();

	// Create filename with suttaId and paragraph info if available
	let filename = "prompt-sample";
	if (extractedSuttaId) {
		filename += `-${extractedSuttaId}`;
		if (paragraphIndex !== null) {
			filename += `-paragraph-${paragraphIndex + 1}`;
		}
	} else {
		// Fallback to timestamp if no suttaId available
		filename += `-${Date.now()}`;
	}
	filename += `.txt`;

	fs.writeFileSync(path.join(debugDir, filename), prompt);
	console.log(chalk.dim(`Debug prompt saved to ${filename}`));
}

/**
 * Formats previous translations for context
 * @param {string[]} previousPali Previous Pali paragraphs
 * @param {string[]} previousTranslations Previous English translations
 * @returns {string} Formatted context section
 */
function formatPreviousContext(previousPali, previousTranslations) {
	// Add debug to check when no context is available
	const hasContext =
		previousPali.length > 0 && previousTranslations.length > 0;
	console.log(`Previous context availability: ${hasContext ? "YES" : "NO"}`);

	if (!hasContext) {
		return "";
	}

	let result = "## Context from Previous Paragraphs\n";
	const contextLength = Math.min(
		previousPali.length,
		previousTranslations.length
	);

	for (let i = 0; i < contextLength; i++) {
		result += `\nPali: ${previousPali[i]}\nEnglish: ${previousTranslations[i]}\n`;
	}

	// Debug the length of context data being included
	console.log(
		`Including ${contextLength} paragraph(s) in prompt context section`
	);

	return result;
}

/**
 * Builds a translation prompt for the LLM using a template
 * @param {Object} params Prompt parameters
 * @param {string} params.paragraph Pali paragraph to translate
 * @param {Object} params.wordMeanings Dictionary of word meanings from API
 * @param {string[]} params.previousPali Previous Pali paragraphs for context
 * @param {string[]} params.previousTranslations Previous English translations
 * @param {boolean} params.isTitle Whether this is a title translation (optional)
 * @param {string} params.additionalInstruction Additional instructions to include in the prompt (optional)
 * @returns {string} Formatted prompt
 */
export function buildPrompt({
	paragraph,
	wordMeanings,
	previousPali = [],
	previousTranslations = [],
	isTitle = false,
	additionalInstruction = null,
	suttaId = null,
	paragraphIndex = null,
}) {
	// Format template variables
	const formattedWordMeanings = formatWordMeanings(wordMeanings);
	const formattedContext = formatPreviousContext(
		previousPali,
		previousTranslations
	);

	// Add special instruction for title translations
	let modifiedTemplate = PROMPT_TEMPLATE;
	if (isTitle) {
		modifiedTemplate = PROMPT_TEMPLATE.replace(
			"You are a highly skilled translator specializing in Pali Buddhist texts.",
			"You are a highly skilled translator specializing in Pali Buddhist texts. The text you are translating is a TITLE, so keep it concise and clear."
		);
	}

	// Add any additional instructions provided by the user
	if (additionalInstruction) {
		modifiedTemplate = modifiedTemplate.replace(
			"[Your polished English translation]",
			`[Your polished English translation]\n\n## Additional Instructions\n\n${additionalInstruction}\n\n`
		);
	}

	// Replace template variables
	const finalPrompt = modifiedTemplate
		.replace("{{WORD_MEANINGS}}", formattedWordMeanings)
		.replace("{{PREVIOUS_CONTEXT}}", formattedContext)
		.replace("{{PARAGRAPH}}", paragraph);

	// Debug context section presence
	const contextSectionIncluded = finalPrompt.includes(
		"Context from Previous Paragraphs"
	);
	console.log(
		`Context section included in prompt: ${
			contextSectionIncluded ? "YES" : "NO"
		}`
	);

	// Save a sample prompt for debugging
	try {
		// Use ES modules syntax for importing
		import("fs").then((fs) => {
			import("path").then((path) => {
				const debugDir = path.join(
					path.dirname(new URL(import.meta.url).pathname),
					"../../.debug"
				);
				if (!fs.existsSync(debugDir)) {
					fs.mkdirSync(debugDir, { recursive: true });
				}

				// Get suttaId and paragraphIndex from previous context if available
				let suttaId = null;
				let paragraphIndex = null;

				// Try to find suttaId in the prompt itself - check for typical Sutta IDs patterns
				const suttaIdMatch = finalPrompt.match(
					/\b(an|sn|mn|dn|kp|dhp|ud|iti|snp)\d+(\.\d+)*\b/i
				);
				if (suttaIdMatch) {
					suttaId = suttaIdMatch[0].toLowerCase();
				}

				// Create filename with suttaId and paragraph info if available
				let filename = "prompt-sample";
				if (suttaId) {
					filename += `-${suttaId}`;
					if (paragraphIndex !== null) {
						filename += `-paragraph-${paragraphIndex + 1}`;
					}
				}
				filename += `.txt`;

				fs.writeFileSync(path.join(debugDir, filename), finalPrompt);
				console.log(chalk.dim(`Debug prompt saved to ${filename}`));
			});
		});
	} catch (error) {
		console.error("Error saving debug prompt:", error.message);
	}

	return finalPrompt;
}

/**
 * Formats a curl command for making an API request
 * @param {string} prompt The prompt text
 * @param {string} model The model name
 * @returns {string} Formatted curl command
 */
/**
 * Formats a curl command for making an API request
 * @param {string} prompt The prompt text
 * @param {string} model The model name
 * @param {Object} options Additional options
 * @param {string} options.suttaId Sutta ID for debug files (optional)
 * @param {number} options.paragraphIndex Paragraph index for debug files (optional)
 * @returns {string} Formatted curl command
 */
export function formatCurl(prompt, model, options = {}) {
	let baseUrl = "";
	let headers = "";
	let data = "";
	const { suttaId = null, paragraphIndex = null } = options;

	// Create a debug file name with sutta ID and paragraph number if available
	const getDebugFileName = (prefix = "curl-command") => {
		if (suttaId && paragraphIndex !== null) {
			return `${prefix}-${suttaId}-paragraph-${paragraphIndex + 1}.sh`;
		} else if (suttaId) {
			return `${prefix}-${suttaId}-${Date.now()}.sh`;
		} else {
			return `${prefix}-${Date.now()}.sh`;
		}
	};

	if (model.startsWith("deepseek")) {
		baseUrl = "https://api.deepseek.com/v1/chat/completions";
		headers =
			'-H "Content-Type: application/json" -H "Authorization: Bearer $DEEPSEEK_API_KEY"';

		// Use the appropriate model name based on input
		const modelName =
			model === "deepseek-chat" ? "deepseek-chat" : "deepseek-reasoner";

		// Check if prompt contains context section for debugging
		const hasContextSection = prompt.includes(
			"Context from Previous Paragraphs"
		);
		console.log(
			`Context section included in curl command: ${
				hasContextSection ? "YES" : "NO"
			}`
		);

		// First 100 chars of prompt for verification
		console.log(`Prompt begins with: ${prompt.substring(0, 100)}...`);

		data = JSON.stringify(
			{
				model: modelName,
				messages: [{ role: "user", content: prompt }],
				temperature: 0.2,
				top_p: 0.9,
				max_tokens: 4000,
			},
			null,
			2
		);

		// Save the full formatted curl command for reference
		try {
			// Use dynamic imports for ES modules
			import("fs").then((fs) => {
				import("path").then((path) => {
					const debugDir = path.join(
						path.dirname(new URL(import.meta.url).pathname),
						"../../.debug"
					);
					if (!fs.existsSync(debugDir)) {
						fs.mkdirSync(debugDir, { recursive: true });
					}
					const curlOutput = `curl -X POST ${baseUrl} \\
${headers} \\
-d '${data.replace(/'/g, "'\\''")}'`;
					const filename = getDebugFileName();
					fs.writeFileSync(path.join(debugDir, filename), curlOutput);
					console.log(chalk.dim(`Curl command saved to ${filename}`));
				});
			});
		} catch (error) {
			console.error("Error saving curl command:", error.message);
		}
	}

	return `curl -X POST ${baseUrl} \\
${headers} \\
-d '${data.replace(/'/g, "'\\''")}'`;
}
