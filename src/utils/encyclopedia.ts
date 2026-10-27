/**
 * Pure encyclopedia helpers: gloss hits, human/automation merge, and queries.
 * File IO lives in generateEncyclopedia.ts and encyclopediaIndex.ts.
 */

import matter from "gray-matter";
import { splitPaliTerms } from "./extractTooltipPaliTerms";
import { GLOSS_RE, resolveGlossForDisplay } from "./glossDisplay";
import { normalizeForComparison } from "./searchRanking";
import type {
	EncyclopediaEntry,
	EncyclopediaIndexFile,
	EncyclopediaItem,
	EncyclopediaKind,
	EncyclopediaListItem,
	EncyclopediaMeta,
	EncyclopediaOccurrence,
	EncyclopediaOrigin,
	EncyclopediaRelated,
	EncyclopediaSource,
	EncyclopediaStatus,
} from "../types/encyclopedia";

export const ENCYCLOPEDIA_DEFAULT_LIMIT = 80;
export const ENCYCLOPEDIA_MAX_LIMIT = 500;

const KINDS: readonly EncyclopediaKind[] = [
	"term",
	"topic",
	"quality",
	"person",
	"simile",
	"place",
];

const MAP_KINDS = ["topic", "quality", "person", "simile"] as const;

const SOURCES: readonly EncyclopediaSource[] = [
	"tooltip",
	"topic",
	"quality",
	"person",
	"simile",
	"dictionary",
	"editor",
];

const STATUSES: readonly EncyclopediaStatus[] = ["raw", "seeded", "reviewed"];

const STATUS_ORDER: Record<EncyclopediaStatus, number> = {
	reviewed: 0,
	seeded: 1,
	raw: 2,
};

/** English tokens that must not join a simile or person name onto a headword. */
const TOKEN_STOP = new Set([
	"a",
	"an",
	"the",
	"of",
	"and",
	"or",
	"in",
	"on",
	"to",
	"vs",
	"for",
	"with",
	"from",
	"by",
	"its",
	"his",
	"her",
	"their",
	"into",
	"than",
	"that",
	"this",
]);

export interface GlossHit {
	norm: string;
	pali: string;
	label: string;
	gloss: string;
	discourseId: string;
	discourseTitle: string;
}

export function isEncyclopediaKind(value: string | null | undefined): value is EncyclopediaKind {
	return !!value && (KINDS as readonly string[]).includes(value);
}

export function isEncyclopediaStatus(
	value: string | null | undefined,
): value is EncyclopediaStatus {
	return !!value && (STATUSES as readonly string[]).includes(value);
}

export function isMapKind(
	value: string,
): value is EncyclopediaRelated["kind"] {
	return (MAP_KINDS as readonly string[]).includes(value);
}

/** Diacritic-folded key used for headwords and gloss-sense identity. */
export function automationKeyForText(value: string): string {
	return normalizeForComparison(value.replace(/\s+/g, " ").trim());
}

/**
 * URL segment for `/on/:slug`. Same folding as `canonicalOnSlug` in
 * discover-data.ts (non-ASCII letters are dropped, not transliterated).
 * Person and simile slugs are already folded before this runs.
 */
export function onSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

export { encyclopediaPath, normalizeEncyclopediaPathname } from "./encyclopediaPath";

/**
 * A bracketed token worth its own headword.
 * English phrases (spaces, no diacritics, no `+`) are not Pāli forms.
 * `kāyagata + sati` stays one headword; lemmata are not guessed.
 */
export function isPaliHeadword(surface: string): boolean {
	const term = surface.trim();
	if (term.length < 2 || term.length > 80) return false;
	if (!/\p{L}/u.test(term)) return false;
	if (
		/\s/.test(term) &&
		!term.includes("+") &&
		!/[^\u0000-\u007f]/.test(term)
	) {
		return false;
	}
	return true;
}

