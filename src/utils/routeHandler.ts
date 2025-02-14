import type { RouteType, DirectoryMetaData } from "../types/types";
import directoryMetaData from "../data/directoryMetaData.json";
import { createSearchPattern } from "./collectionPatterns";

export interface RouteResult {
	type: RouteType;
	pattern?: string;
	metadata?: DirectoryMetaData;
}

type DirectoryMetaDataKeys = keyof typeof directoryMetaData;

export function determineRouteType(id: string): RouteResult {
	// Check if it's a collection
	if (id in directoryMetaData) {
		const pattern = createSearchPattern(id) || undefined;
		return {
			type: "collection",
			pattern,
			metadata: directoryMetaData[id as DirectoryMetaDataKeys],
		};
	}

	// Check if it's a valid sutta ID pattern
	const validSuttaPattern = /^[a-z]+\d+$/i;
	if (validSuttaPattern.test(id)) {
		return { type: "sutta" };
	}

	// Default to search
	return { type: "search" };
}
