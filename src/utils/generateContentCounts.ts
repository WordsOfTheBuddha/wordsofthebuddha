#!/usr/bin/env node

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Script to generate content counts and update the data file
 */
function main() {
	try {
		const __dirname = path.dirname(fileURLToPath(import.meta.url));
		const scriptPath = path.join(__dirname, "addContentCounts.ts");
		execSync(`npx tsx ${scriptPath}`, { stdio: "inherit" });
	} catch (error) {
		console.error("Error generating content counts:", error);
		process.exit(1);
	}
}

main();
