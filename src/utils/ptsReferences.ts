/**
 * PTS (Pali Text Society) volume/page reference parsing and lookup.
 *
 * Search requires an explicit directive to avoid hijacking ordinary queries:
 *   pts:AN V. 91 | volpage:SN ii 4 | PTS AN v 91 | PTS 5.172 | pts-vp-pli5.172
 *
 * Display uses SuttaCentral-style numbering: "PTS 4.152" or "PTS 4.152–4.155".
 */

import {
	ptsReferences,
	type PtsReferenceEntry,
} from "../data/ptsReferences.generated";
import { sortDiscourseIds } from "./discourseSort";
import { expandSlugToDiscourseIds } from "./slugDiscourseCount";

export type { PtsReferenceEntry };

export type PtsNikaya =
	| "an"
	| "sn"
	| "mn"
	| "dn"
	| "iti"
	| "ud"
	| "snp"
	| "dhp"
	| "kp";

export type ParsedPtsRef = {
	nikaya?: PtsNikaya;
	/** 1-based PTS volume (undefined for single-volume collections like Iti) */
	volume?: number;
	/** Omit for a volume-only lookup (e.g. pts:MN 2 → all suttas in MN vol. 2) */
	page?: number;
	/** Optional third PTS number (sutta/paragraph on the page), when SC stores it. */
	para?: number;
};

const ROMAN_TO_INT: Record<string, number> = {
	i: 1,
	ii: 2,
	iii: 3,
	iv: 4,
	v: 5,
	vi: 6,
	vii: 7,
	viii: 8,
	ix: 9,
	x: 10,
};

const NIKAYA_ALIASES: Record<string, PtsNikaya> = {
	an: "an",
	a: "an",
	anguttara: "an",
	sn: "sn",
	s: "sn",
	samyutta: "sn",
	mn: "mn",
	m: "mn",
	majjhima: "mn",
	dn: "dn",
	d: "dn",
	digha: "dn",
	iti: "iti",
	it: "iti",
	itivuttaka: "iti",
	ud: "ud",
	uda: "ud",
	udan: "ud",
	udana: "ud",
	snp: "snp",
	suttanipata: "snp",
	dhp: "dhp",
	dh: "dhp",
	dhammapada: "dhp",
	kp: "kp",
	khp: "kp",
	khuddakapatha: "kp",
};

/** Nikayas that use roman-numeral PTS volumes. */
const VOLUME_NIKAYAS = new Set<PtsNikaya>(["an", "sn", "mn", "dn"]);

/** Query must start with one of these to trigger PTS lookup. */
const PTS_DIRECTIVE_RE =
	/^(?:pts:|volpage:|ref:|PTS\b|pts-vp-pli)/i;

function parseRomanOrInt(token: string): number | undefined {
	const t = token.toLowerCase().replace(/\.$/, "");
	if (ROMAN_TO_INT[t] !== undefined) return ROMAN_TO_INT[t];
	if (/^\d+$/.test(t)) {
		const n = Number(t);
		return n > 0 ? n : undefined;
	}
	return undefined;
}

function resolveNikayaAlias(raw: string): PtsNikaya | undefined {
	const key = raw
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z]/g, "");
	return NIKAYA_ALIASES[key];
}

/**
 * Legacy helper: strip PTS / edition markers from a stored SC volpage string.
 * Prefer {@link getPtsDisplay} for UI (numeric SC style).
 */
export function formatPtsDisplay(volpage: string | undefined | null): string {
	if (!volpage) return "";
	return volpage
		.replace(/^PTS\s+/i, "")
		.replace(/^\((?:1st|2nd)\s*ed\.?\)\s*/i, "")
		.trim();
}

export function getPtsEntry(slug: string): PtsReferenceEntry | undefined {
	return ptsReferences[slug];
}

function formatPtsPoint(ref: ParsedPtsRef): string {
	const volume = ref.volume ?? 0;
	const page = ref.page ?? 0;
	const base = volume > 0 ? `${volume}.${page}` : `${page}`;
	return ref.para != null ? `${base}.${ref.para}` : base;
}

