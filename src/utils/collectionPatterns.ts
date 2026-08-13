import { snVaggaRangeBySlug } from "../data/snVaggaStructure.generated";

/** Parse sn45.71 or sn45.71-75 into a numeric span. */
function parseDottedDiscourseSlug(slug: string): {
	prefix: string;
	book: number;
	start: number;
	end: number;
} | null {
	const match = slug.match(/^([a-z]+)(\d+)\.(\d+)(?:-(\d+))?$/);
	if (!match) return null;
	const start = Number(match[3]);
	const end = match[4] != null ? Number(match[4]) : start;
	return {
		prefix: match[1],
		book: Number(match[2]),
		start,
		end,
	};
}

function rangesOverlap(
	startA: number,
	endA: number,
	startB: number,
	endB: number,
): boolean {
	return startA <= endB && endA >= startB;
}

/** True when a discourse slug belongs to a collection index slug (e.g. an4.10 → an4). */
export function slugMatchesCollectionPattern(
	slug: string,
	collection: string,
): boolean {
	const snVaggaRange = snVaggaRangeBySlug[collection];
	if (snVaggaRange) {
		const parsed = parseDottedDiscourseSlug(slug);
		if (!parsed || parsed.prefix !== "sn") return false;
		return (
			parsed.book === snVaggaRange.book &&
			rangesOverlap(
				parsed.start,
				parsed.end,
				snVaggaRange.start,
				snVaggaRange.end,
			)
		);
	}

	const bookVaggaMatch = collection.match(/^([a-z]+)(\d+)\.(\d+)-(\d+)$/);
	if (bookVaggaMatch) {
		const [, prefix, book, startStr, endStr] = bookVaggaMatch;
		const start = Number(startStr);
		const end = Number(endStr);
		const parsed = parseDottedDiscourseSlug(slug);
		if (!parsed) return false;
		return (
			parsed.prefix === prefix &&
			parsed.book === Number(book) &&
			rangesOverlap(parsed.start, parsed.end, start, end)
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
	const snVaggaRange = snVaggaRangeBySlug[collection];
	if (snVaggaRange) {
		const numbers = Array.from(
			{ length: snVaggaRange.end - snVaggaRange.start + 1 },
			(_, i) => i + snVaggaRange.start,
		);
		return numbers
			.map((n) => `slug:sn${snVaggaRange.book}.${n}$`)
			.join(" | ");
	}

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
