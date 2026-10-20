import fs from "node:fs";
import { getEnglishEntry } from "./getContentEntry";
import {
	createCombinedMarkdown,
	parseContent,
	type ContentPair,
} from "./contentParser";
import { parseMarkdown } from "./mdParser";
import { prerenderReadingMarkup } from "./prerenderReadingMarkup";

type Cached = { mtime: number; pairs: ContentPair[] };

const cache = new Map<string, Cached>();

/** English paragraph pairs for a discourse, parsed once per file version. */
export async function passagePairs(slug: string): Promise<ContentPair[] | null> {
	const entry = await getEnglishEntry(slug);
	if (!entry?.body) return null;

	let mtime = 0;
	if (entry.filePath) {
		try {
			mtime = fs.statSync(entry.filePath).mtimeMs;
		} catch {
			mtime = 0;
		}
	}

	const hit = cache.get(slug);
	if (hit && hit.mtime === mtime) return hit.pairs;

	const { pairs } = parseContent({ body: "" }, entry);
	cache.set(slug, { mtime, pairs });
	return pairs;
}

export { selectPassage } from "./passageSelect";

export async function renderPassageHtml(pairs: ContentPair[]): Promise<string> {
	if (pairs.length === 0) return "";
	// The reading shows the quotation in full. Collapse marks in the source
	// hide repeated formulas; unwrap them here and leave the discourse page as it is.
	const expanded = pairs.map((pair) => ({
		...pair,
		english: pair.english.replace(/<\/?collapse[^>]*>/g, ""),
	}));
	const markdown = createCombinedMarkdown(expanded, false);
	if (typeof markdown !== "string" || !markdown.trim()) return "";
	const { html } = prerenderReadingMarkup(await parseMarkdown(markdown));
	return html;
}
