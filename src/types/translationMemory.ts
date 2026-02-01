/**
 * Translation Memory Types
 * Supports paragraph-level and n-gram partial matching
 */

/** A single entry in the translation memory index */
export interface TMEntry {
	/** Unique ID for this entry */
	id: number;
	/** Normalized Pali (lowercase, no punctuation) */
	paliNormalized: string;
	/** Original Pali text for display */
	paliOriginal: string;
	/** Corresponding English translation */
	englishOriginal: string;
	/** Word count for quick filtering */
	wordCount: number;
	/** Source reference */
	source: {
		suttaId: string; // e.g., "mn1", "sn22.59"
		paragraphNum: number; // e.g., 5
		collection: string; // e.g., "mn", "sn"
	};
}

/** N-gram index: maps n-gram strings to entry IDs */
export type NgramIndex = Record<string, number[]>;

/** The complete translation memory index structure */
export interface TranslationMemoryIndex {
	version: number;
	generatedAt: string;
	entries: TMEntry[];
	/** N-gram index for partial phrase matching (5-word sequences) */
	ngrams: NgramIndex;
	/** N-gram size used (default 5) */
	ngramSize: number;
}

/** A match result returned by the matching algorithm */
export interface TMMatch {
	matchType: "paragraph";
	similarity: number; // 0-1
	/** The matched Pali text */
	matchedPali: string;
	/** Full source paragraph English (for display) */
	fullEnglish: string;
	/** Source reference */
	source: {
		suttaId: string;
		paragraphNum: number;
		collection: string;
	};
}

/** Summary of matches for a paragraph */
export interface TMMatchSummary {
	match: TMMatch | null;
	summaryText: string; // e.g., "📖 Found similar: mn1 ¶5 (84%)"
}
