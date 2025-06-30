export interface UnifiedContentItem {
    id: string;
    slug: string;
    type: "topic" | "quality" | "simile";
    title: string;
    description?: string;
    synonyms?: string[];
    pali?: string[];
    redirects?: string[];
    qualityType?: "positive" | "negative" | "neutral";
    context?: string;
    related?: string[];
    discourses: Array<{
        id: string;
        title: string;
        description: string;
        collection: string;
        note?: string;
    }>;
}
