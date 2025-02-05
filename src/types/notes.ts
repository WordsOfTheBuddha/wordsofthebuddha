import type { Timestamp } from 'firebase-admin/firestore';

export interface Note {
    id: string;
    author: string;
    name: string;
    createdAt: Timestamp;
}

export interface Highlight {
    slug: string;          // URL path used as key
    rangyHash: string;     // Rangy serialized highlight data
    highlightSegments: { [segmentId: string]: HighlightSegment };
    updatedAt: Timestamp;
}

export interface HighlightSegment {
    containerHTML: string;    // Container element with highlights
    highlightText: string;    // Extracted text from highlight
    domPath: string;   // For debugging/validation - not used as key
}

// segmentId format: "{elementType}-{index}"
// e.g.: "p-0" for first paragraph, "h2-1" for second h2

export type HighlightOperation = {
    type: 'add' | 'delete';
    noteId: string;
    highlights: Highlight[] | string[]; // Highlight[] for add, string[] (slugs) for delete
};
