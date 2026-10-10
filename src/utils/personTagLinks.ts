/**
 * Resolve discourse `character` frontmatter labels to person pages.
 *
 * Person hubs live at /on/<slug>; slugs come from personMappings.json,
 * which generatePersonMappings.ts builds from the same frontmatter.
 * Resolution is JSON + pure helpers only (no fs), so it is safe at both
 * build (prerender) and SSR time.
 */
import personMappings from "../data/personMappings.json";
import { canonicalOnSlug } from "./discover-data";
import { canonicalSlugForPerson, stripDiacritics } from "./personIdentity";

export type CharacterLink = {
	/** Frontmatter label as written, e.g. "Sakka, lord of the gods". */
	label: string;
	/** Resolved person title from personMappings; falls back to the label. */
	title: string;
	/** Curated bio for the popover, when the person has one. */
	description?: string;
	/**
	 * Auto-fallback popover context for low-appearance persons without a
	 * curated bio: an "Appears in N discourses" line plus the first tagged
	 * discourse's description.
	 */
	fallbackContext?: string;
	/** /on/<slug> hub link; absent when the label matches no known person. */
	href?: string;
};

type PersonDiscourseRef = { description?: string };
type PersonGroupEntry = {
	title?: string;
	description?: string;
	discourses?: PersonDiscourseRef[];
};
type PersonGroup = Record<string, PersonGroupEntry>;

/** Persons appearing in at most this many discourses get auto-fallback bios. */
const FALLBACK_MAX_DISCOURSES = 2;

/** Lowercase, diacritic-folded, punctuation-stripped key for fuzzy lookup. */
function normKey(value: string): string {
	return canonicalOnSlug(stripDiacritics(value));
}

type PersonIndexEntry = {
	slug: string;
	title: string;
	description?: string;
	discourseCount: number;
	firstDiscourseDescription?: string;
};

// Letter groups repeat the same person under extra sort letters, so first
// writer wins; every entry for a slug shares title/description anyway.
const personByNorm = new Map<string, PersonIndexEntry>();
for (const group of Object.values(personMappings as Record<string, PersonGroup>)) {
	for (const [slug, data] of Object.entries(group)) {
		const entry: PersonIndexEntry = {
			slug,
			title: data.title?.trim() || slug,
			...(data.description ? { description: data.description } : {}),
			discourseCount: data.discourses?.length ?? 0,
			firstDiscourseDescription:
				data.discourses?.[0]?.description?.trim() || undefined,
		};
		for (const key of [normKey(slug), normKey(entry.title)]) {
			if (key && !personByNorm.has(key)) personByNorm.set(key, entry);
		}
	}
}

/**
 * Popover context for persons without a curated bio: an italic "Appears in
 * N discourse(s) in this library." line plus the first tagged discourse's
 * description. Returns undefined for 3+ discourse persons (those get
 * curated mini-biographies instead).
 */
function fallbackContextFor(person: PersonIndexEntry): string | undefined {
	if (
		person.description ||
		person.discourseCount < 1 ||
		person.discourseCount > FALLBACK_MAX_DISCOURSES
	) {
		return undefined;
	}
	const noun = person.discourseCount === 1 ? "discourse" : "discourses";
	const countLine = `_Appears in ${person.discourseCount} ${noun} in this library._`;
	const first = person.firstDiscourseDescription;
	return first ? `${countLine} ${first}` : countLine;
}

/** Accept string | string[] frontmatter; trim and de-duplicate case-insensitively. */
function toLabels(raw: unknown): string[] {
	const list = Array.isArray(raw)
		? raw
		: typeof raw === "string"
			? [raw]
			: [];
	const seen = new Set<string>();
	const labels: string[] = [];
	for (const item of list) {
		const label = String(item ?? "").trim();
		if (!label) continue;
		// Quoted labels may contain commas ("Sakka, lord of the gods"). For
		// string frontmatter, split on commas only when the whole string
		// matches no known person.
		if (
			!Array.isArray(raw) &&
			label.includes(",") &&
			!personByNorm.has(normKey(label))
		) {
			for (const part of label.split(",")) {
				const trimmed = part.trim();
				if (trimmed && !seen.has(trimmed.toLowerCase())) {
					seen.add(trimmed.toLowerCase());
					labels.push(trimmed);
				}
			}
			continue;
		}
		const key = label.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		labels.push(label);
	}
	return labels;
}

export function resolveCharacterLinks(raw: unknown): CharacterLink[] {
	return toLabels(raw).map((label) => {
		// canonicalSlugForPerson runs the same honorific-stripping + slugify
		// pipeline generatePersonMappings used, without needing the alias
		// catalog; the normKey lookups tolerate residual differences.
		const candidate = canonicalSlugForPerson(label);
		const match =
			personByNorm.get(normKey(label)) ?? personByNorm.get(normKey(candidate));
		if (!match) return { label, title: label };
		return {
			label,
			title: match.title,
			...(match.description
				? { description: match.description }
				: { fallbackContext: fallbackContextFor(match) }),
			href: `/on/${canonicalOnSlug(match.slug)}`,
		};
	});
}