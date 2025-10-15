import { getCollection, type CollectionEntry } from "astro:content";

export type PaliFormat = "md" | "text" | "segments";

export type PaliResponse = {
	lang: "pli";
	format: PaliFormat;
	slug: string;
	title?: string;
	// when format === "md" or "text"
	body?: string;
	// when format === "segments"
	segments?: string[];
};

const allowedFormats: Set<PaliFormat> = new Set(["md", "text", "segments"]);

export function parseFormat(input: string | null | undefined): PaliFormat {
	if (!input) return "md";
	const f = input.toLowerCase() as PaliFormat;
	return allowedFormats.has(f) ? f : "md";
}

export function isValidFormat(input: string | null | undefined): boolean {
	if (!input) return true;
	return allowedFormats.has(input.toLowerCase() as PaliFormat);
}

export function parseIncludeMeta(param: string | null | undefined): boolean {
	if (param == null) return true;
	return param.toLowerCase() !== "false";
}

export function stripMarkdown(md: string): string {
	let text = md;
	// Remove fenced code blocks
	text = text.replace(/```[\s\S]*?```/g, "");
	// Remove inline code backticks
	text = text.replace(/`([^`]*)`/g, "$1");
	// Images ![alt](url)
	text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
	// Links [text](url) -> text
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
	// Headings #### Title -> Title
	text = text.replace(/^#{1,6}\s+/gm, "");
	// Blockquotes
	text = text.replace(/^>\s?/gm, "");
	// Lists
	text = text.replace(/^\s*[-*+]\s+/gm, "");
	text = text.replace(/^\s*\d+\.\s+/gm, "");
	// Emphasis **strong** or *em*
	text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
	text = text.replace(/(\*|_)(.*?)\1/g, "$2");
	// Inline HTML
	text = text.replace(/<[^>]+>/g, "");
	// Collapse extra blank lines and trim trailing spaces per line
	text = text
		.split("\n")
		.map((l) => l.replace(/[\t ]+$/g, ""))
		.join("\n")
		.replace(/\n{3,}/g, "\n\n");
	return text.trim();
}

export function toSegments(from: string): string[] {
	return from
		.trim()
		.split(/\n{2,}/g)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export async function findPaliEntry(opts: {
	slug?: string;
	id?: string;
}): Promise<CollectionEntry<"pliAll"> | undefined> {
	const { slug, id } = opts;
	const coll = await getCollection("pliAll");

	const matchers: string[] = [];
	if (slug) matchers.push(slug);
	if (id && id !== slug) matchers.push(id);

	if (matchers.length === 0) return undefined;

	return coll.find((e: CollectionEntry<"pliAll">) => {
		const candidates: Array<string | undefined> = [
			e.data?.slug as any,
			(e as any).slug,
			(e as any).id,
		];
		return matchers.some((m) =>
			candidates.some(
				(v) => typeof v === "string" && (v === m || v.endsWith(`/${m}`))
			)
		);
	});
}

export function buildPaliResponse(
	entry: CollectionEntry<"pliAll">,
	format: PaliFormat,
	includeMeta = true
): PaliResponse | (PaliResponse & { title: string }) {
	const md = entry.body;
	if (format === "md") {
		const res: PaliResponse = {
			lang: "pli",
			format,
			slug: entry.data.slug || entry.slug,
			body: md,
		};
		if (includeMeta && entry.data.title)
			(res as any).title = entry.data.title;
		return res as any;
	}
	if (format === "text") {
		const text = stripMarkdown(md);
		const res: PaliResponse = {
			lang: "pli",
			format,
			slug: entry.data.slug || entry.slug,
			body: text,
		};
		if (includeMeta && entry.data.title)
			(res as any).title = entry.data.title;
		return res as any;
	}
	// segments
	const text = stripMarkdown(md);
	const segments = toSegments(text);
	const res: PaliResponse = {
		lang: "pli",
		format,
		slug: entry.data.slug || entry.slug,
		segments,
	};
	if (includeMeta && entry.data.title) (res as any).title = entry.data.title;
	return res as any;
}

export function jsonResponse(
	data: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {}
) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			...extraHeaders,
		},
	});
}
