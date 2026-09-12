import { formatAskDebugDevHtml, type AskDebugView } from "./aiAskDebug";
import {
	askAuthPageHref,
	askHistoryOpenParam,
	askResearchJobParam,
	askSampleParam,
	isAskSurfaceMode,
	isResearchSearchMode,
	searchResearchHref,
	withAskSurfaceParams,
} from "./aiAskHref";
import type { AiAskPersonHit } from "./aiAskPersons";
import { sanitizeAskPersonHits } from "./aiAskPersons";
import { ASK_FEEDBACK_MIN_CHARS, isValidAskUserReview } from "./aiAskQuota";
import type { ResearchQuotaView } from "./aiResearchQuota";
import {
	researchProcessHopLabels,
	type ResearchJobPublic,
} from "./aiAskResearchJob";
import {
	answersFromClarifyState,
	canStartResearchClarify,
	RESEARCH_CLARIFY_TITLE,
	RESEARCH_CLARIFY_OTHER_ID,
	RESEARCH_CLARIFY_MAX_OTHER,
	type ResearchClarifyQuestion,
} from "./aiAskResearchClarify";
import {
	formatResearchHitTitle,
	renderAskBriefingHtml,
	renderResearchReportHtml,
} from "./aiAskResearchReport";
import {
	hideDiscourseCitationPopover,
	installDiscourseCitationPopovers,
} from "./discourseCitationPopover";
import {
	ASK_PLACEHOLDER,
	ASK_COMPOSER_LABEL,
	ASK_DELETE_CONFIRM,
	ASK_HISTORY_ARIA,
	ASK_HISTORY_HINT_PINNED,
	ASK_HISTORY_HINT_RECENT,
	ASK_HISTORY_LABEL,
	ASK_LIMITS_NOTE,
	ASK_OPTIONS_ARIA,
	ASK_PIN_ACCOUNT_BODY,
	ASK_PIN_ACCOUNT_TITLE,
	ASK_SHARE_ACCOUNT_BODY,
	ASK_SHARE_ACCOUNT_TITLE,
	ASK_NEW_LABEL,
	applyResearchJobToTurn,
	askComposerMeterIsResearch,
	askFollowPlaceholder,
	askMeterLabel,
	canShowResearchChip,
	isAskResearchEnabled,
	RESEARCH_CHIP_STORAGE_KEY,
	RESEARCH_CHIP_TITLE,
	RESEARCH_COMPOSER_LABEL,
	RESEARCH_DELETE_ACTION,
	RESEARCH_DELETE_CONFIRM,
	RESEARCH_EMAIL_PENDING_NOTE,
	RESEARCH_HISTORY_ARIA,
	RESEARCH_HISTORY_LABEL,
	RESEARCH_INVITE_AFTER_ASK,
	RESEARCH_LIMITS_NOTE,
	RESEARCH_OPTIONS_ARIA,
	RESEARCH_PIN_ACCOUNT_BODY,
	RESEARCH_PIN_ACCOUNT_TITLE,
	RESEARCH_PIN_ACTION,
	RESEARCH_PLACEHOLDER,
	RESEARCH_SIGNIN_BODY,
	RESEARCH_SIGNIN_TITLE,
	RESEARCH_SHARE_ACCOUNT_BODY,
	RESEARCH_SHARE_ACCOUNT_TITLE,
	RESEARCH_UNPIN_ACTION,
	RESEARCH_NEW_LABEL,
	ASK_CLIPBOARD_COPIED_LABEL,
	ASK_CLIPBOARD_FAILED_LABEL,
	ASK_SHARE_COPIED_LABEL,
	ASK_SHARE_FAILED_LABEL,
	askHistoryCardMenuFlags,
	applyAskButtonFeedback,
	flashAskButtonFeedback,
	isIncompleteResearchTurn,
	openAskTurnActionFlags,
	readAskButtonIdle,
	researchHistoryStatsLabel,
	researchHistoryTimestamp,
	researchJobToHistoryEntry,
	researchEditAskInsteadLabel,
	researchRetrySubmitLabel,
	wrapAskAnswerHtml,
	sameResearchRetryQuestion,
	shouldUseResearchAsk,
} from "./aiAskResearchUi";
import {
	notifyResearchReady,
	requestResearchNotifyPermission,
	researchHistoryStatusLabel,
} from "./aiAskResearchNotify";
import {
	askSharePath,
	askShareTurnsForRestore,
	sanitizeAskShareSnapshot,
	type AiAskShareSnapshot,
	type AiAskShareTurn,
} from "./aiAskShare";
import {
	ASK_SAMPLE_HIDE_CONFIRM,
	ASK_SAMPLE_HIDE_TITLE,
	ASK_SAMPLE_MENU_LABEL,
	ASK_SAMPLE_NOTE,
	ASK_SAMPLE_PLAYBACK,
	ASK_SAMPLE_REMOVE_LABEL,
	ASK_SAMPLE_REMOVE_LABEL_SHORT,
	ASK_SAMPLE_REMOVE_TITLE,
	ASK_SAMPLE_SAVE_LABEL,
	ASK_SAMPLE_SAVE_LABEL_SHORT,
	askSampleConfirmMessage,
	askSampleHideKey,
	askSamplePlaybackPatch,
	askSampleRemoveConfirmMessage,
	canMarkAskAsSample,
	canRemoveAskSample,
	askSampleAdminAction,
	hideAskSampleKey,
	isResearchAskSample,
	publishedAskSample,
	readHiddenAskSampleKeys,
	removeAskSampleLocal,
	RESEARCH_SAMPLE_KICKER,
	RESEARCH_SAMPLE_NOTE,
	sampleToHistoryEntry,
	sanitizeAskSamplePublic,
	sampleToShareTurn,
	upsertAskSampleLocal,
	visibleHistorySamples,
	type AiAskSamplePublic,
	type AskSamplePlaybackPhase,
} from "./aiAskSamples";
import {
	ASK_HISTORY_PREVIEW_LIMIT,
	askHistoryEntriesForRestore,
	askHistoryEntriesForTab,
	askHistoryLaneEntries,
	clearAskResumeFromDiscourse,
	clearAskThreadResumeIntent,
	findAiAskSessionEntry,
	formatAskRelativeTime,
	markAskResumeFromDiscourse,
	mergeAskHistoryEntries,
	normalizeAskQuestionKey,
	pinnedAskHistoryEntries,
	preservePendingResearchHistory,
	priorResearchJobIdsInThread,
	readActiveAskThread,
	readAiAskSession,
	removeAskHistoryEntriesByJobIds,
	removeAskHistoryEntriesByQuestions,
	researchHistoryNeedsJobRestore,
	resolveAskHistoryTab,
	shouldRestoreActiveAskThread,
	shouldRestoreDroppedResearchJob,
	shouldResumeAskFromDiscourse,
	slimAskHistoryEntriesForSync,
	slimAskHistoryEntryForSync,
	attachResearchToHistoryThread,
	upsertAiAskSessionEntry,
	visibleAskHistoryEntries,
	writeActiveAskThread,
	writeAiAskSession,
	type AiAskSessionEntry,
	type AskHistoryTab,
} from "./aiAskSession";
import {
	assembleSpeechTranscript,
	type SpeechTranscriptResult,
} from "./aiSpeechTranscript";
import { formatDirectDiscourseIds } from "./aiSearchQuery";
import { transformId } from "./transformId";
import {
	ASK_EXPORT_OPEN_EVENT,
	askExportSharePathFromTurns,
	askTurnsForExport,
} from "./askExportTurns";
import { buildAskFollowUpHistory } from "./aiAskHistory";

export { buildAskFollowUpHistory };

export interface AiDiscourseHit {
	slug: string;
	title: string;
	description: string;
	contentSnippet: string | null;
	referenceOnly: boolean;
	volpage?: string;
	href: string;
}

export interface AiAskTurn {
	/** Display wording (updated to typo-corrected text when the plan arrives). */
	question: string;
	/** Exact text the user submitted. */
	originalQuestion?: string;
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	offTopic: boolean;
	results: AiDiscourseHit[];
	persons?: AiAskPersonHit[];
	model: string;
	reasoning: string;
	/** How the chosen discourses align with the question. */
	summary?: string;
	/** Preferred public /ask/{shareSlug} theme from the model. */
	shareSlug?: string;
	/** Resolved public path after Copy link (e.g. /ask/mindfulness-of-the-body). */
	sharePath?: string;
	/** Seeded from a public /ask/:slug snapshot (read-only turn). */
	fromShare?: boolean;
	/** Curated sample chip — no quota, not the reader's own Ask. */
	fromSample?: boolean;
	/** Public sample slug when this turn is a curated illustration. */
	sampleSlug?: string;
	pending: boolean;
	phase: "rewrite" | "verify" | "search" | "rerank" | "review" | "answer" | "done";
	/** Candidate pool size while rescoring (status event). */
	rerankCandidateCount?: number;
	/** Target display count while rescoring (status event). */
	rerankShowCount?: number;
	error?: string;
	fromCache?: boolean;
	requestId?: string;
	feedback?: "up" | "down" | "sending";
	/** Model plan was unusable; we synthesized shorter searches. */
	degraded?: boolean;
	/** Signed-in favorite for referring to later. */
	saved?: boolean;
	/** Reader expanded the (clamped) reasoning after the Ask finished. */
	reasoningExpanded?: boolean;
	/** Ignored in the reader UI. Fallback detail lives on DEV routing / logs. */
	plannerNote?: string;
	/** DEV-only planner routing trace (attempts / failures / used model). */
	routing?: AskPlannerRoutingView;
	/** DEV-only rerank / thinking trace. */
	debug?: AskDebugView;
	/** Rescorer was unavailable — results are in search order without a briefing. */
	rankedBySearchOnly?: boolean;
	/** Deep Research turn (separate daily quota). */
	research?: boolean;
	researchJobId?: string;
	researchStartedAt?: number;
	verifyNote?: string;
	onTrack?: boolean;
	progressNote?: string;
	processNotes?: string[];
	/** Markdown research document. */
	report?: string;
	researchClarify?: {
		id: string;
		questions: ResearchClarifyQuestion[];
		answers: Record<string, { choiceId: string; otherText?: string }>;
	};
	researchDeclined?: {
		kind: string;
		message: string;
	};
}

interface AiModelsResponse {
	success: boolean;
	configured: boolean;
	defaultModel: string;
	showModelPicker: boolean;
	models: { id: string; name: string; contextLength: number }[];
}

interface AiAskQuotaView {
	signedIn: boolean;
	used: number;
	limit: number;
	remaining: number;
	allowed: boolean;
	offerFeedback: boolean;
	feedbackClaimed: boolean;
	day: string;
	needsEmailVerification?: boolean;
}

interface AiAskEvent {
	type?: string;
	phase?: string;
	delta?: string;
	lookingFor?: string;
	queries?: string[];
	fallbackQueries?: string[];
	offTopic?: boolean;
	results?: AiDiscourseHit[];
	model?: string;
	error?: string;
	requestId?: string;
	correctedQuestion?: string;
	question?: string;
	degraded?: boolean;
	summary?: string;
	shareSlug?: string;
	reranked?: boolean;
	candidateCount?: number;
	showCount?: number;
	persons?: AiAskPersonHit[];
	quota?: AiAskQuotaView;
	plannerNote?: string;
	routing?: AskPlannerRoutingView;
	debug?: AskDebugView;
	/** Ranked hits shipped before the thinking writer finishes. */
	partial?: boolean;
	/** Replace streamed thinking with the accepted planner’s reasoning. */
	reasoning?: string;
	/** Drop thinking from a discarded planner attempt. */
	reset?: boolean;
}

/** Keep the turn when the stream dies after ranked hits (or an off-topic plan) arrived. */
export function askShouldSurviveDisconnect(turn: {
	results: readonly unknown[];
	offTopic?: boolean;
}): boolean {
	return turn.offTopic === true || turn.results.length > 0;
}

/** Mirrors server AiAskPlannerRouting — only present in `astro dev`. */
export interface AskPlannerRoutingView {
	requested: string;
	/** Planned OpenRouter queue (may include models never called). */
	queue?: string[];
	/** Models actually invoked, in order. */
	attempts: string[];
	skippedCooldown: string[];
	failed: Array<{ model: string; status?: number; message: string }>;
	used: string;
	provider: "openrouter" | "gemini";
	degraded: boolean;
	degradedReason?: string;
	reranker?: string;
	writer?: string;
}

const MODEL_STORAGE_KEY = "ai-mode-model";
const ASK_HOME_HREF = "/search?mode=ask";
const RESEARCH_HOME_HREF = "/search?mode=research";

/** Filled thumbtack — reads clearly at small sizes. */
const PIN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M16 12V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>`;
const MORE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;

/** Provider status notes — not model reasoning. Hidden from “How it searched”. */
const ASK_REASONING_STATUS_LINE =
	/^\s*\((?:OpenRouter was busy|Rewritten with Gemini\.?|Results re-ranked with Gemini\.?)[^)]*\)\s*$/i;
/**
 * Schema field drafting (`queries: …`, `"lookingFor": …`) — instructions to
 * itself about the JSON shape, not reasoning for the reader. Prose that merely
 * starts with one of these words (“Queries should target…”) is kept.
 */
const ASK_REASONING_META_LINE =
	/^\s*[-*]?\s*"?(?:queries|fallbackQueries|correctedQuestion|displayQuestion|lookingFor|shareSlug|offTopic|personSlugs|rankingGuidance|coverage|followUpIntent|excludeSlugs|blacklist|usefulFallbackQueries|count|slugs|summary)"?\s*[:=]/i;
const ASK_REASONING_FORMAT_LINE =
	/^\s*(?:```|JSON\s*:?\s*$|Return JSON\b|Output JSON\b|\{|\}|\[|\])/i;

/**
 * Strip provider status and JSON/schema drafting. Keep the model’s actual
 * reasoning — readers found that the most useful part of the process.
 */
export function displayAskReasoning(
	raw: string | undefined,
	pending = false,
): string {
	const text = (raw || "").replace(/\r\n/g, "\n");
	if (!text.trim()) return "";
	const kept = text
		.split("\n")
		.filter((line) => {
			const trimmed = line.trim();
			if (!trimmed) return true;
			if (ASK_REASONING_STATUS_LINE.test(trimmed)) return false;
			if (ASK_REASONING_META_LINE.test(trimmed)) return false;
			if (ASK_REASONING_FORMAT_LINE.test(trimmed)) return false;
			return true;
		})
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	// While streaming, keep raw text so partial reasoning isn’t dropped mid-line.
	if (pending && !kept && text.trim()) return text.trim();
	return kept;
}

/**
 * Keep the process-box thinking in sync with the accepted planner:
 * stream deltas, drop discarded attempts, replace with plan.reasoning.
 */
export function mergeAskTurnReasoning(
	current: string,
	event: {
		type?: string;
		delta?: string;
		reset?: boolean;
		reasoning?: string;
	},
): string {
	if (event.type === "reasoning") {
		if (event.reset) return "";
		if (event.delta) return current + event.delta;
		return current;
	}
	if (event.type === "plan" && typeof event.reasoning === "string") {
		return event.reasoning;
	}
	return current;
}

export type AskProcessStepState = "todo" | "active" | "done";

export interface AskProcessStep {
	state: AskProcessStepState;
	text: string;
}

/** Compact process steps for the Ask UI (pending + finished). */
export function buildAskProcessSteps(input: {
	pending: boolean;
	phase: "rewrite" | "verify" | "search" | "rerank" | "review" | "answer" | "done";
	question: string;
	lookingFor?: string;
	queries?: readonly string[];
	offTopic?: boolean;
	candidateCount?: number;
	showCount?: number;
	resultCount?: number;
	research?: boolean;
	clarifyPending?: boolean;
	verifyNote?: string;
	onTrack?: boolean;
	progressNote?: string;
	processNotes?: readonly string[];
}): AskProcessStep[] {
	const question = (input.question || "").replace(/\s+/g, " ").trim();
	const looking = (input.lookingFor || "")
		.replace(/^looking for:\s*/i, "")
		.replace(/\s+/g, " ")
		.trim();
	const lookingSame =
		looking.toLowerCase() === question.toLowerCase() || looking.length > 80;
	const theme = looking && !lookingSame ? looking : "";
	const pool = Math.max(0, Math.floor(input.candidateCount || 0));
	const shown = Math.max(
		0,
		Math.floor(
			input.pending
				? input.showCount || 0
				: input.resultCount || input.showCount || 0,
		),
	);
	const phase = input.pending ? input.phase : "done";

	if (input.offTopic && phase === "done") {
		return [
			{
				state: "done",
				text: theme
					? theme
					: "Outside the early discourses — no library search",
			},
		];
	}

	const note = (input.progressNote || "").replace(/\s+/g, " ").trim();
	const requested = formatDirectDiscourseIds({
		question: input.question,
		queries: input.queries,
	});
	const understood: AskProcessStep =
		input.clarifyPending && phase === "rewrite"
			? { state: "active", text: "Understanding the research request…" }
			: phase === "rewrite"
			? {
					state: "active",
					text:
						note ||
						(input.research ? "Planning searches…" : "Understanding the question…"),
				}
			: {
					state: "done",
					text: theme ? `Understood · ${theme}` : "Understood the question",
				};

	const searchIdle = input.research ? "Search widely" : "Search the library";
	const searchActive = (() => {
		const requestBit = requested ? `Requesting ${requested}` : "";
		if (note && /^(reading|reviewing)\b/i.test(note)) return note;
		if (note) {
			return requestBit ? `${requestBit} · ${note}` : note;
		}
		if (requestBit) {
			return input.research
				? requestBit
				: `${requestBit} · searching the library…`;
		}
		return input.research ? "Searching widely…" : "Searching the library…";
	})();
	const searchDone = (() => {
		const found = pool > 0 ? pool : shown;
		if (found <= 0) {
			return input.research ? "Searched widely" : "Searched the library";
		}
		if (input.research) {
			const noun = found === 1 ? "discourse match" : "discourse matches";
			return `Searched widely, found ${found.toLocaleString()} ${noun}`;
		}
		return `Searched the library · ${found.toLocaleString()} discourses`;
	})();
	const searched: AskProcessStep =
		phase === "rewrite" || phase === "verify"
			? { state: "todo", text: searchIdle }
			: phase === "search"
				? { state: "active", text: searchActive }
				: {
						state: "done",
						text: searchDone,
					};

	// Ranking the search pool and showing the final picks are two
	// distinct moments. The strip carries the rank; the “Showing N” caption
	// sits with the answer (see askResultsCaption).
	const alreadyCrunched = input.research === true && shown > 0;
	let crunched: AskProcessStep;
	if (
		phase === "rewrite" ||
		phase === "verify" ||
		(phase === "search" && !alreadyCrunched)
	) {
		crunched = {
			state: "todo",
			text: input.research ? "Rank and pick" : "Crunch the candidates",
		};
	} else if (phase === "rerank") {
		crunched = {
			state: "active",
			text:
				note ||
				(pool > 0
					? input.research
						? `Ranking ${pool.toLocaleString()} discourses…`
						: `Crunching ${pool.toLocaleString()} discourses…`
					: input.research
						? "Ranking discourses…"
						: "Crunching discourses…"),
		};
	} else if (shown > 0) {
		crunched = {
			state: "done",
			text: input.research
				? `Ranked and picked ${shown.toLocaleString()} discourses`
				: `Picked ${shown.toLocaleString()} discourses`,
		};
	} else {
		crunched = { state: "done", text: "No matching discourses" };
	}

	const prefix: AskProcessStep[] = [understood];
	const hopSteps: AskProcessStep[] = researchProcessHopLabels(
		input.processNotes,
		input.pending ? note : undefined,
	).map((text) => ({ state: "done", text }));

	if (phase === "done") {
		if (!input.research) return [...prefix, searched, crunched];
		return [
			...prefix,
			searched,
			crunched,
			{ state: "done", text: "Reviewed the evidence" },
			...hopSteps,
			{ state: "done", text: "Wrote the report" },
		];
	}
	const writeStep: AskProcessStep =
		phase === "answer"
			? {
					state: "active",
					text:
						note ||
						(input.research
							? "Writing the report…"
							: "Writing from the selected discourses…"),
				}
			: input.research
				? { state: "todo", text: "Write the report" }
				: { state: "todo", text: "Show the best matches" };
	if (!input.research) return [...prefix, searched, crunched, writeStep];
	const reviewed: AskProcessStep =
		phase === "review"
			? {
					state: "active",
					text: note || "Reviewing the evidence…",
				}
			: phase === "answer" || (phase === "search" && alreadyCrunched)
				? { state: "done", text: "Reviewed the evidence" }
				: { state: "todo", text: "Review evidence" };
	if (reviewed.state === "todo") {
		return [...prefix, searched, crunched, reviewed, writeStep];
	}
	return [...prefix, searched, crunched, reviewed, ...hopSteps, writeStep];
}

/** Caption shown with the answer once results are in (“Showing 12 discourses”). */
export function askResultsCaption(input: {
	resultCount: number;
	candidateCount?: number;
	research?: boolean;
}): string {
	const shown = Math.max(0, Math.floor(input.resultCount || 0));
	if (shown === 0) return "";
	const pool = Math.max(0, Math.floor(input.candidateCount || 0));
	const noun = `discourse${shown === 1 ? "" : "s"}`;
	if (input.research) {
		return pool > shown
			? `Sources · ${shown} ${noun} · picked from ${pool.toLocaleString()}`
			: `Sources · ${shown} ${noun}`;
	}
	return pool > shown
		? `Showing ${shown} ${noun} · picked from ${pool.toLocaleString()}`
		: `Showing ${shown} ${noun}`;
}

/** Collapsed-by-default source list for Ask matches and research reports. */
export function researchSourcesBlockHtml(
	caption: string,
	hitsHtml: string,
): string {
	const label = (caption || "").trim();
	const body = (hitsHtml || "").trim();
	if (!label || !body) return body;
	return `<details class="ai-sources"><summary>${label}</summary><div class="ai-hits">${body}</div></details>`;
}

/** Compact DEV line: which planner models were actually called and which answered. */
export function formatAskRoutingDevHtml(
	routing: AskPlannerRoutingView | undefined,
): string {
	if (!routing) return "";
	const called = routing.attempts.length
		? routing.attempts.map(shortModelId).join(" → ")
		: "(none)";
	const skipped =
		routing.skippedCooldown.length > 0
			? ` · skipped ${routing.skippedCooldown.map(shortModelId).join(", ")}`
			: "";
	const failed =
		routing.failed.length > 0
			? ` · failed ${routing.failed
					.map((item) => {
						const id = shortModelId(item.model);
						if (item.status) return `${id} ${item.status}`;
						if (/unusable/i.test(item.message)) return `${id} unusable`;
						return id;
					})
					.join(", ")}`
			: "";
	const degraded = routing.degraded
		? ` · simplified${routing.degradedReason ? ` (${routing.degradedReason})` : ""}`
		: "";
	const rerank = routing.reranker
		? ` · rerank ${shortModelId(routing.reranker)}`
		: "";
	const writer = routing.writer
		? ` · write ${shortModelId(routing.writer)}`
		: "";
	const text = `DEV · called ${called}${skipped}${failed} → planner ${shortModelId(routing.used)} (${routing.provider})${rerank}${writer}${degraded}`;
	return `<p class="ai-dev-routing" title="Planner routing (astro dev only)">${escapeHtml(text)}</p>`;
}

function shortModelId(id: string): string {
	const trimmed = (id || "").trim();
	if (!trimmed) return "?";
	// "nvidia/nemotron-3-ultra…:free + gemini-rerank" → keep readable tail
	return trimmed
		.split(" + ")
		.map((part) => {
			const bare = part.replace(/:free$/i, "");
			const slash = bare.lastIndexOf("/");
			return slash >= 0 ? bare.slice(slash + 1) : bare;
		})
		.join(" + ");
}

function processStepsHtml(
	steps: readonly AskProcessStep[],
	options: { afterFirst?: string; footer?: string } = {},
): string {
	if (steps.length === 0) return "";
	const items = steps
		.map((step, index) => {
			const mark =
				step.state === "done" ? "✓" : step.state === "active" ? "●" : "○";
			const row = `<li class="is-${step.state}"><span class="ai-process-mark" aria-hidden="true">${mark}</span><span>${escapeHtml(step.text)}</span></li>`;
			return index === 0 && options.afterFirst
				? `${row}${options.afterFirst}`
				: row;
		})
		.join("");
	const footer = options.footer
		? `<li class="ai-process-dev">${options.footer}</li>`
		: "";
	return `<ol class="ai-process" aria-label="How this Ask worked">${items}${footer}</ol>`;
}

/** Visual lines shown in the clamped “Understood” thinking pane. */
export const ASK_REASONING_CLAMP_LINES = 5;

