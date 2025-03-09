export interface DirectoryStructure {
	title: string;
	description?: string;
	children?: Record<string, DirectoryStructure>;
	range?: {
		start: number;
		end: number;
	};
	contentCount?: number;
}
