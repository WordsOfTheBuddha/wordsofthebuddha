import type { Timestamp } from 'firebase-admin/firestore';
import type { HighlightDocument } from '../utils/stableHighlight';

export interface Note {
    id: string;
    author: string;
    name: string;
    createdAt: Timestamp;
}

export interface Highlight {
    slug: string;          // URL pathname used as key (older docs: pathname + Pāli/layout params)
    title: string;         // content page title
    description: string;   // content page description
    rangyHash?: string;    // Legacy Rangy serialized highlight data (pre-v3 docs only)
    highlightDocument?: HighlightDocument;
    highlightSegments: { [segmentId: string]: HighlightSegment };
    updatedAt: Timestamp;
    formattedDate?: string;
}

/** Review-room snapshot of one highlighted block. */
export interface HighlightSegment {
    containerHTML: string;    // Block element with highlight marks
    highlightText: string;    // Highlighted text in the block
    domPath: string;          // Block key (e.g. "en:12", "pli:12")
    order: number;            // Reading order across the page
}

export type HighlightOperation = {
    type: 'add' | 'delete';
    noteId: string;
    highlights: Highlight[] | string[]; // Highlight[] for add, string[] (slugs) for delete
};
