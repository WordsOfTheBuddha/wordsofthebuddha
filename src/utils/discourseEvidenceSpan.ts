import { isHierarchicalNumberInRange } from "./contentParser";
import {
	hasSegmentMarkers,
	parseSegmentMarkedBody,
} from "./referenceSegmentParser";
import {
	compactDiscourseIdQuery,
	discourseNumericId,
	isDiscourseRangeContainment,
	parseDiscourseIdRange,
	slugMatchesQuery,
} from "./searchRanking";
import { transformId } from "./transformId";

/** A subsection inside a range file (e.g. AN 1.485–494 inside an1.394-574). */
export interface DiscourseEvidenceSpan {
	/** Reader-facing citation label, e.g. AN 1.485–494. */
	label: string;
	start: string;
	end: string;
}

/** Parse a compact discourse id into a span label and numeric bounds. */
export function parseDiscourseEvidenceSpan(compactId: string): DiscourseEvidenceSpan | null {
	const compact = compactDiscourseIdQuery(compactId);
	if (!compact) return null;
	const numeric = discourseNumericId(compact);
	if (!numeric) return null;
	const range = parseDiscourseIdRange(numeric);
	const label = transformId(compact) || compact;
	if (range) return { label, start: range.start, end: range.end };
	return { label, start: numeric, end: numeric };
}

/**
 * When the reader asked for a constituent or sub-range, return the span to
 * excerpt from the parent file. Whole-file reads return null.
 */
export function evidenceSpanForRequest(
	requestedId: string,
	fileSlug: string,
): DiscourseEvidenceSpan | null {
	const compact = compactDiscourseIdQuery(requestedId.replace(/\s+/g, " "));
	if (!compact) return null;
	const file = fileSlug.trim().toLowerCase();
	if (compact === file) return null;
	if (
		slugMatchesQuery(file, compact) !== "exact" &&
		!isDiscourseRangeContainment(file, compact)
	) {
		return null;
	}
	return parseDiscourseEvidenceSpan(compact);
}

function hierarchicalFromSegmentKey(key: string): string | null {
	const prefix = key.includes(":") ? key.slice(0, key.indexOf(":")) : key;
	return discourseNumericId(prefix);
}

function segmentInSpan(key: string, span: DiscourseEvidenceSpan): boolean {
	const num = hierarchicalFromSegmentKey(key);
	if (!num) return false;
	return isHierarchicalNumberInRange(num, span.start, span.end);
}

function headingInSpan(heading: string, span: DiscourseEvidenceSpan): boolean {
	const normalized = heading.replace(/[–—]/g, "-");
	const range = parseDiscourseIdRange(normalized);
	if (range) {
		return (
			isHierarchicalNumberInRange(range.start, span.start, span.end) &&
			isHierarchicalNumberInRange(range.end, span.start, span.end)
		);
	}
	return isHierarchicalNumberInRange(normalized, span.start, span.end);
}

/**
 * Keep only the paragraphs/segments for a requested span inside a parent file.
 * Works on bilara @segment bodies and native #### heading markdown.
 */
function bodyHasSegmentMarkers(body: string): boolean {
	const text = body.replace(/^\uFEFF?---[\s\S]*?\n---\n/, "").trim();
	return hasSegmentMarkers(text) || /<!-- @segment /m.test(text);
}

export function sliceDiscourseTextForSpan(
	body: string,
	span: DiscourseEvidenceSpan,
): string {
	const text = body.replace(/^\uFEFF?---[\s\S]*?\n---\n/, "").trim();
	if (!text) return "";
	if (bodyHasSegmentMarkers(text)) {
		const lines: string[] = [];
		for (const { key, text: segmentText } of parseSegmentMarkedBody(text)) {
			if (!segmentText.trim() || !segmentInSpan(key, span)) continue;
			lines.push(segmentText.trim());
		}
		return lines.join("\n\n");
	}
	const chunks = text.split(/\n(?=####\s+)/);
	const kept: string[] = [];
	for (const chunk of chunks) {
		const m = chunk.match(/^####\s+(\S+)/);
		if (!m || !headingInSpan(m[1], span)) continue;
		kept.push(chunk.trim());
	}
	return kept.join("\n\n");
}

/** Map each opened file slug to the subsection the reader named. */
export function buildEvidenceSpanBySlug(
	requestedIds: readonly string[],
	hits: readonly { slug: string }[],
	match: (hit: { slug: string }, requestedId: string) => boolean,
): Record<string, DiscourseEvidenceSpan> {
	const out: Record<string, DiscourseEvidenceSpan> = {};
	for (const requestedId of requestedIds) {
		const hit = hits.find((candidate) => match(candidate, requestedId));
		if (!hit) continue;
		const span = evidenceSpanForRequest(requestedId, hit.slug);
		if (!span) continue;
		out[hit.slug.trim().toLowerCase()] = span;
	}
	return out;
}

/** Labels for the process hop — named ids, not parent file slugs. */
export function discourseEvidenceReadLabels(
	requestedIds: readonly string[],
	hits: readonly { slug: string }[],
	match: (hit: { slug: string }, requestedId: string) => boolean,
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const requestedId of requestedIds) {
		const hit = hits.find((candidate) => match(candidate, requestedId));
		const span = hit ? evidenceSpanForRequest(requestedId, hit.slug) : null;
		const label =
			span?.label ||
			transformId(requestedId) ||
			(hit ? transformId(hit.slug) : "") ||
			requestedId;
		const key = label.toLowerCase();
		if (!label || seen.has(key)) continue;
		seen.add(key);
		out.push(label);
	}
	return out;
}
