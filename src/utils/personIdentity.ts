/**
 * Shared person identity: honorific stripping, short-name aliases onto
 * existing labels, and English near-duplicate review groups.
 */

import { readFileSync } from "node:fs";
import { globSync } from "glob";
import matter from "gray-matter";

const PREFIX_RES = [
	/^venerable\s+/i,
	/^ven\.\s*/i,
	/^bhikkhunī\s+/i,
	/^bhikkhuni\s+/i,
	/^bhikkhu\s+/i,
	/^householder\s+/i,
	/^housewife\s+/i,
	/^brahmin\s+woman\s+/i,
	/^lay\s+follower\s+/i,
	/^layman\s+/i,
	/^laywoman\s+/i,
	/^lay\s+disciple\s+/i,
	/^wanderer\s+/i,
	/^young\s+householder\s+/i,
	/^young\s+brahmin\s+/i,
	/^brahmin\s+/i,
	/^builder\s+/i,
	/^chamberlain\s+/i,
	/^headman\s+/i,
	/^general\s+/i,
	/^king\s+/i,
	/^princess\s+/i,
	/^prince\s+/i,
	/^divinity\s+/i,
	/^deity\s+/i,
	/^spirit\s+/i,
	/^native\s+spirit\s+/i,
	/^naked\s+ascetic\s+/i,
	/^acelo?\s+/i,
	/^sakyan\s+laywoman\s+/i,
	/^the\s+/i,
];

const STOP_WORDS = new Set([
	"and",
	"chief",
	"etc",
	"evil",
	"god",
	"gods",
	"householder",
	"lady",
	"ladies",
	"lord",
	"minister",
	"ministers",
	"of",
	"one",
	"son",
	"sons",
	"the",
	"young",
]);

const COMPOUND_PREFIXES = ["maha", "cula", "cul", "culla", "kumara"];

/** Same person across a life/death arc; mapping should share one card. */
const PERSON_ARC_PREFERRED: Record<string, string> = {
	anathapindika: "Householder Anāthapiṇḍika",
	ghatikara: "Ghaṭikāra the Potter",
	hatthaka: "Hatthaka of Āḷavi",
	nakulamata: "Laywoman Nakulamātā",
	nandamata: "Laywoman Nandamātā",
	suppavasa: "Laywoman Suppavāsā",
	visakhamigaramata: "Laywoman Visākhā Migāramātā",
	samavati: "Laywoman Sāmāvatī",
	sona: "Householder Soṇa",
	siha: "General Sīha",
	annasikondanna: "Venerable Aññāsikoṇḍañña",
	isidatta: "Layman Isidatta",
	purana: "Layman Purāṇa",
	uggaha: "Uggaha, Meṇḍaka's grandson",
	vasettha: "Young Brahmin Vāseṭṭha",
	mahakotthita: "Venerable Mahākoṭṭhita",
};

const HONORIFIC_RES = [
	/^venerable\s+/i,
	/^ven\.\s*/i,
	/^bhikkhunī\s+/i,
	/^bhikkhuni\s+/i,
	/^bhikkhu\s+/i,
	/^the\s+/i,
];

type RoleFamily =
	| "ordained"
	| "nun"
	| "wanderer"
	| "lay"
	| "brahmin"
	| "young-brahmin"
	| "royal"
	| "official"
	| "deity"
	| "buddha";

const ROLE_FAMILY_RES: Array<[RegExp, RoleFamily]> = [
	[/^venerable\s+|^ven\.\s*|^bhikkhu\s+/i, "ordained"],
	[/^bhikkhunī\s+|^bhikkhuni\s+/i, "nun"],
	[/^wanderer\s+|^naked\s+ascetic\s+|^acelo?\s+/i, "wanderer"],
	[
		/^householder\s+|^housewife\s+|^layman\s+|^laywoman\s+|^lay\s+follower\s+|^lay\s+disciple\s+|^builder\s+|^brahmin\s+woman\s+|^sakyan\s+laywoman\s+/i,
		"lay",
	],
	[/^young\s+brahmin\s+/i, "young-brahmin"],
	[/^brahmin\s+/i, "brahmin"],
	[/^king\s+|^prince\s+|^princess\s+|\brajakumar/i, "royal"],
	[/^general\s+|^headman\s+|^chamberlain\s+|\bgamani\b/i, "official"],
	[/^deity\s+|^divinity\s+|^spirit\s+|^native\s+spirit\s+|\byakkho?\b/i, "deity"],
	[/^buddha\s+/i, "buddha"],
];

