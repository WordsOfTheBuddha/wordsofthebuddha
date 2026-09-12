import type { AiDiscourseHit } from "./aiDiscourseHits";
import { stripResearchSourcesSection } from "./aiAskResearchReport";

export const ASK_EXPORT_OPEN_EVENT = "ask-export-open";

export const ASK_EXPORT_SITE_ORIGIN = "https://www.wordsofthebuddha.org";

const NAMED_DISCOURSE_ID_IN_TEXT =
	/\b(mn|dn|sn|an|dhp|ud|iti|snp|kp|thag|thig|vv|pv|ja|bv|cp|mil)\s*(\d+(?:\.\d+)*)\b/gi;

export type ResearchExportContents = "report" | "cited" | "all";

export type AskExportDiscourseView = {
	slug: string;
	title: string;
	description: string;
	isReference: boolean;
	cited: boolean;
};

export type AskExportTurnView = {
	question: string;
	summary: string;
	discourses: AskExportDiscourseView[];
	research?: boolean;
};

export type AskExportOpenDetail = {
	turns: AskExportTurnView[];
	sharePath?: string;
	research?: boolean;
};

type ExportableTurn = {
	pending?: boolean;
	error?: string;
	offTopic?: boolean;
	question: string;
	summary?: string;
	report?: string;
	research?: boolean;
	results: AiDiscourseHit[];
	sharePath?: string;
};

/** Compact slugs named in the write-up, excluding the appended Sources list. */
export function researchCitedSlugSet(report: string): Set<string> {
	const out = new Set<string>();
	const source = stripResearchSourcesSection(report).replace(/\u2019/g, "'");
	for (const match of source.matchAll(NAMED_DISCOURSE_ID_IN_TEXT)) {
		const compact = `${(match[1] || "").toLowerCase()}${match[2] || ""}`;
		if (!compact) continue;
		out.add(compact);
	}
	return out;
}

export function slugsForResearchExportContents(
	discourses: readonly AskExportDiscourseView[],
	contents: ResearchExportContents,
): string[] {
	if (contents === "report") return [];
	const wanted =
		contents === "cited"
			? discourses.filter((discourse) => discourse.cited)
			: discourses;
	const out: string[] = [];
	const seen = new Set<string>();
	for (const discourse of wanted) {
		const slug = discourse.slug.trim().toLowerCase();
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
	}
	return out;
}

export function researchExportContentsCounts(
	turns: readonly AskExportTurnView[],
): {
	cited: number;
	all: number;
	additional: number;
	showCited: boolean;
	showAll: boolean;
	defaultContents: ResearchExportContents;
} {
	const discourses = turns.flatMap((turn) => turn.discourses);
	const cited = discourses.filter((discourse) => discourse.cited).length;
	const all = discourses.length;
	const additional = Math.max(0, all - cited);
	return {
		cited,
		all,
		additional,
		showCited: cited > 0,
		showAll: additional > 0,
		defaultContents: cited > 0 ? "cited" : "report",
	};
}

export function researchExportContentsDescription(
	kind: "cited" | "all",
	count: number,
	turnCount: number,
): string {
	const n = Math.max(0, count);
	const noun = n === 1 ? "discourse" : "discourses";
	const formatted = n.toLocaleString("en-US");
	if (kind === "cited") {
		const where = turnCount === 1 ? "the report" : "the reports";
		return `${formatted} ${noun} named in ${where}`;
	}
	const where = turnCount === 1 ? "this report" : "these reports";
	return `${formatted} ${noun} gathered for ${where}`;
}

/**
 * Citation link targets for a downloaded report. Included discourses use the
 * in-file href; names that are only in the write-up point at the site.
 */
export function askExportCitationHits(
	summary: string,
	discourses: readonly { slug: string; href: string }[],
	research: boolean,
): { slug: string; href: string }[] {
	if (!research) {
		return discourses.map((discourse) => ({
			slug: discourse.slug,
			href: discourse.href,
		}));
	}
	const bySlug = new Map<string, string>();
	for (const discourse of discourses) {
		const slug = discourse.slug.trim().toLowerCase();
		if (!slug || bySlug.has(slug)) continue;
		bySlug.set(slug, discourse.href);
	}
	const out: { slug: string; href: string }[] = [];
	const seen = new Set<string>();
	const add = (raw: string) => {
		const slug = raw.trim().toLowerCase();
		if (!slug || seen.has(slug)) return;
		seen.add(slug);
		out.push({
			slug,
			href: bySlug.get(slug) || `${ASK_EXPORT_SITE_ORIGIN}/${slug}`,
		});
	};
	for (const slug of researchCitedSlugSet(summary)) add(slug);
	for (const discourse of discourses) add(discourse.slug);
	return out;
}

function discourseViewsForTurn(
	turn: ExportableTurn,
	research: boolean,
): AskExportDiscourseView[] {
	const citedSet = research
		? researchCitedSlugSet((turn.report || turn.summary || "").trim())
		: null;
	return (turn.results || []).map((hit) => ({
		slug: hit.slug,
		title: hit.title,
		description: hit.description || "",
		isReference: hit.referenceOnly === true,
		cited: citedSet?.has(hit.slug.trim().toLowerCase()) === true,
	}));
}

/** Successful Ask turns, or research reports (even with no discourses). */
export function askTurnsForExport(
	turns: readonly ExportableTurn[],
): AskExportTurnView[] {
	const out: AskExportTurnView[] = [];
	for (const turn of turns) {
		if (turn.pending || turn.error || turn.offTopic) continue;
		if (!Array.isArray(turn.results)) continue;
		const research = turn.research === true || Boolean(turn.report);
		const summary = (turn.report || turn.summary || "").trim();
		if (turn.results.length === 0 && !(research && summary)) continue;
		out.push({
			question:
				turn.question.trim() || (research ? "Research report" : "Ask"),
			summary,
			discourses: discourseViewsForTurn(turn, research),
			...(research ? { research: true } : {}),
		});
	}
	return out;
}

export function askExportSharePathFromTurns(
	turns: readonly ExportableTurn[],
	locationPathname?: string,
): string | undefined {
	const loc = (locationPathname || "").trim();
	if (/^\/ask\/[a-z0-9-]+$/i.test(loc)) return loc;
	for (let i = turns.length - 1; i >= 0; i--) {
		const path = turns[i]?.sharePath?.trim();
		if (path && /^\/ask\/[a-z0-9-]+$/i.test(path)) return path;
	}
	return undefined;
}
