import fs from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { glob } from "glob";
import type { Topic } from "../types/topics";

function getCollection(id: string): string {
	const match = id.match(/^[a-z]{2,3}/i);
	return match ? match[0].toLowerCase() : "";
}

export function loadTopic(slug: string): Topic | null {
	try {
		const path = join(
			process.cwd(),
			"src",
			"pages",
			"topic",
			"_topics",
			`${slug}.yaml`,
		);
		const content = fs.readFileSync(path, "utf8");
		const parsed = yaml.load(content) as Topic;

		if (
			!parsed.title ||
			!parsed.description ||
			!Array.isArray(parsed.discourses)
		) {
			console.error(`Invalid topic structure for ${slug}`);
			return null;
		}

		return parsed;
	} catch (error) {
		console.error(`Error loading topic ${slug}:`, error);
		return null;
	}
}

export function topicExists(slug: string): boolean {
	const path = join(
		process.cwd(),
		"src",
		"pages",
		"topic",
		"_topics",
		`${slug}.yaml`,
	);
	try {
		const stats = fs.statSync(path);
		return stats.isFile();
	} catch {
		return false;
	}
}

export function getAllTopicSlugs(): string[] {
	const pattern = join(
		process.cwd(),
		"src",
		"pages",
		"topic",
		"_topics",
		"*.yaml",
	);
	return glob
		.sync(pattern)
		.map(
			(path: string) => path.split("/").pop()?.replace(".yaml", "") || "",
		);
}

export function getAllTopics(): Record<string, Topic> {
	const topics: Record<string, Topic> = {};

	getAllTopicSlugs().forEach((slug) => {
		const topic = loadTopic(slug);
		if (topic) {
			topics[slug] = topic;
		}
	});

	return topics;
}

export function findTopicByRedirect(redirectTerm: string): string | null {
	const topics = getAllTopics();

	for (const [slug, topic] of Object.entries(topics)) {
		if (topic.redirects && topic.redirects.includes(redirectTerm)) {
			return slug;
		}
	}

	return null;
}

export function getTotalDiscourseCount(slug: string, topic: Topic): number {
	let count = topic.discourses.length;

	// Check if this topic is also a quality
	try {
		const qualityMappings = require("../data/qualityMappings.json");
		if (qualityMappings[slug]) {
			const qualityDiscourses = qualityMappings[slug] || [];
			const curatedIds = topic.discourses.map((d) => d.id);
			const additionalCount = qualityDiscourses.filter(
				(id: string) => !curatedIds.includes(id),
			).length;
			count += additionalCount;
		}
	} catch (error) {
		// Quality mappings not found or error reading
	}

	// Check if this topic is also a simile
	try {
		const simileMappings = require("../data/simileMappings.json");
		const firstLetter = slug[0];
		if (simileMappings[firstLetter] && simileMappings[firstLetter][slug]) {
			const simileDiscourses = simileMappings[firstLetter][slug] || [];
			const curatedIds = topic.discourses.map((d) => d.id);
			const additionalCount = simileDiscourses.filter(
				(d: any) => !curatedIds.includes(d.id),
			).length;
			count += additionalCount;
		}
	} catch (error) {
		// Simile mappings not found or error reading
	}

	return count;
}

export { getCollection };
