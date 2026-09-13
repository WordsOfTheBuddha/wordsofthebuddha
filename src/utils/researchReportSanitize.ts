/**
 * Allow a diagram-oriented HTML/SVG subset in research reports.
 * Scripts, handlers, and off-site URLs are dropped.
 */

const DROP_WITH_CONTENTS = new Set([
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"applet",
	"link",
	"meta",
	"base",
	"form",
	"input",
	"textarea",
	"button",
	"select",
	"option",
	"animate",
	"animatetransform",
	"set",
	"handler",
	"listener",
	"video",
	"audio",
	"source",
	"track",
	"frame",
	"frameset",
	"html",
	"head",
	"body",
	"noscript",
	"template",
]);

const ALLOWED_TAGS = new Set([
	"svg",
	"g",
	"path",
	"rect",
	"circle",
	"ellipse",
	"line",
	"polyline",
	"polygon",
	"text",
	"tspan",
	"textpath",
	"defs",
	"clippath",
	"mask",
	"lineargradient",
	"radialgradient",
	"stop",
	"marker",
	"symbol",
	"title",
	"desc",
	"use",
	"pattern",
	"switch",
	"foreignobject",
	"figure",
	"figcaption",
	"div",
	"span",
	"p",
	"ul",
	"ol",
	"li",
	"dl",
	"dt",
	"dd",
	"table",
	"thead",
	"tbody",
	"tfoot",
	"tr",
	"td",
	"th",
	"caption",
	"colgroup",
	"col",
	"strong",
	"em",
	"b",
	"i",
	"br",
	"hr",
	"h2",
	"h3",
	"h4",
	"blockquote",
	"pre",
	"code",
	"small",
	"sup",
	"sub",
	"abbr",
	"mark",
	"u",
	"s",
	"wbr",
	"a",
]);

const VOID_TAGS = new Set([
	"br",
	"hr",
	"col",
	"path",
	"circle",
	"ellipse",
	"line",
	"polygon",
	"polyline",
	"rect",
	"stop",
	"use",
]);

const ALLOWED_STYLE = new Set([
	"fill",
	"stroke",
	"stroke-width",
	"stroke-opacity",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-dasharray",
	"fill-opacity",
	"opacity",
	"color",
	"background",
	"background-color",
	"font-size",
	"font-family",
	"font-weight",
	"font-style",
	"text-anchor",
	"dominant-baseline",
	"alignment-baseline",
	"letter-spacing",
	"line-height",
	"white-space",
	"width",
	"height",
	"max-width",
	"min-width",
	"margin",
	"padding",
	"display",
	"flex-direction",
	"align-items",
	"justify-content",
	"gap",
	"transform",
	"overflow",
	"text-align",
	"border",
	"border-width",
	"border-style",
	"border-color",
	"border-radius",
	"rx",
	"ry",
]);

const ATTR_NAME = /^[a-zA-Z_:][\w:.-]*$/;
const ON_ATTR = /^on/i;
const SAFE_HREF = /^(?:\/(?!\/)|#)/;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const SVG_TAG_CASE: Record<string, string> = {
	clippath: "clipPath",
	textpath: "textPath",
	lineargradient: "linearGradient",
	radialgradient: "radialGradient",
	foreignobject: "foreignObject",
};

function emitTag(name: string): string {
	return SVG_TAG_CASE[name] || name;
}

function tagName(raw: string): string {
	return raw.replace(/[^a-zA-Z0-9:-]/g, "").toLowerCase();
}

export function isSafeReportHref(href: string): boolean {
	const trimmed = href.trim();
	if (!trimmed || trimmed.toLowerCase().startsWith("#javascript")) return false;
	if (SAFE_HREF.test(trimmed)) return true;
	return false;
}

