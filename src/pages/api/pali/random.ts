export const prerender = false;
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import {
	buildPaliResponse,
	jsonResponse,
	parseFormat,
	parseIncludeMeta,
	isValidFormat,
} from "../../../utils/paliText";

export const GET: APIRoute = async ({ url }) => {
	const formatParam = url.searchParams.get("format");
	const includeMetaParam = url.searchParams.get("includeMeta");

	if (!isValidFormat(formatParam)) {
		return jsonResponse(
			{ error: "Invalid 'format' value. Use md|text|segments" },
			400
		);
	}

	try {
		const coll = await getCollection("pliAll");
		if (!coll || coll.length === 0) {
			return jsonResponse({ error: "No Pali discourses available" }, 404);
		}

		const idx = Math.floor(Math.random() * coll.length);
		const entry = coll[idx];
		const format = parseFormat(formatParam);
		const includeMeta = parseIncludeMeta(includeMetaParam);
		const payload = buildPaliResponse(entry, format, includeMeta);

		return jsonResponse(payload, 200, {
			"Cache-Control": "no-store",
		});
	} catch (err) {
		console.error("/api/pali/random error", err);
		return jsonResponse({ error: "Unexpected error" }, 500);
	}
};