function formatPtsRange(start: ParsedPtsRef, end: ParsedPtsRef): string {
	const startStr = formatPtsPoint(start);
	const same =
		(start.volume ?? 0) === (end.volume ?? 0) &&
		start.page === end.page &&
		(start.para ?? null) === (end.para ?? null);
	if (same) return `PTS ${startStr}`;
	return `PTS ${startStr}–${formatPtsPoint(end)}`;
}

function formatPtsMeta(meta: SlugMeta): string {
	return formatPtsRange(
		{
			volume: meta.volume || undefined,
			page: meta.page,
			para: meta.para,
		},
		{
			volume: meta.endVolume || meta.volume || undefined,
			page: meta.endPage,
			para: meta.endPara,
		},
	);
}

/**
 * Prefer an explicit range stored on the entry (first/last constituents),
 * then first+last constituent lookups, then the indexed start–end inference.
 */
function displayFromRangeSlug(slug: string): string {
	const entry = ptsReferences[slug];
	if (entry?.endVolpage) {
		const start = parsePtsVolpage(entry.volpage);
		const end = parsePtsVolpage(entry.endVolpage);
		if (start?.page && end?.page) return formatPtsRange(start, end);
	}

	const ids = expandSlugToDiscourseIds(slug);
	if (ids.length < 2) return "";

	let start = entry ? parsePtsVolpage(entry.volpage) : null;
	let end: ParsedPtsRef | null = null;
	for (const id of ids) {
		const parsed = parsePtsVolpage(ptsReferences[id]?.volpage);
		if (!parsed?.page) continue;
		if (!start) start = parsed;
		end = parsed;
	}
	if (!start?.page || !end?.page) return "";
	return formatPtsRange(start, end);
}

/**
 * SuttaCentral-style citation for cards / search: "PTS 4.152" or "PTS 4.152–4.155".
 * Range slugs use first/last constituent pages when known; otherwise the end
 * page is inferred from the next sutta's start in the same PTS volume.
 */
export function getPtsDisplay(slug: string): string {
	ensureIndex();
	const fromRange = displayFromRangeSlug(slug);
	if (fromRange) return fromRange;

	const meta = slugMeta.get(slug);
	if (!meta) return "";
	return formatPtsMeta(meta);
}

/** Parse a stored SC volpage string like "PTS AN iii 174" or "PTS Iti 27". */
export function parsePtsVolpage(
	volpage: string | undefined | null,
): ParsedPtsRef | null {
	if (!volpage) return null;
	let s = volpage.trim();
	s = s.replace(/^PTS\s+/i, "");
	s = s.replace(/^\((?:1st|2nd)\s*ed\.?\)\s*/i, "");
	s = s.replace(/\s+/g, " ").trim();
	if (!s) return null;

	// SC suttaplex / bilara form: "1.1.1" (volume.page.sutta)
	const threePart = s.match(/^(\d+)\s*[.]\s*(\d+)\s*[.]\s*(\d+)\s*$/);
	if (threePart) {
		return {
			volume: Number(threePart[1]),
			page: Number(threePart[2]),
			para: Number(threePart[3]),
		};
	}

	const withVolPara = s.match(
		/^([A-Za-z]+)\s+([ivxIVX0-9]+)\s*[.,]?\s*(\d+)\s*[.]\s*(\d+)\s*$/,
	);
	if (withVolPara) {
		const nikaya = resolveNikayaAlias(withVolPara[1]);
		const volume = parseRomanOrInt(withVolPara[2]);
		const page = Number(withVolPara[3]);
		const para = Number(withVolPara[4]);
		if (nikaya && VOLUME_NIKAYAS.has(nikaya) && volume && page && para) {
			return { nikaya, volume, page, para };
		}
	}

	const withVol = s.match(
		/^([A-Za-z]+)\s+([ivxIVX0-9]+)\s*[.,]?\s*(\d+)\s*$/,
	);
	if (withVol) {
		const nikaya = resolveNikayaAlias(withVol[1]);
		const volume = parseRomanOrInt(withVol[2]);
		const page = Number(withVol[3]);
		if (nikaya && VOLUME_NIKAYAS.has(nikaya) && volume && page) {
			return { nikaya, volume, page };
		}
	}

	const single = s.match(/^([A-Za-z]+)\s+(\d+)\s*$/);
	if (single) {
		const nikaya = resolveNikayaAlias(single[1]);
		const page = Number(single[2]);
		if (nikaya && !VOLUME_NIKAYAS.has(nikaya) && page) {
			return { nikaya, page };
		}
	}

	return null;
}

