export function createSearchPattern(collection: string): string | null {
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
