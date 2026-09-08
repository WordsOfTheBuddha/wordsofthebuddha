import { DEFAULT_SNIPPET_CLIP, clipSnippetAroundHighlight } from "./searchSnippetHighlight";

export interface AiDiscourseHit {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
	referenceOnly: boolean;
	volpage?: string;
	href: string;
	/**
	 * Search queries that retrieved this hit in the Ask pool. Used by the
	 * rescorer; stripped before the public result payload.
	 */
	matchedQueries?: string[];
}

export interface DiscourseHitLike {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
	referenceOnly?: boolean;
	volpage?: string;
	matchedQueries?: string[];
}

const MERGED_LIMIT = 12;
/** Reciprocal-rank fusion constant (standard IR default). */
const RRF_K = 60;

type MergeHit = { slug: string; referenceOnly?: boolean };

/**
 * Merge multi-query batches by reciprocal rank fusion so discourses that
 * rank well across complementary queries rise, instead of first-query order.
 */
export function mergeDiscourseHits<T extends MergeHit>(
	batches: readonly { query: string; hits: readonly T[] }[],
	limit = MERGED_LIMIT,
): T[] {
	const scores = new Map<string, number>();
	const best = new Map<string, T>();
	const firstSeen = new Map<string, number>();
	let order = 0;
	for (const batch of batches) {
		batch.hits.forEach((hit, rank) => {
			if (!hit.slug) return;
			const add = 1 / (RRF_K + rank + 1);
			scores.set(hit.slug, (scores.get(hit.slug) || 0) + add);
			const prev = best.get(hit.slug);
			if (!prev) {
				best.set(hit.slug, hit);
				firstSeen.set(hit.slug, order++);
			} else if (prev.referenceOnly === true && hit.referenceOnly !== true) {
				best.set(hit.slug, hit);
			}
		});
	}
	return [...best.keys()]
		.sort((a, b) => {
			const diff = (scores.get(b) || 0) - (scores.get(a) || 0);
			if (Math.abs(diff) > 1e-12) return diff > 0 ? 1 : -1;
			return (firstSeen.get(a) || 0) - (firstSeen.get(b) || 0);
		})
		.slice(0, limit)
		.map((slug) => best.get(slug)!);
}

export function toAiDiscourseHit(hit: DiscourseHitLike): AiDiscourseHit {
	const slug = hit.slug;
	const matched = (hit.matchedQueries || [])
		.map((query) => query.replace(/\s+/g, " ").trim())
		.filter(Boolean);
	return {
		slug,
		title: hit.title,
		description: (hit.description || "").slice(0, 240),
		contentSnippet: hit.contentSnippet
			? clipSnippetAroundHighlight(hit.contentSnippet, DEFAULT_SNIPPET_CLIP)
			: null,
		referenceOnly: hit.referenceOnly === true,
		volpage: hit.volpage,
		href: `/${slug}`,
		...(matched.length > 0 ? { matchedQueries: matched } : {}),
	};
}

/** Drop Ask-pool annotations before sending hits to the browser. */
export function toPublicAskHit(hit: AiDiscourseHit): AiDiscourseHit {
	return {
		slug: hit.slug,
		title: hit.title,
		description: hit.description,
		contentSnippet: hit.contentSnippet,
		referenceOnly: hit.referenceOnly,
		href: hit.href,
		...(hit.volpage ? { volpage: hit.volpage } : {}),
	};
}
