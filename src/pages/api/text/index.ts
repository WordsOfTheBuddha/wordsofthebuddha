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

export const GET: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get("slug");
	const id = url.searchParams.get("id");
	const formatParam = url.searchParams.get("format");
	const includeMetaParam = url.searchParams.get("includeMeta");

	if (!slug && !id) {
		return jsonResponse(
			{ error: "Missing 'slug' or 'id' query parameter" },
			400
		);
	}

	if (!isValidFormat(formatParam)) {
		return jsonResponse(
			{ error: "Invalid 'format' value. Use md|text|segments" },
			400
		);
	}

	try {
		const includeMeta = parseIncludeMeta(includeMetaParam);
		const fmt = parseFormat(formatParam);

		const [pliEntry, enEntry] = await Promise.all([
			findEntry("pli", { slug: slug ?? undefined, id: id ?? undefined }),
			findEntry("en", { slug: slug ?? undefined, id: id ?? undefined }),
		]);

		// If neither language is available, return 404
		if (!pliEntry && !enEntry) {
			return jsonResponse(
				{ error: "Discourse not found", slug, id },
				404
			);
		}

		const body: Record<string, string | string[]> = {};
		const missing: string[] = [];

		if (pliEntry) {
			const pliPayload = buildTextResponse("pli", pliEntry, fmt, false);
			body.pli =
				fmt === "segments"
					? (pliPayload as any).segments
					: (pliPayload as any).body;
		} else {
			missing.push("pli");
		}

		if (enEntry) {
			const enPayload = buildTextResponse("en", enEntry, fmt, false);
			body.en =
				fmt === "segments"
					? (enPayload as any).segments
					: (enPayload as any).body;
		} else {
			missing.push("en");
		}

		const payload: Record<string, any> = { format: fmt, body };

		if (includeMeta) {
			const sharedId =
				(pliEntry as any)?.data?.id ??
				(pliEntry as any)?.id ??
				(enEntry as any)?.data?.id ??
				(enEntry as any)?.id ??
				null;

			const sharedTitle =
				(pliEntry as any)?.data?.title ??
				(enEntry as any)?.data?.title ??
				null;

			const sharedDescription =
				(pliEntry as any)?.data?.description ??
				(enEntry as any)?.data?.description ??
				null;

			if (sharedId != null) payload.id = sharedId;
			if (sharedTitle != null) payload.title = sharedTitle;
			if (sharedDescription != null)
				payload.description = sharedDescription;
		}

		if (missing.length && missing.length < 2) {
			payload.missing = missing;
		}

		return jsonResponse(payload, 200, {
			"Cache-Control": "public, max-age=300, s-maxage=300",
		});
	} catch (err) {
		console.error("/api/text error", err);
		return jsonResponse({ error: "Unexpected error" }, 500);
	}
};
