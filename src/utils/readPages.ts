import { normalizeDiscourseSlug } from "./reviewRoomStats";
import { expandSlugToDiscourseIds } from "./slugDiscourseCount";

function isPositiveMinute(raw: unknown): raw is number {
	return typeof raw === "number" && Number.isFinite(raw) && raw > 0;
}

/** Discourse ids a mark-as-read action should write or delete for this slug. */
export function discourseIdsForReadSlug(raw: string): string[] {
	const slug = normalizeDiscourseSlug(raw);
	if (!slug) return [];
	return expandSlugToDiscourseIds(slug);
}

function storedMinute(
	pages: Record<string, unknown>,
	id: string,
): number | undefined {
	const direct = pages[id];
	if (isPositiveMinute(direct)) return direct;
	return undefined;
}

/** True when every expanded discourse id has its own timestamp. */
export function isSlugFullyRead(
	pages: Record<string, unknown> | null | undefined,
	slug: string,
): boolean {
	const ids = discourseIdsForReadSlug(slug);
	if (ids.length === 0) return false;
	const map = pages || {};
	return ids.every((id) => storedMinute(map, id) !== undefined);
}

/**
 * Set missing expanded ids to `minute`. Existing positive timestamps stay.
 * Drops the range key itself when it expands to more than one id.
 */
export function markReadPages(
	pages: Record<string, unknown> | null | undefined,
	slug: string,
	minute: number,
): Record<string, number> {
	const ids = discourseIdsForReadSlug(slug);
	const next: Record<string, number> = {};
	if (pages) {
		for (const [key, value] of Object.entries(pages)) {
			if (isPositiveMinute(value)) next[key] = value;
		}
	}
	if (!ids.length || !isPositiveMinute(minute)) return next;
	for (const id of ids) {
		if (!isPositiveMinute(next[id])) next[id] = minute;
	}
	const rangeSlug = normalizeDiscourseSlug(slug);
	if (rangeSlug && ids.length > 1) delete next[rangeSlug];
	return next;
}

/** Remove expanded ids and the range key, if present. */
export function unmarkReadPages(
	pages: Record<string, unknown> | null | undefined,
	slug: string,
): Record<string, number> {
	const ids = new Set(discourseIdsForReadSlug(slug));
	const rangeSlug = normalizeDiscourseSlug(slug);
	if (rangeSlug) ids.add(rangeSlug);
	const next: Record<string, number> = {};
	if (!pages) return next;
	for (const [key, value] of Object.entries(pages)) {
		if (!isPositiveMinute(value)) continue;
		const fileSlug = normalizeDiscourseSlug(key);
		if (ids.has(key) || ids.has(fileSlug)) continue;
		const expanded = expandSlugToDiscourseIds(fileSlug || key);
		if (expanded.some((id) => ids.has(id))) continue;
		next[key] = value;
	}
	return next;
}
