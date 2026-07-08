/** True when a discourse slug belongs to a collection index slug (e.g. an4.10 → an4). */
export function slugMatchesCollectionPattern(
	slug: string,
	collection: string,
): boolean {
	const bookVaggaMatch = collection.match(/^([a-z]+)(\d+)\.(\d+)-(\d+)$/);
	if (bookVaggaMatch) {
		const [, prefix, book, startStr, endStr] = bookVaggaMatch;
		const start = Number(startStr);
		const end = Number(endStr);
		const slugMatch = slug.match(/^([a-z]+)(\d+)\.(\d+)$/);
		if (!slugMatch) return false;
		const [, slugPrefix, slugBook, slugNumStr] = slugMatch;
		const slugNum = Number(slugNumStr);
		return (
			slugPrefix === prefix &&
			slugBook === book &&
			slugNum >= start &&
			slugNum <= end
		);
	}

	const rangeMatch = collection.match(/^([a-z]+)(\d+)-(\d+)$/);
	if (rangeMatch) {
		const [, prefix, startStr, endStr] = rangeMatch;
		const start = Number(startStr);
		const end = Number(endStr);
		const slugMatch = slug.match(/^([a-z]+)(\d+)(?:\.|$)/);
		if (!slugMatch) return false;
		const [, slugPrefix, slugNumStr] = slugMatch;
		const slugNum = Number(slugNumStr);
		if (slugPrefix !== prefix || slugNum < start || slugNum > end) {
			return false;
		}
		if (prefix === "sn") {
			return slug.includes(".");
		}
		return !slug.includes(".");
	}

	if (collection === "sn") {
		return slug.startsWith("sn") && !slug.startsWith("snp");
	}

	if (/^[a-z]+$/.test(collection)) {
		return slug.startsWith(collection);
	}

	return slug.startsWith(`${collection}.`) || slug === collection;
}

export function createSearchPattern(collection: string): string | null {
	const bookVaggaMatch = collection.match(/^([a-z]+)(\d+)\.(\d+)-(\d+)$/);
	if (bookVaggaMatch) {
		const [, prefix, book, start, end] = bookVaggaMatch;
		const numbers = Array.from(
			{ length: Number(end) - Number(start) + 1 },
			(_, i) => i + Number(start),
		);
		return numbers
			.map((n) => `slug:${prefix}${book}.${n}$`)
			.join(" | ");
	}

	// Check if it's a range pattern (e.g., mn101-152 or sn1-11)
	const rangeMatch = collection.match(/^([a-z]+)(\d+)-(\d+)$/);
	if (rangeMatch) {
		const [_, prefix, start, end] = rangeMatch;
		const numbers = Array.from(
			{ length: Number(end) - Number(start) + 1 },
			(_, i) => i + Number(start)
		);

		// Special handling for SN collections
		if (prefix === "sn") {
			return numbers.map((n) => `slug:^${prefix}${n}.`).join(" | ");
		}

		// For other ranges (mn, an, etc)
		return numbers.map((n) => `slug:${prefix}${n}$`).join(" | ");
	}

	// handle top-level collection specific cases
	if (collection === "sn") {
		return `slug:^sn slug:!^snp`;
	}

	if (/^[a-z]+$/.test(collection)) {
		return `slug:^${collection}`;
	}

	// Simple pattern (e.g., ud5, sn12)
	return `slug:^${collection}.`;
}
