import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import { readFileSync } from "fs";
import matter from "gray-matter";

interface DiscourseItem {
	id: string;
	title: string;
	description: string;
	collection: string;
	// Optional discourse-level priority from frontmatter
	priority?: number;
}

interface TopicEntry {
	title: string;
	redirects?: string[];
}

export async function generateQualityMappings() {
	try {
		// Dynamically read qualities.json to avoid caching issues
		const qualitiesPath = path.join(
			process.cwd(),
			"src/data/qualities.json"
		);
		const qualitiesContent = readFileSync(qualitiesPath, "utf8");
		const qualities = JSON.parse(qualitiesContent);

		// Dynamically read topicMappings.json to allow topic titles/slugs as qualities
		// This file may not exist on first build, so we handle that gracefully
		const topicMappingsPath = path.join(
			process.cwd(),
			"src/data/topicMappings.json"
		);
		
		// Build a set of valid topic identifiers (slugs, titles, and redirects)
		const validTopicIdentifiers = new Set<string>();
		
		if (fs.existsSync(topicMappingsPath)) {
			const topicMappingsContent = readFileSync(topicMappingsPath, "utf8");
			const topicMappings: Record<string, TopicEntry> = JSON.parse(topicMappingsContent);
			
			Object.entries(topicMappings).forEach(([slug, topic]) => {
				validTopicIdentifiers.add(slug);
				validTopicIdentifiers.add(topic.title.toLowerCase());
				if (topic.redirects) {
					topic.redirects.forEach((redirect) => {
						validTopicIdentifiers.add(redirect.toLowerCase());
					});
				}
			});
		}

		// Use glob to find all content files
		const contentFiles = globSync("src/content/en/**/*.mdx");

		const qualityMap = new Map<string, DiscourseItem[]>();
		const allQualities = [
			...qualities.positive,
			...qualities.negative,
			...qualities.neutral,
		];

		// Initialize map with empty arrays
		allQualities.forEach((quality) => {
			qualityMap.set(quality, []);
		});

		// Process each content file
		contentFiles.forEach((filePath) => {
			try {
				const content = readFileSync(filePath, "utf8");
				const { data } = matter(content);

				if (!data.qualities) return;

				// Get collection from file path
				const pathParts = filePath.split("/");
				const collection = pathParts[pathParts.length - 2];

				const qualityList = data.qualities
					.split(",")
					.map((q: string) => q.trim());

				qualityList.forEach((quality: string) => {
					if (qualityMap.has(quality)) {
						qualityMap.get(quality)!.push({
							id: data.slug,
							title: data.title,
							description: data.description || "",
							collection: collection,
							// Pull optional `priority` from frontmatter if present
							priority:
								typeof (data as any).priority === "number"
									? (data as any).priority
									: undefined,
						});
					} else if (!validTopicIdentifiers.has(quality.toLowerCase())) {
						// Only warn if it's not a valid quality AND not a valid topic identifier
						console.warn(
							`⚠️ Quality "${quality}" found in ${filePath} but not in qualities.json or topicMappings.json`
						);
					}
				});
			} catch (err) {
				console.error(`Error processing file ${filePath}:`, err);
			}
		});

		// Define collection priority order (lower number = higher precedence)
		const collectionPriority: Record<string, number> = {
			mn: 1,
			iti: 2,
			sn: 3,
			snp: 4,
			an: 5,
			ud: 6,
			dhp: 7,
		};

		// Sort discourses for each quality
		qualityMap.forEach((discourses: DiscourseItem[], quality: string) => {
			discourses.sort((a: DiscourseItem, b: DiscourseItem) => {
				// Priority first (higher value first). Undefined priorities go last.
				const aHasPriority = typeof a.priority === "number";
				const bHasPriority = typeof b.priority === "number";

				if (aHasPriority && bHasPriority) {
					if (a.priority !== b.priority) {
						// Descending: higher priority number first
						return (b.priority as number) - (a.priority as number);
					}
				} else if (aHasPriority !== bHasPriority) {
					// Item with a numeric priority should come before one without
					return aHasPriority ? -1 : 1;
				}

				// Then by collection priority
				const cpa = collectionPriority[a.collection] ?? 999;
				const cpb = collectionPriority[b.collection] ?? 999;
				if (cpa !== cpb) return cpa - cpb;

				// Finally by natural id
				return a.id.localeCompare(b.id, undefined, {
					numeric: true,
					sensitivity: "base",
				});
			});
		});

		// Convert to serializable object
		const qualityData: Record<string, DiscourseItem[]> = {};
		let emptyQualitiesCount = 0;
		qualityMap.forEach((discourses: DiscourseItem[], quality: string) => {
			qualityData[quality] = discourses;
			if (discourses.length === 0) {
				emptyQualitiesCount++;
			}
		});

		// Write to file
		fs.writeFileSync(
			path.join(process.cwd(), "src/data/qualityMappings.json"),
			JSON.stringify(qualityData, null, 2)
		);

		console.log(`✅ Quality mappings generated successfully`);
		if (emptyQualitiesCount > 0) {
			console.log(
				`⚠️ ${emptyQualitiesCount} qualities have no associated discourses`
			);
		}
	} catch (err) {
		console.error("Error generating quality mappings:", err);
	}
}

// Run the function when this module is the main module
generateQualityMappings().catch(console.error);
