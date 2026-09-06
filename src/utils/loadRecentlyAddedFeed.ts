import fs from "fs";
import path from "path";
import { getCollection, type CollectionEntry } from "astro:content";
import { getPtsDisplay } from "./ptsReferences";
import discourseAdditionsJson from "../data/discourseAdditions.json";
import {
	DISCOURSE_ADDITIONS_PATH,
	buildAddedItems,
	collectionFromEnglishPath,
	isEnglishDiscourseEntry,
	parseDiscourseAdditions,
	type DiscourseAdditions,
	type DiscourseMeta,
	type RecentDiscourseItem,
} from "./recentDiscourses";

/**
 * Prefer the on-disk state file (dev / prerender). Fall back to the bundled
 * JSON: Vercel SSR cwd has no `src/data/`, and a missing file used to
 * silently yield an empty homepage feed.
 */
export function loadDiscourseAdditions(): DiscourseAdditions {
	try {
		const file = path.join(process.cwd(), DISCOURSE_ADDITIONS_PATH);
		if (fs.existsSync(file)) {
			return parseDiscourseAdditions(
				JSON.parse(fs.readFileSync(file, "utf-8")) as unknown,
			);
		}
	} catch (error) {
		console.warn("recently-added: could not read state file:", error);
	}
	return parseDiscourseAdditions(discourseAdditionsJson);
}

export async function loadRecentlyAddedFeed(): Promise<RecentDiscourseItem[]> {
	const additions = loadDiscourseAdditions();
	const allDiscourses = await getCollection("all");
	const records: DiscourseMeta[] = allDiscourses
		.filter((discourse: CollectionEntry<"all">) =>
			isEnglishDiscourseEntry({
				filePath: discourse.filePath,
				id: discourse.id,
			}),
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