export function cleanPaliToken(raw: string): string {
	return raw
		.trim()
		.replace(/^[\s"'“”‘’([<]+/u, "")
		.replace(/[\s"'“”‘’)\].;:,>]+$/u, "")
		.trim();
}

/** Bracketed Pāli in a tooltip. Markdown links `[label](href)` are not Pāli. */
export function paliTermsInTooltip(tooltip: string): string[] {
	const terms: string[] = [];
	const bracketRe = /\[([^\]]+)\]/g;
	for (const match of tooltip.matchAll(bracketRe)) {
		const index = match.index ?? 0;
		const after = tooltip[index + match[0].length];
		if (after === "(") continue;
		for (const part of splitPaliTerms(match[1] ?? "")) {
			const term = cleanPaliToken(part);
			if (!isPaliHeadword(term)) continue;
			if (/https?:|\/\w/i.test(term)) continue;
			terms.push(term);
		}
	}
	return terms;
}

/**
 * Gloss hits from one English MDX document.
 * Vocatives (`|Bhikkhus,::::|`) are omitted. Discourse id prefers frontmatter `slug`.
 */
export function extractGlossHits(mdxSource: string, fallbackId = ""): GlossHit[] {
	let body = mdxSource;
	let discourseId = fallbackId;
	let discourseTitle = fallbackId;
	try {
		const parsed = matter(mdxSource);
		body = parsed.content;
		const slug = parsed.data?.slug;
		const title = parsed.data?.title;
		if (typeof slug === "string" && slug.trim()) discourseId = slug.trim();
		if (typeof title === "string" && title.trim()) discourseTitle = title.trim();
	} catch {
		body = mdxSource;
	}
	if (!discourseTitle) discourseTitle = discourseId;

	const hits: GlossHit[] = [];
	const glossRe = new RegExp(GLOSS_RE.source, "g");
	for (const match of body.matchAll(glossRe)) {
		const visible = match[1] ?? "";
		const rest = match[2] ?? "";
		const resolved = resolveGlossForDisplay(visible, rest);
		if (resolved.kind !== "tooltip") continue;
		const gloss = resolved.tooltip.replace(/\s+/g, " ").trim();
		if (!gloss) continue;
		const label = visible.replace(/\s+/g, " ").trim();
		for (const pali of paliTermsInTooltip(gloss)) {
			const norm = automationKeyForText(pali);
			if (norm.length < 2) continue;
			hits.push({
				norm,
				pali,
				label,
				gloss,
				discourseId,
				discourseTitle,
			});
		}
	}
	return hits;
}

/** One-line definition: drawer gloss with the Pāli bracket and markdown links removed. */
export function glossDefinition(gloss: string): string {
	return gloss
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/\s*\[[^\]]+\]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function entrySenses(entry: EncyclopediaEntry): EncyclopediaItem[] {
	return entry.items.filter(
		(item) => typeof item.gloss === "string" && item.gloss.trim().length > 0,
	);
}

export function discourseCount(entry: EncyclopediaEntry): number {
	const ids = new Set<string>();
	for (const item of entry.items) {
		for (const occurrence of item.occurrences ?? []) ids.add(occurrence.id);
	}
	return ids.size;
}

function mergeKey(item: EncyclopediaItem): string {
	const key = item.automationKey?.trim();
	return key ? key : `id:${item.id}`;
}

/**
 * Automation may add a new key and replace an item it previously wrote.
 * An `origin: human` item with the same key is left as written, occurrences included.
 * `existing` is the human overlay plus any automation already on the entry.
 */
export function mergeEncyclopediaItems(
	automated: EncyclopediaItem[],
	existing: EncyclopediaItem[],
): EncyclopediaItem[] {
	const result: EncyclopediaItem[] = [];
	const indexByKey = new Map<string, number>();

	for (const item of existing) {
		const key = mergeKey(item);
		if (indexByKey.has(key)) continue;
		indexByKey.set(key, result.length);
		result.push(item);
	}

	for (const item of automated) {
		const key = mergeKey(item);
		const at = indexByKey.get(key);
		if (at === undefined) {
			indexByKey.set(key, result.length);
			result.push(item);
			continue;
		}
		const prev = result[at];
		if (prev.origin === "human") continue;
		result[at] = { ...item, id: prev.id || item.id };
	}

	return result;
}

function asString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function parseOccurrences(value: unknown): EncyclopediaOccurrence[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const occurrences: EncyclopediaOccurrence[] = [];
	for (const row of value) {
		if (!row || typeof row !== "object") continue;
		const record = row as Record<string, unknown>;
		const id = asString(record.id);
		if (!id) continue;
		const title = asString(record.title) || id;
		occurrences.push({ id, title });
	}
	return occurrences.length > 0 ? occurrences : undefined;
}

/** One YAML document, keyed by `norm`, into human items. Origin is always human. */
export function overlayItemsFromDocument(
	doc: unknown,
	fallbackNorm: string,
): { norm: string; items: EncyclopediaItem[] } | null {
	if (!doc || typeof doc !== "object") return null;
	const record = doc as Record<string, unknown>;
	const norm = automationKeyForText(asString(record.norm) || fallbackNorm);
	if (!norm) return null;
	if (!Array.isArray(record.items)) return null;

	const items: EncyclopediaItem[] = [];
	record.items.forEach((row, index) => {
		if (!row || typeof row !== "object") return;
		const raw = row as Record<string, unknown>;
		const gloss = asString(raw.gloss);
		const note = asString(raw.note);
		const label = asString(raw.label);
		const keySource = asString(raw.automationKey) || gloss || note;
		if (!keySource) return;
		const sourceRaw = asString(raw.source);
		const source: EncyclopediaSource = (SOURCES as readonly string[]).includes(
			sourceRaw,
		)
			? (sourceRaw as EncyclopediaSource)
			: "editor";
		const kindRaw = asString(raw.kind);
		const kind = isEncyclopediaKind(kindRaw) ? kindRaw : undefined;
		const onSlugRaw = asString(raw.onSlug);
		const id = asString(raw.id) || `human:${norm}:${index + 1}`;
		const item: EncyclopediaItem = {
			id,
			origin: "human" satisfies EncyclopediaOrigin,
			source,
			automationKey: automationKeyForText(keySource),
			...(gloss ? { gloss } : {}),
			...(label ? { label } : {}),
			...(note ? { note } : {}),
			...(kind ? { kind } : {}),
			...(onSlugRaw ? { onSlug: onSlugRaw } : {}),
		};
		const occurrences = parseOccurrences(raw.occurrences);
		if (occurrences) item.occurrences = occurrences;
		items.push(item);
	});

	if (items.length === 0) return null;
	return { norm, items };
}

export function entryFromHuman(
	norm: string,
	items: EncyclopediaItem[],
): EncyclopediaEntry {
	const labels: string[] = [];
	for (const item of items) {
		if (item.label && !labels.includes(item.label)) labels.push(item.label);
	}
	const gloss = items.find((item) => item.gloss)?.gloss;
	const pali = (gloss && paliTermsInTooltip(gloss)[0]) || norm;
	const humanKind = items.find((item) => item.kind)?.kind;
	return {
		norm,
		pali,
		labels,
		kind: humanKind ?? "term",
		status: "reviewed",
		related: [],
		dictionary: null,
		items,
	};
}

/** Apply the YAML overlay. Human items replace any automated item with the same key. */
export function mergeHumanOverlay(
	entry: EncyclopediaEntry,
	humanItems: EncyclopediaItem[],
): EncyclopediaEntry {
	if (humanItems.length === 0) return entry;
	const automated = entry.items.filter((item) => item.origin !== "human");
	const items = mergeEncyclopediaItems(automated, humanItems);
	const labels = [...entry.labels];
	for (const item of humanItems) {
		if (item.label && !labels.includes(item.label)) labels.unshift(item.label);
	}
	const humanKind = humanItems.find((item) => item.kind)?.kind;
	return {
		...entry,
		items,
		labels,
		kind: humanKind ?? entry.kind,
		status: "reviewed",
	};
}

export function mergeOverlayIntoIndex(
	index: EncyclopediaIndexFile,
	overlay: Map<string, EncyclopediaItem[]>,
): EncyclopediaIndexFile {
	const entries: Record<string, EncyclopediaEntry> = { ...index.entries };
	for (const [norm, humanItems] of overlay) {
		const existing = entries[norm];
		entries[norm] = existing
			? mergeHumanOverlay(existing, humanItems)
			: entryFromHuman(norm, humanItems);
	}
	return { version: 1, entries };
}

export function emptyEncyclopediaMeta(): EncyclopediaMeta {
	return {
		version: 1,
		entries: 0,
		byStatus: { raw: 0, seeded: 0, reviewed: 0 },
		byKind: {
			term: 0,
			topic: 0,
			quality: 0,
			person: 0,
			simile: 0,
			place: 0,
		},
	};
}

export function summarizeEncyclopedia(index: EncyclopediaIndexFile): EncyclopediaMeta {
	const meta = emptyEncyclopediaMeta();
	for (const entry of Object.values(index.entries)) {
		meta.entries += 1;
		meta.byStatus[entry.status] += 1;
		meta.byKind[entry.kind] += 1;
	}
	return meta;
}

export function mostCommonForm(
	counts: Map<string, number>,
	fallback: string,
): string {
	let best: string | null = null;
	let bestCount = -1;
	for (const [form, count] of counts) {
		if (!form) continue;
		if (
			best == null ||
			count > bestCount ||
			(count === bestCount && formBeats(form, best))
		) {
			best = form;
			bestCount = count;
		}
	}
	return best ?? fallback;
}

function formBeats(form: string, best: string): boolean {
	const formDia = /[^\u0000-\u007f]/.test(form);
	const bestDia = /[^\u0000-\u007f]/.test(best);
	if (formDia !== bestDia) return formDia;
	return form.localeCompare(best) < 0;
}

export function sortOccurrences(
	occurrences: EncyclopediaOccurrence[],
): EncyclopediaOccurrence[] {
	return [...occurrences].sort((a, b) =>
		a.id.localeCompare(b.id, undefined, {
			numeric: true,
			sensitivity: "base",
		}),
	);
}

function entryMatchesQuery(entry: EncyclopediaEntry, qNorm: string): boolean {
	if (entry.norm.includes(qNorm)) return true;
	if (automationKeyForText(entry.pali).includes(qNorm)) return true;
	if (entry.labels.some((label) => automationKeyForText(label).includes(qNorm))) {
		return true;
	}
	if (
		entry.related.some(
			(related) =>
				related.slug.includes(qNorm) ||
				automationKeyForText(related.title).includes(qNorm),
		)
	) {
		return true;
	}
	return entry.items.some(
		(item) =>
			(item.gloss && automationKeyForText(item.gloss).includes(qNorm)) ||
			(item.note && automationKeyForText(item.note).includes(qNorm)) ||
			(item.label && automationKeyForText(item.label).includes(qNorm)),
	);
}

function compareEntries(a: EncyclopediaEntry, b: EncyclopediaEntry): number {
	const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
	if (byStatus !== 0) return byStatus;
	const byPali = a.pali.localeCompare(b.pali, "en", { sensitivity: "base" });
	if (byPali !== 0) return byPali;
	return a.norm.localeCompare(b.norm);
}

export function toListItem(entry: EncyclopediaEntry): EncyclopediaListItem {
	return {
		norm: entry.norm,
		pali: entry.pali,
		kind: entry.kind,
		status: entry.status,
		label: entry.labels[0] ?? null,
		senseCount: entrySenses(entry).length,
		discourseCount: discourseCount(entry),
	};
}

export interface EncyclopediaQuery {
	q?: string;
	kind?: string | null;
	status?: string | null;
	limit?: number;
}

export interface EncyclopediaQueryResult {
	q: string;
	kind: EncyclopediaKind | null;
	status: EncyclopediaStatus | null;
	limit: number;
	total: number;
	counts: EncyclopediaMeta;
	results: EncyclopediaListItem[];
}

function clampLimit(limit: number | undefined): number {
	if (limit == null || !Number.isFinite(limit)) return ENCYCLOPEDIA_DEFAULT_LIMIT;
	return Math.min(
		ENCYCLOPEDIA_MAX_LIMIT,
		Math.max(1, Math.floor(limit)),
	);
}

export function queryEncyclopedia(
	index: EncyclopediaIndexFile,
	query: EncyclopediaQuery = {},
): EncyclopediaQueryResult {
	const q = (query.q ?? "").trim();
	const qNorm = q ? automationKeyForText(q) : "";
	const kind = isEncyclopediaKind(query.kind) ? query.kind : null;
	const status = isEncyclopediaStatus(query.status) ? query.status : null;
	const limit = clampLimit(query.limit);
	const counts = summarizeEncyclopedia(index);
	const matched: EncyclopediaEntry[] = [];
	for (const entry of Object.values(index.entries)) {
		if (kind && entry.kind !== kind) continue;
		if (status && entry.status !== status) continue;
		if (qNorm && !entryMatchesQuery(entry, qNorm)) continue;
		matched.push(entry);
	}
	matched.sort(compareEntries);
	return {
		q,
		kind,
		status,
		limit,
		total: matched.length,
		counts,
		results: matched.slice(0, limit).map(toListItem),
	};
}

export function resolveEncyclopediaNorm(
	raw: string,
	entries: Record<string, EncyclopediaEntry>,
): string | null {
	let decoded = raw;
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		decoded = raw;
	}
	decoded = decoded.trim();
	if (!decoded) return null;
	if (entries[decoded]) return decoded;
	const norm = automationKeyForText(decoded);
	if (entries[norm]) return norm;
	return null;
}

/** Significant tokens of a display name, for joining a map onto an existing norm. */
export function displayNameNorms(name: string): string[] {
	const norms = new Set<string>();
	const full = automationKeyForText(name);
	if (full.length >= 2) norms.add(full);
	for (const token of name.split(/[\s,;/]+/)) {
		const cleaned = cleanPaliToken(token);
		const norm = automationKeyForText(cleaned);
		if (norm.length < 3 || TOKEN_STOP.has(norm)) continue;
		norms.add(norm);
	}
	return [...norms];
}
