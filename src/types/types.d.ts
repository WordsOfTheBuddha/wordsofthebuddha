/// <reference types="astro/client" />

declare interface LastUpdatedData {
	[key: string]: string;
}

export type RouteType = "collection" | "sutta" | "search";

// Add DirectoryMetaData types for better type safety
export interface DirectoryMetaData {
	title: string;
	description?: string;
}
