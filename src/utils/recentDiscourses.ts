export const RECENT_KIND_FILTERS = ["new", "updated", "all"] as const;
export const RECENT_RANGES = ["20", "30d", "90d"] as const;
export const RECENT_COLLECTIONS = [
	"dn",
	"mn",
	"sn",
	"an",
	"ud",
	"iti",
	"snp",
	"dhp",
	"kp",
] as const;

export type RecentKindFilter = (typeof RECENT_KIND_FILTERS)[number];
export type RecentRange = (typeof RECENT_RANGES)[number];
export type RecentCollection = (typeof RECENT_COLLECTIONS)[number];
export type RecentKind = "new" | "updated";

export type RecentFilters = {
	kind: RecentKindFilter;
	range: RecentRange;
	collection: "all" | RecentCollection;
};

export const DEFAULT_RECENT_FILTERS: RecentFilters = {
	kind: "new",
	range: "20",
	collection: "all",
};

export const NEW_FEED_LIMIT = 80;
export const UPDATED_FEED_LIMIT = 80;
/** Edits within this window of first-add still count as new, not updated. */
export const NEW_GRACE_MS = 36 * 60 * 60 * 1000;

const COLLECTION_CHIP_LABEL: Record<RecentCollection, string> = {
	dn: "DN",
	mn: "MN",
	sn: "SN",
	an: "AN",
	ud: "Ud",
	iti: "Iti",
	snp: "Snp",
	dhp: "Dhp",
	kp: "Kp",
};

export type RecentDiscourseRecord = {
	slug: string;
	title: string;
	description: string;
	collection: string;
	added: Date | null;
	modified: Date;
	volpage?: string;
};

export type RecentDiscourseItem = {
	slug: string;
	title: string;
	description: string;
	collection: string;
	kind: RecentKind;
	added: string;
	modified: string;
	volpage?: string;
};

export function isEnglishDiscoursePath(filePath: string): boolean {
	const p = filePath.replace(/\\/g, "/");
	if (!p.includes("src/content/en/")) return false;
	if (p.includes("/anthologies/")) return false;
	if (p.includes("/books/")) return false;
	if (/(?:^|\/)index\.mdx$/.test(p)) return false;
	return p.endsWith(".mdx");
}

export function collectionFromEnglishPath(
	filePath: string,
	slug?: string,
): string {
	const p = filePath.replace(/\\/g, "/");
	const fromPath = p.match(/src\/content\/en\/([^/]+)\//);
	if (fromPath?.[1]) return fromPath[1];
	const fromSlug = slug?.match(/^([a-z]+)/i);
	return fromSlug?.[1]?.toLowerCase() ?? "";
}

export function collectionChipLabel(collection: string): string {
	if (collection === "all") return "All";
	return (
		COLLECTION_CHIP_LABEL[collection as RecentCollection] ||
		collection.toUpperCase()
	);
}

function isKindFilter(value: string | null): value is RecentKindFilter {
	return (
		value !== null &&
		(RECENT_KIND_FILTERS as readonly string[]).includes(value)
	);
}

function isRange(value: string | null): value is RecentRange {
	return value !== null && (RECENT_RANGES as readonly string[]).includes(value);
}

function isCollection(
	value: string | null,
): value is RecentCollection | "all" {
	if (value === "all") return true;
	return (
		value !== null &&
		(RECENT_COLLECTIONS as readonly string[]).includes(value)
	);
}

export function parseRecentFilters(
	params: URLSearchParams | Record<string, string | undefined>,
): RecentFilters {
	const get =
		params instanceof URLSearchParams
			? (key: string) => params.get(key)
			: (key: string) => params[key] ?? null;
	const kind = get("kind");
	const range = get("range");
	const collection = get("col") || get("collection");
	return {
		kind: isKindFilter(kind) ? kind : DEFAULT_RECENT_FILTERS.kind,
		range: isRange(range) ? range : DEFAULT_RECENT_FILTERS.range,
		collection: isCollection(collection)
			? collection
			: DEFAULT_RECENT_FILTERS.collection,
	};
}

function toItem(
	record: RecentDiscourseRecord,
	kind: RecentKind,
): RecentDiscourseItem {
	const added = record.added ?? record.modified;
	return {
		slug: record.slug,
		title: record.title,
		description: record.description,
		collection: record.collection,
		kind,
		added: added.toISOString(),
		modified: record.modified.toISOString(),
		volpage: record.volpage,
	};
}

export function buildRecentFeeds(
	records: RecentDiscourseRecord[],
	_now: Date = new Date(),
	opts?: {
		newLimit?: number;
		updatedLimit?: number;
		graceMs?: number;
	},
): RecentDiscourseItem[] {
	const newLimit = opts?.newLimit ?? NEW_FEED_LIMIT;
	const updatedLimit = opts?.updatedLimit ?? UPDATED_FEED_LIMIT;
	const graceMs = opts?.graceMs ?? NEW_GRACE_MS;

	const withAdded = records.filter((record) => record.added);
	const newSorted = [...withAdded].sort(
		(a, b) => b.added!.getTime() - a.added!.getTime(),
	);
	const newItems = newSorted
		.slice(0, newLimit)
		.map((record) => toItem(record, "new"));
	const newSlugs = new Set(newItems.map((item) => item.slug));

	const updatedItems = records
		.filter((record) => !newSlugs.has(record.slug))
		.filter((record) => {
			if (!record.added) return true;
			return record.modified.getTime() - record.added.getTime() > graceMs;
		})
		.sort((a, b) => b.modified.getTime() - a.modified.getTime())
		.slice(0, updatedLimit)
		.map((record) => toItem(record, "updated"));

	return [...newItems, ...updatedItems];
}

export function activityTime(item: RecentDiscourseItem): number {
	return Date.parse(item.kind === "new" ? item.added : item.modified);
}

export function filterRecentDiscourses(
	items: RecentDiscourseItem[],
	filters: RecentFilters,
	now: Date = new Date(),
): RecentDiscourseItem[] {
	let list =
		filters.kind === "all"
			? items
			: items.filter((item) => item.kind === filters.kind);
	if (filters.collection !== "all") {
		list = list.filter((item) => item.collection === filters.collection);
	}
	list = [...list].sort((a, b) => activityTime(b) - activityTime(a));
	if (filters.range === "20") return list.slice(0, 20);
	const days = filters.range === "30d" ? 30 : 90;
	const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
	return list.filter((item) => activityTime(item) >= cutoff);
}

export function recentSummary(count: number, filters: RecentFilters): string {
	const noun = count === 1 ? "discourse" : "discourses";
	if (filters.kind === "new") {
		return `${count} newly added ${noun}`;
	}
	if (filters.kind === "updated") {
		return `${count} recently updated ${noun}`;
	}
	return `${count} recent ${noun}`;
}
