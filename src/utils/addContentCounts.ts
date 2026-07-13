import fs from "fs/promises";
import path from "path";
import { directoryStructure } from "../data/directoryStructure.ts";
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
		const hasVaggaSections =
			dir.vaggaSections && Object.keys(dir.vaggaSections).length > 0;

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

		// Vagga sections count as leaf collections for content matching (AN pilot)
		if (hasVaggaSections) {
			for (const [vaggaKey, vaggaDir] of Object.entries(
				dir.vaggaSections!,
			)) {
				const vaggaPath = [...currentPath, vaggaKey];
				collections.set(vaggaKey, {
					path: vaggaPath,
					structure: vaggaDir,
					isLeaf: true,
				});
				leafCollections.add(vaggaKey);
			}
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

	// AN book vagga grouped discourse file (e.g. an4.1-10.mdx)
	const anVaggaFileMatch = baseName.match(/^([a-z]+\d+)\.(\d+)-(\d+)$/i);
	if (anVaggaFileMatch) {
		const exactVagga = leafCollections.find(
			({ key }) => key.toLowerCase() === baseName.toLowerCase(),
		);
		if (exactVagga) {
			const [, , start, end] = anVaggaFileMatch;
			return {
				collectionKey: exactVagga.key,
				count: parseInt(end) - parseInt(start) + 1,
			};
		}
	}

	// AN book vagga ranges for individual discourses (e.g. an4.5 -> an4.1-10)
	const anDiscourseMatch = baseName.match(/^([a-z]+\d+)\.(\d+)$/i);
	if (anDiscourseMatch) {
		const [, bookPrefix, suttaNumStr] = anDiscourseMatch;
		const suttaNum = parseInt(suttaNumStr);
		const vaggaMatches = leafCollections
			.filter(({ key, info }) => {
				const rangeMatch = key.match(/^([a-z]+\d+)\.(\d+)-(\d+)$/);
				if (rangeMatch) {
					const [, keyBook, rangeStart, rangeEnd] = rangeMatch;
					return (
						keyBook === bookPrefix &&
						suttaNum >= parseInt(rangeStart) &&
						suttaNum <= parseInt(rangeEnd)
					);
				}
				const snVaggaMatch = key.match(/^(sn)(\d+)-[a-z]+$/);
				if (snVaggaMatch) {
					const bookNum = Number(snVaggaMatch[2]);
					const range = info.structure?.range;
					return (
						bookPrefix === `sn${bookNum}` &&
						range &&
						suttaNum >= range.start &&
						suttaNum <= range.end
					);
				}
				return false;
			})
			.sort((a, b) => {
				const span = (key: string) => {
					const match = key.match(/^([a-z]+\d+)\.(\d+)-(\d+)$/);
					if (!match) return Number.POSITIVE_INFINITY;
					return parseInt(match[3]) - parseInt(match[2]);
				};
				return span(a.key) - span(b.key);
			});

		if (vaggaMatches.length > 0) {
			return {
				collectionKey: vaggaMatches[0].key,
				count: 1,
			};
		}
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
			.sort((a, b) => {
				const span = (key: string) => {
					const match = key.match(/^([a-z]+)(\d+)-(\d+)$/);
					if (!match) return Number.POSITIVE_INFINITY;
					return parseInt(match[3]) - parseInt(match[2]);
				};
				return span(a.key) - span(b.key);
			});

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
			return {
				collectionKey: matchingCollections[0].key,
				count: getCount(match),
			};
		}
	}

	console.warn(`content-counts: no collection match for ${filename}`);
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

	try {
		const files = await fs.readdir(dirPath);

		for (const file of files) {
			const result = parseFile(file, collections);
			if (result) {
				const { collectionKey, count } = result;

				const info = collections.get(collectionKey);
				if (info) {
					// Add count to this collection and all its parents
					info.path.forEach((pathKey) => {
						counts.set(pathKey, (counts.get(pathKey) || 0) + count);
					});
				}
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
		} else if (
			directory.vaggaSections &&
			Object.keys(directory.vaggaSections).length > 0
		) {
			const vaggaCounts: Record<string, DirectoryStructure> = {};
			for (const [vaggaKey, vaggaDir] of Object.entries(
				directory.vaggaSections,
			)) {
				vaggaCounts[vaggaKey] = {
					...vaggaDir,
					contentCount: collectionCounts.get(vaggaKey) || 0,
				};
			}
			newDirectory.vaggaSections = vaggaCounts;
			newDirectory.contentCount = collectionCounts.get(key) || 0;
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
		// Extract all collections from directory structure
		const collections = extractCollections(directoryStructure);

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

		return allCounts.size;
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
	generateContentCounts().then((collectionCount) => {
		console.log(
			`content-counts: wrote directoryStructureWithCounts.ts (${collectionCount} collections)`,
		);
	});
}
