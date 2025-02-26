import { DeepseekService } from "./llm/deepseek-service.js";

/**
 * Registry of available LLM services
 */
const LLM_SERVICES = {
	"deepseek-reasoner": DeepseekService,
	"deepseek-chat": DeepseekService,
};

/**
 * Gets an LLM service by name
 * @param {string} modelName - Name of the model to use
 * @returns {Object} LLM service instance
 */
export function getLlmService(modelName) {
	if (!LLM_SERVICES[modelName]) {
		throw new Error(
			`Unknown model: ${modelName}. Available models: ${Object.keys(
				LLM_SERVICES
			).join(", ")}`
		);
	}

	// Create service instance with the model name for configuration
	const service = new LLM_SERVICES[modelName]();
	service.modelName = modelName; // Set model name so service knows which model to use
	
	return service;
}
