export const prerender = false;
import type { APIRoute } from "astro";
import {
	buildTextResponse,
	getRandomEntry,
	isValidFormat,
	jsonResponse,
	parseFormat,
	parseIncludeMeta,
} from "../../../../utils/textApi";

export const GET: APIRoute = async ({ params, url }) => {
	const lang = (params.lang || "").toLowerCase();
	const formatParam = url.searchParams.get("format");
	const includeMetaParam = url.searchParams.get("includeMeta");
	const maxParagraphsParam = url.searchParams.get("maxParagraphs");

	if (!lang)
		return jsonResponse({ error: "Missing 'lang' path segment" }, 400);
	if (!isValidFormat(formatParam)) {
		return jsonResponse(
			{ error: "Invalid 'format' value. Use md|text|segments" },
			400
		);
	}

	try {
		let maxParagraphs: number | undefined = undefined;
		if (maxParagraphsParam != null) {
			const n = Number(maxParagraphsParam);
			if (!Number.isFinite(n) || n <= 0) {
				return jsonResponse(
					{
						error: "Invalid 'maxParagraphs' value. Must be a positive integer.",
					},
					400
				);
			}
			maxParagraphs = Math.floor(n);
		}

		const entry = await getRandomEntry(lang, maxParagraphs);
		if (!entry)
			return jsonResponse(
				maxParagraphs
					? {
							error: "No entries available within paragraph limit",
							lang,
							maxParagraphs,
					  }
					: { error: "No entries available", lang },
				404
			);

		const format = parseFormat(formatParam);
		const includeMeta = parseIncludeMeta(includeMetaParam);
		const payload = buildTextResponse(lang, entry, format, includeMeta);

		return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
	} catch (err) {
		console.error(`/api/text/${lang}/random error`, err);
		return jsonResponse({ error: "Unexpected error" }, 500);
	}
};
