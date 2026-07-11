/**
 * Paragraph-range helpers shared by reading-mode excerpt URLs (`/dn15.29-56`)
 * and listen-mode (`/listen/dn15?pp=29-56`).
 */

import { isValidParagraphRange } from "./contentParser";
import { routes } from "./routes";

const routeSet = new Set<string>(routes);

export type ParagraphRange = {
	start: number;
	end: number;
};

/** Parse `?pp=` values: `29`, `29-56`. */
export function parseParagraphRangeParam(
	value: string | null | undefined,
): ParagraphRange | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (trimmed.includes("-")) {
		const [startRaw, endRaw] = trimmed.split("-", 2);
		const start = Number(startRaw);
		const end = Number(endRaw);
		if (!isValidParagraphRange(start, end)) return null;
		return { start, end };
	}
	const single = Number(trimmed);
	if (!Number.isFinite(single) || single < 1) return null;
	return { start: single, end: single };
}

export function formatParagraphRangeParam(range: ParagraphRange): string {
	return range.start === range.end
		? String(range.start)
		: `${range.start}-${range.end}`;
}

export function paragraphRangesEqual(
	a: ParagraphRange | null | undefined,
	b: ParagraphRange | null | undefined,
): boolean {
	if (!a && !b) return true;
	if (!a || !b) return false;
	return a.start === b.start && a.end === b.end;
}

/**
 * Parse a top-level path segment such as `dn15.29-56` or `sn3.3`.
 * Returns the base discourse slug and optional paragraph range.
 */
export function parseDiscourseExcerptPath(pathSegment: string): {
	slug: string;
	href: string;
	pp: ParagraphRange | null;
} {
	if (routeSet.has(pathSegment)) {
		return { slug: pathSegment, href: pathSegment, pp: null };
	}

	const paragraphRangeMatch = pathSegment.match(/^(.+)\.(\d+(?:-\d+)?)$/);
	if (paragraphRangeMatch) {
		const [, baseId, paragraphPart] = paragraphRangeMatch;
		if (!routeSet.has(baseId)) {
			return { slug: pathSegment, href: pathSegment, pp: null };
		}
		if (paragraphPart.includes("-")) {
			const [start, end] = paragraphPart.split("-", 2).map(Number);
			if (isValidParagraphRange(start, end)) {
				return {
					slug: baseId,
					href: pathSegment,
					pp: { start, end },
				};
			}
		} else {
			const start = Number(paragraphPart);
			if (Number.isFinite(start) && start >= 1) {
				return {
					slug: baseId,
					href: pathSegment,
					pp: { start, end: start },
				};
			}
		}
	}
	return { slug: pathSegment, href: pathSegment, pp: null };
}

export function buildListenHref(
	slug: string,
	opts?: { pl?: string | null; pp?: ParagraphRange | null },
): string {
	const params = new URLSearchParams();
	if (opts?.pl) params.set("pl", opts.pl);
	if (opts?.pp) params.set("pp", formatParagraphRangeParam(opts.pp));
	const qs = params.toString();
	return qs ? `/listen/${slug}?${qs}` : `/listen/${slug}`;
}

/** Build a reading-mode href for a playlist entry (preserves excerpt suffix). */
export function buildReadHref(
	href: string,
	opts?: { pl?: string | null },
): string {
	const params = new URLSearchParams();
	if (opts?.pl) params.set("pl", opts.pl);
	const qs = params.toString();
	return qs ? `/${href}?${qs}` : `/${href}`;
}

/** Paragraph ids present in a manifest that fall inside `pp`. */
export function paragraphIdsInRange(
	paragraphIds: readonly number[],
	pp: ParagraphRange,
): number[] {
	return paragraphIds.filter((id) => id >= pp.start && id <= pp.end);
}
