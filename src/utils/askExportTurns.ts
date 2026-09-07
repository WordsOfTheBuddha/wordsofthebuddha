import type { AiDiscourseHit } from "./aiDiscourseHits";

export const ASK_EXPORT_OPEN_EVENT = "ask-export-open";

export type AskExportDiscourseView = {
	slug: string;
	title: string;
	description: string;
	isReference: boolean;
};

export type AskExportTurnView = {
	question: string;
	summary: string;
	discourses: AskExportDiscourseView[];
};

export type AskExportOpenDetail = {
	turns: AskExportTurnView[];
	sharePath?: string;
};

type ExportableTurn = {
	pending?: boolean;
	error?: string;
	offTopic?: boolean;
	question: string;
	summary?: string;
	results: AiDiscourseHit[];
	sharePath?: string;
};

/** Successful Ask turns with at least one discourse — the download tree. */
export function askTurnsForExport(
	turns: readonly ExportableTurn[],
): AskExportTurnView[] {
	const out: AskExportTurnView[] = [];
	for (const turn of turns) {
		if (
			turn.pending ||
			turn.error ||
			turn.offTopic ||
			!Array.isArray(turn.results) ||
			turn.results.length === 0
		) {
			continue;
		}
		out.push({
			question: turn.question.trim() || "Ask",
			summary: (turn.summary || "").trim(),
			discourses: turn.results.map((hit) => ({
				slug: hit.slug,
				title: hit.title,
				description: hit.description || "",
				isReference: hit.referenceOnly === true,
			})),
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
