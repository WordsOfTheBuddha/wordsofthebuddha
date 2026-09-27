import type { UnifiedContentItem } from "../types/discover";

export type CategoryDiscourse = UnifiedContentItem["discourses"][number];
type CategoryDiscourseRow = Omit<CategoryDiscourse, "description"> & {
	description?: string;
};

/**
 * `buildAllContent()` for all four kinds, with discourse rows shared across
 * categories stored once (the same sutta appears under many qualities).
 * `/search` fetches this as JSON instead of bundling the mapping files as JS.
 * Discourse descriptions only show on expanded cards, so they ship in a
 * separate file aligned with `discourses`.
 */
export interface CategorySearchIndexFile {
	version: 1;
	discourses: CategoryDiscourseRow[];
	items: Array<Omit<UnifiedContentItem, "discourses"> & { discourses: number[] }>;
}

export type CategoryDescriptionsFile = Array<string | null>;

export function encodeCategorySearchIndex(items: UnifiedContentItem[]): {
	index: CategorySearchIndexFile;
	descriptions: CategoryDescriptionsFile;
} {
	// JSON round-trip first so dedup keys and the decoded output both match
	// what a JSON consumer would see (undefined fields dropped).
	const plain = JSON.parse(JSON.stringify(items)) as UnifiedContentItem[];
	const indexByKey = new Map<string, number>();
	const rows: CategoryDiscourse[] = [];
	const encodedItems = plain.map((item) => ({
		...item,
		discourses: item.discourses.map((discourse) => {
			const key = JSON.stringify(discourse);
			let index = indexByKey.get(key);
			if (index === undefined) {
				index = rows.length;
				rows.push(discourse);
				indexByKey.set(key, index);
			}
			return index;
		}),
	}));
	return {
		index: {
			version: 1,
			discourses: rows.map(({ description: _, ...row }) => row),
			items: encodedItems,
		},
		descriptions: rows.map((row) =>
			"description" in row ? row.description : null,
		),
	};
}

/**
 * Items share row objects from `discourses` (renderers only read them), so
 * `applyCategoryDescriptions` on the returned rows updates every item.
 */
export function decodeCategorySearchIndex(file: CategorySearchIndexFile): {
	items: UnifiedContentItem[];
	discourses: CategoryDiscourseRow[];
} {
	if (file?.version !== 1 || !Array.isArray(file.items)) {
		throw new Error("Unsupported category search index");
	}
	const rows = file.discourses;
	return {
		discourses: rows,
		items: file.items.map((item) => ({
			...item,
			discourses: item.discourses.map(
				(index) => rows[index] as CategoryDiscourse,
			),
		})),
	};
}

export function applyCategoryDescriptions(
	rows: CategoryDiscourseRow[],
	descriptions: CategoryDescriptionsFile,
): void {
	if (!Array.isArray(descriptions) || descriptions.length !== rows.length) {
		throw new Error("Category descriptions do not match the index");
	}
	rows.forEach((row, i) => {
		const description = descriptions[i];
		if (description !== null) row.description = description;
	});
}
