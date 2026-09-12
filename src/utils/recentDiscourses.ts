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

export type RecentRange = (typeof RECENT_RANGES)[number];
export type RecentCollection = (typeof RECENT_COLLECTIONS)[number];

export type RecentFilters = {
	range: RecentRange;
	collection: "all" | RecentCollection;
};

export const DEFAULT_RECENT_FILTERS: RecentFilters = {
	range: "20",
	collection: "all",
};

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

/** Committed state file: slug → first-added ISO date. Never gitignored. */
export const DISCOURSE_ADDITIONS_PATH = "src/data/discourseAdditions.json";

/** slug → first-added ISO date. Existing dates are never overwritten. */
export type DiscourseAdditions = Record<string, string>;

export type DiscourseMeta = {
	slug: string;
	title: string;
	description: string;
	collection: string;
	volpage?: string;
};

export type RecentDiscourseItem = DiscourseMeta & {
	added: string;
};

export function isEnglishDiscoursePath(filePath: string): boolean {
	const p = filePath.replace(/\\/g, "/");
	if (!p.includes("src/content/en/")) return false;
	if (p.includes("/anthologies/")) return false;
	if (p.includes("/books/")) return false;
	if (/(?:^|\/)index\.mdx$/.test(p)) return false;
	return p.endsWith(".mdx");
}

/**
 * Same filter as {@link isEnglishDiscoursePath}, but also accepts glob-loader
 * ids (`sn/sn22.100`) when `filePath` is missing — as on Vercel SSR.
 */
export function isEnglishDiscourseEntry(entry: {
	filePath?: string;
	id?: string;
}): boolean {
	if (entry.filePath) return isEnglishDiscoursePath(entry.filePath);
	const id = (entry.id ?? "").replace(/\\/g, "/").replace(/\.mdx$/i, "");
	if (!id || id === "index" || id.endsWith("/index")) return false;
	if (id === "anthologies" || id.startsWith("anthologies/")) return false;
	if (id === "books" || id.startsWith("books/")) return false;
	return true;
}

export function parseDiscourseAdditions(parsed: unknown): DiscourseAdditions {
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {};
	}
	const additions: DiscourseAdditions = {};
	for (const [slug, value] of Object.entries(parsed)) {
		if (typeof value === "string" && value) additions[slug] = value;
	}
	return additions;
}

export function slugFromEnglishPath(filePath: string): string {
	const p = filePath.replace(/\\/g, "/");
	const base = p.split("/").pop() ?? "";
	return base.replace(/\.mdx$/i, "");
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
	const range = get("range");
	const collection = get("col") || get("collection");
	return {
		range: isRange(range) ? range : DEFAULT_RECENT_FILTERS.range,
		collection: isCollection(collection)
			? collection
			: DEFAULT_RECENT_FILTERS.collection,
	};
}

/**
 * Keep dates already in the state file. Assign dates only to slugs that are
 * newly present on disk. Drop slugs whose files were removed.
 */
export function mergeDiscourseAdditions(
	existing: DiscourseAdditions,
	currentSlugs: Iterable<string>,
	discoveredDates: DiscourseAdditions,
	fallbackIso: string,
): DiscourseAdditions {
	const next: DiscourseAdditions = {};
	for (const slug of currentSlugs) {
		next[slug] =
			existing[slug] ?? discoveredDates[slug] ?? fallbackIso;
	}
	return next;
}

export function toUtcIso(value: string): string {
	const t = Date.parse(value);
	return Number.isNaN(t) ? value : new Date(t).toISOString();
}

export function serializeDiscourseAdditions(
	additions: DiscourseAdditions,
): string {
	const sorted: DiscourseAdditions = {};
	for (const slug of Object.keys(additions).sort()) {
		sorted[slug] = toUtcIso(additions[slug]!);
	}
	return `${JSON.stringify(sorted, null, 2)}\n`;
}

export function buildAddedItems(
	discourses: DiscourseMeta[],
	additions: DiscourseAdditions,
): RecentDiscourseItem[] {
	const items: RecentDiscourseItem[] = [];
	for (const discourse of discourses) {
		const added = additions[discourse.slug];
		if (!added) continue;
		items.push({ ...discourse, added });
	}
	items.sort((a, b) => {
		const byDate = Date.parse(b.added) - Date.parse(a.added);
		return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug);
	});
	return items;
}

export function filterRecentDiscourses(
	items: RecentDiscourseItem[],
	filters: RecentFilters,
	now: Date = new Date(),
): RecentDiscourseItem[] {
	let list =
		filters.collection === "all"
			? items
			: items.filter((item) => item.collection === filters.collection);
	list = [...list].sort((a, b) => {
		const byDate = Date.parse(b.added) - Date.parse(a.added);
		return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug);
	});
	if (filters.range === "20") return list.slice(0, 20);
	const days = filters.range === "30d" ? 30 : 90;
	const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
	return list.filter((item) => Date.parse(item.added) >= cutoff);
}

export function recentSummary(count: number, filters: RecentFilters): string {
	const noun = count === 1 ? "discourse" : "discourses";
	if (filters.collection === "all") {
		return `${count} newly added ${noun}`;
	}
	return `${count} newly added ${collectionChipLabel(filters.collection)} ${noun}`;
}

/** Support reach block: same window as `/recent?range=30d`. */
export const SUPPORT_RECENT_HREF = "/recent?range=30d";
export const SUPPORT_RECENT_FILTERS: RecentFilters = {
	range: "30d",
	collection: "all",
};

export type SupportRecentWork = {
	href: string;
	count: number;
	value: string;
	label: string;
};

/** Count of newly added discourses in the last 30 days, for the Support reach row. */
export function supportRecentWork(
	items: RecentDiscourseItem[],
	now: Date = new Date(),
): SupportRecentWork {
	const count = filterRecentDiscourses(
		items,
		SUPPORT_RECENT_FILTERS,
		now,
	).length;
	const formatted = new Intl.NumberFormat("en-US").format(count);
	return {
		href: SUPPORT_RECENT_HREF,
		count,
		value: count > 0 ? `+${formatted}` : formatted,
		label: count === 1 ? "discourse added" : "discourses added",
	};
}
