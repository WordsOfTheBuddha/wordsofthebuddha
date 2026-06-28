/**
 * Expand a routable slug into individual discourse IDs (range files → many IDs).
 * Mirrors range handling in addContentCounts.ts parseFile().
 */
export function expandSlugToDiscourseIds(slug: string): string[] {
	const dhpMatch = slug.match(/^dhp(\d+)-(\d+)$/i);
	if (dhpMatch) {
		const start = Number.parseInt(dhpMatch[1], 10);
		const end = Number.parseInt(dhpMatch[2], 10);
		return Array.from({ length: end - start + 1 }, (_, i) => `dhp${start + i}`);
	}

	const decimalRangeMatch = slug.match(/^([a-z]+\d+)\.(\d+)-(\d+)$/i);
	if (decimalRangeMatch) {
		const [, prefix, startStr, endStr] = decimalRangeMatch;
		const start = Number.parseInt(startStr, 10);
		const end = Number.parseInt(endStr, 10);
		return Array.from(
			{ length: end - start + 1 },
			(_, i) => `${prefix}.${start + i}`,
		);
	}

	return [slug];
}

export function countDiscoursesInSlug(slug: string): number {
	return expandSlugToDiscourseIds(slug).length;
}
