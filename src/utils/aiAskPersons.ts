/**
 * Person-page matches for Ask: library hints + exact-match entity cards.
 */

import personMappings from "../data/personMappings.json";
import { transformId } from "./transformId";

export interface AiAskPersonRecord {
	slug: string;
	title: string;
	description: string;
	discourseIds: string[];
	/** First linked discourse description, when the person has no bio. */
	sampleDescription: string;
}

export interface AiAskPersonHit {
	slug: string;
	title: string;
	description: string;
	discourseCount: number;
	/** Formatted IDs for a compact “appears in” line. */
	sampleIds: string[];
	href: string;
}

const GENERIC_PERSON_QUESTION_KEYS = new Set([
	"buddha",
	"the buddha",
	"dhamma",
	"sangha",
	"bhikkhu",
	"bhikkhuni",
	"brahmin",
	"yakkha",
	"deva",
]);
/** English nouns that also appear as person slugs / “Deity X” titles. */
const COMMON_NOUN_PERSON_KEYS = new Set([
	"moon",
	"sun",
	"earth",
	"fire",
	"wind",
	"rain",
	"star",
	"light",
	"sky",
	"night",
	"day",
]);
/** Distinctive names for figures whose English title is a common noun. */
const PERSON_QUESTION_ALIASES: Record<string, readonly string[]> = {
	moon: ["candima", "candimasa"],
	sun: ["suriya"],
};
const PERSON_ROLE_PREFIX = /^(deity|god|goddess|spirit)\s+(.+)$/;
const MAX_HINT_PERSONS = 160;
const MAX_RESULT_PERSONS = 3;
const MAX_SAMPLE_IDS = 4;
const MAX_DESCRIPTION = 280;

type PersonGroup = Record<
	string,
	{
		title?: string;
		description?: string;
		discourses?: { id?: string; title?: string; description?: string }[];
	}
>;

let cachedRecords: AiAskPersonRecord[] | null = null;
let cachedBySlug: Map<string, AiAskPersonRecord> | null = null;

