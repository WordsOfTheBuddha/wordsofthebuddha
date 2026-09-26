/**
 * MDX-safe ToC titles for numeric section headings in range discourses.
 *
 * Put an MDX JSX comment on the line after the section id, or on the same line.
 *
 * Comments are stripped before `marked` runs; titles are passed to the client
 * ToC via `data-section-toc` on the article.
 */

const NUMERIC_HEADING_RE =
	/^(#{1,5})\s+(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)\s*$/;

const INLINE_HEADING_TOC_RE =
	/^(#{1,5})\s+(\d+\.\d+(?:\.\d+)*(?:[–-]\d+(?:\.\d+)*)?)\s+\{\/\*\s*toc:\s*([\s\S]*?)\s*\*\/\}\s*$/;

const TOC_ONLY_LINE_RE = /^\{\/\*\s*toc:\s*([\s\S]*?)\s*\*\/\}\s*$/;

export function isMdxSectionTocLine(line: string): boolean {
	return TOC_ONLY_LINE_RE.test(line.trim());
}

export function parseSectionTocMap(
	raw: string | undefined | null,
): Record<string, string> | null {
	if (!raw?.trim()) return null;
	try {
		const parsed = JSON.parse(raw) as Record<string, string>;
		if (!parsed || typeof parsed !== "object") return null;
		return parsed;
	} catch {
		return null;
	}
}

export function extractMdxSectionToc(markdown: string): {
	body: string;
	sectionToc: Record<string, string>;
} {
	const sectionToc: Record<string, string> = {};
	const out: string[] = [];
	let pendingSection: string | null = null;
	let lastNumericSection: string | null = null;

	for (const line of markdown.split("\n")) {
		const trimmed = line.trim();

		if (trimmed === "") {
			out.push(line);
			continue;
		}

		const inline = INLINE_HEADING_TOC_RE.exec(trimmed);
		if (inline) {
			const sectionId = inline[2];
			sectionToc[sectionId] = inline[3].trim();
			lastNumericSection = sectionId;
			out.push(`${inline[1]} ${sectionId}`);
			pendingSection = null;
			continue;
		}

		const heading = NUMERIC_HEADING_RE.exec(trimmed);
		if (heading) {
			pendingSection = heading[2];
			lastNumericSection = heading[2];
			out.push(line);
			continue;
		}

		const tocOnly = TOC_ONLY_LINE_RE.exec(trimmed);
		if (tocOnly) {
			const sectionId = pendingSection ?? lastNumericSection;
			if (sectionId) {
				sectionToc[sectionId] = tocOnly[1].trim();
			}
			pendingSection = null;
			continue;
		}

		pendingSection = null;
		out.push(line);
	}

	return { body: out.join("\n"), sectionToc };
}
