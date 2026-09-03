import { transformId } from "./transformId";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Display / compact aliases for a discourse slug that may appear in prose. */
export function discourseIdAliases(slug: string): string[] {
	const compact = slug.trim().toLowerCase();
	if (!compact) return [];
	const display = transformId(compact);
	const noSpaceDisplay = display.replace(/\s+/g, "");
	const upperCompact = compact.toUpperCase();
	const spaced = compact.replace(/^([a-z]+)(\d)/i, "$1 $2");
	return [...new Set([compact, display, noSpaceDisplay, upperCompact, spaced])]
		.map((alias) => alias.trim())
		.filter(Boolean);
}

/**
 * Keep paragraph breaks; collapse intra-paragraph whitespace. Used before
 * storing, clipping, and rendering Ask briefings.
 */
export function normalizeAskSummaryProse(value: string, max?: number): string {
	const text = value
		.replace(/\r\n/g, "\n")
		.split(/\n+/)
		.map((part) => part.replace(/[ \t]+/g, " ").trim())
		.filter(Boolean)
		.join("\n\n");
	if (max == null) return text;
	return text.slice(0, Math.max(0, max));
}

function linkifySummaryParagraph(
	text: string,
	byKey: Map<string, string>,
	pattern: RegExp | null,
): string {
	if (!pattern) return escapeHtml(text);
	let out = "";
	let cursor = 0;
	for (const match of text.matchAll(pattern)) {
		const index = match.index ?? 0;
		const token = match[0] || "";
		if (index > cursor) {
			out += escapeHtml(text.slice(cursor, index));
		}
		const href = byKey.get(token.toLowerCase());
		if (href) {
			out += `<a class="ai-summary-ref" href="${escapeHtml(href)}">${escapeHtml(token)}</a>`;
		} else {
			out += escapeHtml(token);
		}
		cursor = index + token.length;
	}
	if (cursor < text.length) {
		out += escapeHtml(text.slice(cursor));
	}
	return out;
}

/**
 * Escape summary prose and link known discourse IDs to result hrefs.
 * Only IDs present in `results` are linked (never invent destinations).
 * Returns inner HTML: one `<p>` per paragraph.
 */
export function linkifyAskSummaryHtml(
	summary: string,
	results: readonly { slug: string; href?: string }[],
): string {
	const text = normalizeAskSummaryProse(summary);
	if (!text) return "";

	type Alias = { alias: string; href: string };
	const aliases: Alias[] = [];
	const seenAlias = new Set<string>();
	for (const hit of results) {
		const slug = (hit.slug || "").trim().toLowerCase();
		if (!slug) continue;
		const href = (hit.href || `/${slug}`).trim() || `/${slug}`;
		for (const alias of discourseIdAliases(slug)) {
			const key = alias.toLowerCase();
			if (seenAlias.has(key)) continue;
			seenAlias.add(key);
			aliases.push({ alias, href });
		}
	}
	aliases.sort((a, b) => b.alias.length - a.alias.length);
	const pattern =
		aliases.length > 0
			? new RegExp(
					`\\b(?:${aliases.map((item) => escapeRegExp(item.alias)).join("|")})\\b`,
					"gi",
				)
			: null;
	const byKey = new Map(
		aliases.map((item) => [item.alias.toLowerCase(), item.href] as const),
	);

	return text
		.split("\n\n")
		.map(
			(paragraph) =>
				`<p>${linkifySummaryParagraph(paragraph, byKey, pattern)}</p>`,
		)
		.join("");
}
