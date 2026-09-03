import collectionReferenceIndex from "../data/collectionReferenceIndex";
import type { AiAskSessionEntry } from "./aiAskSession";
import { isDiscourseSlug } from "./collectionAvailabilityCounts";
import { collectionChipLabel } from "./recentDiscourses";
import { routes } from "./routes";
import { expandSlugToDiscourseIds } from "./slugDiscourseCount";
import { keyMap } from "./transformId";

/** Traditional order of the collections as they appear on the site. */
export const CANON_COLLECTION_ORDER = [
	"dn",
	"mn",
	"sn",
	"an",
	"kp",
	"dhp",
	"ud",
	"iti",
	"snp",
] as const;

export type CatalogDiscourse = {
	slug: string;
	collection: string;
};

/**
 * Strip internal rewrite prefixes / nested paths so mark-as-read keys align
 * with public discourse slugs (`mn10`, `an3.1`).
 */
export function normalizeDiscourseSlug(raw: string): string {
	let slug = raw.replace(/^\/+/, "").split("?")[0].split("#")[0].trim();
	if (!slug) return "";
	slug = slug.replace(/^(discourse-ssr|discourse-sujato)\//i, "");
	if (slug.includes("/")) {
		const last = slug.split("/").filter(Boolean).pop() || slug;
		if (isDiscourseSlug(last)) slug = last;
	}
	return slug;
}

export function collectionFromDiscourseSlug(slug: string): string {
	const match = normalizeDiscourseSlug(slug).match(/^([a-z]+)/i);
	return match?.[1]?.toLowerCase() ?? "";
}

/**
 * Catalog of every discourse readable on the site: site translations ∪
 * curated Bhikkhu Sujato reference-only entries. Range files are expanded
 * to individual discourse ids (same rules as collection “readable” counts).
 */
export function buildReadableCatalog(): CatalogDiscourse[] {
	const byId = new Map<string, string>();
	const add = (rawSlug: string) => {
		const fileSlug = normalizeDiscourseSlug(rawSlug);
		if (!fileSlug || !isDiscourseSlug(fileSlug)) return;
		for (const id of expandSlugToDiscourseIds(fileSlug)) {
			const collection = collectionFromDiscourseSlug(id);
			if (!collection) continue;
			if (
				!(CANON_COLLECTION_ORDER as readonly string[]).includes(collection)
			) {
				continue;
			}
			byId.set(id, collection);
		}
	};

	for (const slug of routes) add(slug);
	for (const entry of collectionReferenceIndex) add(entry.slug);

	return [...byId.entries()].map(([slug, collection]) => ({
		slug,
		collection,
	}));
}

/** Expand mark-as-read keys (including ranges / rewrite paths) to catalog ids. */
export function expandReadSlugs(readSlugs: Iterable<string>): string[] {
	const out = new Set<string>();
	for (const raw of readSlugs) {
		const fileSlug = normalizeDiscourseSlug(raw);
		if (!fileSlug) continue;
		for (const id of expandSlugToDiscourseIds(fileSlug)) out.add(id);
	}
	return [...out];
}

export function discoursesReadLabel(totalRead: number): string {
	if (totalRead <= 0) return "";
	if (totalRead === 1) return "1 discourse read";
	return `${totalRead} discourses read`;
}

export type CoverageRow = {
	collection: string;
	/** Short chip label, e.g. "MN". */
	label: string;
	/** Long title, e.g. "Middle Length Discourses". */
	title: string;
	href: string;
	read: number;
	total: number;
	/** 0–100, never 0 when at least one discourse is read. */
	percent: number;
};

export type CanonCoverage = {
	/** Only collections with at least one read discourse, in canon order. */
	rows: CoverageRow[];
	/** Read discourses that exist in the catalog (stale or non-discourse slugs are ignored). */
	totalRead: number;
	totalAvailable: number;
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function collectionRank(collection: string): number {
	const index = (CANON_COLLECTION_ORDER as readonly string[]).indexOf(
		collection,
	);
	return index === -1 ? CANON_COLLECTION_ORDER.length : index;
}

/**
 * How far the reader has got through each collection available on the site.
 * Denominators should be the readable union (site translation ∪ reference).
 * Read slugs may be file keys or rewrite paths; they are normalized/expanded.
 */
export function computeCanonCoverage(
	readSlugs: Iterable<string>,
	catalog: readonly CatalogDiscourse[],
): CanonCoverage {
	const totals = new Map<string, Set<string>>();
	const slugToCollection = new Map<string, string>();
	for (const item of catalog) {
		if (!item.slug || !item.collection) continue;
		if (!totals.has(item.collection)) totals.set(item.collection, new Set());
		totals.get(item.collection)!.add(item.slug);
		slugToCollection.set(item.slug, item.collection);
	}

	const readByCollection = new Map<string, Set<string>>();
	for (const slug of expandReadSlugs(readSlugs)) {
		const collection = slugToCollection.get(slug);
		if (!collection) continue;
		if (!readByCollection.has(collection)) {
			readByCollection.set(collection, new Set());
		}
		readByCollection.get(collection)!.add(slug);
	}

	const rows: CoverageRow[] = [];
	let totalRead = 0;
	for (const [collection, readSet] of readByCollection) {
		const total = totals.get(collection)?.size ?? 0;
		const read = readSet.size;
		if (read === 0 || total === 0) continue;
		totalRead += read;
		rows.push({
			collection,
			label: collectionChipLabel(collection),
			title: keyMap[collection] || collectionChipLabel(collection),
			href: `/${collection}`,
			read,
			total,
			percent: Math.min(100, Math.max(1, Math.round((read / total) * 100))),
		});
	}
	rows.sort((a, b) => {
		const rank = collectionRank(a.collection) - collectionRank(b.collection);
		return rank !== 0 ? rank : a.collection.localeCompare(b.collection);
	});

	let totalAvailable = 0;
	for (const set of totals.values()) totalAvailable += set.size;

	return { rows, totalRead, totalAvailable };
}

export type PendingItem = {
	slug: string;
	/** Minutes since epoch, as stored in the `pages` maps. */
	minutes: number;
};

/** The item that has waited longest in a `{ slug: minutes }` map. */
export function oldestPending(
	pages: Record<string, unknown> | null | undefined,
): PendingItem | null {
	if (!pages) return null;
	let oldest: PendingItem | null = null;
	for (const [slug, raw] of Object.entries(pages)) {
		if (typeof raw !== "number" || !Number.isFinite(raw) || !slug) continue;
		if (!oldest || raw < oldest.minutes) oldest = { slug, minutes: raw };
	}
	return oldest;
}

/** Coarse, timezone-agnostic "how long ago" for minute-precision timestamps. */
export function formatMinutesAgo(minutes: number, nowMs = Date.now()): string {
	if (!Number.isFinite(minutes) || minutes <= 0) return "";
	const days = Math.floor(Math.max(0, nowMs - minutes * MINUTE_MS) / DAY_MS);
	if (days < 1) return "today";
	if (days === 1) return "yesterday";
	if (days < 14) return `${days} days ago`;
	if (days < 60) {
		const weeks = Math.floor(days / 7);
		return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
	}
	if (days < 365) {
		const months = Math.floor(days / 30);
		return `${months} ${months === 1 ? "month" : "months"} ago`;
	}
	const years = Math.floor(days / 365);
	return `${years} ${years === 1 ? "year" : "years"} ago`;
}

/** Pinned asks first, then newest first. */
export function orderAsksForReview(
	entries: readonly AiAskSessionEntry[],
): AiAskSessionEntry[] {
	return [...entries].sort((a, b) => {
		const pinned = Number(b.saved === true) - Number(a.saved === true);
		return pinned !== 0 ? pinned : b.at - a.at;
	});
}
