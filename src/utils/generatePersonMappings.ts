import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import matter from "gray-matter";
import {
	buildPersonAliasCatalog,
	canonicalSlugForPerson,
	isAnonymousPersonLabel,
	normalizePersonParts,
	resolvePersonLabel,
	sanitizePersonLabel,
	stripDiacritics,
	stripPersonPrefixes,
	type PersonAliasCatalog,
} from "./personIdentity";
import { isFalseCharacterLabel } from "./referenceCharacterTag";
import { toChicagoTitleCase } from "./toChicagoTitleCase";

type CurationEntry = {
	sortLetter?: string;
	extraSortLetters?: string[];
	title?: string;
	description?: string;
};

type DiscourseRef = {
	id: string;
	title: string;
	description: string;
	collection: string;
};

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
	const core = stripPersonPrefixes(cleaned);
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

/** `Vacchagottasutta` → `Vacchagotta sutta`; keep an already-spaced heading. */
export function paliTitleToSuttaHeading(paliTitle: string): string {
	const t = paliTitle.trim();
	if (!t) return "";
	if (/\s-\s/.test(t)) return t.split(" - ")[0]?.trim() || t;
	if (/\bsutta\b/i.test(t)) return t;
	return t.replace(/(sutta(?:ṁ|ṃ)?)$/i, " sutta").replace(/\s+/g, " ").trim();
}

/** Combine the Pali heading with the Sujato English title when there is no EN file. */
export function formatReferenceDiscourseTitle(
	paliTitle: string,
	sujatoTitle: string,
): string {
	const paliHeading = paliTitleToSuttaHeading(paliTitle);
	const english = sujatoTitle.trim();
	if (paliHeading && english) {
		if (paliHeading.toLowerCase() === english.toLowerCase()) return paliHeading;
		if (/\bsutta\b/i.test(english) && english.includes(" - ")) return english;
		return `${paliHeading} - ${english}`;
	}
	return paliHeading || english || paliTitle || sujatoTitle;
}

type PersonBucket = Record<
	string,
	Record<
		string,
		{
			title: string;
			description?: string | undefined;
			discourses: Map<string, DiscourseRef>;
		}
	>
>;

function addPersonDiscourse(
	byLetter: PersonBucket,
	raw: string,
	catalog: PersonAliasCatalog,
	curation: Record<string, CurationEntry>,
	discourse: DiscourseRef,
): void {
	const resolved = resolvePersonLabel(raw, catalog).label;
	if (isAnonymousPersonLabel(resolved) || isFalseCharacterLabel(resolved)) {
		return;
	}
	const slug = canonicalSlugForPerson(resolved, catalog);
	if (!slug) return;

	const letter = computeSortLetter(resolved, slug, curation);
	const bucketLetter = /^[A-Z]$/.test(letter) ? letter : "Z";

	if (!byLetter[bucketLetter]) byLetter[bucketLetter] = {};
	if (!byLetter[bucketLetter][slug]) {
		const cur = curation[slug];
		byLetter[bucketLetter][slug] = {
			title: formatDisplayTitle(resolved, curation, slug),
			description: cur?.description?.trim(),
			discourses: new Map(),
		};
	} else {
		const entry = byLetter[bucketLetter][slug];
		const cur = curation[slug];
		if (!cur?.title) {
			const candidate = formatDisplayTitle(resolved, curation, slug);
			if (candidate.length > entry.title.length) {
				entry.title = candidate;
			}
		}
	}

	const entry = byLetter[bucketLetter][slug];
	if (!entry.discourses.has(discourse.id)) {
		entry.discourses.set(discourse.id, discourse);
	}

	const extraLetters = (curation[slug]?.extraSortLetters || [])
		.map((letter) => letter.trim().toUpperCase())
		.filter((letter) => /^[A-Z]$/.test(letter) && letter !== bucketLetter);
	for (const extra of extraLetters) {
		if (!byLetter[extra]) byLetter[extra] = {};
		byLetter[extra][slug] = entry;
	}
}

