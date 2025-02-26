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
Create a more polished, readable translation that preserves the meaning while being natural English. Prioritize fidelity to the original Pali but improve readability and flow. You should aim for choosing from the translation meanings provided in the prompt except in a rare case where there is a more suitable choice. No Pāli text should be omitted in the translation. When translating a verse, maintain a line-wise fidelity to the Pali text whenever possible.

## Word Meanings Dictionary
Below is a dictionary of word meanings to assist your translation:

{{WORD_MEANINGS}}

Below is the previous translated and approved text of prior paragraphs. Your translation should be consistent with the established terminology and style.

{{PREVIOUS_CONTEXT}}

## Pali Text to Translate

{{PARAGRAPH}}

Please provide your translation in the following format. Include and notes or explanation before the refined translation.

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
 * Formats previous translations for context
 * @param {string[]} previousPali Previous Pali paragraphs
 * @param {string[]} previousTranslations Previous English translations
 * @returns {string} Formatted context section
 */
function formatPreviousContext(previousPali, previousTranslations) {
	if (previousPali.length === 0 || previousTranslations.length === 0) {
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
	return modifiedTemplate
		.replace("{{WORD_MEANINGS}}", formattedWordMeanings)
		.replace("{{PREVIOUS_CONTEXT}}", formattedContext)
		.replace("{{PARAGRAPH}}", paragraph);
}

/**
 * Formats a curl command for making an API request
 * @param {string} prompt The prompt text
 * @param {string} model The model name
 * @returns {string} Formatted curl command
 */
export function formatCurl(prompt, model) {
	let baseUrl = "";
	let headers = "";
	let data = "";

	if (model.startsWith("deepseek")) {
		baseUrl = "https://api.deepseek.com/v1/chat/completions";
		headers =
			'-H "Content-Type: application/json" -H "Authorization: Bearer $DEEPSEEK_API_KEY"';

		// Use the appropriate model name based on input
		const modelName =
			model === "deepseek-chat" ? "deepseek-chat" : "deepseek-reasoner";

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
	}

	return `curl -X POST ${baseUrl} \\
${headers} \\
-d '${data.replace(/'/g, "'\\''")}'`;
}
