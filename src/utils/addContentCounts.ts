import fs from "fs/promises";
import path from "path";
import { directoryStructure } from "../data/directoryStructure";
import type { DirectoryStructure } from "../types/directory";

const BASE_CONTENT_PATH = path.join(process.cwd(), "src/content/en");
const COLLECTIONS = ["sn", "an", "mn", "dn", "dhp", "snp", "iti", "ud"];

interface CollectionInfo {
	path: string[];
	structure: DirectoryStructure;
	isLeaf: boolean;
}

function extractCollections(
	structure: Record<string, DirectoryStructure>,
	parentPath: string[] = [],
): Map<string, CollectionInfo> {
	const collections = new Map<string, CollectionInfo>();
	const leafCollections = new Set<string>();

	for (const [key, dir] of Object.entries(structure)) {
		const currentPath = [...parentPath, key];
		const hasChildren =
			dir.children && Object.keys(dir.children).length > 0;

		// A leaf collection is one without children
		const isLeaf = !hasChildren;

		// Add this collection to the map
		collections.set(key, {
			path: currentPath,
			structure: dir,
			isLeaf,
		});

		if (isLeaf) {
			leafCollections.add(key);
		}

		// Process children recursively if they exist
		if (hasChildren) {
			const childCollections = extractCollections(
				dir.children!,
				currentPath,
			);
			for (const [childKey, childInfo] of childCollections) {
				collections.set(childKey, childInfo);
				if (childInfo.isLeaf) {
					leafCollections.add(childKey);
				}
			}
		}
	}

	// Log the leaf collections for verification
	console.log("Leaf collections:", Array.from(leafCollections).sort());

	return collections;
}

/**
 * Extract collection key and count from a filename
 */
