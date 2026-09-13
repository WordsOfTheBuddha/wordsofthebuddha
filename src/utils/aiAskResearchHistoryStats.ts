import { uniquePrefixedDiscourseIdsInText } from "./aiSearchQuery";
import { stripResearchReportLengthNote } from "./aiAskResearchReportLength";

export interface ResearchHistoryReportStats {
	words: number;
	cited: number;
	additional: number;
}

function researchReportStatsBody(report?: string | null): string {
	return stripResearchReportLengthNote(
		(report || "")
			.replace(/\r\n/g, "\n")
			.replace(/(?:^|\n)## Sources\b[\s\S]*$/i, "")
			.replace(/^readPali:\s*.+$/gim, ""),
	);
}

function researchReportWordCount(body: string): number {
	const text = body
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_~`>#]+/g, " ")
		.replace(/\|/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!text) return 0;
	return text.split(" ").length;
}

function uniqueSourceSlugs(
	results?: readonly { slug?: string }[],
): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const hit of results || []) {
		const slug = (hit.slug || "").trim().toLowerCase();
		if (!slug || seen.has(slug)) continue;
		seen.add(slug);
		out.push(slug);
	}
	return out;
}

function clipStat(value: unknown, max: number): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.min(max, Math.floor(n));
}

export function sanitizeResearchHistoryReportStats(
	raw: unknown,
): ResearchHistoryReportStats | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const words = clipStat(record.words, 1_000_000);
	const cited = clipStat(record.cited, 2_000);
	const additional = clipStat(record.additional, 2_000);
	if (words <= 0 && cited <= 0 && additional <= 0) return undefined;
	return { words, cited, additional };
}

/** Count length and citations from the write-up, before history slims the report. */
export function snapshotResearchHistoryStats(
	report?: string | null,
	results?: readonly { slug?: string }[],
): ResearchHistoryReportStats | undefined {
	const body = researchReportStatsBody(report);
	if (!body) return undefined;
	const words = researchReportWordCount(body);
	const citedIds = uniquePrefixedDiscourseIdsInText(body);
	const cited = citedIds.length;
	const citedSet = new Set(citedIds.map((id) => id.toLowerCase()));
	const additional = uniqueSourceSlugs(results).filter(
		(slug) => !citedSet.has(slug),
	).length;
	return sanitizeResearchHistoryReportStats({ words, cited, additional });
}

function formatHistoryStatCount(n: number): string {
	return n.toLocaleString("en-US");
}

export function formatResearchHistoryStatsLabel(
	stats?: ResearchHistoryReportStats | null,
): string {
	if (!stats) return "";
	const parts: string[] = [];
	if (stats.words > 0) {
		parts.push(
			`${formatHistoryStatCount(stats.words)} ${stats.words === 1 ? "word" : "words"}`,
		);
	}
	if (stats.cited > 0) {
		parts.push(
			`${formatHistoryStatCount(stats.cited)} ${stats.cited === 1 ? "discourse cited" : "discourses cited"}`,
		);
	}
	if (stats.additional > 0) {
		const extraNoun =
			stats.cited > 0
				? stats.additional === 1
					? "additional source"
					: "additional sources"
				: stats.additional === 1
					? "source"
					: "sources";
		parts.push(
			`${formatHistoryStatCount(stats.additional)} ${extraNoun}`,
		);
	}
	return parts.join(" · ");
}

/** History card last row: length, unique discourses named, leftover sources. */
export function researchHistoryStatsLabel(
	report?: string | null,
	results?: readonly { slug?: string }[],
	stored?: ResearchHistoryReportStats | null,
): string {
	const fromStore = formatResearchHistoryStatsLabel(
		sanitizeResearchHistoryReportStats(stored),
	);
	if (fromStore) return fromStore;
	return formatResearchHistoryStatsLabel(
		snapshotResearchHistoryStats(report, results),
	);
}