/** Approximate count of visual lines a reasoning block would need. */
export function askReasoningIsLong(
	text: string,
	lineLimit = ASK_REASONING_CLAMP_LINES,
): boolean {
	const lines = text.split("\n");
	if (lines.length > lineLimit) return true;
	return text.length > lineLimit * 110;
}

/** Scroll a clamped thinking pane so the latest lines stay visible. */
export function pinClampedAskThinking(root: ParentNode): void {
	root
		.querySelectorAll<HTMLElement>(
			".ai-process-thinking.is-clamped .ai-process-thinking-text",
		)
		.forEach((el) => {
			el.scrollTop = el.scrollHeight;
		});
}

function inlineThinkingHtml(escaped: string): string {
	return escaped
		.replace(/`([^`\n]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
		.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
}

/**
 * Light, safe renderer for model thinking: paragraphs, bullet / numbered
 * lists, `code`, **bold**, *italic*, and `### headings` as bold lines. Text is
 * escaped first; no raw HTML from the model ever reaches the page.
 */
export function renderAskThinkingHtml(text: string): string {
	const normalized = text.replace(/\r\n/g, "\n").trim();
	if (!normalized) return "";
	const blocks = normalized.split(/\n{2,}/);
	const out: string[] = [];
	for (const block of blocks) {
		const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
		if (lines.length === 0) continue;
		const bullet = lines.every((line) => /^[-*•]\s+/.test(line));
		const numbered = lines.every((line) => /^\d+[.)]\s+/.test(line));
		if (bullet || numbered) {
			const items = lines
				.map((line) => line.replace(bullet ? /^[-*•]\s+/ : /^\d+[.)]\s+/, ""))
				.map((line) => `<li>${inlineThinkingHtml(escapeHtml(line))}</li>`)
				.join("");
			out.push(bullet ? `<ul>${items}</ul>` : `<ol>${items}</ol>`);
			continue;
		}
		const rendered = lines
			.map((line) => {
				const heading = line.match(/^#{1,6}\s+(.*)$/);
				if (heading) {
					return `<strong>${inlineThinkingHtml(escapeHtml(heading[1] || ""))}</strong>`;
				}
				return inlineThinkingHtml(escapeHtml(line));
			})
			.join("<br>");
		out.push(`<p>${rendered}</p>`);
	}
	return out.join("");
}

function renderAskThinkingItemHtml(input: {
	reasoningText: string;
	pending: boolean;
	reasoningExpanded?: boolean;
	degradedNote?: string;
	turnIndex: number;
}): string {
	const degradedNote = input.degradedNote || "";
	if (!input.reasoningText) {
		if (!degradedNote) return "";
		return `<li class="ai-process-thinking" aria-label="Model notes">
				<span class="ai-process-mark" aria-hidden="true"></span>
				<div class="ai-process-thinking-body">${degradedNote}</div>
			</li>`;
	}
	const clampable =
		!input.reasoningExpanded && askReasoningIsLong(input.reasoningText);
	const expanded = Boolean(input.reasoningExpanded);
	const toggle = askReasoningIsLong(input.reasoningText)
		? `<button type="button" class="ai-process-thinking-toggle" data-ai-toggle-thinking data-turn-index="${input.turnIndex}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "Show less" : "Show all thinking"}</button>`
		: "";
	return `<li class="ai-process-thinking${input.pending ? " is-live" : ""}${clampable ? " is-clamped" : ""}${expanded ? " is-expanded" : ""}" aria-label="Model thinking">
				<span class="ai-process-mark" aria-hidden="true"></span>
				<div class="ai-process-thinking-body">
					<div class="ai-process-thinking-text">${renderAskThinkingHtml(input.reasoningText)}</div>
					${toggle}
				</div>
			</li>`;
}

/**
 * Update the live thinking pane in place. Replacing the whole thread with
 * innerHTML on every reasoning token detaches earlier turns and clears the
 * reader’s text selection.
 */
export function applyAskThinkingStreamPatch(
	thread: ParentNode,
	turn: Pick<
		AiAskTurn,
		"pending" | "reasoning" | "reasoningExpanded"
	>,
	turnIndex: number,
): boolean {
	const section = thread.querySelectorAll(":scope > .ai-turn")[turnIndex];
	if (!section) return false;
	const process = section.querySelector(".ai-process");
	if (!process) return false;

	const reasoningText = displayAskReasoning(turn.reasoning, turn.pending);
	if (!reasoningText) {
		process.querySelector(":scope > .ai-process-thinking")?.remove();
		return true;
	}

	let thinkingEl = process.querySelector(":scope > .ai-process-thinking");
	if (!thinkingEl) {
		const first = process.querySelector(":scope > li");
		if (!first) return false;
		first.insertAdjacentHTML(
			"afterend",
			renderAskThinkingItemHtml({
				reasoningText,
				pending: turn.pending,
				reasoningExpanded: turn.reasoningExpanded,
				turnIndex,
			}),
		);
		section.querySelector(".ai-skel")?.remove();
		pinClampedAskThinking(section);
		return true;
	}

	thinkingEl.classList.toggle("is-live", Boolean(turn.pending));
	thinkingEl.classList.toggle(
		"is-clamped",
		!turn.reasoningExpanded && askReasoningIsLong(reasoningText),
	);
	thinkingEl.classList.toggle("is-expanded", Boolean(turn.reasoningExpanded));
	thinkingEl.setAttribute("aria-label", "Model thinking");

	const body = thinkingEl.querySelector(".ai-process-thinking-body");
	if (!body) return false;

	let textEl = body.querySelector(".ai-process-thinking-text");
	if (!textEl) {
		textEl = section.ownerDocument.createElement("div");
		textEl.className = "ai-process-thinking-text";
		const existingToggle = body.querySelector("[data-ai-toggle-thinking]");
		if (existingToggle) body.insertBefore(textEl, existingToggle);
		else body.append(textEl);
	}
	const nextHtml = renderAskThinkingHtml(reasoningText);
	if (textEl.innerHTML !== nextHtml) {
		textEl.innerHTML = nextHtml;
	}

	if (askReasoningIsLong(reasoningText)) {
		const expanded = Boolean(turn.reasoningExpanded);
		const label = expanded ? "Show less" : "Show all thinking";
		let toggle = body.querySelector("[data-ai-toggle-thinking]");
		if (!toggle) {
			body.insertAdjacentHTML(
				"beforeend",
				`<button type="button" class="ai-process-thinking-toggle" data-ai-toggle-thinking data-turn-index="${turnIndex}" aria-expanded="${expanded ? "true" : "false"}">${label}</button>`,
			);
		} else {
			toggle.setAttribute("data-turn-index", String(turnIndex));
			toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
			if (toggle.textContent !== label) toggle.textContent = label;
		}
	}

	pinClampedAskThinking(section);
	return true;
}

export function askProcessStepsFromTurn(
	turn: Pick<
		AiAskTurn,
		| "pending"
		| "phase"
		| "question"
		| "lookingFor"
		| "queries"
		| "offTopic"
		| "rerankCandidateCount"
		| "rerankShowCount"
		| "results"
		| "research"
		| "researchJobId"
		| "verifyNote"
		| "onTrack"
		| "progressNote"
		| "processNotes"
	>,
): AskProcessStep[] {
	return buildAskProcessSteps({
		pending: turn.pending,
		phase: turn.phase,
		question: turn.question,
		lookingFor: turn.lookingFor,
		queries: turn.queries,
		offTopic: turn.offTopic,
		candidateCount: turn.rerankCandidateCount,
		showCount: turn.rerankShowCount,
		resultCount: turn.results.length,
		research: turn.research === true,
		clarifyPending:
			turn.research === true && turn.pending && !turn.researchJobId,
		verifyNote: turn.verifyNote,
		onTrack: turn.onTrack,
		progressNote: turn.progressNote,
		processNotes: turn.processNotes,
	});
}

function processStatusLis(process: Element): HTMLElement[] {
	return [...process.querySelectorAll<HTMLElement>(":scope > li")].filter(
		(li) =>
			!li.classList.contains("ai-process-thinking") &&
			!li.classList.contains("ai-process-dev"),
	);
}

/**
 * Update process-step labels and live thinking without replacing the thread.
 * Research polls used to innerHTML + scrollIntoView every 1.5s, which yanked
 * the page back to the turn while the reader was scrolling.
 */
export function applyAskProcessStreamPatch(
	thread: ParentNode,
	turn: Pick<
		AiAskTurn,
		| "pending"
		| "phase"
		| "question"
		| "lookingFor"
		| "queries"
		| "offTopic"
		| "rerankCandidateCount"
		| "rerankShowCount"
		| "results"
		| "research"
		| "researchJobId"
		| "verifyNote"
		| "onTrack"
		| "progressNote"
		| "processNotes"
		| "reasoning"
		| "reasoningExpanded"
	>,
	turnIndex: number,
): boolean {
	const section = thread.querySelectorAll(":scope > .ai-turn")[turnIndex];
	if (!section) return false;
	const process = section.querySelector(".ai-process");
	if (!process) return false;

	const steps = askProcessStepsFromTurn(turn);
	const stepLis = processStatusLis(process);
	if (stepLis.length !== steps.length) return false;

	steps.forEach((step, index) => {
		const li = stepLis[index];
		if (!li) return;
		li.classList.remove("is-todo", "is-active", "is-done");
		li.classList.add(`is-${step.state}`);
		const mark = li.querySelector(".ai-process-mark");
		if (mark) {
			mark.textContent =
				step.state === "done" ? "✓" : step.state === "active" ? "●" : "○";
		}
		const text = li.querySelector("span:not(.ai-process-mark)");
		if (text && text.textContent !== step.text) text.textContent = step.text;
	});

	return applyAskThinkingStreamPatch(thread, turn, turnIndex);
}

function isClientFreeModelId(id: string): boolean {
	const trimmed = id.trim();
	if (!trimmed || trimmed.length > 200 || /\s/.test(trimmed)) return false;
	// Curated picker ids only — retired :free slugs in localStorage (e.g.
	// minimax/minimax-m3:free) 404 and burn the Ask on a dead planner.
	return (
		trimmed === "nvidia/nemotron-3-ultra-550b-a55b:free" ||
		trimmed === "nvidia/nemotron-3.5-lightning:free"
	);
}

/** Enter and Shift+Enter stay newlines. ⌘Enter (Mac) / Ctrl+Enter (elsewhere) sends. */
export function isAskSendShortcut(
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "altKey" | "isComposing"
	>,
): boolean {
	if (event.isComposing) return false;
	if (event.key !== "Enter") return false;
	if (event.altKey) return false;
	return event.metaKey === true || event.ctrlKey === true;
}

export function askSendShortcutLabel(
	platform = typeof navigator !== "undefined" ? navigator.platform : "",
): string {
	return /Mac|iPhone|iPad|iPod/i.test(platform || "")
		? "Send (⌘Enter)"
		: "Send (Ctrl+Enter)";
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function normalizeAskRouting(raw: unknown): AskPlannerRoutingView | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const requested =
		typeof record.requested === "string" ? record.requested.trim() : "";
	const used = typeof record.used === "string" ? record.used.trim() : "";
	if (!requested && !used) return undefined;
	const attempts = Array.isArray(record.attempts)
		? record.attempts.filter((item): item is string => typeof item === "string")
		: [];
	const skippedCooldown = Array.isArray(record.skippedCooldown)
		? record.skippedCooldown.filter(
				(item): item is string => typeof item === "string",
			)
		: [];
	const failed = Array.isArray(record.failed)
		? record.failed
				.map((item) => {
					if (!item || typeof item !== "object") return null;
					const row = item as Record<string, unknown>;
					if (typeof row.model !== "string" || !row.model.trim()) return null;
					return {
						model: row.model.trim(),
						...(typeof row.status === "number" ? { status: row.status } : {}),
						message:
							typeof row.message === "string" ? row.message : "error",
					};
				})
				.filter(
					(item): item is AskPlannerRoutingView["failed"][number] =>
						Boolean(item),
				)
		: [];
	const queue = Array.isArray(record.queue)
		? record.queue.filter((item): item is string => typeof item === "string")
		: undefined;
	const reranker =
		typeof record.reranker === "string" && record.reranker.trim()
			? record.reranker.trim()
			: undefined;
	const writer =
		typeof record.writer === "string" && record.writer.trim()
			? record.writer.trim()
			: undefined;
	const degradedReason =
		typeof record.degradedReason === "string" && record.degradedReason.trim()
			? record.degradedReason.trim()
			: undefined;
	return {
		requested,
		...(queue ? { queue } : {}),
		attempts,
		skippedCooldown,
		failed,
		used,
		provider: record.provider === "gemini" ? "gemini" : "openrouter",
		degraded: record.degraded === true,
		...(degradedReason ? { degradedReason } : {}),
		...(reranker ? { reranker } : {}),
		...(writer ? { writer } : {}),
	};
}

function asFiniteInt(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	return Math.max(0, Math.floor(value));
}

function normalizeAskDebug(raw: unknown): AskDebugView | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const record = raw as Record<string, unknown>;
	const limit = asFiniteInt(record.limit);
	const reasoningChars = asFiniteInt(record.reasoningChars);
	const planningNotesChars = asFiniteInt(record.planningNotesChars);
	const rankingGuidanceChars = asFiniteInt(record.rankingGuidanceChars);
	if (
		limit === undefined ||
		reasoningChars === undefined ||
		planningNotesChars === undefined ||
		rankingGuidanceChars === undefined
	) {
		return undefined;
	}
	const namedTermQueries = Array.isArray(record.namedTermQueries)
		? record.namedTermQueries.filter(
				(item): item is string => typeof item === "string" && Boolean(item.trim()),
			)
		: [];
	const dropped = Array.isArray(record.dropped)
		? record.dropped.flatMap((item) => {
				if (!item || typeof item !== "object") return [];
				const row = item as Record<string, unknown>;
				if (typeof row.slug !== "string" || !row.slug.trim()) return [];
				const rank = asFiniteInt(row.rank);
				if (rank === undefined) return [];
				return [
					{
						slug: row.slug.trim(),
						rank,
						snippet: row.snippet === true,
					},
				];
			})
		: [];
	const coverage =
		typeof record.coverage === "string" && record.coverage.trim()
			? record.coverage.trim()
			: undefined;
	const rankingGuidancePreview =
		typeof record.rankingGuidancePreview === "string" &&
		record.rankingGuidancePreview.trim()
			? record.rankingGuidancePreview.trim()
			: undefined;
	return {
		...(coverage ? { coverage } : {}),
		limit,
		reasoningChars,
		planningNotesChars,
		rankingGuidanceChars,
		...(rankingGuidancePreview ? { rankingGuidancePreview } : {}),
		namedTermQueries,
		namedTermHits: asFiniteInt(record.namedTermHits) ?? 0,
		namedTermKept: asFiniteInt(record.namedTermKept) ?? 0,
		dropped,
		droppedMore: asFiniteInt(record.droppedMore) ?? 0,
	};
}

function stripHtml(value: string): string {
	return value.replace(/<[^>]*>/g, "");
}