export function personRoleFamily(label: string): RoleFamily | null {
	const folded = foldPersonText(sanitizePersonLabel(label));
	for (const [re, family] of ROLE_FAMILY_RES) {
		if (re.test(folded)) return family;
	}
	return null;
}

export function rolesCompatible(a: string, b: string): boolean {
	const fa = personRoleFamily(a);
	const fb = personRoleFamily(b);
	if (fa && fb && fa !== fb) return false;
	return true;
}

/** Bare names must not collapse onto a monk just because English only tagged one. */
function shouldAliasTo(query: string, hit: string): boolean {
	if (!rolesCompatible(query, hit)) return false;
	const queryFamily = personRoleFamily(query);
	const hitFamily = personRoleFamily(hit);
	if (!queryFamily && hitFamily === "ordained") return false;
	if (queryFamily === "ordained" && !hitFamily) return false;
	return true;
}

export type PersonAliasCatalog = {
	labels: string[];
	preferredByFold: Map<string, string>;
	preferredByCore: Map<string, string>;
	labelsByLastWord: Map<string, string[]>;
	labelsByFirstWord: Map<string, string[]>;
};

export type PersonAliasResolution = {
	label: string;
	via: "exact" | "core" | "last-word" | "first-word" | "maha-compound" | "unchanged";
	ambiguous?: string[];
};

export type EnglishLabelVariantGroup = {
	kind: "same-core" | "shared-name";
	key: string;
	labels: string[];
};

export function stripDiacritics(s: string): string {
	return s.normalize("NFD").replace(/\p{M}/gu, "");
}

export function foldPersonText(s: string): string {
	return stripDiacritics(s).toLowerCase();
}

const ANONYMOUS_PERSON_TOKENS = new Set(
	[
		"añña",
		"aññaṁ",
		"aññaṃ",
		"aññā",
		"aññatara",
		"aññataro",
		"aññatarā",
		"aññataraṁ",
		"aññataraṃ",
		"adhimāna",
		"adhimānasacca",
		"adhimāniko",
		"nissāya",
		"sambahula",
		"sambahulā",
		"sambahulo",
		"itthannāma",
		"itthannāmā",
		"itthannāmo",
		"evaṁnāma",
		"evaṁnāmo",
		"evaṁnāmā",
		"lokāyatikā",
		"lokāyatiko",
		"lokāyatik",
		"acirapakkante",
		"acirapakkantesu",
		"aññatitthiyesu",
		"aññatitthiyāna",
		"annatitthiyesu",
		"annatitthiyana",
		"āyasmata",
		"ayasmata",
		"dve",
		"pañcahi",
		"pañcamattehi",
		"ekacco",
		"ekaccā",
		"kocideva",
		"bhikkhaka",
		"bhikkhako",
	].map(foldPersonText),
);

/** "A certain nun", "declares knowledge", "depending on" — not a person. */
export function isAnonymousPersonLabel(label: string): boolean {
	const core = stripPersonPrefixes(sanitizePersonLabel(label));
	const tokens = foldPersonText(core)
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	if (tokens.length === 0) return true;
	return tokens.some((token) => ANONYMOUS_PERSON_TOKENS.has(token));
}

/**
 * Citation-form a Pali a-stem: Mānatthaddhassa / Mānatthaddhaṁ / Mānatthaddho
 * → Mānatthaddha. Leave English and already-stemmed names alone.
 */
