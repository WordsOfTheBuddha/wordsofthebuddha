export interface UnifiedContentItem {
	id: string;
	slug: string;
	type: "topic" | "quality" | "simile";
	title: string;
	description?: string;
	synonyms?: string[];
	supportedBy?: string[];
	leadsTo?: string[];
	related?: string[];
	opposite?: string[];
	pali?: string[];
	redirects?: string[];
	qualityType?: "positive" | "negative" | "neutral";
	context?: string;
	post?: {
		url: string;
		title: string;
		description?: string;
	};
	discourses: Array<{
		id: string;
		title: string;
		description: string;
		collection: string;
		note?: string;
		// Optional discourse-level priority used for ordering
		priority?: number;
		// Optional featured flag (primarily for curated topicMappings)
		isFeatured?: boolean;
	}>;
}
