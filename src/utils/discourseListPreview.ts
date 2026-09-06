/** How many discourses to show before a Show More control. */
export const DISCOURSE_LIST_PREVIEW_COUNT = 3;

/**
 * Minimum discourses before filter/download chrome is useful.
 * Used on `/on/{slug}` person, topic, and quality pages.
 */
export const MIN_THRESHOLD = 5;

export function shouldShowOnPageChrome(discourseCount: number): boolean {
	return discourseCount >= MIN_THRESHOLD;
}

export function discourseShowMoreLabel(
	totalCount: number,
	previewCount: number = DISCOURSE_LIST_PREVIEW_COUNT,
): string {
	const extra = totalCount - previewCount;
	if (extra <= 0) return "[+ Show More]";
	return extra === 1
		? "[+ 1 discourse - Show More]"
		: `[+ ${extra} discourses - Show More]`;
}
