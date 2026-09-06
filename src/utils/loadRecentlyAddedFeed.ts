import fs from "fs";
import path from "path";
import { getCollection, type CollectionEntry } from "astro:content";
import { getPtsDisplay } from "./ptsReferences";
import {
	DISCOURSE_ADDITIONS_PATH,
	buildAddedItems,
	collectionFromEnglishPath,
	isEnglishDiscoursePath,
	type DiscourseAdditions,
	type DiscourseMeta,
	type RecentDiscourseItem,
} from "./recentDiscourses";

export function loadDiscourseAdditions(): DiscourseAdditions {
	try {
		const file = path.join(process.cwd(), DISCOURSE_ADDITIONS_PATH);
		if (!fs.existsSync(file)) return {};
		const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const additions: DiscourseAdditions = {};
		for (const [slug, value] of Object.entries(parsed)) {
			if (typeof value === "string" && value) additions[slug] = value;
		}
		return additions;
	} catch (error) {
		console.warn("recently-added: could not read state file:", error);
		return {};
	}
}

export async function loadRecentlyAddedFeed(): Promise<RecentDiscourseItem[]> {
	const additions = loadDiscourseAdditions();
	const allDiscourses = await getCollection("all");
	const records: DiscourseMeta[] = allDiscourses
		.filter(
			(discourse: CollectionEntry<"all">) =>
				Boolean(discourse.filePath) &&
				isEnglishDiscoursePath(discourse.filePath ?? ""),
		)
		.map((discourse: CollectionEntry<"all">) => ({
			slug: discourse.data.slug,
			title: discourse.data.title,
			description: discourse.data.description ?? "",
			collection: collectionFromEnglishPath(
				discourse.filePath ?? "",
				discourse.data.slug,
			),
			volpage: getPtsDisplay(discourse.data.slug) || undefined,
		}));
	return buildAddedItems(records, additions);
}
