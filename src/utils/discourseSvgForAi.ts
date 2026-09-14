import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
	contentImageBasenameMatchesSlug,
	DISCOURSE_SVG_AI_MAX_REQUESTED,
	DISCOURSE_SVG_AI_PER_FILE,
	DISCOURSE_SVG_AI_SUMMARY_CHARS,
	DISCOURSE_SVG_AI_SUMMARY_TOTAL,
	DISCOURSE_SVG_AI_TOTAL,
	normalizeDiscourseSvgRequestSlugs,
	normalizeDiscourseSvgSlug,
} from "./discourseSvgForAiPure";

// Re-exported so existing server-only importers keep working. WARNING: this
// module imports `node:fs` — never import it (even transitively) from
// client-reachable code (`aiModeClient.ts` and its graph). Browser-safe
// helpers live in `discourseSvgForAiPure.ts`. Importing this file in the
// browser crashes with "Module node:fs has been externalized".
export {
	contentImageBasenameMatchesSlug,
	DISCOURSE_SVG_AI_MAX_REQUESTED,
	DISCOURSE_SVG_AI_PER_FILE,
	DISCOURSE_SVG_AI_SUMMARY_CHARS,
	DISCOURSE_SVG_AI_SUMMARY_TOTAL,
	DISCOURSE_SVG_AI_TOTAL,
	normalizeDiscourseSvgRequestSlugs,
	normalizeDiscourseSvgSlug,
};

let cachedFiles: { dir: string; name: string }[] | null = null;

/**
 * Serverless note: read ONLY `public/content-images`, never
 * `src/assets/content-images`. Both hold the same files (synced in prebuild),
 * but `public/` is already shipped to the function via the adapter's
 * `includeFiles` for PDF export — referencing `src/` would make the file
 * tracer copy the whole directory a second time (~13 MB) into `_render.func`.
 */
function contentImageDirs(): string[] {
	return [path.join(process.cwd(), "public", "content-images")];
}

function listContentImageFiles(): { dir: string; name: string }[] {
	if (cachedFiles) return cachedFiles;
	const out: { dir: string; name: string }[] = [];
	const seen = new Set<string>();
	for (const dir of contentImageDirs()) {
		if (!existsSync(dir)) continue;
		let entries: string[] = [];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const name of entries) {
			if (!IMAGE_EXT.test(name)) continue;
			const key = name.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ dir, name });
		}
	}
	cachedFiles = out;
	return out;
}

export function resetDiscourseSvgForAiCacheForTests(): void {
	cachedFiles = null;
}

const IMAGE_EXT = /\.(svg|webp|jpe?g|png)$/i;

export function discourseHasIllustration(slug: string): boolean {
	const id = normalizeDiscourseSvgSlug(slug);
	if (!id) return false;
	return listContentImageFiles().some((file) =>
		contentImageBasenameMatchesSlug(file.name, id),
	);
}

export function withIllustrationFlags<T extends { slug: string }>(
	hits: readonly T[],
): Array<T & { hasIllustration?: true }> {
	return hits.map((hit) =>
		discourseHasIllustration(hit.slug)
			? { ...hit, hasIllustration: true as const }
			: hit,
	);
}

function tidySvgMarkup(raw: string): string {
	return raw
		.replace(/^\uFEFF/, "")
		.replace(/^\s*<\?xml[^?]*>\s*/i, "")
		.replace(/<!--([\s\S]*?)-->/g, "")
		.trim();
}

function matchingSvgFiles(slug: string): { dir: string; name: string }[] {
	const id = normalizeDiscourseSvgSlug(slug);
	if (!id) return [];
	const exact: { dir: string; name: string }[] = [];
	const extra: { dir: string; name: string }[] = [];
	for (const file of listContentImageFiles()) {
		if (!file.name.toLowerCase().endsWith(".svg")) continue;
		if (!contentImageBasenameMatchesSlug(file.name, id)) continue;
		const base = file.name.replace(IMAGE_EXT, "").toLowerCase();
		if (base === id) exact.push(file);
		else extra.push(file);
	}
	return [...exact, ...extra];
}

