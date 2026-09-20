/**
 * Decode common HTML entities in text extracted from rendered markup.
 * Numeric and named entities are expanded; `&amp;` is decoded last.
 */
export function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
			const code = Number.parseInt(hex, 16);
			return Number.isFinite(code) ? String.fromCodePoint(code) : _;
		})
		.replace(/&#(\d+);/g, (_, dec: string) => {
			const code = Number.parseInt(dec, 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : _;
		})
		.replace(/&nbsp;/gi, " ")
		.replace(/&apos;/gi, "'")
		.replace(/&quot;/gi, '"')
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&amp;/gi, "&");
}
