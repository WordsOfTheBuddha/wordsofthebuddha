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

// Allow importing raw SVGs via Vite query
declare module "*.svg?raw" {
	const content: string;
	export default content;
}
