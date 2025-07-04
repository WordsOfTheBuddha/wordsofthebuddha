import { getAllTopics, getCollection } from "./loadTopics.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TopicMapping {
	title: string;
	description: string;
	synonyms?: string[];
	pali?: string[];
	redirects?: string[];
	discourses: Array<{
		id: string;
		title: string;
		description: string;
		collection: string;
		note?: string;
	}>;
}

interface TopicMappings {
	[slug: string]: TopicMapping;
}

// Load discourse data from the existing JSON files in the content directory
function loadDiscourseData() {
	const contentDir = path.join(__dirname, "../content");
	console.log(`Looking for content in: ${contentDir}`);
	const discourseData: Record<
		string,
		{ title: string; description: string }
	> = {};

	// Load from various collection directories
	const collections = ["an", "dhp", "iti", "mn", "sn", "snp", "ud"];

	collections.forEach((collection) => {
		const collectionDir = path.join(contentDir, "en", collection);
		console.log(`Checking collection: ${collectionDir}`);
		if (fs.existsSync(collectionDir)) {
			const files = fs
				.readdirSync(collectionDir)
				.filter((f) => f.endsWith(".mdx"));
			console.log(`Found ${files.length} mdx files in ${collection}`);
			files.forEach((file) => {
				try {
					const filePath = path.join(collectionDir, file);
					const content = fs.readFileSync(filePath, "utf-8");

					// Extract frontmatter
					const frontmatterMatch = content.match(
						/^---\n([\s\S]*?)\n---/,
					);
					if (frontmatterMatch) {
						const frontmatter = frontmatterMatch[1];
						const titleMatch = frontmatter.match(
							/title:\s*["']?([^"'\n]+)["']?/,
						);
						const descMatch = frontmatter.match(
							/description:\s*["']?([^"'\n]+)["']?/,
						);

						if (titleMatch) {
							const id = file.replace(".mdx", "");
							discourseData[id] = {
								title: titleMatch[1].trim(),
								description: descMatch
									? descMatch[1].trim()
									: "",
							};
						}
					}
				} catch (error) {
					console.warn(`Failed to parse ${file}:`, error);
				}
			});
		} else {
			console.log(
				`Collection directory does not exist: ${collectionDir}`,
			);
		}
	});

	return discourseData;
}

// Helper function to load additional mappings
function loadAdditionalMappings(filename: string) {
	try {
		const mappingPath = path.join(__dirname, "../data", filename);
		if (fs.existsSync(mappingPath)) {
			return JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
		}
	} catch (error) {
		console.warn(`Could not load ${filename}:`, error);
	}
	return {};
}

// Helper function to find matching discourses from quality mappings
function findQualityDiscourses(
	topicTitle: string,
	slug: string,
	synonyms: string[] = [],
	qualityMappings: any,
) {
	const searchTerms = [
		slug.toLowerCase(),
		topicTitle.toLowerCase(),
		...synonyms.map((s) => s.toLowerCase()),
	];

	for (const searchTerm of searchTerms) {
		if (qualityMappings[searchTerm]) {
			console.log(`Found quality match for topic ${slug}: ${searchTerm}`);
			return qualityMappings[searchTerm];
		}
	}
	return [];
}

// Helper function to find matching discourses from simile mappings
function findSimileDiscourses(
	topicTitle: string,
	slug: string,
	synonyms: string[] = [],
	simileMappings: any,
) {
	const searchTerms = [
		slug.toLowerCase(),
		topicTitle.toLowerCase(),
		...synonyms.map((s) => s.toLowerCase()),
	];

	for (const searchTerm of searchTerms) {
		// Check all first letter groups in simile mappings
		for (const letterGroup of Object.values(simileMappings)) {
			if (typeof letterGroup === "object" && letterGroup !== null) {
				if ((letterGroup as any)[searchTerm]) {
					console.log(
						`Found simile match for topic ${slug}: ${searchTerm}`,
					);
					return (letterGroup as any)[searchTerm];
				}
			}
		}
	}
	return [];
}

// Helper function to merge additional discourses while avoiding duplicates
function mergeAdditionalDiscourses(
	existingDiscourses: any[],
	additionalDiscourses: any[],
	sourceType: string,
) {
	const existingIds = new Set(existingDiscourses.map((d) => d.id));
	const newDiscourses = additionalDiscourses
		.filter((discourse) => !existingIds.has(discourse.id))
		.map((discourse) => ({
			...discourse,
			// Don't add note since quality/simile discourses don't have notes
		}));

	return [...existingDiscourses, ...newDiscourses];
}

export async function generateTopicMappings() {
	console.log("Generating topic mappings...");

	// Load discourse data first
	const discourseData = loadDiscourseData();
	console.log(
		`Loaded ${Object.keys(discourseData).length} discourse entries`,
	);

	const allTopics = getAllTopics();
	const topicMappings: TopicMappings = {};

	for (const [slug, topic] of Object.entries(allTopics)) {
		console.log(`Processing topic: ${slug}`);

		const discourses = topic.discourses
			.map((discourse: any) => {
				const data = discourseData[discourse.id];
				if (!data) {
					console.warn(`Discourse entry not found: ${discourse.id}`);
					return null;
				}

				return {
					id: discourse.id,
					title: data.title,
					description: data.description,
					collection: getCollection(discourse.id),
					note: discourse.note,
				};
			})
			.filter(Boolean);

		// Load and merge additional mappings
		const qualityMappings = loadAdditionalMappings("qualityMappings.json");
		const simileMappings = loadAdditionalMappings("simileMappings.json");

		const qualityDiscourses = findQualityDiscourses(
			topic.title,
			slug,
			topic.synonyms,
			qualityMappings,
		);
		const simileDiscourses = findSimileDiscourses(
			topic.title,
			slug,
			topic.synonyms,
			simileMappings,
		);

		const allAdditionalDiscourses = [
			...qualityDiscourses,
			...simileDiscourses,
		];

		const mergedDiscourses = mergeAdditionalDiscourses(
			discourses,
			allAdditionalDiscourses,
			"additional",
		);

		topicMappings[slug] = {
			title: topic.title,
			description: topic.description,
			synonyms: topic.synonyms,
			pali: topic.pali,
			redirects: topic.redirects,
			discourses: mergedDiscourses,
		};
	}

	// Write to data directory
	const outputPath = path.join(__dirname, "../data/topicMappings.json");
	fs.writeFileSync(outputPath, JSON.stringify(topicMappings, null, 2));

	console.log(
		`Generated topic mappings for ${Object.keys(topicMappings).length} topics`,
	);
	console.log(`Written to: ${outputPath}`);
}

// Allow running as a script
if (import.meta.url === `file://${process.argv[1]}`) {
	generateTopicMappings().catch(console.error);
}
