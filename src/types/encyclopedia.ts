/** Where an encyclopedia item came from. Automation may replace its own items only. */
export type EncyclopediaOrigin = "automation" | "human";

/** Which corpus produced the item. `dictionary` and `editor` are reserved slots. */
export type EncyclopediaSource =
	| "tooltip"
	| "topic"
	| "quality"
	| "person"
	| "simile"
	| "dictionary"
	| "editor";

/**
 * `term` is the default for a tooltip-only headword.
 * `place` is set only by a human item; there is no place list in v1.
 */
export type EncyclopediaKind =
	| "term"
	| "topic"
	| "quality"
	| "person"
	| "simile"
	| "place";

/** Completion: gloss cluster, curated-map match, or a human item on the entry. */
export type EncyclopediaStatus = "raw" | "seeded" | "reviewed";

export interface EncyclopediaOccurrence {
	id: string;
	title: string;
}

/**
 * One provenance-bearing fact on an entry.
 * A gloss sense keeps its occurrences here; a map link points at `/on/:slug`.
 */
export interface EncyclopediaItem {
	id: string;
	origin: EncyclopediaOrigin;
	source: EncyclopediaSource;
	/**
	 * Regen identity. Gloss senses use the normalized gloss text.
	 * Map links use the `/on/` slug.
	 */
	automationKey: string;
	/** Tooltip string the discourse drawer shows. Absent on map-link items. */
	gloss?: string;
	/** Visible English head seen with this gloss. */
	label?: string;
	occurrences?: EncyclopediaOccurrence[];
	/** Curated `/on/` slug for a map-link item. */
	onSlug?: string;
	/** Human override of the entry kind (`place` has no automated list). */
	kind?: EncyclopediaKind;
	note?: string;
}

export interface EncyclopediaRelated {
	slug: string;
	kind: "topic" | "quality" | "person" | "simile";
	title: string;
}

export interface EncyclopediaEntry {
	norm: string;
	/** Most common written form of the bracketed Pāli. */
	pali: string;
	/** English heads seen in glosses, most frequent first. */
	labels: string[];
	kind: EncyclopediaKind;
	status: EncyclopediaStatus;
	related: EncyclopediaRelated[];
	/** Reserved for a later PED/DPD pass. Empty in v1. */
	dictionary: null;
	items: EncyclopediaItem[];
}

export interface EncyclopediaIndexFile {
	version: 1;
	entries: Record<string, EncyclopediaEntry>;
}

export interface EncyclopediaMeta {
	version: 1;
	entries: number;
	byStatus: Record<EncyclopediaStatus, number>;
	byKind: Record<EncyclopediaKind, number>;
}

export interface EncyclopediaListItem {
	norm: string;
	pali: string;
	kind: EncyclopediaKind;
	status: EncyclopediaStatus;
	label: string | null;
	senseCount: number;
	discourseCount: number;
}