function clip(value: string, max: number): string {
	return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Fold diacritics / punctuation for exact-ish matching. */
export function normalizePersonMatchKey(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9\s-]/g, " ")
		.replace(/[-_]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function stripHonorifics(title: string): string {
	return title
		.replace(
			/^(venerable|ven\.?|bhikkhu|bhikkhuni|brahmin|king|queen|prince|princess|lady|lord)\s+/i,
			"",
		)
		.trim();
}

function escapePersonKey(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Distinctive keys that can exactly match a query / lookingFor phrase. */
export function personMatchKeys(record: AiAskPersonRecord): string[] {
	const keys = new Set<string>();
	const add = (raw: string) => {
		const key = normalizePersonMatchKey(raw);
		if (key && key.length >= 2) keys.add(key);
	};
	add(record.slug);
	add(record.title);
	add(stripHonorifics(record.title));
	const beforeComma = record.title.split(",")[0] || "";
	add(beforeComma);
	add(stripHonorifics(beforeComma));
	// Slug head before role suffixes: sakka-lord-of-the-gods → sakka
	const slugHead = record.slug.split("-")[0] || "";
	if (slugHead.length >= 3) add(slugHead);
	return [...keys];
}

/**
 * Names safe to look for in the reader's question. Skips short slug-heads that
 * collide with ordinary Dhamma terms (sati, nāga, …) and bare common nouns
 * (moon in “full moon”) that are not themselves a named figure.
 */
export function personQuestionKeys(record: AiAskPersonRecord): string[] {
	const keys = new Set<string>();
	const add = (raw: string, min = 4) => {
		const key = normalizePersonMatchKey(raw);
		if (!key || key.length < min) return;
		if (GENERIC_PERSON_QUESTION_KEYS.has(key)) return;
		if (COMMON_NOUN_PERSON_KEYS.has(key)) return;
		keys.add(key);
	};
	add(record.title);
	add(stripHonorifics(record.title));
	const beforeComma = record.title.split(",")[0] || "";
	add(beforeComma);
	add(stripHonorifics(beforeComma));
	add(record.slug.replace(/-/g, " "));
	const slugHead = record.slug.split("-")[0] || "";
	if (slugHead.length >= 5) add(slugHead);
	const roleTitle = normalizePersonMatchKey(record.title);
	const roleMatch = roleTitle.match(PERSON_ROLE_PREFIX);
	if (roleMatch) {
		const role = roleMatch[1] || "";
		const name = roleMatch[2] || "";
		if (name) {
			add(`${name} ${role}`);
			add(`${name} god`);
			add(`god ${name}`);
			add(`${name} goddess`);
			add(`goddess ${name}`);
		}
	}
	for (const alias of PERSON_QUESTION_ALIASES[record.slug] || []) {
		add(alias);
	}
	return [...keys];
}

function personWeakQuestionKeys(record: AiAskPersonRecord): string[] {
	const weak = new Set<string>();
	const consider = (raw: string) => {
		const key = normalizePersonMatchKey(raw);
		if (COMMON_NOUN_PERSON_KEYS.has(key)) weak.add(key);
	};
	consider(record.slug.replace(/-/g, " "));
	consider(record.slug.split("-")[0] || "");
	const beforeComma = record.title.split(",")[0] || "";
	const roleMatch = normalizePersonMatchKey(beforeComma).match(
		PERSON_ROLE_PREFIX,
	);
	if (roleMatch?.[2]) consider(roleMatch[2]);
	return [...weak];
}

function questionHasPersonKey(haystack: string, key: string): boolean {
	const pattern = new RegExp(`(?:^|\\s)${escapePersonKey(key)}(?:\\s|$)`);
	return pattern.test(haystack);
}

/** “Who is the Moon?” — not “a special full moon”. */
function questionAsksWhoIsWeakPerson(haystack: string, key: string): boolean {
	const k = escapePersonKey(key);
	const pattern = new RegExp(
		`(?:^|\\s)who (?:is|was|are|were) (?:the )?(?:deity |god |goddess |spirit )?${k}(?: deity| god| goddess| spirit)?$`,
	);
	return pattern.test(haystack);
}

/** True when the question text itself names this figure. */
export function questionNamesPerson(
	question: string,
	record: AiAskPersonRecord,
): boolean {
	const haystack = normalizePersonMatchKey(question);
	if (!haystack) return false;
	if (personQuestionKeys(record).some((key) => questionHasPersonKey(haystack, key))) {
		return true;
	}
	return personWeakQuestionKeys(record).some((key) =>
		questionAsksWhoIsWeakPerson(haystack, key),
	);
}

function blurbFor(record: AiAskPersonRecord): string {
	if (record.description) return clip(record.description, MAX_DESCRIPTION);
	if (record.sampleDescription) {
		return clip(record.sampleDescription, MAX_DESCRIPTION);
	}
	const count = record.discourseIds.length;
	if (count === 0) return "A figure who appears in the early discourses.";
	if (count === 1) {
		return `Appears in ${transformId(record.discourseIds[0] || "")}.`;
	}
	return `Appears in ${count} discourses in this library.`;
}

export function loadAskPersonRecords(): AiAskPersonRecord[] {
	if (cachedRecords) return cachedRecords;
	const out: AiAskPersonRecord[] = [];
	for (const group of Object.values(personMappings as PersonGroup)) {
		if (!group || typeof group !== "object") continue;
		for (const [slug, data] of Object.entries(group)) {
			const title = clip(typeof data?.title === "string" ? data.title : "", 120);
			if (!slug || !title) continue;
			const discourses = Array.isArray(data.discourses) ? data.discourses : [];
			const discourseIds = discourses
				.map((item) =>
					typeof item?.id === "string" ? item.id.trim().toLowerCase() : "",
				)
				.filter(Boolean);
			const sampleDescription = clip(
				typeof discourses[0]?.description === "string"
					? discourses[0].description
					: "",
				MAX_DESCRIPTION,
			);
			out.push({
				slug: slug.trim().toLowerCase(),
				title,
				description: clip(
					typeof data?.description === "string" ? data.description : "",
					MAX_DESCRIPTION,
				),
				discourseIds,
				sampleDescription,
			});
		}
	}
	out.sort(
		(a, b) =>
			b.discourseIds.length - a.discourseIds.length ||
			a.title.localeCompare(b.title),
	);
	cachedRecords = out;
	cachedBySlug = new Map(out.map((record) => [record.slug, record]));
	return out;
}

function personBySlug(slug: string): AiAskPersonRecord | null {
	loadAskPersonRecords();
	return cachedBySlug?.get(slug.trim().toLowerCase()) || null;
}

export function askPersonHintEntries(
	limit = MAX_HINT_PERSONS,
): { slug: string; title: string }[] {
	return loadAskPersonRecords()
		.slice(0, limit)
		.map((record) => ({ slug: record.slug, title: record.title }));
}

export function toAskPersonHit(record: AiAskPersonRecord): AiAskPersonHit {
	return {
		slug: record.slug,
		title: record.title,
		description: blurbFor(record),
		discourseCount: record.discourseIds.length,
		sampleIds: record.discourseIds
			.slice(0, MAX_SAMPLE_IDS)
			.map((id) => transformId(id)),
		href: `/on/${record.slug}`,
	};
}

/**
 * Person cards only when the question itself names the figure.
 * Planner slugs, lookingFor, and query chips are not enough on their own —
 * those often infer Āḷavaka / Sūciloma / Sakka from a story description.
 */
export function resolveAskPersonHits(options: {
	correctedQuestion?: string;
	lookingFor?: string;
	queries?: readonly string[];
	fallbackQueries?: readonly string[];
	personSlugs?: readonly string[];
	limit?: number;
}): AiAskPersonHit[] {
	const limit = options.limit ?? MAX_RESULT_PERSONS;
	const records = loadAskPersonRecords();
	const question = options.correctedQuestion || "";
	const matched = new Map<string, AiAskPersonRecord>();

	const consider = (record: AiAskPersonRecord) => {
		if (matched.has(record.slug)) return;
		if (!questionNamesPerson(question, record)) return;
		matched.set(record.slug, record);
	};

	for (const raw of options.personSlugs || []) {
		const record = personBySlug(raw);
		if (record) consider(record);
	}
	if (question) {
		for (const record of records) consider(record);
	}

	return [...matched.values()]
		.sort(
			(a, b) =>
				b.discourseIds.length - a.discourseIds.length ||
				a.title.localeCompare(b.title),
		)
		.slice(0, limit)
		.map(toAskPersonHit);
}

export function sanitizeAskPersonHits(raw: unknown): AiAskPersonHit[] {
	if (!Array.isArray(raw)) return [];
	const out: AiAskPersonHit[] = [];
	const seen = new Set<string>();
	for (const item of raw.slice(0, MAX_RESULT_PERSONS)) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const slug = clip(typeof record.slug === "string" ? record.slug : "", 80)
			.toLowerCase();
		const title = clip(typeof record.title === "string" ? record.title : "", 120);
		const href = clip(typeof record.href === "string" ? record.href : "", 120);
		if (!slug || !title || !href.startsWith("/on/")) continue;
		if (seen.has(slug)) continue;
		seen.add(slug);
		const sampleIds = Array.isArray(record.sampleIds)
			? record.sampleIds
					.filter((id): id is string => typeof id === "string")
					.map((id) => clip(id, 32))
					.filter(Boolean)
					.slice(0, MAX_SAMPLE_IDS)
			: [];
		out.push({
			slug,
			title,
			description: clip(
				typeof record.description === "string" ? record.description : "",
				MAX_DESCRIPTION,
			),
			discourseCount:
				typeof record.discourseCount === "number" &&
				Number.isFinite(record.discourseCount)
					? Math.max(0, Math.floor(record.discourseCount))
					: sampleIds.length,
			sampleIds,
			href,
		});
	}
	return out;
}
