#!/usr/bin/env node

/**
 * Build generated/encyclopedia-index.json from English MDX glosses plus the
 * topic, quality, person, and simile maps. Human YAML wins on key collision.
 */

import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import matter from "gray-matter";
import {
	buildPersonAliasCatalog,
	canonicalSlugForPerson,
	isAnonymousPersonLabel,
	normalizePersonParts,
	resolvePersonLabel,
	stripPersonPrefixes,
} from "./personIdentity";
import { getAllTopics } from "./loadTopics";
import { toChicagoTitleCase } from "./toChicagoTitleCase";
import { writeGzipCompanion } from "./gzipJsonFile";
import { loadEncyclopediaOverlay } from "./encyclopediaIndex";
import {
	automationKeyForText,
	displayNameNorms,
	extractGlossHits,
	isPaliHeadword,
	mergeOverlayIntoIndex,
	mostCommonForm,
	onSlug,
	sortOccurrences,
	summarizeEncyclopedia,
} from "./encyclopedia";
import type {
	EncyclopediaEntry,
	EncyclopediaItem,
	EncyclopediaKind,
	EncyclopediaMeta,
	EncyclopediaRelated,
} from "../types/encyclopedia";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const KIND_RANK: Record<"topic" | "quality" | "person" | "simile", number> = {
	topic: 4,
	quality: 3,
	person: 2,
	simile: 1,
};

interface CuratedLink {
	source: "topic" | "quality" | "person" | "simile";
	onSlug: string;
	title: string;
	/** Norms to attach to when an entry already exists (or is seeded). */
	norms: string[];
	/** Pāli norms that become entries even with no gloss. */
	seedNorms: string[];
	surfaces: Map<string, string>;
}

interface SenseDraft {
	glossCounts: Map<string, number>;
	labelCounts: Map<string, number>;
	occurrences: Map<string, string>;
}

interface EntryDraft {
	formCounts: Map<string, number>;
	labelCounts: Map<string, number>;
	senses: Map<string, SenseDraft>;
	links: CuratedLink[];
}

interface ParsedFile {
	id: string;
	title: string;
	body: string;
	similes: string[];
	characters: string[];
}

function bump(counts: Map<string, number>, key: string) {
	if (!key) return;
	counts.set(key, (counts.get(key) ?? 0) + 1);
}

function emptyDraft(): EntryDraft {
	return {
		formCounts: new Map(),
		labelCounts: new Map(),
		senses: new Map(),
		links: [],
	};
}

function ensureDraft(
	drafts: Map<string, EntryDraft>,
	norm: string,
): EntryDraft {
	let draft = drafts.get(norm);
	if (!draft) {
		draft = emptyDraft();
		drafts.set(norm, draft);
	}
	return draft;
}

/** Create a map-only entry. Does not add a spelling vote when glosses already exist. */
function seedDraft(
	drafts: Map<string, EntryDraft>,
	norm: string,
	surface?: string,
) {
	if (drafts.has(norm)) return;
	const draft = emptyDraft();
	if (surface) bump(draft.formCounts, surface);
	drafts.set(norm, draft);
}

function addPaliNorm(
	norms: Set<string>,
	seed: string[],
	surfaces: Map<string, string>,
	surface: string,
	seedEntry: boolean,
) {
	if (!isPaliHeadword(surface)) return;
	const norm = automationKeyForText(surface);
	if (norm.length < 2) return;
	norms.add(norm);
	if (!surfaces.has(norm)) surfaces.set(norm, surface);
	if (seedEntry) seed.push(norm);
}

function readJson(filePath: string): unknown | null {
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch (err) {
		console.warn(`encyclopedia: could not read ${filePath}`, err);
		return null;
	}
}

function topicLinks(): CuratedLink[] {
	const links: CuratedLink[] = [];
	for (const [slug, topic] of Object.entries(getAllTopics())) {
		const norms = new Set<string>();
		const seedNorms: string[] = [];
		const surfaces = new Map<string, string>();
		for (const pali of topic.pali ?? []) {
			for (const part of pali.split(",")) {
				addPaliNorm(norms, seedNorms, surfaces, part.trim(), true);
			}
		}
		const titleNorm = automationKeyForText(topic.title);
		if (titleNorm.length >= 2) norms.add(titleNorm);
		const linkSlug = onSlug(slug);
		if (!linkSlug) continue;
		links.push({
			source: "topic",
			onSlug: linkSlug,
			title: topic.title,
			norms: [...norms],
			seedNorms,
			surfaces,
		});
	}
	return links;
}

