import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import { readFileSync } from "fs";
import matter from "gray-matter";
import { toChicagoTitleCase } from "./toChicagoTitleCase";

type CurationEntry = {
	sortLetter?: string;
	title?: string;
	description?: string;
};

const PREFIX_RES = [
	/^venerable\s+/i,
	/^ven\.\s*/i,
	/^bhikkhu\s+/i,
	/^bhikkhunī\s+/i,
	/^householder\s+/i,
	/^layman\s+/i,
	/^laywoman\s+/i,
	/^lay\s+disciple\s+/i,
	/^wanderer\s+/i,
	/^the\s+/i,
];

function stripDiacritics(s: string): string {
	return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Strip stray list/typography quotes often pasted into comma-separated person lists. */
function sanitizePersonLabel(raw: string): string {
	let s = raw.trim();
	s = s.replace(/^[\s"'“”‘’]+/u, "").replace(/[\s"'“”‘’]+$/u, "");
	return s.trim();
}

/** Split on commas only outside balanced ASCII double-quotes (for names like "Sakka, lord of the gods"). */
function splitCommaOutsideDoubleQuotes(input: string): string[] {
	let depth = 0;
	let start = 0;
	const out: string[] = [];
	for (let i = 0; i < input.length; i++) {
		const c = input[i];
		if (c === '"') depth ^= 1;
		if (c === "," && depth === 0) {
			out.push(input.slice(start, i));
			start = i + 1;
		}
	}
	out.push(input.slice(start));
	return out.map((p) => p.trim()).filter(Boolean);
}

/**
 * One entry per person: supports YAML string, YAML array, `;` between names,
 * comma-split when unambiguous, or comma+quotes for embedded commas.
 */
function normalizePersonParts(value: unknown): string[] {
	if (value == null) return [];
	if (Array.isArray(value)) {
		return value.map((v) => sanitizePersonLabel(String(v))).filter(Boolean);
	}
	const s = String(value).trim();
	if (!s) return [];
	if (s.includes(";")) {
		return s.split(";").map(sanitizePersonLabel).filter(Boolean);
	}
	if (s.includes('"')) {
		return splitCommaOutsideDoubleQuotes(s).map(sanitizePersonLabel).filter(Boolean);
	}
	return s.split(",").map(sanitizePersonLabel).filter(Boolean);
}

/** URL-safe slug from a normalized string. */
function slugifySegment(raw: string): string {
	return stripDiacritics(raw)
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

function stripPrefixes(label: string): string {
	let s = label.trim();
	for (const re of PREFIX_RES) {
		s = s.replace(re, "");
	}
	return s.trim();
}

/**
 * Stable identity for /on/:slug — strip honorifics before slugifying so
 * "Sāriputta" and "Venerable Sāriputta" merge into one person card.
 */
function canonicalSlugForPerson(raw: string): string {
	const cleaned = sanitizePersonLabel(raw);
	const core = stripPrefixes(cleaned);
	return slugifySegment(core || cleaned);
}

function computeSortLetter(
	raw: string,
	slug: string,
	curation: Record<string, CurationEntry>,
): string {
	const entry = curation[slug];
	if (entry?.sortLetter && /^[A-Za-z]$/.test(entry.sortLetter.trim())) {
		return entry.sortLetter.trim().toUpperCase();
	}
	const cleaned = sanitizePersonLabel(raw);
	const core = stripPrefixes(cleaned);
	const firstWord = core.split(/\s+/)[0] || cleaned;
	const ch = stripDiacritics(firstWord).charAt(0).toUpperCase();
	if (/[A-Z]/.test(ch)) return ch;
	const fallback = stripDiacritics(cleaned).charAt(0).toUpperCase();
	return /[A-Z]/.test(fallback) ? fallback : "Z";
}

function formatDisplayTitle(
	raw: string,
	curation: Record<string, CurationEntry>,
	slug: string,
): string {
	const cur = curation[slug];
	if (cur?.title?.trim()) return cur.title.trim();
	return toChicagoTitleCase(sanitizePersonLabel(raw).replace(/\s+/g, " "));
}

export async function generatePersonMappings() {
	const curationPath = path.join(
		process.cwd(),
		"src/data/personCurations.json",
	);
	const curation: Record<string, CurationEntry> = JSON.parse(
		readFileSync(curationPath, "utf8"),
	);

	/** letter -> slug -> aggregate */
	const byLetter: Record<
		string,
		Record<
			string,
			{
				title: string;
				description?: string | undefined;
				discourses: Map<
					string,
					{ id: string; title: string; description: string; collection: string }
				>;
			}
		>
	> = {};

	const contentFiles = globSync("src/content/en/**/*.mdx");

	for (const filePath of contentFiles) {
		try {
			const content = readFileSync(filePath, "utf8");
			const { data } = matter(content);
			if (!data.character) continue;

			const pathParts = filePath.split("/");
			const collection = pathParts[pathParts.length - 2];

			const parts = normalizePersonParts(data.character);

			for (const raw of parts) {
				const slug = canonicalSlugForPerson(raw);
				if (!slug) continue;

				const letter = computeSortLetter(raw, slug, curation);
				const bucketLetter = /^[A-Z]$/.test(letter) ? letter : "Z";

				if (!byLetter[bucketLetter]) byLetter[bucketLetter] = {};
				if (!byLetter[bucketLetter][slug]) {
					const cur = curation[slug];
					const title = formatDisplayTitle(raw, curation, slug);
					const description = cur?.description?.trim();
					byLetter[bucketLetter][slug] = {
						title,
						description,
						discourses: new Map(),
					};
				} else {
					const entry = byLetter[bucketLetter][slug];
					const cur = curation[slug];
					if (!cur?.title) {
						const candidate = formatDisplayTitle(raw, curation, slug);
						if (candidate.length > entry.title.length) {
							entry.title = candidate;
						}
					}
				}

				const entry = byLetter[bucketLetter][slug];
				const id = data.slug as string;
				if (!entry.discourses.has(id)) {
					entry.discourses.set(id, {
						id,
						title: data.title as string,
						description: (data.description as string) || "",
						collection,
					});
				}
			}
		} catch (err) {
			console.error(`Error processing file ${filePath}:`, err);
		}
	}

	const out: Record<
		string,
		Record<
			string,
			{
				title: string;
				description?: string;
				discourses: Array<{
					id: string;
					title: string;
					description: string;
					collection: string;
				}>;
			}
		>
	> = {};

	for (const [letter, group] of Object.entries(byLetter)) {
		out[letter] = {};
		for (const [slug, agg] of Object.entries(group)) {
			const list = Array.from(agg.discourses.values());
			list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
			out[letter][slug] = {
				title: agg.title,
				...(agg.description ? { description: agg.description } : {}),
				discourses: list,
			};
		}
	}

	fs.writeFileSync(
		path.join(process.cwd(), "src/data/personMappings.json"),
		JSON.stringify(out, null, 2),
	);

	console.log("Person mappings generated successfully");
}

generatePersonMappings().catch(console.error);
