#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { getTranslationPipeline } from "./workflow/pipeline.js";
import { loadPaliText } from "./services/file-service.js";
import { checkProgress, saveProgress } from "./utils/progress-tracker.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables from root .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../");
const envPath = path.join(projectRoot, ".env");

if (fs.existsSync(envPath)) {
	dotenv.config({ path: envPath });
	console.log(chalk.dim(`Loaded environment from ${envPath}`));
}

// Initialize commander
const program = new Command();

program
	.name("translation-cli")
	.description("Interactive CLI for translating Pali suttas")
	.version("0.1.0")
	.argument("<sutta-id>", "Sutta ID (e.g., an3.131)")
	.option("-d, --debug", "Show debug information including prompts")
	.option(
		"-f, --force",
		"Force retranslation of already translated paragraphs"
	)
	.option("-m, --model <model>", "LLM model to use (deepseek-reasoner, deepseek-chat)", "deepseek-reasoner")
		.option("-i, --instruction <instruction>", "Additional instruction for translating the last paragraph")
	.action(async (suttaId, options) => {
		try {
			console.log(
				chalk.bold(
					`🔄 Starting translation workflow for ${chalk.cyan(
						suttaId
					)}`
				)
			);

			// Get the translation pipeline
			const pipeline = getTranslationPipeline(options);

			// Execute the pipeline
			await pipeline.execute(suttaId);
		} catch (error) {
			console.error(chalk.red(`Error: ${error.message}`));
			if (options.debug) {
				console.error(error);
			}
			process.exit(1);
		}
	});

program.parse(process.argv);