function qualityTitle(key: string): string {
	return key.charAt(0).toUpperCase() + key.slice(1);
}

function qualityLinks(root: string): CuratedLink[] {
	const file = readJson(path.join(root, "src/data/qualities.json")) as {
		qualities?: Record<string, unknown>;
	} | null;
	const table = file?.qualities ?? {};
	const links: CuratedLink[] = [];
	for (const [key, value] of Object.entries(table)) {
		if (!Array.isArray(value)) continue;
		const norms = new Set<string>();
		const seedNorms: string[] = [];
		const surfaces = new Map<string, string>();
		for (const item of value) {
			if (typeof item !== "string") continue;
			const bracket = item.match(/^\[([\s\S]+)\]$/);
			if (!bracket) continue;
			for (const part of bracket[1].split(",")) {
				addPaliNorm(norms, seedNorms, surfaces, part.trim(), true);
			}
		}
		const titleNorm = automationKeyForText(key);
		if (titleNorm.length >= 2) norms.add(titleNorm);
		const linkSlug = onSlug(key);
		if (!linkSlug) continue;
		links.push({
			source: "quality",
			onSlug: linkSlug,
			title: qualityTitle(key),
			norms: [...norms],
			seedNorms,
			surfaces,
		});
	}
	return links;
}

function simileLink(name: string): CuratedLink | null {
	const display = name.trim().toLowerCase();
	if (!display) return null;
	const linkSlug = onSlug(display);
	if (!linkSlug) return null;
	return {
		source: "simile",
		onSlug: linkSlug,
		title: toChicagoTitleCase(display),
		norms: displayNameNorms(display),
		seedNorms: [],
		surfaces: new Map(),
	};
}

function simileLinksFromJson(data: unknown): CuratedLink[] {
	if (!data || typeof data !== "object") return [];
	const links: CuratedLink[] = [];
	for (const group of Object.values(data as Record<string, unknown>)) {
		if (!group || typeof group !== "object") continue;
		for (const name of Object.keys(group as object)) {
			const link = simileLink(name);
			if (link) links.push(link);
		}
	}
	return links;
}

function simileLinksFromFiles(files: ParsedFile[]): CuratedLink[] {
	const bySlug = new Map<string, CuratedLink>();
	for (const file of files) {
		for (const name of file.similes) {
			const link = simileLink(name);
			if (!link || bySlug.has(link.onSlug)) continue;
			bySlug.set(link.onSlug, link);
		}
	}
	return [...bySlug.values()];
}

function personLink(
	slug: string,
	title: string,
): CuratedLink | null {
	const linkSlug = onSlug(slug);
	if (!linkSlug || isAnonymousPersonLabel(title)) return null;
	const seedNorms: string[] = [];
	const surfaces = new Map<string, string>();
	const core = stripPersonPrefixes(title);
	const norms = new Set<string>(displayNameNorms(core || title));
	if (linkSlug.length >= 2) norms.add(linkSlug);
	const tokens = core.split(/\s+/).filter(Boolean);
	if (tokens.length === 1 && isPaliHeadword(tokens[0])) {
		const norm = automationKeyForText(tokens[0]);
		if (norm.length >= 2) {
			norms.add(norm);
			seedNorms.push(norm);
			surfaces.set(norm, tokens[0]);
		}
	}
	return {
		source: "person",
		onSlug: linkSlug,
		title,
		norms: [...norms],
		seedNorms,
		surfaces,
	};
}

function personLinksFromJson(data: unknown): CuratedLink[] {
	if (!data || typeof data !== "object") return [];
	const links: CuratedLink[] = [];
	for (const group of Object.values(data as Record<string, unknown>)) {
		if (!group || typeof group !== "object") continue;
		for (const [slug, row] of Object.entries(group as Record<string, unknown>)) {
			const title =
				row &&
				typeof row === "object" &&
				typeof (row as { title?: unknown }).title === "string"
					? (row as { title: string }).title
					: slug;
			const link = personLink(slug, title);
			if (link) links.push(link);
		}
	}
	return links;
}