export function stemPaliPersonToken(token: string): string {
	const name = token.replace(/[.,;:]+$/u, "");
	if (name.length < 5) return name;
	const folded = foldPersonText(name);
	if (folded.endsWith("assa") && name.length > 6) {
		return `${name.slice(0, -4)}a`;
	}
	if (/a[ṁṃm]$/u.test(name)) {
		return name.slice(0, -1);
	}
	if (/[oō]$/u.test(name)) {
		return `${name.slice(0, -1)}a`;
	}
	return name;
}

export const PERSON_FILTER_CLASSES = [
	"Bhikkhu",
	"Bhikkhunī",
	"Awakened One",
	"Wanderer",
	"Lay follower",
	"Laywoman",
	"Royal",
	"Deities & Gods",
] as const;

export type PersonFilterClass = (typeof PERSON_FILTER_CLASSES)[number];

/** Browse-filter class for the /person index. Null means uncategorized. */
export function personFilterClass(label: string): PersonFilterClass | null {
	const folded = foldPersonText(sanitizePersonLabel(label));
	if (/^bhikkhun[iī]\b/.test(folded) || /\bbhikkhun[iī]\b/.test(folded)) {
		return "Bhikkhunī";
	}
	if (/\bmahapajapati\b/.test(folded)) {
		return "Bhikkhunī";
	}
	if (
		/^(venerable|ven\.|bhikkhu|novice)\b/.test(folded) ||
		/\bnovice\b/.test(folded) ||
		/^kokalika\b/.test(folded)
	) {
		return "Bhikkhu";
	}
	if (/^buddha\b/.test(folded) || /\bbuddha$/.test(folded)) {
		return "Awakened One";
	}
	if (
		/^wanderer\b/.test(folded) ||
		/^naked ascetic\b/.test(folded) ||
		/\b(naked ascetic|nigantha|acela|of the bark cloth|ja[tṭ]il)/.test(folded)
	) {
		return "Wanderer";
	}
	if (
		/^(housewife|laywoman|brahmin woman|sakyan laywoman)\b/.test(folded) ||
		/\b(upasika|courtesan|laywoman)\b/.test(folded)
	) {
		return "Laywoman";
	}
	const last = folded.split(/[^a-z0-9]+/).filter(Boolean).pop() || "";
	if (/(mata|gahapatani|dhita)$/.test(last)) return "Laywoman";
	if (
		/^(young\s+)?(householder|builder|chamberlain|headman|general|lay follower|layman|lay disciple|brahmin)\b/.test(
			folded,
		) ||
		/\b(the householder|the potter|gahapati|upasaka|gamani|senapati|hatthisariputta|grandson)\b/.test(
			folded,
		) ||
		/\bbhaddiya the (licchavi|sakyan)\b/.test(folded) ||
		(/\bthe sakyan\b/.test(folded) && !folded.includes("devanaminda")) ||
		/\bkomarabhacca\b/.test(folded) ||
		/^jivaka\b/.test(folded) ||
		/^mahanama\b/.test(folded)
	) {
		return "Lay follower";
	}
	if (/^king yama\b/.test(folded)) {
		return "Deities & Gods";
	}
	if (
		/^(king|prince|princess|queen|raja)\b/.test(folded) ||
		/\b(rajakumar|queen)\b/.test(folded) ||
		/\bthe aristocrat\b/.test(folded)
	) {
		return "Royal";
	}
	if (
		/^(deity|divinity|spirit)\b/.test(folded) ||
		/^brahm[āa]\b/.test(folded) ||
		/\b(yakkha|yakkho|gandhabba|asura|devaputt|lord of the gods|lord of the asuras|mara the evil|native spirit|the brahm[aā])\b/.test(
			folded,
		)
	) {
		return "Deities & Gods";
	}
	return null;
}

const EXTRA_PERSON_FILTER_CLASSES: Record<string, PersonFilterClass[]> = {
	brahmasahampati: ["Awakened One"],
};

/** One person may appear in more than one browse filter. */
export function personFilterClasses(label: string): PersonFilterClass[] {
	const primary = personFilterClass(label);
	const extras = EXTRA_PERSON_FILTER_CLASSES[compactPersonCore(label)] || [];
	const out: PersonFilterClass[] = [];
	if (primary) out.push(primary);
	for (const extra of extras) {
		if (!out.includes(extra)) out.push(extra);
	}
	return out;
}

