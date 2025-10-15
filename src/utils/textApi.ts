export type TextFormat = "md" | "text" | "segments";

type Entry = {
	slug?: string;
	id?: string;
	body: string;
	data?: Record<string, any>;
};

const CORS_HEADERS = {
	"Content-Type": "application/json",
	"Access-Control-Allow-Origin": "*",
} as const;

function normalize(s?: string | null) {
	return (s ?? "").trim().toLowerCase();
}

function isString(x: unknown): x is string {
	return typeof x === "string";
}

function candidatesFor(entry: any): string[] {
	const c: string[] = [];
	if (isString(entry?.data?.slug)) c.push(entry.data.slug);
	if (isString(entry?.slug)) c.push(entry.slug);
	if (isString(entry?.data?.id)) c.push(entry.data.id);
	if (isString(entry?.id)) c.push(entry.id);
	if (isString(entry?.data?.uid)) c.push(entry.data.uid);
	if (isString(entry?.data?.slugify)) c.push(entry.data.slugify);
	return c.map(normalize).filter(Boolean);
}

export function isValidFormat(val: string | null): boolean {
	if (!val) return true;
	return val === "md" || val === "text" || val === "segments";
}

export function parseFormat(val: string | null): TextFormat {
	if (val === "text" || val === "segments") return val;
	return "md";
}

export function parseIncludeMeta(val: string | null): boolean {
	if (val == null) return true;
	const s = val.toLowerCase();
	return s === "1" || s === "true" || s === "yes";
}

export function jsonResponse(
	body: any,
	status = 200,
	extraHeaders: Record<string, string> = {}
) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, ...extraHeaders },
	});
}

function stripMarkdown(md?: string): string {
	if (!isString(md)) return "";
	return (
		md
			// code blocks and inline code
			.replace(/```[\s\S]*?```/g, "")
			.replace(/`([^`]+)`/g, "$1")
			// headings
			.replace(/^#{1,6}\s+/gm, "")
			// emphasis/strong
			.replace(/\*\*([^*]+)\*\*/g, "$1")
			.replace(/\*([^*]+)\*/g, "$1")
			.replace(/_([^_]+)_/g, "$1")
			// links/images
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
			.replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
			// blockquotes/lists
			.replace(/^\s{0,3}>\s?/gm, "")
			.replace(/^\s{0,3}[-*+]\s+/gm, "")
			.replace(/^\s{0,3}\d+\.\s+/gm, "")
			// horizontal rules
			.replace(/^\s*[-*_]{3,}\s*$/gm, "")
			// escapes
			.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1")
			.trim()
	);
}

function toSegments(input: string): string[] {
	return input
		.split(/\n{2,}/g)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

// Candidate content collections per language.
// Unknown collections are skipped safely at runtime.
function candidateCollections(lang: string): string[] {
	const l = normalize(lang);
	if (l === "pli" || l === "pi" || l === "pali")
		return ["pli", "pliAll", "pali", "paliAll"];
	if (l === "en" || l === "eng" || l === "english")
		return ["en", "enAll", "english", "all"]; // include "all" if you keep a merged collection
	return [l];
}

async function tryGetCollectionEntries(name: string): Promise<Entry[]> {
	try {
		const mod: any = await import("astro:content");
		const entries = await (mod.getCollection as any)(name);
		return entries.map((e: any) => ({
			slug: e.slug,
			id: e.id,
			body: e.body,
			data: e.data,
		}));
	} catch {
		// Collection does not exist or other loader error; skip it.
		return [];
	}
}

async function tryGetEntryBySlug(
	name: string,
	slug: string
): Promise<Entry | null> {
	try {
		const mod: any = await import("astro:content");
		const entry = await (mod.getEntryBySlug as any)(name, slug);
		if (!entry) return null;
		return {
			slug: entry.slug,
			id: entry.id,
			body: entry.body,
			data: entry.data,
		};
	} catch {
		return null;
	}
}

export async function findEntry(
	lang: string,
	opts: { slug?: string; id?: string }
): Promise<Entry | null> {
	const wanted = normalize(opts.slug || opts.id);
	if (!wanted) return null;

	const collections = candidateCollections(lang);

	// Try exact slug lookup first for each collection
	for (const c of collections) {
		const bySlug = await tryGetEntryBySlug(c, wanted);
		if (bySlug) return bySlug;
	}

	// Fallback: scan entries and match on multiple candidate fields
	for (const c of collections) {
		const entries = await tryGetCollectionEntries(c);
		if (!entries.length) continue;

		const match = entries.find((e) => {
			const cands = candidatesFor(e);
			return cands.some(
				(x) => x === wanted || (x && x.endsWith("/" + wanted))
			);
		});
		if (match) return match;
	}

	return null;
}

export async function getRandomEntry(
	lang: string,
	maxSegments?: number
): Promise<Entry | null> {
	const collections = candidateCollections(lang);
	for (const c of collections) {
		const entries = await tryGetCollectionEntries(c);
		const withBody = entries.filter((e) => isString((e as any).body));
		if (withBody.length > 0) {
			let pool = withBody;
			if (typeof maxSegments === "number" && maxSegments > 0) {
				pool = withBody.filter((e) => {
					const text = stripMarkdown((e as any).body);
					const segs = toSegments(text);
					return segs.length <= maxSegments;
				});
			}
			if (pool.length > 0) {
				const idx = Math.floor(Math.random() * pool.length);
				return pool[idx];
			}
		}
	}
	return null;
}

export function buildTextResponse(
	lang: string,
	entry: Entry,
	format: TextFormat,
	includeMeta: boolean
) {
	const md = entry.body;
	const text = stripMarkdown(md);
	const segments = toSegments(format === "md" ? md : text);

	const payload: any = { lang, format };

	if (format === "md") payload.body = md;
	else if (format === "text") payload.body = text;
	else payload.segments = segments;

	if (includeMeta) {
		payload.id =
			(isString(entry.data?.id) ? entry.data?.id : undefined) ??
			entry.id ??
			null;
		payload.title =
			(isString(entry.data?.title) ? entry.data?.title : null) ?? null;
		payload.description =
			(isString(entry.data?.description)
				? entry.data?.description
				: null) ?? null;
	}

	return payload;
}
