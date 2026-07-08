export interface DirectoryStructure {
	title: string;
	description?: string;
	children?: Record<string, DirectoryStructure>;
	/** UI-only vagga groupings (AN pilot). Not prerendered as collection routes. */
	vaggaSections?: Record<string, DirectoryStructure>;
	range?: {
		start: number;
		end: number;
	};
	contentCount?: number;
	translatedCount?: number;
	readableCount?: number;
}
