import type { RouteType } from "../types/types";
import type { DirectoryStructure } from "../types/directory";
import { directoryStructure } from "../data/directoryStructure";
import { createSearchPattern } from "./collectionPatterns";

export interface RouteResult {
	type: RouteType;
	pattern?: string;
	metadata?: DirectoryStructure;
}

function findInChildren(
	collection: DirectoryStructure,
	id: string
): RouteResult | undefined {
	// Direct child match
	if (collection.children?.[id]) {
		return {
			type: "collection",
			pattern: createSearchPattern(id) ?? undefined,
			metadata: collection.children[id],
		};
	}

	// If id contains a dot, split it and check if the first part is a direct child
	// type now is a sutta, so we return it
	const [prefix, suffix] = id.split(".");
	if (collection.children?.[prefix]) {
		return {
			type: "sutta",
			metadata: collection.children[prefix],
		};
	}

	// Check range-based children
	if (collection.children) {
		for (const [key, child] of Object.entries(collection.children)) {
			if (child.range) {
				const num = parseInt(id.match(/\d+/)?.[0] || "");
				if (num >= child.range.start && num <= child.range.end) {
					// Recursively check this child's children
					const found = findInChildren(child, id);
					if (found) {
						return found;
					}
					// If not found in children but matches range, return this child
					return {
						type: "sutta",
						metadata: child,
					};
				}
			}
			// Recursively check non-range children
			const found = findInChildren(child, id);
			if (found) return found;
		}
	}
	return undefined;
}

export function determineRouteType(id: string): RouteResult {
	// Check if it's a collection
	for (const [prefix, collection] of Object.entries(directoryStructure)) {
		const baseId = id.match(/^[a-z]+/i)?.[0] ?? id;

		if (!prefix.startsWith(baseId)) {
			continue;
		}
		if (id === prefix) {
			return {
				type: "collection",
				pattern: createSearchPattern(id) ?? undefined,
				metadata: collection,
			};
		}

		// Look for the ID in the collection's children at any depth
		const found = findInChildren(collection, id);
		if (found) {
			return found;
		}
	}

	// Check if it's a valid sutta ID pattern
	const validSuttaPattern = /^[a-z]+\d+$/i;
	if (validSuttaPattern.test(id)) {
		return { type: "sutta" };
	}

	return { type: "search" };
}