/** Strip stray list/typography quotes often pasted into comma-separated person lists. */
export function sanitizePersonLabel(raw: string): string {
	let s = raw.trim();
	s = s.replace(/^[\s"'“”‘’]+/u, "").replace(/[\s"'“”‘’]+$/u, "");
	s = s.replace(/[,;]+$/u, "").trim();
	return s.trim();
}

/** Split on commas only outside balanced ASCII double-quotes (for names like "Sakka, lord of the gods"). */
export function splitCommaOutsideDoubleQuotes(input: string): string[] {
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

/** True when the clause after a comma is an epithet, not a second person. */
function looksLikeEpithetClause(part: string): boolean {
	const t = part.trim();
	if (
		/^(the\s+)?(lord|king|chief|minister|son|daughter|mother|father|queen)\b/i.test(
			t,
		)
	) {
		return true;
	}
	return /['’]s\s+(son|daughter|mother|father|wife)\b/i.test(t);
}

/**
 * One entry per person: supports YAML string, YAML array, `;` between names,
 * comma-split when unambiguous, or comma+quotes for embedded commas.
 * Gray-matter strips YAML quotes, so `Name, epithet` must stay intact.
 */
export function normalizePersonParts(value: unknown): string[] {
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
	const commaParts = s.split(",").map((p) => p.trim()).filter(Boolean);
	if (commaParts.length === 2 && looksLikeEpithetClause(commaParts[1])) {
		return [sanitizePersonLabel(s)];
	}
	return commaParts.map(sanitizePersonLabel).filter(Boolean);
}

export function slugifySegment(raw: string): string {
	return foldPersonText(raw)
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

export function stripHonorifics(label: string): string {
	let s = label.trim();
	let previous = "";
	while (s !== previous) {
		previous = s;
		for (const re of HONORIFIC_RES) {
			s = s.replace(re, "");
		}
		s = s.trim();
	}
	return s;
}

const TRAILING_ROLE_RES = [
	/,?\s+the\s+naked\s+ascetic$/i,
	/,?\s+the\s+householder$/i,
	/,?\s+the\s+chief$/i,
	/,?\s+the\s+potter$/i,
	/,?\s+the\s+smith$/i,
	/,?\s+the\s+courtesan$/i,
	/,?\s+the\s+brahm[āa]$/i,
	/\s+gāma[nṇ][iī](?:\s+\S+)*$/i,
	/\s+niga[nṇ][tṭ]hasāvak\S*$/i,
	/\s+yakkho?s?$/i,
	/\s+rājakumār\S*$/i,
	/\s+gahapatān[īi]$/iu,
];

export function stripPersonPrefixes(label: string): string {
	let s = label.trim();
	let previous = "";
	while (s !== previous) {
		previous = s;
		for (const re of PREFIX_RES) {
			s = s.replace(re, "");
		}
		for (const re of TRAILING_ROLE_RES) {
			s = s.replace(re, "");
		}
		s = s.trim();
	}
	return s;
}

function aliasableHits(query: string, labels: string[]): string[] {
	return uniqueCatalogHits(labels.filter((label) => shouldAliasTo(query, label)));
}

function roleFamiliesConflict(labels: string[]): boolean {
	const families = [
		...new Set(
			labels
				.map((label) => personRoleFamily(label))
				.filter((family): family is RoleFamily => family != null),
		),
	];
	return families.length > 1;
}

export function compactPersonCore(label: string): string {
	let core = stripPersonPrefixes(sanitizePersonLabel(label));
	core = core.replace(/,?\s+of\s+āḷav[iī]$/i, "").trim();
	core = core.replace(/,?\s+me[nṇ][dḍ]aka'?s\s+grandson$/i, "").trim();
	core = core.replace(/\s+me[nṇ][dḍ]akanatt[aā]$/i, "").trim();
	core = core.replace(/\s+tadahuposathe$/i, "").trim();
	const stemmed = core
		.split(/\s+/)
		.map(stemPaliPersonToken)
		.join(" ");
	return slugifySegment(stemmed || label)
		.replace(/-/g, "")
		.replace(/mahakotthika$/, "mahakotthita");
}

export function distinctivePersonWords(label: string): string[] {
	const core = stripPersonPrefixes(sanitizePersonLabel(label));
	return foldPersonText(core)
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function looksInflectedPaliName(label: string): boolean {
	const last =
		stripPersonPrefixes(sanitizePersonLabel(label)).split(/\s+/).pop() || "";
	const folded = foldPersonText(last);
	return /(?:assa|a[ṁṃm]|[oō])$/u.test(folded);
}

function preferPersonLabel(a: string, b: string): string {
	const ia = looksInflectedPaliName(a);
	const ib = looksInflectedPaliName(b);
	if (ia !== ib) return ia ? b : a;
	if (a.length !== b.length) return a.length > b.length ? a : b;
	if (a.includes(" ") !== b.includes(" ")) return a.includes(" ") ? a : b;
	return a.localeCompare(b) < 0 ? a : b;
}

function uniqueExactStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		out.push(value);
	}
	return out;
}

function uniqueStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		const key = foldPersonText(value);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

function setPreferred(
	map: Map<string, string>,
	key: string,
	label: string,
): void {
	const existing = map.get(key);
	map.set(key, existing ? preferPersonLabel(existing, label) : label);
}

function pushWordIndex(
	map: Map<string, string[]>,
	word: string,
	label: string,
): void {
	const list = map.get(word) || [];
	if (!list.some((item) => foldPersonText(item) === foldPersonText(label))) {
		list.push(label);
		map.set(word, list);
	}
}

export function buildPersonAliasCatalog(labels: string[]): PersonAliasCatalog {
	const unique = uniqueStrings(labels.map(sanitizePersonLabel).filter(Boolean));
	const preferredByFold = new Map<string, string>();
	const preferredByCore = new Map<string, string>();
	const labelsByLastWord = new Map<string, string[]>();
	const labelsByFirstWord = new Map<string, string[]>();

	for (const label of unique) {
		setPreferred(preferredByFold, foldPersonText(label), label);
		const core = compactPersonCore(label);
		if (core) setPreferred(preferredByCore, core, label);
		const words = distinctivePersonWords(label);
		if (words[0]) pushWordIndex(labelsByFirstWord, words[0], label);
		const last = words[words.length - 1];
		if (last) pushWordIndex(labelsByLastWord, last, label);
	}

	return {
		labels: unique,
		preferredByFold,
		preferredByCore,
		labelsByLastWord,
		labelsByFirstWord,
	};
}

function uniqueCatalogHits(labels: string[]): string[] {
	return uniqueStrings(labels);
}

/**
 * Map a constructed or short name onto an existing character when the match
 * is unique. Whole-word / last-word only — never suffix (`nanda` ↛ `Ānanda`).
 */
export function resolvePersonLabel(
	raw: string,
	catalog: PersonAliasCatalog,
): PersonAliasResolution {
	const cleaned = sanitizePersonLabel(raw);
	if (!cleaned) {
		return { label: raw, via: "unchanged" };
	}

	const fold = foldPersonText(cleaned);
	const exact = catalog.preferredByFold.get(fold);
	const core = compactPersonCore(cleaned);
	const queryFamily = personRoleFamily(cleaned);
	const arcPreferred = core ? PERSON_ARC_PREFERRED[core] : undefined;
	if (
		arcPreferred &&
		queryFamily !== "ordained" &&
		queryFamily !== "nun"
	) {
		const hit =
			catalog.preferredByFold.get(foldPersonText(arcPreferred)) ||
			catalog.labels.find(
				(label) => compactPersonCore(label) === core && personRoleFamily(label) === "lay",
			) ||
			arcPreferred;
		return { label: hit, via: "core" };
	}
	const allCoreHits = core
		? catalog.labels.filter((label) => compactPersonCore(label) === core)
		: [];
	const compatibleCore = aliasableHits(cleaned, allCoreHits);
	if (!personRoleFamily(cleaned) && roleFamiliesConflict(allCoreHits)) {
		if (exact) return { label: exact, via: "exact" };
		return { label: cleaned, via: "unchanged", ambiguous: uniqueCatalogHits(allCoreHits) };
	}
	if (compatibleCore.length > 0) {
		const queryHasRole = Boolean(personRoleFamily(cleaned));
		const lastWord = distinctivePersonWords(cleaned).at(-1) || "";
		const lastHitsAll = uniqueCatalogHits(
			catalog.labelsByLastWord.get(lastWord) || [],
		);
		if (queryHasRole || lastHitsAll.length <= 1) {
			const preferred = compatibleCore.reduce(preferPersonLabel);
			return {
				label: preferred,
				via: exact && foldPersonText(preferred) === fold ? "exact" : "core",
			};
		}
	}
	if (exact) {
		return { label: exact, via: "exact" };
	}

	const queryWords = distinctivePersonWords(cleaned);
	if (queryWords.length !== 1 || personRoleFamily(cleaned)) {
		return { label: cleaned, via: "unchanged" };
	}
	const q = queryWords[0] || "";

	const lastHitsAll = uniqueCatalogHits(catalog.labelsByLastWord.get(q) || []);
	const lastHits = aliasableHits(cleaned, lastHitsAll);
	const firstHitsAll = uniqueCatalogHits(catalog.labelsByFirstWord.get(q) || []);
	const firstHits = aliasableHits(cleaned, firstHitsAll);
	const firstOnly = firstHits.filter(
		(label) => compactPersonCore(label) !== core,
	);
	const compoundHits = uniqueCatalogHits(
		catalog.labels.filter((label) => {
			const labelCore = compactPersonCore(label);
			return (
				COMPOUND_PREFIXES.some((prefix) => labelCore === `${prefix}${q}`) ||
				labelCore === `${q}gotta`
			);
		}),
	);
	const related = uniqueCatalogHits([...lastHits, ...firstOnly, ...compoundHits]);
	if (related.length > 1) {
		return { label: cleaned, via: "unchanged", ambiguous: related };
	}

	if (
		lastHitsAll.length === 1 &&
		lastHits.length === 1 &&
		lastHits[0] &&
		compoundHits.length === 0
	) {
		return { label: lastHits[0], via: "last-word" };
	}
	const firstOnlyAll = firstHitsAll.filter(
		(label) => compactPersonCore(label) !== core,
	);
	if (
		firstOnlyAll.length === 1 &&
		firstOnly.length === 1 &&
		firstOnly[0] &&
		compoundHits.length === 0
	) {
		return { label: firstOnly[0], via: "first-word" };
	}
	if (compoundHits.length === 1 && compoundHits[0] && lastHits.length === 0) {
		return { label: compoundHits[0], via: "maha-compound" };
	}

	return { label: cleaned, via: "unchanged" };
}

/**
 * Stable identity for /on/:slug — strip honorifics before slugifying so
 * "Sāriputta" and "Venerable Sāriputta" merge into one person card.
 */
export function canonicalSlugForPerson(
	raw: string,
	catalog?: PersonAliasCatalog,
): string {
	const resolved = catalog ? resolvePersonLabel(raw, catalog).label : raw;
	const cleaned = sanitizePersonLabel(resolved);
	const family = personRoleFamily(cleaned);
	if (catalog) {
		const nameCore = compactPersonCore(cleaned);
		const incompatible = catalog.labels.filter(
			(other) =>
				compactPersonCore(other) === nameCore &&
				!rolesCompatible(cleaned, other),
		);
		const hasOrdainedConflict = incompatible.some((other) => {
			const otherFamily = personRoleFamily(other);
			return otherFamily === "ordained" || otherFamily === "nun";
		});
		if (
			incompatible.length > 0 &&
			family &&
			family !== "ordained" &&
			family !== "nun" &&
			(!PERSON_ARC_PREFERRED[nameCore] || hasOrdainedConflict)
		) {
			const families = new Set<RoleFamily>();
			if (family) families.add(family);
			for (const other of incompatible) {
				const otherFamily = personRoleFamily(other);
				if (otherFamily) families.add(otherFamily);
			}
			if (family === "lay" && families.has("brahmin") && !families.has("ordained")) {
				const core = stripPersonPrefixes(cleaned)
					.split(/\s+/)
					.map(stemPaliPersonToken)
					.join(" ");
				return slugifySegment(core || cleaned);
			}
			return slugifySegment(
				cleaned
					.split(/\s+/)
					.map(stemPaliPersonToken)
					.join(" "),
			);
		}
	}
	const core = stripPersonPrefixes(cleaned)
		.split(/\s+/)
		.map(stemPaliPersonToken)
		.join(" ");
	return slugifySegment(core || cleaned);
}

export function findEnglishLabelVariants(
	labels: string[],
): EnglishLabelVariantGroup[] {
	const unique = uniqueExactStrings(labels.map(sanitizePersonLabel).filter(Boolean));
	const byCore = new Map<string, string[]>();
	const bySharedWord = new Map<string, string[]>();

	for (const label of unique) {
		const core = compactPersonCore(label);
		if (core) {
			const list = byCore.get(core) || [];
			list.push(label);
			byCore.set(core, list);
		}
		const words = new Set(distinctivePersonWords(label));
		for (const word of words) {
			const list = bySharedWord.get(word) || [];
			list.push(label);
			bySharedWord.set(word, list);
		}
	}

	const groups: EnglishLabelVariantGroup[] = [];
	for (const [key, group] of [...byCore.entries()].sort((a, b) =>
		a[0].localeCompare(b[0]),
	)) {
		if (group.length > 1 && roleFamiliesConflict(group)) {
			groups.push({ kind: "shared-name", key, labels: group });
		} else if (group.length > 1) {
			groups.push({ kind: "same-core", key, labels: group });
		}
	}

	const seenShared = new Set<string>();
	for (const [word, group] of [...bySharedWord.entries()].sort((a, b) =>
		a[0].localeCompare(b[0]),
	)) {
		const cores = new Set(group.map(compactPersonCore));
		if (cores.size < 2) continue;
		const signature = [...cores].sort().join("|");
		if (seenShared.has(signature)) continue;
		seenShared.add(signature);
		groups.push({ kind: "shared-name", key: word, labels: uniqueStrings(group) });
	}

	return groups;
}

/** Bare or mixed lay names that likely need a Laywoman / Lay follower prefix. */
export function findLayRolePrefixGaps(labels: string[]): EnglishLabelVariantGroup[] {
	const unique = uniqueExactStrings(labels.map(sanitizePersonLabel).filter(Boolean));
	const byCore = new Map<string, string[]>();
	for (const label of unique) {
		const core = compactPersonCore(label);
		if (!core) continue;
		const list = byCore.get(core) || [];
		list.push(label);
		byCore.set(core, list);
	}

	const gaps: EnglishLabelVariantGroup[] = [];
	for (const [key, group] of [...byCore.entries()].sort((a, b) =>
		a[0].localeCompare(b[0]),
	)) {
		const withLayRole = group.filter((label) => personRoleFamily(label) === "lay");
		const withoutRole = group.filter((label) => !personRoleFamily(label));
		if (withLayRole.length > 0 && withoutRole.length > 0) {
			gaps.push({ kind: "same-core", key, labels: group });
			continue;
		}
		if (group.length !== 1) continue;
		const label = group[0];
		if (!label || personRoleFamily(label)) continue;
		if (/(mata|gahapatani|dhita)$/.test(key)) {
			gaps.push({ kind: "same-core", key, labels: group });
		}
	}
	return gaps;
}

export function loadEnglishPersonLabels(root = process.cwd()): string[] {
	const labels: string[] = [];
	for (const filePath of globSync("src/content/en/**/*.mdx", {
		cwd: root,
		absolute: true,
	})) {
		const { data } = matter(readFileSync(filePath, "utf8"));
		labels.push(...normalizePersonParts(data.character));
	}
	return labels;
}

export function englishPersonCatalog(root = process.cwd()): PersonAliasCatalog {
	return buildPersonAliasCatalog(loadEnglishPersonLabels(root));
}
