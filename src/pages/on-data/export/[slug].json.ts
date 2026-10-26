import type { APIRoute } from "astro";
import {
	getOnPageListsForSlug,
	staticOnSlugsWhere,
} from "../../../utils/onPageLists";

/** Discourse checklist for the `/on/{slug}` export dialog, fetched on first open. */
export const prerender = true;

export function getStaticPaths() {
	return staticOnSlugsWhere((lists) => !!lists.exportTree).map((slug) => ({
		params: { slug },
	}));
}

export const GET: APIRoute = ({ params }) => {
	const tree = getOnPageListsForSlug(params.slug ?? "")?.exportTree;
	const chapters = (tree?.chapters ?? []).map((chapter) => ({
		id: chapter.id,
		discourses: chapter.discourses.map((d) => ({
			slug: d.slug,
			title: d.title,
			...(d.isReference ? { isReference: true } : {}),
		})),
	}));
	return new Response(JSON.stringify({ chapters }), {
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
};
