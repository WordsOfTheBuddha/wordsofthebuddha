/** Skip native cards and refs already in the DOM so SSR'd person refs are not wiped on init. */
export function referenceEntriesToAppend<T extends { slug: string }>(
	entries: T[],
	nativeSlugs: Set<string>,
	shownRefSlugs: Set<string>,
): T[] {
	return entries.filter(
		(entry) =>
			!nativeSlugs.has(entry.slug) && !shownRefSlugs.has(entry.slug),
	);
}
