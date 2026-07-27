/**
 * Normalize a Pāli word for dictionary lookup.
 * Strips punctuation/quotes and lowercases — same rule previously baked into
 * data-word attributes on .pali-word spans.
 */
export function cleanPaliWordForLookup(word: string): string {
	return word
		.toLowerCase()
		.replace(/[''.,;:!?…—"'"'\(\)\[\]\{\}«»"“”‘’]/g, "");
}