function discourseMetaFromFile(
	root: string,
	id: string,
	collection: string,
	fallbackTitle: string,
	fallbackDescription: string,
): DiscourseRef {
	const enPath = path.join(root, "src/content/en", collection, `${id}.mdx`);
	if (fs.existsSync(enPath)) {
		const { data } = matter(fs.readFileSync(enPath, "utf8"));
		return {
			id,
			title: String(data.title || fallbackTitle),
			description: String(data.description || fallbackDescription || ""),
			collection,
		};
	}
	const sujatoPath = path.join(
		root,
		"src/content/references/sujato",
		collection,
		`${id}.md`,
	);
	if (fs.existsSync(sujatoPath)) {
		const { data } = matter(fs.readFileSync(sujatoPath, "utf8"));
		return {
			id,
			title: formatReferenceDiscourseTitle(
				fallbackTitle,
				String(data.title || ""),
			),
			description: String(data.description || fallbackDescription || ""),
			collection,
		};
	}
	return {
		id,
		title: fallbackTitle,
		description: fallbackDescription || "",
		collection,
	};
}

export async function generatePersonMappings(root = process.cwd()) {
	const curationPath = path.join(root, "src/data/personCurations.json");
	const curation: Record<string, CurationEntry> = JSON.parse(
		fs.readFileSync(curationPath, "utf8"),
	);

	const byLetter: PersonBucket = {};
	const enFiles = globSync("src/content/en/**/*.mdx", { cwd: root, absolute: true });
	const catalogLabels: string[] = [];

	type EnRow = {
		parts: string[];
		id: string;
		title: string;
		description: string;
		collection: string;
	};
	const enRows: EnRow[] = [];

	for (const filePath of enFiles) {
		try {
			const { data } = matter(fs.readFileSync(filePath, "utf8"));
			if (!data.character) continue;
			const parts = normalizePersonParts(data.character);
			if (parts.length === 0) continue;
			catalogLabels.push(...parts);
			const pathParts = filePath.split(path.sep);
			enRows.push({
				parts,
				id: data.slug as string,
				title: data.title as string,
				description: (data.description as string) || "",
				collection: pathParts[pathParts.length - 2] || "",
			});
		} catch (err) {
			console.error(`Error processing file ${filePath}:`, err);
		}
	}

	type PaliRow = {
		parts: string[];
		id: string;
		collection: string;
		fallbackTitle: string;
	};
	const paliRows: PaliRow[] = [];
	const paliFiles = globSync("src/content/pli/**/*.md", {
		cwd: root,
		absolute: true,
	});
	for (const filePath of paliFiles) {
		try {
			const { data } = matter(fs.readFileSync(filePath, "utf8"));
			if (!data.character) continue;
			const parts = normalizePersonParts(data.character);
			if (parts.length === 0) continue;
			catalogLabels.push(...parts);
			const pathParts = filePath.split(path.sep);
			const collection = pathParts[pathParts.length - 2] || "";
			const id = String(data.slug || "");
			if (!id) continue;
			paliRows.push({
				parts,
				id,
				collection,
				fallbackTitle: String(data.title || id),
			});
		} catch (err) {
			console.error(`Error processing file ${filePath}:`, err);
		}
	}

	const catalog = buildPersonAliasCatalog(catalogLabels);

	for (const row of enRows) {
		for (const raw of row.parts) {
			addPersonDiscourse(byLetter, raw, catalog, curation, {
				id: row.id,
				title: row.title,
				description: row.description,
				collection: row.collection,
			});
		}
	}

	for (const row of paliRows) {
		const meta = discourseMetaFromFile(
			root,
			row.id,
			row.collection,
			row.fallbackTitle,
			"",
		);
		for (const raw of row.parts) {
			addPersonDiscourse(byLetter, raw, catalog, curation, meta);
		}
	}

	const out: Record<
		string,
		Record<
			string,
			{
				title: string;
				description?: string;
				discourses: DiscourseRef[];
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
		path.join(root, "src/data/personMappings.json"),
		JSON.stringify(out, null, 2),
	);

	console.log(`person-mappings: wrote personMappings.json`);
}

function isMain(): boolean {
	const invoked = process.argv[1]?.replace(/\\/g, "/");
	return Boolean(invoked?.endsWith("generatePersonMappings.ts"));
}

if (isMain()) {
	generatePersonMappings().catch(console.error);
}
