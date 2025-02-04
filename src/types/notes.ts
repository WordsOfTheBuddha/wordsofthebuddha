import type { Timestamp } from 'firebase-admin/firestore';

export interface Note {
    id: string;
    author: string;
    name: string;
    createdAt: Timestamp;
}

export interface Highlight {
    id: string;
    slug: string;
    highlightColor: 'yellow' | 'pink' | 'green' | 'blue';
    content: {
        text: string;
        html: string;
        context: {
            previous: string;
            next: string;
        }
    };
    rangyHash: string;
    addedAt: Timestamp;
}

export type HighlightOperation = {
    type: 'add' | 'delete';
    collectionId: string;
    highlights: Highlight[] | string[]; // Highlight[] for add, string[] (ids) for delete
};
