import type { DirectoryStructure } from "../types/directory";
import { directoryStructure } from "../data/directoryStructure";

export interface CollectionNavigation {
	prev?: { slug: string; title: string };
	next?: { slug: string; title: string };
}

/**
 * Finds the previous and next sibling collections for a given collection slug.
 * Navigation is based on siblings within the same parent in the directoryStructure.
 *
 * For example:
 * - /an5 -> prev: /an4, next: /an6
 * - /an1 -> prev: undefined, next: /an2
 * - /sn1-11 -> prev: undefined, next: /sn12-21
 * - /sn12 -> prev: /sn11 (even across parent groups), next: /sn13
 *
 * Top-level collections (e.g., /an, /mn, /sn) do not show navigation
 * since there's no logical ordering between them.
 */
export function getCollectionNavigation(slug: string): CollectionNavigation {
	const result: CollectionNavigation = {};

	// First, find where this slug exists in the structure
	const location = findCollectionLocation(slug);

	if (!location) {
		return result;
	}

	const { parent, siblings, index, parentKey, isTopLevel } = location;

	// Don't show navigation for top-level collections (an, mn, sn, etc.)
	// since there's no logical ordering between them
	if (isTopLevel) {
		return result;
	}

	// Get previous sibling
	if (index > 0) {
		const prevSlug = siblings[index - 1];
		const prevData = parent[prevSlug];
		result.prev = { slug: prevSlug, title: prevData.title };
	}

	// Get next sibling
	if (index < siblings.length - 1) {
		const nextSlug = siblings[index + 1];
		const nextData = parent[nextSlug];
		result.next = { slug: nextSlug, title: nextData.title };
	}

	// Special case for SN: if we're at a leaf collection (e.g., sn12)
	// and prev/next crosses parent boundaries (e.g., sn11 in sn1-11, sn12 in sn12-21)
	// we should still navigate to them
	if (parentKey && parentKey.startsWith("sn")) {
		const crossBoundaryNav = getCrossBoundaryNavigation(slug, parentKey);
		if (!result.prev && crossBoundaryNav.prev) {
			result.prev = crossBoundaryNav.prev;
		}
		if (!result.next && crossBoundaryNav.next) {
			result.next = crossBoundaryNav.next;
		}
	}

	return result;
}

interface CollectionLocation {
	parent: Record<string, DirectoryStructure>;
	siblings: string[];
	index: number;
	parentKey?: string;
	isTopLevel?: boolean;
}

/**
 * Finds the location of a collection in the directory structure
 */
function findCollectionLocation(slug: string): CollectionLocation | null {
	// Check top-level first
	const topLevelKeys = Object.keys(directoryStructure);
	const topLevelIndex = topLevelKeys.indexOf(slug);
	if (topLevelIndex !== -1) {
		return {
			parent: directoryStructure,
			siblings: topLevelKeys,
			index: topLevelIndex,
			isTopLevel: true,
		};
	}

	// Search in children of top-level collections
	for (const [topKey, topValue] of Object.entries(directoryStructure)) {
		if (!topValue.children) continue;

		// Check direct children
		const childKeys = Object.keys(topValue.children);
		const childIndex = childKeys.indexOf(slug);
		if (childIndex !== -1) {
			return {
				parent: topValue.children,
				siblings: childKeys,
				index: childIndex,
				parentKey: topKey,
			};
		}

		// Check grandchildren (e.g., sn1 inside sn1-11)
		for (const [midKey, midValue] of Object.entries(topValue.children)) {
			if (!midValue.children) continue;

			const grandChildKeys = Object.keys(midValue.children);
			const grandChildIndex = grandChildKeys.indexOf(slug);
			if (grandChildIndex !== -1) {
				return {
					parent: midValue.children,
					siblings: grandChildKeys,
					index: grandChildIndex,
					parentKey: midKey,
				};
			}
		}
	}

	return null;
}

/**
 * Handles cross-boundary navigation for SN collections
 * For example: sn11 (last in sn1-11) can navigate to sn12 (first in sn12-21)
 */
function getCrossBoundaryNavigation(
	slug: string,
	parentKey: string,
): CollectionNavigation {
	const result: CollectionNavigation = {};

	// Get the SN structure
	const snStructure = directoryStructure.sn;
	if (!snStructure?.children) return result;

	// Find all leaf collections across all SN sub-groups
	const allSnLeafCollections: {
		slug: string;
		title: string;
		parentKey: string;
	}[] = [];

	for (const [groupKey, groupValue] of Object.entries(snStructure.children)) {
		if (!groupValue.children) continue;
		for (const [childKey, childValue] of Object.entries(
			groupValue.children,
		)) {
			allSnLeafCollections.push({
				slug: childKey,
				title: childValue.title,
				parentKey: groupKey,
			});
		}
	}

	// Sort by the numeric part of the slug (sn1 -> 1, sn12 -> 12, etc.)
	allSnLeafCollections.sort((a, b) => {
		const numA = parseInt(a.slug.replace(/[^0-9]/g, "")) || 0;
		const numB = parseInt(b.slug.replace(/[^0-9]/g, "")) || 0;
		return numA - numB;
	});

	// Find current slug index in the full list
	const currentIndex = allSnLeafCollections.findIndex((c) => c.slug === slug);
	if (currentIndex === -1) return result;

	// Get prev if exists
	if (currentIndex > 0) {
		const prev = allSnLeafCollections[currentIndex - 1];
		result.prev = { slug: prev.slug, title: prev.title };
	}

	// Get next if exists
	if (currentIndex < allSnLeafCollections.length - 1) {
		const next = allSnLeafCollections[currentIndex + 1];
		result.next = { slug: next.slug, title: next.title };
	}

	return result;
}

/**
 * Helper to extract a clean title from the full collection title
 * e.g., "The Book of the Fives" -> "The Book of the Fives"
 */
export function formatCollectionTitle(title: string): string {
	// Remove the collection prefix if present (e.g., "Saṁyutta Nikāya - ")
	const dashIndex = title.indexOf(" - ");
	if (dashIndex !== -1) {
		return title.substring(dashIndex + 3);
	}
	return title;
}