function sanitizeStyle(value: string): string {
	return value
		.split(";")
		.map((part) => {
			const idx = part.indexOf(":");
			if (idx < 0) return "";
			const prop = part.slice(0, idx).trim().toLowerCase();
			const val = part.slice(idx + 1).trim();
			if (!ALLOWED_STYLE.has(prop) || !val) return "";
			if (/expression|javascript|behavior|@import|url\s*\(/i.test(val)) {
				return "";
			}
			return `${prop}: ${val}`;
		})
		.filter(Boolean)
		.join("; ");
}

function sanitizeAttrValue(name: string, value: string): string | null {
	const key = name.toLowerCase();
	if (ON_ATTR.test(key) || key === "srcdoc" || key === "formaction") {
		return null;
	}
	if (key === "style") {
		const style = sanitizeStyle(value);
		return style || null;
	}
	if (
		key === "href" ||
		key === "xlink:href" ||
		key === "src" ||
		key === "action"
	) {
		return isSafeReportHref(value) ? value.trim() : null;
	}
	if (!isSafeUrlAttrValue(value)) return null;
	return value;
}

/** Allow `url(#id)` marker/gradient refs; reject other urls and javascript. */
function isSafeUrlAttrValue(value: string): boolean {
	if (/javascript:/i.test(value)) return false;
	const urls = value.match(/url\s*\(([^)]*)\)/gi);
	if (!urls) return !/url\s*\(/i.test(value);
	return urls.every((item) => {
		const inner = item
			.replace(/^url\s*\(/i, "")
			.replace(/\)$/, "")
			.trim()
			.replace(/^['"]|['"]$/g, "");
		return inner.startsWith("#");
	});
}

function isSafeCss(css: string): boolean {
	if (/<\/style/i.test(css)) return false;
	if (
		/@import|@charset|expression\s*\(|javascript:|-moz-binding|behavior\s*:/i.test(
			css,
		)
	) {
		return false;
	}
	const urls = css.match(/url\s*\(([^)]*)\)/gi) || [];
	return urls.every((item) => {
		const inner = item
			.replace(/^url\s*\(/i, "")
			.replace(/\)$/, "")
			.trim()
			.replace(/^['"]|['"]$/g, "");
		return inner.startsWith("#");
	});
}

function parseAttrs(raw: string): string {
	let out = "";
	const re =
		/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(raw))) {
		const name = (match[1] || "").trim();
		if (!ATTR_NAME.test(name) || name === "/") continue;
		const value = match[2] ?? match[3] ?? match[4] ?? "";
		const clean = sanitizeAttrValue(name, value);
		if (clean == null) continue;
		out += ` ${name}="${escapeHtml(clean)}"`;
	}
	return out;
}

/**
 * Keep diagram HTML/SVG. Drop scripts, event handlers, and off-site URLs.
 * `allowStyle` is only for mermaid-generated SVG (class rules, not model HTML).
 */
export function sanitizeResearchReportHtml(
	raw: string,
	options?: { allowStyle?: boolean },
): string {
	const allowStyle = Boolean(options?.allowStyle);
	const input = (raw || "").replace(/\r\n/g, "\n");
	if (!input.trim()) return "";
	let out = "";
	let i = 0;
	const skipUntil: string[] = [];
	while (i < input.length) {
		if (skipUntil.length > 0) {
			const close = skipUntil[skipUntil.length - 1] || "";
			const idx = input.toLowerCase().indexOf(close, i);
			if (idx < 0) break;
			const gt = input.indexOf(">", idx);
			i = gt < 0 ? input.length : gt + 1;
			skipUntil.pop();
			continue;
		}
		const lt = input.indexOf("<", i);
		if (lt < 0) {
			out += escapeHtml(input.slice(i));
			break;
		}
		if (lt > i) out += escapeHtml(input.slice(i, lt));
		if (input.startsWith("<!--", lt)) {
			const end = input.indexOf("-->", lt + 4);
			i = end < 0 ? input.length : end + 3;
			continue;
		}
		if (input.startsWith("<![CDATA[", lt)) {
			const end = input.indexOf("]]>", lt + 9);
			if (end < 0) break;
			out += escapeHtml(input.slice(lt + 9, end));
			i = end + 3;
			continue;
		}
		const gt = input.indexOf(">", lt + 1);
		if (gt < 0) {
			out += escapeHtml(input.slice(lt));
			break;
		}
		const inner = input.slice(lt + 1, gt);
		i = gt + 1;
		if (inner.startsWith("!") || inner.startsWith("?")) continue;
		const closing = inner.startsWith("/");
		const body = closing ? inner.slice(1) : inner;
		const nameMatch = body.match(/^[^\s/]+/);
		const name = tagName(nameMatch?.[0] || "");
		if (!name) continue;
		if (name === "style" && allowStyle && !closing) {
			const closeIdx = input.toLowerCase().indexOf("</style", i);
			if (closeIdx < 0) break;
			const css = input.slice(i, closeIdx);
			const closeGt = input.indexOf(">", closeIdx);
			i = closeGt < 0 ? input.length : closeGt + 1;
			if (isSafeCss(css)) out += `<style>${css}</style>`;
			continue;
		}
		if (DROP_WITH_CONTENTS.has(name)) {
			if (!closing && !VOID_TAGS.has(name) && !inner.endsWith("/")) {
				skipUntil.push(`</${name}`);
			}
			continue;
		}
		if (!ALLOWED_TAGS.has(name)) continue;
		if (closing) {
			out += `</${emitTag(name)}>`;
			continue;
		}
		const attrRaw = body.slice(nameMatch?.[0]?.length || 0);
		const attrs = parseAttrs(attrRaw);
		const selfClose = VOID_TAGS.has(name) || inner.endsWith("/");
		out += `<${emitTag(name)}${attrs}>`;
		if (selfClose && !VOID_TAGS.has(name) && name !== "use") {
			out += `</${emitTag(name)}>`;
		}
	}
	return out.trim();
}

export function wrapResearchReportHtml(html: string): string {
	const clean = sanitizeResearchReportHtml(html);
	return clean ? `<div class="ai-report-html">${clean}</div>` : "";
}

const MERMAID_START =
	/^\s*(?:flowchart|graph(?:\s+(?:TD|LR|TB|RL|BT))?|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie\b|mindmap|timeline|gitGraph|quadrantChart|sankey(?:-beta)?|requirementDiagram|C4Context|block-beta|packet-beta)\b/i;

export function isMermaidFenceLang(lang: string): boolean {
	const name = lang.replace(/\s+/g, "").toLowerCase();
	return name === "mermaid" || name === "mmd";
}

export function looksLikeMermaidSource(text: string): boolean {
	return MERMAID_START.test(text);
}

export function isSvgFenceLang(lang: string): boolean {
	return lang.replace(/\s+/g, "").toLowerCase() === "svg";
}

export function isHtmlFenceLang(lang: string): boolean {
	const name = lang.replace(/\s+/g, "").toLowerCase();
	return name === "html" || name === "xhtml";
}

export function looksLikeHtmlBlock(text: string): boolean {
	return /^\s*<(?:svg|figure|div|table|section)\b/i.test(text);
}

export function mermaidBlockHtml(source: string): string {
	const text = source.replace(/\r\n/g, "\n").trim();
	if (!text) return "";
	return `<pre class="ai-report-mermaid" data-ai-mermaid>${escapeHtml(text)}</pre>\n`;
}

export function reportCodeBlockHtml(source: string): string {
	return `<pre class="ai-report-code"><code>${escapeHtml(source)}</code></pre>\n`;
}
