import { compareDiscourseIds, formatDiscourseTitle } from "./discourseSort";
import { splitDiscourseTitle } from "./discourseIdSuggest";

export interface AiDiscourseCatalogSourceDoc {
	slug: string;
	title?: string;
	priority?: number;
}

export interface AiDiscourseCatalogEntry {
	slug: string;
	id: string;
	pali: string;
	english: string;
	priority?: number;
}

/** Discourse-like slugs only (mn10, sn22.82, snp1.3, …). */
export const AI_CATALOG_DISCOURSE_SLUG = /^[a-z]{2,5}\d/i;

/** Always include every native discourse in these collections. */
export const AI_CATALOG_ALWAYS_COLLECTIONS = new Set(["dn", "mn", "snp"]);

export function collectionFromDiscourseSlug(slug: string): string {
	const match = /^([a-z]{2,5})\d/i.exec(slug.trim());
	return match ? match[1].toLowerCase() : "";
}

/** Frontmatter priority present, or DN / MN / Snp. */
export function shouldIncludeInAiDiscourseCatalog(
	doc: AiDiscourseCatalogSourceDoc,
): boolean {
	const slug = (doc.slug || "").trim();
	if (!slug || !AI_CATALOG_DISCOURSE_SLUG.test(slug)) return false;
	if (typeof doc.priority === "number" && Number.isFinite(doc.priority)) {
		return true;
	}
	return AI_CATALOG_ALWAYS_COLLECTIONS.has(collectionFromDiscourseSlug(slug));
}

export function toAiDiscourseCatalogEntry(
	doc: AiDiscourseCatalogSourceDoc,
): AiDiscourseCatalogEntry | null {
	if (!shouldIncludeInAiDiscourseCatalog(doc)) return null;
	const slug = doc.slug.trim();
	const title = typeof doc.title === "string" ? doc.title.trim() : "";
	const { pali, english } = splitDiscourseTitle(title || slug);
	return {
		slug,
		id: formatDiscourseTitle(slug),
		// Reference-only titles are often English-only (no "Pāli - English").
		pali: pali,
		english: english || (!pali ? title || slug : ""),
		...(typeof doc.priority === "number" ? { priority: doc.priority } : {}),
	};
}

export function buildAiDiscourseCatalogEntries(
	docs: readonly AiDiscourseCatalogSourceDoc[],
): AiDiscourseCatalogEntry[] {
	const bySlug = new Map<string, AiDiscourseCatalogEntry>();
	for (const doc of docs) {
		const entry = toAiDiscourseCatalogEntry(doc);
		if (!entry) continue;
		bySlug.set(entry.slug.toLowerCase(), entry);
	}
	return [...bySlug.values()].sort((a, b) => compareDiscourseIds(a.slug, b.slug));
}

/** One compact line per discourse for the rewrite system prompt. */
export function formatAiDiscourseCatalogLine(entry: AiDiscourseCatalogEntry): string {
	if (entry.pali && entry.english) {
		return `${entry.id} | ${entry.pali} | ${entry.english}`;
	}
	return `${entry.id} | ${entry.pali || entry.english || entry.slug}`;
}

export function formatAiDiscourseCatalogPromptBlock(
	entries: readonly AiDiscourseCatalogEntry[],
): string {
	if (entries.length === 0) return "";
	const lines = entries.map(formatAiDiscourseCatalogLine);
	return [
		"Known discourses in this library (ID | Pāli title | English title).",
		"When the person names or clearly means one of these, use that exact ID as a query. Do not invent nearby IDs.",
		...lines,
	].join("\n");
}
