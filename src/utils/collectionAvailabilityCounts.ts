import collectionReferenceIndex from "../data/collectionReferenceIndex";
import { routes } from "./routes";
import { slugMatchesCollectionPattern } from "./collectionPatterns";
import { expandSlugToDiscourseIds } from "./slugDiscourseCount";
import type { DirectoryStructure } from "../types/directory";

/** Routable discourse slugs only (excludes home, anthologies, etc.). */
export function isDiscourseSlug(slug: string): boolean {
	return /^[a-z]+\d/.test(slug);
}

const discourseRoutes = routes.filter(isDiscourseSlug);
const discourseRouteSet = new Set(discourseRoutes);

/** Curated reference-only slugs (same criteria as collectionReferenceIndex). */
const curatedReferenceSlugs = collectionReferenceIndex
	.map((entry) => entry.slug)
	.filter(isDiscourseSlug);

function collectDiscourseIds(
	slugs: Iterable<string>,
	collection: string,
): Set<string> {
	const ids = new Set<string>();
	for (const slug of slugs) {
		if (!slugMatchesCollectionPattern(slug, collection)) continue;
		for (const id of expandSlugToDiscourseIds(slug)) {
			if (slugMatchesCollectionPattern(id, collection)) {
				ids.add(id);
			}
		}
	}
	return ids;
}

export function countTranslatedDiscourses(collection: string): number {
	return collectDiscourseIds(discourseRoutes, collection).size;
}

export function countReadableDiscourses(collection: string): number {
	const ids = collectDiscourseIds(discourseRoutes, collection);
	for (const slug of curatedReferenceSlugs) {
		if (!slugMatchesCollectionPattern(slug, collection)) continue;
		for (const id of expandSlugToDiscourseIds(slug)) {
			if (slugMatchesCollectionPattern(id, collection)) {
				ids.add(id);
			}
		}
	}
	return ids.size;
}

/** @deprecated Use countTranslatedDiscourses */
export function countTranslatedSlugs(collection: string): number {
	return countTranslatedDiscourses(collection);
}

/** @deprecated Use countReadableDiscourses */
export function countReadableSlugs(collection: string): number {
	return countReadableDiscourses(collection);
}

export function countCuratedReferenceDiscourses(collection: string): number {
	const translated = collectDiscourseIds(discourseRoutes, collection);
	const readable = collectDiscourseIds(
		[...discourseRoutes, ...curatedReferenceSlugs],
		collection,
	);
	let extra = 0;
	for (const id of readable) {
		if (!translated.has(id)) extra++;
	}
	return extra;
}

export const CANONICAL_TOTALS: Record<string, number> = {
	dhp: 423,
	iti: 112,
	ud: 80,
	mn: 152,
	snp: 71,
	sn: 2889,
	an: 9557,
	dn: 34,
	kp: 9,
};

export const COMPLETE_COLLECTIONS = new Set(["dhp", "iti", "ud", "kp"]);

export function countReadableUnitsForCollection(
	name: string,
	node: DirectoryStructure | undefined,
): number {
	if (!node) return countReadableDiscourses(name);
	if (COMPLETE_COLLECTIONS.has(name)) {
		return (
			node.contentCount ?? node.readableCount ?? countReadableDiscourses(name)
		);
	}
	return node.readableCount ?? countReadableDiscourses(name);
}

function countSiteTranslatedDiscourses(): number {
	return Object.keys(CANONICAL_TOTALS).reduce(
		(sum, name) => sum + countTranslatedDiscourses(name),
		0,
	);
}

/** Unique file slugs contributing readable content (EN routes + curated ref-only, deduped). */
function countUniqueContentSlugs(): number {
	const slugs = new Set(discourseRoutes);
	for (const slug of curatedReferenceSlugs) {
		slugs.add(slug);
	}
	return slugs.size;
}

export const siteAvailability = {
	/** Unique content file slugs for hero "M texts" (routes + curated references). */
	textCount: countUniqueContentSlugs(),
	/** Discourse-level translated count across canonical collections. */
	translatedCount: countSiteTranslatedDiscourses(),
	/** @deprecated Use textCount */
	readableCount: discourseRoutes.length,
	/** Filled by generateCollectionAvailability after directory enrichment. */
	unitCount: 0,
};

export function enrichDirectoryWithAvailability(
	structure: Record<string, DirectoryStructure>,
): Record<string, DirectoryStructure> {
	const result: Record<string, DirectoryStructure> = {};

	for (const [key, directory] of Object.entries(structure)) {
		const enriched: DirectoryStructure = { ...directory };

		if (directory.children && Object.keys(directory.children).length > 0) {
			enriched.children = enrichDirectoryWithAvailability(
				directory.children,
			);
		}

		enriched.translatedCount = countTranslatedDiscourses(key);
		enriched.readableCount = countReadableDiscourses(key);

		result[key] = enriched;
	}

	return result;
}
