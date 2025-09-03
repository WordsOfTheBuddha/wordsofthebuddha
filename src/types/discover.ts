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
    discourses: Array<{
        id: string;
        title: string;
        description: string;
        collection: string;
        note?: string;
    }>;
}
