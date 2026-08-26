/**
 * Root vanity URLs for editorial posts (`/fire`, `/mindfulness`).
 *
 * A post at `src/pages/posts/:slug` claims `/:slug`. Quality/topic catalog
 * pages stay at `/on/:slug` — they must not 301-steal a post's root URL.
 */

/** Filename suffixes that never get a root vanity URL. */
export const ROOT_POST_EXCLUDED_SUFFIX = /-(?:draft|testcases)$/;

export function parsePostSlugFromGlobPath(filePath: string): string {
	return filePath.replace(/^.*\/posts\//, "").replace(/\.mdx?$/, "");
}

export function isRootPostCandidate(
	slug: string,
	options: {
		draft?: boolean;
		includeDrafts?: boolean;
		isDiscourse: boolean;
	},
): boolean {
	if (!slug || slug.includes("/")) return false;
	if (ROOT_POST_EXCLUDED_SUFFIX.test(slug)) return false;
	if (options.isDiscourse) return false;
	if (options.draft && options.includeDrafts === false) return false;
	return true;
}

export function slugIsRootPost(
	slug: string,
	posts: Array<{ slug: string; draft?: boolean }>,
	options: { includeDrafts?: boolean; discourseSlugs: Iterable<string> },
): boolean {
	const discourseSet =
		options.discourseSlugs instanceof Set
			? options.discourseSlugs
			: new Set(options.discourseSlugs);
	const includeDrafts = options.includeDrafts ?? true;
	return posts.some(
		(post) =>
			post.slug === slug &&
			isRootPostCandidate(post.slug, {
				draft: post.draft === true,
				includeDrafts,
				isDiscourse: discourseSet.has(post.slug),
			}),
	);
}
