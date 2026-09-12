import { ASK_SHARE_SLUG_MAX, ASK_SHARE_SLUG_MIN } from "./aiAskShare";
import { RESEARCH_REPORT_MAX_CHARS } from "./aiAskResearchReport";
import { normalizeAskSummaryProse } from "./linkifyAskSummary";

export const MAX_ASK_EXPORT_TURNS = 20;
/** Match Research’s selected-set hard cap so a full report can download. */
export const MAX_ASK_EXPORT_DISCOURSES = 160;
export const MAX_ASK_EXPORT_QUESTION = 2000;
export const MAX_ASK_EXPORT_SUMMARY = 4800;
export const MAX_ASK_EXPORT_TITLE = 200;

export type AskExportTurnRequest = {
	question: string;
	summary: string;
	selectedDiscourseSlugs: string[];
};

export type ParsedAskExportRequest = {
	turns: AskExportTurnRequest[];
	sharePath?: string;
	title?: string;
	kind?: "ask" | "research";
};

function normalizeDiscourseSlug(id: string): string {
	const t = id.trim().toLowerCase();
	if (!t.includes("/")) return t;
	return t.split("/").filter(Boolean).pop() ?? t;
}

function clipText(value: string, max: number): string {
	const text = value.replace(/\s+/g, " ").trim();
	return text.length <= max ? text : text.slice(0, max);
}

function uniqueSlugs(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const slug = normalizeDiscourseSlug(String(item ?? "").trim());
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
	}
	return out;
}

/** Public Ask share path, or the Ask home search URL. */
export function sanitizeAskExportSharePath(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;
	const path = raw.trim();
	const share = path.match(/^\/(ask|research)\/([a-z0-9-]+)$/i);
	if (share) {
		const prefix = (share[1] ?? "ask").toLowerCase();
		const slug = share[2] ?? "";
		if (
			slug.length >= ASK_SHARE_SLUG_MIN &&
			slug.length <= ASK_SHARE_SLUG_MAX
		) {
			return `/${prefix}/${slug.toLowerCase()}`;
		}
		return undefined;
	}
	if (
		path === "/search?mode=ask" ||
		path === "/search?mode=ai" ||
		path === "/search?mode=research"
	) {
		return path === "/search?mode=research"
			? "/search?mode=research"
			: "/search?mode=ask";
	}
	return undefined;
}

/**
 * Parse POST /api/export/ask JSON (turns + optional cover title / share path).
 * Content options (`format`, `images`, …) are read separately by the API route.
 */
export function parseAskExportRequest(
	body: Record<string, unknown>,
): { ok: true; value: ParsedAskExportRequest } | { ok: false; error: string } {
	if (!Array.isArray(body.turns)) {
		return { ok: false, error: "turns must be a non-empty array." };
	}
	if (body.turns.length > MAX_ASK_EXPORT_TURNS) {
		return {
			ok: false,
			error: `Select at most ${MAX_ASK_EXPORT_TURNS} questions.`,
		};
	}

	const turns: AskExportTurnRequest[] = [];
	let discourseTotal = 0;

	for (const item of body.turns) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const slugs = uniqueSlugs(row.selectedDiscourseSlugs);
		if (slugs.length === 0) continue;
		discourseTotal += slugs.length;
		if (discourseTotal > MAX_ASK_EXPORT_DISCOURSES) {
			return {
				ok: false,
				error: `Select at most ${MAX_ASK_EXPORT_DISCOURSES} discourses.`,
			};
		}
		const question =
			typeof row.question === "string"
				? clipText(row.question, MAX_ASK_EXPORT_QUESTION)
				: "";
		const rawSummary = typeof row.summary === "string" ? row.summary : "";
		const research = body.kind === "research";
		const summary = research
			? rawSummary.replace(/\r\n/g, "\n").trim().slice(0, RESEARCH_REPORT_MAX_CHARS)
			: rawSummary
				? normalizeAskSummaryProse(rawSummary, MAX_ASK_EXPORT_SUMMARY)
				: "";
		turns.push({
			question: question || (research ? "Research report" : "Ask"),
			summary,
			selectedDiscourseSlugs: slugs,
		});
	}

	if (turns.length === 0) {
		return { ok: false, error: "Select at least one discourse." };
	}

	const sharePath = sanitizeAskExportSharePath(body.sharePath);
	const title =
		typeof body.title === "string"
			? clipText(body.title, MAX_ASK_EXPORT_TITLE)
			: "";
	const kind = body.kind === "research" ? "research" : "ask";

	return {
		ok: true,
		value: {
			turns,
			...(sharePath ? { sharePath } : {}),
			...(title ? { title } : {}),
			kind,
		},
	};
}

export function askExportCollectionUrl(
	sharePath?: string,
	kind: "ask" | "research" = "ask",
): string {
	if (sharePath) return `www.wordsofthebuddha.org${sharePath}`;
	return kind === "research"
		? "www.wordsofthebuddha.org/search?mode=research"
		: "www.wordsofthebuddha.org/search?mode=ask";
}