/**
 * Nikaya + three numbers: volume is the first, page is the last.
 *   SN 1.1.3 | SN 1. 1. 3 | SN 1 1.3 | SN 1 1 3
 * People type the card label `PTS 1.3` after `SN`/`SN 1`, with optional extra
 * dots and spaces — not volume.page.paragraph.
 */
function parseNikayaThreePart(s: string): ParsedPtsRef | null {
	const match = s.match(
		/^([A-Za-z]+)\s+([ivxIVX0-9]+)(?:\s*[.]\s*|\s+)(\d+)(?:\s*[.]\s*|\s+)(\d+)\s*$/,
	);
	if (!match) return null;
	const nikaya = resolveNikayaAlias(match[1]);
	const volume = parseRomanOrInt(match[2]);
	const page = Number(match[4]);
	if (nikaya && VOLUME_NIKAYAS.has(nikaya) && volume && page) {
		return { nikaya, volume, page };
	}
	return null;
}

/** True when the query uses an explicit PTS / volpage directive. */
export function hasPtsDirective(query: string): boolean {
	return PTS_DIRECTIVE_RE.test(query.trim());
}

/**
 * Parse a PTS citation query. Requires a directive (`pts:`, `volpage:`, `ref:`,
 * leading `PTS`, or `pts-vp-pli…`) so ordinary searches are never hijacked.
 */
export function parsePtsQuery(query: string): ParsedPtsRef | null {
	let q = query.trim();
	if (!q || !hasPtsDirective(q)) return null;

	// Strip directive prefixes (keep pts-vp-pli for its own parser)
	if (/^pts-vp-pli/i.test(q)) {
		const bilara = q.match(/^pts-vp-pli(\d+)\.(\d+)(?:\.(\d+))?$/i);
		if (bilara) {
			return {
				volume: Number(bilara[1]),
				page: Number(bilara[2]),
				...(bilara[3] ? { para: Number(bilara[3]) } : {}),
			};
		}
		return null;
	}

	q = q.replace(/^(?:pts:|volpage:|ref:)\s*/i, "");
	const hadPtsWord = /^PTS\b/i.test(q);
	q = q.replace(/^PTS\s+/i, "");
	q = q.replace(/^\((?:1st|2nd)\s*ed\.?\)\s*/i, "");
	q = q.replace(/\.\s*$/, "").trim();

	// "1.1.3" / "1. 1. 3" — same as the card label PTS 1.3, not page 1 para 3
	const threeNumeric = q.match(
		/^(\d+)\s*[.]\s*(\d+)\s*[.]\s*(\d+)\s*$/,
	);
	if (threeNumeric) {
		return {
			volume: Number(threeNumeric[1]),
			page: Number(threeNumeric[3]),
		};
	}

	// "5.172" / "4.152-4.155" (numeric; use first page of a range)
	const numeric = q.match(/^(\d+)\s*[.]\s*(\d+)(?:\s*[–—-]\s*\d+\s*[.]?\s*\d+)?\s*$/);
	if (numeric) {
		return {
			volume: Number(numeric[1]),
			page: Number(numeric[2]),
		};
	}

	// Three-part with nikaya, before dots are flattened:
	// "SN 1.1.3" | "SN 1. 1. 3" | "SN 1 1.3" | "SN i 1.3"
	const threeNikaya = parseNikayaThreePart(q);
	if (threeNikaya) return threeNikaya;

	// Normalize: "AN V. 91" | "AN V,91"
	let s = q;
	s = s.replace(/([A-Za-z])\s*\.\s*([ivxIVX0-9])/g, "$1 $2");
	s = s.replace(/([ivxIVX0-9])\s*[.,]\s*(\d+)/g, "$1 $2");
	s = s.replace(/\s+/g, " ").trim();

	const threeNikayaFlat = parseNikayaThreePart(s);
	if (threeNikayaFlat) return threeNikayaFlat;

	const withNikayaVol = s.match(
		/^([A-Za-z]+)\s+([ivxIVX0-9]+)\s+(\d+)\s*$/,
	);
	if (withNikayaVol) {
		const nikaya = resolveNikayaAlias(withNikayaVol[1]);
		const volume = parseRomanOrInt(withNikayaVol[2]);
		const page = Number(withNikayaVol[3]);
		if (nikaya && VOLUME_NIKAYAS.has(nikaya) && volume && page) {
			return { nikaya, volume, page };
		}
	}

	const compact = s.match(/^([A-Za-z]+)([ivxIVX]+)[.,\s]*(\d+)$/);
	if (compact) {
		const nikaya = resolveNikayaAlias(compact[1]);
		const volume = parseRomanOrInt(compact[2]);
		const page = Number(compact[3]);
		if (nikaya && VOLUME_NIKAYAS.has(nikaya) && volume && page) {
			return { nikaya, volume, page };
		}
	}

	// Volume-only: "MN 2" | "MN ii" | "AN V" — all suttas in that PTS volume
	const volumeOnly = s.match(/^([A-Za-z]+)\s+([ivxIVX0-9]+)\.?$/);
	if (volumeOnly) {
		const nikaya = resolveNikayaAlias(volumeOnly[1]);
		const volume = parseRomanOrInt(volumeOnly[2]);
		if (nikaya && VOLUME_NIKAYAS.has(nikaya) && volume) {
			return { nikaya, volume };
		}
	}

	const single = s.match(/^([A-Za-z]+)\s+(\d+)\s*$/);
	if (single) {
		const nikaya = resolveNikayaAlias(single[1]);
		const page = Number(single[2]);
		if (nikaya && !VOLUME_NIKAYAS.has(nikaya) && page) {
			return { nikaya, page };
		}
	}

	// "PTS Iti 27" already stripped PTS → "Iti 27" handled above.
	// If only "PTS" remained with nothing parseable:
	if (hadPtsWord) return parsePtsVolpage(`PTS ${q}`);
	return null;
}

