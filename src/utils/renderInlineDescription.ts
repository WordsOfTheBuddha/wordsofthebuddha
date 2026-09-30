/**
 * Minimal inline markdown for curated `/on` page descriptions (person bios).
 *
 * Supports `[text](url)`, `**bold**`, and `*italics*` / `_italics_`.
 * Everything else is plain text: HTML is escaped first, and only
 * safe URLs (site-relative, `#anchor`, or `http(s)`) become links.
 */

const LINK_TOKEN = "@@WOTB-LINK-";

function escapeHtmlText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function isSafeHref(href: string): boolean {
	const target = href.trim();
	return (
		target.startsWith("/") ||
		target.startsWith("#") ||
		target.startsWith("http://") ||
		target.startsWith("https://")
	);
}

/** Bold/italics only — links are extracted before this runs. */
function renderInlineEmphasis(escaped: string): string {
	let out = escaped.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
	out = out.replace(/\*([^*]+?)\*/g, "<em>$1</em>");
	out = out.replace(
		/(^|[\s(>"'\-])_([^_]+?)_([\s).,"';:!?\-]|$)/g,
		"$1<em>$2</em>$3",
	);
	return out;
}

export function renderInlineDescription(raw: string): string {
	if (!raw) return "";
	const escaped = escapeHtmlText(raw);
	const links: string[] = [];
	const withPlaceholders = escaped.replace(
		/\[([^\]]+?)\]\(([^)\s]+?)\)/g,
		(match, text: string, href: string) => {
			if (!isSafeHref(href)) return match;
			links.push(`<a href="${href}">${renderInlineEmphasis(text)}</a>`);
			return `${LINK_TOKEN}${links.length - 1}@@`;
		},
	);
	const formatted = renderInlineEmphasis(withPlaceholders);
	return formatted.replace(
		/@@WOTB-LINK-(\d+)@@/g,
		(_, index: string) => links[Number(index)] ?? "",
	);
}
