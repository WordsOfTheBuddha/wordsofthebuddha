import type { UnifiedContentItem } from "../types/discover";

type CategoryDiscourse = UnifiedContentItem["discourses"][number];

/**
 * `buildAllContent()` for all four kinds, with discourse rows shared across
 * categories stored once (the same sutta appears under many qualities).
 * `/search` fetches this as JSON instead of bundling the mapping files as JS.
 */
export interface CategorySearchIndexFile {
	version: 1;
	discourses: CategoryDiscourse[];
	items: Array<Omit<UnifiedContentItem, "discourses"> & { discourses: number[] }>;
}

export function encodeCategorySearchIndex(
	items: UnifiedContentItem[],
): CategorySearchIndexFile {
	// JSON round-trip first so dedup keys and the decoded output both match
	// what a JSON consumer would see (undefined fields dropped).
	const plain = JSON.parse(JSON.stringify(items)) as UnifiedContentItem[];
	const indexByKey = new Map<string, number>();
	const discourses: CategoryDiscourse[] = [];
	return {
		version: 1,
		discourses,
		items: plain.map((item) => ({
			...item,
			discourses: item.discourses.map((discourse) => {
				const key = JSON.stringify(discourse);
				let index = indexByKey.get(key);
				if (index === undefined) {
					index = discourses.length;
					discourses.push(discourse);
					indexByKey.set(key, index);
				}
				return index;
			}),
		})),
	};
}

export function decodeCategorySearchIndex(
	file: CategorySearchIndexFile,
): UnifiedContentItem[] {
	if (file?.version !== 1 || !Array.isArray(file.items)) {
		throw new Error("Unsupported category search index");
	}
	return file.items.map((item) => ({
		...item,
		discourses: item.discourses.map((index) => ({ ...file.discourses[index] })),
	}));
}