function parseFile(
	filename: string,
	collections: Map<string, CollectionInfo>,
): { collectionKey: string; count: number } | null {
	// Only process .mdx files that have a number before the extension
	if (!/\d\.mdx$/.test(filename)) return null;

	const baseName = filename.replace(/\.mdx$/, "");

	// Get only leaf collections
	const leafCollections = Array.from(collections.entries())
		.filter(([_, info]) => info.isLeaf)
		.map(([key, info]) => ({ key, info }));

	// Special handling for dhp range files (e.g., dhp1-20.mdx)
	const dhpMatch = baseName.match(/^(dhp)(\d+)-(\d+)$/i);
	if (dhpMatch) {
		const [_, prefix, start, end] = dhpMatch;
		return {
			collectionKey: prefix,
			count: parseInt(end) - parseInt(start) + 1,
		};
	}

	// Try to match range collections (like mn1-50) for files like mn1, mn2, etc.
	const simpleMatch = baseName.match(/^([a-z]+)(\d+)(?:\.\d+)?$/i);
	if (simpleMatch) {
		const [_, prefix, num] = simpleMatch;
		const fileNum = parseInt(num);

		// Find range collections that match this file number
		const rangeMatches = leafCollections
			.filter(({ key, info }) => {
				const rangeMatch = key.match(/^([a-z]+)(\d+)-(\d+)$/);
				if (!rangeMatch) return false;

				const [__, rangePrefix, rangeStart, rangeEnd] = rangeMatch;
				return (
					prefix === rangePrefix &&
					fileNum >= parseInt(rangeStart) &&
					fileNum <= parseInt(rangeEnd)
				);
			})
			.sort((a, b) => a.key.length - b.key.length);

		if (rangeMatches.length > 0) {
			return {
				collectionKey: rangeMatches[0].key,
				count: 1,
			};
		}
	}

	// Try to match exact collection keys first
	// This is for files like sn3.1.mdx -> sn3 and sn33.1.mdx -> sn33
	const exactPrefixMatch = baseName.match(/^([a-z]+\d+)(?:\.\d+.*)?$/i);
	if (exactPrefixMatch) {
		const [_, collectionPrefix] = exactPrefixMatch;

		// First look for exact collection match
		const exactCollection = leafCollections.find(
			({ key }) => key.toLowerCase() === collectionPrefix.toLowerCase(),
		);

		if (exactCollection) {
			// Check if this is a range file like sn33.6-10.mdx
			const rangeMatch = baseName.match(/^[a-z]+\d+\.(\d+)-(\d+)$/i);
			if (rangeMatch) {
				const [_, start, end] = rangeMatch;
				return {
					collectionKey: exactCollection.key,
					count: parseInt(end) - parseInt(start) + 1,
				};
			}

			// Otherwise it's a single file
			return {
				collectionKey: exactCollection.key,
				count: 1,
			};
		}
	}

	// For other patterns, use the most specific pattern but ensure we don't match ambiguously
	const patterns = [
		// Decimal range (e.g., "an1.1-10") -> collection: "an1"
		{
			pattern: /^([a-z]+\d+)\.(\d+)-(\d+)$/i,
			getKey: (m: RegExpMatchArray) => m[1],
			getCount: (m: RegExpMatchArray) =>
				parseInt(m[3]) - parseInt(m[2]) + 1,
		},
		// Decimal notation (e.g., "snp4.2") -> collection: "snp4"
		{
			pattern: /^([a-z]+\d+)\.(\d+)$/i,
			getKey: (m: RegExpMatchArray) => m[1],
			getCount: () => 1,
		},
		// Simple number (e.g., "mn70") -> collection: "mn70"
		{
			pattern: /^([a-z]+\d+)$/i,
			getKey: (m: RegExpMatchArray) => m[1],
			getCount: () => 1,
		},
	];

	for (const { pattern, getKey, getCount } of patterns) {
		const match = baseName.match(pattern);
		if (!match) continue;

		const key = getKey(match);

		// Try to match with precise collection boundaries
		// e.g., "sn3" should not match "sn30" or "sn31"
		const matchingCollections = leafCollections
			.filter(({ key: collKey }) => {
				// Use word boundary or digit/dot boundary to ensure proper matching
				const regex = new RegExp(`^${collKey}(?:\\b|\\d|\\.)`);
				return regex.test(key) || key === collKey;
			})
			.sort((a, b) => b.key.length - a.key.length);

		if (matchingCollections.length > 0) {
			console.log(
				`  Found ${baseName} -> ${matchingCollections[0].key} using pattern matching`,
			);
			return {
				collectionKey: matchingCollections[0].key,
				count: getCount(match),
			};
		}
	}

	console.log(`  WARNING: No collection match found for ${filename}`);
	return null;
}

/**
 * Process files in a directory and map them to collections
 */
async function processFiles(
	dirPath: string,
	collections: Map<string, CollectionInfo>,
): Promise<Map<string, number>> {
	const counts = new Map<string, number>();
	const matchDebug = new Map<string, string[]>();

	try {
		const files = await fs.readdir(dirPath);
		console.log(`Processing files in ${dirPath}:`);

		for (const file of files) {
			const result = parseFile(file, collections);
			if (result) {
				const { collectionKey, count } = result;

				// Add to debug tracking
				if (!matchDebug.has(collectionKey)) {
					matchDebug.set(collectionKey, []);
				}
				matchDebug.get(collectionKey)?.push(`${file} (${count})`);

				const info = collections.get(collectionKey);
				if (info) {
					// Add count to this collection and all its parents
					info.path.forEach((pathKey) => {
						counts.set(pathKey, (counts.get(pathKey) || 0) + count);
					});
				}
				console.log(`  ${file} -> ${collectionKey} (${count})`);
			} else {
				console.log(`  Skipped ${file}`);
			}
		}

		// Print debug info for leaf collections
		console.log("\nCollection match summary:");
		for (const [collKey, files] of matchDebug.entries()) {
			console.log(
				`  ${collKey} (${counts.get(collKey) || 0}): ${
					files.length
				} files`,
			);
			if (files.length <= 10) {
				console.log(`    ${files.join(", ")}`);
			} else {
				console.log(
					`    ${files.slice(0, 5).join(", ")}... and ${
						files.length - 5
					} more`,
				);
			}
		}
	} catch (error) {
		console.warn(`Error reading ${dirPath}:`, error);
	}

	return counts;
}

