import type { ContentPair } from "./contentParser";
import {
	constructHierarchicalEnd,
	headingMatchesSectionNumber,
	isHierarchicalNumberInRange,
} from "./contentParser";
import { transformId } from "./transformId";

type SegmentEntry = { key: string; text: string };

const SEGMENT_MARKER_RE = /^<!-- @segment ([^\s>]+) -->$/;

const END_MARKER_RE =
	/^(Paṭhama|Dutiya|Tatiya|Catuttha|Pañcama|Chaṭṭha|Sattama|Aṭṭhama|Navama|Dasama|Ekādasama)\.(ṁ)?$/;

export type ReferenceSubsetFilter = {
	sectionNumber?: string;
	discourseRange?: { start: string; end: string };
	fullRef?: string;
	hrf?: string;
};

/** Bilara :1.0 segment key → #### heading (e.g. an2.180-184:1.0 → #### 2.180–184). */
export function segmentKeyToSectionHeading(key: string): string | null {
	if (!key.endsWith(":1.0")) return null;
	const suttaId = key.slice(0, key.indexOf(":"));
	const match = suttaId.match(/^[a-z]+(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?)$/i);
	if (!match) return null;
	const normalized = match[1].replace(
		/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/,
		"$1\u2013$2",
	);
	return `#### ${normalized}`;
}

function pairIsHeading(pair: ContentPair): boolean {
	return /^#{3,4}\s/.test(pair.english.trimStart());
}

function formatDiscourseHref(fullReference: string): string {
	return fullReference
		.toLowerCase()
		.replace(/\s+/g, "")
		.replace(/[–—]/g, "-");
}

function viewFullTextPair(fullReference: string): ContentPair {
	const href = formatDiscourseHref(fullReference);
	return {
		type: "other",
		english: `<p><a href="/${href}" class="text-blue-600 hover:underline">View full text for: ${fullReference}</a></p>`,
	};
}

function sectionNotFoundPair(fullReference: string, hrf: string): ContentPair {
	const href = formatDiscourseHref(fullReference);
	return {
		type: "other",
		english: `<p class="english-paragraph">No content was found for ${transformId(hrf)} in ${transformId(href)}. <a href="/${href}" class="text-blue-600 hover:underline">View full text for: ${fullReference}</a></p>`,
	};
}