type IndexedPts = {
	slug: string;
	nikaya: PtsNikaya;
	volume: number; // 0 when single-volume
	page: number;
	endPage: number;
	para?: number;
	endPara?: number;
	lockedEnd?: boolean;
};

type SlugMeta = {
	nikaya: PtsNikaya;
	volume: number;
	page: number;
	endPage: number;
	endVolume?: number;
	para?: number;
	endPara?: number;
};

let indexedList: IndexedPts[] | null = null;
/** `${nikaya}:${volume}` → entries sorted by page */
let byNikayaVolume: Map<string, IndexedPts[]> | null = null;
let slugMeta: Map<string, SlugMeta> = new Map();

function ensureIndex(): void {
	if (indexedList && byNikayaVolume) return;
	indexedList = [];
	byNikayaVolume = new Map();
	slugMeta = new Map();

	for (const [slug, entry] of Object.entries(ptsReferences)) {
		const parsed = parsePtsVolpage(entry.volpage);
		if (!parsed?.nikaya || !parsed.page) continue;
		const volume = parsed.volume ?? 0;
		const endParsed = entry.endVolpage
			? parsePtsVolpage(entry.endVolpage)
			: null;
		const sameVolumeEnd =
			!!endParsed?.page && (endParsed.volume ?? 0) === volume;
		const item: IndexedPts = {
			slug,
			nikaya: parsed.nikaya,
			volume,
			page: parsed.page,
			endPage: sameVolumeEnd
				? Math.max(endParsed.page!, parsed.page)
				: parsed.page,
			para: parsed.para,
			endPara: sameVolumeEnd ? endParsed?.para : parsed.para,
			lockedEnd: sameVolumeEnd,
		};
		indexedList.push(item);
		const key = `${item.nikaya}:${item.volume}`;
		const list = byNikayaVolume.get(key) ?? [];
		list.push(item);
		byNikayaVolume.set(key, list);
	}

	for (const list of byNikayaVolume.values()) {
		list.sort((a, b) => a.page - b.page || a.slug.localeCompare(b.slug));
		// Infer end page from the next distinct start page in this volume
		for (let i = 0; i < list.length; i++) {
			if (!list[i].lockedEnd) {
				let end = list[i].page;
				for (let j = i + 1; j < list.length; j++) {
					if (list[j].page > list[i].page) {
						end = list[j].page - 1;
						break;
					}
				}
				list[i].endPage = end >= list[i].page ? end : list[i].page;
			}
			slugMeta.set(list[i].slug, {
				nikaya: list[i].nikaya,
				volume: list[i].volume,
				page: list[i].page,
				endPage: list[i].endPage,
				para: list[i].para,
				endPara: list[i].endPara,
			});
		}
	}
}

