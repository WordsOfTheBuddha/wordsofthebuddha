/**
 * Numeric section headings in range discourses (e.g. `an2.11-20`).
 *
 * Authoring — optional ToC-only title (MDX-safe HTML comment on the heading line):
 *
 *   #### 2.11 <!-- toc: Powers of reflection and cultivation -->
 *
 * The visible heading stays `2.11`; the comment text is used in the table of
 * contents. Primary ToC clicks scroll in-page (`#…`); `data-subsection-href`
 * holds `/an2.11` for ⌘/Ctrl+click (subsection pages from the parent file).
 */

const GLOSS_RE = /\|([^:|]+)::[^|]*\|/g;

function stripGlossMarkup(text: string): string {
	return text.replace(GLOSS_RE, "$1").replace(/\s+/g, " ").trim();
}

/** `<!-- toc: Title -->` or `<!-- toc-title: Title -->` on the same line as the id. */
const SECTION_TOC_COMMENT_RE = /<!--\s*toc(?:-title)?\s*:\s*([\s\S]*?)\s*-->/i;

const NUMERIC_SECTION_ID_RE =
	/^(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)/u;

/** Range compilation slugs such as `an2.11-20` or `an1.98-139`. */
const RANGE_DISCOURSE_SLUG_RE = /^[a-z]+\d[\d.]*-\d/i;

export function parseSectionHeadingSource(raw: string): {
	/** Heading text shown in the article (section id, optional gloss). */
	display: string;
	/** ToC label when a `<!-- toc: … -->` comment is present. */
	tocTitle: string | null;
	/** Leading sutta id (`2.11`) when the display line is numeric. */
	sectionId: string | null;
} {
	let labeled = stripGlossMarkup(raw.trim());
	let tocTitle: string | null = null;
	const comment = SECTION_TOC_COMMENT_RE.exec(labeled);
	if (comment) {
		tocTitle = comment[1].trim();
		labeled = labeled.replace(SECTION_TOC_COMMENT_RE, "").replace(/\s+/g, " ").trim();
	}
	const display = labeled;
	const sectionId = display.match(NUMERIC_SECTION_ID_RE)?.[1] ?? null;
	return { display, tocTitle, sectionId };
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

/** Strip an optional `<!-- toc: … -->` suffix before matching section numbers in markdown. */
export function stripSectionTocTitleSuffix(headingLine: string): string {
	const content = headingLine.replace(/^#+\s+/, "");
	return parseSectionHeadingSource(content).display;
}