interface BrowserSpeechRecognition {
	lang: string;
	interimResults: boolean;
	continuous: boolean;
	onresult: ((event: { results: ArrayLike<SpeechTranscriptResult> }) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

function speechRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
	const w = window as Window & {
		SpeechRecognition?: new () => BrowserSpeechRecognition;
		webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
	};
	return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function fitTextarea(el: HTMLTextAreaElement): void {
	el.style.height = "auto";
	el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), 160)}px`;
}

function fitClarifyOther(el: HTMLTextAreaElement): void {
	el.style.height = "auto";
	const line = 16 * 1.45;
	const pad = 1.1 * 16;
	const cap = line * 6 + pad;
	el.style.height = `${Math.min(el.scrollHeight, cap)}px`;
}

function skeletonHtml(): string {
	return `<div class="ai-skel" aria-hidden="true">
		<div class="ai-skel-card"></div>
		<div class="ai-skel-card"></div>
		<div class="ai-skel-card"></div>
	</div>`;
}

function turnToSessionEntry(
	turn: AiAskTurn,
	options?: { thread?: AiAskSessionEntry[] },
): AiAskSessionEntry {
	const thread =
		options?.thread && options.thread.length > 1
			? options.thread
			: undefined;
	return {
		question: turn.question,
		...(turn.originalQuestion && turn.originalQuestion !== turn.question
			? { originalQuestion: turn.originalQuestion }
			: {}),
		lookingFor: turn.lookingFor,
		queries: turn.queries,
		fallbackQueries: turn.fallbackQueries,
		offTopic: turn.offTopic,
		results: turn.results,
		...(turn.persons && turn.persons.length > 0
			? { persons: turn.persons }
			: {}),
		model: turn.model,
		reasoning: turn.reasoning,
		...(turn.summary ? { summary: turn.summary } : {}),
		...(turn.report ? { report: turn.report } : {}),
		...(turn.shareSlug ? { shareSlug: turn.shareSlug } : {}),
		at: Date.now(),
		...(turn.requestId ? { requestId: turn.requestId } : {}),
		...(turn.feedback === "up" || turn.feedback === "down"
			? { feedback: turn.feedback }
			: {}),
		saved: turn.saved === true,
		...(typeof turn.rerankCandidateCount === "number" &&
		turn.rerankCandidateCount > 0
			? { candidateCount: turn.rerankCandidateCount }
			: {}),
		...(thread ? { thread } : {}),
		...(turn.research ? { research: true } : {}),
		...(turn.researchJobId ? { researchJobId: turn.researchJobId } : {}),
		...(turn.processNotes && turn.processNotes.length > 0
			? { processNotes: turn.processNotes }
			: {}),
	};
}

function sessionEntryToTurn(entry: AiAskSessionEntry): AiAskTurn {
	return {
		question: entry.question,
		originalQuestion: entry.originalQuestion || entry.question,
		lookingFor: entry.lookingFor,
		queries: entry.queries || [],
		fallbackQueries: entry.fallbackQueries || [],
		offTopic: entry.offTopic === true,
		results: entry.results || [],
		persons: sanitizeAskPersonHits(entry.persons),
		model: entry.model || "",
		reasoning: entry.reasoning || "",
		summary: entry.summary || "",
		report: entry.report || "",
		shareSlug: entry.shareSlug,
		sharePath: entry.shareSlug
			? askSharePath(entry.shareSlug, { research: entry.research === true })
			: undefined,
		pending: entry.researchPending === true,
		phase: entry.researchPending === true ? "search" : "done",
		...(typeof entry.candidateCount === "number" && entry.candidateCount > 0
			? {
					rerankCandidateCount: entry.candidateCount,
					rerankShowCount: entry.results?.length || undefined,
				}
			: {}),
		fromCache: true,
		requestId: entry.requestId,
		feedback: entry.feedback === "up" || entry.feedback === "down"
			? entry.feedback
			: undefined,
		saved: entry.saved === true,
		...(entry.research ? { research: true } : {}),
		...(entry.researchJobId ? { researchJobId: entry.researchJobId } : {}),
		...(entry.research && entry.at ? { researchStartedAt: entry.at } : {}),
		...(entry.processNotes && entry.processNotes.length > 0
			? { processNotes: entry.processNotes }
			: {}),
	};
}

function shareTurnToAiAskTurn(
	turn: AiAskShareTurn,
	share: AiAskShareSnapshot,
): AiAskTurn {
	return {
		question: turn.question,
		originalQuestion: turn.question,
		lookingFor: turn.lookingFor,
		queries: turn.queries,
		fallbackQueries: turn.fallbackQueries,
		offTopic: false,
		results: turn.results,
		model: turn.model,
		reasoning: turn.reasoning || "",
		summary: turn.summary,
		shareSlug: share.slug,
		sharePath: askSharePath(share.slug, {
			research: share.research === true || turn.research === true,
		}),
		fromShare: true,
		fromSample: false,
		pending: false,
		phase: "done",
		requestId: turn.requestId,
		...(typeof turn.candidateCount === "number" && turn.candidateCount > 0
			? {
					rerankCandidateCount: turn.candidateCount,
					rerankShowCount: turn.results.length,
				}
			: {}),
		...(turn.research || turn.report ? { research: true } : {}),
		...(turn.report ? { report: turn.report } : {}),
	};
}

function sampleToAiAskTurn(sample: AiAskSamplePublic): AiAskTurn {
	const turn = shareTurnToAiAskTurn(sampleToShareTurn(sample), {
		slug: sample.slug,
		question: sample.question,
		lookingFor: sample.lookingFor,
		queries: sample.queries,
		fallbackQueries: sample.fallbackQueries,
		summary: sample.summary,
		results: sample.results,
		model: sample.model,
		createdAt: sample.updatedAt,
		...(sample.requestId ? { requestId: sample.requestId } : {}),
	});
	turn.fromShare = false;
	turn.fromSample = true;
	turn.sampleSlug = sample.slug;
	turn.shareSlug = undefined;
	turn.sharePath = undefined;
	if (sample.processNotes && sample.processNotes.length > 0) {
		turn.processNotes = sample.processNotes;
	}
	return turn;
}

function applyCorrectedQuestion(turn: AiAskTurn, event: AiAskEvent): void {
	const corrected = (event.correctedQuestion || event.question || "")
		.replace(/\s+/g, " ")
		.trim();
	if (!corrected) return;
	if (!turn.originalQuestion) turn.originalQuestion = turn.question;
	turn.question = corrected;
}

/** Pull complete `data:` frames out of an SSE buffer. */
export function takeAskSseEvents(
	buffer: string,
	includeTail = false,
): { events: AiAskEvent[]; rest: string } {
	const parts = buffer.split("\n\n");
	const rest = includeTail ? "" : parts.pop() || "";
	const events: AiAskEvent[] = [];
	for (const part of parts) {
		const data = part
			.split("\n")
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).trim())
			.join("");
		if (!data) continue;
		try {
			events.push(JSON.parse(data) as AiAskEvent);
		} catch {
			/* skip malformed */
		}
	}
	return { events, rest };
}

async function readSseEvents(
	response: Response,
	onEvent: (event: AiAskEvent) => void,
): Promise<void> {
	if (!response.body) {
		throw new Error("No response body");
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const emit = (chunk: string, includeTail: boolean) => {
		const taken = takeAskSseEvents(chunk, includeTail);
		buffer = taken.rest;
		for (const event of taken.events) onEvent(event);
	};
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				emit(buffer + decoder.decode(), true);
				return;
			}
			emit(buffer + decoder.decode(value, { stream: true }), false);
		}
	} catch (error) {
		emit(buffer + decoder.decode(), true);
		throw error;
	}
}

export function attachAiMode(options: {
	root: HTMLElement;
	showModelPicker: boolean;
	defaultModel: string;
	shareMode?: boolean;
	shareSnapshot?: string;
}): void {
	const {
		root,
		showModelPicker,
		defaultModel,
		shareMode = false,
		shareSnapshot = "",
	} = options;
	const form = root.querySelector<HTMLFormElement>("[data-ai-form]");
	const followForm = root.querySelector<HTMLFormElement>("[data-ai-follow-form]");
	const clarifyBar = root.querySelector<HTMLElement>("[data-ai-clarify-bar]");
	const clarifyStartBtn = root.querySelector<HTMLButtonElement>("[data-ai-clarify-start]");
	const clarifyCancelBtn = root.querySelector<HTMLButtonElement>("[data-ai-clarify-cancel]");
	const input = root.querySelector<HTMLTextAreaElement>("[data-ai-input]");
	const followInput = root.querySelector<HTMLTextAreaElement>("[data-ai-follow-input]");
	const modelSelect = root.querySelector<HTMLSelectElement | HTMLInputElement>(
		"[data-ai-model]",
	);
	const thread = root.querySelector<HTMLElement>("[data-ai-thread]");
	const empty = root.querySelector<HTMLElement>("[data-ai-empty]");
	const historyEl = root.querySelector<HTMLElement>("[data-ai-history]");
	const composer = root.querySelector<HTMLElement>("[data-ai-composer]");
	const statuses = [...root.querySelectorAll<HTMLElement>("[data-ai-status]")];
	const meterEls = [...root.querySelectorAll<HTMLElement>("[data-ai-meter]")];
	const quotaDialog = root.querySelector<HTMLElement>("[data-ai-quota-dialog]");
	const confirmDialog = root.querySelector<HTMLElement>("[data-ai-confirm-dialog]");
	const feedbackDialog = root.querySelector<HTMLElement>("[data-ai-feedback-dialog]");
	const feedbackText = root.querySelector<HTMLTextAreaElement>("[data-ai-feedback-text]");
	const feedbackError = root.querySelector<HTMLElement>("[data-ai-feedback-error]");
	const micButtons = [
		...root.querySelectorAll<HTMLButtonElement>("[data-ai-mic]"),
	];
	if (!form || !input || !thread || !empty || !composer) return;
	installDiscourseCitationPopovers(thread);

	function setRestoringResearch(on: boolean): void {
		root.classList.toggle("is-restoring-research", on);
	}

	if (
		!shareMode &&
		askResearchJobParam(window.location.search)
	) {
		setRestoringResearch(true);
	}

	let turns: AiAskTurn[] = [];
	let sessionEntries = readAiAskSession();
	let quota: AiAskQuotaView | null = null;
	let researchQuota: ResearchQuotaView | null = null;
	let isAskAdmin = false;
	let askSamples: AiAskSamplePublic[] = [];
	let hiddenSampleKeys = readHiddenAskSampleKeys(
		typeof localStorage === "undefined" ? null : localStorage,
	);
	let signedInForHistory = false;
	let pendingReplaceQuestions: string[] | null = null;
	let pendingReplaceJobIds: string[] | null = null;
	let applyingAskSurfaceUrl = false;
	let busy = false;
	let researchChipOn = false;
	let researchPollTimer = 0;

	function researchPaneOn(): boolean {
		return (
			isAskResearchEnabled() &&
			isResearchSearchMode(window.location.search)
		);
	}

	function historyLane(): AiAskSessionEntry[] {
		return askHistoryLaneEntries(sessionEntries, researchPaneOn());
	}

	function findLaneEntry(
		question: string,
		jobId?: string,
	): AiAskSessionEntry | undefined {
		if (jobId) {
			const byJob = findAiAskSessionEntry(sessionEntries, question, {
				research: researchPaneOn(),
				researchJobId: jobId,
			});
			if (byJob) return byJob;
		}
		return findAiAskSessionEntry(sessionEntries, question, {
			research: researchPaneOn(),
		});
	}
	let researchPollToken = 0;
	let samplePlaybackTimer = 0;
	let samplePlaybackToken = 0;
	const watchingResearchJobs = new Set<string>();
	let feedbackPromptShown = false;
	let feedbackHintTimer = 0;
	let listening = false;
	let listenTarget: HTMLTextAreaElement | null = null;
	let voiceBase = "";
	let recognition: BrowserSpeechRecognition | null = null;
	let selectedModel = defaultModel;
	const SHARE_LINK_IDLE_HTML =
		'<span class="ai-share-label-full">Share link</span><span class="ai-share-label-short">Share</span>';

	if (showModelPicker) {
		try {
			const stored = localStorage.getItem(MODEL_STORAGE_KEY);
			if (stored && isClientFreeModelId(stored)) selectedModel = stored;
		} catch {
			/* ignore */
		}
	}

	function setStatus(text: string): void {
		statuses.forEach((el) => {
			el.textContent = text;
			el.hidden = !text;
		});
	}

	function currentReturnTo(): string {
		return `${window.location.pathname}${window.location.search}`;
	}

	function signInHref(question?: string | null): string {
		return askAuthPageHref("/signin", question, currentReturnTo());
	}

	function registerHref(question?: string | null): string {
		return askAuthPageHref("/register", question, currentReturnTo());
	}

	function applyQuota(
		next: AiAskQuotaView | null | undefined,
		nextResearch?: ResearchQuotaView | null,
	): void {
		if (next) quota = next;
		if (nextResearch !== undefined) researchQuota = nextResearch;
		syncResearchChip();
	}

	function researchUiOn(): boolean {
		if (researchPaneOn() && turns.length === 0) {
			return Boolean(quota?.signedIn && !quota.needsEmailVerification);
		}
		if (!researchChipAvailable()) return false;
		if (researchChipOn) return true;
		const last = turns[turns.length - 1];
		return Boolean(
			last?.research &&
				(isClarifyingTurn(last) || (last.pending && last.research)),
		);
	}

	function renderMeters(): void {
		if (!quota?.signedIn) {
			meterEls.forEach((el) => {
				el.textContent = "";
				el.hidden = true;
			});
			return;
		}
		const last = turns[turns.length - 1];
		const researchRunning = turns.some(
			(turn) => turn.pending && turn.research && turn.researchJobId,
		);
		const label = askMeterLabel({
			signedIn: true,
			needsEmailVerification: quota.needsEmailVerification,
			researchOn: askComposerMeterIsResearch({
				chipOn: researchUiOn(),
				clarifying: isClarifyingTurn(last),
				researchPending: Boolean(
					last?.research && last.pending && last.researchJobId,
				),
			}),
			askRemaining: quota.remaining,
			researchRemaining: researchQuota?.remaining,
			hideResearchRemaining: researchRunning,
		});
		meterEls.forEach((el) => {
			el.textContent = label;
			el.hidden = !label;
		});
	}

	function optimisticConsumeQuota(): void {
		if (!quota || !quota.allowed) return;
		const used = quota.used + 1;
		applyQuota({
			...quota,
			used,
			remaining: Math.max(0, quota.limit - used),
			allowed: used < quota.limit,
		});
	}

	function optimisticConsumeResearchQuota(): void {
		if (!researchQuota || !researchQuota.allowed) return;
		const used = researchQuota.used + 1;
		applyQuota(quota, {
			...researchQuota,
			used,
			remaining: Math.max(0, researchQuota.limit - used),
			allowed: used < researchQuota.limit,
		});
	}

	function researchChipAvailable(): boolean {
		return canShowResearchChip({
			signedIn: quota?.signedIn,
			needsEmailVerification: quota?.needsEmailVerification,
			hasResearchQuota: Boolean(researchQuota),
		});
	}

	function lastTurnIsResearch(): boolean {
		return turns.some((turn) => turn.research === true);
	}

	function isClarifyingTurn(turn: AiAskTurn | undefined): boolean {
		return Boolean(
			turn?.research &&
				turn.researchClarify &&
				!turn.researchJobId &&
				!turn.researchDeclined &&
				!turn.pending,
		);
	}

	function researchFlowLocksChip(): boolean {
		const last = turns[turns.length - 1];
		if (!last?.research) return false;
		if (isClarifyingTurn(last)) return true;
		// Keep the chip on while questions are loading; once a job exists the
		// follow-up should be an ordinary Ask unless they turn Research on again.
		if (last.pending && last.research && !last.researchJobId) return true;
		return false;
	}

	function syncClarifyBar(): void {
		const last = turns[turns.length - 1];
		const clarifying = isClarifyingTurn(last);
		if (clarifyBar) clarifyBar.hidden = !clarifying;
		if (clarifying && last?.researchClarify && clarifyStartBtn) {
			const answers = answersFromClarifyState(last.researchClarify.answers);
			clarifyStartBtn.disabled = !canStartResearchClarify(
				last.researchClarify.questions,
				answers,
			);
			const left =
				typeof researchQuota?.remaining === "number"
					? researchQuota.remaining
					: undefined;
			clarifyStartBtn.textContent =
				typeof left === "number"
					? `Start research · ${left} left`
					: "Start research";
		}
	}

	function stopResearchPoll(): void {
		researchPollToken += 1;
		if (researchPollTimer) {
			window.clearTimeout(researchPollTimer);
			researchPollTimer = 0;
		}
	}

	function askSurfaceHistoryState(fromMenu: boolean): object {
		const prior =
			window.history.state && typeof window.history.state === "object"
				? window.history.state
				: {};
		return { ...prior, aiAskSurface: 1, fromMenu };
	}

	function askSurfaceCameFromMenu(): boolean {
		const state = window.history.state;
		return Boolean(
			state &&
				typeof state === "object" &&
				(state as { fromMenu?: boolean }).fromMenu === true,
		);
	}

	function currentAskSurfaceHref(input: {
		jobId?: string | null;
		open?: string | null;
		sample?: string | null;
	}): string {
		const params = withAskSurfaceParams(window.location.search, input);
		const qs = params.toString();
		return `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
	}

	function syncAskSurfaceUrl(input: {
		jobId?: string | null;
		open?: string | null;
		sample?: string | null;
		push?: boolean;
	}): void {
		if (shareMode || applyingAskSurfaceUrl) return;
		if (window.location.pathname.replace(/\/$/, "") !== "/search") return;
		const next = currentAskSurfaceHref({
			jobId: input.jobId,
			open: input.open,
			sample: input.sample,
		});
		const current =
			window.location.pathname + window.location.search + window.location.hash;
		const currentJob = askResearchJobParam(window.location.search);
		const currentOpen = askHistoryOpenParam(window.location.search);
		const currentSample = askSampleParam(window.location.search);
		const nextJob =
			input.jobId === undefined ? currentJob : (input.jobId || "").trim();
		const nextOpen =
			input.open === undefined ? currentOpen : (input.open || "").trim();
		const nextSample =
			input.sample === undefined
				? currentSample
				: (input.sample || "").replace(/\s+/g, "").trim().toLowerCase();
		const openingItem =
			Boolean(nextJob || nextOpen || nextSample) &&
			!currentJob &&
			!currentOpen &&
			!currentSample;
		const push = input.push === true || (input.push !== false && openingItem);
		if (next === current) {
			if (openingItem) {
				window.history.replaceState(askSurfaceHistoryState(true), "", next);
			}
			return;
		}
		if (push) {
			window.history.pushState(askSurfaceHistoryState(true), "", next);
			return;
		}
		window.history.replaceState(askSurfaceHistoryState(false), "", next);
	}

	function syncResearchJobUrl(jobId: string | null): void {
		syncAskSurfaceUrl({
			jobId,
			open: jobId ? null : undefined,
			sample: jobId ? null : undefined,
		});
	}

	function syncLimitsNotes(): void {
		const research = researchPaneOn();
		const note = research ? RESEARCH_LIMITS_NOTE : ASK_LIMITS_NOTE;
		root.querySelectorAll<HTMLElement>(".ai-limits-note").forEach((el) => {
			el.textContent = note;
		});
		const signin = root.querySelector<HTMLElement>("[data-ai-research-signin]");
		if (signin) {
			signin.hidden = !(
				research &&
				turns.length === 0 &&
				quota &&
				!quota.signedIn
			);
		}
	}

	function syncResearchChip(): void {
		const pane = researchPaneOn();
		const available = researchChipAvailable();
		const pressed = pane || (available && (researchChipOn || researchFlowLocksChip()));
		root.querySelectorAll<HTMLButtonElement>("[data-ai-research-chip]").forEach(
			(chip) => {
				chip.hidden = !available || pane;
				chip.title = RESEARCH_CHIP_TITLE;
				chip.setAttribute("aria-pressed", pressed ? "true" : "false");
				chip.classList.toggle("is-on", pressed && !pane);
			},
		);
		const placeholder = pane || pressed ? RESEARCH_PLACEHOLDER : ASK_PLACEHOLDER;
		if (input) input.placeholder = placeholder;
		const composerLabel = root.querySelector<HTMLLabelElement>(
			'label[for="ai-input"]',
		);
		if (composerLabel) {
			composerLabel.textContent = pane
				? RESEARCH_COMPOSER_LABEL
				: ASK_COMPOSER_LABEL;
		}
		root.querySelectorAll<HTMLButtonElement>("[data-ai-new]").forEach((button) => {
			button.textContent = pane ? RESEARCH_NEW_LABEL : ASK_NEW_LABEL;
		});
		if (followInput) {
			followInput.placeholder = askFollowPlaceholder({
				pending: turns.some((turn) => turn.pending),
				researchFollow: pressed && !pane ? true : pane && turns.length === 0,
			});
		}
		syncLimitsNotes();
		const researchBusy = turns.some(
			(turn) => turn.pending && turn.research && turn.researchJobId,
		);
		syncStopButtons(researchBusy);
		renderMeters();
	}

	function setResearchChipOn(next: boolean, persist = true): void {
		researchChipOn = next && researchChipAvailable();
		if (persist && researchChipAvailable()) {
			try {
				localStorage.setItem(
					RESEARCH_CHIP_STORAGE_KEY,
					researchChipOn ? "1" : "0",
				);
			} catch {
				/* ignore */
			}
		}
		syncResearchChip();
	}

	function loadResearchChipPreference(): void {
		try {
			researchChipOn = localStorage.getItem(RESEARCH_CHIP_STORAGE_KEY) === "1";
		} catch {
			researchChipOn = false;
		}
	}

	function closeQuotaDialog(): void {
		if (quotaDialog) quotaDialog.hidden = true;
	}

	let pendingConfirm: (() => void) | null = null;

	function closeConfirmDialog(): void {
		pendingConfirm = null;
		if (confirmDialog) confirmDialog.hidden = true;
	}

	function openConfirmDialog(
		title: string,
		body: string,
		onOk: () => void,
	): void {
		if (!confirmDialog) {
			onOk();
			return;
		}
		closeQuotaDialog();
		pendingConfirm = onOk;
		const titleEl = confirmDialog.querySelector<HTMLElement>(
			"[data-ai-confirm-title]",
		);
		const bodyEl = confirmDialog.querySelector<HTMLElement>(
			"[data-ai-confirm-body]",
		);
		if (titleEl) titleEl.textContent = title;
		if (bodyEl) bodyEl.textContent = body;
		confirmDialog.hidden = false;
	}

	function openQuotaDialog(
		kind: "signin" | "tomorrow" | "save" | "share" | "verify" | "research",
		question?: string | null,
	): void {
		if (!quotaDialog) return;
		closeConfirmDialog();
		const signin = quotaDialog.querySelector<HTMLElement>(
			'[data-ai-quota-panel="signin"]',
		);
		const tomorrow = quotaDialog.querySelector<HTMLElement>(
			'[data-ai-quota-panel="tomorrow"]',
		);
		const verify = quotaDialog.querySelector<HTMLElement>(
			'[data-ai-quota-panel="verify"]',
		);
		const research = quotaDialog.querySelector<HTMLElement>(
			'[data-ai-quota-panel="research"]',
		);
		const showSignin = kind === "signin" || kind === "save" || kind === "share";
		if (signin) signin.hidden = !showSignin;
		if (tomorrow) tomorrow.hidden = kind !== "tomorrow";
		if (verify) verify.hidden = kind !== "verify";
		if (research) research.hidden = kind !== "research";
		const title = quotaDialog.querySelector<HTMLElement>(
			"[data-ai-quota-signin-title]",
		);
		const body = quotaDialog.querySelector<HTMLElement>(
			"[data-ai-quota-signin-body]",
		);
		if (title && body) {
			if (kind === "save") {
				title.textContent = researchPaneOn()
					? RESEARCH_PIN_ACCOUNT_TITLE
					: ASK_PIN_ACCOUNT_TITLE;
				body.textContent = researchPaneOn()
					? RESEARCH_PIN_ACCOUNT_BODY
					: ASK_PIN_ACCOUNT_BODY;
			} else if (kind === "share") {
				title.textContent = researchPaneOn()
					? RESEARCH_SHARE_ACCOUNT_TITLE
					: ASK_SHARE_ACCOUNT_TITLE;
				body.textContent = researchPaneOn()
					? RESEARCH_SHARE_ACCOUNT_BODY
					: ASK_SHARE_ACCOUNT_BODY;
			} else if (kind === "signin" && researchPaneOn()) {
				title.textContent = RESEARCH_SIGNIN_TITLE;
				body.textContent = RESEARCH_SIGNIN_BODY;
			} else {
				title.textContent = "You’ve used today’s free Asks";
				body.textContent =
					"Create a free account for more Asks today. You’ll also keep recent questions across devices, and can pin ones to refer to later.";
			}
		}
		const register = quotaDialog.querySelector<HTMLAnchorElement>(
			"[data-ai-quota-register]",
		);
		const link = quotaDialog.querySelector<HTMLAnchorElement>("[data-ai-quota-signin]");
		const pending = kind === "save" || kind === "share" ? "" : question;
		if (register) register.href = registerHref(pending);
		if (link) link.href = signInHref(pending);
		const verifyStatus = quotaDialog.querySelector<HTMLElement>(
			"[data-ai-quota-verify-status]",
		);
		if (verifyStatus) {
			verifyStatus.hidden = true;
			verifyStatus.textContent = "";
		}
		quotaDialog.hidden = false;
	}

	async function resendAskVerification(): Promise<void> {
		const status = quotaDialog?.querySelector<HTMLElement>(
			"[data-ai-quota-verify-status]",
		);
		const button = quotaDialog?.querySelector<HTMLButtonElement>(
			"[data-ai-quota-resend-verify]",
		);
		if (button) button.disabled = true;
		if (status) {
			status.hidden = false;
			status.textContent = "Sending…";
		}
		try {
			const { resendVerificationEmail } = await import(
				"./emailVerificationClient"
			);
			const result = await resendVerificationEmail();
			if (result.alreadyVerified) {
				if (status) status.textContent = "Email already verified — refreshing…";
				await refreshQuota();
				closeQuotaDialog();
				return;
			}
			if (status) {
				if (result.ok) {
					const { verificationSentStatus } = await import(
						"./emailVerificationCopy"
					);
					status.textContent = verificationSentStatus(result.email);
				} else {
					status.textContent = result.error || "Could not resend.";
				}
			}
		} finally {
			if (button) button.disabled = false;
		}
	}

	async function refreshAskVerification(): Promise<void> {
		const status = quotaDialog?.querySelector<HTMLElement>(
			"[data-ai-quota-verify-status]",
		);
		const button = quotaDialog?.querySelector<HTMLButtonElement>(
			"[data-ai-quota-refresh-verify]",
		);
		if (button) button.disabled = true;
		if (status) {
			status.hidden = false;
			status.textContent = "Checking…";
		}
		try {
			await refreshQuota();
			if (quota?.signedIn && !quota.needsEmailVerification) {
				closeQuotaDialog();
				return;
			}
			if (status) {
				status.textContent =
					"Not verified yet — open the link in your email, then try again.";
			}
		} finally {
			if (button) button.disabled = false;
		}
	}

	function closeFeedbackDialog(): void {
		if (feedbackDialog) feedbackDialog.hidden = true;
		if (feedbackError) {
			feedbackError.hidden = true;
			feedbackError.textContent = "";
		}
	}

	function openFeedbackDialog(): void {
		if (!feedbackDialog) return;
		if (feedbackText) feedbackText.value = "";
		if (feedbackError) {
			feedbackError.hidden = true;
			feedbackError.textContent = "";
		}
		feedbackDialog.hidden = false;
		feedbackText?.focus();
	}

	async function refreshQuota(): Promise<void> {
		try {
			const response = await fetch("/api/ai/quota", {
				credentials: "same-origin",
			});
			const data = (await response.json()) as {
				success?: boolean;
				quota?: AiAskQuotaView;
				researchQuota?: ResearchQuotaView;
				isAdmin?: boolean;
			};
			const nextAdmin = data.isAdmin === true;
			const adminChanged = nextAdmin !== isAskAdmin;
			isAskAdmin = nextAdmin;
			if (data.success && data.quota) {
				applyQuota(data.quota, data.researchQuota ?? null);
			}
			if (adminChanged && turns.length > 0) syncLayout();
		} catch {
			/* ignore */
		}
	}

	function maybeOfferFeedback(view: AiAskQuotaView | null | undefined): void {
		if (!view?.offerFeedback || view.feedbackClaimed) {
			// “Not now” only snoozes until the last 2 Asks remain.
			if (!view?.offerFeedback) feedbackPromptShown = false;
			return;
		}
		if (feedbackPromptShown) return;
		feedbackPromptShown = true;
		window.clearTimeout(feedbackHintTimer);
		feedbackHintTimer = window.setTimeout(() => openFeedbackDialog(), 450);
	}

	async function dismissFeedbackOffer(): Promise<void> {
		closeFeedbackDialog();
		try {
			const response = await fetch("/api/ai/quota", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "dismissFeedback" }),
			});
			const data = (await response.json()) as {
				success?: boolean;
				quota?: AiAskQuotaView;
			};
			if (data.success && data.quota) {
				applyQuota(data.quota);
				if (!data.quota.offerFeedback) feedbackPromptShown = false;
			}
		} catch {
			/* ignore */
		}
	}

	function setFeedbackError(message: string): void {
		if (!feedbackError) return;
		feedbackError.textContent = message;
		feedbackError.hidden = !message;
	}

	async function submitUserReview(): Promise<void> {
		const text = (feedbackText?.value || "").replace(/\s+/g, " ").trim();
		if (!isValidAskUserReview(text)) {
			setFeedbackError(
				`Please write at least ${ASK_FEEDBACK_MIN_CHARS} characters.`,
			);
			return;
		}
		const submit = root.querySelector<HTMLButtonElement>("[data-ai-feedback-submit]");
		if (submit) submit.disabled = true;
		setFeedbackError("");
		try {
			const response = await fetch("/api/ai/user-review", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text }),
			});
			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
				quota?: AiAskQuotaView;
			};
			if (data.quota) applyQuota(data.quota);
			if (!response.ok || !data.success) {
				setFeedbackError(data.error || "Could not save feedback.");
				return;
			}
			closeFeedbackDialog();
			setStatus("Thanks — 5 more Asks today.");
		} catch {
			setFeedbackError("Network error. Try again.");
		} finally {
			if (submit) submit.disabled = false;
		}
	}

	function currentModel(): string {
		if (selectedModel && isClientFreeModelId(selectedModel)) return selectedModel;
		return defaultModel;
	}

	function persistActiveThread(): void {
		if (shareMode) return;
		if (
			turns.length > 0 &&
			turns.every((turn) => turn.fromSample) &&
			!turns.some((turn) => turn.saved)
		) {
			writeActiveAskThread([], undefined, { research: researchPaneOn() });
			return;
		}
		const entries = turns
			.filter((turn) => {
				if (turn.research && turn.researchJobId) return true;
				return (
					!turn.pending &&
					!turn.error &&
					!turn.offTopic &&
					turn.results.length > 0
				);
			})
			.map((turn) => {
				const entry = turnToSessionEntry(turn);
				if (turn.research && turn.pending && turn.researchJobId) {
					entry.researchPending = true;
				}
				return entry;
			});
		writeActiveAskThread(entries, undefined, { research: researchPaneOn() });
	}

	function navigationEntryType(): PerformanceNavigationTiming["type"] | "" {
		const entry = performance.getEntriesByType(
			"navigation",
		)[0] as PerformanceNavigationTiming | undefined;
		return entry?.type || "";
	}

	function restoreActiveThreadFromStorage(): void {
		const active = readActiveAskThread(undefined, {
			research: researchPaneOn(),
		});
		if (active.length === 0) return;
		turns = active.map((entry) => {
			const turn = sessionEntryToTurn(entry);
			turn.fromCache = false;
			return turn;
		});
		syncLayout();
		const pending = turns.find(
			(turn) => turn.pending && turn.research && turn.researchJobId,
		);
		if (pending) {
			busy = true;
			root.classList.add("is-busy");
			syncResearchJobUrl(pending.researchJobId || null);
			void pollResearchTurn(pending).finally(() => {
				busy = false;
				root.classList.remove("is-busy", "is-research-busy");
				syncLayout();
			});
		}
	}

	function leaveAskHome(options?: { url?: "back" | "replace" | "none" }): void {
		for (const turn of turns) {
			if (turn.research && turn.pending && turn.researchJobId) {
				persistResearchHistory(turn, { pending: true, unread: false });
			}
		}
		persistActiveThread();
		const urlMode = options?.url ?? "back";
		const hasItemUrl = Boolean(
			askResearchJobParam(window.location.search) ||
				askHistoryOpenParam(window.location.search) ||
				askSampleParam(window.location.search),
		);
		const popToMenu =
			urlMode === "back" && hasItemUrl && askSurfaceCameFromMenu();
		if (urlMode !== "none" && !popToMenu) {
			syncAskSurfaceUrl({ jobId: null, open: null, sample: null, push: false });
		}
		stopResearchPoll();
		stopSamplePlayback();
		busy = false;
		root.classList.remove("is-busy", "is-research-busy");
		clearAskThreadResumeIntent(undefined, { research: researchPaneOn() });
		turns = [];
		setStatus("");
		syncResearchChip();
		if (popToMenu) window.history.back();
		syncLayout();
		watchPendingResearchHistory();
		input.focus();
	}

	function applyAskSurfaceFromUrl(): void {
		if (shareMode) return;
		if (window.location.pathname.replace(/\/$/, "") !== "/search") return;
		if (!isAskSurfaceMode(window.location.search)) return;
		applyingAskSurfaceUrl = true;
		try {
			const jobId = askResearchJobParam(window.location.search);
			const sampleSlug = askSampleParam(window.location.search);
			const open = askHistoryOpenParam(window.location.search);
			if (jobId) {
				const already =
					turns.length > 0 &&
					turns.some((turn) => turn.researchJobId === jobId);
				if (already) return;
				void restoreResearchJob(
					jobId,
					sessionEntries.find((item) => item.researchJobId === jobId),
				);
				return;
			}
			if (sampleSlug) {
				const tip = turns[turns.length - 1];
				if (tip?.fromSample && tip.sampleSlug === sampleSlug) return;
				if (!openSampleFromUrl(sampleSlug) && turns.length > 0) {
					leaveAskHome({ url: "none" });
				}
				return;
			}
			if (open) {
				const tip = turns[turns.length - 1];
				const openKey = normalizeAskQuestionKey(open);
				if (
					tip &&
					(normalizeAskQuestionKey(tip.question) === openKey ||
						normalizeAskQuestionKey(tip.originalQuestion || "") ===
							openKey)
				) {
					return;
				}
				if (!openFromHistory(open) && turns.length > 0) {
					leaveAskHome({ url: "none" });
				}
				return;
			}
			if (turns.length > 0) {
				leaveAskHome({ url: "none" });
			}
		} finally {
			applyingAskSurfaceUrl = false;
		}
	}

	function markLeavingAskForDiscourse(): void {
		if (shareMode || turns.length === 0) return;
		markAskResumeFromDiscourse(undefined, { research: researchPaneOn() });
		persistActiveThread();
	}

	/** Conversation snapshot up to this turn (for pin/history restore). */
	function threadSnapshotForTurn(turn: AiAskTurn): AiAskSessionEntry[] {
		const index = turns.indexOf(turn);
		const slice = index >= 0 ? turns.slice(0, index + 1) : [turn];
		return slice
			.filter((item) => {
				if (item === turn && item.research && item.researchJobId) return true;
				return (
					!item.pending &&
					!item.error &&
					!item.offTopic &&
					item.results.length > 0
				);
			})
			.map((item) => turnToSessionEntry(item));
	}

	function persistResearchHistory(
		turn: AiAskTurn,
		flags: { pending: boolean; unread: boolean },
	): void {
		if (shareMode || !turn.research || !turn.researchJobId) return;
		const prior = sessionEntries.find(
			(item) => item.researchJobId === turn.researchJobId,
		);
		const entry = attachResearchToHistoryThread(
			turnToSessionEntry(turn),
			prior,
			threadSnapshotForTurn(turn),
		);
		entry.at = researchHistoryTimestamp({
			existingAt: prior?.at,
			createdAt: turn.researchStartedAt,
		});
		entry.research = true;
		entry.researchJobId = turn.researchJobId;
		if (flags.pending) entry.researchPending = true;
		if (flags.unread) entry.researchUnread = true;
		else delete entry.researchUnread;
		const replaceJobIds = priorResearchJobIdsInThread(entry);
		if (replaceJobIds.length > 0) {
			sessionEntries = removeAskHistoryEntriesByJobIds(
				sessionEntries,
				replaceJobIds,
			);
		}
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, entry);
		writeAiAskSession(sessionEntries);
		renderHistory();
		void fetch("/api/ai/history", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entry: slimAskHistoryEntryForSync(entry) || entry,
				...(replaceJobIds.length > 0 ? { replaceJobIds } : {}),
			}),
		}).catch(() => {
			/* history sync is best-effort */
		});
	}

	function postHistoryEntry(
		entry: AiAskSessionEntry,
		extra?: { replaceQuestions?: string[]; replaceJobIds?: string[] },
	): void {
		void fetch("/api/ai/history", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entry: slimAskHistoryEntryForSync(entry) || entry,
				...(extra?.replaceQuestions && extra.replaceQuestions.length > 0
					? { replaceQuestions: extra.replaceQuestions }
					: {}),
				...(extra?.replaceJobIds && extra.replaceJobIds.length > 0
					? { replaceJobIds: extra.replaceJobIds }
					: {}),
			}),
		})
			.then(async (response) => {
				if (response.status === 401) {
					signedInForHistory = false;
					return;
				}
				if (response.ok) signedInForHistory = true;
			})
			.catch(() => {
				/* history sync is best-effort */
			});
	}

	function markResearchHistoryRead(entry: AiAskSessionEntry): void {
		if (!entry.researchUnread && !entry.researchPending) return;
		const next = {
			...entry,
			researchPending: entry.researchPending,
		};
		delete next.researchUnread;
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, next);
		writeAiAskSession(sessionEntries);
		postHistoryEntry(next);
	}

	function watchPendingResearchHistory(): void {
		if (shareMode || turns.length > 0) return;
		for (const entry of sessionEntries) {
			if (!entry.researchPending || !entry.researchJobId) continue;
			void watchResearchHistoryJob(entry);
		}
	}

	async function watchResearchHistoryJob(
		entry: AiAskSessionEntry,
	): Promise<void> {
		const jobId = entry.researchJobId || "";
		if (!jobId || watchingResearchJobs.has(jobId)) return;
		watchingResearchJobs.add(jobId);
		try {
			while (turns.length === 0) {
				await new Promise((resolve) => window.setTimeout(resolve, 2000));
				if (turns.length > 0) return;
				const data = await fetchResearchJob(jobId);
				if (!data.ok || !data.job) return;
				if (data.job.pending) continue;
				const latest =
					sessionEntries.find((item) => item.researchJobId === jobId) ||
					entry;
				const turn = sessionEntryToTurn(latest);
				applyResearchJobToTurn(turn, data.job);
				persistResearchHistory(turn, {
					pending: false,
					unread: !data.job.error,
				});
				void refreshQuota();
				if (!data.job.error) {
					void notifyResearchReady({
						question: turn.question,
						jobId,
					});
				}
				return;
			}
		} catch {
			/* keep the pending row; another visit can retry */
		} finally {
			watchingResearchJobs.delete(jobId);
		}
	}

	async function hydrateOpenResearchJobs(): Promise<void> {
		if (shareMode) return;
		try {
			const response = await fetch("/api/ai/research", {
				credentials: "same-origin",
				cache: "no-store",
			});
			if (!response.ok) return;
			const data = (await response.json()) as { jobs?: ResearchJobPublic[] };
			const jobs = Array.isArray(data.jobs) ? data.jobs : [];
			let changed = false;
			for (const job of jobs) {
				if (!job.id) continue;
				const existing = sessionEntries.find(
					(item) => item.researchJobId === job.id,
				);
				if (job.pending) {
					sessionEntries = upsertAiAskSessionEntry(
						sessionEntries,
						researchJobToHistoryEntry(job, existing),
					);
					changed = true;
					continue;
				}
				if (!existing) {
					if (
						!shouldRestoreDroppedResearchJob(sessionEntries, {
							id: job.id,
							question: job.result?.question || job.question,
							originalQuestion: job.result?.originalQuestion,
						})
					) {
						continue;
					}
					sessionEntries = upsertAiAskSessionEntry(
						sessionEntries,
						researchJobToHistoryEntry(job),
					);
					changed = true;
					continue;
				}
				const nextAt = researchHistoryTimestamp({
					existingAt: existing.at,
					createdAt: job.createdAt,
				});
				if (nextAt === existing.at) continue;
				sessionEntries = upsertAiAskSessionEntry(sessionEntries, {
					...existing,
					at: nextAt,
				});
				changed = true;
			}
			if (!changed) return;
			writeAiAskSession(sessionEntries);
			renderHistory();
			watchPendingResearchHistory();
			void fetch("/api/ai/history", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "sync",
					entries: slimAskHistoryEntriesForSync(sessionEntries),
				}),
			}).catch(() => {
				/* recovered rows stay local until the next visit */
			});
		} catch {
			/* listing is best-effort */
		}
	}

	function openHistoryEntry(entry: AiAskSessionEntry): void {
		if (entry.researchJobId) {
			syncAskSurfaceUrl({
				jobId: entry.researchJobId,
				open: null,
				sample: null,
			});
		} else if (!researchPaneOn()) {
			syncAskSurfaceUrl({
				jobId: null,
				open: entry.question,
				sample: null,
			});
		}
		if (entry.researchUnread) markResearchHistoryRead(entry);
		if (researchHistoryNeedsJobRestore(entry)) {
			void restoreResearchJob(entry.researchJobId || "", entry);
			return;
		}
		const restored = askHistoryEntriesForRestore(entry);
		if (restored.length === 0) return;
		clearAskResumeFromDiscourse(undefined, { research: researchPaneOn() });
		turns = restored.map((item, index) => {
			const turn = sessionEntryToTurn(item);
			// Multi-turn restore is a conversation resume, not a silent cache hit.
			turn.fromCache = restored.length === 1;
			// Keep the pin state from the history row that was opened.
			if (index === restored.length - 1 && entry.saved) {
				turn.saved = true;
			}
			return turn;
		});
		persistActiveThread();
		syncLayout();
	}

	function persistSessionFromTurn(turn: AiAskTurn): void {
		if (turn.fromSample) return;
		if (turn.pending || turn.error || turn.offTopic) return;
		const keepEmptyResearch = Boolean(
			turn.research && (turn.report || turn.researchJobId),
		);
		if (turn.results.length === 0 && !keepEmptyResearch) return;

		const completedBefore = turns.filter(
			(item) =>
				item !== turn &&
				!item.pending &&
				!item.error &&
				!item.offTopic &&
				item.results.length > 0,
		);
		// If this conversation was already pinned, extend the pin onto the new
		// tip so follow-ups stay restorable as one thread.
		const extendPin = completedBefore.some((item) => item.saved === true);
		if (extendPin) {
			for (const item of turns) item.saved = false;
			turn.saved = true;
		} else if (!turn.saved && completedBefore.length === 0) {
			// Re-asking the same solo topic shouldn’t clear a favorite.
			const prior =
				findAiAskSessionEntry(sessionEntries, turn.question, {
					research: turn.research === true,
				}) ||
				findAiAskSessionEntry(
					sessionEntries,
					turn.originalQuestion || "",
					{ research: turn.research === true },
				);
			if (prior?.saved) turn.saved = true;
		}

		const thread = threadSnapshotForTurn(turn);
		const entry = turnToSessionEntry(turn, { thread });
		if (turn.research && turn.researchJobId) {
			const prior = sessionEntries.find(
				(item) => item.researchJobId === turn.researchJobId,
			);
			entry.at = researchHistoryTimestamp({
				existingAt: prior?.at,
				createdAt: turn.researchStartedAt,
			});
		}
		const replaceQuestions = turn.research
			? []
			: [
					...(pendingReplaceQuestions || []),
					...(extendPin
						? completedBefore.flatMap((item) =>
								[item.question, item.originalQuestion || ""].filter(Boolean),
							)
						: []),
				];
		const replaceJobIds = turn.research
			? [
					...(pendingReplaceJobIds || []),
					...priorResearchJobIdsInThread(entry),
				]
			: [...(pendingReplaceJobIds || [])];
		pendingReplaceQuestions = null;
		pendingReplaceJobIds = null;
		if (replaceQuestions.length > 0) {
			sessionEntries = removeAskHistoryEntriesByQuestions(
				sessionEntries,
				replaceQuestions,
				{ research: turn.research === true },
			);
		}
		if (replaceJobIds.length > 0) {
			sessionEntries = removeAskHistoryEntriesByJobIds(
				sessionEntries,
				replaceJobIds,
			);
		}
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, entry);
		writeAiAskSession(sessionEntries);
		persistActiveThread();
		renderHistory();
		postHistoryEntry(entry, {
			replaceQuestions,
			replaceJobIds,
		});
	}

	async function loadAskSamples(): Promise<void> {
		try {
			const response = await fetch("/api/ai/samples", {
				credentials: "same-origin",
				cache: "no-store",
			});
			const data = (await response.json()) as {
				success?: boolean;
				samples?: unknown;
			};
			if (!data.success || !Array.isArray(data.samples)) return;
			askSamples = data.samples
				.map((item) => sanitizeAskSamplePublic(item))
				.filter((item): item is AiAskSamplePublic => Boolean(item));
			renderHistory();
			if (turns.length > 0) syncLayout();
		} catch {
			/* samples are optional until an admin marks one */
		}
	}

	function stopSamplePlayback(): void {
		samplePlaybackToken += 1;
		window.clearTimeout(samplePlaybackTimer);
		samplePlaybackTimer = 0;
	}

	function applySamplePlayback(
		turn: AiAskTurn,
		sample: AiAskSamplePublic,
		phase: AskSamplePlaybackPhase,
	): void {
		const patch = askSamplePlaybackPatch(sample, phase);
		turn.pending = patch.pending;
		turn.phase = patch.phase;
		turn.lookingFor = patch.lookingFor;
		turn.queries = patch.queries;
		turn.fallbackQueries = patch.fallbackQueries;
		turn.summary = patch.summary;
		turn.results = patch.results;
		if (patch.research) turn.research = true;
		if (patch.report) turn.report = patch.report;
		else if (!patch.pending) turn.report = sample.report;
		if (patch.rerankCandidateCount) {
			turn.rerankCandidateCount = patch.rerankCandidateCount;
			turn.rerankShowCount = patch.rerankShowCount;
		} else {
			turn.rerankCandidateCount = undefined;
			turn.rerankShowCount = undefined;
		}
	}

	function openSampleFromUrl(
		slug: string,
		options?: { playback?: boolean },
	): boolean {
		const sample = askSamples.find((item) => item.slug === slug);
		if (!sample) return false;
		if (isResearchAskSample(sample) !== researchPaneOn()) return false;
		openAskSample(sample, { playback: options?.playback === true });
		return true;
	}

	function openAskSample(
		sample: AiAskSamplePublic,
		options?: { playback?: boolean },
	): void {
		stopSamplePlayback();
		const token = samplePlaybackToken;
		pendingReplaceQuestions = null;
		pendingReplaceJobIds = null;
		clearAskResumeFromDiscourse(undefined, { research: researchPaneOn() });
		syncAskSurfaceUrl({
			sample: sample.slug,
			jobId: null,
			open: null,
		});
		const turn = sampleToAiAskTurn(sample);
		const playback = options?.playback !== false;
		if (!playback) {
			applySamplePlayback(turn, sample, "done");
			turns = [turn];
			busy = false;
			root.classList.remove("is-busy");
			syncLayout();
			thread.firstElementChild?.scrollIntoView({ block: "start" });
			return;
		}
		applySamplePlayback(turn, sample, "rewrite");
		turns = [turn];
		busy = true;
		root.classList.add("is-busy");
		syncLayout();
		thread.firstElementChild?.scrollIntoView({ block: "start" });

		const playFrom = (index: number): void => {
			if (token !== samplePlaybackToken) return;
			const step = ASK_SAMPLE_PLAYBACK[index];
			if (!step) return;
			applySamplePlayback(turn, sample, step.phase);
			if (step.phase === "done") {
				busy = false;
				root.classList.remove("is-busy");
				syncLayout();
				return;
			}
			syncLayout();
			const next = ASK_SAMPLE_PLAYBACK[index + 1];
			if (!next) return;
			samplePlaybackTimer = window.setTimeout(
				() => playFrom(index + 1),
				Math.max(0, next.atMs - step.atMs),
			);
		};
		playFrom(0);
	}

	async function saveTurnAsSample(turn: AiAskTurn): Promise<void> {
		if (
			!canMarkAskAsSample({
				isAdmin: isAskAdmin,
				pending: turn.pending,
				error: turn.error,
				offTopic: turn.offTopic,
				resultCount: turn.results.length,
				fromShare: turn.fromShare,
				fromSample: turn.fromSample,
				research: turn.research,
				hasReport: Boolean((turn.report || "").trim()),
			})
		) {
			return;
		}
		const replacing = Boolean(
			publishedAskSample(askSamples, {
				question: turn.question,
				originalQuestion: turn.originalQuestion,
				research: turn.research === true,
			}),
		);
		if (!window.confirm(askSampleConfirmMessage(replacing, { research: turn.research === true }))) return;
		const research =
			turn.research === true || Boolean((turn.report || "").trim());
		try {
			const response = await fetch("/api/ai/admin/sample", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: turn.question,
					lookingFor: turn.lookingFor,
					queries: turn.queries,
					fallbackQueries: turn.fallbackQueries,
					summary: turn.summary || "",
					results: turn.results.map((hit) => ({
						slug: hit.slug,
						title: hit.title,
						description: hit.description,
						contentSnippet: hit.contentSnippet,
						referenceOnly: hit.referenceOnly === true,
						href: hit.href || (hit.slug ? `/${hit.slug}` : ""),
						...(hit.volpage ? { volpage: hit.volpage } : {}),
					})),
					model: turn.model,
					requestId: turn.requestId,
					candidateCount: turn.rerankCandidateCount,
					...(research ? { research: true } : {}),
					...(turn.report ? { report: turn.report } : {}),
					...(turn.researchJobId ? { researchJobId: turn.researchJobId } : {}),
					...(turn.processNotes && turn.processNotes.length > 0
						? { processNotes: turn.processNotes }
						: {}),
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
				sample?: unknown;
			};
			if (!response.ok || !data.success) {
				setStatus(data.error || "Could not save this example.");
				return;
			}
			const saved = sanitizeAskSamplePublic(data.sample);
			if (saved) {
				askSamples = upsertAskSampleLocal(askSamples, saved);
				renderHistory();
				syncLayout();
			}
			setStatus("Saved as the example for this question.");
		} catch {
			setStatus("Could not save this example.");
		}
	}

	async function removePublishedSample(slug: string, fromSample: boolean): Promise<void> {
		try {
			const response = await fetch("/api/ai/admin/sample", {
				method: "DELETE",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug }),
			});
			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
			};
			if (!response.ok || !data.success) {
				setStatus(data.error || "Could not remove this example.");
				return;
			}
			askSamples = removeAskSampleLocal(askSamples, slug);
			if (fromSample) {
				leaveAskHome({ url: "replace" });
			} else {
				renderHistory();
				syncLayout();
			}
			setStatus("Removed this example.");
		} catch {
			setStatus("Could not remove this example.");
		}
	}

	function removeTurnSample(turn: AiAskTurn): void {
		const published = publishedAskSample(askSamples, {
			question: turn.question,
			originalQuestion: turn.originalQuestion,
			sampleSlug: turn.sampleSlug,
			research: turn.research === true,
		});
		const slug = published?.slug || (turn.fromSample ? turn.sampleSlug : "") || "";
		if (
			!slug ||
			!canRemoveAskSample({
				isAdmin: isAskAdmin,
				pending: turn.pending,
				fromShare: turn.fromShare,
				hasSample: true,
			})
		) {
			return;
		}
		openConfirmDialog(
			ASK_SAMPLE_REMOVE_TITLE,
			askSampleRemoveConfirmMessage({ research: turn.research === true }),
			() => {
				void removePublishedSample(slug, turn.fromSample === true);
			},
		);
	}

	function persistSaveState(turn: AiAskTurn): void {
		if (turn.pending || turn.error || turn.results.length === 0) return;
		// Pin keeps the whole open conversation, not only the turn whose pin was clicked.
		const completed = turns.filter(
			(item) =>
				!item.pending &&
				!item.error &&
				!item.offTopic &&
				item.results.length > 0,
		);
		const thread =
			completed.length > 1
				? completed.map((item) => turnToSessionEntry(item))
				: threadSnapshotForTurn(turn);
		const entry = turnToSessionEntry(turn, { thread });
		const replaceQuestions = turn.research
			? []
			: completed
					.filter((item) => item !== turn)
					.flatMap((item) =>
						[item.question, item.originalQuestion || ""].filter(Boolean),
					);
		const replaceJobIds = turn.research
			? priorResearchJobIdsInThread(entry)
			: [];
		if (replaceQuestions.length > 0) {
			sessionEntries = removeAskHistoryEntriesByQuestions(
				sessionEntries,
				replaceQuestions,
				{ research: turn.research === true },
			);
		}
		if (replaceJobIds.length > 0) {
			sessionEntries = removeAskHistoryEntriesByJobIds(
				sessionEntries,
				replaceJobIds,
			);
		}
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, entry);
		writeAiAskSession(sessionEntries);
		persistActiveThread();
		renderHistory();
		postHistoryEntry(entry, { replaceQuestions, replaceJobIds });
	}

	function toggleSaveTurn(turn: AiAskTurn): void {
		if (turn.pending || turn.error || turn.results.length === 0) return;
		if (!signedInForHistory) {
			openQuotaDialog("save");
			return;
		}
		const pinIndex = latestPinnableTurnIndex();
		const target =
			pinIndex >= 0 && turns[pinIndex] ? turns[pinIndex] : turn;
		if (
			target.pending ||
			target.error ||
			target.offTopic ||
			target.results.length === 0
		) {
			return;
		}
		const nextSaved = !target.saved;
		// One pin for the whole thread — keep the flag only on the final turn.
		for (const item of turns) {
			item.saved = false;
		}
		target.saved = nextSaved;
		persistSaveState(target);
		syncLayout();
	}

	function entryQuestionKeys(entry: AiAskSessionEntry): string[] {
		return [entry.question, entry.originalQuestion || ""].filter(Boolean);
	}

	function openThreadMatchesQuestions(questions: readonly string[]): boolean {
		const tipIndex = latestPinnableTurnIndex();
		const tip = tipIndex >= 0 ? turns[tipIndex] : undefined;
		if (!tip) return false;
		const tipKeys = [
			normalizeAskQuestionKey(tip.question),
			normalizeAskQuestionKey(tip.originalQuestion || ""),
		].filter(Boolean);
		return questions.some((question) => {
			const key = normalizeAskQuestionKey(question);
			return key.length > 0 && tipKeys.includes(key);
		});
	}

	async function deleteHistoryQuestions(
		questions: readonly string[],
		options?: { clearOpenThread?: boolean; researchJobId?: string },
	): Promise<void> {
		const jobId = (options?.researchJobId || "").trim();
		const keys = questions.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean);
		if (!jobId && keys.length === 0) return;
		const clearOpen =
			options?.clearOpenThread === true ||
			(jobId
				? turns.some((turn) => turn.researchJobId === jobId)
				: openThreadMatchesQuestions(keys));
		if (jobId) {
			sessionEntries = removeAskHistoryEntriesByJobIds(sessionEntries, [jobId]);
		} else {
			sessionEntries = removeAskHistoryEntriesByQuestions(sessionEntries, keys, {
				research: researchPaneOn(),
			});
		}
		writeAiAskSession(sessionEntries);
		if (signedInForHistory) {
			void fetch("/api/ai/history", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					jobId
						? { action: "delete", researchJobId: jobId, research: true }
						: {
								action: "delete",
								questions: keys,
								research: researchPaneOn(),
							},
				),
			})
				.then(async (response) => {
					if (response.status === 401) {
						signedInForHistory = false;
						return;
					}
					const data = (await response.json()) as {
						success?: boolean;
						entries?: AiAskSessionEntry[];
					};
					if (response.ok && data.success && Array.isArray(data.entries)) {
						sessionEntries = preservePendingResearchHistory(
							sessionEntries,
							data.entries,
						);
						if (jobId) {
							sessionEntries = removeAskHistoryEntriesByJobIds(
								sessionEntries,
								[jobId],
							);
						} else {
							sessionEntries = removeAskHistoryEntriesByQuestions(
								sessionEntries,
								keys,
								{ research: researchPaneOn() },
							);
						}
						writeAiAskSession(sessionEntries);
						if (turns.length === 0) renderHistory();
					}
				})
				.catch(() => {
					/* local delete already applied */
				});
		}
		if (clearOpen) {
			leaveAskHome({ url: "replace" });
			return;
		}
		renderHistory();
		syncLayout();
	}

	function deleteHistoryEntry(entry: AiAskSessionEntry): void {
		if (
			!window.confirm(
				researchPaneOn() ? RESEARCH_DELETE_CONFIRM : ASK_DELETE_CONFIRM,
			)
		) {
			return;
		}
		void deleteHistoryQuestions(entryQuestionKeys(entry), {
			researchJobId: entry.researchJobId,
		});
	}

	function deleteOpenAskTurn(turn: AiAskTurn): void {
		if (busy) return;
		const index = turns.indexOf(turn);
		if (index < 0 || index !== turns.length - 1) return;
		const flags = openAskTurnActionFlags({
			pending: turn.pending,
			error: turn.error,
			fromShare: turn.fromShare,
			fromSample: turn.fromSample,
			isTip: true,
			research: turn.research,
			researchJobId: turn.researchJobId,
			resultCount: turn.results.length,
			hasReport: Boolean((turn.report || "").trim()),
			isPinnableTip: index === latestPinnableTurnIndex(),
		});
		if (!flags.showDelete) return;

		let previousTip: AiAskTurn | undefined;
		for (let i = index - 1; i >= 0; i--) {
			const item = turns[i];
			if (
				item &&
				!item.pending &&
				!item.error &&
				!item.offTopic &&
				item.results.length > 0
			) {
				previousTip = item;
				break;
			}
		}

		if (previousTip) {
			if (
				!window.confirm(
					"Remove this last follow-up from the conversation?",
				)
			) {
				return;
			}
			const removedQuestions = [
				turn.question,
				turn.originalQuestion || "",
			].filter(Boolean);
			const keepPinned = turn.saved === true;
			turns = turns.slice(0, index);
			if (keepPinned) {
				for (const item of turns) item.saved = false;
				previousTip.saved = true;
			}
			pendingReplaceQuestions = removedQuestions;
			pendingReplaceJobIds = turn.researchJobId ? [turn.researchJobId] : null;
			persistSessionFromTurn(previousTip);
			syncLayout();
			return;
		}

		if (
			!window.confirm(
				turn.research ? RESEARCH_DELETE_CONFIRM : ASK_DELETE_CONFIRM,
			)
		) {
			return;
		}
		void deleteHistoryQuestions(
			[turn.question, turn.originalQuestion || ""].filter(Boolean),
			{ clearOpenThread: true, researchJobId: turn.researchJobId },
		);
	}

	function toggleHistoryEntryPin(entry: AiAskSessionEntry): void {
		if (!signedInForHistory) {
			openQuotaDialog("save");
			return;
		}
		const next = { ...entry, saved: !entry.saved };
		sessionEntries = upsertAiAskSessionEntry(sessionEntries, next);
		writeAiAskSession(sessionEntries);
		// Keep open-thread pin marker in sync when this card is the open tip.
		if (openThreadMatchesQuestions(entryQuestionKeys(entry))) {
			const tipIndex = latestPinnableTurnIndex();
			for (let i = 0; i < turns.length; i++) {
				const item = turns[i];
				if (!item) continue;
				item.saved = i === tipIndex ? next.saved === true : false;
			}
		}
		renderHistory();
		syncLayout();
		void fetch("/api/ai/history", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				entry: slimAskHistoryEntryForSync(next) || next,
			}),
		})
			.then(async (response) => {
				if (response.status === 401) {
					signedInForHistory = false;
					return;
				}
				if (response.ok) signedInForHistory = true;
			})
			.catch(() => {
				/* best-effort */
			});
	}

	async function shareHistoryEntry(
		entry: AiAskSessionEntry,
		button: HTMLButtonElement,
	): Promise<void> {
		if (entry.results.length === 0) return;
		if (!signedInForHistory) {
			openQuotaDialog("share");
			return;
		}
		const idle = readAskButtonIdle(button);
		applyAskButtonFeedback(button, "Sharing…", "busy");
		const thread =
			entry.thread && entry.thread.length > 1
				? entry.thread.map((item) => ({
						question: item.question,
						lookingFor: item.lookingFor,
						queries: item.queries,
						fallbackQueries: item.fallbackQueries,
						summary: item.summary || "",
						results: item.results,
						model: item.model,
						...(item.requestId ? { requestId: item.requestId } : {}),
						...(typeof item.candidateCount === "number" &&
						item.candidateCount > 0
							? { candidateCount: item.candidateCount }
							: {}),
					}))
				: undefined;
		try {
			const response = await fetch("/api/ai/share", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: entry.question,
					lookingFor: entry.lookingFor,
					queries: entry.queries,
					fallbackQueries: entry.fallbackQueries,
					summary: entry.summary || "",
					results: entry.results,
					model: entry.model,
					requestId: entry.requestId,
					shareSlug: entry.shareSlug,
					...(entry.research ? { research: true } : {}),
					...(entry.report ? { report: entry.report } : {}),
					...(thread ? { thread } : {}),
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				path?: string;
				error?: string;
			};
			if (!response.ok || !data.success || !data.path) {
				flashAskButtonFeedback(
					button,
					data.error || ASK_SHARE_FAILED_LABEL,
					"error",
					idle,
				);
				return;
			}
			const url = new URL(data.path, window.location.origin).toString();
			await navigator.clipboard.writeText(url);
			flashAskButtonFeedback(button, ASK_SHARE_COPIED_LABEL, "copied", idle);
		} catch {
			flashAskButtonFeedback(button, ASK_SHARE_FAILED_LABEL, "error", idle);
		}
	}

	async function syncHistoryFromServer(): Promise<void> {
		try {
			const probe = await fetch("/api/ai/history", {
				credentials: "same-origin",
			});
			const probeData = (await probe.json()) as {
				success?: boolean;
				signedIn?: boolean;
				entries?: AiAskSessionEntry[];
			};
			if (!probeData.success || !probeData.signedIn) {
				signedInForHistory = false;
				return;
			}
			signedInForHistory = true;
			const response = await fetch("/api/ai/history", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "sync",
					entries: slimAskHistoryEntriesForSync(sessionEntries),
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				entries?: AiAskSessionEntry[];
			};
			if (!response.ok || !data.success) {
				sessionEntries = mergeAskHistoryEntries(
					sessionEntries,
					Array.isArray(probeData.entries) ? probeData.entries : [],
				);
			} else {
				sessionEntries = preservePendingResearchHistory(
					sessionEntries,
					Array.isArray(data.entries) ? data.entries : [],
				);
			}
			writeAiAskSession(sessionEntries);
			// Asks that finished during the first sync stay local-only unless we merge again.
			const latestLocal = readAiAskSession();
			if (latestLocal.length !== sessionEntries.length) {
				const catchUp = await fetch("/api/ai/history", {
					method: "POST",
					credentials: "same-origin",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						action: "sync",
						entries: slimAskHistoryEntriesForSync(latestLocal),
					}),
				});
				const catchUpData = (await catchUp.json()) as {
					success?: boolean;
					entries?: AiAskSessionEntry[];
				};
				if (catchUp.ok && catchUpData.success && Array.isArray(catchUpData.entries)) {
					sessionEntries = preservePendingResearchHistory(
						latestLocal,
						catchUpData.entries,
					);
					writeAiAskSession(sessionEntries);
				} else {
					sessionEntries = mergeAskHistoryEntries(
						latestLocal,
						sessionEntries,
					);
					writeAiAskSession(sessionEntries);
				}
			}
			// Pin state is only meaningful on the conversation tip.
			const pinIndex = latestPinnableTurnIndex();
			for (let i = 0; i < turns.length; i++) {
				const item = turns[i];
				if (!item) continue;
				if (i !== pinIndex) {
					item.saved = false;
					continue;
				}
				const match =
					findAiAskSessionEntry(sessionEntries, item.question, {
						research: item.research === true,
					}) ||
					findAiAskSessionEntry(
						sessionEntries,
						item.originalQuestion || "",
						{ research: item.research === true },
					);
				item.saved = match?.saved === true;
			}
			renderHistory();
			watchPendingResearchHistory();
			if (turns.length > 0) syncLayout();
		} catch {
			/* keep local history */
		}
	}

	function renderPersonHit(person: AiAskPersonHit): string {
		const title = escapeHtml(person.title);
		const description = person.description
			? `<p class="ai-person-desc">${escapeHtml(stripHtml(person.description))}</p>`
			: "";
		const more =
			person.discourseCount > person.sampleIds.length
				? ` · +${person.discourseCount - person.sampleIds.length} more`
				: "";
		const samples =
			person.sampleIds.length > 0
				? `<p class="ai-person-ids">${escapeHtml(
						`${person.sampleIds.join(" · ")}${more}`,
					)}</p>`
				: person.discourseCount > 0
					? `<p class="ai-person-ids">${escapeHtml(
							`${person.discourseCount} discourse${
								person.discourseCount === 1 ? "" : "s"
							}`,
						)}</p>`
					: "";
		return `<div data-result-type="person">
			<a href="${escapeHtml(person.href)}" class="ai-person-card search-discourse-card block no-underline text-inherit" data-search-result>
				<div class="ai-person-card-inner">
					<div class="ai-person-kicker">
						<span class="ai-person-badge" style="text-transform:none">person</span>
					</div>
					<h2 class="ai-person-title">${title}</h2>
					${description}
					${samples}
				</div>
			</a>
		</div>`;
	}

	function renderHit(hit: AiDiscourseHit, research = false): string {
		const id = escapeHtml(transformId(hit.slug));
		const title = escapeHtml(
			research ? formatResearchHitTitle(hit.title) : hit.title,
		);
		const description = hit.description
			? `<p class="ai-hit-desc">${escapeHtml(stripHtml(hit.description))}</p>`
			: "";
		const snippet =
			!research && hit.contentSnippet
				? `<p class="ai-hit-snippet${hit.description ? " ai-hit-snippet-extra" : ""}">${escapeHtml(stripHtml(hit.contentSnippet))}</p>`
				: "";
		const badge = hit.referenceOnly
			? `<span class="inline-block ml-1.5 px-1 py-0 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--text-muted)] align-middle">Reference</span>`
			: "";
		const volpage =
			research && hit.volpage
				? `<div class="mt-2 flex justify-end"><span class="text-xs font-normal tracking-wide text-[var(--text-muted)] whitespace-nowrap tabular-nums" title="${escapeHtml(hit.volpage)}">${escapeHtml(hit.volpage)}</span></div>`
				: "";
		// Ask cards stay slim. Research sources match Search: ID, Pāli, English, description, PTS.
		return `<div data-result-type="discourse">
			<a href="${escapeHtml(hit.href)}" class="search-discourse-card block no-underline text-inherit" data-search-result>
				<div class="flex items-start">
					<div class="min-w-0 pr-4">
						<h2 class="text-base sm:text-lg font-semibold text-text leading-snug">
							<span class="id font-normal text-[var(--link-color)]">
								${id}&nbsp; <span style="color:var(--text-color)">${title}</span>
							</span>
							${badge}
						</h2>
					</div>
				</div>
				${description}
				${snippet}
				${volpage}
			</a>
		</div>`;
	}

	function queryChipsHtml(queries: readonly string[], className: string): string {
		if (queries.length === 0) return "";
		return `<div class="${className}">${queries
			.map((query) => {
				const href = `/search?q=${encodeURIComponent(query)}`;
				return `<a class="ai-query-chip" href="${href}">${escapeHtml(query)}</a>`;
			})
			.join("")}</div>`;
	}

	function emptyHitsHtml(turn: AiAskTurn): string {
		const searchTerm =
			turn.queries[0] ||
			turn.lookingFor.replace(/^looking for:\s*/i, "").trim() ||
			turn.question;
		const searchHref = `/search?q=${encodeURIComponent(searchTerm)}`;
		const tried =
			turn.queries.length > 0
				? `<p class="ai-empty-tried">Tried: ${turn.queries
						.map((query) => escapeHtml(query))
						.join(" · ")}</p>`
				: "";
		if (turn.degraded) {
			return `<div class="ai-empty-hits">
				<p>Couldn’t form a clear library search from that wording.</p>
				${tried}
				<p><a href="${searchHref}">Open Search</a> with a shorter phrase, or rephrase (Pāli stems like satipaṭṭhāna often help).</p>
			</div>`;
		}
		return `<div class="ai-empty-hits">
			<p>No discourses matched those searches.</p>
			${tried}
			<p><a href="${searchHref}">Open Search</a>, or ask again with different terms.</p>
		</div>`;
	}

	function latestRateableTurnIndex(): number {
		for (let i = turns.length - 1; i >= 0; i--) {
			const turn = turns[i];
			if (
				turn &&
				!turn.fromSample &&
				!turn.pending &&
				!turn.error &&
				!turn.offTopic &&
				turn.requestId &&
				turn.results.length > 0
			) {
				return i;
			}
		}
		return -1;
	}

	function latestPinnableTurnIndex(): number {
		for (let i = turns.length - 1; i >= 0; i--) {
			const turn = turns[i];
			if (
				turn &&
				!turn.pending &&
				!turn.error &&
				!turn.offTopic &&
				turn.results.length > 0
			) {
				return i;
			}
		}
		return -1;
	}

	function openAskDownload(): void {
		const exportTurns = askTurnsForExport(turns).filter(
			(turn) => turn.research === true,
		);
		if (exportTurns.length === 0) return;
		const sharePath = askExportSharePathFromTurns(
			turns,
			window.location.pathname,
		);
		window.dispatchEvent(
			new CustomEvent(ASK_EXPORT_OPEN_EVENT, {
				detail: {
					turns: exportTurns,
					research: true,
					...(sharePath ? { sharePath } : {}),
				},
			}),
		);
	}

	function shareActionsHtml(turn: AiAskTurn, turnIndex: number): string {
		const tip = turnIndex === turns.length - 1;
		const flags = openAskTurnActionFlags({
			pending: turn.pending,
			error: turn.error,
			fromShare: turn.fromShare,
			fromSample: turn.fromSample,
			isTip: tip,
			research: turn.research,
			researchJobId: turn.researchJobId,
			resultCount: turn.results.length,
			hasReport: Boolean((turn.report || "").trim()),
			isPinnableTip: turnIndex === latestPinnableTurnIndex(),
		});
		const conversation = turns.length > 1;
		// Only the current tip counts — an earlier pin must not look pinned after
		// a new follow-up until that fuller thread is saved on this tip.
		const pinned = flags.showPin && turn.saved === true;
		const pinTitle = pinned
			? conversation
				? "Unpin — allow this conversation to drop off with older ones"
				: turn.research
					? "Unpin — allow this report to drop off with older ones"
					: "Unpin — allow this Ask to drop off with older ones"
			: signedInForHistory
				? conversation
					? "Pin this conversation so the whole thread stays under Pinned"
					: turn.research
						? "Pin so it stays when older reports drop off"
						: "Pin so it stays when older Asks drop off"
				: turn.research
					? RESEARCH_PIN_ACCOUNT_TITLE
					: ASK_PIN_ACCOUNT_TITLE;
		const pinLabel = pinned
			? conversation
				? "Pinned conversation"
				: "Pinned"
			: conversation
				? "Pin conversation"
				: turn.research
					? RESEARCH_PIN_ACTION
					: "Pin this Ask";
		const pinShortLabel = pinned ? "Pinned" : "Pin";
		const pinBtn = flags.showPin
			? `<button type="button" class="ai-share-btn ai-pin-btn${pinned ? " is-pinned" : ""}" data-ai-pin data-turn-index="${turnIndex}" aria-pressed="${pinned ? "true" : "false"}" title="${pinTitle}" aria-label="${pinTitle}">
				${PIN_ICON_SVG}<span class="ai-share-label-full">${pinLabel}</span><span class="ai-share-label-short">${pinShortLabel}</span>
			</button>`
			: "";
		const deleteBtn = flags.showDelete
				? `<button type="button" class="ai-delete-link" data-ai-delete-turn data-turn-index="${turnIndex}" title="${
					conversation
						? "Remove this last follow-up"
						: turn.research
							? RESEARCH_DELETE_ACTION
							: "Delete this Ask"
				}">Delete</button>`
				: "";
		const publishedSample = publishedAskSample(askSamples, {
			question: turn.question,
			originalQuestion: turn.originalQuestion,
			sampleSlug: turn.sampleSlug,
			research: turn.research === true,
		});
		const sampleAction = askSampleAdminAction({
			canSave: Boolean(
				tip &&
					canMarkAskAsSample({
						isAdmin: isAskAdmin,
						pending: turn.pending,
						error: turn.error,
						offTopic: turn.offTopic,
						resultCount: turn.results.length,
						fromShare: turn.fromShare,
						fromSample: turn.fromSample,
						research: turn.research,
						hasReport: Boolean((turn.report || "").trim()),
					}),
			),
			canRemove: Boolean(
				tip &&
					canRemoveAskSample({
						isAdmin: isAskAdmin,
						pending: turn.pending,
						fromShare: turn.fromShare,
						hasSample: Boolean(
							publishedSample || (turn.fromSample && turn.sampleSlug),
						),
					}),
			),
		});
		const sampleSaveBtn =
			sampleAction === "save"
				? `<button type="button" class="ai-share-btn" data-ai-sample-save data-turn-index="${turnIndex}" title="${
					turn.research
						? "Use this report as the example for this question"
						: "Use this run as the example for this question"
				}">
				<span class="ai-share-label-full">${ASK_SAMPLE_SAVE_LABEL}</span><span class="ai-share-label-short">${ASK_SAMPLE_SAVE_LABEL_SHORT}</span>
			</button>`
				: "";
		const sampleRemoveBtn =
			sampleAction === "remove"
				? `<button type="button" class="ai-share-btn" data-ai-sample-remove data-turn-index="${turnIndex}" title="${
					turn.research
						? "Stop showing this as the research example for this question"
						: "Stop showing this as the Ask example for this question"
				}">
				<span class="ai-share-label-full">${ASK_SAMPLE_REMOVE_LABEL}</span><span class="ai-share-label-short">${ASK_SAMPLE_REMOVE_LABEL_SHORT}</span>
			</button>`
				: "";
		const startBtns =
			pinBtn || deleteBtn
				? `<div class="ai-share-actions-start">${pinBtn}${deleteBtn}</div>`
				: "";
		const downloadBtn = flags.showDownload
			? `<button type="button" class="ai-share-btn" data-ai-download data-turn-index="${turnIndex}" aria-haspopup="dialog" aria-controls="ask-pdf-export-dialog" title="Download PDF or EPUB">Download</button>`
			: "";
		const shareBtn = flags.showShare
			? `<button type="button" class="ai-share-btn" data-ai-share data-turn-index="${turnIndex}">${SHARE_LINK_IDLE_HTML}</button>`
			: "";
		if (!startBtns && !downloadBtn && !sampleSaveBtn && !sampleRemoveBtn && !shareBtn) {
			return "";
		}
		return `<div class="ai-share-actions">
			${startBtns}
			<div class="ai-share-actions-end">
				${downloadBtn}${sampleSaveBtn}${sampleRemoveBtn}${shareBtn}
			</div>
		</div>`;
	}

	function feedbackHtml(turn: AiAskTurn, turnIndex: number): string {
		// One feedback row per thread — only on the latest rateable turn.
		if (turn.fromShare || turn.fromSample) return "";
		if (turnIndex !== latestRateableTurnIndex()) return "";
		if (
			turn.pending ||
			turn.error ||
			turn.offTopic ||
			!turn.requestId ||
			turn.results.length === 0
		) {
			return "";
		}
		if (turn.feedback === "up" || turn.feedback === "down") {
			return `<p class="ai-feedback-thanks">Thanks for the feedback.</p>`;
		}
		const busy = turn.feedback === "sending";
		return `<div class="ai-feedback" data-ai-feedback-turn="${turnIndex}">
			<span class="ai-feedback-label">Were these results helpful?</span>
			<button type="button" class="ai-feedback-btn" data-ai-feedback="up" ${busy ? "disabled" : ""} aria-label="Helpful">👍</button>
			<button type="button" class="ai-feedback-btn" data-ai-feedback="down" ${busy ? "disabled" : ""} aria-label="Not helpful">👎</button>
		</div>`;
	}

	function shareThreadPayload(upToIndex: number): AiAskShareTurn[] {
		return turns
			.slice(0, Math.max(0, upToIndex) + 1)
			.filter(
				(item) =>
					!item.pending &&
					!item.error &&
					!item.offTopic &&
					item.results.length > 0,
			)
			.map((item) => ({
				question: item.question,
				lookingFor: item.lookingFor,
				queries: item.queries,
				fallbackQueries: item.fallbackQueries,
				summary: item.summary || "",
				results: item.results,
				model: item.model,
				...(item.requestId ? { requestId: item.requestId } : {}),
				...(typeof item.rerankCandidateCount === "number" &&
				item.rerankCandidateCount > 0
					? { candidateCount: item.rerankCandidateCount }
					: {}),
				...(item.research ? { research: true } : {}),
				...(item.report ? { report: item.report } : {}),
				...(item.reasoning ? { reasoning: item.reasoning } : {}),
			}));
	}

	async function copyAskAnswer(
		turn: AiAskTurn,
		button: HTMLButtonElement,
	): Promise<void> {
		const kind = button.getAttribute("data-copy-kind") === "report"
			? "report"
			: "answer";
		const text =
			kind === "report"
				? (turn.report || "").trim()
				: (turn.summary || "").trim();
		if (!text) return;
		const idle = readAskButtonIdle(button);
		try {
			await navigator.clipboard.writeText(text);
			flashAskButtonFeedback(
				button,
				ASK_CLIPBOARD_COPIED_LABEL,
				"copied",
				idle,
			);
		} catch {
			flashAskButtonFeedback(
				button,
				ASK_CLIPBOARD_FAILED_LABEL,
				"error",
				idle,
			);
		}
	}

	async function copyShareLink(
		turn: AiAskTurn,
		button: HTMLButtonElement,
		turnIndex: number,
	): Promise<void> {
		if (turn.results.length === 0) return;
		const index =
			Number.isFinite(turnIndex) && turnIndex >= 0
				? turnIndex
				: turns.indexOf(turn);
		const thread = shareThreadPayload(index >= 0 ? index : turns.length - 1);
		// Already published (e.g. viewing a share page): no need to re-publish.
		// Exception: if this local thread is longer than a bare single-turn share,
		// re-publish so the public page can upgrade to the full conversation.
		const idle = readAskButtonIdle(button);
		if (turn.sharePath && turn.fromShare && thread.length <= 1) {
			try {
				await navigator.clipboard.writeText(
					new URL(turn.sharePath, window.location.origin).toString(),
				);
				flashAskButtonFeedback(button, ASK_SHARE_COPIED_LABEL, "copied", idle);
			} catch {
				flashAskButtonFeedback(
					button,
					ASK_CLIPBOARD_FAILED_LABEL,
					"error",
					idle,
				);
			}
			return;
		}
		if (!signedInForHistory) {
			openQuotaDialog("share");
			return;
		}
		applyAskButtonFeedback(button, "Sharing…", "busy");
		try {
			const response = await fetch("/api/ai/share", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question: turn.question,
					lookingFor: turn.lookingFor,
					queries: turn.queries,
					fallbackQueries: turn.fallbackQueries,
					summary: turn.summary || "",
					results: turn.results,
					model: turn.model,
					requestId: turn.requestId,
					shareSlug: turn.shareSlug,
					...(turn.research || turn.report ? { research: true } : {}),
					...(turn.report ? { report: turn.report } : {}),
					...(turn.reasoning ? { reasoning: turn.reasoning } : {}),
					...(typeof turn.rerankCandidateCount === "number" &&
					turn.rerankCandidateCount > 0
						? { candidateCount: turn.rerankCandidateCount }
						: {}),
					...(thread.length > 1 ? { thread } : {}),
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				path?: string;
				slug?: string;
				error?: string;
			};
			if (!response.ok || !data.success || !data.path) {
				flashAskButtonFeedback(
					button,
					data.error || ASK_SHARE_FAILED_LABEL,
					"error",
					idle,
				);
				return;
			}
			turn.shareSlug = data.slug || turn.shareSlug;
			turn.sharePath = data.path;
			const url = new URL(data.path, window.location.origin).toString();
			await navigator.clipboard.writeText(url);
			flashAskButtonFeedback(button, ASK_SHARE_COPIED_LABEL, "copied", idle);
			persistSessionFromTurn(turn);
		} catch {
			flashAskButtonFeedback(button, ASK_SHARE_FAILED_LABEL, "error", idle);
		}
	}

	async function sendFeedback(
		turn: AiAskTurn,
		rating: "up" | "down",
	): Promise<void> {
		if (!turn.requestId || turn.feedback === "up" || turn.feedback === "down") {
			return;
		}
		turn.feedback = "sending";
		syncLayout();
		try {
			const response = await fetch("/api/ai/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					requestId: turn.requestId,
					rating,
					question: turn.question,
					queries: turn.queries,
					resultSlugs: turn.results.map((hit) => hit.slug),
				}),
			});
			if (!response.ok) {
				turn.feedback = undefined;
				syncLayout();
				return;
			}
			turn.feedback = rating;
			persistSessionFromTurn(turn);
			try {
				const { track } = await import("@vercel/analytics");
				track("ask_feedback", { rating });
			} catch {
				/* analytics optional */
			}
			syncLayout();
		} catch {
			turn.feedback = undefined;
			syncLayout();
		}
	}

	function renderClarifyCardHtml(turn: AiAskTurn, turnIndex: number): string {
		const draft = turn.researchClarify;
		if (!draft) return "";
		const questions = draft.questions
			.map((question, qIndex) => {
				const selected = draft.answers[question.id]?.choiceId || "";
				const otherText = draft.answers[question.id]?.otherText || "";
				const chips = question.choices
					.map((choice) => {
						const on = selected === choice.id;
						return `<button type="button" class="ai-clarify-choice${on ? " is-on" : ""}" data-ai-clarify-choice data-turn-index="${turnIndex}" data-question-id="${escapeHtml(question.id)}" data-choice-id="${escapeHtml(choice.id)}" role="radio" aria-checked="${on ? "true" : "false"}">${escapeHtml(choice.label)}</button>`;
					})
					.join("");
				const otherField =
					selected === RESEARCH_CLARIFY_OTHER_ID
						? `<textarea class="ai-clarify-other" data-ai-clarify-other data-turn-index="${turnIndex}" data-question-id="${escapeHtml(question.id)}" rows="2" maxlength="${RESEARCH_CLARIFY_MAX_OTHER}" placeholder="Add a short note">${escapeHtml(otherText)}</textarea>`
						: "";
				return `<div class="ai-clarify-q" role="radiogroup" aria-label="${escapeHtml(question.prompt)}">
					<p class="ai-clarify-prompt">${qIndex + 1}. ${escapeHtml(question.prompt)}</p>
					<div class="ai-clarify-choices">${chips}</div>
					${otherField}
				</div>`;
			})
			.join("");
		return `<div class="ai-clarify">
			<p class="ai-clarify-title">${escapeHtml(RESEARCH_CLARIFY_TITLE)}</p>
			${questions}
		</div>`;
	}

	function renderDeclineCardHtml(turn: AiAskTurn, turnIndex: number): string {
		const message =
			turn.researchDeclined?.message ||
			"This Research only reads the early discourses on this site.";
		return `<div class="ai-clarify-decline">
			<p>${escapeHtml(message)}</p>
			<div class="ai-clarify-actions">
				<button type="button" class="ai-share-btn" data-ai-research-ask-instead data-turn-index="${turnIndex}">Ask instead</button>
				<button type="button" class="ai-share-btn" data-ai-edit-question data-turn-index="${turnIndex}">Edit question</button>
			</div>
		</div>`;
	}

	function renderTurn(turn: AiAskTurn, turnIndex: number): string {
		const primaryQueries = queryChipsHtml(turn.queries, "ai-queries");
		const fallbackQueries =
			turn.fallbackQueries.length > 0
				? `<div class="ai-fallbacks"><span class="ai-fallbacks-label">Also tried</span>${queryChipsHtml(turn.fallbackQueries, "ai-queries ai-queries-fallback")}</div>`
				: "";
		const cacheNote = turn.fromSample
			? `<p class="ai-cache-note">${escapeHtml(
					turn.research ? RESEARCH_SAMPLE_NOTE : ASK_SAMPLE_NOTE,
				)}</p>`
			: "";
		// Latest lines stay visible; older reasoning is clipped unless expanded.
		const reasoningText = displayAskReasoning(turn.reasoning, turn.pending);
		let thinking = "";
		if (reasoningText) {
			thinking = renderAskThinkingItemHtml({
				reasoningText,
				pending: turn.pending,
				reasoningExpanded: turn.reasoningExpanded,
				turnIndex,
			});
		} else if (!turn.pending && turn.degraded) {
			thinking = renderAskThinkingItemHtml({
				reasoningText: "",
				pending: false,
				degradedNote: `<p>Simplified search plan — the model’s rewrite JSON was missing or its query chips were unusable, so short topical searches were built from your question instead.</p>`,
				turnIndex,
			});
		}
		const process = processStepsHtml(
			askProcessStepsFromTurn(turn),
			{
				afterFirst: thinking,
				footer:
					formatAskRoutingDevHtml(turn.routing) +
					formatAskDebugDevHtml(turn.debug),
			},
		);
		const summaryText = (turn.summary || "").trim();
		const reportText = (turn.report || "").trim();
		const hasHits = turn.results.length > 0;
		const summary = reportText
			? wrapAskAnswerHtml({
					kind: "report",
					kicker: turn.fromSample
						? RESEARCH_SAMPLE_KICKER
						: "Research report",
					turnIndex,
					bodyHtml: renderResearchReportHtml(reportText, turn.results, {
						citationPopovers: true,
					}),
				})
			: hasHits && summaryText
				? wrapAskAnswerHtml({
						kind: "answer",
						turnIndex,
						bodyHtml: renderAskBriefingHtml(summaryText, turn.results),
					}) +
					(!quota?.signedIn &&
					isAskResearchEnabled() &&
					!researchPaneOn() &&
					!turn.research &&
					!turn.fromSample &&
					turnIndex === turns.length - 1
						? `<p class="ai-research-invite"><a href="${escapeHtml(searchResearchHref())}">${escapeHtml(RESEARCH_INVITE_AFTER_ASK)}</a></p>`
						: "")
				: !turn.pending && turn.rankedBySearchOnly && hasHits
					? `<p class="ai-result-meta">Ranked by library search only — the rescorer was unavailable, so there is no briefing this time.</p>`
					: "";
		const captionText = hasHits
			? askResultsCaption({
					resultCount: turn.results.length,
					candidateCount: turn.rerankCandidateCount,
					research: turn.research === true,
				})
			: "";
		const hideQueryChips = turn.offTopic || !hasHits;
		const queryBlock = hideQueryChips ? "" : primaryQueries;
		const fallbackBlock = hideQueryChips ? "" : fallbackQueries;
		let body = "";
		if (turn.researchDeclined && !turn.researchJobId) {
			body = renderDeclineCardHtml(turn, turnIndex);
		} else if (isClarifyingTurn(turn)) {
			body = renderClarifyCardHtml(turn, turnIndex);
		} else if (turn.error) {
			const retryResearch = isIncompleteResearchTurn(turn);
			const retry =
				!turn.fromShare && turnIndex === turns.length - 1
					? `<div class="ai-error-actions">
						<button type="button" class="ai-error-retry" ${
							retryResearch
								? `data-ai-research-retry data-turn-index="${turnIndex}"`
								: `data-ai-edit-question data-turn-index="${turnIndex}"`
						}>
							${retryResearch ? "Research again" : "Try again"}
						</button>
					</div>`
					: "";
			// Keep the process strip + any streamed thinking so a timeout or
			// refusal stall is still inspectable after the error lands.
			body = `${process}<p class="ai-error">${escapeHtml(turn.error)}</p>${retry}${shareActionsHtml(turn, turnIndex)}`;
		} else if (turn.pending && !hasHits) {
			const emailNote =
				turn.research && turn.researchJobId
					? `<p class="ai-research-note">${escapeHtml(RESEARCH_EMAIL_PENDING_NOTE)}</p>`
					: "";
			body = `${process}${emailNote}
				<div class="ai-loading" role="status">
					<span class="ai-spinner"></span>
					<span class="sr-only">${turn.research ? "Working on your research" : "Working on your Ask"}</span>
				</div>
				${turn.phase === "verify" || turn.phase === "search" || turn.phase === "rerank" ? skeletonHtml() : ""}`;
		} else {
			const personHits = (turn.persons || [])
				.map(renderPersonHit)
				.join("");
			const personBlock = personHits
				? `<div class="ai-persons">${personHits}</div>`
				: "";
			const hitCards =
				turn.results.length > 0
					? turn.results
							.map((hit) => renderHit(hit, turn.research === true))
							.join("")
					: "";
			const hits =
				hitCards && captionText
					? researchSourcesBlockHtml(escapeHtml(captionText), hitCards)
					: hitCards
						? `<div class="ai-hits">${hitCards}</div>`
						: personBlock
							? ""
							: emptyHitsHtml(turn);
			body = `${cacheNote}${process}${summary}${queryBlock}${fallbackBlock}${personBlock}${hits}${shareActionsHtml(turn, turnIndex)}${feedbackHtml(turn, turnIndex)}`;
		}
		const backLabel = shareMode ? "Ask your own question" : "Back to earlier questions";
		const backBtn =
			turnIndex === 0
				? `<button type="button" class="ai-back" data-ai-back aria-label="${backLabel}" title="${backLabel}">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="18" height="18" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
					</svg>
				</button>`
				: "";
		// Failed turns stay editable so the reader can fix wording or retry.
		// Shared snapshots stay fixed — follow-up is not offered on a share page.
		const canEdit =
			!turn.fromShare &&
			!turn.pending &&
			turnIndex === turns.length - 1;
		const retryResearch = isIncompleteResearchTurn(turn);
		const editTitle = retryResearch
			? "Edit and research again"
			: "Edit and ask again";
		const editBtn = canEdit
			? `<button type="button" class="ai-edit-btn" data-ai-edit-question data-turn-index="${turnIndex}" aria-label="Edit question" title="${editTitle}">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="14" height="14" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
					</svg>
				</button>`
			: "";
		return `<section class="ai-turn" data-pending="${turn.pending ? "1" : "0"}">
			<div class="ai-question-row">
				${backBtn}
				<div class="ai-question-wrap" data-ai-question>
					<p class="ai-question" data-ai-question-text>${escapeHtml(turn.question)}</p>
					<button type="button" class="ai-question-more" data-ai-question-more hidden aria-expanded="false">Show more</button>
				</div>
				${editBtn}
			</div>
			${body}
		</section>`;
	}

	let historyTab: AskHistoryTab = "recent";
	let historyExpanded = false;

	function laneHistorySamples(): AiAskSamplePublic[] {
		const lane = historyLane();
		return visibleHistorySamples({
			samples: askSamples,
			research: researchPaneOn(),
			ownCount: lane.length,
			ownQuestionKeys: new Set(
				lane.map((item) => normalizeAskQuestionKey(item.question)),
			),
			hiddenKeys: hiddenSampleKeys,
		});
	}

	function historyCardHtml(
		entry: AiAskSessionEntry,
		options?: { sampleSlug?: string },
	): string {
		const paneResearch = researchPaneOn();
		const sample = Boolean(options?.sampleSlug);
		const when = formatAskRelativeTime(entry.at);
		const threadCount = entry.thread?.length || 0;
		const pinMark = entry.saved
			? `<span class="ai-history-pin" title="${threadCount > 1 ? "Pinned conversation" : "Pinned"}" aria-label="${threadCount > 1 ? "Pinned conversation" : "Pinned"}">${PIN_ICON_SVG}</span>`
			: "";
		const statsLabel = paneResearch
			? researchHistoryStatsLabel(
					entry.report,
					entry.results,
					entry.reportStats,
				)
			: "";
		const resultIds = paneResearch
			? ""
			: entry.results
					.slice(0, 6)
					.map((hit) => transformId(hit.slug))
					.filter(Boolean)
					.join(" · ");
		const resultsText = paneResearch ? statsLabel : resultIds;
		const resultsRow = resultsText
			? `<span class="ai-history-results">${escapeHtml(resultsText)}</span>`
			: "";
		const threadRow =
			!sample && threadCount > 1
				? `<span class="ai-history-thread">${threadCount} turns in this conversation</span>`
				: "";
		const researchLabel = sample
			? ASK_SAMPLE_MENU_LABEL
			: researchHistoryStatusLabel(entry);
		const statusMods = sample
			? ""
			: `${entry.researchPending ? " is-pending" : ""}${entry.researchUnread ? " is-ready" : ""}`;
		const researchRow = researchLabel
			? `<span class="ai-history-research${statusMods}">${escapeHtml(researchLabel)}</span>`
			: "";
		const unreadDot =
			!sample && entry.researchUnread
				? `<span class="ai-history-unread" aria-label="Unread"></span>`
				: "";
		const rootQuestion =
			threadCount > 1 && entry.thread?.[0]?.question
				? entry.thread[0].question
				: "";
		const rootRow =
			!sample &&
			rootQuestion &&
			normalizeAskQuestionKey(rootQuestion) !==
				normalizeAskQuestionKey(entry.question)
				? `<span class="ai-history-root">Started with: ${escapeHtml(rootQuestion)}</span>`
				: "";
		const q = escapeHtml(entry.question);
		const sampleAttr = options?.sampleSlug
			? ` data-ai-history-sample="${escapeHtml(options.sampleSlug)}"`
			: "";
		const jobAttr =
			!sample && entry.researchJobId
				? ` data-ai-history-job="${escapeHtml(entry.researchJobId)}"`
				: "";
		const pinAction = entry.saved
			? paneResearch
				? RESEARCH_UNPIN_ACTION
				: "Unpin"
			: paneResearch
				? RESEARCH_PIN_ACTION
				: "Pin";
		const { showPin, showShare, showDelete } = askHistoryCardMenuFlags({
			sample,
			signedInForHistory,
		});
		const menuItems = [
			showPin
				? `<button type="button" role="menuitem" data-ai-history-pin data-ai-history-q="${q}"${sampleAttr}${jobAttr}>${pinAction}</button>`
				: "",
			showShare
				? `<button type="button" role="menuitem" data-ai-history-share data-ai-history-q="${q}"${sampleAttr}${jobAttr}>Share link</button>`
				: "",
			showDelete
				? `<button type="button" role="menuitem" class="is-danger" data-ai-history-delete data-ai-history-q="${q}"${sampleAttr}${jobAttr}>Delete</button>`
				: "",
		]
			.filter(Boolean)
			.join("");
		const menu = menuItems
			? `<div class="ai-history-menu">
							<button type="button" class="ai-history-menu-btn" data-ai-history-menu-toggle data-ai-history-q="${q}"${jobAttr}${sampleAttr} aria-label="${paneResearch ? RESEARCH_OPTIONS_ARIA : ASK_OPTIONS_ARIA}" aria-expanded="false" title="${paneResearch ? RESEARCH_OPTIONS_ARIA : ASK_OPTIONS_ARIA}">
								${MORE_ICON_SVG}
							</button>
							<div class="ai-history-menu-panel" hidden role="menu">
								${menuItems}
							</div>
						</div>`
			: "";
		return `<div class="ai-history-card${entry.saved ? " is-pinned" : ""}${entry.researchUnread ? " is-unread" : ""}${entry.researchPending ? " is-research-pending" : ""}${sample ? " is-sample" : ""}">
						<button type="button" class="ai-history-item" data-ai-history-q="${q}"${jobAttr}${sampleAttr}>
							<span class="ai-history-top">
								${unreadDot}
								<span class="ai-history-q">${q}</span>
								<span class="ai-history-meta">${pinMark}${when ? `<span class="ai-history-when">${escapeHtml(when)}</span>` : ""}</span>
							</span>
							${rootRow}
							${threadRow}
							${researchRow}
							${resultsRow}
						</button>
						${menu}
					</div>`;
	}

	function renderHistory(options?: { focusTab?: boolean }): void {
		if (!historyEl) return;
		if (root.classList.contains("is-restoring-research")) {
			historyEl.hidden = true;
			return;
		}
		if (turns.length > 0) {
			historyEl.hidden = true;
			historyEl.innerHTML = "";
			return;
		}
		const lane = historyLane();
		const paneResearch = researchPaneOn();
		const samples = laneHistorySamples();
		if (lane.length === 0 && samples.length === 0) {
			historyEl.hidden = true;
			historyEl.innerHTML = "";
			return;
		}
		const pinned = pinnedAskHistoryEntries(lane);
		const activeTab = resolveAskHistoryTab(lane, historyTab);
		historyTab = activeTab;
		const ordered = askHistoryEntriesForTab(lane, activeTab);
		const tabSamples = activeTab === "pinned" ? [] : samples;
		const ownVisible = visibleAskHistoryEntries(
			lane,
			activeTab,
			historyExpanded,
		);
		let shownSamples = tabSamples;
		let shownOwn = ownVisible;
		if (activeTab !== "pinned" && !historyExpanded) {
			shownSamples = tabSamples.slice(0, ASK_HISTORY_PREVIEW_LIMIT);
			shownOwn = ownVisible.slice(
				0,
				Math.max(0, ASK_HISTORY_PREVIEW_LIMIT - shownSamples.length),
			);
		}
		const hiddenCount =
			activeTab === "pinned"
				? 0
				: Math.max(
						0,
						ordered.length +
							tabSamples.length -
							shownOwn.length -
							shownSamples.length,
					);
		const items = [
			...shownSamples.map((sample) =>
				historyCardHtml(sampleToHistoryEntry(sample), {
					sampleSlug: sample.slug,
				}),
			),
			...shownOwn.map((entry) => historyCardHtml(entry)),
		].join("");
		const moreRow =
			hiddenCount > 0
				? historyExpanded
					? `<button type="button" class="ai-history-more" data-ai-history-more>Show fewer</button>`
					: `<button type="button" class="ai-history-more" data-ai-history-more>More · ${hiddenCount} older</button>`
				: "";
		const hint =
			activeTab === "pinned"
				? ASK_HISTORY_HINT_PINNED
				: ASK_HISTORY_HINT_RECENT;
		const historyAria = paneResearch ? RESEARCH_HISTORY_ARIA : ASK_HISTORY_ARIA;
		const recentLabel = paneResearch ? RESEARCH_HISTORY_LABEL : ASK_HISTORY_LABEL;
		const heading =
			lane.length === 0 && tabSamples.length === 0
				? ""
				: pinned.length > 0
					? `<div class="ai-history-heading">
			<div class="ai-history-tabs" role="tablist" aria-label="${historyAria}">
				<button type="button" class="ai-history-tab" role="tab" aria-selected="${activeTab === "recent" ? "true" : "false"}" data-ai-history-tab="recent">Recent</button>
				<button type="button" class="ai-history-tab" role="tab" aria-selected="${activeTab === "pinned" ? "true" : "false"}" data-ai-history-tab="pinned">Pinned <span class="ai-history-tab-count">${pinned.length}</span></button>
			</div>
			<p class="ai-history-hint">${hint}</p>
		</div>`
					: `<div class="ai-history-heading">
			<p class="ai-history-label">${recentLabel}</p>
			<p class="ai-history-hint">${hint}</p>
		</div>`;
		historyEl.innerHTML = `${heading}<div class="ai-history-list">${items}</div>${moreRow}`;
		historyEl.hidden = false;

		if (options?.focusTab) {
			historyEl
				.querySelector<HTMLButtonElement>(
					`[data-ai-history-tab="${activeTab}"]`,
				)
				?.focus();
		}

		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-tab]")
			.forEach((button) => {
				button.addEventListener("click", () => {
					const next = button.getAttribute("data-ai-history-tab");
					if (next !== "recent" && next !== "pinned") return;
					if (next === historyTab) return;
					historyTab = next;
					historyExpanded = false;
					renderHistory({ focusTab: true });
				});
			});

		historyEl
			.querySelector<HTMLButtonElement>("[data-ai-history-more]")
			?.addEventListener("click", () => {
				historyExpanded = !historyExpanded;
				renderHistory();
			});

		const closeAllMenus = (): void => {
			historyEl.querySelectorAll<HTMLElement>(".ai-history-menu-panel").forEach(
				(panel) => {
					panel.hidden = true;
				},
			);
			historyEl
				.querySelectorAll<HTMLButtonElement>("[data-ai-history-menu-toggle]")
				.forEach((toggle) => {
					toggle.setAttribute("aria-expanded", "false");
				});
		};

		const sampleFromButton = (
			button: Element,
		): AiAskSamplePublic | undefined => {
			const slug = button.getAttribute("data-ai-history-sample") || "";
			if (!slug) return undefined;
			return askSamples.find((item) => item.slug === slug);
		};

		const entryFromButton = (button: Element): AiAskSessionEntry | undefined => {
			const question = button.getAttribute("data-ai-history-q") || "";
			const jobId = button.getAttribute("data-ai-history-job") || "";
			return findLaneEntry(question, jobId || undefined);
		};

		historyEl.querySelectorAll<HTMLButtonElement>("[data-ai-history-q]").forEach(
			(button) => {
				if (!button.classList.contains("ai-history-item")) return;
				button.addEventListener("click", () => {
					const sample = sampleFromButton(button);
					if (sample) {
						if (busy && !turns.every((turn) => turn.fromSample)) return;
						openAskSample(sample);
						return;
					}
					const entry = entryFromButton(button);
					if (!entry) return;
					openHistoryEntry(entry);
				});
			},
		);
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-menu-toggle]")
			.forEach((toggle) => {
				toggle.addEventListener("click", (event) => {
					event.stopPropagation();
					const menu = toggle.closest(".ai-history-menu");
					const panel = menu?.querySelector<HTMLElement>(".ai-history-menu-panel");
					if (!panel) return;
					const willOpen = panel.hidden;
					closeAllMenus();
					if (willOpen) {
						panel.hidden = false;
						toggle.setAttribute("aria-expanded", "true");
					}
				});
			});
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-pin]")
			.forEach((button) => {
				button.addEventListener("click", (event) => {
					event.stopPropagation();
					const sample = sampleFromButton(button);
					closeAllMenus();
					if (sample) {
						toggleHistoryEntryPin({
							...sampleToHistoryEntry(sample),
							saved: false,
						});
						return;
					}
					const entry = entryFromButton(button);
					if (entry) toggleHistoryEntryPin(entry);
				});
			});
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-share]")
			.forEach((button) => {
				button.addEventListener("click", (event) => {
					event.stopPropagation();
					if (!signedInForHistory) closeAllMenus();
					const sample = sampleFromButton(button);
					if (sample) {
						void shareHistoryEntry(sampleToHistoryEntry(sample), button);
						return;
					}
					const entry = entryFromButton(button);
					if (entry) void shareHistoryEntry(entry, button);
				});
			});
		historyEl
			.querySelectorAll<HTMLButtonElement>("[data-ai-history-delete]")
			.forEach((button) => {
				button.addEventListener("click", (event) => {
					event.stopPropagation();
					const sample = sampleFromButton(button);
					closeAllMenus();
					if (sample) {
						openConfirmDialog(
							ASK_SAMPLE_HIDE_TITLE,
							ASK_SAMPLE_HIDE_CONFIRM,
							() => {
								hiddenSampleKeys = hideAskSampleKey(
									askSampleHideKey(sample, researchPaneOn()),
									typeof localStorage === "undefined"
										? null
										: localStorage,
								);
								renderHistory();
							},
						);
						return;
					}
					const entry = entryFromButton(button);
					if (entry) deleteHistoryEntry(entry);
				});
			});
	}

	let syncTimer = 0;

	function toggleTurnThinking(turnIndex: number): void {
		const turn = turns[turnIndex];
		if (!turn) return;
		turn.reasoningExpanded = !turn.reasoningExpanded;
		if (!applyAskThinkingStreamPatch(thread, turn, turnIndex)) {
			syncLayout();
		}
	}

	function syncLayout(): void {
		if (syncTimer) {
			window.clearTimeout(syncTimer);
			syncTimer = 0;
		}
		const hasThread = turns.length > 0;
		root.classList.toggle("has-thread", hasThread);
		const last = turns[turns.length - 1];
		const clarifying = isClarifyingTurn(last);
		const declinedOpen =
			Boolean(last?.researchDeclined) && !last?.researchJobId;
		const researchBusy = turns.some(
			(turn) => turn.pending && turn.research && turn.researchJobId,
		);
		const reportDock = Boolean(
			last?.research && !last.pending && !clarifying && !declinedOpen,
		);
		root.classList.toggle("is-research-busy", researchBusy);
		root.classList.toggle("is-report-dock", reportDock);
		syncStopButtons(researchBusy);
		const threadPending = turns.some((turn) => turn.pending);
		if (followInput) followInput.disabled = threadPending;
		followForm
			?.querySelectorAll<HTMLButtonElement>("[data-ai-mic]")
			.forEach((button) => {
				button.disabled = threadPending;
			});
		syncResearchChip();
		const restoring = root.classList.contains("is-restoring-research");
		empty.hidden = hasThread || shareMode || restoring;
		composer.hidden = hasThread || shareMode || restoring;
		if (historyEl) {
			if (hasThread || restoring || shareMode) {
				historyEl.hidden = true;
			} else if (historyEl.hidden) {
				renderHistory();
			}
		}
		if (followForm) {
			followForm.hidden =
				shareMode || !hasThread || clarifying || declinedOpen;
		}
		syncClarifyBar();
		hideDiscourseCitationPopover();
		thread.innerHTML = turns.map((turn, index) => renderTurn(turn, index)).join("");
		thread.querySelectorAll<HTMLElement>("[data-ai-feedback-turn]").forEach((row) => {
			const index = Number(row.getAttribute("data-ai-feedback-turn"));
			const turn = turns[index];
			if (!turn) return;
			row.querySelectorAll<HTMLButtonElement>("[data-ai-feedback]").forEach((button) => {
				button.addEventListener("click", () => {
					const rating = button.getAttribute("data-ai-feedback");
					if (rating === "up" || rating === "down") {
						void sendFeedback(turn, rating);
					}
				});
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-back]").forEach((button) => {
			button.addEventListener("click", () => {
				if (shareMode) {
					window.location.assign(ASK_HOME_HREF);
					return;
				}
				leaveAskHome();
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-share]").forEach((button) => {
			button.addEventListener("click", () => {
				const index = Number(button.getAttribute("data-turn-index"));
				const turn = turns[index];
				if (turn) void copyShareLink(turn, button, index);
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-sample-save]").forEach(
			(button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					const turn = turns[index];
					if (turn) void saveTurnAsSample(turn);
				});
			},
		);
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-sample-remove]").forEach(
			(button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					const turn = turns[index];
					if (turn) removeTurnSample(turn);
				});
			},
		);
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-download]").forEach((button) => {
			button.addEventListener("click", () => {
				openAskDownload();
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-copy-answer]").forEach((button) => {
			button.addEventListener("click", () => {
				const index = Number(button.getAttribute("data-turn-index"));
				const turn = turns[index];
				if (turn) void copyAskAnswer(turn, button);
			});
		});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-pin]").forEach((button) => {
			button.addEventListener("click", () => {
				const index = Number(button.getAttribute("data-turn-index"));
				const turn = turns[index];
				if (turn) toggleSaveTurn(turn);
			});
		});
		thread
			.querySelectorAll<HTMLButtonElement>("[data-ai-delete-turn]")
			.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					const turn = turns[index];
					if (turn) deleteOpenAskTurn(turn);
				});
			});
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-edit-question]").forEach(
			(button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					beginEditQuestion(index);
				});
			},
		);
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-research-retry]").forEach(
			(button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					void retryIncompleteResearchTurn(index);
				});
			},
		);
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-clarify-choice]").forEach(
			(button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					const questionId = button.getAttribute("data-question-id") || "";
					const choiceId = button.getAttribute("data-choice-id") || "";
					const turn = turns[index];
					if (!turn?.researchClarify || !questionId || !choiceId) return;
					turn.researchClarify.answers = {
						...turn.researchClarify.answers,
						[questionId]: {
							choiceId,
							...(choiceId === RESEARCH_CLARIFY_OTHER_ID
								? { otherText: turn.researchClarify.answers[questionId]?.otherText || "" }
								: {}),
						},
					};
					syncLayout();
					if (choiceId === RESEARCH_CLARIFY_OTHER_ID) {
						const other = thread.querySelector<HTMLTextAreaElement>(
							`[data-ai-clarify-other][data-question-id="${questionId}"]`,
						);
						other?.focus();
						if (other) fitClarifyOther(other);
					}
				});
			},
		);
		thread.querySelectorAll<HTMLTextAreaElement>("[data-ai-clarify-other]").forEach(
			(inputEl) => {
				fitClarifyOther(inputEl);
				inputEl.addEventListener("input", () => {
					const index = Number(inputEl.getAttribute("data-turn-index"));
					const questionId = inputEl.getAttribute("data-question-id") || "";
					const turn = turns[index];
					if (!turn?.researchClarify || !questionId) return;
					const currentAnswer = turn.researchClarify.answers[questionId] || {
						choiceId: RESEARCH_CLARIFY_OTHER_ID,
					};
					turn.researchClarify.answers = {
						...turn.researchClarify.answers,
						[questionId]: {
							...currentAnswer,
							choiceId: RESEARCH_CLARIFY_OTHER_ID,
							otherText: inputEl.value.slice(0, RESEARCH_CLARIFY_MAX_OTHER),
						},
					};
					fitClarifyOther(inputEl);
					syncClarifyBar();
				});
			},
		);
		thread
			.querySelectorAll<HTMLButtonElement>("[data-ai-research-ask-instead]")
			.forEach((button) => {
				button.addEventListener("click", () => {
					const index = Number(button.getAttribute("data-turn-index"));
					const turn = turns[index];
					if (!turn) return;
					const question = turn.question;
					turns = turns.filter((item) => item !== turn);
					setResearchChipOn(false);
					syncLayout();
					void ask(question, followInput || input);
				});
			});
		if (thread) pinClampedAskThinking(thread);
		bindQuestionExpand();
		if (!shareMode) renderHistory();
		scheduleFollowDockFrost();
	}

	let followDockFrostRaf = 0;

	function followDockOverlapsThread(): boolean {
		if (!followForm || followForm.hidden) return false;
		const dock = followForm.getBoundingClientRect();
		for (const child of thread.children) {
			const rect = child.getBoundingClientRect();
			if (rect.bottom > dock.top + 2 && rect.top < dock.bottom - 2) {
				return true;
			}
		}
		return false;
	}

	function syncFollowDockFrost(): void {
		followForm?.classList.toggle("is-over-thread", followDockOverlapsThread());
	}

	function scheduleFollowDockFrost(): void {
		if (followDockFrostRaf) return;
		followDockFrostRaf = window.requestAnimationFrame(() => {
			followDockFrostRaf = 0;
			syncFollowDockFrost();
		});
	}

	function syncQuestionExpandState(wrap: HTMLElement): void {
		const text = wrap.querySelector<HTMLElement>("[data-ai-question-text]");
		const more = wrap.querySelector<HTMLButtonElement>("[data-ai-question-more]");
		if (!text || !more) return;
		const expanded = wrap.classList.contains("is-expanded");
		if (expanded) {
			more.hidden = false;
			more.textContent = "Show less";
			more.setAttribute("aria-expanded", "true");
			return;
		}
		const overflowing = text.scrollHeight > text.clientHeight + 2;
		more.hidden = !overflowing;
		more.textContent = "Show more";
		more.setAttribute("aria-expanded", "false");
	}

	function bindQuestionExpand(): void {
		thread.querySelectorAll<HTMLElement>("[data-ai-question]").forEach((wrap) => {
			const more = wrap.querySelector<HTMLButtonElement>("[data-ai-question-more]");
			if (!more) return;
			more.addEventListener("click", () => {
				wrap.classList.toggle("is-expanded");
				syncQuestionExpandState(wrap);
			});
			requestAnimationFrame(() => syncQuestionExpandState(wrap));
		});
	}

	function beginEditQuestion(turnIndex: number): void {
		if (busy) return;
		const turn = turns[turnIndex];
		if (!turn || turn.pending || turn.fromShare || turnIndex !== turns.length - 1) {
			return;
		}
		const row = thread.querySelectorAll(".ai-question-row")[turnIndex];
		if (!row) return;
		const existing = row.querySelector(".ai-question-edit");
		if (existing) return;
		row.querySelector("[data-ai-question]")?.remove();
		row.querySelector("[data-ai-edit-question]")?.remove();
		const wrap = document.createElement("div");
		wrap.className = "ai-question-edit";
		const researchEdit = turn.research === true;
		const submitLabel = researchRetrySubmitLabel(researchEdit);
		const researchLeft =
			researchEdit &&
			quota?.signedIn &&
			typeof researchQuota?.remaining === "number"
				? askMeterLabel({
						signedIn: true,
						needsEmailVerification: quota.needsEmailVerification,
						researchOn: true,
						askRemaining: quota.remaining,
						researchRemaining: researchQuota.remaining,
					})
				: "";
		wrap.innerHTML = `
			<label class="sr-only" for="ai-edit-question">Edit question</label>
			<textarea id="ai-edit-question" data-ai-edit-input rows="2"></textarea>
			<div class="ai-question-edit-actions">
				<button type="button" data-ai-edit-submit>${submitLabel}</button>
				${
					researchEdit
						? `<button type="button" data-ai-edit-ask-instead>${researchEditAskInsteadLabel()}</button>`
						: ""
				}
				<button type="button" data-ai-edit-cancel>Cancel</button>
				${
					researchLeft
						? `<span class="ai-question-edit-meter" aria-live="polite">${escapeHtml(researchLeft)}</span>`
						: ""
				}
			</div>
		`;
		row.append(wrap);
		const editInput = wrap.querySelector<HTMLTextAreaElement>("[data-ai-edit-input]");
		if (!editInput) return;
		editInput.value = turn.question;
		fitTextarea(editInput);
		editInput.focus();
		editInput.setSelectionRange(editInput.value.length, editInput.value.length);

		const cancel = (): void => {
			syncLayout();
		};
		const editedQuestion = (): string =>
			editInput.value.replace(/\s+/g, " ").trim();
		const submitResearch = (): void => {
			const next = editedQuestion();
			if (!next || busy) return;
			if (isIncompleteResearchTurn(turn)) {
				void retryIncompleteResearchTurn(turnIndex, next);
				return;
			}
			setResearchChipOn(true);
			void ask(next, null, { replaceTurnIndex: turnIndex, forceResearch: true });
		};
		const submitAsk = (): void => {
			const next = editedQuestion();
			if (!next || busy) return;
			setResearchChipOn(false);
			void ask(next, null, { replaceTurnIndex: turnIndex, forceAsk: true });
		};
		const submit = (): void => {
			if (researchEdit) {
				submitResearch();
				return;
			}
			const next = editedQuestion();
			if (!next || busy) return;
			void ask(next, null, { replaceTurnIndex: turnIndex });
		};
		wrap.querySelector("[data-ai-edit-cancel]")?.addEventListener("click", cancel);
		wrap.querySelector("[data-ai-edit-submit]")?.addEventListener("click", submit);
		wrap
			.querySelector("[data-ai-edit-ask-instead]")
			?.addEventListener("click", submitAsk);
		editInput.addEventListener("input", () => fitTextarea(editInput));
		editInput.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				event.preventDefault();
				cancel();
				return;
			}
			if (isAskSendShortcut(event)) {
				event.preventDefault();
				submit();
			}
		});
	}

	function scheduleSync(): void {
		if (syncTimer) return;
		syncTimer = window.setTimeout(() => {
			syncTimer = 0;
			const turnIndex = turns.length - 1;
			const turn = turns[turnIndex];
			if (!turn) return;
			if (applyAskProcessStreamPatch(thread, turn, turnIndex)) return;
			if (turn.pending) syncLayout();
		}, 80);
	}

	function syncLayoutAndReveal(): void {
		syncLayout();
		if (turns.length > 0) {
			thread.lastElementChild?.scrollIntoView({ block: "start" });
		}
	}

	async function loadModels(): Promise<void> {
		if (!showModelPicker || !(modelSelect instanceof HTMLSelectElement)) return;
		try {
			const response = await fetch("/api/ai/models");
			const data = (await response.json()) as AiModelsResponse;
			if (!data.success || data.models.length === 0) return;
			const preferred =
				(isClientFreeModelId(selectedModel) && selectedModel) ||
				data.defaultModel;
			modelSelect.replaceChildren();
			for (const model of data.models) {
				const option = document.createElement("option");
				option.value = model.id;
				option.textContent = model.name;
				if (model.id === preferred) option.selected = true;
				modelSelect.append(option);
			}
			const offered = data.models.map((model) => model.id);
			// A stored or configured model outside the curated shortlist would leave
			// the <select> blank — pick the server default, else the first option.
			const chosen = offered.includes(preferred)
				? preferred
				: offered.includes(data.defaultModel)
					? data.defaultModel
					: offered[0];
			modelSelect.value = chosen;
			selectedModel = chosen;
			syncModelIdCaption();
		} catch {
			/* picker still has the server-rendered default */
		}
	}

	function syncModelIdCaption(): void {
		root.querySelectorAll<HTMLElement>("[data-ai-model-id]").forEach((el) => {
			el.textContent = currentModel();
		});
	}

	function syncStopButtons(researchBusy: boolean): void {
		const sendHint = askSendShortcutLabel();
		root.querySelectorAll<HTMLButtonElement>(".ai-send").forEach((button) => {
			if (researchBusy) {
				button.setAttribute("data-ai-stop", "1");
				button.setAttribute("aria-label", "Pause research");
				button.title = "Pause research";
			} else {
				button.removeAttribute("data-ai-stop");
				button.setAttribute("aria-label", button.closest("[data-ai-follow-form]") ? "Ask follow-up" : researchPaneOn() ? "Research" : "Ask");
				button.title = sendHint;
			}
		});
	}

	async function fetchResearchJob(
		jobId: string,
	): Promise<{ ok: boolean; status: number; job?: ResearchJobPublic; error?: string }> {
		const response = await fetch(`/api/ai/research/${encodeURIComponent(jobId)}`, {
			credentials: "same-origin",
			cache: "no-store",
		});
		let data: {
			job?: ResearchJobPublic;
			error?: string;
			researchQuota?: ResearchQuotaView;
		} = {};
		try {
			data = (await response.json()) as typeof data;
		} catch {
			data = {};
		}
		if (data.researchQuota) applyQuota(quota, data.researchQuota);
		return {
			ok: response.ok,
			status: response.status,
			job: data.job,
			error: data.error,
		};
	}

	async function pollResearchTurn(turn: AiAskTurn): Promise<void> {
		const token = researchPollToken;
		if (!turn.researchJobId) return;
		let stallKey = "";
		let stallSince = Date.now();
		while (turn.pending && turn.researchJobId && token === researchPollToken) {
			const still = await new Promise<boolean>((resolve) => {
				researchPollTimer = window.setTimeout(() => {
					researchPollTimer = 0;
					resolve(token === researchPollToken);
				}, 1500);
			});
			if (!still || token !== researchPollToken) return;
			try {
				const data = await fetchResearchJob(turn.researchJobId);
				if (data.status === 401) {
					window.location.assign(askAuthPageHref("/signin", null, currentReturnTo()));
					return;
				}
				if (!data.ok || !data.job) {
					turn.pending = false;
					turn.phase = "done";
					turn.error = data.error || "Research not found.";
					break;
				}
				const key = `${data.job.status}\0${data.job.progressNote || ""}\0${(data.job.processNotes || []).join("|")}`;
				if (key !== stallKey) {
					stallKey = key;
					stallSince = Date.now();
				}
				applyResearchJobToTurn(turn, data.job);
				if (
					data.job.pending &&
					!(data.job.progressNote || "").trim() &&
					Date.now() - stallSince > 75_000
				) {
					turn.progressNote =
						"Still working… this can take a few minutes.";
				}
				if (data.job.pending) {
					const turnIndex = turns.indexOf(turn);
					if (
						turnIndex < 0 ||
						!applyAskProcessStreamPatch(thread, turn, turnIndex)
					) {
						const y = window.scrollY;
						syncLayout();
						window.scrollTo({ top: y, left: 0, behavior: "auto" });
					}
					continue;
				}
				syncLayoutAndReveal();
				break;
			} catch {
				turn.pending = false;
				turn.phase = "done";
				turn.error = "Network error. Try again.";
				break;
			}
		}
		if (token !== researchPollToken) return;
		if (!turn.pending) {
			void refreshQuota();
		}
		if (!turn.pending && turn.error && turn.research) {
			setResearchChipOn(true);
		}
		if (!turn.pending && !turn.error) {
			setResearchChipOn(false);
			persistSessionFromTurn(turn);
			const hidden = typeof document !== "undefined" && document.hidden;
			persistResearchHistory(turn, { pending: false, unread: hidden });
			if (hidden && turn.researchJobId) {
				void notifyResearchReady({
					question: turn.question,
					jobId: turn.researchJobId,
				});
			}
		}
	}

	async function cancelActiveResearch(): Promise<void> {
		const turn = [...turns]
			.reverse()
			.find((item) => item.pending && item.researchJobId);
		if (!turn?.researchJobId) return;
		stopResearchPoll();
		try {
			const response = await fetch(
				`/api/ai/research/${encodeURIComponent(turn.researchJobId)}`,
				{
					method: "POST",
					credentials: "same-origin",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action: "cancel" }),
				},
			);
			const data = (await response.json()) as {
				job?: ResearchJobPublic;
				researchQuota?: ResearchQuotaView;
			};
			if (data.researchQuota) applyQuota(quota, data.researchQuota);
			if (data.job) applyResearchJobToTurn(turn, data.job);
			else {
				turn.pending = false;
				turn.phase = "done";
				turn.error = "Research stopped.";
			}
		} catch {
			turn.pending = false;
			turn.phase = "done";
			turn.error = "Research stopped.";
		}
		void refreshQuota();
		if (turn.research && !turn.report) setResearchChipOn(true);
		busy = false;
		root.classList.remove("is-busy", "is-research-busy");
		syncLayout();
	}

	async function retryIncompleteResearchTurn(
		turnIndex: number,
		question?: string,
	): Promise<void> {
		const turn = turns[turnIndex];
		if (!turn || busy || turn.fromShare) return;
		const next = (question ?? turn.question).replace(/\s+/g, " ").trim();
		if (!next) return;
		if (turn.researchJobId && sameResearchRetryQuestion(next, turn)) {
			await restartResearchJobTurn(turn, turnIndex);
			return;
		}
		setResearchChipOn(true);
		void ask(next, null, { replaceTurnIndex: turnIndex, forceResearch: true });
	}

	async function restartResearchJobTurn(
		turn: AiAskTurn,
		turnIndex: number,
	): Promise<void> {
		const jobId = turn.researchJobId;
		if (!jobId || busy) return;
		busy = true;
		root.classList.add("is-busy", "is-research-busy");
		turn.pending = true;
		turn.phase = "rewrite";
		turn.error = undefined;
		turn.progressNote = "Starting…";
		turn.report = undefined;
		turn.results = [];
		syncLayout();
		let fallbackAsk = false;
		try {
			const response = await fetch(
				`/api/ai/research/${encodeURIComponent(jobId)}`,
				{
					method: "POST",
					credentials: "same-origin",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action: "retry" }),
				},
			);
			const data = (await response.json()) as {
				job?: ResearchJobPublic;
				error?: string;
				code?: string;
				researchQuota?: ResearchQuotaView;
			};
			if (data.researchQuota) applyQuota(quota, data.researchQuota);
			if (data.code === "research_quota") {
				turn.pending = false;
				turn.phase = "done";
				turn.error = "Research stopped.";
				setResearchChipOn(true);
				openQuotaDialog("research", turn.question);
				return;
			}
			if (!response.ok || !data.job) {
				turn.pending = false;
				turn.phase = "done";
				fallbackAsk = true;
				return;
			}
			applyResearchJobToTurn(turn, data.job);
			setResearchChipOn(false);
			syncResearchJobUrl(data.job.id);
			persistResearchHistory(turn, { pending: true, unread: false });
			persistActiveThread();
			syncLayoutAndReveal();
			await pollResearchTurn(turn);
		} catch {
			turn.pending = false;
			turn.phase = "done";
			turn.error = "Network error. Try again.";
			setResearchChipOn(true);
		} finally {
			busy = false;
			root.classList.remove("is-busy", "is-research-busy");
			syncLayout();
		}
		if (fallbackAsk) {
			setResearchChipOn(true);
			void ask(turn.question, null, {
				replaceTurnIndex: turnIndex,
				forceResearch: true,
			});
		}
	}

	async function restoreResearchJob(
		jobId: string,
		fromHistory?: AiAskSessionEntry,
	): Promise<boolean> {
		let keepRestoring = false;
		try {
			const data = await fetchResearchJob(jobId);
			if (data.status === 401) {
				keepRestoring = true;
				window.location.assign(askAuthPageHref("/signin", null, currentReturnTo()));
				return true;
			}
			if (!data.ok || !data.job) {
				setStatus(data.error || "Research not found.");
				return false;
			}
			const job = data.job;
			const turn: AiAskTurn = {
				question: job.question,
				originalQuestion: job.result?.originalQuestion || job.question,
				lookingFor: "",
				queries: [],
				fallbackQueries: [],
				offTopic: false,
				results: [],
				persons: [],
				model: "",
				reasoning: "",
				summary: "",
				pending: true,
				phase: "rewrite",
				research: true,
				researchJobId: job.id,
			};
			applyResearchJobToTurn(turn, job);
			const history =
				fromHistory ||
				sessionEntries.find((item) => item.researchJobId === job.id);
			const priorTurns = askHistoryEntriesForRestore(history)
				.filter((item) => item.researchJobId !== job.id)
				.map((item) => sessionEntryToTurn(item));
			turns = [...priorTurns, turn];
			syncResearchJobUrl(job.id);
			if (turn.pending) {
				persistResearchHistory(turn, { pending: true, unread: false });
			}
			const remembered = sessionEntries.find((item) => item.researchJobId === job.id);
			if (remembered) markResearchHistoryRead(remembered);
			if (!turn.pending && isIncompleteResearchTurn(turn)) {
				setResearchChipOn(true);
			} else {
				setResearchChipOn(false);
			}
			syncLayoutAndReveal();
			setRestoringResearch(false);
			if (!turn.pending) {
				if (!turn.error) persistSessionFromTurn(turn);
				return true;
			}
			busy = true;
			root.classList.add("is-busy");
			syncLayout();
			await pollResearchTurn(turn);
			busy = false;
			root.classList.remove("is-busy", "is-research-busy");
			syncLayout();
			return true;
		} catch {
			setStatus("Could not load research.");
			return false;
		} finally {
			if (!keepRestoring) {
				setRestoringResearch(false);
				if (turns.length === 0) {
					renderHistory();
					syncLayout();
				}
			}
		}
	}

	function cancelResearchClarify(): void {
		const last = turns[turns.length - 1];
		if (!isClarifyingTurn(last) && !last?.researchDeclined) return;
		turns = turns.slice(0, -1);
		syncLayout();
		if (turns.length === 0) input?.focus();
		else followInput?.focus();
	}

	async function startResearchFromClarify(): Promise<void> {
		const turn = turns[turns.length - 1];
		if (!isClarifyingTurn(turn) || !turn.researchClarify || busy) return;
		const answers = answersFromClarifyState(turn.researchClarify.answers);
		if (!canStartResearchClarify(turn.researchClarify.questions, answers)) return;
		if (researchQuota && !researchQuota.allowed) {
			openQuotaDialog("research", turn.question);
			return;
		}
		busy = true;
		root.classList.add("is-busy");
		optimisticConsumeResearchQuota();
		turn.pending = true;
		turn.phase = "rewrite";
		syncLayout();
		try {
			const response = await fetch("/api/ai/research", {
				method: "POST",
				credentials: "same-origin",
				cache: "no-store",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clarifyId: turn.researchClarify.id,
					answers,
				}),
			});
			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
				code?: string;
				declined?: boolean;
				decline?: { kind?: string; message?: string };
				job?: ResearchJobPublic;
				researchQuota?: ResearchQuotaView;
			};
			if (data.researchQuota) applyQuota(quota, data.researchQuota);
			if (data.declined && data.decline) {
				turn.pending = false;
				turn.phase = "done";
				turn.researchDeclined = {
					kind: data.decline.kind || "off_corpus",
					message: data.decline.message || "",
				};
				void refreshQuota();
				setResearchChipOn(false);
				syncLayout();
				return;
			}
			if (!response.ok || !data.job) {
				turn.pending = false;
				turn.phase = "done";
				setResearchChipOn(true);
				if (data.code === "research_quota") {
					void refreshQuota();
					openQuotaDialog("research", turn.question);
					syncLayout();
					return;
				}
				if (data.code === "clarify_expired") {
					turn.error = data.error || "Those questions expired. Send the topic again.";
					void refreshQuota();
					syncLayout();
					return;
				}
				turn.error = data.error || "Research could not start.";
				void refreshQuota();
				syncLayout();
				return;
			}
			turn.researchClarify = undefined;
			applyResearchJobToTurn(turn, data.job);
			setResearchChipOn(false);
			syncResearchJobUrl(data.job.id);
			persistResearchHistory(turn, { pending: true, unread: false });
			persistActiveThread();
			void requestResearchNotifyPermission();
			syncLayoutAndReveal();
			await pollResearchTurn(turn);
		} catch {
			turn.pending = false;
			turn.phase = "done";
			turn.error = "Network error. Try again.";
			void refreshQuota();
			syncLayout();
		} finally {
			busy = false;
			root.classList.remove("is-busy", "is-research-busy");
			syncLayout();
		}
	}

	async function ask(
		question: string,
		target: HTMLTextAreaElement | null,
		options?: {
			replaceTurnIndex?: number;
			forceResearch?: boolean;
			forceAsk?: boolean;
		},
	): Promise<void> {
		const q = question.replace(/\s+/g, " ").trim();
		if (!q || busy) return;
		stopListening();
		stopSamplePlayback();

		const replaceTurnIndex = options?.replaceTurnIndex;
		const replacing =
			typeof replaceTurnIndex === "number" &&
			replaceTurnIndex >= 0 &&
			replaceTurnIndex < turns.length;
		const replacingTurn = replacing ? turns[replaceTurnIndex] : undefined;

		if (!replacing && turns.length === 0) {
			clearAskResumeFromDiscourse(undefined, { research: researchPaneOn() });
		}

		const useResearch = shouldUseResearchAsk({
			chipOn:
				(researchPaneOn() && turns.length === 0 && !replacing) ||
				(!researchPaneOn() && researchChipOn && researchChipAvailable()),
			followUp: replacing || turns.length > 0,
			lastTurnResearch:
				lastTurnIsResearch() || Boolean(replacingTurn?.research),
			retryIncompleteResearch:
				options?.forceAsk !== true &&
				(options?.forceResearch === true ||
					Boolean(replacingTurn && isIncompleteResearchTurn(replacingTurn))),
			forceAsk: options?.forceAsk === true,
		});

		// Follow-ups must always hit the model (diversity / refinement).
		// Only the first turn of a thread may restore a prior session answer.
		// Edits always re-ask so the stored answer matches the new wording.
		const cached =
			!useResearch && !replacing && turns.length === 0
				? findAiAskSessionEntry(sessionEntries, q, { research: false })
				: undefined;
		if (cached && cached.results.length > 0) {
			turns.push(sessionEntryToTurn(cached));
			if (target) {
				target.value = "";
				fitTextarea(target);
			}
			syncLayoutAndReveal();
			followInput?.focus();
			return;
		}

		if (useResearch) {
			if (!quota?.signedIn) {
				openQuotaDialog("signin", q);
				return;
			}
			if (quota.needsEmailVerification) {
				openQuotaDialog("verify", q);
				return;
			}
			if (researchQuota && !researchQuota.allowed) {
				openQuotaDialog("research", q);
				return;
			}
		} else if (quota && !quota.allowed) {
			openQuotaDialog(
				quota.signedIn
					? "tomorrow"
					: quota.needsEmailVerification
						? "verify"
						: "signin",
				q,
			);
			return;
		}

		busy = true;
		if (target) {
			target.value = "";
			fitTextarea(target);
		}
		setStatus("");
		root.classList.add("is-busy");
		if (!useResearch) optimisticConsumeQuota();
		const restoreOnFail = replacing ? turns.slice() : null;
		if (replacing) {
			const previous = turns[replaceTurnIndex];
			pendingReplaceQuestions =
				previous && !previous.research && !useResearch
					? [previous.question, previous.originalQuestion || ""].filter(
							Boolean,
						)
					: null;
			pendingReplaceJobIds = previous?.researchJobId
				? [previous.researchJobId]
				: null;
			turns = turns.slice(0, replaceTurnIndex);
		} else {
			pendingReplaceQuestions = null;
			pendingReplaceJobIds = null;
		}
		const turn: AiAskTurn = {
			question: q,
			originalQuestion: q,
			lookingFor: "",
			queries: [],
			fallbackQueries: [],
			offTopic: false,
			results: [],
			persons: [],
			model: currentModel(),
			reasoning: "",
			summary: "",
			pending: true,
			phase: "rewrite",
			...(useResearch ? { research: true } : {}),
		};
		turns.push(turn);
		syncLayoutAndReveal();
		const abortReplace = (): void => {
			if (restoreOnFail) {
				turns = restoreOnFail;
				pendingReplaceQuestions = null;
				pendingReplaceJobIds = null;
			} else {
				turns = turns.filter((item) => item !== turn);
			}
		};
		if (useResearch) {
			try {
				const response = await fetch("/api/ai/research/clarify", {
					method: "POST",
					credentials: "same-origin",
					cache: "no-store",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						question: q,
						history: buildAskFollowUpHistory(turns.slice(0, -1)),
					}),
				});
				const data = (await response.json()) as {
					success?: boolean;
					error?: string;
					code?: string;
					clarifyId?: string;
					inScope?: boolean;
					decline?: { kind?: string; message?: string };
					questions?: ResearchClarifyQuestion[];
				};
				if (!response.ok || !data.success) {
					turn.pending = false;
					turn.phase = "done";
					if (data.code === "research_auth") {
						abortReplace();
						if (target) {
							target.value = q;
							fitTextarea(target);
						}
						void refreshQuota();
						openQuotaDialog(
							quota?.needsEmailVerification ? "verify" : "signin",
							q,
						);
						syncLayout();
						return;
					}
					if (restoreOnFail) {
						abortReplace();
						syncLayout();
						setStatus(data.error || "Could not prepare those questions.");
						return;
					}
					turn.error = data.error || "Could not prepare those questions.";
					syncLayout();
					return;
				}
				turn.pending = false;
				turn.phase = "done";
				if (data.inScope === false && data.decline) {
					turn.researchDeclined = {
						kind: data.decline.kind || "off_corpus",
						message: data.decline.message || "",
					};
					setResearchChipOn(false);
					syncLayoutAndReveal();
					return;
				}
				turn.researchClarify = {
					id: data.clarifyId || "",
					questions: data.questions || [],
					answers: {},
				};
				syncLayoutAndReveal();
			} catch {
				turn.pending = false;
				turn.phase = "done";
				if (restoreOnFail) {
					abortReplace();
					setStatus("Network error. Try again.");
				} else {
					turn.error = "Network error. Try again.";
				}
				syncLayout();
			} finally {
				busy = false;
				root.classList.remove("is-busy", "is-research-busy");
				syncLayout();
			}
			return;
		}
		try {
			const response = await fetch("/api/ai/ask", {
				method: "POST",
				credentials: "same-origin",
				cache: "no-store",
				headers: {
					"Content-Type": "application/json",
					Accept: "text/event-stream",
				},
				body: JSON.stringify({
					question: q,
					model: currentModel(),
					history: buildAskFollowUpHistory(turns.slice(0, -1)),
				}),
			});
			const ctype = response.headers.get("content-type") || "";
			if (!response.ok || ctype.includes("application/json")) {
				let data: {
					error?: string;
					code?: string;
					quota?: AiAskQuotaView;
				} = {};
				try {
					data = (await response.json()) as typeof data;
				} catch {
					data = {};
				}
				turn.pending = false;
				turn.phase = "done";
				if (data.quota) applyQuota(data.quota);
				if (data.code === "ask_quota") {
					abortReplace();
					if (target) {
						target.value = q;
						fitTextarea(target);
					}
					const view = data.quota ?? quota;
					openQuotaDialog(
						view?.signedIn
							? "tomorrow"
							: view?.needsEmailVerification
								? "verify"
								: "signin",
						q,
					);
					syncLayout();
					return;
				}
				if (restoreOnFail) {
					abortReplace();
					void refreshQuota();
					syncLayout();
					setStatus(data.error || "Ask could not complete.");
					return;
				}
				turn.error = data.error || "Ask could not complete.";
				void refreshQuota();
				syncLayout();
				return;
			}
			await readSseEvents(response, (event) => {
				if (event.type === "ping") return;
				if (event.requestId) turn.requestId = event.requestId;
				if (event.type === "quota" && event.quota) {
					applyQuota(event.quota);
				} else if (event.type === "reasoning") {
					turn.reasoning = mergeAskTurnReasoning(turn.reasoning, event);
					if (!turn.reasoning) turn.reasoningExpanded = false;
					scheduleSync();
				} else if (event.type === "status" && event.phase === "search") {
					turn.phase = "search";
					syncLayoutAndReveal();
				} else if (event.type === "status" && event.phase === "rerank") {
					turn.phase = "rerank";
					if (
						typeof event.candidateCount === "number" &&
						Number.isFinite(event.candidateCount) &&
						event.candidateCount > 0
					) {
						turn.rerankCandidateCount = Math.floor(event.candidateCount);
					}
					if (
						typeof event.showCount === "number" &&
						Number.isFinite(event.showCount) &&
						event.showCount > 0
					) {
						turn.rerankShowCount = Math.floor(event.showCount);
					}
					syncLayoutAndReveal();
				} else if (event.type === "status" && event.phase === "answer") {
					turn.phase = "answer";
					if (
						typeof event.candidateCount === "number" &&
						Number.isFinite(event.candidateCount) &&
						event.candidateCount > 0
					) {
						turn.rerankCandidateCount = Math.floor(event.candidateCount);
					}
					if (
						typeof event.showCount === "number" &&
						Number.isFinite(event.showCount) &&
						event.showCount > 0
					) {
						turn.rerankShowCount = Math.floor(event.showCount);
					}
					syncLayoutAndReveal();
				} else if (event.type === "plan") {
					applyCorrectedQuestion(turn, event);
					turn.routing = normalizeAskRouting(event.routing);
					if (turn.routing) {
						console.info(
							"[ai/ask] planner routing",
							turn.routing,
						);
					}
					turn.reasoning = mergeAskTurnReasoning(turn.reasoning, event);
					if (!turn.reasoning) turn.reasoningExpanded = false;
					turn.lookingFor = event.lookingFor || "";
					turn.queries = event.queries || [];
					turn.fallbackQueries = event.fallbackQueries || [];
					turn.offTopic = event.offTopic === true;
					turn.degraded = event.degraded === true;
					turn.persons = sanitizeAskPersonHits(event.persons);
					if (typeof event.shareSlug === "string" && event.shareSlug.trim()) {
						turn.shareSlug = event.shareSlug.trim();
					}
					turn.phase = turn.offTopic ? "done" : "search";
					syncLayoutAndReveal();
				} else if (event.type === "results") {
					applyCorrectedQuestion(turn, event);
					turn.lookingFor = event.lookingFor || turn.lookingFor;
					turn.queries = event.queries || turn.queries;
					turn.fallbackQueries = event.fallbackQueries || turn.fallbackQueries;
					turn.offTopic = event.offTopic === true;
					turn.degraded = event.degraded === true || turn.degraded;
					turn.summary =
						typeof event.summary === "string" ? event.summary.trim() : "";
					if (typeof event.shareSlug === "string" && event.shareSlug.trim()) {
						turn.shareSlug = event.shareSlug.trim();
					}
					turn.persons = sanitizeAskPersonHits(event.persons);
					turn.results = event.results || [];
					turn.rankedBySearchOnly =
						event.reranked === false && turn.results.length > 0;
					if (
						typeof event.candidateCount === "number" &&
						Number.isFinite(event.candidateCount) &&
						event.candidateCount > 0
					) {
						turn.rerankCandidateCount = Math.floor(event.candidateCount);
					}
					if (
						typeof event.showCount === "number" &&
						Number.isFinite(event.showCount) &&
						event.showCount > 0
					) {
						turn.rerankShowCount = Math.floor(event.showCount);
					} else if (turn.results.length > 0) {
						turn.rerankShowCount = turn.results.length;
					}
					turn.model = event.model || turn.model;
					const resultRouting = normalizeAskRouting(event.routing);
					if (resultRouting) {
						turn.routing = resultRouting;
						console.info("[ai/ask] final routing", resultRouting);
					}
					const resultDebug = normalizeAskDebug(event.debug);
					if (resultDebug) {
						turn.debug = resultDebug;
						console.info("[ai/ask] rerank debug", resultDebug);
					}
					const partial = event.partial === true;
					turn.pending = partial;
					turn.phase = partial ? "answer" : "done";
					if (event.quota) applyQuota(event.quota);
					if (!partial) {
						if (event.quota) maybeOfferFeedback(event.quota);
						persistSessionFromTurn(turn);
						try {
							void import("@vercel/analytics").then(({ track }) => {
								track("ask_complete", {
									resultCount: turn.results.length,
									offTopic: turn.offTopic ? 1 : 0,
								});
							});
						} catch {
							/* analytics optional */
						}
					}
					syncLayoutAndReveal();
				} else if (event.type === "error") {
					turn.pending = false;
					turn.phase = "done";
					if (!askShouldSurviveDisconnect(turn)) {
						turn.error = event.error || "Ask could not complete.";
					} else {
						persistSessionFromTurn(turn);
					}
					syncLayoutAndReveal();
				}
			});
			if (turn.pending) {
				turn.pending = false;
				turn.phase = "done";
				if (!turn.error && !askShouldSurviveDisconnect(turn)) {
					turn.error = "Ask could not complete.";
				}
				if (!turn.error) persistSessionFromTurn(turn);
				syncLayoutAndReveal();
			}
			followInput?.focus();
		} catch {
			turn.pending = false;
			turn.phase = "done";
			if (askShouldSurviveDisconnect(turn)) {
				persistSessionFromTurn(turn);
			} else if (restoreOnFail) {
				abortReplace();
				setStatus("Network error. Try again.");
			} else {
				turn.error = "Network error. Try again.";
			}
			void refreshQuota();
			syncLayout();
		} finally {
			busy = false;
			root.classList.remove("is-busy");
			// Refresh edit affordance now that the request is no longer in flight.
			syncLayout();
		}
	}

	function stopListening(): void {
		listening = false;
		listenTarget = null;
		root.classList.remove("is-listening");
		micButtons.forEach((button) => button.setAttribute("aria-pressed", "false"));
		setStatus("");
		try {
			recognition?.stop();
		} catch {
			/* ignore */
		}
	}

	function startListening(target: HTMLTextAreaElement): void {
		const Ctor = speechRecognitionCtor();
		if (!Ctor) {
			setStatus("Voice input needs Chrome or Safari.");
			return;
		}
		if (listening) {
			stopListening();
			return;
		}
		voiceBase = target.value.replace(/\s+/g, " ").trim();
		listenTarget = target;
		recognition = new Ctor() as BrowserSpeechRecognition;
		recognition.lang = "en-US";
		recognition.interimResults = true;
		recognition.continuous = true;
		recognition.onresult = (event) => {
			const spoken = assembleSpeechTranscript(event.results);
			target.value = [voiceBase, spoken].filter(Boolean).join(" ");
			fitTextarea(target);
			target.scrollTop = target.scrollHeight;
		};
		recognition.onerror = () => {
			listening = false;
			listenTarget = null;
			root.classList.remove("is-listening");
			micButtons.forEach((button) =>
				button.setAttribute("aria-pressed", "false"),
			);
			setStatus("");
		};
		recognition.onend = () => {
			if (!listening) return;
			listening = false;
			listenTarget = null;
			root.classList.remove("is-listening");
			micButtons.forEach((button) =>
				button.setAttribute("aria-pressed", "false"),
			);
			setStatus("");
		};
		listening = true;
		root.classList.add("is-listening");
		micButtons.forEach((button) => button.setAttribute("aria-pressed", "true"));
		setStatus("Listening… tap the mic when you're done, then press Send.");
		recognition.start();
	}

	if (shareMode) {
		const share = sanitizeAskShareSnapshot(
			(() => {
				try {
					return JSON.parse(shareSnapshot || "null");
				} catch {
					return null;
				}
			})(),
		);
		if (!share) return;
		// Seed the thread with the shared snapshot (full prefix when present).
		turns = askShareTurnsForRestore(share).map((turn) =>
			shareTurnToAiAskTurn(turn, share),
		);
		if (historyEl) historyEl.hidden = true;
		root.classList.add("has-thread", "ai-mode-share");
		syncLayout();
	}

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		if (turns.some((turn) => turn.pending && turn.research && turn.researchJobId)) {
			void cancelActiveResearch();
			return;
		}
		void ask(input.value, input);
	});
	followForm?.addEventListener("submit", (event) => {
		event.preventDefault();
		if (turns.some((turn) => turn.pending && turn.research && turn.researchJobId)) {
			void cancelActiveResearch();
			return;
		}
		if (followInput) void ask(followInput.value, followInput);
	});

	input.addEventListener("input", () => fitTextarea(input));
	followInput?.addEventListener("input", () => fitTextarea(followInput));

	const sendHint = askSendShortcutLabel();
	root.querySelectorAll<HTMLButtonElement>(".ai-send").forEach((button) => {
		button.title = sendHint;
		button.setAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
	});

	// Enter and Shift+Enter insert a newline. ⌘Enter / Ctrl+Enter sends.
	function bindModEnterSend(
		textarea: HTMLTextAreaElement,
		submit: () => void,
	): void {
		textarea.addEventListener("keydown", (event) => {
			if (!isAskSendShortcut(event)) return;
			event.preventDefault();
			submit();
		});
	}
	bindModEnterSend(input, () => {
		if (turns.some((turn) => turn.pending && turn.research && turn.researchJobId)) {
			void cancelActiveResearch();
			return;
		}
		void ask(input.value, input);
	});
	if (followInput) {
		bindModEnterSend(followInput, () => {
			if (turns.some((turn) => turn.pending && turn.research && turn.researchJobId)) {
				void cancelActiveResearch();
				return;
			}
			void ask(followInput.value, followInput);
		});
	}

	modelSelect?.addEventListener("change", () => {
		const next = modelSelect.value;
		if (!isClientFreeModelId(next)) return;
		selectedModel = next;
		syncModelIdCaption();
		try {
			localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
		} catch {
			/* ignore */
		}
	});

	root.querySelectorAll<HTMLButtonElement>("[data-ai-research-chip]").forEach(
		(chip) => {
			chip.addEventListener("click", () => {
				if (researchPaneOn()) return;
				if (researchFlowLocksChip()) return;
				const text = (
					followInput && !followInput.closest("form")?.hidden
						? followInput.value
						: input?.value || ""
				).replace(/\s+/g, " ").trim();
				window.location.assign(searchResearchHref(text || undefined));
			});
		},
	);

	clarifyCancelBtn?.addEventListener("click", () => {
		cancelResearchClarify();
	});
	clarifyStartBtn?.addEventListener("click", () => {
		void startResearchFromClarify();
	});
	root.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
		if (!isClarifyingTurn(turns[turns.length - 1])) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest?.(".ai-clarify-other")) return;
		if (target?.closest?.("textarea")) return;
		event.preventDefault();
		void startResearchFromClarify();
	});

	const samplesReady = loadAskSamples();

	root.querySelectorAll<HTMLButtonElement>("[data-ai-new]").forEach((button) => {
		button.addEventListener("click", () => {
			if (shareMode) {
				window.location.assign(ASK_HOME_HREF);
				return;
			}
			pendingReplaceQuestions = null;
			pendingReplaceJobIds = null;
			leaveAskHome({ url: "replace" });
		});
	});

	thread.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const button = target.closest("[data-ai-toggle-thinking]");
		if (!(button instanceof HTMLButtonElement) || !thread.contains(button)) {
			return;
		}
		const index = Number(button.getAttribute("data-turn-index"));
		if (!Number.isFinite(index)) return;
		toggleTurnThinking(index);
	});

	thread.addEventListener(
		"click",
		(event) => {
			if (shareMode || turns.length === 0) return;
			const anchor = (event.target as Element | null)?.closest("a[href]");
			if (!anchor || !thread.contains(anchor)) return;
			const href = (anchor.getAttribute("href") || "").trim();
			if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
			if (href.startsWith("/search")) return;
			try {
				const url = new URL(href, window.location.origin);
				if (url.origin !== window.location.origin) return;
			} catch {
				return;
			}
			markLeavingAskForDiscourse();
		},
		true,
	);

	quotaDialog?.querySelectorAll("[data-ai-quota-close]").forEach((el) => {
		el.addEventListener("click", () => closeQuotaDialog());
	});
	quotaDialog
		?.querySelector("[data-ai-quota-resend-verify]")
		?.addEventListener("click", () => {
			void resendAskVerification();
		});
	quotaDialog
		?.querySelector("[data-ai-quota-refresh-verify]")
		?.addEventListener("click", () => {
			void refreshAskVerification();
		});
	quotaDialog?.addEventListener("click", (event) => {
		if (event.target === quotaDialog) closeQuotaDialog();
	});
	quotaDialog?.querySelector(".ai-dialog-sheet")?.addEventListener("click", (event) => {
		event.stopPropagation();
	});

	confirmDialog?.querySelectorAll("[data-ai-confirm-cancel]").forEach((el) => {
		el.addEventListener("click", () => closeConfirmDialog());
	});
	confirmDialog
		?.querySelector("[data-ai-confirm-ok]")
		?.addEventListener("click", () => {
			const onOk = pendingConfirm;
			closeConfirmDialog();
			onOk?.();
		});
	confirmDialog?.addEventListener("click", (event) => {
		if (event.target === confirmDialog) closeConfirmDialog();
	});
	confirmDialog?.querySelector(".ai-dialog-sheet")?.addEventListener("click", (event) => {
		event.stopPropagation();
	});

	feedbackDialog?.querySelectorAll("[data-ai-feedback-close]").forEach((el) => {
		el.addEventListener("click", () => {
			void dismissFeedbackOffer();
		});
	});
	feedbackDialog
		?.querySelector("[data-ai-feedback-dismiss]")
		?.addEventListener("click", () => {
			void dismissFeedbackOffer();
		});
	feedbackDialog
		?.querySelector("[data-ai-feedback-submit]")
		?.addEventListener("click", () => {
			void submitUserReview();
		});
	feedbackDialog?.addEventListener("click", (event) => {
		if (event.target === feedbackDialog) void dismissFeedbackOffer();
	});
	feedbackDialog?.querySelector(".ai-dialog-sheet")?.addEventListener("click", (event) => {
		event.stopPropagation();
	});
	feedbackText?.addEventListener("input", () => {
		const hint = root.querySelector<HTMLElement>("[data-ai-feedback-hint]");
		if (!hint) return;
		const len = (feedbackText.value || "").replace(/\s+/g, " ").trim().length;
		hint.textContent =
			len >= ASK_FEEDBACK_MIN_CHARS
				? "Looks good."
				: `At least ${ASK_FEEDBACK_MIN_CHARS} characters.`;
	});
	window.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		if (feedbackDialog && !feedbackDialog.hidden) {
			event.preventDefault();
			void dismissFeedbackOffer();
			return;
		}
		if (confirmDialog && !confirmDialog.hidden) {
			event.preventDefault();
			closeConfirmDialog();
			return;
		}
		if (quotaDialog && !quotaDialog.hidden) {
			event.preventDefault();
			closeQuotaDialog();
		}
	});

	micButtons.forEach((button) => {
		button.addEventListener("click", () => {
			if (button.disabled) return;
			const target = button.closest("form")?.querySelector("textarea");
			if (target && !target.disabled) startListening(target);
		});
		if (!speechRecognitionCtor()) {
			button.hidden = true;
		}
	});

	loadResearchChipPreference();

	window.addEventListener("pagehide", () => {
		for (const turn of turns) {
			if (turn.research && turn.pending && turn.researchJobId) {
				persistResearchHistory(turn, { pending: true, unread: false });
			}
		}
		persistActiveThread();
	});
	window.addEventListener("popstate", () => {
		applyAskSurfaceFromUrl();
	});
	window.addEventListener("resize", () => {
		thread.querySelectorAll<HTMLElement>("[data-ai-question]").forEach((wrap) => {
			syncQuestionExpandState(wrap);
		});
		scheduleFollowDockFrost();
	});
	window.addEventListener("scroll", scheduleFollowDockFrost, { passive: true });

	// Prefill only — never auto-submit. Mode switches must not spend credits.
	const params = new URLSearchParams(window.location.search);
	const onSearchPage = window.location.pathname.replace(/\/$/, "") === "/search";
	const askSurfaceVisible = !onSearchPage || isAskSurfaceMode(params);
	const initial = params.get("q");
	if (initial?.trim() && askSurfaceVisible) {
		input.value = initial;
		fitTextarea(input);
	}

	const researchJobParam =
		shareMode || !askSurfaceVisible ? "" : askResearchJobParam(params);
	const sampleParam =
		shareMode || !askSurfaceVisible || researchJobParam
			? ""
			: askSampleParam(params);
	const restoreResearchId = researchJobParam;

	// `open` reopens a stored ask (e.g. from the Review Room) without a credit.
	const openQuestion =
		shareMode || !askSurfaceVisible || restoreResearchId || sampleParam
			? ""
			: params.get("open")?.replace(/\s+/g, " ").trim() || "";
	function openFromHistory(question: string): boolean {
		const entry = findLaneEntry(question);
		if (!entry) return false;
		openHistoryEntry(entry);
		return true;
	}

	if (!shareMode && onSearchPage) {
		const state = window.history.state as { aiAskSurface?: number } | null;
		if (!state || state.aiAskSurface !== 1) {
			window.history.replaceState(
				askSurfaceHistoryState(false),
				"",
				window.location.pathname + window.location.search + window.location.hash,
			);
		}
	}

	if (!askSurfaceVisible) {
		renderHistory();
		syncResearchChip();
		void loadModels();
		void refreshQuota();
		return;
	}

	if (restoreResearchId) {
		setRestoringResearch(true);
		void restoreResearchJob(
			restoreResearchId,
			sessionEntries.find((item) => item.researchJobId === restoreResearchId),
		);
		void refreshQuota();
	} else if (sampleParam) {
		void samplesReady.then(() => {
			if (turns.length === 0) openSampleFromUrl(sampleParam);
		});
	} else if (openQuestion) {
		if (!openFromHistory(openQuestion)) {
			// Not on this device yet — prefill while the server copy loads.
			input.value = openQuestion;
			fitTextarea(input);
		}
	} else if (!shareMode && turns.length === 0) {
		const active = readActiveAskThread(undefined, {
			research: researchPaneOn(),
		});
		const navType = navigationEntryType();
		const resumeFromDiscourse = shouldResumeAskFromDiscourse(undefined, {
			research: researchPaneOn(),
		});
		if (
			active.length > 0 &&
			shouldRestoreActiveAskThread(navType, resumeFromDiscourse)
		) {
			restoreActiveThreadFromStorage();
		} else if (active.length > 0 && navType === "navigate") {
			clearAskThreadResumeIntent(undefined, { research: researchPaneOn() });
		}
	}

	renderHistory();
	syncResearchChip();
	watchPendingResearchHistory();
	void loadModels();
	if (!restoreResearchId) void refreshQuota();
	const historySync = syncHistoryFromServer();
	void historySync.then(() => hydrateOpenResearchJobs());
	if (openQuestion && turns.length === 0) {
		void historySync.then(() => {
			if (turns.length === 0 && openFromHistory(openQuestion)) {
				input.value = "";
				fitTextarea(input);
			}
		});
	}
	scheduleFollowDockFrost();
}