/**
 * Roll up counts from specific to general collections
 */
function rollUpCounts(collections: Map<string, number>): Map<string, number> {
	const result = new Map(collections);

	// Process each collection
	for (const [key, count] of collections.entries()) {
		// Extract base collection (e.g., "snp" from "snp4")
		const baseCollection = key.replace(/\d+$/, "");
		if (baseCollection !== key && COLLECTIONS.includes(baseCollection)) {
			// Add this count to the base collection's total
			result.set(
				baseCollection,
				(result.get(baseCollection) || 0) + count,
			);
		}
	}

	return result;
}

/**
 * Recursively process the directory structure
 */
async function processDirectoryStructure(
	structure: Record<string, DirectoryStructure>,
	collectionCounts: Map<string, number>,
): Promise<Record<string, DirectoryStructure>> {
	const result: Record<string, DirectoryStructure> = {};

	for (const [key, directory] of Object.entries(structure)) {
		const newDirectory = { ...directory };

		if (directory.children && Object.keys(directory.children).length > 0) {
			// Process children recursively
			newDirectory.children = await processDirectoryStructure(
				directory.children,
				collectionCounts,
			);
			// Sum up children counts
			newDirectory.contentCount = Object.values(
				newDirectory.children,
			).reduce((sum, child) => sum + (child.contentCount || 0), 0);
		} else {
			// Leaf node - get count from our pre-processed collection counts
			newDirectory.contentCount = collectionCounts.get(key) || 0;
		}

		result[key] = newDirectory;
	}

	return result;
}

/**
 * Main function to run the script
 */
export async function generateContentCounts() {
	try {
		console.log("Starting content count process...");

		// Extract all collections from directory structure
		const collections = extractCollections(directoryStructure);
		console.log("All collections:", Array.from(collections.keys()).sort());
		console.log(
			"Leaf collections only:",
			Array.from(collections.entries())
				.filter(([_, info]) => info.isLeaf)
				.map(([key]) => key)
				.sort(),
		);

		// Process files for each base collection
		const allCounts = new Map<string, number>();
		for (const baseKey of new Set(
			Array.from(collections.values()).map((info) => info.path[0]),
		)) {
			const dirPath = path.join(BASE_CONTENT_PATH, baseKey);
			const counts = await processFiles(dirPath, collections);

			// Merge counts
			for (const [key, count] of counts) {
				allCounts.set(key, (allCounts.get(key) || 0) + count);
			}
		}

		console.log(
			"\nFinal collection counts:",
			Object.fromEntries(allCounts),
		);

		// Then, apply these counts to the directory structure
		const enrichedStructure = await processDirectoryStructure(
			directoryStructure,
			allCounts,
		);

		// Write to output file
		await fs.writeFile(
			path.join(
				process.cwd(),
				"src/data/directoryStructureWithCounts.ts",
			),
			`// This file is auto-generated - do not edit directly
import type { DirectoryStructure } from "../types/directory";\n\n` +
				`export const directoryStructureWithCounts: Record<string, DirectoryStructure> = ${JSON.stringify(
					enrichedStructure,
					null,
					2,
				)};\n`,
		);

		console.log(
			"Content counts added successfully to directoryStructureWithCounts.ts",
		);
	} catch (error) {
		console.error("Error adding content counts:", error);
		process.exit(1);
	}
}

// Only run when executed directly (not when imported as a module)
const isDirectRun =
	process.argv[1]?.includes("addContentCounts") ||
	process.argv[1]?.includes("generateContentCounts");
if (isDirectRun) {
	generateContentCounts();
}
