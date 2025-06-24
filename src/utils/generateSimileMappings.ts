import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import { readFileSync } from "fs";
import matter from "gray-matter";

export async function generateSimileMappings() {
	try {
		// Use glob to find all content files
		const contentFiles = globSync("src/content/en/**/*.mdx");

		// Map to store similes by their starting letter
		const simileMap = {};

		// Process each content file
		for (const filePath of contentFiles) {
			try {
				const content = readFileSync(filePath, "utf8");
				const { data } = matter(content);

				if (!data.simile) continue;

				// Get collection from file path
				const pathParts = filePath.split("/");
				const collection = pathParts[pathParts.length - 2];

				// Split similes and process each one
				const simileList = data.simile.split(",").map((s) => s.trim());

				simileList.forEach((simile) => {
					// Determine the letter for categorization
					let mainWord = simile.split(" ")[0].toLowerCase();

					// Handle special cases
					if (simile.includes("tree") && !mainWord.includes("tree")) {
						mainWord = "tree";
					} else if (
						simile.includes("mud") &&
						!mainWord.includes("mud")
					) {
						mainWord = "mud";
					} else if (
						simile.includes("water") &&
						!mainWord.includes("water")
					) {
						mainWord = "water";
					} else if (
						(simile.includes("himalayan") ||
							simile.includes("mountain")) &&
						!mainWord.includes("mountain")
					) {
						mainWord = "mountain";
					} else if (
						simile.includes("clay") &&
						!mainWord.includes("clay")
					) {
						mainWord = "clay";
					}

					// Get the first letter for categorization
					const firstLetter = mainWord.charAt(0).toLowerCase();

					// Initialize nested objects if they don't exist
					if (!simileMap[firstLetter]) {
						simileMap[firstLetter] = {};
					}
					if (!simileMap[firstLetter][simile]) {
						simileMap[firstLetter][simile] = [];
					}

					// Add discourse information
					simileMap[firstLetter][simile].push({
						id: data.slug,
						title: data.title,
						description: data.description || "",
						collection: collection,
					});
				});
			} catch (err) {
				console.error(`Error processing file ${filePath}:`, err);
			}
		}

		// Write to file without comments (to avoid JSON parsing issues)
		fs.writeFileSync(
			path.join(process.cwd(), "src/data/simileMappings.json"),
			JSON.stringify(simileMap, null, 2),
		);

		console.log("Simile mappings generated successfully");
	} catch (err) {
		console.error("Error generating simile mappings:", err);
	}
}

// Run the function when this module is the main module
generateSimileMappings().catch(console.error);