function personLinksFromFiles(root: string, files: ParsedFile[]): CuratedLink[] {
	const labels: string[] = [];
	for (const file of files) labels.push(...file.characters);
	const catalog = buildPersonAliasCatalog(labels);
	let curation: Record<string, { title?: string }> = {};
	const curationJson = readJson(path.join(root, "src/data/personCurations.json"));
	if (curationJson && typeof curationJson === "object") {
		curation = curationJson as Record<string, { title?: string }>;
	}
	const bySlug = new Map<string, CuratedLink>();
	for (const raw of labels) {
		const resolved = resolvePersonLabel(raw, catalog).label;
		if (isAnonymousPersonLabel(resolved)) continue;
		const slug = canonicalSlugForPerson(resolved, catalog);
		if (!slug || bySlug.has(slug)) continue;
		const curated = curation[slug]?.title?.trim();
		const link = personLink(slug, curated || resolved);
		if (link) bySlug.set(slug, link);
	}
	return [...bySlug.values()];
}

function parseDiscourses(root: string): ParsedFile[] {
	const files = globSync("src/content/en/**/*.mdx", { cwd: root });
	const parsed: ParsedFile[] = [];
	for (const rel of files) {
		try {
			const text = readFileSync(path.join(root, rel), "utf8");
			const doc = matter(text);
			const slug =
				typeof doc.data.slug === "string" && doc.data.slug.trim()
					? doc.data.slug.trim()
					: path.basename(rel, ".mdx");
			const title =
				typeof doc.data.title === "string" && doc.data.title.trim()
					? doc.data.title.trim()
					: slug;
			const similes =
				typeof doc.data.simile === "string"
					? doc.data.simile
							.split(",")
							.map((name) => name.trim())
							.filter(Boolean)
					: [];
			parsed.push({
				id: slug,
				title,
				body: text,
				similes,
				characters: normalizePersonParts(doc.data.character),
			});
		} catch (err) {
			console.warn(`encyclopedia: skipped ${rel}`, err);
		}
	}
	return parsed;
}

function rankedLabels(counts: Map<string, number>): string[] {
	return [...counts.entries()]
		.filter(([label]) => label.trim().length > 0)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([label]) => label);
}

