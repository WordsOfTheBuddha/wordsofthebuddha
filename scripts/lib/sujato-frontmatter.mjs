/**
 * Consistent YAML frontmatter writer for Sujato reference markdown files.
 * Avoids gray-matter folded scalars (description: >-) and quoted list strings.
 */

const FRONTMATTER_KEY_ORDER = [
	"slug",
	"source",
	"translator",
	"license",
	"title",
	"description",
	"qualities",
	"theme",
	"simile",
	"topic",
	"priority",
	"commentary",
	"edition",
	"granularity",
];

export function yamlScalar(value) {
	const text = String(value);
	if (
		text.includes(":") ||
		text.includes("#") ||
		text.includes("'") ||
		text.includes('"') ||
		text.startsWith(" ") ||
		text.endsWith(" ") ||
		text.startsWith("[") ||
		text.startsWith("{") ||
		text.startsWith("@") ||
		text.startsWith("`") ||
		text.startsWith("|") ||
		text.startsWith(">") ||
		text === "*" ||
		text === "&" ||
		text === "!" ||
		text === "%" ||
		text === "~"
	) {
		return JSON.stringify(text);
	}
	return text;
}

export function normalizeDescription(value) {
	if (value == null || value === "") return undefined;
	if (typeof value !== "string") return String(value);
	return value.replace(/\s+/g, " ").trim();
}

export function normalizeCommaList(value) {
	if (value == null || value === "") return undefined;
	if (Array.isArray(value)) {
		return value.map((v) => String(v).trim()).filter(Boolean).join(", ");
	}
	return String(value)
		.replace(/^['"]|['"]$/g, "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.join(", ");
}

export function orderedFrontmatterKeys(data) {
	const seen = new Set();
	const keys = [];
	for (const key of FRONTMATTER_KEY_ORDER) {
		if (key in data) {
			keys.push(key);
			seen.add(key);
		}
	}
	for (const key of Object.keys(data)) {
		if (!seen.has(key)) keys.push(key);
	}
	return keys;
}

export function buildSujatoFrontmatter(data) {
	const normalized = { ...data };
	if (normalized.description !== undefined) {
		normalized.description = normalizeDescription(normalized.description);
	}
	for (const key of ["qualities", "theme", "topic", "simile"]) {
		if (normalized[key] !== undefined) {
			normalized[key] = normalizeCommaList(normalized[key]);
		}
	}

	const lines = ["---"];
	for (const key of orderedFrontmatterKeys(normalized)) {
		const value = normalized[key];
		if (value === undefined || value === null || value === "") continue;
		lines.push(`${key}: ${yamlScalar(value)}`);
	}
	lines.push("---");
	return lines.join("\n");
}

export function buildSujatoMarkdown({ body, ...frontmatter }) {
	const fm = buildSujatoFrontmatter(frontmatter);
	const text = typeof body === "string" ? body.trim() : body.join("\n\n");
	return text ? `${fm}\n\n${text}\n` : `${fm}\n`;
}