/**
 * Find discourse(s) for a PTS page reference.
 * Prefer exact start-page matches; otherwise the sutta whose page range covers the query.
 */
export function lookupPtsSlugs(ref: ParsedPtsRef): string[] {
	ensureIndex();
	if (!byNikayaVolume) return [];

	let slugs: string[];
	if (ref.nikaya) {
		const volume = ref.volume ?? 0;
		if (VOLUME_NIKAYAS.has(ref.nikaya) && !ref.volume) {
			return [];
		}
		const list = byNikayaVolume.get(`${ref.nikaya}:${volume}`) ?? [];
		if (ref.page == null) {
			slugs = [...new Set(list.map((e) => e.slug))];
		} else {
			slugs = pickCoveringSlugs(list, ref.page, ref.para);
		}
	} else {
		if (!ref.volume || ref.page == null) return [];
		const hits: string[] = [];
		for (const nikaya of VOLUME_NIKAYAS) {
			const list = byNikayaVolume.get(`${nikaya}:${ref.volume}`) ?? [];
			hits.push(...pickCoveringSlugs(list, ref.page, ref.para));
		}
		slugs = [...new Set(hits)];
	}
	return sortDiscourseIds(slugs);
}

function pickCoveringSlugs(
	list: IndexedPts[],
	page: number,
	para?: number,
): string[] {
	if (list.length === 0) return [];

	const onPage = list.filter((e) => e.page === page);
	if (onPage.length > 0) {
		if (para != null) {
			const byPara = onPage.filter((e) => e.para === para);
			if (byPara.length > 0) return byPara.map((e) => e.slug);
		}
		return onPage.map((e) => e.slug);
	}

	let lo = 0;
	let hi = list.length - 1;
	let best = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (list[mid].page <= page) {
			best = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}
	if (best < 0) return [];

	const startPage = list[best].page;
	const covering: string[] = [];
	for (let i = best; i >= 0 && list[i].page === startPage; i--) {
		covering.push(list[i].slug);
	}
	for (
		let i = best + 1;
		i < list.length && list[i].page === startPage;
		i++
	) {
		covering.push(list[i].slug);
	}
	return covering;
}

/** True when the query is a directed PTS citation search. */
export function isPtsSearchQuery(query: string): boolean {
	return parsePtsQuery(query) !== null;
}

/**
 * Build a searchable string of PTS aliases (for tooling / tests).
 */
export function buildPtsSearchText(
	entry: PtsReferenceEntry | undefined,
): string {
	if (!entry) return "";
	const parts = new Set<string>();
	const add = (s: string | undefined) => {
		const t = s?.trim();
		if (t) parts.add(t);
	};

	for (const raw of [entry.volpage, entry.altVolpage]) {
		if (!raw) continue;
		add(raw);
		add(formatPtsDisplay(raw));
		const parsed = parsePtsVolpage(raw);
		if (!parsed?.nikaya) continue;
		const nik = parsed.nikaya.toUpperCase();
		if (parsed.volume) {
			add(`${nik} ${parsed.volume}.${parsed.page}`);
			add(`PTS ${parsed.volume}.${parsed.page}`);
			add(`pts-vp-pli${parsed.volume}.${parsed.page}`);
		} else {
			add(`${nik} ${parsed.page}`);
			add(`PTS ${parsed.page}`);
		}
	}

	return [...parts].join(" | ");
}