function relatedFrom(links: CuratedLink[]): EncyclopediaRelated[] {
	const bySlug = new Map<string, EncyclopediaRelated>();
	for (const link of links) {
		const previous = bySlug.get(link.onSlug);
		if (
			!previous ||
			KIND_RANK[link.source] > KIND_RANK[previous.kind]
		) {
			bySlug.set(link.onSlug, {
				slug: link.onSlug,
				kind: link.source,
				title: link.title,
			});
		}
	}
	return [...bySlug.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function bestKind(links: CuratedLink[]): EncyclopediaKind {
	let kind: EncyclopediaKind = "term";
	let rank = 0;
	for (const link of links) {
		const next = KIND_RANK[link.source];
		if (next > rank) {
			rank = next;
			kind = link.source;
		}
	}
	return kind;
}

function draftToEntry(norm: string, draft: EntryDraft): EncyclopediaEntry {
	const related = relatedFrom(draft.links);
	const senses: EncyclopediaItem[] = [];
	for (const [key, sense] of draft.senses) {
		const gloss = mostCommonForm(sense.glossCounts, key);
		const label = mostCommonForm(sense.labelCounts, "");
		const occurrences = sortOccurrences(
			[...sense.occurrences.entries()].map(([id, title]) => ({ id, title })),
		);
		senses.push({
			id: `tooltip:${key}`,
			origin: "automation",
			source: "tooltip",
			automationKey: key,
			gloss,
			...(label ? { label } : {}),
			occurrences,
		});
	}
	senses.sort(
		(a, b) =>
			(b.occurrences?.length ?? 0) - (a.occurrences?.length ?? 0) ||
			(a.gloss ?? "").localeCompare(b.gloss ?? ""),
	);
	const maps: EncyclopediaItem[] = related.map((relatedLink) => ({
		id: `${relatedLink.kind}:${relatedLink.slug}`,
		origin: "automation",
		source: relatedLink.kind,
		automationKey: relatedLink.slug,
		onSlug: relatedLink.slug,
	}));
	const kind = bestKind(draft.links);
	return {
		norm,
		pali: mostCommonForm(draft.formCounts, norm),
		labels: rankedLabels(draft.labelCounts),
		kind,
		status: related.length > 0 ? "seeded" : "raw",
		related,
		dictionary: null,
		items: [...senses, ...maps],
	};
}

export async function generateEncyclopedia(root = repoRoot): Promise<EncyclopediaMeta> {
	const start = Date.now();
	const files = parseDiscourses(root);
	const drafts = new Map<string, EntryDraft>();

	for (const file of files) {
		for (const hit of extractGlossHits(file.body, file.id)) {
			const draft = ensureDraft(drafts, hit.norm);
			bump(draft.formCounts, hit.pali);
			bump(draft.labelCounts, hit.label);
			const key = automationKeyForText(hit.gloss);
			let sense = draft.senses.get(key);
			if (!sense) {
				sense = {
					glossCounts: new Map(),
					labelCounts: new Map(),
					occurrences: new Map(),
				};
				draft.senses.set(key, sense);
			}
			bump(sense.glossCounts, hit.gloss);
			bump(sense.labelCounts, hit.label);
			if (hit.discourseId && !sense.occurrences.has(hit.discourseId)) {
				sense.occurrences.set(hit.discourseId, hit.discourseTitle || hit.discourseId);
			}
		}
	}

	const simileFile = path.join(root, "src/data/simileMappings.json");
	const personFile = path.join(root, "src/data/personMappings.json");
	const simileJson = readJson(simileFile);
	const personJson = readJson(personFile);
	const links = [
		...topicLinks(),
		...qualityLinks(root),
		...(simileJson ? simileLinksFromJson(simileJson) : simileLinksFromFiles(files)),
		...(personJson
			? personLinksFromJson(personJson)
			: personLinksFromFiles(root, files)),
	];

	for (const link of links) {
		for (const norm of link.seedNorms) {
			seedDraft(drafts, norm, link.surfaces.get(norm));
		}
		for (const norm of link.norms) {
			const draft = drafts.get(norm);
			if (!draft) continue;
			if (
				draft.links.some(
					(existing) =>
						existing.source === link.source && existing.onSlug === link.onSlug,
				)
			) {
				continue;
			}
			draft.links.push(link);
		}
	}

	const entries: Record<string, EncyclopediaEntry> = {};
	for (const [norm, draft] of drafts) {
		entries[norm] = draftToEntry(norm, draft);
	}
	const merged = mergeOverlayIntoIndex(
		{ version: 1, entries },
		loadEncyclopediaOverlay(root),
	);
	const ordered: Record<string, EncyclopediaEntry> = {};
	for (const norm of Object.keys(merged.entries).sort()) {
		ordered[norm] = merged.entries[norm];
	}
	const index = { version: 1 as const, entries: ordered };
	const meta = summarizeEncyclopedia(index);

	const generatedDir = path.join(root, "generated");
	await mkdir(generatedDir, { recursive: true });
	const indexJson = JSON.stringify(index);
	const indexPath = path.join(generatedDir, "encyclopedia-index.json");
	await writeFile(indexPath, indexJson, "utf8");
	await writeGzipCompanion(indexPath, indexJson);
	await writeFile(
		path.join(generatedDir, "encyclopedia-meta.json"),
		`${JSON.stringify(meta, null, 2)}\n`,
		"utf8",
	);

	const kb = Buffer.byteLength(indexJson, "utf8") / 1024;
	const ms = Date.now() - start;
	console.log(
		`encyclopedia: wrote ${meta.entries} entries (raw ${meta.byStatus.raw}, seeded ${meta.byStatus.seeded}, reviewed ${meta.byStatus.reviewed}; term ${meta.byKind.term}, topic ${meta.byKind.topic}, quality ${meta.byKind.quality}, person ${meta.byKind.person}, simile ${meta.byKind.simile}, place ${meta.byKind.place}) to generated/encyclopedia-index.json (${kb.toFixed(1)} KB) in ${ms}ms`,
	);
	return meta;
}

const isDirectRun = process.argv[1]?.includes("generateEncyclopedia");
if (isDirectRun) {
	generateEncyclopedia().catch((err) => {
		console.error("encyclopedia generation failed:", err);
		process.exit(1);
	});
}
