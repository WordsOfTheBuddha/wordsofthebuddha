export const prerender = false;
import type { APIRoute } from "astro";
import {
	buildTextResponse,
	findEntry,
	isValidFormat,
	jsonResponse,
	parseFormat,
	parseIncludeMeta,
} from "../../../utils/textApi";

export const GET: APIRoute = async ({ params, url }) => {
	const lang = (params.lang || "").toLowerCase();
	const slug = url.searchParams.get("slug");
	const id = url.searchParams.get("id");
	const formatParam = url.searchParams.get("format");
	const includeMetaParam = url.searchParams.get("includeMeta");

	if (!lang)
		return jsonResponse({ error: "Missing 'lang' path segment" }, 400);
	if (!slug && !id)
		return jsonResponse(
			{ error: "Missing 'slug' or 'id' query parameter" },
			400
		);
	if (!isValidFormat(formatParam)) {
		return jsonResponse(
			{ error: "Invalid 'format' value. Use md|text|segments" },
			400
		);
	}

	try {
		const entry = await findEntry(lang, {
			slug: slug ?? undefined,
			id: id ?? undefined,
		});
		if (!entry)
			return jsonResponse(
				{ error: "Discourse not found", lang, slug, id },
				404
			);

		const format = parseFormat(formatParam);
		const includeMeta = parseIncludeMeta(includeMetaParam);
		const payload = buildTextResponse(lang, entry, format, includeMeta);

		return jsonResponse(payload, 200, {
			"Cache-Control": "public, max-age=300, s-maxage=300",
		});
	} catch (err) {
		console.error(`/api/text/${lang} error`, err);
		return jsonResponse({ error: "Unexpected error" }, 500);
	}
};