export function discourseHasSvgIllustration(slug: string): boolean {
	return matchingSvgFiles(slug).length > 0;
}

/** Keep only selected discourses that actually have SVG markup, capped. */
export function clipDiscourseSvgRequestSlugs(
	slugs: readonly string[],
	max = DISCOURSE_SVG_AI_MAX_REQUESTED,
): string[] {
	const cap = Math.max(0, Math.floor(max));
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of slugs) {
		const slug = normalizeDiscourseSvgSlug(raw);
		if (!slug || seen.has(slug)) continue;
		if (!discourseHasSvgIllustration(slug)) continue;
		seen.add(slug);
		out.push(slug);
		if (out.length >= cap) break;
	}
	return out;
}

function codePointChar(code: number): string {
	if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
	try {
		return String.fromCodePoint(code);
	} catch {
		return "";
	}
}

function decodeSvgText(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
			codePointChar(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, dec: string) => codePointChar(Number(dec)))
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function svgViewBox(markup: string): string {
	const match = markup.match(/\bviewBox\s*=\s*"([^"]+)"/i);
	return (match?.[1] || "").replace(/\s+/g, " ").trim();
}

function svgTextLabels(markup: string): string[] {
	const labels: string[] = [];
	const re = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
	let match: RegExpExecArray | null = re.exec(markup);
	while (match) {
		const inner = decodeSvgText(match[1].replace(/<[^>]+>/g, " "))
			.replace(/\s+/g, " ")
			.trim();
		if (inner) labels.push(inner);
		match = re.exec(markup);
	}
	return labels;
}

function readMatchingSvgMarkup(slug: string): string[] {
	const chunks: string[] = [];
	for (const file of matchingSvgFiles(slug)) {
		let raw = "";
		try {
			raw = readFileSync(path.join(file.dir, file.name), "utf8");
		} catch {
			continue;
		}
		const tidy = tidySvgMarkup(raw);
		if (tidy) chunks.push(tidy);
	}
	return chunks;
}

/**
 * Title-like labels from the site SVG, without coordinates or paint.
 * Enough for mermaid reuse; full markup is a separate request.
 */
export function loadDiscourseSvgSummaryForAi(
	slug: string,
	maxChars = DISCOURSE_SVG_AI_SUMMARY_CHARS,
): string | undefined {
	const cap = Math.max(0, Math.floor(maxChars));
	if (cap < 24) return undefined;
	const files = readMatchingSvgMarkup(slug);
	if (files.length === 0) return undefined;
	const viewBox = svgViewBox(files[0] || "");
	const labels = files.flatMap((markup) => svgTextLabels(markup));
	const lines = [
		viewBox ? `viewBox ${viewBox}` : "",
		...labels,
	].filter(Boolean);
	if (lines.length === 0) return "site SVG diagram (no text labels)";
	const joined = lines.join("\n");
	if (joined.length <= cap) return joined;
	return `${joined.slice(0, cap)}\n…`;
}

/**
 * Site SVG markup for a discourse, clipped for a model prompt.
 * Raster images are flagged separately; they are not inlined.
 */
export function loadDiscourseSvgMarkupForAi(
	slug: string,
	maxChars = DISCOURSE_SVG_AI_PER_FILE,
): string | undefined {
	const cap = Math.max(0, Math.floor(maxChars));
	if (cap < 32) return undefined;
	const chunks: string[] = [];
	let used = 0;
	for (const tidy of readMatchingSvgMarkup(slug)) {
		const remaining = cap - used;
		if (remaining < 32) break;
		const piece =
			tidy.length <= remaining
				? tidy
				: `${tidy.slice(0, remaining)}\n<!-- truncated -->`;
		chunks.push(piece);
		used += piece.length;
	}
	if (chunks.length === 0) return undefined;
	return chunks.join("\n\n");
}
