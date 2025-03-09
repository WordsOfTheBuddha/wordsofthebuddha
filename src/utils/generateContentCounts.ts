#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Script to generate content counts and update the data file
 */
function main() {
	try {
		console.log("Generating content counts...");

		// Create __dirname equivalent for ES modules
		const __dirname = path.dirname(fileURLToPath(import.meta.url));

		// Run the addContentCounts script with debugging
		const scriptPath = path.join(__dirname, "addContentCounts.ts");
		execSync(`npx tsx ${scriptPath}`, { stdio: "inherit" });

		console.log("Content counts generated successfully!");
	} catch (error) {
		console.error("Error generating content counts:", error);
		process.exit(1);
	}
}

main();
