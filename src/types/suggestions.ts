export type SuggestionSource = "pali" | "tooltip" | "title" | "synonym" | "corpus";

export type SuggestionEntityType = "quality" | "topic" | "simile" | "person";

/** One insertable autocomplete string (build-time index row). */
export interface SuggestionIndexEntry {
	/** Canonical text inserted on accept (may include diacritics). */
	text: string;
	/** Diacritic-stripped lowercase form used for matching. */
	norm: string;
	source: SuggestionSource;
	entityType: SuggestionEntityType;
}

export interface SuggestionsIndexFile {
	version: 1;
	entries: SuggestionIndexEntry[];
}

export interface ActiveToken {
	/** Start index of the full token in the input value (inclusive). */
	tokenStart: number;
	/** End index of the full token in the input value (exclusive). */
	tokenEnd: number;
	/** Index where the matchable substring begins (after `'` / `"` if present). */
	matchStart: number;
	/** Raw substring used for matching (no leading quote). */
	raw: string;
	/** Leading quote character, if any. */
	quotePrefix: string;
	suggestable: boolean;
}
