/**
 * Client-side highlight state for the current page.
 *
 * `spans` is the source of truth: edits change the list and repaint, and the
 * list is what gets saved. Spans whose block is not rendered on this page
 * (Pāli spans on an English-only view) are kept untouched.
 */

import type { HighlightSegment } from "../types/notes";
import { highlightSlugFromUrl } from "../utils/highlightSlug";
import type { StoredHighlightDoc } from "../utils/pageUserStateClient";
import {
	addPieces,
	buildBlockIndex,
	buildHighlightDocument,
	erasePieces,
	paintHighlights,
	parseHighlightDocument,
	piecesFromRange,
	piecesOverlapSpans,
	spansFromLegacySegments,
	type HighlightColor,
	type HighlightSpan,
} from "../utils/stableHighlight";

let spans: HighlightSpan[] = [];
/** Review-room snapshots from the loaded doc, kept for blocks not on this page. */
let storedSegments: Record<string, HighlightSegment> = {};
let persistChain: Promise<void> = Promise.resolve();

function getRoot(): HTMLElement | null {
	return document.getElementById("highlight-root");
}

export function getHighlightSpans(): HighlightSpan[] {
	return spans;
}

export function restoreHighlights(state: {
	highlights: StoredHighlightDoc | null;
	legacyHighlights?: StoredHighlightDoc[];
}): void {
	const root = getRoot();
	if (!root) return;

	const doc = parseHighlightDocument(state.highlights?.highlightDocument);
	let migrated = false;
	if (doc) {
		spans = doc.spans;
		storedSegments =
			(state.highlights?.highlightSegments as Record<string, HighlightSegment>) ??
			{};
	} else {
		const sources = state.highlights
			? [state.highlights]
			: (state.legacyHighlights ?? []);
		let recovered: HighlightSpan[] = [];
		for (const source of sources) {
			recovered = spansFromLegacySegments(
				source.highlightSegments,
				root,
				recovered,
			);
		}
		spans = recovered;
		storedSegments = {};
		migrated = spans.length > 0;
	}

	repaintHighlights();
	if (migrated) persist();
}

export function repaintHighlights(): void {
	const root = getRoot();
	if (!root) return;
	spans = paintHighlights(root, spans);
}

export function highlightRange(range: Range, color: HighlightColor): boolean {
	const root = getRoot();
	if (!root) return false;
	const index = buildBlockIndex(root);
	const pieces = piecesFromRange(range, root, undefined, index);
	if (pieces.length === 0) return false;
	spans = addPieces(spans, pieces, color, index);
	repaintHighlights();
	persist();
	return true;
}

export function eraseRange(range: Range): boolean {
	const root = getRoot();
	if (!root) return false;
	const index = buildBlockIndex(root);
	const pieces = piecesFromRange(range, root, undefined, index);
	if (!piecesOverlapSpans(spans, pieces)) return false;
	spans = erasePieces(spans, pieces, index);
	repaintHighlights();
	persist();
	return true;
}

export function rangeHasHighlight(range: Range): boolean {
	const root = getRoot();
	if (!root || spans.length === 0) return false;
	return piecesOverlapSpans(spans, piecesFromRange(range, root));
}

function segmentId(key: string): string {
	return key.replace(/[./]/g, "_");
}

/** Paragraph order that holds across views: Pāli before its English pair. */
function keyOrder(key: string): number | null {
	const m = /^(en|pli):(\d+)$/.exec(key);
	if (!m) return null;
	return Number(m[2]) * 1000 + (m[1] === "pli" ? 0 : 500);
}

function buildReviewSegments(root: HTMLElement): Record<string, HighlightSegment> {
	const keys = new Set(spans.map((s) => s.block));
	const out: Record<string, HighlightSegment> = {};
	let base = 0;
	let bump = 0;
	for (const ref of buildBlockIndex(root).canonical) {
		const keyed = keyOrder(ref.key);
		if (keyed !== null) {
			base = keyed;
			bump = 0;
		} else {
			bump++;
		}
		if (!keys.has(ref.key)) continue;
		out[segmentId(ref.key)] = {
			containerHTML: ref.el.outerHTML,
			highlightText: spans
				.filter((s) => s.block === ref.key)
				.sort((a, b) => a.start - b.start)
				.map((s) => s.quote)
				.join(" ... "),
			domPath: ref.key,
			order: keyed ?? base + bump,
		};
	}
	for (const key of keys) {
		const id = segmentId(key);
		if (!out[id] && storedSegments[id]) out[id] = storedSegments[id];
	}
	return out;
}

function persist(): void {
	persistChain = persistChain.then(writeHighlights).catch((error) => {
		console.error("[highlight] Error persisting highlights:", error);
	});
}

async function writeHighlights(): Promise<void> {
	const root = getRoot();
	if (!root) return;
	const slug = highlightSlugFromUrl(window.location.href);

	if (spans.length === 0) {
		storedSegments = {};
		await fetch("/api/highlights/delete", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug }),
		});
		return;
	}

	const highlightSegments = buildReviewSegments(root);
	storedSegments = highlightSegments;
	const response = await fetch("/api/highlights/add", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			slug,
			highlights: {
				title: root.dataset.title || "",
				description: root.dataset.description || "",
				highlightDocument: buildHighlightDocument(spans),
				highlightSegments,
			},
		}),
	});
	const data = await response.json();
	if (data.error) console.error("[highlight] Server reported error:", data.error);
}

/** Fallback when the shared page-state request failed. */
export async function fetchAndRestoreHighlights(): Promise<void> {
	const slug = highlightSlugFromUrl(window.location.href);
	const response = await fetch(
		`/api/highlights/get?slug=${encodeURIComponent(slug)}`,
	);
	const data = await response.json();
	if (data.error) return;
	restoreHighlights({
		highlights: data.highlights ?? null,
		legacyHighlights: data.legacyHighlights ?? [],
	});
}
