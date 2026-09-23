/**
 * Lightweight Ask card builders shared by the inline discourse composer.
 * Mirrors the Asks-tab look (process strip → answer card → query chips →
 * sources disclosure) without importing the full Ask client, so the
 * discourse lazy chunk stays small. Text matches
 * `buildAskProcessSteps` / `askResultsCaption` in aiModeClient.ts — keep
 * them in sync when the tab wording changes.
 */
import { transformId } from "./transformId";
import {
	formatResearchHitTitle,
	renderAskBriefingHtml,
} from "./aiAskResearchReport";
import {
	annotateResearchCitationLinks,
	formatDiscourseCitationTitle,
} from "./discourseCitationPopover";
import { discourseIdLinkIndex, normalizeAskSummaryProse } from "./linkifyAskSummary";
import {
	askAnswerCopyButtonHtml,
	dedupeSourcingSearchTerms,
	SEARCH_TERMS_SOURCING_LABEL,
	wrapAskAnswerHtml,
} from "./aiAskResearchUi";
import type { AiDiscourseHit } from "./aiDiscourseHits";

export type AskInlinePhase =
	| "rewrite"
	| "search"
	| "rerank"
	| "answer"
	| "done";

export interface AskInlineTurn {
	question: string;
	lookingFor: string;
	queries: readonly string[];
	fallbackQueries: readonly string[];
	offTopic: boolean;
	results: readonly AiDiscourseHit[];
	summary: string;
	candidateCount?: number;
	showCount?: number;
	pending: boolean;
	phase: AskInlinePhase;
	error?: string;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function stripHtml(value: string): string {
	return value.replace(/<[^>]*>/g, "");
}

interface AskInlineStep {
	state: "done" | "active" | "todo";
	text: string;
}

function inlineProcessSteps(turn: AskInlineTurn): AskInlineStep[] {
	const question = (turn.question || "").replace(/\s+/g, " ").trim();
	const looking = (turn.lookingFor || "")
		.replace(/^looking for:\s*/i, "")
		.replace(/\s+/g, " ")
		.trim();
	const lookingSame =
		looking.toLowerCase() === question.toLowerCase() || looking.length > 80;
	const theme = looking && !lookingSame ? looking : "";
	const pool = Math.max(0, Math.floor(turn.candidateCount || 0));
	const shown = Math.max(
		0,
		Math.floor(
			turn.pending
				? turn.showCount || 0
				: turn.results.length || turn.showCount || 0,
		),
	);
	// A failed turn keeps its death phase so the strip shows where it
	// stopped (active step + todos) instead of a misleading all-done strip.
	const phase = turn.pending || turn.error ? turn.phase : "done";

	if (turn.offTopic && phase === "done") {
		return [
			{
				state: "done",
				text: theme || "Outside the early discourses — no library search",
			},
		];
	}

	const understood: AskInlineStep =
		phase === "rewrite"
			? { state: "active", text: "Understanding the question…" }
			: {
					state: "done",
					text: theme ? `Understood · ${theme}` : "Understood the question",
				};

	const searched: AskInlineStep =
		phase === "rewrite"
			? { state: "todo", text: "Search the library" }
			: phase === "search"
				? { state: "active", text: "Searching the library…" }
				: {
						state: "done",
						text:
							pool > 0 || shown > 0
								? `Searched the library · ${Math.max(pool, shown).toLocaleString()} discourses`
								: "Searched the library",
					};

	const picked: AskInlineStep =
		phase === "rewrite" || phase === "search"
			? { state: "todo", text: "Crunch the candidates" }
			: phase === "rerank"
				? {
						state: "active",
						text: pool > 0
							? `Crunching ${pool.toLocaleString()} discourses…`
							: "Crunching discourses…",
					}
				: shown > 0
					? {
							state: "done",
							text: `Picked ${shown.toLocaleString()} discourses`,
						}
					: { state: "done", text: "No matching discourses" };

	if (phase === "done") return [understood, searched, picked];
	const write: AskInlineStep =
		phase === "answer"
			? { state: "active", text: "Writing from the selected discourses…" }
			: { state: "todo", text: "Show the best matches" };
	return [understood, searched, picked, write];
}

/** Same strip as the Asks tab (`<ol class="ai-process">`), no thinking pane. */
export function askInlineProcessHtml(turn: AskInlineTurn): string {
	const steps = inlineProcessSteps(turn);
	if (steps.length === 0) return "";
	const items = steps
		.map((step) => {
			const mark =
				step.state === "done" ? "✓" : step.state === "active" ? "●" : "○";
			return `<li class="is-${step.state}"><span class="ai-process-mark" aria-hidden="true">${mark}</span><span>${escapeHtml(step.text)}</span></li>`;
		})
		.join("");
	return `<ol class="ai-process" aria-label="How this Ask worked">${items}</ol>`;
}

/** Answer card with linkified discourse IDs + Copy button (tab parity).
 * Briefing links carry popover data so the shared citation popover works
 * on answer links wherever the thread root is installed. */
export function askInlineAnswerHtml(
	turn: Pick<AskInlineTurn, "summary" | "results">,
	turnIndex: number,
): string {
	const summary = (turn.summary || "").trim();
	if (!summary || turn.results.length === 0) return "";
	return wrapAskAnswerHtml({
		kind: "answer",
		turnIndex,
		bodyHtml: annotateResearchCitationLinks(
			renderAskBriefingHtml(summary, turn.results),
			turn.results,
		),
	});
}

/** "Search queries used for sourcing:" chips (tab parity). */
export function askInlineChipsHtml(
	turn: Pick<AskInlineTurn, "queries" | "fallbackQueries" | "offTopic" | "results">,
): string {
	if (turn.offTopic || turn.results.length === 0) return "";
	const queries = dedupeSourcingSearchTerms(turn.queries, turn.fallbackQueries);
	if (queries.length === 0) return "";
	return `<div class="ai-sourcing-terms">
		<span class="ai-sourcing-terms-label">${escapeHtml(SEARCH_TERMS_SOURCING_LABEL)}</span>
		<div class="ai-queries">${queries
			.map(
				(query) =>
					`<a class="ai-query-chip" href="/search?q=${encodeURIComponent(query)}">${escapeHtml(query)}</a>`,
			)
			.join("")}</div>
	</div>`;
}

/**
 * Compact numbered source row (Ask + Research v1): title-only `ID Title`.
 * The popover carries the discourse description only — never the
 * query-matched snippet, which is often a Pali or mid-sentence fragment.
 * PTS stays out for v1.
 * (Moved verbatim from aiModeClient.ts — single source of truth.)
 */
export function aiSourceRowHtml(
	hit: AiDiscourseHit,
	research = false,
): string {
	const id = escapeHtml(transformId(hit.slug));
	const displayTitle = research ? formatResearchHitTitle(hit.title) : hit.title;
	const citeTitle = escapeHtml(
		formatDiscourseCitationTitle(hit.slug, displayTitle),
	);
	const citeDesc = escapeHtml(
		stripHtml(hit.description || "")
			.replace(/\s+/g, " ")
			.trim(),
	);
	const descAttr = citeDesc ? ` data-cite-desc="${citeDesc}"` : "";
	return `<li data-result-type="discourse"><a href="${escapeHtml(hit.href)}" class="search-discourse-card ai-source-ref block no-underline text-inherit" data-search-result data-cite-title="${citeTitle}"${descAttr}><span class="ai-source-id">${id}</span><span class="ai-source-sep" aria-hidden="true"> – </span><span class="ai-source-title">${escapeHtml(displayTitle)}</span></a></li>`;
}

/** Collapsed-by-default "Showing N discourses" disclosure (tab parity). */
export function askInlineSourcesHtml(
	turn: Pick<AskInlineTurn, "results" | "candidateCount">,
): string {
	if (turn.results.length === 0) return "";
	const shown = turn.results.length;
	const pool = Math.max(0, Math.floor(turn.candidateCount || 0));
	const noun = `discourse${shown === 1 ? "" : "s"}`;
	const caption =
		pool > shown
			? `Showing ${shown} ${noun} · picked from ${pool.toLocaleString()}`
			: `Showing ${shown} ${noun}`;
	const body = turn.results
		.filter((hit) => Boolean((hit.slug || "").trim()))
		.map((hit) => aiSourceRowHtml(hit as AiDiscourseHit))
		.join("");
	if (!body) return "";
	return `<details class="ai-sources"><summary>${escapeHtml(caption)}</summary><ol class="ai-hits ai-sources-list">${body}</ol></details>`;
}

export function askInlineCopyButtonHtml(turnIndex: number): string {
	return askAnswerCopyButtonHtml({
		turnIndex,
		kind: "answer",
		placement: "end",
	});
}

function absoluteCopyHref(href: string, origin: string): string {
	const trimmed = (href || "").trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	const base = (origin || "").trim().replace(/\/$/, "");
	if (!base) return trimmed;
	return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

/**
 * Clipboard markdown for an answer: question, linkified prose, sources.
 * Mirrors the on-screen card (same ID-linking, same `ID - Title` rows) so
 * Copy reproduces the answer as markdown instead of plain text.
 */
export function formatAskAnswerCopyMarkdown(input: {
	question: string;
	summary: string;
	results: readonly AiDiscourseHit[];
	origin?: string;
}): string {
	const origin = (input.origin || "").trim();
	const text = normalizeAskSummaryProse(input.summary);
	const { byKey, pattern } = discourseIdLinkIndex(input.results);
	const seen = new Set<string>();
	const linked = pattern
		? text.replace(pattern, (token) => {
				const key = token
					.replace(/\s*¶[\s\S]*$/, "")
					.trim()
					.toLowerCase();
				const link = byKey.get(key);
				if (!link || seen.has(link.slug)) return token;
				seen.add(link.slug);
				return `[${token}](${absoluteCopyHref(link.href, origin)})`;
			})
		: text;
	const rows = input.results
		.map((hit) => {
			const slug = (hit.slug || "").trim();
			if (!slug) return "";
			const label = formatDiscourseCitationTitle(slug, hit.title || "");
			const href = absoluteCopyHref(hit.href || `/${slug}`, origin);
			return `- [${label}](${href})`;
		})
		.filter(Boolean);
	const question = (input.question || "").replace(/\s+/g, " ").trim();
	const parts = [
		question,
		linked,
		...(rows.length > 0 ? [`Sources\n${rows.join("\n")}`] : []),
	].filter(Boolean);
	return parts.join("\n\n");
}

export function askInlineEmptyHtml(
	turn: Pick<AskInlineTurn, "queries" | "lookingFor" | "question">,
): string {
	const searchTerm =
		turn.queries[0] ||
		turn.lookingFor.replace(/^looking for:\s*/i, "").trim() ||
		turn.question;
	const href = `/search?q=${encodeURIComponent(searchTerm)}`;
	return `<div class="ai-empty-hits">
		<p>No discourses matched those searches.</p>
		<p><a href="${escapeHtml(href)}">Open Search</a>, or ask again with different terms.</p>
	</div>`;
}
