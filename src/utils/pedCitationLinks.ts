/**
 * Parse PED citation strings and resolve them to native discourse URLs
 * using the site PTS map, Dhp verse ranges, and Snp verse ranges.
 */

import { SNP_VERSE_RANGES } from "../data/snpVerseRanges.generated";
import {
	lookupPtsSlugs,
	parsePtsQuery,
	type ParsedPtsRef,
	type PtsNikaya,
} from "./ptsReferences";

/** Collections that use PTS page numbers safely via ptsReferences. */
const PAGE_SAFE_NIKAYAS = new Set<PtsNikaya>([
	"an",
	"sn",
	"mn",
	"dn",
	"iti",
	"ud",
	"kp",
]);

/** PED / older abbreviations that we must not treat as PTS pages. */
const UNSUPPORTED_PREFIX =
	/^(vin|ja|jāt|jat|jā|mil|thig|thag|vv|pv|dhs|ds|vism|netti|kv|kv\.|pp|yam|pat|patth|mnd|nd|nbd|cpd|divy|mvu|bsk|sk)\.?$/i;

/** Dhp verse → range slug (from content filenames). */
const DHP_VERSE_RANGES: Array<{ start: number; end: number; slug: string }> = [
	{ start: 1, end: 20, slug: "dhp1-20" },
	{ start: 21, end: 32, slug: "dhp21-32" },
	{ start: 33, end: 43, slug: "dhp33-43" },
	{ start: 44, end: 59, slug: "dhp44-59" },
	{ start: 60, end: 75, slug: "dhp60-75" },
	{ start: 76, end: 89, slug: "dhp76-89" },
	{ start: 90, end: 99, slug: "dhp90-99" },
	{ start: 100, end: 115, slug: "dhp100-115" },
	{ start: 116, end: 128, slug: "dhp116-128" },
	{ start: 129, end: 145, slug: "dhp129-145" },
	{ start: 146, end: 156, slug: "dhp146-156" },
	{ start: 157, end: 166, slug: "dhp157-166" },
	{ start: 167, end: 178, slug: "dhp167-178" },
	{ start: 179, end: 196, slug: "dhp179-196" },
	{ start: 197, end: 208, slug: "dhp197-208" },
	{ start: 209, end: 220, slug: "dhp209-220" },
	{ start: 221, end: 234, slug: "dhp221-234" },
	{ start: 235, end: 255, slug: "dhp235-255" },
	{ start: 256, end: 272, slug: "dhp256-272" },
	{ start: 273, end: 289, slug: "dhp273-289" },
	{ start: 290, end: 305, slug: "dhp290-305" },
	{ start: 306, end: 319, slug: "dhp306-319" },
	{ start: 320, end: 333, slug: "dhp320-333" },
	{ start: 334, end: 359, slug: "dhp334-359" },
	{ start: 360, end: 382, slug: "dhp360-382" },
	{ start: 383, end: 423, slug: "dhp383-423" },
];

export type PedCitationResolve = {
	href: string;
	slugs: string[];
	label: string;
};

/** Extended parse result that can carry Snp verse (not a PTS page). */
type PedParsed =
	| (ParsedPtsRef & { kind?: "pts" })
	| { kind: "dhp-verse"; verse: number }
	| { kind: "snp-verse"; verse: number };

