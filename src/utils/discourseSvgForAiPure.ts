/**
 * Browser-safe discourse-illustration helpers (NO `node:` imports).
 *
 * `discourseSvgForAi.ts` reads image directories from disk, so it can only
 * run on the server — but the research-revise planner parser runs in the
 * browser (via `aiModeClient.ts`) and needs the same slug math. Anything
 * imported by client-reachable modules must live here, never there.
 */

/** Compact label list packed into Ask/Research evidence by default. */
export const DISCOURSE_SVG_AI_SUMMARY_CHARS = 4_000;
export const DISCOURSE_SVG_AI_SUMMARY_TOTAL = 16_000;
/**
 * Full site SVG markup, only when the research writer requests it.
 * Fits every current discourse SVG (largest tidy file is ~115k).
 */
export const DISCOURSE_SVG_AI_PER_FILE = 120_000;
export const DISCOURSE_SVG_AI_TOTAL = 240_000;
/** At most this many full SVGs on a readIllustration hop. */
export const DISCOURSE_SVG_AI_MAX_REQUESTED = 2;

const IMAGE_EXT = /\.(svg|webp|jpe?g|png)$/i;

export function normalizeDiscourseSvgSlug(slug: string): string {
	return slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

/** Same prefix rule as site discourse-image discovery. */
export function contentImageBasenameMatchesSlug(
	basename: string,
	slug: string,
): boolean {
	const base = basename.replace(IMAGE_EXT, "").toLowerCase();
	const id = normalizeDiscourseSvgSlug(slug);
	if (!id || !base) return false;
	if (base === id) return true;
	if (!base.startsWith(id)) return false;
	const next = base[id.length];
	return next === "-" || next === "_" || next === ".";
}

/**
 * Normalize, dedupe, and cap requested illustration slugs — WITHOUT checking
 * which ones actually have SVG files on disk (that needs `node:fs`, see
 * `clipDiscourseSvgRequestSlugs` in `discourseSvgForAi.ts`). The server
 * re-clips with the existence check and is the source of truth.
 */
export function normalizeDiscourseSvgRequestSlugs(
	slugs: readonly string[],
	max = DISCOURSE_SVG_AI_MAX_REQUESTED,
): string[] {
	const cap = Math.max(0, Math.floor(max));
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of slugs) {
		const slug = normalizeDiscourseSvgSlug(raw);
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
		if (out.length >= cap) break;
	}
	return out;
}