/** Filter reference segment pairs for partial discourse URLs (/an2.11, /an2.180-184). */
export function filterReferenceSegmentPairs(
	pairs: ContentPair[],
	filter: ReferenceSubsetFilter,
): ContentPair[] {
	if (filter.sectionNumber) {
		const filtered: ContentPair[] = [];
		let inSection = false;

		for (const pair of pairs) {
			if (pairIsHeading(pair)) {
				if (headingMatchesSectionNumber(pair.english, filter.sectionNumber)) {
					inSection = true;
					filtered.push(pair);
				} else if (inSection) {
					break;
				}
				continue;
			}
			if (inSection) {
				filtered.push(pair);
			}
		}

		if (filter.fullRef) {
			if (filtered.length === 0) {
				filtered.push(
					sectionNotFoundPair(
						filter.fullRef,
						filter.hrf ?? filter.fullRef,
					),
				);
			} else {
				filtered.push(viewFullTextPair(filter.fullRef));
			}
		}

		return filtered;
	}

	if (filter.discourseRange) {
		const filtered: ContentPair[] = [];
		let inRange = false;
		let foundEndHeading = false;

		for (const pair of pairs) {
			if (pairIsHeading(pair)) {
				const headingContent = pair.english.replace(/^#+\s+/, "");
				const headingNumber = headingContent.match(
					/^(\d+(?:\.\d+)?)/,
				)?.[1];

				if (headingNumber) {
					const isInRange = isHierarchicalNumberInRange(
						headingNumber,
						filter.discourseRange.start,
						filter.discourseRange.end,
					);

					if (headingNumber === filter.discourseRange.start) {
						inRange = true;
						filtered.push(pair);
					} else if (
						inRange &&
						headingNumber === filter.discourseRange.end
					) {
						filtered.push(pair);
						foundEndHeading = true;
					} else if (inRange && isInRange) {
						filtered.push(pair);
					} else if (inRange && !isInRange) {
						break;
					}
				}
				continue;
			}

			if (inRange && !foundEndHeading) {
				filtered.push(pair);
			} else if (inRange && foundEndHeading) {
				break;
			}
		}

		if (filter.fullRef) {
			if (filtered.length === 0) {
				filtered.push(
					sectionNotFoundPair(
						filter.fullRef,
						filter.hrf ?? filter.fullRef,
					),
				);
			} else {
				filtered.push(viewFullTextPair(filter.fullRef));
			}
		}

		return filtered;
	}

	return pairs;
}

/** Find a parent range discourse slug containing a numeric section. */
export function findParentDiscourseRoute(
	prefix: string,
	isInRange: (rangeStart: string, rangeEnd: string) => boolean,
	candidateRoutes: readonly string[],
): string | undefined {
	return candidateRoutes.find((route) => {
		if (!route.startsWith(prefix)) return false;
		const rangeMatch = route.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
		if (!rangeMatch) return false;
		const [, rangeStart, rangeEnd] = rangeMatch;
		const properRangeEnd = constructHierarchicalEnd(rangeStart, rangeEnd);
		return isInRange(rangeStart, properRangeEnd);
	});
}

/** Sort bilara segment keys by embedded sutta prefix, then segment index. */
export function compareBilaraSegmentKeys(a: string, b: string): number {
	const prefixA = a.includes(":") ? a.slice(0, a.indexOf(":")) : a;
	const prefixB = b.includes(":") ? b.slice(0, b.indexOf(":")) : b;
	if (prefixA !== prefixB) {
		return prefixA.localeCompare(prefixB, undefined, { numeric: true });
	}
	const parse = (key: string) => {
		const seg = key.split(":")[1] ?? "";
		return seg.split(".").map((n) => Number.parseInt(n, 10) || 0);
	};
	const aa = parse(a);
	const bb = parse(b);
	for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
		const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/** Whether reference markdown uses bilara segment-key markers. */
export function hasSegmentMarkers(body: string): boolean {
	return SEGMENT_MARKER_RE.test(body.trim().split("\n")[0] ?? "");
}

/** Parse `<!-- @segment key -->` blocks into ordered segment entries. */
export function parseSegmentMarkedBody(body: string): SegmentEntry[] {
	const trimmed = body.trim();
	if (!trimmed) return [];

	const segments: SegmentEntry[] = [];
	for (const chunk of trimmed.split(/\n\n(?=<!-- @segment )/)) {
		const match = chunk.match(
			/^<!-- @segment ([^\s>]+) -->\n?([\s\S]*)$/,
		);
		if (!match) continue;
		segments.push({ key: match[1], text: match[2].trim() });
	}
	return segments.sort((a, b) => compareBilaraSegmentKeys(a.key, b.key));
}

function isEndMarker(text: string): boolean {
	return END_MARKER_RE.test(text.trim());
}

type ContentEntry = { body: string };

/** Pair pli-ms and Sujato reference bodies by shared bilara segment keys. */
export function parseReferenceSegmentContent(
	paliContent: ContentEntry,
	englishContent: ContentEntry,
	toSmartQuotes: (text: string) => string,
): ContentPair[] {
	const paliSegments = parseSegmentMarkedBody(paliContent.body);
	const englishByKey = new Map(
		parseSegmentMarkedBody(englishContent.body).map((segment) => [
			segment.key,
			segment.text,
		]),
	);

	const pairs: ContentPair[] = [];
	let paragraphNum = 1;

	for (const { key, text: pali } of paliSegments) {
		if (!pali || isEndMarker(pali)) continue;
		const sectionHeading = segmentKeyToSectionHeading(key);
		const english = sectionHeading
			? sectionHeading
			: toSmartQuotes(englishByKey.get(key) ?? "");
		pairs.push({
			type: "paragraph",
			english,
			pali: sectionHeading ? undefined : pali,
			actualParagraphNumber: sectionHeading ? undefined : paragraphNum++,
		});
	}

	return pairs;
}
