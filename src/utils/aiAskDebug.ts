import { transformId } from "./transformId";

const DROPPED_UI_CAP = 16;
const GUIDANCE_PREVIEW = 120;

export interface AskDebugDroppedHit {
	slug: string;
	/** 1-based fused-pool rank. */
	rank: number;
	snippet: boolean;
}

export interface AskDebugView {
	coverage?: string;
	limit: number;
	reasoningChars: number;
	planningNotesChars: number;
	rankingGuidanceChars: number;
	rankingGuidancePreview?: string;
	namedTermQueries: string[];
	namedTermHits: number;
	namedTermKept: number;
	dropped: AskDebugDroppedHit[];
	droppedMore: number;
}

export function clipAskDebugPreview(
	value: string | undefined,
	max = GUIDANCE_PREVIEW,
): string {
	const text = (value || "").replace(/\s+/g, " ").trim();
	if (!text) return "";
	return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

export function buildAskDebugView(input: {
	coverage?: string;
	limit: number;
	reasoning?: string;
	planningNotes?: string;
	rankingGuidance?: string;
	namedTermQueries?: readonly string[];
	namedTermHits?: readonly {
		slug: string;
		rank: number;
		snippet: boolean;
		kept: boolean;
	}[];
}): AskDebugView {
	const hits = input.namedTermHits || [];
	const droppedAll = hits.filter((hit) => !hit.kept);
	const dropped = droppedAll.slice(0, DROPPED_UI_CAP);
	const preview = clipAskDebugPreview(input.rankingGuidance);
	return {
		...(input.coverage ? { coverage: input.coverage } : {}),
		limit: input.limit,
		reasoningChars: (input.reasoning || "").trim().length,
		planningNotesChars: (input.planningNotes || "").trim().length,
		rankingGuidanceChars: (input.rankingGuidance || "").trim().length,
		...(preview ? { rankingGuidancePreview: preview } : {}),
		namedTermQueries: [...(input.namedTermQueries || [])],
		namedTermHits: hits.length,
		namedTermKept: hits.filter((hit) => hit.kept).length,
		dropped,
		droppedMore: Math.max(0, droppedAll.length - dropped.length),
	};
}

function formatDropped(item: AskDebugDroppedHit): string {
	const id = transformId(item.slug) || item.slug;
	return `${id}@${item.rank}${item.snippet ? "" : "(no-passage)"}`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Compact DEV lines for the Ask process strip. */
export function formatAskDebugDevHtml(
	debug: AskDebugView | undefined,
): string {
	if (!debug) return "";
	const coverage = debug.coverage || "unset";
	const guidance =
		debug.rankingGuidanceChars > 0
			? `guidance ${debug.rankingGuidanceChars}c`
			: "guidance no";
	const think = `think ${debug.reasoningChars}c`;
	const notes = `notes ${debug.planningNotesChars}c`;
	const line1 = `DEV · ${think} · coverage=${coverage} limit=${debug.limit} · ${notes} · ${guidance}`;
	const terms =
		debug.namedTermQueries.length > 0
			? debug.namedTermQueries.join(", ")
			: "(none)";
	let line2 = `DEV · term ${terms} · ${debug.namedTermHits} hits · kept ${debug.namedTermKept}`;
	if (debug.dropped.length > 0) {
		const extra = debug.droppedMore > 0 ? ` +${debug.droppedMore} more` : "";
		line2 += ` · dropped ${debug.dropped.map(formatDropped).join(" ")}${extra}`;
	}
	const title = debug.rankingGuidancePreview
		? ` title="${escapeHtml(debug.rankingGuidancePreview)}"`
		: "";
	return `<p class="ai-dev-routing"${title}>${escapeHtml(line1)}</p><p class="ai-dev-routing">${escapeHtml(line2)}</p>`;
}
