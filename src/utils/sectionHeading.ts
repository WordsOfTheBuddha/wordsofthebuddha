/**
 * Numeric section headings in range discourses (e.g. `an2.11-20`).
 *
 * Optional ToC titles use MDX comments — see `mdxSectionToc.ts`.
 */

const GLOSS_RE = /\|([^:|]+)::[^|]*\|/g;

function stripGlossMarkup(text: string): string {
	return text.replace(GLOSS_RE, "$1").replace(/\s+/g, " ").trim();
}

const NUMERIC_SECTION_ID_RE =
	/^(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)/u;

const INLINE_MDX_TOC_SUFFIX_RE =
	/\s+\{\/\*\s*toc:\s*[\s\S]*?\s*\*\/\}\s*$/;

/** Range compilation slugs such as `an2.11-20` or `an1.98-139`. */
const RANGE_DISCOURSE_SLUG_RE = /^[a-z]+\d[\d.]*-\d/i;

export function parseSectionHeadingSource(raw: string): {
	display: string;
	sectionId: string | null;
} {
	const labeled = stripGlossMarkup(raw.trim())
		.replace(INLINE_MDX_TOC_SUFFIX_RE, "")
		.replace(/\s+/g, " ")
		.trim();
	const sectionId = labeled.match(NUMERIC_SECTION_ID_RE)?.[1] ?? null;
	return { display: labeled, sectionId };
}

export function isRangeDiscourseSlug(slug: string): boolean {
	return RANGE_DISCOURSE_SLUG_RE.test(slug);
}

/** Public URL for one sutta inside a range file, e.g. `an2.11-20` + `2.16` → `/an2.16`. */
export function subsectionDiscourseHref(
	parentSlug: string,
	sectionId: string,
): string | null {
	if (!isRangeDiscourseSlug(parentSlug)) return null;
	if (!NUMERIC_SECTION_ID_RE.test(sectionId)) return null;
	const prefix = parentSlug.match(/^([a-z]+)/i)?.[1];
	if (!prefix) return null;
	return `/${prefix}${sectionId}`;
}

/** Strip an optional inline MDX toc comment suffix before matching section numbers. */
export function stripSectionTocTitleSuffix(headingLine: string): string {
	const content = headingLine.replace(/^#+\s+/, "");
	return parseSectionHeadingSource(content).display;
}