function normalizeCitationText(raw: string): string {
	return raw
		.replace(/\u00a0/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Parse a bare PED citation (no `pts:` required), e.g. `DN.ii.224`, `Snp verse 609`.
 * Returns null for unsupported collections or unparseable text.
 */
export function parsePedCitation(raw: string): PedParsed | null {
	let s = normalizeCitationText(raw);
	if (!s) return null;

	// Drop trailing punctuation / fragment markers common in PED
	s = s.replace(/[#].*$/, "").replace(/[.;,:]+$/g, "").trim();

	// Prefix check before rewrite / parse
	const prefixTok = s.match(/^([A-Za-z]+)/);
	if (prefixTok && UNSUPPORTED_PREFIX.test(prefixTok[1])) {
		return null;
	}

	// Snp verse N | Sn verse N | Snp v. 609 (PED style)
	const snpVerse = s.match(
		/^(?:snp|sn\.?p|sn)\s*(?:verse|v\.?)\s*(\d+)\s*$/i,
	);
	if (snpVerse) {
		return { kind: "snp-verse", verse: Number(snpVerse[1]) };
	}

	// Other “… verse N” forms (e.g. Thig) — not mapped yet
	if (/\bverse\b/i.test(s)) return null;

	// Dhp.N is a verse number (handle before compact vol.page rewrite)
	if (/^dhp\b/i.test(s) || /^dh\.\d/i.test(s)) {
		const verse = s.match(/^(?:dhp|dh)\s*[.]?\s*(\d+)\s*$/i);
		if (verse) {
			return { kind: "dhp-verse", verse: Number(verse[1]) };
		}
		return null;
	}

	// Bare Snp.N without “verse” is ambiguous (page vs verse) — skip
	if (/^snp\b/i.test(s)) {
		return null;
	}

	// Compact dotted with roman volume: DN.ii.224 | AN.v.110
	const compactRoman = s.match(
		/^([A-Za-z]+)\s*[.]\s*([ivxIVX]+)\s*[.,]?\s*(\d+)\s*$/,
	);
	if (compactRoman) {
		s = `${compactRoman[1]} ${compactRoman[2]} ${compactRoman[3]}`;
	} else {
		// Single-volume page form: Iti.22 | Ud.5
		const compactPage = s.match(/^([A-Za-z]+)\s*[.]\s*(\d+)\s*$/);
		if (compactPage) {
			s = `${compactPage[1]} ${compactPage[2]}`;
		}
	}

	const pts = parsePtsQuery(`PTS ${s}`);
	return pts ? { ...pts, kind: "pts" } : null;
}

function resolveDhpVerse(verse: number): string | null {
	for (const range of DHP_VERSE_RANGES) {
		if (verse >= range.start && verse <= range.end) return range.slug;
	}
	return null;
}

function resolveSnpVerse(verse: number): string | null {
	for (const range of SNP_VERSE_RANGES) {
		if (verse >= range.start && verse <= range.end) return range.slug;
	}
	return null;
}

/**
 * Resolve a PED citation label to a site href.
 * Single slug → `/{slug}`; multiple → PTS search; none → null.
 */
export function resolvePedCitation(
	raw: string,
): PedCitationResolve | null {
	const label = normalizeCitationText(raw);
	const parsed = parsePedCitation(label);
	if (!parsed) return null;

	if (parsed.kind === "dhp-verse") {
		const slug = resolveDhpVerse(parsed.verse);
		if (!slug) return null;
		return {
			href: `/${slug}`,
			slugs: [slug],
			label,
		};
	}

	if (parsed.kind === "snp-verse") {
		const slug = resolveSnpVerse(parsed.verse);
		if (!slug) return null;
		return {
			href: `/${slug}`,
			slugs: [slug],
			label,
		};
	}

	if (parsed.nikaya && !PAGE_SAFE_NIKAYAS.has(parsed.nikaya)) {
		return null;
	}

	const slugs = lookupPtsSlugs(parsed);
	if (slugs.length === 0) return null;
	if (slugs.length === 1) {
		return { href: `/${slugs[0]}`, slugs, label };
	}
	const q = encodeURIComponent(`pts:${label}`);
	return { href: `/search?q=${q}`, slugs, label };
}

/** Escape text for HTML text nodes / attributes. */
export function escapeHtmlText(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function decoratePedRefAnchor(a: HTMLAnchorElement, href: string) {
	a.href = href;
	a.className = "ped-ref-link";
	a.target = "_blank";
	a.rel = "noopener noreferrer";
	a.title = "Opens in a new tab";
}

/**
 * Rewrite PED HTML for the drawer: keep readable structure, link known
 * citations to native discourses (new tab), drop external /define and SC URLs.
 * Browser-only (uses DOMParser).
 */
export function linkifyPedHtml(rawHtml: string): string {
	if (typeof DOMParser === "undefined") {
		return escapeHtmlText(rawHtml.replace(/<[^>]+>/g, " "));
	}

	const doc = new DOMParser().parseFromString(rawHtml, "text/html");
	const dd = doc.querySelector("dd");
	const root: ParentNode = dd ?? doc.body;

	const walk = (node: Node) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement;
			const tag = el.tagName.toLowerCase();

			if (tag === "a") {
				const text = (el.textContent || "").trim();
				const resolved = text ? resolvePedCitation(text) : null;
				if (resolved) {
					decoratePedRefAnchor(el as HTMLAnchorElement, resolved.href);
				} else {
					// Unwrap non-resolvable / external links to plain text
					const parent = el.parentNode;
					if (parent) {
						while (el.firstChild) parent.insertBefore(el.firstChild, el);
						parent.removeChild(el);
						return;
					}
				}
			} else if (tag === "span" && el.classList.contains("ref")) {
				const text = (el.textContent || "").trim();
				const resolved = text ? resolvePedCitation(text) : null;
				if (resolved) {
					const a = doc.createElement("a");
					decoratePedRefAnchor(a, resolved.href);
					a.textContent = text;
					el.replaceWith(a);
					return;
				}
			}

			// Recurse into a copy of children (live list mutates)
			[...el.childNodes].forEach(walk);
		}
	};

	[...root.childNodes].forEach(walk);

	// Prefer inner content of dd; strip outer dl chrome
	const html = dd ? dd.innerHTML : doc.body.innerHTML;
	return html.trim();
}
