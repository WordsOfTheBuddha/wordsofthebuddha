import type { DirectoryStructure } from "../types/directory";
import { directoryStructure } from "../data/directoryStructure";
import { mnVaggaSections } from "../data/mnVaggaStructure.generated";
import { routes } from "./routes";
import { slugMatchesCollectionPattern } from "./collectionPatterns";
import { compareDiscourseIds } from "./discourseSort";

const discourseRouteSet = new Set(routes);

function findDirectoryNode(
	slug: string,
): DirectoryStructure | undefined {
	if (directoryStructure[slug]) {
		return directoryStructure[slug];
	}
	for (const top of Object.values(directoryStructure)) {
		if (top.children?.[slug]) {
			return top.children[slug];
		}
	}
	return undefined;
}

/** Vagga sections for a collection page, aggregating from child paṇṇāsa/book nodes when needed. */
export function getEffectiveVaggaSections(
	collectionSlug: string,
): Record<string, DirectoryStructure> | undefined {
	const node = findDirectoryNode(collectionSlug);
	if (!node) return undefined;

	if (node.vaggaSections && Object.keys(node.vaggaSections).length > 0) {
		return node.vaggaSections;
	}

	if (node.children) {
		const merged: Record<string, DirectoryStructure> = {};
		for (const child of Object.values(node.children)) {
			if (child.vaggaSections) {
				Object.assign(merged, child.vaggaSections);
			}
		}
		if (Object.keys(merged).length > 0) {
			return merged;
		}
	}

	return undefined;
}

/** Redirect targets for legacy MN vagga collection URLs (e.g. /mn1-10 → /mn1-50#mn1-10). */
export function getMnVaggaRedirects(): Record<string, string> {
	const redirects: Record<string, string> = {};
	for (const [pannasa, sections] of Object.entries(mnVaggaSections)) {
		for (const vaggaSlug of Object.keys(sections)) {
			redirects[`/${vaggaSlug}`] = `/${pannasa}#${vaggaSlug}`;
		}
	}
	return redirects;
}

/** Link target for a vagga card: discourse URL when grouped MDX exists, else in-page anchor. */
export function vaggaSectionHref(
	bookSlug: string,
	vaggaSlug: string,
): string {
	if (discourseRouteSet.has(vaggaSlug)) {
		return `/${vaggaSlug}`;
	}
	return `/${bookSlug}#${vaggaSlug}`;
}

export function findVaggaSectionForDiscourse(
	bookSlug: string,
	discourseSlug: string,
): { slug: string; data: DirectoryStructure } | null {
	const sections = getEffectiveVaggaSections(bookSlug);
	if (!sections) return null;

	for (const [slug, data] of Object.entries(sections)) {
		if (slugMatchesCollectionPattern(discourseSlug, slug)) {
			return { slug, data };
		}
	}
	return null;
}

/** Resolve vagga section metadata by slug for availability counts and breadcrumbs. */
export function findVaggaSectionBySlug(
	vaggaSlug: string,
	root: Record<string, DirectoryStructure> = directoryStructure,
): DirectoryStructure | undefined {
	for (const top of Object.values(root)) {
		if (top.vaggaSections?.[vaggaSlug]) {
			return top.vaggaSections[vaggaSlug];
		}
		if (top.children) {
			for (const child of Object.values(top.children)) {
				if (child.vaggaSections?.[vaggaSlug]) {
					return child.vaggaSections[vaggaSlug];
				}
			}
		}
	}
	return undefined;
}

export function orderedVaggaSections(
	sections: Record<string, DirectoryStructure> | undefined,
): [string, DirectoryStructure][] {
	if (!sections) return [];
	return Object.entries(sections).sort((a, b) => {
		const startA = a[1].range?.start ?? 0;
		const startB = b[1].range?.start ?? 0;
		return startA - startB;
	});
}

export function groupDiscoursesByVaggaSection<
	T extends { slug: string },
>(
	posts: T[],
	sections: Record<string, DirectoryStructure> | undefined,
): { slug: string; data: DirectoryStructure; posts: T[] }[] {
	if (!sections) {
		return [{ slug: "", data: { title: "" }, posts }];
	}

	const ordered = orderedVaggaSections(sections);
	const buckets = ordered.map(([slug, data]) => ({
		slug,
		data,
		posts: [] as T[],
	}));
	const unmatched: T[] = [];

	for (const post of posts) {
		const bucket = buckets.find(({ slug }) =>
			slugMatchesCollectionPattern(post.slug, slug),
		);
		if (bucket) {
			bucket.posts.push(post);
		} else {
			unmatched.push(post);
		}
	}

	for (const bucket of buckets) {
		bucket.posts.sort((a, b) => compareDiscourseIds(a.slug, b.slug));
	}

	if (unmatched.length > 0) {
		buckets.push({
			slug: "",
			data: { title: "Other discourses" },
			posts: unmatched,
		});
	}

	// Keep empty vagga sections so client-side ref cards can target their grids.
	return buckets;
}
