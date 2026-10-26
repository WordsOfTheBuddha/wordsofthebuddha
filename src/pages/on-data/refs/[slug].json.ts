import type { APIRoute } from "astro";
import {
	getOnPageListsForSlug,
	staticOnSlugsWhere,
} from "../../../utils/onPageLists";

/** Reference-only discourses for `/on/{slug}`, fetched when See Refs is on. */
export const prerender = true;

export function getStaticPaths() {
	return staticOnSlugsWhere((lists) => lists.referencePosts.length > 0).map(
		(slug) => ({ params: { slug } }),
	);
}

export const GET: APIRoute = ({ params }) => {
	const lists = getOnPageListsForSlug(params.slug ?? "");
	return new Response(JSON.stringify(lists?.referencePosts ?? []), {
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
};
