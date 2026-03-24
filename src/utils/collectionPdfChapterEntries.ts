/**
 * Discourse entry lists for collection PDF export (same caps / ordering as pdfRenderer).
 */
import { MAX_PDF_DISCOURSES_PER_CHAPTER } from "./collectionPdfPreviewMeta";
import { findEntriesBySlugPrefix } from "./textApi";

const MAX_DISCOURSES = MAX_PDF_DISCOURSES_PER_CHAPTER;

/**
 * Same discourse list as fetchChapterDiscourses uses (capped), sorted for export order.
 */
export async function getChapterEntryListForPdf(
	chapterSlug: string,
	range: { start: number; end: number } | undefined,
): Promise<Awaited<ReturnType<typeof findEntriesBySlugPrefix>>> {
	const rangeMatch = /^([a-z]+)(\d+)-(\d+)$/i.exec(chapterSlug);

	let entries: Awaited<ReturnType<typeof findEntriesBySlugPrefix>>;
	if (rangeMatch) {
		const base = rangeMatch[1].toLowerCase();
		const lo = range?.start ?? Number(rangeMatch[2]);
		const hi = range?.end ?? Number(rangeMatch[3]);
		const all = await findEntriesBySlugPrefix("en", base);
		entries = all.filter((e) => {
			const slug = ((e.data as any)?.slug || (e as any).slug || "")
				.trim()
				.toLowerCase();
			const numMatch = new RegExp(`^${base}(\\d+)$`).exec(slug);
			if (!numMatch) return false;
			const num = Number(numMatch[1]);
			return num >= lo && num <= hi;
		});
	} else {
		const prefix = /\d$/.test(chapterSlug)
			? `${chapterSlug}.`
			: chapterSlug;
		entries = await findEntriesBySlugPrefix("en", prefix);
	}

	const limited = entries.slice(0, MAX_DISCOURSES);
	limited.sort((a, b) => {
		const sa = String(
			((a.data as any)?.slug || (a as any).slug || "").trim(),
		).toLowerCase();
		const sb = String(
			((b.data as any)?.slug || (b as any).slug || "").trim(),
		).toLowerCase();
		return sa.localeCompare(sb, undefined, { numeric: true });
	});
	return limited;
}
