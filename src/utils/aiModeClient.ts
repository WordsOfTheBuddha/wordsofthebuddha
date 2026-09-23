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
import { researchApiFailureMessage } from "./appApiPath";
import type { AiAskPersonHit } from "./aiAskPersons";
import { sanitizeAskPersonHits } from "./aiAskPersons";
import { ASK_FEEDBACK_MIN_CHARS, isValidAskUserReview } from "./aiAskQuota";
import type { ResearchQuotaView } from "./aiResearchQuota";
import {
	dropOpenResearchRevisionCycle,
	interleaveResearchRevisionStartedHops,
	rememberResearchProcessNote,
	researchProcessHopLabels,
	splitResearchReviseHopLabels,
	type ResearchJobPublic,
} from "./aiAskResearchJob";
import {
	answersFromClarifyState,
	canStartResearchClarify,
	RESEARCH_CLARIFY_TITLE,
	RESEARCH_CLARIFY_CONFIRM_TITLE,
	RESEARCH_CLARIFY_CONFIRM_FALLBACK,
	RESEARCH_CLARIFY_OTHER_ID,
	RESEARCH_CLARIFY_MAX_OTHER,
	suggestedClarifyAnswers,
	type ResearchClarifyQuestion,
} from "./aiAskResearchClarify";
import {
	COMPOSITION_CHIP_PAD_CHAR,
	COMPOSITION_CONTEXT_CHIP_MARKER,
	COMPOSITION_IMAGE_ACCEPT,
	compositionDroppedImageFiles,
	compositionMarkerArrowAdjust,
	clipResearchContext,
	compositionChipPadCount,
	compositionCollapsedDeleteChipIndex,
	compositionContextInsertPosition,
	compositionEditDeleteSelection,
	compositionLineStart,
	compositionMarkerIndices,
	compositionMarkerPadLength,
	compositionMarkerRegions,
	contextWasClipped,
	insertCompositionContextClip,
	mergeCompositionContexts,
	countContextWords,
	formatContextChipLabel,
	guessImageMimeFromName,
	hasResearchCompositionContent,
	isCompositionImageFile,
	MAX_RESEARCH_CONTEXT_IMAGES,
	MAX_RESEARCH_CONTEXT_IMAGE_BYTES,
	normalizeCompositionCaret,
	parseResearchCompositionDraft,
	RESEARCH_COMPOSITION_CONTEXT_TOO_LARGE_MSG,
	RESEARCH_COMPOSITION_CONTEXT_TRIM_MSG,
	RESEARCH_COMPOSITION_IMAGE_TOO_LARGE_MSG,
	RESEARCH_COMPOSITION_IMAGES_TOTAL_FULL_MSG,
	RESEARCH_COMPOSITION_MAX_IMAGES_MSG,
	RESEARCH_COMPOSITION_UNSUPPORTED_IMAGE_MSG,
	RESEARCH_COMPOSITION_DRAFT_STORAGE_KEY,
	researchContextImageByteLength,
	researchContextPreview,
	resolveResearchSubmitAttachments,
	serializeResearchCompositionDraft,
	shouldAttachPasteAsCompositionContext,
	formatAttachedMaterialBlock,
	sanitizeResearchContextImages,
	stripCompositionChipMarkers,
	wouldExceedCompositionImageTotalBytes,
	type ResearchCompositionDraft,
	type ResearchContextImage,
} from "./aiAskComposition";
import {
	ASK_COMPOSER_TEXTAREA_MAX_PX,
	clipAiQuestion,
	MAX_ASK_CONTEXT_CHARS,
	MAX_QUESTION_CHARS,
	maxAskQuestionChars,
} from "./aiAskQuestionText";
import {
	changedReportBlockKeys,
	diffReportBlockChanges,
	enumerateReportBlocks,
	formatReportBlockDiffDebug,
	reportBlockDiffCount,
	REPORT_BLOCK_KEY_MIN,
	type ReportBlockDiff,
	type ReportContentBlock,
	type ReportRemovedBlock,
	clipResearchReviseInstruction,
	normalizeResearchReviseInstructionInput,
	RESEARCH_REVISE_INSTRUCTION_MAX,
	clipResearchVersionIndex,
	currentResearchVersionN,
	formatResearchVersionLabel,
	formatResearchVersionLabelForTurn,
	formatResearchVersionStats,
	healedResearchVersionIndex,
	isResearchRevisionStartedLabel,
	nextResearchRevisionN,
	normalizeReportBlockText,
	openingResearchVersionMeta,
	researchRevisionStartedNote,
	researchReviseClarifyBaseLabel,
	selectionQualifiesForRevise,
	RESEARCH_REVISE_CLARIFY_CONTINUE,
	RESEARCH_REVISE_CLARIFY_TITLE,
	RESEARCH_REVISE_BODIES_MAX,
	RESEARCH_REVISE_CONSIDERING_NOTE,
	splitBlockIdForEnumeratedKey,
	splitReportBlocks,
	type ResearchVersionMeta,
	versionBodiesToKeep,
} from "./aiAskResearchRevise";
import {
	abbreviateReviseQuote,
	applyReviseSelectionToDraft,
	buildSubmittableReviseEdits,
	canSubmitReviseEdits,
	clearReviseDraftScope,
	emptyReviseEditDraft,
	formatReviseEditScopeLabel,
	hasReviseComposerContent,
	hasReviseEditScope,
	removeCommittedReviseRow,
	updateCommittedReviseInstruction,
	reviseCompactDockPlaceholder,
	reviseExpandedPlaceholder,
	isReviseEditsCapped,
	reviseStackRenderKey,
	shouldDeferReviseComposerDraftPersist,
	REVISE_QUOTE_CHIP_MAX,
	scopeFromDomSelection,
	scopeFromReportPin,
	type ResearchReviseEditDraft,
	type ResearchReviseEditScope,
} from "./aiAskResearchReviseComposer";
import {
	renderAskBriefingHtml,
	renderResearchReportHtml,
} from "./aiAskResearchReport";
import { hydrateResearchReportMermaid } from "./researchReportMermaid";
import {
	openResearchImageOverlay,
	researchContextImageDataUrl,
	researchContextImageFilename,
} from "./researchImageOverlay";
import {
	deleteResearchAttachments,
	loadResearchAttachments,
	saveResearchAttachments,
} from "./researchAttachmentStore";
import {
	decorateReportParagraphNumbers,
	readShowParagraphNumbers,
	writeShowParagraphNumbers,
} from "./paragraphNumbers";
import {
	clearTableOfContents,
	refreshTableOfContents,
	researchTableOfContentsOptions,
} from "./tocClient";
import {
	annotateResearchCitationLinks,
	hideDiscourseCitationPopover,
	installDiscourseCitationPopovers,
} from "./discourseCitationPopover";
import {
	clearResearchPreviewVersion,
	readResearchPreviewVersion,
	shareUrlWithVersion,
	writeResearchPreviewVersion,
} from "./aiAskResearchVersionPreview";
import {
	ASK_PLACEHOLDER,
	ASK_COMPOSER_LABEL,
	ASK_DELETE_CONFIRM,
	ASK_HISTORY_ARIA,
	ASK_HISTORY_HINT_PINNED,
	ASK_HISTORY_HINT_RECENT,
	ASK_HISTORY_LABEL,
	ASK_LIMITS_NOTE,
	askSponsorNoteVisible,
	ASK_OPTIONS_ARIA,
	ASK_PIN_ACCOUNT_BODY,
	ASK_PIN_ACCOUNT_TITLE,
	ASK_SHARE_ACCOUNT_BODY,
	ASK_SHARE_ACCOUNT_TITLE,
	ASK_NEW_LABEL,
	applyResearchJobToTurn,
	mergeResearchJobVersionMetadata,
	isResearchReviseInProgress,
	askComposerMeterIsResearch,
	askFollowPlaceholder,
	askMeterLabel,
	canShowResearchChip,
	isAskResearchEnabled,
	RESEARCH_CHIP_STORAGE_KEY,
	RESEARCH_CHIP_TITLE,
	REVISE_MULTI_HINT_STORAGE_KEY,
	REVISE_COMPOSER_DRAFT_STORAGE_KEY,
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
	RESEARCH_RESTORE_ACTION,
	RESEARCH_REVISE_ACCOUNT_BODY,
	RESEARCH_REVISE_ACCOUNT_TITLE,
	RESEARCH_REVISE_CLEAR,
	RESEARCH_REVISE_EDITS_CAP,
	RESEARCH_REVISE_REMOVE_EDIT,
	RESEARCH_REVISE_SELECTION_PLACEHOLDER,
	RESEARCH_REVISE_FROM_ACTION,
	RESEARCH_REVISE_REPORT,
	RESEARCH_SIGNIN_BODY,
	RESEARCH_SIGNIN_TITLE,
	RESEARCH_SHARE_ACCOUNT_BODY,
	RESEARCH_SHARE_ACCOUNT_TITLE,
	RESEARCH_UNPIN_ACTION,
	RESEARCH_NEW_LABEL,
	RESEARCH_VERSIONS_ACTION,
	REPORT_PARAGRAPH_HIDE_TITLE,
	REPORT_PARAGRAPH_SHOW_TITLE,
	ASK_CLIPBOARD_COPIED_LABEL,
	ASK_CLIPBOARD_FAILED_LABEL,
	ASK_SHARE_COPIED_LABEL,
	ASK_SHARE_FAILED_LABEL,
	ASK_SHARE_SAVED_COPY_FAILED_LABEL,
	copyTextWithClipboardFallback,
	askHistoryCardMenuFlags,
	applyAskButtonFeedback,
	flashAskButtonFeedback,
	isIncompleteResearchTurn,
	isFinishedResearchReportTurn,
	openAskTurnActionFlags,
	readAskButtonIdle,
	researchHistoryCardStatsLabel,
	researchHistoryStatsLabel,
	researchHistoryTimestamp,
	researchJobToHistoryEntry,
	researchEditAskInsteadLabel,
	researchRetrySubmitLabel,
	wrapAskAnswerHtml,
	sameResearchRetryQuestion,
	shouldReviseResearchFollow,
	shouldUseResearchAsk,
	followComposerClickShouldExpand,
	followComposerFocusShouldExpand,
	followComposerShouldExpand,
	followDockVisualTranslateY,
	isMobileReportDockCompact,
	isMobileReportDockExpanded,
	MOBILE_REPORT_DOCK_BREAKPOINT_PX,
	reportFollowDockRect,
	askSampleFollowDock,
	researchReportFollowChrome,
	researchEmptyComposerGated,
	RESEARCH_NEW_REPORT_ACTION,
	RESEARCH_SIGNED_OUT_PLACEHOLDER,
	SEARCH_TERMS_SOURCING_LABEL,
	dedupeSourcingSearchTerms,
	findReportBlockElement,
	isResearchReviseClarifying,
	type ResearchReviseClarifyDraft,
} from "./aiAskResearchUi";
import {
	snapshotResearchHistoryStats,
	type ResearchHistoryReportStats,
} from "./aiAskResearchHistoryStats";
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
	ASK_SAMPLE_REMOVE_LABEL,
	ASK_SAMPLE_REMOVE_LABEL_SHORT,
	ASK_SAMPLE_REMOVE_TITLE,
	ASK_SAMPLE_SAVE_LABEL,
	ASK_SAMPLE_SAVE_LABEL_SHORT,
	askSampleConfirmMessage,
	askSampleSavedStatusMessage,
	askSampleHideKey,
	askSampleRemoveConfirmMessage,
	canMarkAskAsSample,
	canRemoveAskSample,
	askSampleAdminAction,
	hideAskSampleKey,
	isResearchAskSample,
	publishedAskSampleForTurn,
	turnResearchSampleLane,
	readHiddenAskSampleKeys,
	removeAskSampleLocal,
	RESEARCH_SAMPLE_NOTE,
	sampleToHistoryEntry,
	sanitizeAskSamplePublic,
	sampleToShareTurn,
	upsertAskSampleLocal,
	visibleHistorySamples,
	type AiAskSamplePublic,
} from "./aiAskSamples";
import {
	ASK_HISTORY_PREVIEW_LIMIT,
	AI_ASK_PIN_LIMIT,
	AI_RESEARCH_PIN_LIMIT,
	askHistoryEntriesForRestore,
	askHistoryEntriesForTab,
	askHistoryLaneEntries,
	clearAskResumeFromDiscourse,
	clearAskThreadResumeIntent,
	findAiAskSessionEntry,
	formatAskAbsoluteTime,
	formatAskRelativeTime,
	isResearchHistoryEntry,
	markAskResumeFromDiscourse,
	mergeAskHistoryEntries,
	normalizeAskQuestionKey,
	pinnedAskHistoryEntries,
	preservePendingResearchHistory,
	priorResearchJobIdsInThread,
	readActiveAskThread,
	readAiAskSession,
	readDeletedResearchJobIds,
	rememberDeletedResearchJobIds,
	filterDeletedResearchJobs,
	normalizeDeletedResearchJobId,
	removeAskHistoryEntriesByJobIds,
	removeAskHistoryEntriesByQuestions,
	researchHistoryNeedsJobRestore,
	researchHistoryNeedsVersionIndexRefresh,
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
import { aiSourceRowHtml, formatAskAnswerCopyMarkdown } from "./aiAskCards";
import { readNavAuthCache } from "./navAuthClient";
import { loadPageUserState } from "./pageUserStateClient";

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
	versionIndex?: ResearchVersionMeta[];
	/**
	 * Body the current report was revised from, kept in memory for this page
	 * view only, so changed paragraphs can be highlighted after a revise lands.
	 */
	reviseBase?: string;
	/** Which stored version `reviseBase` came from — must match head `versionIndex[n].from`. */
	reviseBaseVersionN?: number;
	researchClarify?: {
		id: string;
		questions: ResearchClarifyQuestion[];
		answers: Record<string, { choiceId: string; otherText?: string }>;
		interpretation?: string;
	};
	/** Clarify planner reading — kept after the job starts for PDF export. */
	researchInterpretation?: string;
	/** Planner questions a revision is paused on; the report is still the base. */
	reviseClarify?: ResearchReviseClarifyDraft;
	/** Ignore stale polls after the reader stops a revise/research job locally. */
	researchLocalCancelToken?: number;
	researchDeclined?: {
		kind: string;
		message: string;
	};
	/** Slim metadata for attached Research notes (not the full text). */
	contextPreview?: string;
	contextWordCount?: number;
	/** e.g. "Clipboard (527 lines)" — display label only. */
	contextAttachmentLabel?: string;
	imageCount?: number;
	attachedImages?: ResearchContextImage[];
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
	/** "divider" renders as a grey system row (———— Started v2 revision ————). */
	kind?: "divider";
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
	hasReport?: boolean;
	versionIndex?: readonly ResearchVersionMeta[];
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
	const hopLabels = researchProcessHopLabels(
		input.processNotes,
		input.pending ? note : undefined,
	);
	const { original: originalHops, revise: reviseHops } =
		splitResearchReviseHopLabels(hopLabels);
	const originalHopSteps: AskProcessStep[] = originalHops.map((text) => ({
		state: "done",
		text,
	}));
	const revising = Boolean(
		input.research && input.pending && input.hasReport,
	);
	const startedHops = interleaveResearchRevisionStartedHops(reviseHops, {
		currentN: currentResearchVersionN(input.versionIndex || []),
		revising,
	});
	const reviseHopSteps: AskProcessStep[] = startedHops.map((text) =>
		isResearchRevisionStartedLabel(text)
			? { state: "done", text, kind: "divider" }
			: { state: "done", text },
	);

	if (revising) {
		const live: AskProcessStep = {
			state: "active",
			text: note || "Revising the report…",
		};
		return [
			...prefix,
			searched,
			crunched,
			{ state: "done", text: "Reviewed the evidence" },
			...originalHopSteps,
			{ state: "done", text: "Wrote the report" },
			...reviseHopSteps,
			live,
		];
	}

	if (phase === "done") {
		if (!input.research) return [...prefix, searched, crunched];
		return [
			...prefix,
			searched,
			crunched,
			{ state: "done", text: "Reviewed the evidence" },
			...originalHopSteps,
			{ state: "done", text: "Wrote the report" },
			...reviseHopSteps,
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
	return [
		...prefix,
		searched,
		crunched,
		reviewed,
		...originalHopSteps,
		...reviseHopSteps,
		writeStep,
	];
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
	return `<details class="ai-sources"><summary>${label}</summary><ol class="ai-hits ai-sources-list">${body}</ol></details>`;
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
				step.kind === "divider"
					? ""
					: step.state === "done"
						? "✓"
						: step.state === "active"
							? "●"
							: "○";
			const cls =
				step.kind === "divider"
					? `is-${step.state} ai-process-divider`
					: `is-${step.state}`;
			const row = `<li class="${cls}"><span class="ai-process-mark" aria-hidden="true">${mark}</span><span>${escapeHtml(step.text)}</span></li>`;
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
		| "report"
		| "versionIndex"
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
		hasReport: Boolean((turn.report || "").trim()),
		versionIndex: turn.versionIndex,
	});
}

function processStatusLis(process: Element): HTMLElement[] {
	return [...process.querySelectorAll<HTMLElement>(":scope > li")].filter(
		(li) =>
			!li.classList.contains("ai-process-thinking") &&
			!li.classList.contains("ai-process-dev"),
	);
}

export const RESEARCH_API_PATH = "/api/ai/research";
export const RESEARCH_REVISE_API_PATH = "/api/ai/research/revise";
export const RESEARCH_CLARIFY_API_PATH = "/api/ai/research/clarify";

export function researchJobApiPath(
	jobId: string,
	version?: number | null,
): string {
	const id = encodeURIComponent((jobId || "").trim());
	const path = `${RESEARCH_API_PATH}/${id}`;
	if (version == null) return path;
	const n = Math.floor(Number(version));
	if (!Number.isFinite(n) || n < 1) return path;
	return `${path}?version=${n}`;
}

/** Fast first-poll cadence so a fresh job shows its early hops quickly. */
export const RESEARCH_POLL_START_MS = 2000;
/** Steady cadence once a job has been running a while; updates lag at most this. */
export const RESEARCH_POLL_STEADY_MS = 6000;
/** How long to stay on the fast cadence before backing off. */
export const RESEARCH_POLL_RAMP_MS = 20_000;
/** Cadence for pending history rows on the Ask home. */
export const RESEARCH_WATCH_POLL_MS = 6000;
/** Safety re-check while the tab is hidden and no visibility event arrives. */
const RESEARCH_POLL_HIDDEN_RECHECK_MS = 60_000;

export function researchPollDelayMs(elapsedMs: number): number {
	return elapsedMs < RESEARCH_POLL_RAMP_MS
		? RESEARCH_POLL_START_MS
		: RESEARCH_POLL_STEADY_MS;
}

/** Ask/Research JSON reads give up after this long instead of hanging. */
export const AI_JSON_TIMEOUT_MS = 45_000;
/** Writes (start, clarify, revise) may run a model call before replying. */
export const AI_JSON_WRITE_TIMEOUT_MS = 150_000;
export const AI_SERVER_SLOW_AFTER_MS = 8_000;
export const AI_SERVER_SLOW_STATUS =
	"Still opening… the server is slow to respond.";
export const AI_SERVER_TIMEOUT_MESSAGE =
	"The server did not respond. It may be down or unreachable — try again in a moment.";

function aiJsonTimeoutSignal(ms: number): AbortSignal | undefined {
	try {
		if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
			return AbortSignal.timeout(ms);
		}
	} catch {
		/* older runtimes */
	}
	return undefined;
}

export function aiJsonRequestInit(init: RequestInit = {}): RequestInit {
	const headers = new Headers(init.headers);
	if (!headers.has("Accept")) headers.set("Accept", "application/json");
	const write = Boolean(init.method && init.method.toUpperCase() !== "GET");
	const signal =
		init.signal ??
		aiJsonTimeoutSignal(write ? AI_JSON_WRITE_TIMEOUT_MS : AI_JSON_TIMEOUT_MS);
	return {
		credentials: "same-origin",
		cache: "no-store",
		...init,
		headers,
		redirect: "error",
		...(signal ? { signal } : {}),
	};
}

/** True for a fetch that gave up waiting (AbortSignal.timeout). */
export function isAiTimeoutError(error: unknown): boolean {
	return Boolean(
		error &&
			typeof error === "object" &&
			((error as { name?: string }).name === "TimeoutError" ||
				(error as { name?: string }).name === "AbortError"),
	);
}

export function isAiJsonResponse(
	response: Pick<Response, "redirected" | "type" | "headers" | "status">,
): boolean {
	if (response.redirected || response.type === "opaqueredirect") return false;
	if (response.status >= 300 && response.status < 400) return false;
	const ctype = response.headers.get("content-type") || "";
	return ctype.toLowerCase().includes("application/json");
}

export async function fetchAiJson<
	T extends Record<string, unknown> = Record<string, unknown>,
>(
	url: string,
	init: RequestInit = {},
): Promise<{ response: Response; data: T }> {
	const response = await fetch(url, aiJsonRequestInit(init));
	if (!isAiJsonResponse(response)) {
		const error = new Error("API returned a non-JSON response.");
		error.name = "AiJsonResponseError";
		throw error;
	}
	let data = {} as T;
	try {
		data = (await response.json()) as T;
	} catch {
		data = {} as T;
	}
	return { response, data };
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
		| "report"
		| "versionIndex"
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
		li.classList.toggle("ai-process-divider", step.kind === "divider");
		const mark = li.querySelector(".ai-process-mark");
		if (mark) {
			mark.textContent =
				step.kind === "divider"
					? ""
					: step.state === "done"
						? "✓"
						: step.state === "active"
							? "●"
							: "○";
		}
		const text = li.querySelector("span:not(.ai-process-mark)");
		if (text && text.textContent !== step.text) text.textContent = step.text;
	});

	const thinking = applyAskThinkingStreamPatch(thread, turn, turnIndex);
	scrollAskProcessToLatest(process);
	return thinking;
}

export function scrollAskProcessToLatest(
	process: Element | null | undefined,
	options?: { focus?: boolean },
): void {
	if (!process) return;
	const hops = processStatusLis(process);
	const target =
		[...hops].reverse().find((li) => li.classList.contains("is-active")) ||
		hops[hops.length - 1];
	if ("scrollTop" in process && "scrollHeight" in process) {
		const el = process as HTMLElement;
		el.scrollTop = el.scrollHeight;
	}
	if (options?.focus && target) {
		if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
		target.focus({ preventScroll: true });
	}
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

/** Tall enough for multi-paragraph revise instructions; parent body scrolls. */
const REVISE_COMPOSER_TEXTAREA_MAX_PX = 12_000;

function reviseComposerTextareaUncapped(el: HTMLTextAreaElement): boolean {
	if (!el.closest(".ai-follow.is-follow-expanded")) return false;
	return (
		el.classList.contains("ai-revise-row-instruction") ||
		el.hasAttribute("data-ai-follow-input")
	);
}

function fitTextarea(el: HTMLTextAreaElement): void {
	el.style.height = "0px";
	const cap = reviseComposerTextareaUncapped(el)
		? REVISE_COMPOSER_TEXTAREA_MAX_PX
		: ASK_COMPOSER_TEXTAREA_MAX_PX;
	el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), cap)}px`;
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
		...(turn.researchInterpretation
			? { researchInterpretation: turn.researchInterpretation }
			: {}),
		...(turn.researchJobId ? { researchJobId: turn.researchJobId } : {}),
		...(turn.processNotes && turn.processNotes.length > 0
			? { processNotes: turn.processNotes }
			: {}),
		...(turn.versionIndex && turn.versionIndex.length > 0
			? { versionIndex: turn.versionIndex }
			: {}),
		...(turn.reviseBase ? { reviseBase: turn.reviseBase } : {}),
		...(typeof turn.reviseBaseVersionN === "number" && turn.reviseBaseVersionN > 0
			? { reviseBaseVersionN: turn.reviseBaseVersionN }
			: {}),
		...(turn.contextPreview ? { contextPreview: turn.contextPreview } : {}),
		...(typeof turn.contextWordCount === "number"
			? { contextWordCount: turn.contextWordCount }
			: {}),
		...(turn.contextAttachmentLabel
			? { contextAttachmentLabel: turn.contextAttachmentLabel }
			: {}),
		...(typeof turn.imageCount === "number"
			? { imageCount: turn.imageCount }
			: {}),
		...(turn.attachedImages && turn.attachedImages.length > 0
			? { attachedImages: turn.attachedImages }
			: {}),
	};
}

function renderQuestionAttachmentsHtml(turn: AiAskTurn): string {
	const chips: string[] = [];
	if (turn.contextAttachmentLabel) {
		const title = turn.contextPreview
			? ` title="${escapeHtml(turn.contextPreview)}"`
			: "";
		chips.push(
			`<span class="ai-question-attachment ai-question-attachment-notes"${title}>${escapeHtml(turn.contextAttachmentLabel)}</span>`,
		);
	}
	const attachedImages = turn.attachedImages || [];
	if (attachedImages.length > 0) {
		attachedImages.forEach((image, index) => {
			const src = researchContextImageDataUrl(image);
			chips.push(
				`<button type="button" class="ai-question-image" data-ai-image-preview data-ai-image-index="${index}" aria-label="View attached image ${index + 1}" title="View attached image ${index + 1}"><img src="${escapeHtml(src)}" alt="Attached image ${index + 1}" loading="lazy" draggable="false"></button>`,
			);
		});
	} else if (typeof turn.imageCount === "number" && turn.imageCount > 0) {
		const label =
			turn.imageCount === 1 ? "1 image" : `${turn.imageCount} images`;
		chips.push(
			`<span class="ai-question-attachment ai-question-attachment-images">${escapeHtml(label)}</span>`,
		);
	}
	if (chips.length === 0) return "";
	return `<div class="ai-question-attachments">${chips.join("")}</div>`;
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
		...(entry.researchInterpretation
			? { researchInterpretation: entry.researchInterpretation }
			: {}),
		...(entry.researchJobId ? { researchJobId: entry.researchJobId } : {}),
		...(entry.research && entry.at ? { researchStartedAt: entry.at } : {}),
		...(entry.processNotes && entry.processNotes.length > 0
			? { processNotes: entry.processNotes }
			: {}),
		...(entry.versionIndex && entry.versionIndex.length > 0
			? { versionIndex: clipResearchVersionIndex(entry.versionIndex) }
			: {}),
		...(entry.reviseBase ? { reviseBase: entry.reviseBase } : {}),
		...(typeof entry.reviseBaseVersionN === "number" && entry.reviseBaseVersionN > 0
			? { reviseBaseVersionN: entry.reviseBaseVersionN }
			: {}),
		...(entry.contextPreview ? { contextPreview: entry.contextPreview } : {}),
		...(typeof entry.contextWordCount === "number"
			? { contextWordCount: entry.contextWordCount }
			: {}),
		...(entry.contextAttachmentLabel
			? { contextAttachmentLabel: entry.contextAttachmentLabel }
			: {}),
		...(typeof entry.imageCount === "number"
			? { imageCount: entry.imageCount }
			: {}),
		...(entry.attachedImages && entry.attachedImages.length > 0
			? { attachedImages: entry.attachedImages }
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
		...(share.researchJobId || turn.researchJobId
			? { researchJobId: share.researchJobId || turn.researchJobId }
			: {}),
		...(share.versionIndex && share.versionIndex.length > 0
			? { versionIndex: share.versionIndex }
			: turn.versionIndex && turn.versionIndex.length > 0
				? { versionIndex: turn.versionIndex }
				: {}),
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
		...(sample.researchJobId ? { researchJobId: sample.researchJobId } : {}),
		...(sample.versionIndex && sample.versionIndex.length > 0
			? { versionIndex: sample.versionIndex }
			: {}),
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

/** First visible line of a range — not the growing multi-line bounding box. */
export function firstRangeClientRect(range: {
	getClientRects: () => ArrayLike<Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">>;
	getBoundingClientRect?: () => Pick<
		DOMRect,
		"left" | "top" | "right" | "bottom" | "width" | "height"
	>;
}): Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height"> | null {
	const rects = range.getClientRects();
	for (let i = 0; i < rects.length; i++) {
		const rect = rects[i];
		if (rect && rect.width > 0 && rect.height > 0) return rect;
	}
	const box = range.getBoundingClientRect?.();
	if (box && (box.width > 0 || box.height > 0)) return box;
	return null;
}

/** Longest chip text before a selection is shown as start … end. */
export { REVISE_QUOTE_CHIP_MAX, abbreviateReviseQuote };

export function reviseScopeLabel(heading: string, quote: string): string {
	if (heading.trim()) return `Revising · ${heading.trim()}`;
	if (quote.trim()) return `Revising · “${abbreviateReviseQuote(quote)}”`;
	return "";
}

export const RESEARCH_CHANGES_SHOW_TITLE = "Highlight what changed in this version";
export const RESEARCH_CHANGES_HIDE_TITLE = "Hide change highlights";

export function researchChangesChipLabel(count: number): string {
	const n = Math.max(0, Math.floor(count));
	return n === 1 ? "1 change" : `${n.toLocaleString("en-US")} changes`;
}

export function researchChangesChipVisible(
	turn: Pick<
		AiAskTurn,
		| "report"
		| "reviseBase"
		| "reviseBaseVersionN"
		| "research"
		| "researchJobId"
		| "versionIndex"
	>,
	input: { previewVersion?: boolean; isLatestTurn?: boolean } = {},
): boolean {
	if (input.previewVersion || input.isLatestTurn === false) return false;
	if (reportChangeCount(turn) > 0) return true;
	return shouldHydrateReviseBase(turn);
}

export function researchChangesChipLabelForTurn(
	turn: Pick<
		AiAskTurn,
		| "report"
		| "reviseBase"
		| "reviseBaseVersionN"
		| "research"
		| "researchJobId"
		| "versionIndex"
	>,
): string {
	const count = reportChangeCount(turn);
	if (count > 0) return researchChangesChipLabel(count);
	if (shouldHydrateReviseBase(turn)) return "Changes";
	return "";
}

export function researchVersionChangesChipHtml(input: {
	label: string;
	pressed: boolean;
}): string {
	const title = input.pressed
		? RESEARCH_CHANGES_HIDE_TITLE
		: RESEARCH_CHANGES_SHOW_TITLE;
	return `<button type="button" class="ai-changes-btn ai-versions-changes" data-ai-changes aria-pressed="${
		input.pressed ? "true" : "false"
	}" title="${escapeHtml(title)}">${escapeHtml(input.label)}</button>`;
}

export function reportBlockDiff(
	turn: Pick<AiAskTurn, "report" | "reviseBase">,
): ReportBlockDiff | null {
	const base = (turn.reviseBase || "").trim();
	const next = (turn.report || "").trim();
	if (!base || !next || base === next) return null;
	return diffReportBlockChanges(base, next);
}

/** Block keys the current report added or rewrote against `reviseBase`. */
export function reportChangedKeys(
	turn: Pick<AiAskTurn, "report" | "reviseBase">,
): string[] {
	const diff = reportBlockDiff(turn);
	if (!diff) return [];
	return [...diff.added, ...diff.edited];
}

export function reportChangeCount(
	turn: Pick<AiAskTurn, "report" | "reviseBase">,
): number {
	return reportBlockDiffCount(reportBlockDiff(turn));
}

/**
 * Version body to diff against when the session did not keep `reviseBase`:
 * the version the current one was revised *from* (not necessarily n − 1).
 */
export function researchReviseBaseVersionN(
	index: readonly ResearchVersionMeta[] = [],
): number | null {
	const current = currentResearchVersionN(index);
	if (current < 2) return null;
	const meta = index.find((item) => item.n === current);
	const from = meta?.from;
	if (typeof from === "number" && from >= 1 && from < current) return from;
	return current - 1;
}

export function expectedReviseBaseVersionN(
	turn: Pick<AiAskTurn, "versionIndex">,
): number | null {
	return researchReviseBaseVersionN(
		healedResearchVersionIndex({ versionIndex: turn.versionIndex }),
	);
}

export function shouldHydrateReviseBase(
	turn: Pick<
		AiAskTurn,
		| "report"
		| "reviseBase"
		| "reviseBaseVersionN"
		| "research"
		| "researchJobId"
		| "versionIndex"
	>,
): boolean {
	if (turn.research !== true || !turn.researchJobId) return false;
	const report = (turn.report || "").trim();
	if (!report) return false;
	const expectedN = expectedReviseBaseVersionN(turn);
	if (expectedN === null) return false;
	if (!turn.reviseBase) return true;
	return turn.reviseBaseVersionN !== expectedN;
}

export function stampReviseDiffBase(
	turn: Pick<AiAskTurn, "report" | "versionIndex" | "reviseBase" | "reviseBaseVersionN">,
	base: string,
	versionN?: number | null,
): void {
	const trimmed = base.trim();
	const landed = (turn.report || "").trim();
	if (!trimmed || !landed || trimmed === landed) return;
	turn.reviseBase = trimmed;
	const n =
		typeof versionN === "number" && versionN > 0
			? versionN
			: expectedReviseBaseVersionN(turn);
	if (n) turn.reviseBaseVersionN = n;
}

export const REPORT_CHANGE_BLOCK_SELECTOR =
	":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote, :scope > ul > li, :scope > ol > li, :scope > .ai-report-table-wrap, :scope > .ai-report-mermaid, :scope > .ai-report-diagram, :scope > .ai-report-code, :scope > .ai-report-html, :scope > hr";

function reportBlockKeyFromElement(el: HTMLElement): string {
	if (el.dataset.reportBlockKey) return el.dataset.reportBlockKey;
	const clone = el.cloneNode(true) as HTMLElement;
	clone.querySelectorAll(".paragraph-num").forEach((node) => node.remove());
	return normalizeReportBlockText(clone.textContent || "");
}

/** Stamp `data-report-block-key` on rendered blocks from the markdown source. */
export function stampReportBlockKeys(body: ParentNode, markdown: string): number {
	if (typeof (body as Element).querySelectorAll !== "function") return 0;
	const blocks = enumerateReportBlocks(markdown);
	const els = body.querySelectorAll<HTMLElement>(REPORT_CHANGE_BLOCK_SELECTOR);
	let stamped = 0;
	blocks.forEach((block, index) => {
		const el = els[index];
		if (!el) return;
		el.dataset.reportBlockIdx = String(index);
		const blockId = splitBlockIdForEnumeratedKey(
			markdown,
			block.key,
			block.markdown,
		);
		if (blockId) {
			el.dataset.reportBlockId = blockId;
		} else {
			delete el.dataset.reportBlockId;
		}
		if (block.key.length >= REPORT_BLOCK_KEY_MIN) {
			el.dataset.reportBlockKey = block.key;
			stamped += 1;
		} else {
			delete el.dataset.reportBlockKey;
		}
	});
	for (let i = blocks.length; i < els.length; i += 1) {
		delete els[i].dataset.reportBlockKey;
		delete els[i].dataset.reportBlockIdx;
		delete els[i].dataset.reportBlockId;
	}
	return stamped;
}

function clearReportDiffMarks(body: ParentNode): void {
	body.querySelectorAll<HTMLElement>(REPORT_CHANGE_BLOCK_SELECTOR).forEach((el) => {
		el.classList.remove(
			"is-changed",
			"is-change-added",
			"is-change-edited",
			"is-first-change",
		);
	});
	body.querySelectorAll(".ai-change-removed").forEach((el) => el.remove());
}

/** Map a stamped block (e.g. `li`) to the body's direct child to insert before. */
export function topLevelReportBlock(
	body: Element,
	target: Element | null,
): Element | null {
	if (!target || !body.contains(target)) return null;
	let node: Element = target;
	while (node.parentElement && node.parentElement !== body) {
		node = node.parentElement;
	}
	return node.parentElement === body ? node : null;
}

function findReportRemovalAnchor(
	body: Element,
	block: Pick<ReportRemovedBlock, "beforeNextIndex" | "beforeNextKey">,
): Element | null {
	const els = body.querySelectorAll<HTMLElement>(REPORT_CHANGE_BLOCK_SELECTOR);
	let anchor: HTMLElement | null = null;
	if (block.beforeNextKey) {
		for (const el of els) {
			if (el.dataset.reportBlockKey === block.beforeNextKey) {
				anchor = el;
				break;
			}
		}
	}
	if (!anchor && block.beforeNextIndex !== null) {
		const targetIndex = block.beforeNextIndex;
		for (const el of els) {
			if (Number(el.dataset.reportBlockIdx) === targetIndex) {
				anchor = el;
				break;
			}
		}
		if (!anchor) {
			for (const el of els) {
				if (Number(el.dataset.reportBlockIdx) >= targetIndex) {
					anchor = el;
					break;
				}
			}
		}
	}
	return topLevelReportBlock(body, anchor);
}

function insertRemovedBlockGhost(
	body: Element,
	block: ReportContentBlock,
	before?: Element | null,
): void {
	const doc = body.ownerDocument;
	if (!doc) return;
	const details = doc.createElement("details");
	details.className = "ai-change-removed";
	const summary = doc.createElement("summary");
	summary.textContent = "Removed in this version";
	const content = doc.createElement("div");
	content.className = "ai-change-removed-body";
	content.innerHTML = renderResearchReportHtml(block.markdown);
	details.append(summary, content);
	const insertionPoint = topLevelReportBlock(body, before);
	if (insertionPoint) {
		body.insertBefore(details, insertionPoint);
	} else {
		body.appendChild(details);
	}
}

/**
 * Paint git-like diff marks: green additions, amber edits, red removals
 * (removals collapsed in `<details>`). Returns how many live blocks were tagged.
 */
export function markReportBlockDiff(
	body: ParentNode,
	diff: ReportBlockDiff | null,
	baseMarkdown = "",
): number {
	if (typeof (body as Element).querySelectorAll !== "function") return 0;
	clearReportDiffMarks(body);
	if (!diff) return 0;
	const added = new Set(diff.added);
	const edited = new Set(diff.edited);
	let marked = 0;
	let firstMarked: HTMLElement | null = null;
	for (const el of body.querySelectorAll<HTMLElement>(
		REPORT_CHANGE_BLOCK_SELECTOR,
	)) {
		const key = reportBlockKeyFromElement(el);
		if (!key) continue;
		if (added.has(key)) {
			el.classList.add("is-change-added");
			marked += 1;
			if (!firstMarked) firstMarked = el;
		} else if (edited.has(key)) {
			el.classList.add("is-change-edited");
			marked += 1;
			if (!firstMarked) firstMarked = el;
		}
	}
	const container = body as Element;
	if (typeof container.appendChild === "function" && baseMarkdown.trim()) {
		for (const block of diff.removed) {
			insertRemovedBlockGhost(
				container,
				block,
				findReportRemovalAnchor(container, block),
			);
		}
	}
	if (firstMarked !== null) {
		(firstMarked as HTMLElement).classList.add("is-first-change");
	}
	return marked;
}

/** @deprecated Use markReportBlockDiff */
export function markChangedReportBlocks(
	body: ParentNode,
	keys: readonly string[],
): number {
	return markReportBlockDiff(body, {
		added: [...keys],
		edited: [],
		removed: [],
	});
}

/** The version a row was built from: its `from`, else the one before it. */
export function previousResearchVersion(
	index: readonly ResearchVersionMeta[],
	row: ResearchVersionMeta,
): ResearchVersionMeta | undefined {
	const fromN = row.from && row.from > 0 && row.from !== row.n ? row.from : row.n - 1;
	if (fromN < 1) return undefined;
	return index.find((item) => item.n === fromN);
}

/**
 * One row of the Versions drawer: version + when, the reader's instruction,
 * the writer's changelog, and a stats line with deltas against the base.
 */
export const RESEARCH_VERSIONS_CHANGELOG_ONLY_TAG = "changelog only";

export const researchVersionsFootnoteHtml = (
	max = RESEARCH_REVISE_BODIES_MAX,
): string =>
	`Only the last ${max} versions can be opened. Older rows show revision notes only.`;

export function researchVersionRowHtml(
	row: ResearchVersionMeta,
	options: {
		current?: boolean;
		preview?: boolean;
		previewable?: boolean;
		previous?: ResearchVersionMeta;
		fallbackStats?: ResearchHistoryReportStats;
		changesChip?: { label: string; pressed: boolean };
	} = {},
): string {
	const relative = formatAskRelativeTime(row.at);
	const absolute = formatAskAbsoluteTime(row.at);
	const when = relative
		? `<span class="ai-versions-when" title="${escapeHtml(absolute)}" aria-label="${escapeHtml(absolute)}">${escapeHtml(relative)}</span>`
		: "";
	const previewable = options.previewable !== false;
	const tag = options.current
		? `<span class="ai-versions-tag">current</span>`
		: !previewable
			? `<span class="ai-versions-tag ai-versions-tag-muted">${RESEARCH_VERSIONS_CHANGELOG_ONLY_TAG}</span>`
			: "";
	const scope = (row.heading || "").trim();
	const instruction = (row.instruction || "").trim();
	const ask = instruction
		? `<span class="ai-versions-ask"><span class="ai-versions-ask-head"><span class="ai-versions-ask-label">You asked</span><button type="button" class="ai-versions-copy" data-ai-versions-copy aria-label="${escapeHtml(
				RESEARCH_VERSIONS_COPY_ASK,
			)}" title="${escapeHtml(RESEARCH_VERSIONS_COPY_ASK)}">${ASK_COPY_ICON_SVG}</button></span><span class="ai-versions-ask-text" data-ai-versions-ask>“${escapeHtml(instruction)}”</span>${
				scope ? ` <span class="ai-versions-scope">in ${escapeHtml(scope)}</span>` : ""
			}</span>`
		: "";
	const note = (row.changelog || "").trim() || (instruction ? "" : "Untitled revision");
	const stats = row.stats || options.fallbackStats;
	const statsLine = formatResearchVersionStats(stats, options.previous?.stats);
	const changesChip = options.changesChip
		? `<span class="ai-versions-changes-wrap">${researchVersionChangesChipHtml(
				options.changesChip,
			)}</span>`
		: "";
	const body =
		ask || note
			? `<span class="ai-versions-body">${ask}${
					note ? `<span class="ai-versions-note">${escapeHtml(note)}</span>` : ""
				}</span>`
			: "";
	const classes = [
		"ai-versions-row",
		options.current ? "is-current" : "",
		options.preview ? "is-preview" : "",
		!previewable ? "is-metadata-only" : "",
	]
		.filter(Boolean)
		.join(" ");
	const interactive = previewable
		? `role="button" tabindex="0" aria-pressed="${options.preview ? "true" : "false"}"`
		: `aria-disabled="true"`;
	// A div, not a <button>: the “You asked” text must stay selectable.
	return `<li><div data-ai-version-n="${row.n}" data-ai-version-previewable="${previewable ? "true" : "false"}" class="${classes}" ${interactive}><span class="ai-versions-row-head"><span class="ai-versions-n">v${row.n}</span>${tag}${when}</span>${body}${
		statsLine ? `<span class="ai-versions-stats">${escapeHtml(statsLine)}</span>` : ""
	}${changesChip}</div></li>`;
}

export const RESEARCH_VERSIONS_COPY_ASK = "Copy this instruction";

const ASK_COPY_ICON_SVG =
	'<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

/** True when the reader is selecting text inside `el` (a click should not fire). */
export function selectionInside(el: Element, doc: Document = document): boolean {
	const selection = doc.getSelection?.();
	if (!selection || selection.isCollapsed || !selection.toString().trim()) {
		return false;
	}
	const anchor = selection.anchorNode;
	return Boolean(anchor && el.contains(anchor));
}

type RangeRectLike = Pick<
	DOMRect,
	"left" | "top" | "right" | "bottom" | "width" | "height"
>;

/** Last non-empty line box of a selection — where the reader stopped. */
export function lastRangeClientRect(range: {
	getClientRects: () => ArrayLike<RangeRectLike>;
	getBoundingClientRect?: () => RangeRectLike;
}): RangeRectLike | null {
	const rects = range.getClientRects();
	for (let i = rects.length - 1; i >= 0; i--) {
		const rect = rects[i];
		if (rect && rect.width > 0 && rect.height > 0) return rect;
	}
	const box = range.getBoundingClientRect?.();
	if (box && (box.width > 0 || box.height > 0)) return box;
	return null;
}

export const REVISE_FLOAT_GAP = 8;

/**
 * Offset inside a positioned ancestor for the Revise chip. It sits just after
 * the end of the selection on the same line when the column has room there;
 * otherwise it drops to the next row, right-aligned under the selection end,
 * so it never lands in the middle of the selected text.
 */
export function reviseFloatOffset(
	lastLine: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "height">,
	origin: Pick<DOMRect, "left" | "top">,
	chip: { width: number; height: number },
	column: Pick<DOMRect, "left" | "right">,
): { left: number; top: number; placement: "after" | "below" } {
	const gap = REVISE_FLOAT_GAP;
	const fitsAfter = lastLine.right + gap + chip.width <= column.right;
	if (fitsAfter) {
		return {
			left: lastLine.right + gap - origin.left,
			top: lastLine.top + (lastLine.height - chip.height) / 2 - origin.top,
			placement: "after",
		};
	}
	const maxLeft = column.right - chip.width;
	const wantLeft = Math.min(lastLine.right, column.right) - chip.width;
	const left = Math.max(column.left, Math.min(wantLeft, maxLeft));
	return {
		left: left - origin.left,
		top: lastLine.bottom + gap * 0.75 - origin.top,
		placement: "below",
	};
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
	const compositionAttachments = [
		...root.querySelectorAll<HTMLElement>("[data-ai-composition-attachments]"),
	];
	const compositionContextEls = [
		...root.querySelectorAll<HTMLElement>("[data-ai-composition-context]"),
	];
	const compositionContextLabels = [
		...root.querySelectorAll<HTMLElement>("[data-ai-composition-context-label]"),
	];
	const compositionContextClears = [
		...root.querySelectorAll<HTMLButtonElement>(
			"[data-ai-composition-context-clear]",
		),
	];
	const compositionImageLists = [
		...root.querySelectorAll<HTMLElement>("[data-ai-composition-images]"),
	];
	const compositionImageCaps = [
		...root.querySelectorAll<HTMLElement>("[data-ai-composition-images-cap]"),
	];
	const compositionImageAttachButtons = [
		...root.querySelectorAll<HTMLButtonElement>("[data-ai-composition-image]"),
	];
	const compositionImageInput = root.querySelector<HTMLInputElement>(
		"[data-ai-composition-image-input]",
	);
	const reviseScope = root.querySelector<HTMLElement>("[data-ai-revise-scope]");
	const reviseStackEl = root.querySelector<HTMLElement>("[data-ai-revise-stack]");
	const reviseCapNoteEl = root.querySelector<HTMLElement>("[data-ai-revise-cap-note]");
	const reviseChipEl = root.querySelector<HTMLElement>("[data-ai-revise-chip]");
	const reviseClearBtn = root.querySelector<HTMLButtonElement>("[data-ai-revise-clear]");
	const askWithoutEditingBtn = root.querySelector<HTMLButtonElement>(
		"[data-ai-ask-without-editing]",
	);
	const reviseFloat = root.querySelector<HTMLButtonElement>("[data-ai-revise-float]");
	const versionsDrawer = root.querySelector<HTMLElement>("[data-ai-versions-drawer]");
	const versionsList = root.querySelector<HTMLElement>("[data-ai-versions-list]");
	const versionsFootnote = root.querySelector<HTMLElement>(
		"[data-ai-versions-footnote]",
	);
	const versionsActions = root.querySelector<HTMLElement>("[data-ai-versions-actions]");
	const versionsReviseBtn = root.querySelector<HTMLButtonElement>(
		"[data-ai-versions-revise]",
	);
	const versionsRestoreBtn = root.querySelector<HTMLButtonElement>(
		"[data-ai-versions-restore]",
	);
	const micButtons = [
		...root.querySelectorAll<HTMLButtonElement>("[data-ai-mic]"),
	];
	if (!form || !input || !thread || !empty || !composer) return;
	installDiscourseCitationPopovers(thread);

	const restoreStatusEl = root.querySelector<HTMLElement>(".ai-restore-status");
	const restoreStatusIdle = restoreStatusEl?.textContent?.trim() || "Opening the report…";
	let restoreSlowTimer = 0;

	/**
	 * “Opening the report…” used to sit there forever when the database hung;
	 * after a few seconds say so, and fetches time out (see aiJsonRequestInit)
	 * so the reader gets an error instead of a spinner.
	 */
	function setRestoringResearch(on: boolean): void {
		root.classList.toggle("is-restoring-research", on);
		if (restoreSlowTimer) {
			window.clearTimeout(restoreSlowTimer);
			restoreSlowTimer = 0;
		}
		if (restoreStatusEl) restoreStatusEl.textContent = restoreStatusIdle;
		if (!on) return;
		restoreSlowTimer = window.setTimeout(() => {
			restoreSlowTimer = 0;
			if (restoreStatusEl && root.classList.contains("is-restoring-research")) {
				restoreStatusEl.textContent = AI_SERVER_SLOW_STATUS;
			}
		}, AI_SERVER_SLOW_AFTER_MS);
	}

	if (
		!shareMode &&
		askResearchJobParam(window.location.search)
	) {
		setRestoringResearch(true);
	}

	let turns: AiAskTurn[] = [];
	let sessionEntries = readAiAskSession();
	/** Hard-deleted research jobs — never re-add from sync/hydrate/watch. */
	const deletedResearchJobIds = new Set<string>(
		readDeletedResearchJobIds(
			typeof localStorage === "undefined" ? null : localStorage,
		),
	);
	if (deletedResearchJobIds.size > 0) {
		sessionEntries = filterDeletedResearchJobs(
			sessionEntries,
			deletedResearchJobIds,
		);
	}
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
	let compositionContexts: string[] = [];
	let compositionImages: ResearchContextImage[] = [];
	let compositionImagesLoading = 0;
	let compositionContextTextarea: HTMLTextAreaElement | null = null;
	let compositionMutating = false;
	let compositionDeleteHandledThisTick = false;
	let compositionDraftHydrated = false;
	let storedResearchCompositionDraft: ResearchCompositionDraft | null | undefined;
	/** Images from the last Research submit, restored on cancel/stop. */
	let pendingResearchSubmitImages: ResearchContextImage[] | null = null;
	/** Pasted-notes clips from the last Research submit, restored on cancel/stop. */
	let pendingResearchSubmitContexts: string[] | null = null;
	/** Images from the last Revise submit, restored on cancel/failure. */
	let lastReviseSubmitImages: ResearchContextImage[] = [];
	const compositionMirrorHosts = new WeakMap<
		HTMLTextAreaElement,
		{
			mirror: HTMLDivElement;
			mirrorHost: HTMLDivElement;
			layer: HTMLDivElement;
		}
	>();
	let inlineContextChipSyncRaf = 0;
	let pendingInlineContextChipTarget: HTMLTextAreaElement | null | undefined;
	let compositionChipSyncAfterPinTimer = 0;
	let pendingCompositionChipRelayout = false;
	let wasFollowDockExpanded = false;
	let lastFollowDockPinWidth = 0;
	const compositionLayoutWidthByTextarea = new WeakMap<
		HTMLTextAreaElement,
		number
	>();
	let researchPollTimer = 0;
	let researchPollHiddenCleanup: (() => void) | null = null;
	let reviseEditDraft: ResearchReviseEditDraft = emptyReviseEditDraft();
	let lastReviseEditDraft: ResearchReviseEditDraft = emptyReviseEditDraft();
	let followComposerPinnedOpen = false;
	/** After Stop, keep the dock compact until the reader taps to expand. */
	let followComposerHoldCompact = false;
	let reviseFromVersion: number | null = null;
	let previewVersion: { n: number; report: string } | null = null;
	let previewVersionToken = 0;
	/** Report body shown while a revise is pending (keeps v8 visible when revising from v8). */
	let revisePendingSource: { n: number; report: string } | null = null;
	/** Last revise instruction, restored to the compose bar if the job fails. */
	let lastReviseInstruction = "";
	/** Whether changed paragraphs are highlighted after a revise lands. */
	let showReviseChanges = false;
	let hydratingReviseBase = false;
	let hydrateReviseBaseToken = 0;
	let headingReviseBtn: HTMLButtonElement | null = null;
	const REVISE_PENDING_KEY = "ai-revise-pending";

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
	let researchLocalCancelToken = 0;

	function researchJobWouldReviveAfterLocalCancel(
		turn: AiAskTurn,
		job: ResearchJobPublic,
	): boolean {
		if (!turn.researchLocalCancelToken) return false;
		if (!job.pending) return false;
		return job.status === "revising" || job.status === "revise-clarifying";
	}
	const watchingResearchJobs = new Set<string>();

	function isResearchJobDeleted(jobId: string): boolean {
		const id = normalizeDeletedResearchJobId(jobId);
		return Boolean(id) && deletedResearchJobIds.has(id);
	}

	function markResearchJobDeleted(jobId: string): void {
		const id = normalizeDeletedResearchJobId(jobId);
		if (!id || deletedResearchJobIds.has(id)) return;
		deletedResearchJobIds.add(id);
		try {
			rememberDeletedResearchJobIds(
				[id],
				typeof localStorage === "undefined" ? null : localStorage,
			);
		} catch {
			/* tombstone stays in memory */
		}
		watchingResearchJobs.delete(id);
	}
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

	function followDockCompact(): boolean {
		return Boolean(
			root.classList.contains("is-report-dock") &&
				followForm &&
				!followForm.hidden &&
				!root.classList.contains("is-follow-expanded"),
		);
	}

	function followComposerScrollBody(): HTMLElement | null {
		if (!followForm?.classList.contains("is-follow-expanded")) return null;
		return followForm.querySelector<HTMLElement>(".ai-composer-body");
	}

	let lockedFollowComposerScrollTop: number | null = null;
	let followComposerScrollAnchor: number | null = null;
	let followComposerScrollLockDepth = 0;
	let followComposerScrollUnlockRaf = 0;

	function armFollowComposerScrollAnchor(): void {
		const body = followComposerScrollBody();
		if (body) followComposerScrollAnchor = body.scrollTop;
	}

	function releaseFollowComposerScrollAnchor(): void {
		followComposerScrollAnchor = null;
	}

	function beginFollowComposerScrollLock(): void {
		if (followComposerScrollLockDepth === 0) {
			const body = followComposerScrollBody();
			const top = body?.scrollTop ?? null;
			lockedFollowComposerScrollTop = top;
			if (top !== null) followComposerScrollAnchor = top;
		}
		followComposerScrollLockDepth += 1;
	}

	function restoreFollowComposerScroll(): void {
		const body = followComposerScrollBody();
		const top = lockedFollowComposerScrollTop ?? followComposerScrollAnchor;
		if (body && top !== null) {
			body.scrollTop = top;
		}
	}

	function scheduleFollowComposerScrollRestore(frames = 12): void {
		if (followComposerScrollUnlockRaf) {
			cancelAnimationFrame(followComposerScrollUnlockRaf);
		}
		let remaining = frames;
		const tick = () => {
			restoreFollowComposerScroll();
			remaining -= 1;
			if (remaining > 0) {
				followComposerScrollUnlockRaf = requestAnimationFrame(tick);
			} else {
				followComposerScrollUnlockRaf = 0;
				lockedFollowComposerScrollTop = null;
				if (!compositionChipSyncAfterPinTimer) {
					releaseFollowComposerScrollAnchor();
				}
			}
		};
		followComposerScrollUnlockRaf = requestAnimationFrame(tick);
	}

	function endFollowComposerScrollLock(): void {
		followComposerScrollLockDepth = Math.max(0, followComposerScrollLockDepth - 1);
		restoreFollowComposerScroll();
		if (followComposerScrollLockDepth > 0) return;
		if (lockedFollowComposerScrollTop === null && followComposerScrollAnchor === null) {
			return;
		}
		scheduleFollowComposerScrollRestore();
	}

	/** Keep expanded revise compose from jumping to the top during chip layout. */
	function preserveFollowComposerScroll<T>(run: () => T): T {
		beginFollowComposerScrollLock();
		try {
			return run();
		} finally {
			endFollowComposerScrollLock();
		}
	}

	function setComposerSelection(
		textarea: HTMLTextAreaElement,
		start: number,
		end = start,
	): void {
		const bodyScroll = followComposerScrollBody()?.scrollTop ?? null;
		const textareaScroll = textarea.scrollTop;
		textarea.setSelectionRange(start, end);
		textarea.scrollTop = textareaScroll;
		if (bodyScroll !== null) {
			const body = followComposerScrollBody();
			if (body) body.scrollTop = bodyScroll;
		}
	}

	let currentStatusText = "";
	let deferredStatus = "";

	function shouldShowFollowComposerStatus(): boolean {
		if (!currentStatusText) return false;
		if (followDockCompact()) return false;
		if (!root.classList.contains("is-follow-expanded")) return false;
		if (reviseFollowActive()) {
			const draft = reviseDraftFromComposer();
			const typed = (followInput?.value || "").trim();
			if (!hasReviseComposerContent(draft) && !typed) return false;
		}
		return true;
	}

	function shouldShowMainComposerStatus(): boolean {
		if (!currentStatusText) return false;
		if (root.classList.contains("is-research-gated")) return false;
		return true;
	}

	function syncStatusPresentation(): void {
		for (const el of statuses) {
			const inFollow = Boolean(el.closest("[data-ai-follow-form]"));
			el.textContent = currentStatusText;
			if (!currentStatusText) {
				el.hidden = true;
				continue;
			}
			el.hidden = inFollow
				? !shouldShowFollowComposerStatus()
				: !shouldShowMainComposerStatus();
		}
	}

	function setStatus(text: string, options?: { showInCompactDock?: boolean }): void {
		currentStatusText = text;
		const showInCompact = options?.showInCompactDock ?? false;
		if (text && followDockCompact() && !showInCompact) {
			deferredStatus = text;
		} else {
			deferredStatus = "";
		}
		syncStatusPresentation();
	}

	function flushDeferredStatus(): void {
		if (!deferredStatus || followDockCompact()) return;
		currentStatusText = deferredStatus;
		deferredStatus = "";
		syncStatusPresentation();
	}

	function followSendStatusBlocked(): boolean {
		return Boolean(currentStatusText && followDockCompact());
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
		syncComposerMaxLength();
		syncResearchChip();
		if (turns.length === 0) syncLayout();
	}

	function syncComposerMaxLength(): void {
		const max = maxAskQuestionChars(Boolean(quota?.signedIn));
		if (input) input.maxLength = max;
		syncFollowInputMaxLength();
	}

	function questionCharLimitForTextarea(textarea: HTMLTextAreaElement): number {
		if (reviseFollowActive() && textarea === followInput) {
			return RESEARCH_REVISE_INSTRUCTION_MAX;
		}
		return maxAskQuestionChars(Boolean(quota?.signedIn));
	}

	function askContextPasteEnabled(textarea: HTMLTextAreaElement): boolean {
		if (!quota?.signedIn) return false;
		if (researchPaneOn()) return false;
		if (reviseFollowActive()) return false;
		if (textarea === followInput && lastFinishedReportTurn()) return false;
		return textarea === input || textarea === followInput;
	}

	function compositionContextPasteEnabled(
		textarea: HTMLTextAreaElement,
	): boolean {
		return (
			researchCompositionEnabled() || askContextPasteEnabled(textarea)
		);
	}

	function buildAskSubmitQuestion(question: string, context?: string): string {
		const material = context === undefined ? mergedCompositionContext() : context;
		if (!material.trim()) return question;
		return `${question}${formatAttachedMaterialBlock(material)}`;
	}

	function researchUiOn(): boolean {
		// Ask and Research are dedicated modes with distinct meters — the Ask
		// composer always shows Asks remaining, never research reports.
		if (!researchPaneOn()) return false;
		if (turns.length === 0) {
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

	/** A revision on the last turn is waiting on the planner's questions. */
	function isReviseClarifyingTurn(turn: AiAskTurn | undefined): boolean {
		return Boolean(
			turn &&
				turn.researchJobId &&
				(turn.report || "").trim() &&
				isResearchReviseClarifying(turn),
		);
	}

	/** Whichever clarify draft the card on `turn` is editing. */
	function clarifyDraftFor(
		turn: AiAskTurn | undefined,
		kind: string | null,
	): AiAskTurn["researchClarify"] | ResearchReviseClarifyDraft | undefined {
		if (!turn) return undefined;
		return kind === "revise" ? turn.reviseClarify : turn.researchClarify;
	}

	function bindClarifyOtherInput(inputEl: HTMLTextAreaElement): void {
		if (inputEl.dataset.bound === "1") return;
		inputEl.dataset.bound = "1";
		fitClarifyOther(inputEl);
		inputEl.addEventListener("input", () => {
			const index = Number(inputEl.getAttribute("data-turn-index"));
			const questionId = inputEl.getAttribute("data-question-id") || "";
			const turn = turns[index];
			const draft = clarifyDraftFor(turn, inputEl.getAttribute("data-clarify-kind"));
			if (!draft || !questionId) return;
			const currentAnswer = draft.answers[questionId] || {
				choiceId: RESEARCH_CLARIFY_OTHER_ID,
			};
			draft.answers = {
				...draft.answers,
				[questionId]: {
					...currentAnswer,
					choiceId: RESEARCH_CLARIFY_OTHER_ID,
					otherText: inputEl.value.slice(0, RESEARCH_CLARIFY_MAX_OTHER),
				},
			};
			fitClarifyOther(inputEl);
			syncClarifyBar();
		});
	}

	/** Toggle clarify chips without rebuilding the thread (avoids scroll drift). */
	function patchClarifyChoiceUi(
		turnIndex: number,
		kind: string | null,
		questionId: string,
	): void {
		const turn = turns[turnIndex];
		const draft = clarifyDraftFor(turn, kind);
		if (!draft) return;
		const qWrap = thread.querySelector<HTMLElement>(
			`[data-ai-clarify-choice][data-turn-index="${turnIndex}"][data-question-id="${questionId}"]`,
		)?.closest(".ai-clarify-q");
		qWrap
			?.querySelectorAll<HTMLButtonElement>("[data-ai-clarify-choice]")
			.forEach((button) => {
				if (kind && button.getAttribute("data-clarify-kind") !== kind) return;
				const qId = button.getAttribute("data-question-id") || "";
				const cId = button.getAttribute("data-choice-id") || "";
				const on = draft.answers[qId]?.choiceId === cId;
				if (button.classList.contains("is-on") !== on) {
					button.classList.toggle("is-on", on);
				}
				button.setAttribute("aria-checked", on ? "true" : "false");
			});
		if (!qWrap) {
			syncClarifyBar();
			return;
		}
		const selected = draft.answers[questionId]?.choiceId || "";
		let other = qWrap.querySelector<HTMLTextAreaElement>("[data-ai-clarify-other]");
		if (selected === RESEARCH_CLARIFY_OTHER_ID) {
			if (!other) {
				other = document.createElement("textarea");
				other.className = "ai-clarify-other";
				other.setAttribute("data-ai-clarify-other", "");
				if (kind) other.setAttribute("data-clarify-kind", kind);
				other.setAttribute("data-turn-index", String(turnIndex));
				other.setAttribute("data-question-id", questionId);
				other.rows = 2;
				other.maxLength = RESEARCH_CLARIFY_MAX_OTHER;
				other.placeholder = "Add a short note";
				other.value = draft.answers[questionId]?.otherText || "";
				qWrap.appendChild(other);
				bindClarifyOtherInput(other);
			} else {
				other.hidden = false;
			}
		} else if (other) {
			other.hidden = true;
		}
		if (clarifyStartBtn) {
			const canContinue = canStartResearchClarify(
				draft.questions,
				answersFromClarifyState(draft.answers),
			);
			clarifyStartBtn.disabled = !canContinue;
		}
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

	function lastFinishedReportTurn(): AiAskTurn | undefined {
		const last = turns[turns.length - 1];
		if (
			!last?.research ||
			last.pending ||
			!(last.report || "").trim()
		) {
			return undefined;
		}
		return last;
	}

	function followResearchChipOn(): boolean {
		// Research is a dedicated mode now — the follow-up composer has no
		// Research pill, so follow-ups are never Research.
		return false;
	}

	function reviseFollowActive(): boolean {
		const last = lastFinishedReportTurn();
		return shouldReviseResearchFollow({
			lastTurnResearch: Boolean(last?.research),
			lastTurnPending: Boolean(last?.pending),
			hasReport: Boolean((last?.report || "").trim()),
			researchChipOn: followResearchChipOn(),
		});
	}

	function shareSlugForRevise(): string {
		if (!shareMode) return "";
		try {
			const share = sanitizeAskShareSnapshot(
				JSON.parse(shareSnapshot || "null"),
			);
			return share?.slug || "";
		} catch {
			return "";
		}
	}

	function researchCompositionEnabled(): boolean {
		return researchPaneOn() || researchChipOn;
	}

	function compositionImagesEnabled(): boolean {
		return researchCompositionEnabled() || reviseFollowActive();
	}

	function compositionDropEnabled(): boolean {
		if (compositionImagesEnabled()) return true;
		return Boolean(
			followForm &&
				!followForm.hidden &&
				root.classList.contains("is-report-dock") &&
				(researchPaneOn() ||
					researchChipOn ||
					reviseFollowActive() ||
					Boolean(lastFinishedReportTurn()?.research)),
		);
	}

	function clearCompositionAttachments(options?: {
		clearDraft?: boolean;
		persistDraft?: boolean;
	}): void {
		clearCompositionContext();
		compositionImages = [];
		compositionImagesLoading = 0;
		if (options?.clearDraft !== false) {
			clearResearchCompositionDraftStorage();
		}
		syncCompositionTray({
			persistDraft: options?.persistDraft,
		});
	}

	function snapshotResearchSubmitImages(
		images: readonly ResearchContextImage[],
	): void {
		const sanitized = sanitizeResearchContextImages(images);
		pendingResearchSubmitImages =
			sanitized.length > 0 ? sanitized : null;
	}

	function snapshotResearchSubmitContexts(contexts: readonly string[]): void {
		const clips = contexts
			.map((context) => clipResearchContext(context))
			.filter((context) => context.trim());
		pendingResearchSubmitContexts = clips.length > 0 ? clips : null;
	}

	function clearPendingResearchSubmitImages(): void {
		pendingResearchSubmitImages = null;
	}

	function clearPendingResearchSubmitContexts(): void {
		pendingResearchSubmitContexts = null;
	}

	function clearPendingResearchSubmitAttachments(): void {
		clearPendingResearchSubmitImages();
		clearPendingResearchSubmitContexts();
	}

	function restorePendingResearchImagesToComposer(): void {
		if (!pendingResearchSubmitImages?.length) return;
		if (compositionImages.length > 0) return;
		compositionImages = [...pendingResearchSubmitImages];
		syncCompositionTray();
		persistResearchCompositionDraft();
	}

	function restorePendingResearchContextsToComposer(): void {
		if (!pendingResearchSubmitContexts?.length) return;
		if (compositionContexts.length > 0) return;
		restoreCompositionContextsToComposer(pendingResearchSubmitContexts);
	}

	function restorePendingResearchAttachmentsToComposer(): void {
		restorePendingResearchImagesToComposer();
		restorePendingResearchContextsToComposer();
	}

	/**
	 * Durably store a turn's attachments (full pasted-notes text + image bytes)
	 * in the same-browser IndexedDB store, keyed by researchJobId. Saves merge,
	 * so later calls after the pending submit snapshot was cleared only fill
	 * gaps and never wipe stored bytes.
	 */
	function saveTurnAttachmentsToStore(turn: AiAskTurn): void {
		const jobId = (turn.researchJobId || "").trim();
		if (!turn.research || !jobId) return;
		const contextFull = mergeCompositionContexts(
			pendingResearchSubmitContexts || [],
		);
		const images = sanitizeResearchContextImages(
			pendingResearchSubmitImages || turn.attachedImages || [],
		);
		if (!contextFull.trim() && images.length === 0) return;
		const keepJobIds = sessionEntries
			.map((entry) => entry.researchJobId || "")
			.filter(Boolean);
		void saveResearchAttachments(
			{
				jobId,
				contextFull,
				images,
				...(turn.contextPreview
					? { contextPreview: turn.contextPreview }
					: {}),
				...(typeof turn.contextWordCount === "number"
					? { contextWordCount: turn.contextWordCount }
					: {}),
				...(turn.contextAttachmentLabel
					? { contextAttachmentLabel: turn.contextAttachmentLabel }
					: {}),
				...(typeof turn.imageCount === "number"
					? { imageCount: turn.imageCount }
					: {}),
			},
			{ keepJobIds },
		).catch(() => {
			/* attachment store is best-effort */
		});
	}

	/**
	 * Put pasted-notes clips back into the composer as a single chip (content
	 * identical, markers re-anchored). Used when a submit fails or is stopped
	 * so the notes survive for an immediate retry.
	 */
	function restoreCompositionContextsToComposer(
		clips: readonly string[],
	): boolean {
		const merged = clipResearchContext(
			clips
				.map((clip) => clip.trim())
				.filter(Boolean)
				.join("\n\n"),
		);
		if (!merged.trim()) return false;
		const textarea = activeComposerTextarea();
		compositionContexts = [merged];
		if (textarea && compositionContextPasteEnabled(textarea)) {
			compositionContextTextarea = textarea;
			const at = textarea.selectionStart ?? textarea.value.length;
			insertCompositionContextMarker(textarea, at);
			syncCompositionTray();
			positionCursorAfterCompositionChipIndex(textarea, 0);
		} else {
			compositionContextTextarea = null;
			syncCompositionTray();
		}
		persistResearchCompositionDraft();
		return true;
	}

	function snapshotReviseSubmitImages(
		images: readonly ResearchContextImage[],
	): void {
		lastReviseSubmitImages = sanitizeResearchContextImages(images);
	}

	function clearReviseSubmitImages(): void {
		lastReviseSubmitImages = [];
	}

	function restoreReviseSubmitImagesToComposer(): void {
		if (!lastReviseSubmitImages.length) return;
		if (compositionImages.length > 0) return;
		compositionImages = [...lastReviseSubmitImages];
		syncCompositionTray();
		persistResearchCompositionDraft();
	}

	function researchCompositionDraftEligible(): boolean {
		return researchCompositionEnabled() && !reviseFollowActive() && turns.length === 0;
	}

	function clearResearchCompositionDraftStorage(): void {
		storedResearchCompositionDraft = null;
		try {
			sessionStorage.removeItem(RESEARCH_COMPOSITION_DRAFT_STORAGE_KEY);
		} catch {
			/* ignore */
		}
	}

	function loadStoredResearchCompositionDraft(): ResearchCompositionDraft | null {
		if (storedResearchCompositionDraft !== undefined) {
			return storedResearchCompositionDraft;
		}
		try {
			storedResearchCompositionDraft = parseResearchCompositionDraft(
				sessionStorage.getItem(RESEARCH_COMPOSITION_DRAFT_STORAGE_KEY),
			);
		} catch {
			storedResearchCompositionDraft = null;
		}
		return storedResearchCompositionDraft;
	}

	function writeResearchCompositionDraftStorage(
		question: string,
		images: ResearchContextImage[],
	): void {
		const trimmedQuestion = stripCompositionChipMarkers(question);
		const sanitizedImages = sanitizeResearchContextImages(images);
		if (
			!hasResearchCompositionContent({
				question: trimmedQuestion,
				context: "",
				images: sanitizedImages,
			})
		) {
			clearResearchCompositionDraftStorage();
			return;
		}
		try {
			const serialized = serializeResearchCompositionDraft({
				question: trimmedQuestion,
				context: "",
				images: sanitizedImages,
			});
			sessionStorage.setItem(RESEARCH_COMPOSITION_DRAFT_STORAGE_KEY, serialized);
			storedResearchCompositionDraft = parseResearchCompositionDraft(serialized);
		} catch {
			/* ignore */
		}
	}

	function persistResearchCompositionDraft(): void {
		if (!compositionDraftHydrated) return;
		const stored = loadStoredResearchCompositionDraft();
		if (researchCompositionDraftEligible()) {
			writeResearchCompositionDraftStorage(
				input?.value || "",
				compositionImages,
			);
			return;
		}
		if (compositionImages.length > 0) {
			writeResearchCompositionDraftStorage(
				stored?.question ||
					stripCompositionChipMarkers(input?.value || ""),
				compositionImages,
			);
		}
	}

	function applyResearchCompositionDraftFromStorage(): void {
		const draft = loadStoredResearchCompositionDraft();
		if (!draft) return;
		if (
			compositionImages.length === 0 &&
			draft.images.length > 0 &&
			compositionImagesEnabled()
		) {
			compositionImages = [...draft.images];
		}
		if (researchCompositionDraftEligible()) {
			compositionContexts = [];
			compositionContextTextarea = null;
			if (input && draft.question) {
				input.value = draft.question;
				fitTextarea(input);
			}
		}
		syncCompositionTray({ persistDraft: false });
	}

	function maybeApplyResearchCompositionDraft(): void {
		if (!compositionDraftHydrated) return;
		applyResearchCompositionDraftFromStorage();
	}

	function restoreResearchCompositionDraft(): void {
		if (compositionDraftHydrated) return;
		compositionDraftHydrated = true;
		applyResearchCompositionDraftFromStorage();
	}

	function reserveCompositionImageSlot(): boolean {
		const remaining =
			MAX_RESEARCH_CONTEXT_IMAGES -
			compositionImages.length -
			compositionImagesLoading;
		if (remaining <= 0) return false;
		compositionImagesLoading += 1;
		return true;
	}

	function releaseCompositionImageSlot(): void {
		compositionImagesLoading = Math.max(0, compositionImagesLoading - 1);
	}

	function guardCompositionSelection(textarea: HTMLTextAreaElement): void {
		if (compositionMutating) return;
		const start = textarea.selectionStart ?? 0;
		const end = textarea.selectionEnd ?? start;
		const next = normalizeCompositionCaret(textarea.value, start, end);
		if (next.start !== start || next.end !== end) {
			setComposerSelection(textarea, next.start, next.end);
		}
	}

	function applyCompositionDeleteEdit(
		textarea: HTMLTextAreaElement,
		selStart: number,
		selEnd: number,
	): boolean {
		if (selStart === selEnd) return false;
		const edit = compositionEditDeleteSelection(
			textarea.value,
			selStart,
			selEnd,
		);
		if (!edit) return false;
		armFollowComposerScrollAnchor();
		compositionMutating = true;
		try {
			textarea.value = edit.value;
			for (const chipIndex of [...edit.removedChipIndices].sort((a, b) => b - a)) {
				compositionContexts = compositionContexts.filter(
					(_, index) => index !== chipIndex,
				);
			}
			if (compositionContexts.length === 0) {
				compositionContextTextarea = null;
			}
			setComposerSelection(textarea, edit.caret, edit.caret);
			fitTextarea(textarea);
			if (textarea === followInput) clipFollowInputValue();
			syncCompositionTray();
		} finally {
			compositionMutating = false;
		}
		syncInlineContextChip(textarea);
		persistResearchCompositionDraft();
		return true;
	}

	function handleCompositionDelete(
		textarea: HTMLTextAreaElement,
		inputType: string,
	): boolean {
		if (compositionDeleteHandledThisTick) return true;
		const regions = compositionMarkerRegions(textarea.value);
		if (regions.length === 0) return false;
		const selStart = textarea.selectionStart ?? 0;
		const selEnd = textarea.selectionEnd ?? selStart;
		const backward =
			inputType === "Backspace" || inputType === "deleteContentBackward";
		const forward =
			inputType === "Delete" || inputType === "deleteContentForward";

		if (selStart === selEnd) {
			if (!backward && !forward) return false;
			const chipIndex = compositionCollapsedDeleteChipIndex(
				textarea.value,
				selStart,
				backward ? "backward" : "forward",
			);
			if (chipIndex === null) return false;
			removeCompositionContextAt(textarea, chipIndex);
			persistResearchCompositionDraft();
			compositionDeleteHandledThisTick = true;
			requestAnimationFrame(() => {
				compositionDeleteHandledThisTick = false;
			});
			return true;
		}

		const handled = applyCompositionDeleteEdit(textarea, selStart, selEnd);
		if (handled) {
			compositionDeleteHandledThisTick = true;
			requestAnimationFrame(() => {
				compositionDeleteHandledThisTick = false;
			});
		}
		return handled;
	}

	function handleCompositionMarkerKeydown(
		event: KeyboardEvent,
		textarea: HTMLTextAreaElement,
	): void {
		if (compositionMarkerRegions(textarea.value).length === 0) return;
		if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
			const start = textarea.selectionStart ?? 0;
			const end = textarea.selectionEnd ?? start;
			const arrow = compositionMarkerArrowAdjust(
				textarea.value,
				event.key,
				start,
				end,
			);
			if (arrow) {
				event.preventDefault();
				setComposerSelection(textarea, arrow.start, arrow.end);
			}
			return;
		}
		if (event.key === "Backspace" || event.key === "Delete") {
			if (handleCompositionDelete(textarea, event.key)) {
				event.preventDefault();
			}
		}
	}

	function mergedCompositionContext(): string {
		return mergeCompositionContexts(compositionContexts);
	}

	function clearCompositionContext(): void {
		if (compositionContextTextarea) {
			removeAllCompositionContextMarkers(compositionContextTextarea);
		}
		compositionContexts = [];
		compositionContextTextarea = null;
		syncCompositionTray();
	}

	function removeAllCompositionContextMarkers(
		textarea: HTMLTextAreaElement,
	): void {
		while (textarea.value.includes(COMPOSITION_CONTEXT_CHIP_MARKER)) {
			removeCompositionContextMarkerAt(textarea, 0);
		}
	}

	function removeCompositionContextMarkerAt(
		textarea: HTMLTextAreaElement,
		chipIndex: number,
	): void {
		const markerIndex = compositionMarkerIndices(textarea.value)[chipIndex];
		if (markerIndex === undefined) return;
		const start = textarea.selectionStart ?? textarea.value.length;
		const end = textarea.selectionEnd ?? start;
		const padLen = compositionMarkerPadLength(textarea.value, markerIndex);
		const removeEnd = markerIndex + 1 + padLen;
		textarea.value =
			textarea.value.slice(0, markerIndex) + textarea.value.slice(removeEnd);
		const removed = 1 + padLen;
		const nextStart =
			start > markerIndex ? Math.max(markerIndex, start - removed) : start;
		const nextEnd =
			end > markerIndex ? Math.max(markerIndex, end - removed) : end;
		setComposerSelection(textarea, nextStart, nextEnd);
		fitTextarea(textarea);
	}

	function removeCompositionContextAt(
		textarea: HTMLTextAreaElement,
		chipIndex: number,
	): void {
		armFollowComposerScrollAnchor();
		preserveFollowComposerScroll(() => {
			compositionMutating = true;
			try {
				removeCompositionContextMarkerAt(textarea, chipIndex);
				compositionContexts = compositionContexts.filter(
					(_, index) => index !== chipIndex,
				);
				if (compositionContexts.length === 0) {
					compositionContextTextarea = null;
				}
				syncCompositionTray();
			} finally {
				compositionMutating = false;
			}
			syncInlineContextChip(textarea);
		});
	}

	function measureComposerCharWidth(textarea: HTMLTextAreaElement): number {
		const host = ensureCompositionMirrorHost(textarea);
		applyMirrorTypography(textarea, host.mirror);
		const probe = document.createElement("span");
		probe.textContent = COMPOSITION_CHIP_PAD_CHAR;
		host.mirror.append(probe);
		const width = probe.getBoundingClientRect().width;
		probe.remove();
		return width > 0 ? width : 8;
	}

	function applyMirrorTypography(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
	): void {
		const style = getComputedStyle(textarea);
		mirror.style.width = `${textarea.clientWidth}px`;
		mirror.style.font = style.font;
		mirror.style.fontSize = style.fontSize;
		mirror.style.fontFamily = style.fontFamily;
		mirror.style.fontWeight = style.fontWeight;
		mirror.style.lineHeight = style.lineHeight;
		mirror.style.letterSpacing = style.letterSpacing;
		mirror.style.padding = style.padding;
		mirror.style.whiteSpace = "pre-wrap";
		mirror.style.overflowWrap = style.overflowWrap;
	}

	function compositionTextareaContentRight(
		textarea: HTMLTextAreaElement,
	): number {
		const style = getComputedStyle(textarea);
		const rect = textarea.getBoundingClientRect();
		return rect.right - (parseFloat(style.paddingRight) || 0);
	}

	function measureCompositionChipLabelWidth(label: string): number {
		const probe = document.createElement("span");
		probe.className = "ai-composition-inline-chip";
		probe.style.position = "absolute";
		probe.style.visibility = "hidden";
		probe.style.pointerEvents = "none";
		const labelEl = document.createElement("span");
		labelEl.className = "ai-composition-context-label";
		labelEl.textContent = label;
		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "ai-composition-clear";
		remove.textContent = "×";
		probe.append(labelEl, remove);
		document.body.append(probe);
		const width = probe.getBoundingClientRect().width;
		probe.remove();
		return width > 0 ? width : 120;
	}

	function insertCompositionLineBreakBefore(
		textarea: HTMLTextAreaElement,
		index: number,
	): number {
		if (index > 0 && textarea.value[index - 1] === "\n") return index;
		textarea.value =
			textarea.value.slice(0, index) + "\n" + textarea.value.slice(index);
		const start = textarea.selectionStart ?? textarea.value.length;
		const end = textarea.selectionEnd ?? start;
		const nextStart = start > index ? start + 1 : start;
		const nextEnd = end > index ? end + 1 : end;
		setComposerSelection(textarea, nextStart, nextEnd);
		fitTextarea(textarea);
		if (textarea === followInput) {
			clipFollowInputValue();
			if (!compositionMutating) syncFollowComposerMode();
		}
		return index + 1;
	}

	function measureCompositionCaretPoint(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
		index: number,
	): { left: number; top: number } | null {
		const value = textarea.value;
		if (index < 0 || index > value.length) return null;
		applyMirrorTypography(textarea, mirror);
		mirror.replaceChildren();
		const probe = document.createElement("span");
		probe.className = "ai-composition-index-probe";
		probe.textContent = "\u200b";
		let probePlaced = false;
		const markerIndices = compositionMarkerIndices(value);
		let pos = 0;
		for (let i = 0; i < markerIndices.length; i++) {
			const markerIndex = markerIndices[i];
			const textBeforeMarker = value.slice(pos, markerIndex);
			if (!probePlaced) {
				if (index <= markerIndex) {
					const relativeIndex = index - pos;
					mirror.append(
						document.createTextNode(textBeforeMarker.slice(0, relativeIndex)),
					);
					mirror.append(probe);
					probePlaced = true;
					mirror.append(
						document.createTextNode(textBeforeMarker.slice(relativeIndex)),
					);
				} else {
					mirror.append(document.createTextNode(textBeforeMarker));
				}
			} else {
				mirror.append(document.createTextNode(textBeforeMarker));
			}
			const anchor = document.createElement("span");
			anchor.className = "ai-composition-chip-anchor";
			anchor.dataset.chipIndex = String(i);
			mirror.append(anchor);
			const padLen = compositionMarkerPadLength(value, markerIndex);
			mirror.append(
				document.createTextNode(
					value.slice(
						markerIndex + COMPOSITION_CONTEXT_CHIP_MARKER.length,
						markerIndex + COMPOSITION_CONTEXT_CHIP_MARKER.length + padLen,
					),
				),
			);
			const endAnchor = document.createElement("span");
			endAnchor.className = "ai-composition-chip-end-anchor";
			endAnchor.dataset.chipEnd = String(i);
			mirror.append(endAnchor);
			pos = markerIndex + COMPOSITION_CONTEXT_CHIP_MARKER.length + padLen;
		}
		if (!probePlaced) {
			const tail = value.slice(pos);
			const relativeIndex = index - pos;
			mirror.append(document.createTextNode(tail.slice(0, relativeIndex)));
			mirror.append(probe);
			mirror.append(document.createTextNode(tail.slice(relativeIndex)));
			probePlaced = true;
		} else if (pos < value.length) {
			mirror.append(document.createTextNode(value.slice(pos)));
		}
		if (!probePlaced) return null;
		const rect = probe.getBoundingClientRect();
		return { left: rect.left, top: rect.top };
	}

	function compositionChipShouldBreakBefore(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
		chipIndex: number,
		chipWidths: readonly number[],
	): boolean {
		const markerIndices = compositionMarkerIndices(textarea.value);
		const markerIndex = markerIndices[chipIndex];
		if (markerIndex === undefined) return false;
		const lineStart = compositionLineStart(textarea.value, markerIndex);
		if (markerIndex <= lineStart) return false;
		buildCompositionMirror(textarea, mirror);
		const anchor = mirror.querySelector<HTMLElement>(
			`[data-chip-index="${chipIndex}"]`,
		);
		if (!anchor) return false;
		const chipWidth = chipWidths[chipIndex] || 0;
		const anchorRect = anchor.getBoundingClientRect();
		const maxRight = compositionTextareaContentRight(textarea);
		if (anchorRect.left + chipWidth > maxRight + 1) return true;
		const lineStartPoint = measureCompositionCaretPoint(
			textarea,
			mirror,
			lineStart,
		);
		if (lineStartPoint && anchorRect.top > lineStartPoint.top + 1) {
			return true;
		}
		return false;
	}

	function reflowCompositionChipLineWraps(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
		chipWidths: readonly number[],
	): boolean {
		for (let chipIndex = 0; chipIndex < chipWidths.length; chipIndex++) {
			const markerIndices = compositionMarkerIndices(textarea.value);
			const markerIndex = markerIndices[chipIndex];
			if (markerIndex === undefined) break;
			if (
				!compositionChipShouldBreakBefore(
					textarea,
					mirror,
					chipIndex,
					chipWidths,
				)
			) {
				continue;
			}
			insertCompositionLineBreakBefore(textarea, markerIndex);
			return true;
		}
		return false;
	}

	function reflowAllCompositionChipLineWraps(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
		chipWidths: readonly number[],
	): void {
		while (reflowCompositionChipLineWraps(textarea, mirror, chipWidths)) {
			/* keep wrapping until stable */
		}
	}

	function ensureCompositionIndexFitsChip(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
		at: number,
		chipWidth: number,
	): number {
		if (chipWidth <= 0) return at;
		const lineStart = compositionLineStart(textarea.value, at);
		if (at <= lineStart) return at;
		const caretPoint = measureCompositionCaretPoint(textarea, mirror, at);
		if (!caretPoint) return at;
		const lineStartPoint = measureCompositionCaretPoint(
			textarea,
			mirror,
			lineStart,
		);
		if (lineStartPoint && caretPoint.top > lineStartPoint.top + 1) {
			return insertCompositionLineBreakBefore(textarea, at);
		}
		if (
			caretPoint.left + chipWidth <=
			compositionTextareaContentRight(textarea) + 1
		) {
			return at;
		}
		return insertCompositionLineBreakBefore(textarea, at);
	}

	function stabilizeCompositionChipLayout(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
		chipWidths: readonly number[],
		allowPadShrink = false,
	): void {
		for (let pass = 0; pass < 8; pass++) {
			reflowAllCompositionChipLineWraps(textarea, mirror, chipWidths);
			for (let index = 0; index < chipWidths.length; index++) {
				fitCompositionChipPad(
					textarea,
					mirror,
					index,
					chipWidths[index],
					allowPadShrink,
				);
			}
			let needsAnotherPass = false;
			for (let index = 0; index < chipWidths.length; index++) {
				if (
					compositionChipShouldBreakBefore(
						textarea,
						mirror,
						index,
						chipWidths,
					)
				) {
					needsAnotherPass = true;
					break;
				}
			}
			if (!needsAnotherPass) break;
		}
	}

	function applyCompositionChipPad(
		textarea: HTMLTextAreaElement,
		markerIndex: number,
		padCount: number,
	): void {
		const afterMarker = textarea.value.slice(
			markerIndex + COMPOSITION_CONTEXT_CHIP_MARKER.length,
		);
		const existingPad = compositionMarkerPadLength(textarea.value, markerIndex);
		const rest = afterMarker.slice(existingPad);
		if (existingPad === padCount) return;
		const start = textarea.selectionStart ?? textarea.value.length;
		const end = textarea.selectionEnd ?? start;
		textarea.value =
			textarea.value.slice(0, markerIndex + 1) +
			COMPOSITION_CHIP_PAD_CHAR.repeat(padCount) +
			rest;
		const delta = padCount - existingPad;
		const nextStart = start > markerIndex ? start + delta : start;
		const nextEnd = end > markerIndex ? end + delta : end;
		setComposerSelection(textarea, nextStart, nextEnd);
	}

	function measureRenderedChipSlotWidth(
		mirror: HTMLDivElement,
		chipIndex: number,
	): number {
		const start = mirror.querySelector<HTMLElement>(
			`[data-chip-index="${chipIndex}"]`,
		);
		const end = mirror.querySelector<HTMLElement>(
			`[data-chip-end="${chipIndex}"]`,
		);
		if (!start || !end) return 0;
		return end.getBoundingClientRect().left - start.getBoundingClientRect().left;
	}

	function fitCompositionChipPad(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
		chipIndex: number,
		chipWidth: number,
		allowPadShrink = false,
	): number {
		const markerIndex = compositionMarkerIndices(textarea.value)[chipIndex];
		if (markerIndex === undefined) return 0;
		const existingPad = compositionMarkerPadLength(textarea.value, markerIndex);
		const charWidth = measureComposerCharWidth(textarea);
		let padCount = compositionChipPadCount(
			chipWidth,
			charWidth,
			allowPadShrink ? 0 : existingPad,
		);
		const maxPad = Math.max(240, padCount + 32);
		while (padCount <= maxPad) {
			applyCompositionChipPad(textarea, markerIndex, padCount);
			buildCompositionMirror(textarea, mirror);
			const rendered = measureRenderedChipSlotWidth(mirror, chipIndex);
			if (rendered >= chipWidth + 1) return padCount;
			padCount++;
		}
		return padCount;
	}

	function layoutCompositionChipPads(textarea: HTMLTextAreaElement): void {
		if (compositionContexts.length === 0) return;
		const host = ensureCompositionMirrorHost(textarea);
		const mirror = host.mirror;
		const layer = host.layer;
		buildCompositionMirror(textarea, mirror);
		layer.hidden = false;
		layer.replaceChildren();
		const chips: HTMLElement[] = [];
		const markerCount = compositionMarkerIndices(textarea.value).length;
		for (let index = 0; index < markerCount; index++) {
			const chip = document.createElement("span");
			chip.className = "ai-composition-inline-chip";
			const label = document.createElement("span");
			label.className = "ai-composition-context-label";
			label.textContent = formatContextChipLabel(
				compositionContexts[index] || "",
			);
			chip.append(label);
			layer.append(chip);
			chips.push(chip);
		}
		const chipWidths = chips.map(
			(chip) => chip.getBoundingClientRect().width || 120,
		);
		stabilizeCompositionChipLayout(textarea, mirror, chipWidths);
	}

	function positionCursorAfterCompositionChipIndex(
		textarea: HTMLTextAreaElement,
		chipIndex: number,
	): void {
		const markerIndex = compositionMarkerIndices(textarea.value)[chipIndex];
		if (markerIndex === undefined) return;
		const host = ensureCompositionMirrorHost(textarea);
		const chip = host.layer.querySelectorAll<HTMLElement>(
			".ai-composition-inline-chip",
		)[chipIndex];
		const chipWidth = chip?.getBoundingClientRect().width ?? 120;
		fitCompositionChipPad(textarea, host.mirror, chipIndex, chipWidth);
		const markerAfter = compositionMarkerIndices(textarea.value)[chipIndex];
		if (markerAfter === undefined) return;
		const cursor =
			markerAfter +
			COMPOSITION_CONTEXT_CHIP_MARKER.length +
			compositionMarkerPadLength(textarea.value, markerAfter);
		setComposerSelection(textarea, cursor, cursor);
		textarea.focus({ preventScroll: true });
		syncInlineContextChip(textarea);
	}

	function buildCompositionMirror(
		textarea: HTMLTextAreaElement,
		mirror: HTMLDivElement,
	): void {
		applyMirrorTypography(textarea, mirror);
		mirror.replaceChildren();
		const markerIndices = compositionMarkerIndices(textarea.value);
		let pos = 0;
		for (let index = 0; index < markerIndices.length; index++) {
			const markerIndex = markerIndices[index];
			mirror.append(
				document.createTextNode(textarea.value.slice(pos, markerIndex)),
			);
			const anchor = document.createElement("span");
			anchor.className = "ai-composition-chip-anchor";
			anchor.dataset.chipIndex = String(index);
			mirror.append(anchor);
			const padLen = compositionMarkerPadLength(textarea.value, markerIndex);
			mirror.append(
				document.createTextNode(
					textarea.value.slice(
						markerIndex + COMPOSITION_CONTEXT_CHIP_MARKER.length,
						markerIndex + COMPOSITION_CONTEXT_CHIP_MARKER.length + padLen,
					),
				),
			);
			const endAnchor = document.createElement("span");
			endAnchor.className = "ai-composition-chip-end-anchor";
			endAnchor.dataset.chipEnd = String(index);
			mirror.append(endAnchor);
			pos =
				markerIndex +
				COMPOSITION_CONTEXT_CHIP_MARKER.length +
				padLen;
		}
		mirror.append(document.createTextNode(textarea.value.slice(pos)));
	}

	function ensureCompositionMirrorHost(
		textarea: HTMLTextAreaElement,
	): {
		mirror: HTMLDivElement;
		mirrorHost: HTMLDivElement;
		layer: HTMLDivElement;
	} {
		const existing = compositionMirrorHosts.get(textarea);
		if (existing) return existing;
		const wrap = document.createElement("div");
		wrap.className = "ai-composer-text-wrap";
		textarea.parentNode?.insertBefore(wrap, textarea);
		const mirrorHost = document.createElement("div");
		mirrorHost.className = "ai-composer-mirror-host";
		mirrorHost.setAttribute("aria-hidden", "true");
		const mirror = document.createElement("div");
		mirror.className = "ai-composer-mirror";
		mirrorHost.append(mirror);
		const layer = document.createElement("div");
		layer.className = "ai-composition-inline-layer";
		layer.hidden = true;
		wrap.append(mirrorHost, textarea, layer);
		const host = { mirror, mirrorHost, layer };
		compositionMirrorHosts.set(textarea, host);
		layer.addEventListener(
			"pointerdown",
			(event) => {
				const target = event.target;
				if (!(target instanceof Element)) return;
				if (!target.closest(".ai-composition-clear")) return;
				const chip = target.closest(".ai-composition-inline-chip");
				if (!chip) return;
				event.preventDefault();
				event.stopPropagation();
				const chips = [
					...layer.querySelectorAll<HTMLElement>(".ai-composition-inline-chip"),
				];
				const index = chips.indexOf(chip as HTMLElement);
				if (index >= 0) removeCompositionContextAt(textarea, index);
			},
			true,
		);
		const allowCompositionDrop = (event: Event): void => {
			if (!compositionDropEnabled()) return;
			event.preventDefault();
			if (
				event instanceof DragEvent &&
				event.type === "dragover" &&
				event.dataTransfer
			) {
				event.dataTransfer.dropEffect = "copy";
			}
			if (event instanceof DragEvent && event.type === "drop") {
				handleCompositionDrop(event);
			}
		};
		wrap.addEventListener("dragenter", allowCompositionDrop);
		wrap.addEventListener("dragover", allowCompositionDrop);
		wrap.addEventListener("drop", allowCompositionDrop);
		textarea.addEventListener("scroll", () => {
			repositionInlineContextChips(textarea);
		});
		textarea.addEventListener("input", () => {
			if (compositionMutating) return;
			const markerCount = compositionMarkerIndices(textarea.value).length;
			if (compositionContexts.length > 0 && markerCount === 0) {
				clearCompositionContext();
				return;
			}
			if (compositionContexts.length > markerCount) {
				compositionContexts = compositionContexts.slice(0, markerCount);
			}
			syncInlineContextChip(textarea);
			persistResearchCompositionDraft();
		});
		textarea.addEventListener("keydown", (event) => {
			if (event instanceof KeyboardEvent) {
				handleCompositionMarkerKeydown(event, textarea);
			}
		});
		textarea.addEventListener("beforeinput", (event) => {
			if (compositionMutating) return;
			if (!(event instanceof InputEvent)) return;
			const deleteTypes = new Set([
				"deleteContentBackward",
				"deleteContentForward",
				"deleteByCut",
				"deleteContent",
			]);
			if (!deleteTypes.has(event.inputType)) return;
			if (handleCompositionDelete(textarea, event.inputType)) {
				event.preventDefault();
			}
		});
		textarea.addEventListener("mouseup", () => {
			guardCompositionSelection(textarea);
		});
		textarea.addEventListener("keyup", () => {
			guardCompositionSelection(textarea);
		});
		document.addEventListener("selectionchange", () => {
			if (document.activeElement === textarea) {
				guardCompositionSelection(textarea);
			}
		});
		return host;
	}

	function compositionLayoutWidthChanged(textarea: HTMLTextAreaElement): boolean {
		const width = textarea.clientWidth;
		if (width < 1) return false;
		const previous = compositionLayoutWidthByTextarea.get(textarea);
		compositionLayoutWidthByTextarea.set(textarea, width);
		if (previous === undefined) return false;
		return Math.abs(width - previous) > 6;
	}

	function resetCompositionChipPads(textarea: HTMLTextAreaElement): void {
		compositionMutating = true;
		try {
			for (const markerIndex of compositionMarkerIndices(textarea.value)) {
				applyCompositionChipPad(textarea, markerIndex, 1);
			}
		} finally {
			compositionMutating = false;
		}
	}

	function scheduleCompositionChipSyncAfterDockPin(): void {
		if (followDockCompact()) {
			releaseFollowComposerScrollAnchor();
			return;
		}
		const textarea = compositionContextTextarea;
		if (!textarea || compositionContexts.length === 0) {
			releaseFollowComposerScrollAnchor();
			return;
		}
		const width = textarea.clientWidth;
		const previous = compositionLayoutWidthByTextarea.get(textarea);
		const widthChanged =
			width >= 1 &&
			previous !== undefined &&
			Math.abs(width - previous) > 6;
		const relayout = pendingCompositionChipRelayout || widthChanged;
		if (!relayout && width >= 1) {
			repositionInlineContextChips(textarea);
			releaseFollowComposerScrollAnchor();
			return;
		}
		window.clearTimeout(compositionChipSyncAfterPinTimer);
		const delay =
			window.innerWidth <= MOBILE_REPORT_DOCK_BREAKPOINT_PX ? 120 : 16;
		compositionChipSyncAfterPinTimer = window.setTimeout(() => {
			compositionChipSyncAfterPinTimer = 0;
			preserveFollowComposerScroll(() => {
				const needsRelayout =
					pendingCompositionChipRelayout ||
					compositionLayoutWidthChanged(textarea);
				pendingCompositionChipRelayout = false;
				if (needsRelayout) resetCompositionChipPads(textarea);
				if (textarea.clientWidth < 1) {
					scheduleSyncInlineContextChipAfterLayout(textarea);
					return;
				}
				syncInlineContextChip(textarea, { allowPadShrink: needsRelayout });
			});
			releaseFollowComposerScrollAnchor();
		}, delay);
	}

	function repositionInlineContextChips(textarea: HTMLTextAreaElement): void {
		const host = compositionMirrorHosts.get(textarea);
		if (!host || host.layer.hidden) return;
		const chips = host.layer.querySelectorAll<HTMLElement>(
			".ai-composition-inline-chip",
		);
		if (chips.length === 0) return;
		host.mirrorHost.scrollTop = textarea.scrollTop;
		const textareaRect = textarea.getBoundingClientRect();
		for (let index = 0; index < chips.length; index++) {
			const anchor = host.mirror.querySelector<HTMLElement>(
				`[data-chip-index="${index}"]`,
			);
			if (!anchor) continue;
			const anchorRect = anchor.getBoundingClientRect();
			chips[index].style.transform = `translate(${anchorRect.left - textareaRect.left}px, ${anchorRect.top - textareaRect.top}px)`;
		}
	}

	function scheduleSyncInlineContextChip(
		textarea?: HTMLTextAreaElement | null,
	): void {
		pendingInlineContextChipTarget = textarea ?? null;
		if (inlineContextChipSyncRaf) return;
		inlineContextChipSyncRaf = requestAnimationFrame(() => {
			inlineContextChipSyncRaf = 0;
			const target = pendingInlineContextChipTarget;
			pendingInlineContextChipTarget = undefined;
			syncInlineContextChip(target);
		});
	}

	function scheduleSyncInlineContextChipAfterLayout(
		textarea?: HTMLTextAreaElement | null,
	): void {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				syncInlineContextChip(textarea);
			});
		});
	}

	function syncInlineContextChip(
		textarea?: HTMLTextAreaElement | null,
		options?: { allowPadShrink?: boolean },
	): void {
		const targets = textarea
			? [textarea]
			: [input, followInput].filter(
					(el): el is HTMLTextAreaElement => el instanceof HTMLTextAreaElement,
				);
		for (const target of targets) {
			preserveFollowComposerScroll(() => {
				compositionMutating = true;
				try {
					const host = ensureCompositionMirrorHost(target);
					const layer = host.layer;
					const hasContext =
						compositionContexts.length > 0 &&
						compositionContextTextarea === target &&
						compositionContextPasteEnabled(target);
					if (!hasContext) {
						layer.hidden = true;
						layer.replaceChildren();
						return;
					}
					if (target.clientWidth < 1) {
						scheduleSyncInlineContextChipAfterLayout(target);
						return;
					}
					const markerIndices = compositionMarkerIndices(target.value);
					if (markerIndices.length === 0) {
						layer.hidden = true;
						layer.replaceChildren();
						return;
					}
					const mirror = host.mirror;
					buildCompositionMirror(target, mirror);
					host.mirrorHost.scrollTop = target.scrollTop;
					layer.hidden = false;
					layer.replaceChildren();
					const chips: HTMLElement[] = [];
					for (let index = 0; index < markerIndices.length; index++) {
						const chip = document.createElement("span");
						chip.className = "ai-composition-inline-chip";
						const label = document.createElement("span");
						label.className = "ai-composition-context-label";
						label.textContent = formatContextChipLabel(
							compositionContexts[index] || "",
						);
						const remove = document.createElement("button");
						remove.type = "button";
						remove.className = "ai-composition-clear";
						remove.setAttribute("aria-label", "Remove attached notes");
						remove.title = "Remove attached notes";
						remove.textContent = "×";
						chip.append(label, remove);
						layer.append(chip);
						chips.push(chip);
					}
					const chipWidths = chips.map(
						(chip) => chip.getBoundingClientRect().width || 120,
					);
					stabilizeCompositionChipLayout(
						target,
						mirror,
						chipWidths,
						options?.allowPadShrink,
					);
					buildCompositionMirror(target, mirror);
					host.mirrorHost.scrollTop = target.scrollTop;
					repositionInlineContextChips(target);
				} finally {
					compositionMutating = false;
				}
			});
		}
	}

	function syncCompositionImageAttachButtons(): void {
		const enabled = compositionImagesEnabled();
		const hasImages = compositionImages.length > 0;
		const dockCompact = followDockCompact();
		for (const button of compositionImageAttachButtons) {
			button.hidden = !enabled || (dockCompact && !hasImages);
		}
	}

	function syncCompositionImageInput(): void {
		if (!compositionImageInput) return;
		const remaining = Math.max(
			0,
			MAX_RESEARCH_CONTEXT_IMAGES -
				compositionImages.length -
				compositionImagesLoading,
		);
		if (remaining <= 1) {
			compositionImageInput.removeAttribute("multiple");
		} else {
			compositionImageInput.multiple = true;
		}
	}

	function syncCompositionTray(options?: { persistDraft?: boolean }): void {
		const enabled = compositionImagesEnabled();
		const hasImages = compositionImages.length > 0;
		for (const el of compositionAttachments) {
			el.hidden = !(enabled && hasImages);
		}
		for (const el of compositionContextEls) {
			el.hidden = true;
		}
		for (const el of compositionContextLabels) {
			el.textContent = "";
		}
		const atImageCap = compositionImages.length >= MAX_RESEARCH_CONTEXT_IMAGES;
		for (const cap of compositionImageCaps) {
			cap.hidden = !(enabled && atImageCap);
			cap.textContent = RESEARCH_COMPOSITION_MAX_IMAGES_MSG;
		}
		syncCompositionImageAttachButtons();
		syncCompositionImageInput();
		for (const list of compositionImageLists) {
			list.hidden = !hasImages;
			list.replaceChildren();
			if (!hasImages) continue;
			compositionImages.forEach((image, index) => {
				const wrap = document.createElement("span");
				wrap.className = "ai-composition-image";
				const img = document.createElement("img");
				img.src = researchContextImageDataUrl(image);
				img.alt = `Attached image ${index + 1}`;
				img.addEventListener("click", () => {
					openResearchImageOverlay(image, {
						filename: researchContextImageFilename(image, index),
						alt: `Attached image ${index + 1}`,
					});
				});
				const remove = document.createElement("button");
				remove.type = "button";
				remove.className = "ai-composition-clear";
				remove.setAttribute("aria-label", "Remove image");
				remove.title = "Remove image";
				remove.textContent = "×";
				remove.addEventListener("click", () => {
					compositionImages = compositionImages.filter((_, i) => i !== index);
					syncCompositionTray();
				});
				wrap.append(img, remove);
				list.append(wrap);
			});
		}
		if (options?.persistDraft !== false) {
			persistResearchCompositionDraft();
		}
	}

	function activeComposerTextarea(): HTMLTextAreaElement | null {
		const active = document.activeElement;
		if (active === input || active === followInput) return active;
		if (followForm && !followForm.hidden && followInput) return followInput;
		return input;
	}

	function shouldAttachPasteAsContext(
		text: string,
		textarea: HTMLTextAreaElement,
	): boolean {
		if (!compositionContextPasteEnabled(textarea)) return false;
		const start = textarea.selectionStart ?? textarea.value.length;
		const end = textarea.selectionEnd ?? start;
		return shouldAttachPasteAsCompositionContext(text, {
			composerTextLength: textarea.value.length,
			selectionLength: Math.max(0, end - start),
			maxQuestionChars: questionCharLimitForTextarea(textarea),
		});
	}

	function insertCompositionContextMarker(
		textarea: HTMLTextAreaElement,
		at: number,
	): void {
		const before = textarea.value.slice(0, at);
		const after = textarea.value.slice(at);
		textarea.value = before + COMPOSITION_CONTEXT_CHIP_MARKER + after;
		const cursor = at + COMPOSITION_CONTEXT_CHIP_MARKER.length;
		setComposerSelection(textarea, cursor, cursor);
		fitTextarea(textarea);
		if (textarea === followInput) {
			clipFollowInputValue();
			if (!compositionMutating) syncFollowComposerMode();
		}
	}

	function clipboardImageFiles(event: ClipboardEvent): File[] {
		const files: File[] = [];
		const dt = event.clipboardData;
		if (!dt) return files;
		if (dt.files?.length) {
			for (const file of dt.files) {
				if (isCompositionImageFile(file)) files.push(file);
			}
		}
		if (files.length === 0) {
			for (const item of dt.items || []) {
				if (!item.type.startsWith("image/")) continue;
				const file = item.getAsFile();
				if (file && isCompositionImageFile(file)) files.push(file);
			}
		}
		return files;
	}

	function normalizeCompositionImageFile(file: File): File {
		if (file.type.startsWith("image/")) return file;
		const mime = guessImageMimeFromName(file.name);
		if (!mime) return file;
		return new File([file], file.name || "image", { type: mime });
	}

	async function loadCompositionImageBitmap(
		file: File,
	): Promise<ImageBitmap | null> {
		try {
			return await createImageBitmap(file);
		} catch {
			const url = URL.createObjectURL(file);
			try {
				const image = new Image();
				await new Promise<void>((resolve, reject) => {
					image.onload = () => resolve();
					image.onerror = () => reject(new Error("image load failed"));
					image.src = url;
				});
				return await createImageBitmap(image);
			} catch {
				return null;
			} finally {
				URL.revokeObjectURL(url);
			}
		}
	}

	async function resizeCompositionImage(
		file: File,
	): Promise<ResearchContextImage | null> {
		const bitmap = await loadCompositionImageBitmap(file);
		if (!bitmap) return null;
		const outputMimes =
			file.type === "image/gif"
				? ["image/gif", "image/webp", "image/jpeg"]
				: file.type === "image/webp"
					? ["image/webp", "image/jpeg"]
					: file.type === "image/png"
						? ["image/png", "image/jpeg", "image/webp"]
						: ["image/jpeg", "image/webp", "image/png"];
		try {
			let maxDim = 1568;
			for (let dimAttempt = 0; dimAttempt < 5; dimAttempt++) {
				let width = bitmap.width;
				let height = bitmap.height;
				if (width > maxDim || height > maxDim) {
					if (width >= height) {
						height = Math.round((height * maxDim) / width);
						width = maxDim;
					} else {
						width = Math.round((width * maxDim) / height);
						height = maxDim;
					}
				}
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (!ctx) return null;
				ctx.drawImage(bitmap, 0, 0, width, height);
				for (const mime of outputMimes) {
					const qualities =
						mime === "image/jpeg" || mime === "image/webp"
							? [0.88, 0.72, 0.58, 0.44, 0.3]
							: [undefined];
					for (const quality of qualities) {
						const blob = await new Promise<Blob | null>((resolve) => {
							canvas.toBlob(resolve, mime, quality);
						});
						if (
							!blob ||
							blob.size > MAX_RESEARCH_CONTEXT_IMAGE_BYTES
						) {
							continue;
						}
						const bytes = new Uint8Array(await blob.arrayBuffer());
						let binary = "";
						for (let i = 0; i < bytes.length; i++) {
							binary += String.fromCharCode(bytes[i]);
						}
						return { mime, data: btoa(binary) };
					}
				}
				maxDim = Math.round(maxDim * 0.72);
			}
			return null;
		} finally {
			bitmap.close();
		}
	}

	type CompositionImageAttachResult =
		| "added"
		| "unsupported"
		| "cap"
		| "too_large"
		| "total_full";

	async function attachCompositionImage(
		file: File,
	): Promise<CompositionImageAttachResult> {
		if (!compositionImagesEnabled() && !compositionDropEnabled()) return "cap";
		if (!isCompositionImageFile(file)) {
			setStatus(RESEARCH_COMPOSITION_UNSUPPORTED_IMAGE_MSG);
			return "unsupported";
		}
		if (!reserveCompositionImageSlot()) {
			return "cap";
		}
		try {
			const image = await resizeCompositionImage(
				normalizeCompositionImageFile(file),
			);
			if (!image) {
				setStatus(RESEARCH_COMPOSITION_IMAGE_TOO_LARGE_MSG);
				return "too_large";
			}
			const bytes = researchContextImageByteLength(image);
			if (wouldExceedCompositionImageTotalBytes(compositionImages, bytes)) {
				setStatus(RESEARCH_COMPOSITION_IMAGES_TOTAL_FULL_MSG);
				return "total_full";
			}
			if (compositionImages.length < MAX_RESEARCH_CONTEXT_IMAGES) {
				compositionImages = [...compositionImages, image];
				return "added";
			}
			return "cap";
		} finally {
			releaseCompositionImageSlot();
		}
	}

	async function handleCompositionImageFiles(
		files: readonly File[],
	): Promise<void> {
		if (!compositionImagesEnabled() && !compositionDropEnabled()) return;
		if (files.length === 0) return;
		try {
			for (const file of files) {
				if (
					compositionImages.length >= MAX_RESEARCH_CONTEXT_IMAGES &&
					compositionImagesLoading === 0
				) {
					break;
				}
				const result = await attachCompositionImage(file);
				if (result === "added") continue;
				if (result === "cap") break;
			}
		} finally {
			syncCompositionTray();
			if (root.classList.contains("is-report-dock")) {
				pendingCompositionChipRelayout = true;
				scheduleFollowDockFrost();
			} else if (compositionContextTextarea) {
				scheduleSyncInlineContextChipAfterLayout(compositionContextTextarea);
			}
		}
	}

	function handleCompositionPaste(event: ClipboardEvent): void {
		const imageFiles = clipboardImageFiles(event);
		if (imageFiles.length > 0) {
			if (!compositionImagesEnabled()) return;
			event.preventDefault();
			void handleCompositionImageFiles(imageFiles);
			return;
		}

		const text = event.clipboardData?.getData("text/plain") || "";
		if (!text) return;

		const textarea = activeComposerTextarea();
		if (!textarea || !shouldAttachPasteAsContext(text, textarea)) return;

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		const clipped = clipResearchContext(
			text,
			askContextPasteEnabled(textarea)
				? MAX_ASK_CONTEXT_CHARS
				: undefined,
		);
		if (!clipped.trim()) {
			setStatus(RESEARCH_COMPOSITION_CONTEXT_TOO_LARGE_MSG);
			return;
		}
		const contextTrimmed = contextWasClipped(text, clipped);
		armFollowComposerScrollAnchor();
		beginFollowComposerScrollLock();
		compositionMutating = true;
		try {
			if (compositionContextTextarea && compositionContextTextarea !== textarea) {
				removeAllCompositionContextMarkers(compositionContextTextarea);
				compositionContexts = [];
			}
			if (
				compositionContextTextarea === textarea &&
				compositionContexts.length > 0
			) {
				layoutCompositionChipPads(textarea);
			}
			const start = textarea.selectionStart ?? textarea.value.length;
			let { insertIndex, at } = compositionContextInsertPosition(
				textarea.value,
				start,
			);
			const host = ensureCompositionMirrorHost(textarea);
			const nextLabel = formatContextChipLabel(clipped);
			const nextChipWidth = measureCompositionChipLabelWidth(nextLabel);
			at = ensureCompositionIndexFitsChip(
				textarea,
				host.mirror,
				at,
				nextChipWidth,
			);
			insertIndex = compositionMarkerIndices(textarea.value).filter(
				(index) => index < at,
			).length;
			compositionContextTextarea = textarea;
			compositionContexts = insertCompositionContextClip(
				compositionContexts,
				clipped,
				insertIndex,
			);
			insertCompositionContextMarker(textarea, at);
			syncCompositionTray();
			positionCursorAfterCompositionChipIndex(textarea, insertIndex);
			if (contextTrimmed) {
				setStatus(RESEARCH_COMPOSITION_CONTEXT_TRIM_MSG);
			}
			if (compositionContextPasteEnabled(textarea)) {
				pendingCompositionChipRelayout = true;
				syncInlineContextChip(textarea);
				if (root.classList.contains("is-report-dock")) {
					scheduleFollowDockFrost();
				} else {
					scheduleSyncInlineContextChipAfterLayout(textarea);
				}
			}
		} finally {
			compositionMutating = false;
			endFollowComposerScrollLock();
		}
	}

	function handleCompositionDrop(event: DragEvent): void {
		if (!compositionDropEnabled()) return;
		const dt = event.dataTransfer;
		if (!dt) return;
		const images = compositionDroppedImageFiles(dt);
		if (images.length === 0) return;
		event.preventDefault();
		event.stopPropagation();
		void handleCompositionImageFiles(images);
	}

	function syncFollowInputMaxLength(): void {
		if (!followInput) return;
		followInput.maxLength = questionCharLimitForTextarea(followInput);
	}

	function clipFollowInputValue(): void {
		if (!followInput || !reviseFollowActive()) return;
		const normalized = normalizeResearchReviseInstructionInput(followInput.value);
		if (normalized !== followInput.value) followInput.value = normalized;
	}

	function currentReviseReportMarkdown(): string {
		const last = lastFinishedReportTurn();
		if (!last) return "";
		return displayedReportMarkdown(last).trim();
	}

	function reviseDraftFromComposer(): ResearchReviseEditDraft {
		const liveInstruction = followInput?.value ?? "";
		const draft: ResearchReviseEditDraft = {
			...reviseEditDraft,
			// Compact mode clears the textarea for the placeholder shell; fall
			// back to the stored draft instruction in that case.
			draftInstruction:
				liveInstruction || reviseEditDraft.draftInstruction || "",
		};
		if (!reviseStackEl || draft.committed.length === 0) return draft;
		const instructions = [
			...reviseStackEl.querySelectorAll<HTMLTextAreaElement>(
				".ai-revise-row-instruction",
			),
		];
		if (instructions.length !== draft.committed.length) return draft;
		return {
			...draft,
			committed: draft.committed.map((row, index) => ({
				...row,
				instruction: instructions[index]?.value ?? row.instruction,
			})),
		};
	}

	let reviseStackRenderCache = "";
	let reviseComposerRestored = false;
	let reviseComposerHydrated = false;
	let reviseCapNoteTimer = 0;

	function finishReviseComposerHydration(): void {
		reviseComposerHydrated = true;
	}

	function reviseMultiHintSeen(): boolean {
		try {
			return localStorage.getItem(REVISE_MULTI_HINT_STORAGE_KEY) === "1";
		} catch {
			return false;
		}
	}

	function markReviseMultiHintSeen(): void {
		try {
			localStorage.setItem(REVISE_MULTI_HINT_STORAGE_KEY, "1");
		} catch {
			/* ignore */
		}
	}

	function shouldShowReviseMultiHint(draft: ResearchReviseEditDraft): boolean {
		return draft.committed.length >= 1 && !reviseMultiHintSeen();
	}

	function scrollReviseComposerToLatest(): void {
		requestAnimationFrame(() => {
			const body = followForm?.querySelector<HTMLElement>(".ai-composer-body");
			if (body) {
				body.scrollTop = body.scrollHeight;
			} else if (reviseStackEl && !reviseStackEl.hidden) {
				reviseStackEl.scrollTop = reviseStackEl.scrollHeight;
			}
			followInput?.scrollIntoView({ block: "nearest" });
		});
	}

	function renderReviseStack(force = false): void {
		if (!reviseStackEl) return;
		const key = `${reviseEditDraft.committed.length}:${reviseStackRenderKey(reviseEditDraft)}`;
		const rowCount = reviseEditDraft.committed.length;
		if (rowCount === 0) {
			reviseStackRenderCache = key;
			reviseStackEl.replaceChildren();
			reviseStackEl.hidden = true;
			return;
		}
		if (
			!force &&
			key === reviseStackRenderCache &&
			reviseStackEl.childElementCount > 0 &&
			reviseStackEl.childElementCount === rowCount
		) {
			reviseStackEl.hidden = false;
			return;
		}
		reviseStackRenderCache = key;
		reviseStackEl.replaceChildren();
		reviseStackEl.hidden = false;
		reviseEditDraft.committed.forEach((row, index) => {
			const rowEl = document.createElement("div");
			rowEl.className = "ai-revise-row is-committed";

			const head = document.createElement("div");
			head.className = "ai-revise-row-head";
			const scopeLabel = formatReviseEditScopeLabel(row.scope);
			if (hasReviseEditScope(row.scope)) {
				const scopeEl = document.createElement("div");
				scopeEl.className = "ai-revise-scope";
				const chip = document.createElement("span");
				chip.className = "ai-revise-chip";
				const text = document.createElement("span");
				text.className = "ai-revise-chip-text";
				text.textContent = scopeLabel;
				text.title = row.scope?.heading || row.scope?.quote || scopeLabel;
				chip.append(text);
				scopeEl.append(chip);
				head.append(scopeEl);
			}
			const removeRow = document.createElement("button");
			removeRow.type = "button";
			removeRow.className = "ai-revise-row-remove";
			removeRow.setAttribute("aria-label", RESEARCH_REVISE_REMOVE_EDIT);
			removeRow.title = RESEARCH_REVISE_REMOVE_EDIT;
			removeRow.textContent = "×";
			removeRow.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				followComposerPinnedOpen = true;
				reviseEditDraft = removeCommittedReviseRow(reviseEditDraft, index);
				syncReviseScope();
				followInput?.focus();
			});
			head.append(removeRow);
			rowEl.append(head);

			const instruction = document.createElement("textarea");
			instruction.className = "ai-revise-row-instruction";
			instruction.rows = 1;
			instruction.maxLength = RESEARCH_REVISE_INSTRUCTION_MAX;
			instruction.value = row.instruction;
			instruction.setAttribute(
				"aria-label",
				RESEARCH_REVISE_SELECTION_PLACEHOLDER,
			);
			instruction.addEventListener("input", () => {
				reviseEditDraft = updateCommittedReviseInstruction(
					reviseEditDraft,
					index,
					instruction.value,
				);
				fitTextarea(instruction);
				syncFollowComposerMode();
			});
			rowEl.append(instruction);
			reviseStackEl.append(rowEl);
			fitTextarea(instruction);
		});
	}

	function syncReviseCapNote(show = isReviseEditsCapped(reviseDraftFromComposer())): void {
		if (!reviseCapNoteEl) return;
		reviseCapNoteEl.hidden = !show;
	}

	function flashReviseCapNote(ms = 5000): void {
		syncReviseCapNote(true);
		if (reviseCapNoteTimer) window.clearTimeout(reviseCapNoteTimer);
		reviseCapNoteTimer = window.setTimeout(() => {
			reviseCapNoteTimer = 0;
			syncReviseCapNote(isReviseEditsCapped(reviseDraftFromComposer()));
		}, ms);
	}

	function syncReviseScope(options: { scrollToLatest?: boolean } = {}): void {
		reviseEditDraft = reviseDraftFromComposer();
		renderReviseStack();
		const showDraftScope = hasReviseEditScope(reviseEditDraft.draftScope);
		const draftLabel = showDraftScope
			? formatReviseEditScopeLabel(reviseEditDraft.draftScope)
			: "";
		if (reviseChipEl) {
			reviseChipEl.textContent = draftLabel;
			reviseChipEl.title =
				reviseEditDraft.draftScope?.heading ||
				reviseEditDraft.draftScope?.quote ||
				draftLabel;
		}
		if (reviseScope) {
			reviseScope.hidden = !showDraftScope;
			reviseScope.classList.toggle("is-draft", showDraftScope);
		}
		if (reviseClearBtn) {
			reviseClearBtn.setAttribute("aria-label", RESEARCH_REVISE_CLEAR);
			reviseClearBtn.title = RESEARCH_REVISE_CLEAR;
		}
		if (reviseCapNoteEl) {
			if (!reviseCapNoteTimer) {
				syncReviseCapNote(isReviseEditsCapped(reviseDraftFromComposer()));
			}
		}
		if (askWithoutEditingBtn) {
			const onReport = Boolean(lastFinishedReportTurn());
			askWithoutEditingBtn.hidden = !onReport;
			askWithoutEditingBtn.textContent = RESEARCH_NEW_REPORT_ACTION;
		}
		syncFollowComposerMode();
		if (options.scrollToLatest) scrollReviseComposerToLatest();
		persistReviseComposerDraft();
	}

	function clearReviseScope(keepPrompt = true): void {
		const committedBefore = reviseEditDraft.committed.length;
		reviseEditDraft = clearReviseDraftScope(reviseDraftFromComposer());
		if (reviseEditDraft.committed.length !== committedBefore) {
			reviseStackRenderCache = "";
			renderReviseStack(true);
		}
		if (followInput) {
			followInput.value = keepPrompt ? reviseEditDraft.draftInstruction : "";
			if (!keepPrompt) {
				reviseEditDraft = { ...reviseEditDraft, draftInstruction: "" };
			}
			fitTextarea(followInput);
		}
		headingReviseBtn?.remove();
		headingReviseBtn = null;
		hideSelectionRevise();
		try {
			window.getSelection()?.removeAllRanges();
		} catch {
			/* ignore */
		}
		syncReviseScope();
		if (followInput && !followInput.disabled) followInput.focus();
	}

	function resetReviseEdits(clearPrompt = false): void {
		reviseEditDraft = emptyReviseEditDraft();
		reviseStackRenderCache = "";
		clearReviseComposerDraftStorage();
		headingReviseBtn?.remove();
		headingReviseBtn = null;
		hideSelectionRevise();
		if (clearPrompt && followInput) {
			followInput.value = "";
			fitTextarea(followInput);
		}
		syncReviseScope();
	}

	function applyRevisePin(scope: ResearchReviseEditScope | null): void {
		if (!scope) return;
		const committedBefore = reviseEditDraft.committed.length;
		const result = applyReviseSelectionToDraft(reviseDraftFromComposer(), scope);
		reviseEditDraft = result.draft;
		if (result.capped) {
			setStatus(RESEARCH_REVISE_EDITS_CAP);
			flashReviseCapNote();
		} else if (
			isReviseEditsCapped(reviseEditDraft) &&
			reviseEditDraft.committed.length > committedBefore
		) {
			flashReviseCapNote();
		}
		if (followInput) {
			followInput.value = reviseEditDraft.draftInstruction;
			fitTextarea(followInput);
		}
		syncReviseScope({
			scrollToLatest: reviseEditDraft.committed.length > committedBefore,
		});
	}

	function lastReportAnswerBody(): HTMLElement | null {
		return lastReportElement()?.querySelector<HTMLElement>(".ai-answer-body") ?? null;
	}

	function rangeIntersectsNode(range: Range, node: Node): boolean {
		const nodeRange = document.createRange();
		try {
			nodeRange.selectNodeContents(node);
		} catch {
			return false;
		}
		return (
			range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
			range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
		);
	}

	function refineReviseSelectionBlockIds(
		ids: readonly string[],
		_selection: string,
		markdown: string,
	): string[] {
		if (ids.length === 0) return [];
		const sel = _selection.replace(/\s+/g, " ").trim().toLowerCase();
		let out = [...ids];
		if (sel) {
			const blocks = splitReportBlocks(markdown);
			out = out.filter((id) => {
				if (!/^h\d+$/i.test(id)) return true;
				const block = blocks.find((item) => item.id === id);
				if (!block) return false;
				const heading = block.markdown.replace(/^#+\s+/, "").trim().toLowerCase();
				if (!heading) return false;
				const snippet = heading.slice(0, 24);
				return sel.includes(snippet) || snippet.includes(sel.slice(0, 24));
			});
		}
		return [...new Set(out)];
	}

	function stampReviseReportBlockIds(turn: AiAskTurn | undefined): void {
		if (!turn) return;
		const body = lastReportElement()?.querySelector<HTMLElement>(".ai-answer-body");
		const markdown = displayedReportMarkdown(turn).trim();
		if (body && markdown) stampReportBlockKeys(body, markdown);
	}

	function reportBlockIdsFromDomRange(range: Range, body: Element): string[] {
		const markdown = currentReviseReportMarkdown();
		const blocks = splitReportBlocks(markdown);
		const selection = window.getSelection()?.toString() || "";
		const ids: string[] = [];
		const seen = new Set<string>();
		for (const el of body.querySelectorAll<HTMLElement>(
			REPORT_CHANGE_BLOCK_SELECTOR,
		)) {
			if (!rangeIntersectsNode(range, el)) continue;
			const stampedId = el.dataset.reportBlockId?.trim() || "";
			const idx = Number(el.dataset.reportBlockIdx);
			const id =
				stampedId ||
				(Number.isFinite(idx) ? blocks[idx]?.id : "") ||
				"";
			if (id && !seen.has(id)) {
				seen.add(id);
				ids.push(id);
			}
		}
		if (ids.length > 0) {
			return refineReviseSelectionBlockIds(
				ids.sort(
					(a, b) =>
						blocks.findIndex((block) => block.id === a) -
						blocks.findIndex((block) => block.id === b),
				),
				selection,
				markdown,
			);
		}
		const structuralSelected = [
			...body.querySelectorAll<HTMLElement>(
				".ai-report-table-wrap, .ai-report-diagram, .ai-report-mermaid, .ai-report-code",
			),
		].some((el) => rangeIntersectsNode(range, el));
		if (structuralSelected) return [];
		const paraNums: number[] = [];
		for (const el of body.querySelectorAll<HTMLElement>(
			"[data-paragraph-number]",
		)) {
			if (!rangeIntersectsNode(range, el)) continue;
			const n = Number(el.getAttribute("data-paragraph-number"));
			if (Number.isFinite(n) && n > 0) paraNums.push(n);
		}
		return [...new Set(paraNums.sort((a, b) => a - b))].map((n) => `p${n}`);
	}

	function scopeFromLiveSelection(): ResearchReviseEditScope | null {
		const sel = window.getSelection();
		const selection = sel?.toString() || "";
		if (!selectionQualifiesForRevise(selection) || !sel?.rangeCount) {
			return null;
		}
		const range = sel.getRangeAt(0);
		const body = lastReportAnswerBody();
		const blockIds =
			body && body.contains(range.commonAncestorContainer)
				? reportBlockIdsFromDomRange(range, body)
				: [];
		return scopeFromDomSelection(
			currentReviseReportMarkdown(),
			selection,
			sel.anchorNode,
			blockIds,
		);
	}

	function openReviseComposer(): void {
		if (!followForm || !followInput) return;
		syncReviseScope();
		followForm.hidden = false;
		followInput.focus();
		syncFollowComposerMode();
	}

	function persistReviseComposerDraft(): void {
		if (!reviseComposerHydrated) return;
		const last = lastFinishedReportTurn();
		if (!last || isReviseInProgress(last)) return;
		const draft = reviseDraftFromComposer();
		try {
			if (!hasReviseComposerContent(draft)) return;
			const jobId = last.researchJobId || "";
			const slug = shareSlugForRevise() || last.shareSlug || "";
			if (draft.committed.length === 0) {
				const raw = localStorage.getItem(REVISE_COMPOSER_DRAFT_STORAGE_KEY);
				if (raw) {
					const parsed = JSON.parse(raw) as Record<string, unknown>;
					const storedJobId =
						typeof parsed.jobId === "string" ? parsed.jobId : "";
					const storedSlug =
						typeof parsed.shareSlug === "string" ? parsed.shareSlug : "";
					const sameReport =
						(storedJobId && storedJobId === jobId) ||
						(storedSlug && storedSlug === slug) ||
						(!storedJobId && !storedSlug);
					const storedCommitted = Array.isArray(parsed.committed)
						? parsed.committed.length
						: 0;
					if (
						sameReport &&
						shouldDeferReviseComposerDraftPersist(draft, storedCommitted)
					) {
						return;
					}
				}
			}
			localStorage.setItem(
				REVISE_COMPOSER_DRAFT_STORAGE_KEY,
				JSON.stringify({
					jobId: last.researchJobId || "",
					shareSlug: shareSlugForRevise() || last.shareSlug || "",
					fromVersion: reviseFromVersion,
					committed: draft.committed,
					draftScope: draft.draftScope,
					draftInstruction: draft.draftInstruction,
				}),
			);
		} catch {
			/* ignore */
		}
	}

	function restoreReviseComposerDraft(): void {
		if (reviseComposerRestored) {
			finishReviseComposerHydration();
			return;
		}
		try {
			const last = lastFinishedReportTurn();
			if (!last) return;
			const raw = localStorage.getItem(REVISE_COMPOSER_DRAFT_STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			const jobId = last.researchJobId || "";
			const slug = shareSlugForRevise() || last.shareSlug || "";
			if (
				typeof parsed.jobId === "string" &&
				parsed.jobId &&
				jobId &&
				parsed.jobId !== jobId
			) {
				return;
			}
			if (
				typeof parsed.shareSlug === "string" &&
				parsed.shareSlug &&
				slug &&
				parsed.shareSlug !== slug
			) {
				return;
			}
			const committed = Array.isArray(parsed.committed)
				? (parsed.committed as ResearchReviseEditDraft["committed"])
				: [];
			const draftScope =
				parsed.draftScope && typeof parsed.draftScope === "object"
					? (parsed.draftScope as ResearchReviseEditScope)
					: null;
			const draftInstruction =
				typeof parsed.draftInstruction === "string"
					? parsed.draftInstruction
					: "";
			if (
				committed.length === 0 &&
				!draftScope &&
				!draftInstruction.trim()
			) {
				return;
			}
			reviseComposerRestored = true;
			reviseEditDraft = {
				committed,
				draftScope,
				draftInstruction,
			};
			if (typeof parsed.fromVersion === "number") {
				reviseFromVersion = parsed.fromVersion;
			}
			reviseStackRenderCache = "";
			if (followInput) {
				followInput.value = reviseEditDraft.draftInstruction;
				fitTextarea(followInput);
			}
			syncReviseScope();
		} catch {
			/* ignore */
		} finally {
			finishReviseComposerHydration();
		}
	}

	function clearReviseComposerDraftStorage(): void {
		try {
			localStorage.removeItem(REVISE_COMPOSER_DRAFT_STORAGE_KEY);
		} catch {
			/* ignore */
		}
	}

	function rememberPendingRevise(): void {
		const last = lastFinishedReportTurn();
		const draft = reviseDraftFromComposer();
		try {
			sessionStorage.setItem(
				REVISE_PENDING_KEY,
				JSON.stringify({
					instruction: draft.draftInstruction,
					committed: draft.committed,
					draftScope: draft.draftScope,
					edits: buildSubmittableReviseEdits(draft),
					jobId: last?.researchJobId || "",
					shareSlug: shareSlugForRevise() || last?.shareSlug || "",
					fromVersion: reviseFromVersion,
				}),
			);
		} catch {
			/* ignore */
		}
	}

	function takePendingRevise(): {
		instruction: string;
		committed: ResearchReviseEditDraft["committed"];
		draftScope: ResearchReviseEditScope | null;
		jobId: string;
		shareSlug: string;
		fromVersion: number | null;
	} | null {
		try {
			const raw = sessionStorage.getItem(REVISE_PENDING_KEY);
			if (!raw) return null;
			sessionStorage.removeItem(REVISE_PENDING_KEY);
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			const committed = Array.isArray(parsed.committed)
				? (parsed.committed as ResearchReviseEditDraft["committed"])
				: [];
			const draftScope =
				parsed.draftScope && typeof parsed.draftScope === "object"
					? (parsed.draftScope as ResearchReviseEditScope)
					: null;
			return {
				instruction:
					typeof parsed.instruction === "string" ? parsed.instruction : "",
				committed,
				draftScope,
				jobId: typeof parsed.jobId === "string" ? parsed.jobId : "",
				shareSlug:
					typeof parsed.shareSlug === "string" ? parsed.shareSlug : "",
				fromVersion:
					typeof parsed.fromVersion === "number" ? parsed.fromVersion : null,
			};
		} catch {
			return null;
		}
	}

	function isReviseInProgress(turn: AiAskTurn | undefined): boolean {
		return isResearchReviseInProgress({
			research: turn?.research,
			pending: turn?.pending,
			hasReport: Boolean((turn?.report || "").trim()),
		});
	}

	function researchStopActive(): boolean {
		return turns.some(
			(turn) =>
				(turn.pending && turn.research && turn.researchJobId) ||
				isReviseInProgress(turn),
		);
	}

	function allSendButtons(): HTMLButtonElement[] {
		const buttons = [
			...root.querySelectorAll<HTMLButtonElement>(".ai-send"),
		];
		const followSend = followForm?.querySelector<HTMLButtonElement>(".ai-send");
		if (followSend && !buttons.includes(followSend)) buttons.push(followSend);
		return buttons;
	}

	function captureRevisePendingSource(turn: AiAskTurn): void {
		const report = (previewVersion?.report || turn.report || "").trim();
		if (!report) {
			revisePendingSource = null;
			return;
		}
		const index = healedResearchVersionIndex({ versionIndex: turn.versionIndex });
		const n =
			previewVersion?.n ??
			reviseFromVersion ??
			currentResearchVersionN(
				index.length > 0
					? index
					: [{ n: 1, at: 0, instruction: "", changelog: "", from: null }],
			);
		revisePendingSource = { n, report };
	}

	function clearReviseVersionState(): void {
		previewVersion = null;
		reviseFromVersion = null;
		revisePendingSource = null;
		clearResearchPreviewVersion();
	}

	function persistPreviewVersionRef(turn: AiAskTurn, n: number): void {
		const jobId = turn.researchJobId || "";
		const slug = shareSlugForRevise() || turn.shareSlug || "";
		if (turn.fromShare && slug) {
			writeResearchPreviewVersion({ shareSlug: slug, n });
		} else if (jobId) {
			writeResearchPreviewVersion({ jobId, n });
		}
	}

	function restoreStoredPreviewVersion(turn: AiAskTurn): void {
		if (!turn.research || !(turn.report || "").trim()) return;
		const index = healedResearchVersionIndex({
			versionIndex: turn.versionIndex,
			processNotes: turn.processNotes,
			createdAt: turn.researchStartedAt,
		});
		const currentN = currentResearchVersionN(index);
		const jobId = turn.researchJobId || "";
		const slug = shareSlugForRevise() || turn.shareSlug || "";
		let n: number | null = null;
		if (shareMode) {
			try {
				const parsed = Math.floor(
					Number(new URL(window.location.href).searchParams.get("version")),
				);
				if (Number.isFinite(parsed) && parsed >= 1) n = parsed;
			} catch {
				/* ignore */
			}
		}
		if (!n) {
			const stored = readResearchPreviewVersion();
			if (!stored) return;
			if (stored.jobId && jobId && stored.jobId === jobId) n = stored.n;
			else if (stored.shareSlug && slug && stored.shareSlug === slug) n = stored.n;
			else return;
		}
		if (!n || n >= currentN) {
			if (n && n >= currentN) clearResearchPreviewVersion();
			return;
		}
		void previewResearchVersion(turn, n);
	}

	/** After a failed or cancelled revise, show the version the reader started from. */
	function restoreReviseFailureView(): void {
		if (revisePendingSource) {
			previewVersion = {
				n: revisePendingSource.n,
				report: revisePendingSource.report,
			};
			reviseFromVersion = revisePendingSource.n;
			const last = lastFinishedReportTurn();
			if (last) persistPreviewVersionRef(last, revisePendingSource.n);
		}
		revisePendingSource = null;
	}

	function settleReviseVersionState(turn: AiAskTurn): void {
		if (turn.error) restoreReviseFailureView();
		else clearReviseVersionState();
	}

	function restoreReviseInstructionToComposer(): void {
		reviseEditDraft = {
			committed: lastReviseEditDraft.committed.map((row) => ({
				...row,
				scope: row.scope ? { ...row.scope } : undefined,
			})),
			draftScope: lastReviseEditDraft.draftScope
				? { ...lastReviseEditDraft.draftScope }
				: null,
			draftInstruction: lastReviseEditDraft.draftInstruction,
		};
		reviseStackRenderCache = "";
		restoreReviseSubmitImagesToComposer();
		if (!followInput) {
			syncReviseScope();
			persistReviseComposerDraft();
			return;
		}
		followInput.value = reviseEditDraft.draftInstruction;
		fitTextarea(followInput);
		followInput.focus();
		syncReviseScope();
		persistReviseComposerDraft();
	}

	function clearReviseInstructionDraft(): void {
		lastReviseInstruction = "";
		clearReviseSubmitImages();
	}

	function displayedReportMarkdown(turn: AiAskTurn): string {
		if (isReviseInProgress(turn) && revisePendingSource?.report) {
			return revisePendingSource.report;
		}
		if (previewVersion && previewVersion.n > 0) return previewVersion.report;
		return turn.report || "";
	}

	async function reviseReport(
		instruction: string,
		action: "revise" | "restore" = "revise",
	): Promise<void> {
		const last = lastFinishedReportTurn();
		if (!last || busy) return;
		const draft = reviseDraftFromComposer();
		if (instruction.trim()) draft.draftInstruction = instruction;
		const edits = buildSubmittableReviseEdits(draft);
		const q =
			action === "revise"
				? edits.map((edit) => edit.instruction).join("\n\n")
				: clipAiQuestion(instruction);
		if (action === "revise" && !canSubmitReviseEdits(edits)) return;
		if (!quota?.signedIn) {
			if (followInput) followInput.value = draft.draftInstruction;
			rememberPendingRevise();
			openQuotaDialog("revise", q);
			return;
		}
		if (quota.needsEmailVerification && quota.remaining <= 0) {
			openQuotaDialog("verify", q);
			return;
		}
		if (action === "revise" && quota && !quota.allowed) {
			openQuotaDialog(quota.signedIn ? "tomorrow" : "signin", q);
			return;
		}
		stopListening();
		busy = true;
		root.classList.add("is-busy");
		let reviseImages: ResearchContextImage[] = [];
		let reviseImageCount = 0;
		if (action === "revise") {
			lastReviseInstruction = q;
			lastReviseEditDraft = draft;
			captureRevisePendingSource(last);
			showReviseChanges = false;
			last.error = undefined;
			last.researchLocalCancelToken = 0;
			followComposerHoldCompact = false;
			last.pending = true;
			last.phase = "answer";
			last.processNotes = rememberResearchProcessNote(
				dropOpenResearchRevisionCycle(last.processNotes),
				researchRevisionStartedNote(nextResearchRevisionN(last.versionIndex || [])),
			);
			last.progressNote = RESEARCH_REVISE_CONSIDERING_NOTE;
			reviseImages = [...compositionImages];
			reviseImageCount = reviseImages.length;
			snapshotReviseSubmitImages(compositionImages);
			resetReviseEdits(true);
			compositionImages = [];
			syncCompositionTray();
			syncFollowComposerMode();
			syncLayout();
			revealReviseProgress();
		} else {
			setStatus("Restoring…");
		}
		try {
			const primary = edits[0];
			const { response, data } = await fetchAiJson<{
				success?: boolean;
				job?: ResearchJobPublic;
				forked?: boolean;
				quota?: AiAskQuotaView;
				code?: string;
				error?: string;
			}>(RESEARCH_REVISE_API_PATH, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action,
					edits,
					instruction: primary?.instruction || q,
					heading: primary?.heading || "",
					quote: primary?.quote || "",
					jobId: last.researchJobId || "",
					shareSlug: shareSlugForRevise() || last.shareSlug || "",
					fromVersion: reviseFromVersion,
					...(reviseImageCount > 0
						? { images: reviseImages, imageCount: reviseImageCount }
						: {}),
				}),
			});
			if (data.quota) applyQuota(data.quota);
			if (data.job) {
				const base = (
					revisePendingSource?.report ||
					last.report ||
					""
				).trim();
				applyResearchJobToTurn(last, data.job);
				if (!data.job.pending && !last.error) {
					stampReviseDiffBase(last, base, revisePendingSource?.n);
				}
				if (!data.job.pending) settleReviseVersionState(last);
				closeVersionsDrawer();
				persistSessionFromTurn(last);
				if (data.forked && data.job.id && shareMode) {
					window.location.assign(
						`/search?mode=research&research=${encodeURIComponent(data.job.id)}`,
					);
					return;
				}
				if (data.job.pending) {
					setStatus("");
					syncLayout();
					scrollAskProcessToLatest(
						thread.querySelector(".ai-turn:last-child .ai-process"),
						{ focus: true },
					);
					await pollResearchTurn(last);
					if (last.error) {
						setStatus(last.error);
						restoreReviseFailureView();
						restoreReviseInstructionToComposer();
					} else if (!last.pending) {
						clearReviseInstructionDraft();
						setStatus("");
					}
					return;
				}
				if (data.job.error) {
					setStatus(data.job.error);
					last.error = data.job.error;
					restoreReviseFailureView();
					restoreReviseInstructionToComposer();
				} else {
					clearReviseInstructionDraft();
					setStatus("");
				}
				syncLayout();
				return;
			}
			if (response.status === 401) {
				last.pending = false;
				last.phase = "done";
				restoreReviseFailureView();
				if (followInput) followInput.value = q;
				rememberPendingRevise();
				openQuotaDialog("revise", q);
				return;
			}
			if (response.status === 429) {
				last.pending = false;
				last.phase = "done";
				restoreReviseFailureView();
				openQuotaDialog(
					data.quota?.needsEmailVerification
						? "verify"
						: data.quota?.signedIn
							? "tomorrow"
							: "signin",
					q,
				);
				return;
			}
			if (action === "revise" && last.researchJobId) {
				const live = await fetchResearchJob(last.researchJobId);
				if (live.job?.pending) {
					applyResearchJobToTurn(last, live.job);
					syncLayout();
					await pollResearchTurn(last);
					return;
				}
			}
			last.pending = false;
			last.phase = "done";
			restoreReviseFailureView();
			setStatus(
				researchApiFailureMessage({
					status: response.status,
					code: data.code,
					error: data.error,
					fallback: "Could not revise the report.",
				}),
			);
			restoreReviseInstructionToComposer();
		} catch {
			if (action === "revise" && last.researchJobId) {
				try {
					const live = await fetchResearchJob(last.researchJobId);
					if (live.job?.pending) {
						applyResearchJobToTurn(last, live.job);
						syncLayout();
						await pollResearchTurn(last);
						return;
					}
					if (live.job) applyResearchJobToTurn(last, live.job);
				} catch {
					/* fall through */
				}
			}
			last.pending = false;
			last.phase = "done";
			restoreReviseFailureView();
			setStatus(
				researchApiFailureMessage({
					status: 0,
					code: "route_miss",
					fallback: "Could not revise the report.",
				}),
			);
			restoreReviseInstructionToComposer();
		} finally {
			busy = false;
			root.classList.remove("is-busy");
			syncLayout();
		}
	}

	/** Scroll to the live revise progress strip and pulse it after submit. */
	function revealReviseProgress(): void {
		const process = thread.querySelector<HTMLElement>(
			".ai-turn:last-child .ai-process",
		);
		if (!process) return;
		scrollAskProcessToLatest(process, { focus: true });
		try {
			process.scrollIntoView({ block: "center", behavior: "smooth" });
		} catch {
			process.scrollIntoView();
		}
		process.classList.remove("is-revise-flash");
		// Restart the animation even when a previous flash is still on the node.
		void process.offsetWidth;
		process.classList.add("is-revise-flash");
		window.setTimeout(() => process.classList.remove("is-revise-flash"), 1800);
	}

	function closeVersionsDrawer(): void {
		if (versionsDrawer) versionsDrawer.hidden = true;
	}

	function openVersionsDrawer(turn: AiAskTurn): void {
		if (!versionsDrawer || !versionsList) return;
		const liveStats = snapshotResearchHistoryStats(turn.report, turn.results);
		const index = healedResearchVersionIndex({
			versionIndex: turn.versionIndex,
			processNotes: turn.processNotes,
			createdAt: turn.researchStartedAt,
			stats: liveStats,
		});
		const currentN = currentResearchVersionN(
			index.length > 0
				? index
				: [{ n: 1, at: 0, instruction: "", changelog: "", from: null }],
		);
		const previewN = previewVersion?.n ?? currentN;
		const rows =
			index.length > 0
				? [...index].reverse()
				: [
						{
							n: 1,
							at: 0,
							instruction: "",
							changelog: "Original report.",
							from: null,
						},
					];
		const changesVisible = researchChangesChipVisible(turn, {
			isLatestTurn: true,
		});
		const changesLabel = researchChangesChipLabelForTurn(turn);
		const bodyStoredNs = new Set(versionBodiesToKeep(index));
		const isVersionPreviewable = (n: number) =>
			n === currentN || bodyStoredNs.has(n);
		const hasMetadataOnlyRows = rows.some(
			(row) => !isVersionPreviewable(row.n),
		);
		if (versionsFootnote) {
			versionsFootnote.hidden = !hasMetadataOnlyRows;
			if (hasMetadataOnlyRows) {
				versionsFootnote.textContent = researchVersionsFootnoteHtml();
			}
		}
		versionsList.innerHTML = rows
			.map((row) =>
				researchVersionRowHtml(row, {
					current: row.n === currentN,
					preview: row.n === previewN,
					previewable: isVersionPreviewable(row.n),
					previous: previousResearchVersion(index, row),
					fallbackStats: row.n === currentN ? liveStats : undefined,
					changesChip:
						row.n === currentN &&
						row.n === previewN &&
						changesVisible &&
						changesLabel
							? { label: changesLabel, pressed: showReviseChanges }
							: undefined,
				}),
			)
			.join("");
		versionsList.querySelectorAll<HTMLElement>("[data-ai-version-n]").forEach(
			(row) => {
				const previewable =
					row.getAttribute("data-ai-version-previewable") === "true";
				const open = () => {
					const n = Number(row.getAttribute("data-ai-version-n"));
					void previewResearchVersion(turn, n);
				};
				if (previewable) {
					row.addEventListener("click", (event) => {
						const target = event.target as HTMLElement | null;
						if (target?.closest("[data-ai-versions-copy]")) return;
						// Dragging across “You asked” to copy it must not switch versions.
						if (selectionInside(row)) return;
						open();
					});
					row.addEventListener("keydown", (event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						if ((event.target as HTMLElement | null)?.closest("button")) return;
						event.preventDefault();
						open();
					});
				}
				const copy = row.querySelector<HTMLButtonElement>("[data-ai-versions-copy]");
				const askText = row.querySelector<HTMLElement>("[data-ai-versions-ask]");
				copy?.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					const text = (askText?.textContent || "").replace(/^“|”$/g, "").trim();
					if (!text) return;
					void navigator.clipboard
						?.writeText(text)
						.then(() => {
							copy.classList.add("is-copied");
							window.setTimeout(() => copy.classList.remove("is-copied"), 1200);
						})
						.catch(() => {
							/* clipboard unavailable — text is still selectable */
						});
				});
				row.querySelector<HTMLButtonElement>("[data-ai-changes]")?.addEventListener(
					"click",
					(event) => {
						event.preventDefault();
						event.stopPropagation();
						showReviseChanges = !showReviseChanges;
						syncReportChangeVisibility(turn);
						openVersionsDrawer(turn);
					},
				);
			},
		);
		if (versionsActions) {
			versionsActions.hidden =
				previewN === currentN || turn.fromSample === true;
		}
		if (versionsReviseBtn) {
			versionsReviseBtn.textContent = RESEARCH_REVISE_FROM_ACTION;
		}
		if (versionsRestoreBtn) {
			versionsRestoreBtn.textContent = RESEARCH_RESTORE_ACTION;
		}
		versionsDrawer.hidden = false;
	}

	async function previewResearchVersion(
		turn: AiAskTurn,
		n: number,
	): Promise<void> {
		const currentN = currentResearchVersionN(turn.versionIndex || []);
		if (n === currentN || n < 1) {
			previewVersion = null;
			reviseFromVersion = null;
			clearResearchPreviewVersion();
			syncLayout();
			openVersionsDrawer(turn);
			return;
		}
		const jobId = turn.researchJobId || "";
		const shareSlug = shareSlugForRevise() || turn.shareSlug || "";
		const sampleSlug =
			turn.fromSample && turn.sampleSlug ? turn.sampleSlug.trim() : "";
		const url = turn.fromShare && shareSlug
			? `/api/ai/share?slug=${encodeURIComponent(shareSlug)}&version=${n}`
			: sampleSlug
				? `/api/ai/sample?slug=${encodeURIComponent(sampleSlug)}&version=${n}`
				: jobId
					? researchJobApiPath(jobId, n)
					: "";
		if (!url) return;
		const token = ++previewVersionToken;
		try {
			const { response, data } = await fetchAiJson<{
				success?: boolean;
				report?: string;
			}>(url);
			// A slower earlier click must not overwrite the version picked last.
			if (token !== previewVersionToken) return;
			if (!response.ok || !data.success || !data.report) return;
			previewVersion = { n, report: data.report };
			reviseFromVersion = n;
			persistPreviewVersionRef(turn, n);
			syncLayout();
			openVersionsDrawer(turn);
		} catch {
			/* keep current */
		}
	}

	function pinHeading(heading: HTMLElement): void {
		const scope = scopeFromReportPin(currentReviseReportMarkdown(), {
			heading: heading.getAttribute("data-report-heading") || "",
		});
		headingReviseBtn?.remove();
		headingReviseBtn = document.createElement("button");
		headingReviseBtn.type = "button";
		headingReviseBtn.className = "ai-heading-revise";
		headingReviseBtn.textContent = RESEARCH_REVISE_REPORT;
		headingReviseBtn.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			openReviseComposer();
		});
		heading.classList.add("is-revise-heading");
		thread
			.querySelectorAll(".is-revise-heading")
			.forEach((node) => {
				if (node !== heading) node.classList.remove("is-revise-heading");
			});
		heading.append(headingReviseBtn);
		applyRevisePin(scope);
		openReviseComposer();
	}

	let selectionPointerDown = false;

	function hideSelectionRevise(): void {
		if (reviseFloat) reviseFloat.hidden = true;
	}

	function updateSelectionRevise(): void {
		if (!reviseFloat || !lastFinishedReportTurn()) {
			hideSelectionRevise();
			return;
		}
		const selection = window.getSelection();
		const text = selection?.toString() || "";
		if (!selection || selection.rangeCount === 0 || !selectionQualifiesForRevise(text)) {
			hideSelectionRevise();
			return;
		}
		const range = selection.getRangeAt(0);
		const node = range.commonAncestorContainer;
		const el = node instanceof Element ? node : node.parentElement;
		if (!el?.closest(".ai-report .ai-answer-body")) {
			hideSelectionRevise();
			return;
		}
		// While the pointer is still down the end of the selection is moving;
		// place the chip once the drag ends so it never hops mid-selection.
		if (selectionPointerDown) {
			hideSelectionRevise();
			return;
		}
		reviseFloat.textContent = RESEARCH_REVISE_REPORT;
		const lastLine = lastRangeClientRect(range);
		const column = el.closest(".ai-answer-body")?.getBoundingClientRect();
		if (!lastLine || !column) {
			hideSelectionRevise();
			return;
		}
		const origin = root.getBoundingClientRect();
		const wasHidden = reviseFloat.hidden;
		if (wasHidden) {
			reviseFloat.style.visibility = "hidden";
			reviseFloat.hidden = false;
		}
		const chip = {
			width: reviseFloat.offsetWidth || 96,
			height: reviseFloat.offsetHeight || 28,
		};
		const pos = reviseFloatOffset(lastLine, origin, chip, column);
		reviseFloat.style.left = `${pos.left}px`;
		reviseFloat.style.top = `${pos.top}px`;
		reviseFloat.dataset.placement = pos.placement;
		reviseFloat.style.visibility = "";
		reviseFloat.hidden = false;
	}

	function lastReportElement(): HTMLElement | null {
		return thread.querySelector<HTMLElement>(".ai-turn:last-child .ai-report");
	}

	function syncReportChangeVisibility(turn: AiAskTurn): void {
		const report = lastReportElement();
		if (!report) return;
		if (isReviseInProgress(turn)) {
			report.classList.remove("is-show-changes");
			return;
		}
		const diff = previewVersion ? null : reportBlockDiff(turn);
		const changeCount = reportBlockDiffCount(diff);
		report.classList.toggle(
			"is-show-changes",
			changeCount > 0 && showReviseChanges && !previewVersion,
		);
		if (showReviseChanges && changeCount > 0 && !previewVersion) {
			revealFirstReportChange();
		}
	}

	/** Paint diff marks on the report; visibility is toggled from the Versions drawer. */
	function applyReportChangeMarks(turn: AiAskTurn): void {
		if (isReviseInProgress(turn)) return;
		const report = lastReportElement();
		if (!report) return;
		const body = report.querySelector<HTMLElement>(".ai-answer-body");
		const diff = previewVersion ? null : reportBlockDiff(turn);
		if (body) {
			const reportMarkdown = displayedReportMarkdown(turn).trim();
			const baseMarkdown = (turn.reviseBase || "").trim();
			stampReportBlockKeys(body, reportMarkdown);
			markReportBlockDiff(body, diff, baseMarkdown);
			if (
				diff &&
				baseMarkdown &&
				typeof localStorage !== "undefined" &&
				localStorage.getItem("debugReportChanges") === "1"
			) {
				console.info(formatReportBlockDiffDebug(baseMarkdown, reportMarkdown));
			}
		}
		syncReportChangeVisibility(turn);
	}

	function revealFirstReportChange(): void {
		const first =
			lastReportElement()?.querySelector<HTMLElement>(".is-first-change") ||
			lastReportElement()?.querySelector<HTMLElement>(".ai-change-removed");
		if (!first) return;
		try {
			first.scrollIntoView({ block: "center", behavior: "smooth" });
		} catch {
			first.scrollIntoView();
		}
	}

	function syncReportParagraphNumbers(report: HTMLElement): void {
		const body = report.querySelector<HTMLElement>(".ai-answer-body");
		if (!body) return;
		decorateReportParagraphNumbers(body);
		const show = readShowParagraphNumbers();
		report.classList.toggle("is-show-paragraph-numbers", show);
		const btn = report.querySelector<HTMLButtonElement>("[data-ai-report-paragraphs]");
		if (!btn) return;
		btn.classList.toggle("is-on", show);
		btn.setAttribute("aria-pressed", show ? "true" : "false");
		btn.title = show ? REPORT_PARAGRAPH_HIDE_TITLE : REPORT_PARAGRAPH_SHOW_TITLE;
		btn.setAttribute("aria-label", btn.title);
	}

	function bindReportParagraphToggle(report: HTMLElement): void {
		const btn = report.querySelector<HTMLButtonElement>("[data-ai-report-paragraphs]");
		if (!btn || btn.dataset.bound === "1") return;
		btn.dataset.bound = "1";
		btn.addEventListener("click", () => {
			const on = !report.classList.contains("is-show-paragraph-numbers");
			report.classList.toggle("is-show-paragraph-numbers", on);
			writeShowParagraphNumbers(on);
			btn.classList.toggle("is-on", on);
			btn.setAttribute("aria-pressed", on ? "true" : "false");
			btn.title = on ? REPORT_PARAGRAPH_HIDE_TITLE : REPORT_PARAGRAPH_SHOW_TITLE;
			btn.setAttribute("aria-label", btn.title);
		});
	}

	async function hydrateReviseBaseIfNeeded(turn: AiAskTurn): Promise<void> {
		if (!shouldHydrateReviseBase(turn) || previewVersion || isReviseInProgress(turn)) {
			return;
		}
		const prevN = researchReviseBaseVersionN(
			healedResearchVersionIndex({ versionIndex: turn.versionIndex }),
		);
		if (!prevN || !turn.researchJobId) return;
		const token = ++hydrateReviseBaseToken;
		hydratingReviseBase = true;
		try {
			const slug = shareSlugForRevise() || turn.shareSlug || "";
			const url = turn.fromShare && slug
				? `/api/ai/share?slug=${encodeURIComponent(slug)}&version=${prevN}`
				: researchJobApiPath(turn.researchJobId, prevN);
			const { response, data } = await fetchAiJson<{
				success?: boolean;
				report?: string;
			}>(url);
			if (token !== hydrateReviseBaseToken) return;
			const base = (data.report || "").trim();
			if (
				!response.ok ||
				!data.success ||
				!base ||
				base === (turn.report || "").trim()
			) {
				return;
			}
			turn.reviseBase = base;
			turn.reviseBaseVersionN = prevN;
			persistSessionFromTurn(turn);
			syncLayout();
			if (!versionsDrawer?.hidden) openVersionsDrawer(turn);
		} catch {
			/* keep report without the chip */
		} finally {
			if (token === hydrateReviseBaseToken) hydratingReviseBase = false;
		}
	}

	function syncReportToc(): void {
		const options = researchTableOfContentsOptions();
		if (!lastFinishedReportTurn()) {
			clearTableOfContents(options);
			return;
		}
		refreshTableOfContents(options);
	}

	function bindReportRevise(turn: AiAskTurn, turnIndex: number): void {
		if (turnIndex !== turns.length - 1 || !lastFinishedReportTurn()) return;
		const report = lastReportElement();
		if (report) {
			syncReportParagraphNumbers(report);
			bindReportParagraphToggle(report);
			stampReviseReportBlockIds(turn);
		}
		thread.querySelectorAll<HTMLElement>("[data-report-heading]").forEach(
			(heading) => {
				heading.addEventListener("click", (event) => {
					if ((event.target as HTMLElement | null)?.closest("a")) return;
					event.preventDefault();
					pinHeading(heading);
				});
			},
		);
		thread.querySelectorAll<HTMLButtonElement>("[data-ai-versions]").forEach(
			(button) => {
				button.addEventListener("click", () => {
					openVersionsDrawer(turn);
				});
			},
		);
	}

	function syncClarifyBar(): void {
		const last = turns[turns.length - 1];
		const clarifying = isClarifyingTurn(last);
		const reviseClarifying = !clarifying && isReviseClarifyingTurn(last);
		if (clarifyBar) clarifyBar.hidden = !(clarifying || reviseClarifying);
		if (clarifyBar) clarifyBar.classList.toggle("is-revise", reviseClarifying);
		if (reviseClarifying && last?.reviseClarify && clarifyStartBtn) {
			// Same bar, revise wording: the credit was spent when the revise
			// began, so there is no “N left” meter here.
			const answers = answersFromClarifyState(last.reviseClarify.answers);
			clarifyStartBtn.disabled = !canStartResearchClarify(
				last.reviseClarify.questions,
				answers,
			);
			clarifyStartBtn.textContent = RESEARCH_REVISE_CLARIFY_CONTINUE;
			return;
		}
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
		researchPollHiddenCleanup?.();
		researchPollHiddenCleanup = null;
		if (researchPollTimer) {
			window.clearTimeout(researchPollTimer);
			researchPollTimer = 0;
		}
	}

	/**
	 * Resolves when it is worth polling again: after the delay, or as soon as
	 * a hidden tab becomes visible. While hidden the request is skipped.
	 */
	function waitForResearchPollWindow(
		delayMs: number,
		token: number,
	): Promise<boolean> {
		if (typeof document !== "undefined" && document.hidden) {
			return new Promise<boolean>((resolve) => {
				let settled = false;
				const finish = (value: boolean) => {
					if (settled) return;
					settled = true;
					window.clearTimeout(recheckTimer);
					document.removeEventListener("visibilitychange", onVisibility);
					researchPollHiddenCleanup = null;
					researchPollTimer = 0;
					resolve(value);
				};
				const onVisibility = () => {
					if (!document.hidden) finish(token === researchPollToken);
				};
				const recheckTimer = window.setTimeout(() => {
					finish(token === researchPollToken);
				}, RESEARCH_POLL_HIDDEN_RECHECK_MS);
				researchPollTimer = recheckTimer;
				researchPollHiddenCleanup = () => finish(false);
				document.addEventListener("visibilitychange", onVisibility);
			});
		}
		return new Promise<boolean>((resolve) => {
			researchPollTimer = window.setTimeout(() => {
				researchPollTimer = 0;
				resolve(token === researchPollToken);
			}, delayMs);
		});
	}

	/** Background-tab pause for the history watcher. */
	async function waitForResearchWatchWindow(delayMs: number): Promise<void> {
		if (!(typeof document !== "undefined" && document.hidden)) {
			await new Promise<void>((resolve) => {
				window.setTimeout(resolve, delayMs);
			});
			return;
		}
		await new Promise<void>((resolve) => {
			const onVisibility = () => {
				if (document.hidden) return;
				document.removeEventListener("visibilitychange", onVisibility);
				resolve();
			};
			document.addEventListener("visibilitychange", onVisibility);
		});
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
		const show = askSponsorNoteVisible({
			askSurface: isAskSurfaceMode(window.location.search),
			research,
			signedIn: Boolean(quota?.signedIn),
			hasThread: turns.length > 0,
			shareMode,
			restoring: root.classList.contains("is-restoring-research"),
		});
		root.querySelectorAll<HTMLElement>("[data-ai-sponsor-note]").forEach((el) => {
			el.textContent = note;
			el.hidden = !show;
		});
		const signin = root.querySelector<HTMLElement>("[data-ai-research-signin]");
		if (signin) signin.hidden = true;
	}

	function syncResearchChip(): void {
		const pane = researchPaneOn();
		// /api/ai/quota can lag 10-20s behind the navbar auth state. Seed the
		// empty Research composer from the navbar cache so signed-in readers
		// see the real placeholder immediately instead of "Sign in…".
		let navSignedIn = false;
		try {
			navSignedIn = readNavAuthCache()?.signedIn === true;
		} catch {
			navSignedIn = false;
		}
		const gated = researchEmptyComposerGated({
			researchPane: pane,
			hasThread: turns.length > 0,
			quotaReady: Boolean(quota) || navSignedIn,
			signedIn: Boolean(quota?.signedIn) || navSignedIn,
		});
		root.classList.toggle("is-research-gated", gated);
		// Ask and Research are dedicated modes with distinct composers — no
		// Research pill anywhere. Hide any stale chip and never let a persisted
		// chip preference flip the Ask composer into Research UI.
		root.querySelectorAll<HTMLButtonElement>("[data-ai-research-chip]").forEach(
			(chip) => {
				chip.hidden = true;
				chip.title = RESEARCH_CHIP_TITLE;
				chip.setAttribute("aria-pressed", "false");
				chip.classList.toggle("is-on", false);
			},
		);
		const placeholder = gated
			? RESEARCH_SIGNED_OUT_PLACEHOLDER
			: pane
				? RESEARCH_PLACEHOLDER
				: ASK_PLACEHOLDER;
		if (input) {
			input.placeholder = placeholder;
			input.rows = gated ? 1 : 2;
			if (gated) input.style.height = "";
		}
		const composerLabel = root.querySelector<HTMLLabelElement>(
			'label[for="ai-input"]',
		);
		if (composerLabel) {
			composerLabel.textContent = gated
				? RESEARCH_SIGNED_OUT_PLACEHOLDER
				: pane
					? RESEARCH_COMPOSER_LABEL
					: ASK_COMPOSER_LABEL;
		}
		root.querySelectorAll<HTMLButtonElement>("[data-ai-new]").forEach((button) => {
			button.textContent = pane ? RESEARCH_NEW_LABEL : ASK_NEW_LABEL;
			if (button.closest("[data-ai-follow-form]")) {
				button.hidden = Boolean(lastFinishedReportTurn());
			}
		});
		if (followInput) {
			followInput.placeholder = askFollowPlaceholder({
				pending: turns.some((turn) => turn.pending),
				researchFollow: followResearchChipOn(),
				reviseFollow: reviseFollowActive(),
			});
		}
		syncReviseScope();
		syncLimitsNotes();
		const researchBusy = turns.some(
			(turn) => turn.pending && turn.research && turn.researchJobId,
		);
		const reviseBusy = turns.some((turn) => isReviseInProgress(turn));
		syncStopButtons(researchBusy || reviseBusy, reviseBusy);
		renderMeters();
	}

	function setResearchChipOn(next: boolean, persist = true): void {
		researchChipOn = next && researchChipAvailable();
		if (!researchChipOn) {
			clearCompositionAttachments({
				clearDraft: false,
				persistDraft: false,
			});
		} else {
			syncCompositionTray();
			maybeApplyResearchCompositionDraft();
		}
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
		kind: "signin" | "tomorrow" | "save" | "share" | "verify" | "research" | "revise",
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
		const showSignin =
			kind === "signin" ||
			kind === "save" ||
			kind === "share" ||
			kind === "revise";
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
			} else if (kind === "revise") {
				title.textContent = RESEARCH_REVISE_ACCOUNT_TITLE;
				body.textContent = RESEARCH_REVISE_ACCOUNT_BODY;
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
		const pending = kind === "save" || kind === "share" || kind === "revise" ? "" : question;
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

	let quotaRefreshInFlight: Promise<void> | null = null;
	function ensureQuotaRefresh(): Promise<void> {
		// Collapse the several refreshQuota calls a page load makes into one request.
		if (!quotaRefreshInFlight) {
			quotaRefreshInFlight = refreshQuota().finally(() => {
				quotaRefreshInFlight = null;
			});
		}
		return quotaRefreshInFlight;
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
		const visible =
			deletedResearchJobIds.size > 0
				? filterDeletedResearchJobs(active, deletedResearchJobIds)
				: active;
		if (visible.length === 0) {
			clearAskThreadResumeIntent(undefined, { research: researchPaneOn() });
			return;
		}
		turns = visible.map((entry) => {
			const turn = sessionEntryToTurn(entry);
			turn.fromCache = false;
			return turn;
		});
		restoreReviseComposerDraft();
		syncLayout();
		const lastResearch = [...turns]
			.reverse()
			.find((turn) => turn.research && (turn.report || "").trim());
		if (lastResearch && !lastResearch.pending) {
			restoreStoredPreviewVersion(lastResearch);
			if (lastResearch.researchJobId) {
				void refreshResearchJobVersionIndex(lastResearch.researchJobId);
			}
		}
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
				maybeApplyResearchCompositionDraft();
			});
		}
		maybeApplyResearchCompositionDraft();
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
		busy = false;
		root.classList.remove("is-busy", "is-research-busy");
		followComposerHoldCompact = false;
		followComposerPinnedOpen = false;
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
				if (already) {
					void refreshResearchJobVersionIndex(jobId);
					return;
				}
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
		if (isResearchJobDeleted(turn.researchJobId)) return;
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
		saveTurnAttachmentsToStore(turn);
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
		if (isResearchJobDeleted(jobId)) return;
		watchingResearchJobs.add(jobId);
		try {
			while (turns.length === 0) {
				await waitForResearchWatchWindow(RESEARCH_WATCH_POLL_MS);
				if (turns.length > 0) return;
				if (isResearchJobDeleted(jobId)) return;
				const data = await fetchResearchJob(jobId);
				if (data.status === 404) {
					// Job was hard-deleted — drop any lingering row.
					sessionEntries = removeAskHistoryEntriesByJobIds(sessionEntries, [
						jobId,
					]);
					writeAiAskSession(sessionEntries);
					if (turns.length === 0) renderHistory();
					return;
				}
				if (!data.ok || !data.job) return;
				if (data.job.pending) continue;
				if (isResearchJobDeleted(jobId)) return;
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
			const { response, data } = await fetchAiJson<{
				jobs?: ResearchJobPublic[];
			}>(RESEARCH_API_PATH);
			if (!response.ok) return;
			const jobs = Array.isArray(data.jobs) ? data.jobs : [];
			let changed = false;
			for (const job of jobs) {
				if (!job.id) continue;
				if (isResearchJobDeleted(job.id)) continue;
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
			if (deletedResearchJobIds.size > 0) {
				sessionEntries = filterDeletedResearchJobs(
					sessionEntries,
					deletedResearchJobIds,
				);
			}
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
		if (entry.researchJobId && isResearchJobDeleted(entry.researchJobId)) {
			sessionEntries = removeAskHistoryEntriesByJobIds(sessionEntries, [
				entry.researchJobId,
			]);
			writeAiAskSession(sessionEntries);
			syncAskSurfaceUrl({ jobId: null, open: null, sample: null });
			renderHistory();
			syncLayout();
			return;
		}
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
		// Rows whose image bytes were stripped (quota/Firestore) still carry
		// count/label metadata; upgrade them with same-browser bytes when held.
		for (const restoredTurn of turns) {
			if (
				!restoredTurn.attachedImages?.length &&
				(restoredTurn.imageCount || restoredTurn.contextAttachmentLabel)
			) {
				void backfillTurnAttachmentsFromStore(restoredTurn).then(
					(changed) => {
						if (changed && turns.includes(restoredTurn)) syncLayout();
					},
				);
			}
		}
		persistActiveThread();
		syncLayout();
		const tip = turns[turns.length - 1];
		if (
			tip?.researchJobId &&
			researchHistoryNeedsVersionIndexRefresh({
				researchJobId: tip.researchJobId,
				researchPending: tip.pending,
			})
		) {
			void refreshResearchJobVersionIndex(tip.researchJobId);
		}
	}

	function persistSessionFromTurn(turn: AiAskTurn): void {
		if (turn.fromSample) return;
		if (turn.pending || turn.error || turn.offTopic) return;
		if (
			turn.research &&
			turn.researchJobId &&
			isResearchJobDeleted(turn.researchJobId)
		)
			return;
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
		if (!turn.research) {
			// Keep the URL describing what's on screen so a reload restores
			// this thread tip instead of a stale `open` entry.
			syncAskSurfaceUrl({
				jobId: null,
				open: entry.question,
				sample: null,
			});
		}
		postHistoryEntry(entry, {
			replaceQuestions,
			replaceJobIds,
		});
	}

	async function loadAskSamples(): Promise<void> {
		try {
			const response = await fetch("/api/ai/samples", {
				credentials: "same-origin",
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
			syncLayout();
		} catch {
			/* samples are optional until an admin marks one */
		}
	}

	function openSampleFromUrl(slug: string): boolean {
		const sample = askSamples.find((item) => item.slug === slug);
		if (!sample) return false;
		if (isResearchAskSample(sample) !== researchPaneOn()) return false;
		openAskSample(sample);
		return true;
	}

	/** Samples open instantly like a previously run report — no staged run. */
	function openAskSample(sample: AiAskSamplePublic): void {
		followComposerHoldCompact = true;
		followComposerPinnedOpen = false;
		pendingReplaceQuestions = null;
		pendingReplaceJobIds = null;
		clearAskResumeFromDiscourse(undefined, { research: researchPaneOn() });
		syncAskSurfaceUrl({
			sample: sample.slug,
			jobId: null,
			open: null,
		});
		turns = [sampleToAiAskTurn(sample)];
		busy = false;
		root.classList.remove("is-busy");
		syncLayout();
		thread.firstElementChild?.scrollIntoView({ block: "start" });
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
		const researchLane = turnResearchSampleLane(turn, {
			researchPane: researchPaneOn(),
		});
		const replacing = Boolean(
			publishedAskSampleForTurn(askSamples, turn, {
				researchPane: researchPaneOn(),
			}),
		);
		if (!window.confirm(askSampleConfirmMessage(replacing, { research: researchLane })))
			return;
		const research = researchLane;
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
					...(turn.versionIndex && turn.versionIndex.length > 0
						? { versionIndex: clipResearchVersionIndex(turn.versionIndex) }
						: {}),
					...(() => {
						const reportStats = snapshotResearchHistoryStats(
							turn.report,
							turn.results,
						);
						return reportStats ? { reportStats } : {};
					})(),
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
				turn.sampleSlug = saved.slug;
				renderHistory();
				syncLayout();
			}
			setStatus(askSampleSavedStatusMessage(research));
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
			const alreadyRemoved =
				response.status === 404 &&
				data.error === "That example is no longer published.";
			if (!response.ok && !data.success && !alreadyRemoved) {
				setStatus(data.error || "Could not remove this example.");
				return;
			}
			askSamples = removeAskSampleLocal(askSamples, slug);
			for (const turn of turns) {
				if (turn.sampleSlug === slug) turn.sampleSlug = undefined;
			}
			if (fromSample) {
				leaveAskHome({ url: "replace" });
			} else {
				renderHistory();
				syncLayout();
			}
			if (!alreadyRemoved) {
				setStatus("Removed this example.");
			}
		} catch {
			setStatus("Could not remove this example.");
		}
	}

	function removeTurnSample(turn: AiAskTurn): void {
		const published = publishedAskSampleForTurn(askSamples, turn, {
			researchPane: researchPaneOn(),
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
		if (nextSaved) {
			const research = target.research === true;
			const match =
				findAiAskSessionEntry(sessionEntries, target.question, {
					research,
				}) ||
				findAiAskSessionEntry(sessionEntries, target.originalQuestion || "", {
					research,
				});
			const limit = pinLimitFor(research);
			if (match?.saved !== true && pinCountFor(research) >= limit) {
				setStatus(
					`Pin limit reached — unpin a pinned conversation to pin another (max ${limit}).`,
				);
				return;
			}
		}
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
		const jobId = normalizeDeletedResearchJobId(
			options?.researchJobId || "",
		);
		const keys = questions.map((q) => q.replace(/\s+/g, " ").trim()).filter(Boolean);
		if (!jobId && keys.length === 0) return;
		if (jobId) markResearchJobDeleted(jobId);
		const clearOpen =
			options?.clearOpenThread === true ||
			(jobId
				? turns.some((turn) => turn.researchJobId === jobId)
				: openThreadMatchesQuestions(keys));
		if (jobId) {
			sessionEntries = removeAskHistoryEntriesByJobIds(sessionEntries, [jobId]);
			// History delete now hard-deletes the job server-side, but also
			// DELETE the job doc directly so a failed history write cannot
			// leave a fetchable job that later rehydrates Recent.
			void fetch(researchJobApiPath(jobId), {
				method: "DELETE",
				credentials: "same-origin",
			}).catch(() => {
				/* history delete already covers the job doc */
			});
			// Drop same-browser attachment bytes with the report; anything
			// missed ages out via the store's entry/byte budget.
			void deleteResearchAttachments(jobId).catch(() => {
				/* attachment store is best-effort */
			});
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
					if (response.status === 403) {
						setStatus("Submitted reports cannot be deleted.");
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
						if (deletedResearchJobIds.size > 0) {
							sessionEntries = filterDeletedResearchJobs(
								sessionEntries,
								deletedResearchJobIds,
							);
						}
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

	function pinLimitFor(research: boolean): number {
		return research ? AI_RESEARCH_PIN_LIMIT : AI_ASK_PIN_LIMIT;
	}

	function pinCountFor(research: boolean): number {
		return pinnedAskHistoryEntries(
			askHistoryLaneEntries(sessionEntries, research),
		).length;
	}

	function toggleHistoryEntryPin(entry: AiAskSessionEntry): void {
		if (!signedInForHistory) {
			openQuotaDialog("save");
			return;
		}
		if (entry.saved !== true) {
			const research = isResearchHistoryEntry(entry);
			const limit = pinLimitFor(research);
			if (pinCountFor(research) >= limit) {
				setStatus(
					`Pin limit reached — unpin a pinned conversation to pin another (max ${limit}).`,
				);
				return;
			}
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
		let shareUrl: string;
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
					...(entry.researchJobId
						? { researchJobId: entry.researchJobId }
						: {}),
				}),
			});
			let data: {
				success?: boolean;
				path?: string;
				error?: string;
			} | null = null;
			try {
				data = (await response.json()) as {
					success?: boolean;
					path?: string;
					error?: string;
				};
			} catch (parseError) {
				console.warn("[ai/share] response parse failed", {
					status: response.status,
					research: entry.research === true || Boolean(entry.report),
					error:
						parseError instanceof Error ? parseError.message : parseError,
				});
				flashAskButtonFeedback(button, ASK_SHARE_FAILED_LABEL, "error", idle);
				return;
			}
			if (!response.ok || !data.success || !data.path) {
				console.warn("[ai/share] publish failed", {
					status: response.status,
					error: data?.error,
					research: entry.research === true || Boolean(entry.report),
				});
				flashAskButtonFeedback(
					button,
					data?.error || ASK_SHARE_FAILED_LABEL,
					"error",
					idle,
				);
				return;
			}
			shareUrl = new URL(data.path, window.location.origin).toString();
		} catch (error) {
			console.warn("[ai/share] publish request failed", {
				research: entry.research === true || Boolean(entry.report),
				error: error instanceof Error ? error.message : error,
			});
			flashAskButtonFeedback(button, ASK_SHARE_FAILED_LABEL, "error", idle);
			return;
		}
		const copied = await copyTextWithClipboardFallback(shareUrl);
		if (copied) {
			flashAskButtonFeedback(button, ASK_SHARE_COPIED_LABEL, "copied", idle);
		} else {
			console.warn("[ai/share] clipboard copy failed after publish", {
				research: entry.research === true || Boolean(entry.report),
			});
			flashAskButtonFeedback(
				button,
				ASK_SHARE_SAVED_COPY_FAILED_LABEL,
				"error",
				idle,
			);
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
			if (deletedResearchJobIds.size > 0) {
				sessionEntries = filterDeletedResearchJobs(
					sessionEntries,
					deletedResearchJobIds,
				);
			}
			writeAiAskSession(sessionEntries);
			// Asks that finished during the first sync stay local-only unless we merge again.
			const latestLocalRaw = readAiAskSession();
			const latestLocal =
				deletedResearchJobIds.size > 0
					? filterDeletedResearchJobs(latestLocalRaw, deletedResearchJobIds)
					: latestLocalRaw;
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
					if (deletedResearchJobIds.size > 0) {
						sessionEntries = filterDeletedResearchJobs(
							sessionEntries,
							deletedResearchJobIds,
						);
					}
					writeAiAskSession(sessionEntries);
				} else {
					sessionEntries = mergeAskHistoryEntries(
						latestLocal,
						sessionEntries,
					);
					if (deletedResearchJobIds.size > 0) {
						sessionEntries = filterDeletedResearchJobs(
							sessionEntries,
							deletedResearchJobIds,
						);
					}
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
		// Compact numbered rows; details surface via the shared citation popover.
		return aiSourceRowHtml(hit, research);
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

	function sourcingSearchTermsHtml(turn: AiAskTurn): string {
		const queries = dedupeSourcingSearchTerms(
			turn.queries,
			turn.fallbackQueries,
		);
		if (queries.length === 0) return "";
		return `<div class="ai-sourcing-terms">
			<span class="ai-sourcing-terms-label">${escapeHtml(SEARCH_TERMS_SOURCING_LABEL)}</span>
			${queryChipsHtml(queries, "ai-queries")}
		</div>`;
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

	function openAskDownload(turnIndex?: number): void {
		const scopedTurns =
			typeof turnIndex === "number" &&
			turnIndex >= 0 &&
			turnIndex < turns.length
				? [turns[turnIndex]]
				: turns;
		const exportTurns = askTurnsForExport(scopedTurns).filter(
			(turn) => turn.research === true,
		);
		if (exportTurns.length === 0) return;
		const sharePath = askExportSharePathFromTurns(
			typeof turnIndex === "number" &&
				turnIndex >= 0 &&
				turnIndex < turns.length
				? turns.slice(0, turnIndex + 1)
				: turns,
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
		const hasReport = Boolean((turn.report || "").trim());
		const finishedResearchReport = isFinishedResearchReportTurn({
			pending: turn.pending,
			error: turn.error,
			research: turn.research,
			hasReport,
		});
		const showSampleOnTurn = tip || finishedResearchReport;
		const flags = openAskTurnActionFlags({
			pending: turn.pending,
			error: turn.error,
			fromShare: turn.fromShare,
			fromSample: turn.fromSample,
			isTip: tip,
			research: turn.research,
			researchJobId: turn.researchJobId,
			resultCount: turn.results.length,
			hasReport,
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
		const publishedSample = publishedAskSampleForTurn(askSamples, turn, {
			researchPane: researchPaneOn(),
		});
		const sampleAction = askSampleAdminAction({
			canSave: Boolean(
				showSampleOnTurn &&
					canMarkAskAsSample({
						isAdmin: isAskAdmin,
						pending: turn.pending,
						error: turn.error,
						offTopic: turn.offTopic,
						resultCount: turn.results.length,
						fromShare: turn.fromShare,
						fromSample: turn.fromSample,
						research: turn.research,
						hasReport,
					}),
			),
			canRemove: Boolean(
				showSampleOnTurn &&
					canRemoveAskSample({
						isAdmin: isAskAdmin,
						pending: turn.pending,
						fromShare: turn.fromShare,
						hasSample: Boolean(publishedSample),
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

	/**
	 * Note appended to a copied report so pasted notes / images submitted with
	 * the question are not silently dropped from the pasted copy.
	 */
	function formatCopyAttachmentNote(turn: AiAskTurn): string {
		const parts: string[] = [];
		if (turn.contextAttachmentLabel) {
			const words =
				typeof turn.contextWordCount === "number" && turn.contextWordCount > 0
					? `, ${turn.contextWordCount.toLocaleString()} words`
					: "";
			parts.push(`${turn.contextAttachmentLabel}${words}`);
		}
		const images = turn.attachedImages?.length || turn.imageCount || 0;
		if (images > 0) {
			parts.push(
				`${images} image${images === 1 ? "" : "s"} attached to the original question`,
			);
		}
		if (parts.length === 0) return "";
		return `\n\n_Attached inputs (${parts.join("; ")}) are not part of the copied text — reopen the report to view them._`;
	}

	async function copyAskAnswer(
		turn: AiAskTurn,
		button: HTMLButtonElement,
	): Promise<void> {
		const kind = button.getAttribute("data-copy-kind") === "report"
			? "report"
			: "answer";
		const body =
			kind === "report"
				? displayedReportMarkdown(turn).trim()
				: formatAskAnswerCopyMarkdown({
						question: turn.question,
						summary: turn.summary || "",
						results: turn.results,
						origin:
							typeof window !== "undefined" ? window.location.origin : "",
					});
		if (!body) return;
		const text =
			kind === "report" ? `${body}${formatCopyAttachmentNote(turn)}` : body;
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
				const versionIndex = healedResearchVersionIndex({
					versionIndex: turn.versionIndex,
					processNotes: turn.processNotes,
					createdAt: turn.researchStartedAt,
				});
				const currentN = currentResearchVersionN(versionIndex);
				const previewN = previewVersion?.n;
				const sharePath = shareUrlWithVersion(
					turn.sharePath,
					previewN && previewN < currentN ? previewN : null,
				);
				const copied = await copyTextWithClipboardFallback(
					new URL(sharePath, window.location.origin).toString(),
				);
				if (copied) {
					flashAskButtonFeedback(button, ASK_SHARE_COPIED_LABEL, "copied", idle);
				} else {
					console.warn("[ai/share] clipboard copy failed for published link", {
						path: turn.sharePath,
					});
					flashAskButtonFeedback(
						button,
						ASK_CLIPBOARD_FAILED_LABEL,
						"error",
						idle,
					);
				}
			} catch (error) {
				console.warn("[ai/share] published link copy failed", {
					path: turn.sharePath,
					error: error instanceof Error ? error.message : error,
				});
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
		let shareUrl: string;
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
					...(turn.researchJobId ? { researchJobId: turn.researchJobId } : {}),
					...(turn.versionIndex && turn.versionIndex.length > 0
						? { versionIndex: turn.versionIndex }
						: {}),
					...(typeof turn.rerankCandidateCount === "number" &&
					turn.rerankCandidateCount > 0
						? { candidateCount: turn.rerankCandidateCount }
						: {}),
					...(thread.length > 1 ? { thread } : {}),
				}),
			});
			let data: {
				success?: boolean;
				path?: string;
				slug?: string;
				error?: string;
			} | null = null;
			try {
				data = (await response.json()) as {
					success?: boolean;
					path?: string;
					slug?: string;
					error?: string;
				};
			} catch (parseError) {
				console.warn("[ai/share] response parse failed", {
					status: response.status,
					research: turn.research === true || Boolean(turn.report),
					error:
						parseError instanceof Error ? parseError.message : parseError,
				});
				flashAskButtonFeedback(button, ASK_SHARE_FAILED_LABEL, "error", idle);
				return;
			}
			if (!response.ok || !data.success || !data.path) {
				console.warn("[ai/share] publish failed", {
					status: response.status,
					error: data?.error,
					research: turn.research === true || Boolean(turn.report),
				});
				flashAskButtonFeedback(
					button,
					data?.error || ASK_SHARE_FAILED_LABEL,
					"error",
					idle,
				);
				return;
			}
			turn.shareSlug = data.slug || turn.shareSlug;
			turn.sharePath = data.path;
			const versionIndex = healedResearchVersionIndex({
				versionIndex: turn.versionIndex,
				processNotes: turn.processNotes,
				createdAt: turn.researchStartedAt,
			});
			const currentN = currentResearchVersionN(versionIndex);
			const previewN = previewVersion?.n;
			const sharePath = shareUrlWithVersion(
				data.path,
				previewN && previewN < currentN ? previewN : null,
			);
			shareUrl = new URL(sharePath, window.location.origin).toString();
			persistSessionFromTurn(turn);
		} catch (error) {
			console.warn("[ai/share] publish request failed", {
				research: turn.research === true || Boolean(turn.report),
				error: error instanceof Error ? error.message : error,
			});
			flashAskButtonFeedback(button, ASK_SHARE_FAILED_LABEL, "error", idle);
			return;
		}
		const copied = await copyTextWithClipboardFallback(shareUrl);
		if (copied) {
			flashAskButtonFeedback(button, ASK_SHARE_COPIED_LABEL, "copied", idle);
		} else {
			console.warn("[ai/share] clipboard copy failed after publish", {
				path: turn.sharePath,
			});
			flashAskButtonFeedback(
				button,
				ASK_SHARE_SAVED_COPY_FAILED_LABEL,
				"error",
				idle,
			);
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

	function renderClarifyCardHtml(
		turn: AiAskTurn,
		turnIndex: number,
		kind: "research" | "revise" = "research",
	): string {
		const draft = kind === "revise" ? turn.reviseClarify : turn.researchClarify;
		if (!draft) return "";
		const kindAttr = ` data-clarify-kind="${kind}"`;
		const questions = draft.questions
			.map((question, qIndex) => {
				const selected = draft.answers[question.id]?.choiceId || "";
				const otherText = draft.answers[question.id]?.otherText || "";
				const chips = question.choices
					.map((choice) => {
						const on = selected === choice.id;
						const block = choice.blockId
							? ` data-block-id="${escapeHtml(choice.blockId)}" title="Show this block in the report"`
							: "";
						return `<button type="button" class="ai-clarify-choice${on ? " is-on" : ""}${choice.blockId ? " has-block" : ""}" data-ai-clarify-choice${kindAttr} data-turn-index="${turnIndex}" data-question-id="${escapeHtml(question.id)}" data-choice-id="${escapeHtml(choice.id)}"${block} role="radio" aria-checked="${on ? "true" : "false"}">${escapeHtml(choice.label)}</button>`;
					})
					.join("");
				const otherField =
					selected === RESEARCH_CLARIFY_OTHER_ID
						? `<textarea class="ai-clarify-other" data-ai-clarify-other${kindAttr} data-turn-index="${turnIndex}" data-question-id="${escapeHtml(question.id)}" rows="2" maxlength="${RESEARCH_CLARIFY_MAX_OTHER}" placeholder="Add a short note">${escapeHtml(otherText)}</textarea>`
						: "";
				return `<div class="ai-clarify-q" role="radiogroup" aria-label="${escapeHtml(question.prompt)}">
					<p class="ai-clarify-prompt">${qIndex + 1}. ${escapeHtml(question.prompt)}</p>
					<div class="ai-clarify-choices">${chips}</div>
					${otherField}
				</div>`;
			})
			.join("");
		if (kind === "revise") {
			const revise = turn.reviseClarify;
			const base = researchReviseClarifyBaseLabel(revise?.fromVersion);
			const reading = (revise?.interpretation || "").trim();
			return `<div class="ai-clarify ai-clarify-revise" data-ai-revise-clarify>
			<p class="ai-clarify-title">${escapeHtml(RESEARCH_REVISE_CLARIFY_TITLE)}${
				base ? ` <span class="ai-clarify-base">${escapeHtml(base)}</span>` : ""
			}</p>
			${reading ? `<p class="ai-clarify-kicker">${escapeHtml(reading)}</p>` : ""}
			${questions}
		</div>`;
		}
		const confirmOnly = draft.questions.length === 0;
		const title = confirmOnly
			? RESEARCH_CLARIFY_CONFIRM_TITLE
			: RESEARCH_CLARIFY_TITLE;
		const reading =
			(draft.interpretation || "").trim() ||
			(confirmOnly ? RESEARCH_CLARIFY_CONFIRM_FALLBACK : "");
		const readingHtml = reading
			? `<p class="ai-clarify-kicker">${escapeHtml(reading)}</p>`
			: "";
		return `<div class="ai-clarify">
			<p class="ai-clarify-title">${escapeHtml(title)}</p>
			${readingHtml}
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
		const reportText = displayedReportMarkdown(turn).trim();
		const hasHits = turn.results.length > 0;
		const summary = reportText
			? (() => {
					const versionIndex = healedResearchVersionIndex({
						versionIndex: turn.versionIndex,
						processNotes: isReviseInProgress(turn) ? [] : turn.processNotes,
						createdAt: turn.researchStartedAt,
					});
					const versionLabel = formatResearchVersionLabelForTurn(versionIndex, {
						previewN: previewVersion?.n,
						revising: isReviseInProgress(turn),
					});
					return wrapAskAnswerHtml({
					kind: "report",
					turnIndex,
					versionStart: `<button type="button" class="ai-versions-btn" data-ai-versions data-turn-index="${turnIndex}" aria-label="${escapeHtml(
						`${versionLabel} · ${RESEARCH_VERSIONS_ACTION}`,
					)}">${escapeHtml(versionLabel)}</button>`,
					stats: escapeHtml(
						researchHistoryStatsLabel(reportText, turn.results),
					),
					bodyHtml: renderResearchReportHtml(reportText, turn.results, {
						citationPopovers: true,
					}),
				});
				})()
			: hasHits && summaryText
				? wrapAskAnswerHtml({
						kind: "answer",
						turnIndex,
						bodyHtml: annotateResearchCitationLinks(
							renderAskBriefingHtml(summaryText, turn.results),
							turn.results,
						),
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
		const queryBlock = hideQueryChips ? "" : sourcingSearchTermsHtml(turn);
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
			// refusal stall is still inspectable after the error lands. When a
			// revise fails, keep the current report visible under the error.
			const reportAfterError =
				reportText && turn.research ? summary : "";
			body = `${process}<p class="ai-error">${escapeHtml(turn.error)}</p>${reportAfterError}${retry}${shareActionsHtml(turn, turnIndex)}`;
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
						? `<ol class="ai-hits ai-sources-list">${hitCards}</ol>`
						: personBlock
							? ""
							: emptyHitsHtml(turn);
			// A paused revision asks its questions right under the progress
			// strip; the report below stays readable so the reader can check
			// the blocks the choices point at.
			const reviseClarify = isReviseClarifyingTurn(turn)
				? renderClarifyCardHtml(turn, turnIndex, "revise")
				: "";
			body = `${cacheNote}${process}${reviseClarify}${summary}${queryBlock}${personBlock}${hits}${shareActionsHtml(turn, turnIndex)}${feedbackHtml(turn, turnIndex)}`;
		}
		const backLabel = shareMode
			? turn.research
				? "Try Research"
				: "Ask your own question"
			: "Back to earlier questions";
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
					${renderQuestionAttachmentsHtml(turn)}
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
			? researchHistoryCardStatsLabel({
					report: entry.report,
					results: entry.results,
					reportStats: entry.reportStats,
					versionIndex: entry.versionIndex,
				})
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
		const attachmentImages =
			typeof entry.imageCount === "number" && entry.imageCount > 0
			? `${entry.imageCount} image${entry.imageCount === 1 ? "" : "s"}`
			: entry.attachedImages?.length
				? `${entry.attachedImages.length} image${entry.attachedImages.length === 1 ? "" : "s"}`
				: "";
		const attachmentText = [
			entry.contextAttachmentLabel || "",
			attachmentImages,
		]
			.filter(Boolean)
			.join(" · ");
		const attachmentRow =
			!sample && attachmentText
				? `<span class="ai-history-attachments">${escapeHtml(attachmentText)}</span>`
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
							${attachmentRow}
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
		const reviseClarifying = !clarifying && isReviseClarifyingTurn(last);
		const declinedOpen =
			Boolean(last?.researchDeclined) && !last?.researchJobId;
		const researchBusy = turns.some(
			(turn) => turn.pending && turn.research && turn.researchJobId,
		);
		const reviseBusy = turns.some((turn) => isReviseInProgress(turn));
		const chrome = researchReportFollowChrome({
			research: Boolean(last?.research),
			pending: Boolean(last?.pending),
			hasReport: Boolean((last?.report || "").trim()),
			clarifying,
			declinedOpen,
		});
		root.classList.toggle("is-research-busy", researchBusy);
		root.classList.toggle("is-revise-busy", reviseBusy);
		if (followForm) {
			followForm.classList.toggle("is-research-busy", researchBusy);
			followForm.classList.toggle("is-revise-busy", reviseBusy);
		}
		root.classList.toggle(
			"is-report-dock",
			chrome.reportDock || askSampleFollowDock(turns),
		);
		syncStopButtons(researchBusy || reviseBusy, reviseBusy);
		const threadPending = turns.some((turn) => turn.pending);
		if (followInput) followInput.disabled = threadPending;
		followForm
			?.querySelectorAll<HTMLButtonElement>("[data-ai-mic]")
			.forEach((button) => {
				button.disabled = threadPending;
			});
		syncResearchChip();
		const restoring = root.classList.contains("is-restoring-research");
		if (historyEl) {
			if (hasThread || restoring || shareMode) {
				historyEl.hidden = true;
			} else if (historyEl.hidden) {
				renderHistory();
			}
		}
		const homeHistoryVisible = Boolean(historyEl && !historyEl.hidden);
		root.classList.toggle("has-home-lane", homeHistoryVisible);
		// Collapse the flex spacer when Recent/Pinned is showing — it was
		// pushing the history list halfway down the viewport.
		empty.hidden = hasThread || shareMode || restoring || homeHistoryVisible;
		composer.hidden = hasThread || shareMode || restoring;
		if (followForm) {
			const finishedReport = Boolean(lastFinishedReportTurn());
			followForm.hidden =
				(!shareMode && (!hasThread || clarifying || declinedOpen)) ||
				(shareMode && !finishedReport) ||
				clarifying ||
				reviseClarifying ||
				declinedOpen;
		}
		syncClarifyBar();
		root.classList.toggle(
			"is-clarify-bar-open",
			Boolean(clarifyBar && !clarifyBar.hidden),
		);
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
					window.location.assign(
						turns.some((item) => item.research)
							? RESEARCH_HOME_HREF
							: ASK_HOME_HREF,
					);
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
				const index = Number(button.getAttribute("data-turn-index"));
				openAskDownload(
					Number.isFinite(index) && index >= 0 ? index : undefined,
				);
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
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					const index = Number(button.getAttribute("data-turn-index"));
					const questionId = button.getAttribute("data-question-id") || "";
					const choiceId = button.getAttribute("data-choice-id") || "";
					const kind = button.getAttribute("data-clarify-kind");
					const turn = turns[index];
					const draft = clarifyDraftFor(turn, kind);
					if (!draft || !questionId || !choiceId) return;
					draft.answers = {
						...draft.answers,
						[questionId]: {
							choiceId,
							...(choiceId === RESEARCH_CLARIFY_OTHER_ID
								? { otherText: draft.answers[questionId]?.otherText || "" }
								: {}),
						},
					};
					patchClarifyChoiceUi(index, kind, questionId);
					if (choiceId === RESEARCH_CLARIFY_OTHER_ID) {
						const other = thread.querySelector<HTMLTextAreaElement>(
							`[data-ai-clarify-other][data-turn-index="${index}"][data-question-id="${questionId}"]`,
						);
						other?.focus();
					}
				});
				button.addEventListener("dblclick", (event) => {
					event.preventDefault();
					event.stopPropagation();
					const blockId = button.getAttribute("data-block-id") || "";
					if (blockId) revealReportBlock(blockId);
				});
			},
		);
		thread.querySelectorAll<HTMLTextAreaElement>("[data-ai-clarify-other]").forEach(
			(inputEl) => {
				bindClarifyOtherInput(inputEl);
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
		if (last?.pending && !reviseClarifying) {
			scrollAskProcessToLatest(
				thread.querySelector(".ai-turn:last-child .ai-process"),
				{ focus: true },
			);
		}
		bindQuestionExpand();
		const lastTurn = turns[turns.length - 1];
		if (lastTurn) {
			bindReportRevise(lastTurn, turns.length - 1);
			if (!isReviseInProgress(lastTurn)) applyReportChangeMarks(lastTurn);
			if (!reviseClarifying) {
				scrollAskProcessToLatest(
					thread.querySelector(".ai-turn:last-child .ai-process"),
				);
			}
			if (!hydratingReviseBase && shouldHydrateReviseBase(lastTurn)) {
				void hydrateReviseBaseIfNeeded(lastTurn);
			}
		}
		syncReportToc();
		if (!shareMode) renderHistory();
		syncFollowComposerMode();
		scheduleFollowDockFrost();
		void hydrateResearchReportMermaid(thread).then(() => {
			stampReviseReportBlockIds(lastTurn);
		});
	}

	let followDockFrostRaf = 0;
	let followDockHome: { parent: HTMLElement; next: ChildNode | null } | null =
		null;

	function syncFollowDockMount(): void {
		if (!followForm) return;
		const dock = root.classList.contains("is-report-dock") && !followForm.hidden;
		followForm.classList.toggle("is-dock", dock);
		if (dock) {
			if (followForm.parentElement !== document.body) {
				if (!followDockHome) {
					followDockHome = {
						parent: followForm.parentElement ?? root,
						next: followForm.nextSibling,
					};
				}
				document.body.appendChild(followForm);
			}
			return;
		}
		if (followForm.parentElement === document.body && followDockHome) {
			followDockHome.parent.insertBefore(followForm, followDockHome.next);
		}
		followDockHome = null;
	}

	function pinReportFollowToColumn(): void {
		if (!followForm) return;
		if (!followForm.classList.contains("is-dock")) {
			followForm.style.removeProperty("position");
			followForm.style.removeProperty("left");
			followForm.style.removeProperty("width");
			followForm.style.removeProperty("right");
			followForm.style.removeProperty("margin-inline");
			followForm.style.removeProperty("bottom");
			document.documentElement.style.removeProperty(
				"--ai-follow-dock-translate",
			);
			return;
		}
		const column = thread.getBoundingClientRect();
		const mobileCompact = isMobileReportDockCompact(
			followForm.classList.contains("is-follow-compact"),
			window.innerWidth,
		);
		const mobileExpanded = isMobileReportDockExpanded(
			followForm.classList.contains("is-follow-expanded"),
			window.innerWidth,
		);
		const rect = reportFollowDockRect({
			columnLeft: column.left,
			columnWidth: column.width,
			visualViewport: window.visualViewport,
			mobileCompact,
			mobileExpanded,
			rootFontSize:
				Number.parseFloat(
					getComputedStyle(document.documentElement).fontSize,
				) || 16,
		});
		followForm.style.position = "fixed";
		followForm.style.left = `${rect.left}px`;
		followForm.style.width = `${rect.width}px`;
		followForm.style.right = "auto";
		followForm.style.marginInline = "0";
		followForm.style.bottom = "0";
		document.documentElement.style.setProperty("--ai-follow-dock-translate", "0px");
		void followForm.offsetHeight;
		const vv = window.visualViewport;
		if (vv) {
			const translateY = followDockVisualTranslateY({
				elementBottom: followForm.getBoundingClientRect().bottom,
				visualViewport: vv,
			});
			document.documentElement.style.setProperty(
				"--ai-follow-dock-translate",
				`${translateY}px`,
			);
		}
	}

	function fitExpandedFollowComposerFields(): void {
		if (!followForm?.classList.contains("is-follow-expanded")) return;
		preserveFollowComposerScroll(() => {
			if (followInput) fitTextarea(followInput);
			reviseStackEl
				?.querySelectorAll<HTMLTextAreaElement>(".ai-revise-row-instruction")
				.forEach((instruction) => fitTextarea(instruction));
		});
	}

	function syncFollowComposerMode(): void {
		const dock = Boolean(
			root.classList.contains("is-report-dock") &&
				followForm &&
				!followForm.hidden,
		);
		const active = document.activeElement;
		const focused = Boolean(
			dock &&
				followForm &&
				active instanceof Element &&
				followForm.contains(active) &&
				followComposerFocusShouldExpand(active),
		);
		const draft = reviseDraftFromComposer();
		const expanded = Boolean(
			dock &&
				!followComposerHoldCompact &&
				followComposerShouldExpand({
					focused,
					pinnedOpen: followComposerPinnedOpen,
				}),
		);
		if (dock && !expanded && !focused) {
			followComposerPinnedOpen = false;
		}
		root.classList.toggle("is-follow-expanded", expanded);
		followForm?.classList.toggle("is-follow-expanded", expanded);
		followForm?.classList.toggle("is-follow-compact", dock && !expanded);
		document.documentElement.classList.toggle(
			"is-report-dock",
			Boolean(root.classList.contains("is-report-dock")),
		);
		document.documentElement.classList.toggle(
			"is-report-dock-compact",
			Boolean(dock && followForm?.classList.contains("is-follow-compact")),
		);
		if (dock) {
			pinReportFollowToColumn();
			void followForm?.offsetWidth;
			lastFollowDockPinWidth = followForm?.getBoundingClientRect().width ?? 0;
		}
		syncFollowInputMaxLength();
		if (followInput) {
			followInput.rows = dock && !expanded ? 1 : 2;
			if (followInput && reviseFollowActive() && dock) {
				if (!expanded) {
					reviseEditDraft = reviseDraftFromComposer();
					if (followInput.value !== "") {
						followInput.value = "";
						followInput.style.height = "";
					}
				} else if (
					!followInput.value &&
					(reviseEditDraft.draftInstruction || "").length > 0
				) {
					followInput.value = reviseEditDraft.draftInstruction;
				}
			}
			if (dock && !expanded) followInput.style.height = "";
		}
		if (expanded) fitExpandedFollowComposerFields();
		if (followInput && reviseFollowActive()) {
			const showMultiHint = shouldShowReviseMultiHint(draft);
			followInput.placeholder =
				dock && !expanded
					? reviseCompactDockPlaceholder(draft)
					: reviseExpandedPlaceholder(draft, showMultiHint);
			if (showMultiHint && dock && expanded) {
				markReviseMultiHintSeen();
			}
		}
		const followSend = followForm?.querySelector<HTMLButtonElement>(".ai-send");
		if (followSend) {
			const stopBusy =
				root.classList.contains("is-research-busy") ||
				root.classList.contains("is-revise-busy");
			if (stopBusy) {
				followSend.disabled = false;
			} else if (followSendStatusBlocked()) {
				followSend.disabled = true;
			} else if (reviseFollowActive()) {
				followSend.disabled = !canSubmitReviseEdits(
					buildSubmittableReviseEdits(reviseDraftFromComposer()),
				);
			}
		}
		syncCompositionImageAttachButtons();
		syncStatusPresentation();
		flushDeferredStatus();
		const justExpandedMobile =
			expanded &&
			!wasFollowDockExpanded &&
			window.innerWidth <= MOBILE_REPORT_DOCK_BREAKPOINT_PX;
		if (
			justExpandedMobile &&
			compositionContextTextarea === followInput &&
			compositionContexts.length > 0
		) {
			pendingCompositionChipRelayout = true;
		}
		wasFollowDockExpanded = expanded;
		scheduleFollowDockFrost();
	}

	function followDockOverlapsThread(): boolean {
		if (!followForm || followForm.hidden) return false;
		if (root.classList.contains("is-report-dock")) return true;
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
		preserveFollowComposerScroll(() => {
			syncFollowDockMount();
			pinReportFollowToColumn();
			followForm?.classList.toggle("is-over-thread", followDockOverlapsThread());
			const pinWidth = followForm?.getBoundingClientRect().width ?? 0;
			if (Math.abs(pinWidth - lastFollowDockPinWidth) > 6) {
				lastFollowDockPinWidth = pinWidth;
				fitExpandedFollowComposerFields();
			}
			scheduleCompositionChipSyncAfterDockPin();
		});
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
			<textarea id="ai-edit-question" data-ai-edit-input rows="2" maxlength="${MAX_QUESTION_CHARS}"></textarea>
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

		// Research re-send working set for this edit box. Seeded from the
		// pending submit snapshot, the live turn, the history row, then the
		// same-browser store — first source with data wins per kind. Anything
		// unrecoverable is shown as a dismissible info label only.
		const editState = {
			clips: [] as string[],
			images: [] as ResearchContextImage[],
			touched: false,
		};
		const dismissedEditInfo = new Set<"notes" | "images">();
		const rememberedEditEntry =
			turn.research === true &&
			typeof turn.researchJobId === "string" &&
			turn.researchJobId.trim()
				? sessionEntries.find(
						(item) => item.researchJobId === turn.researchJobId,
					)
				: undefined;
		const originalEditNotesLabel =
			turn.contextAttachmentLabel ||
			rememberedEditEntry?.contextAttachmentLabel ||
			"";
		const originalEditImageCount =
			turn.attachedImages?.length ||
			turn.imageCount ||
			rememberedEditEntry?.attachedImages?.length ||
			rememberedEditEntry?.imageCount ||
			0;

		async function seedEditAttachments(): Promise<void> {
			let clips = [...(pendingResearchSubmitContexts || [])];
			let images = sanitizeResearchContextImages(
				pendingResearchSubmitImages || turn.attachedImages || [],
			);
			if (images.length === 0 && rememberedEditEntry?.attachedImages?.length) {
				images = sanitizeResearchContextImages(
					rememberedEditEntry.attachedImages,
				);
			}
			const jobId = (turn.researchJobId || "").trim();
			if ((clips.length === 0 || images.length === 0) && jobId) {
				try {
					const stored = await loadResearchAttachments(jobId);
					if (stored) {
						if (clips.length === 0 && stored.contextFull.trim()) {
							clips = [stored.contextFull];
						}
						if (images.length === 0 && stored.images.length > 0) {
							images = [...stored.images];
						}
					}
				} catch {
					/* attachment store is best-effort */
				}
			}
			// Never overwrite attachments the reader already added/removed.
			if (!editState.touched) {
				editState.clips = clips;
				editState.images = images;
			}
		}

		const editSeedPromise = researchEdit
			? seedEditAttachments()
			: Promise.resolve();

		const attachWrap = document.createElement("div");
		attachWrap.className = "ai-question-edit-attachments";
		attachWrap.hidden = true;

		function renderEditAttachments(): void {
			if (!researchEdit || !wrap.isConnected) return;
			attachWrap.replaceChildren();
			for (const [index, clip] of editState.clips.entries()) {
				const chip = document.createElement("span");
				chip.className =
					"ai-question-attachment ai-question-attachment-notes";
				chip.textContent = formatContextChipLabel(clip);
				chip.title = researchContextPreview(clip);
				const remove = document.createElement("button");
				remove.type = "button";
				remove.className = "ai-composition-clear";
				remove.setAttribute("aria-label", "Remove attached notes");
				remove.title = "Remove attached notes";
				remove.textContent = "×";
				remove.addEventListener("click", () => {
					editState.clips = editState.clips.filter((_, i) => i !== index);
					editState.touched = true;
					renderEditAttachments();
				});
				chip.appendChild(remove);
				attachWrap.appendChild(chip);
			}
			if (
				editState.clips.length === 0 &&
				!dismissedEditInfo.has("notes") &&
				originalEditNotesLabel.trim()
			) {
				const info = document.createElement("span");
				info.className =
					"ai-question-attachment ai-question-attachment-notes is-unavailable";
				info.textContent = originalEditNotesLabel;
				info.title =
					"Originally attached — full text unavailable in this browser. Paste again to include it.";
				const dismiss = document.createElement("button");
				dismiss.type = "button";
				dismiss.className = "ai-composition-clear";
				dismiss.setAttribute("aria-label", "Dismiss");
				dismiss.title = "Dismiss";
				dismiss.textContent = "×";
				dismiss.addEventListener("click", () => {
					dismissedEditInfo.add("notes");
					editState.touched = true;
					renderEditAttachments();
				});
				info.appendChild(dismiss);
				attachWrap.appendChild(info);
			}
			for (const [index, image] of editState.images.entries()) {
				const holder = document.createElement("span");
				holder.className = "ai-question-edit-image";
				const preview = document.createElement("button");
				preview.type = "button";
				preview.className = "ai-question-image";
				preview.setAttribute("aria-label", `View attached image ${index + 1}`);
				preview.title = `View attached image ${index + 1}`;
				const img = document.createElement("img");
				img.src = researchContextImageDataUrl(image);
				img.alt = `Attached image ${index + 1}`;
				img.draggable = false;
				preview.appendChild(img);
				preview.addEventListener("click", () => {
					openResearchImageOverlay(image, {
						filename: researchContextImageFilename(image, index),
						alt: `Attached image ${index + 1}`,
					});
				});
				const remove = document.createElement("button");
				remove.type = "button";
				remove.className = "ai-composition-clear";
				remove.setAttribute("aria-label", "Remove image");
				remove.title = "Remove image";
				remove.textContent = "×";
				remove.addEventListener("click", () => {
					editState.images = editState.images.filter((_, i) => i !== index);
					editState.touched = true;
					renderEditAttachments();
				});
				holder.append(preview, remove);
				attachWrap.appendChild(holder);
			}
			if (
				editState.images.length === 0 &&
				!dismissedEditInfo.has("images") &&
				originalEditImageCount > 0
			) {
				const info = document.createElement("span");
				info.className =
					"ai-question-attachment ai-question-attachment-images is-unavailable";
				info.textContent =
					originalEditImageCount === 1
						? "1 image"
						: `${originalEditImageCount} images`;
				info.title =
					"Originally attached — files unavailable in this browser. Attach again to include them.";
				const dismiss = document.createElement("button");
				dismiss.type = "button";
				dismiss.className = "ai-composition-clear";
				dismiss.setAttribute("aria-label", "Dismiss");
				dismiss.title = "Dismiss";
				dismiss.textContent = "×";
				dismiss.addEventListener("click", () => {
					dismissedEditInfo.add("images");
					editState.touched = true;
					renderEditAttachments();
				});
				info.appendChild(dismiss);
				attachWrap.appendChild(info);
			}
			const attachButton = document.createElement("button");
			attachButton.type = "button";
			attachButton.className = "ai-question-edit-attach";
			attachButton.textContent = "Attach image";
			attachButton.setAttribute("aria-label", "Attach image");
			const fileInput = document.createElement("input");
			fileInput.type = "file";
			fileInput.accept = COMPOSITION_IMAGE_ACCEPT;
			fileInput.multiple = true;
			fileInput.hidden = true;
			attachButton.addEventListener("click", () => fileInput.click());
			fileInput.addEventListener("change", () => {
				const files = fileInput.files ? [...fileInput.files] : [];
				fileInput.value = "";
				void addEditImageFiles(files);
			});
			attachWrap.append(attachButton, fileInput);
			attachWrap.hidden = false;
		}

		async function addEditImageFiles(files: readonly File[]): Promise<void> {
			const room = MAX_RESEARCH_CONTEXT_IMAGES - editState.images.length;
			if (room <= 0) {
				setStatus(RESEARCH_COMPOSITION_MAX_IMAGES_MSG);
				return;
			}
			let added = 0;
			for (const file of files.slice(0, room)) {
				if (editState.images.length >= MAX_RESEARCH_CONTEXT_IMAGES) break;
				if (!isCompositionImageFile(file)) {
					setStatus(RESEARCH_COMPOSITION_UNSUPPORTED_IMAGE_MSG);
					continue;
				}
				const image = await resizeCompositionImage(
					normalizeCompositionImageFile(file),
				);
				if (!image) {
					setStatus(RESEARCH_COMPOSITION_IMAGE_TOO_LARGE_MSG);
					continue;
				}
				if (
					wouldExceedCompositionImageTotalBytes(
						editState.images,
						researchContextImageByteLength(image),
					)
				) {
					setStatus(RESEARCH_COMPOSITION_IMAGES_TOTAL_FULL_MSG);
					break;
				}
				editState.images = [...editState.images, image];
				added += 1;
			}
			if (added > 0) {
				editState.touched = true;
				renderEditAttachments();
			}
		}

		async function resolveEditAttachments(): Promise<{
			context: string;
			images: ResearchContextImage[];
			touched: boolean;
		}> {
			if (!researchEdit) return { context: "", images: [], touched: false };
			try {
				await editSeedPromise;
			} catch {
				/* seed is best-effort */
			}
			return {
				context: mergeCompositionContexts(editState.clips),
				images: [...editState.images],
				touched: editState.touched,
			};
		}

		if (researchEdit) {
			wrap.prepend(attachWrap);
			renderEditAttachments();
			void editSeedPromise.then(() => {
				renderEditAttachments();
			});
			editInput.addEventListener("paste", (event) => {
				if (!(event instanceof ClipboardEvent)) return;
				const imageFiles = clipboardImageFiles(event);
				if (imageFiles.length > 0) {
					event.preventDefault();
					void addEditImageFiles(imageFiles);
					return;
				}
				const text = event.clipboardData?.getData("text/plain") || "";
				if (!text) return;
				const start = editInput.selectionStart ?? editInput.value.length;
				const end = editInput.selectionEnd ?? start;
				if (
					!shouldAttachPasteAsCompositionContext(text, {
						composerTextLength: editInput.value.length,
						selectionLength: Math.max(0, end - start),
						maxQuestionChars: MAX_QUESTION_CHARS,
					})
				) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				const clipped = clipResearchContext(text);
				if (!clipped.trim()) {
					setStatus(RESEARCH_COMPOSITION_CONTEXT_TOO_LARGE_MSG);
					return;
				}
				editState.clips = [...editState.clips, clipped];
				editState.touched = true;
				if (contextWasClipped(text, clipped)) {
					setStatus(RESEARCH_COMPOSITION_CONTEXT_TRIM_MSG);
				}
				renderEditAttachments();
			});
			wrap.addEventListener("drop", (event) => {
				if (!(event instanceof DragEvent)) return;
				const dt = event.dataTransfer;
				if (!dt) return;
				const images = compositionDroppedImageFiles(dt);
				if (images.length === 0) return;
				event.preventDefault();
				event.stopPropagation();
				void addEditImageFiles(images);
			});
		}

		const cancel = (): void => {
			syncLayout();
		};
		const editedQuestion = (): string => clipAiQuestion(editInput.value);
		const submitResearch = (): void => {
			const next = editedQuestion();
			if (!next || busy) return;
			void (async () => {
				const explicit = await resolveEditAttachments();
				if (isIncompleteResearchTurn(turn)) {
					void retryIncompleteResearchTurn(turnIndex, next, explicit);
					return;
				}
				setResearchChipOn(true);
				void ask(next, null, {
					replaceTurnIndex: turnIndex,
					forceResearch: true,
					attachments: {
						context: explicit.context,
						images: explicit.images,
					},
				});
			})();
		};
		const submitAsk = (): void => {
			const next = editedQuestion();
			if (!next || busy) return;
			void (async () => {
				const explicit = await resolveEditAttachments();
				setResearchChipOn(false);
				void ask(next, null, {
					replaceTurnIndex: turnIndex,
					forceAsk: true,
					attachments: {
						context: explicit.context,
						images: explicit.images,
					},
				});
			})();
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

	function syncStopButtons(
		stopBusy: boolean,
		reviseBusy = false,
	): void {
		const sendHint = askSendShortcutLabel();
		allSendButtons().forEach((button) => {
			if (stopBusy) {
				button.type = "button";
				button.setAttribute("data-ai-stop", "1");
				const stopLabel = reviseBusy ? "Stop revision" : "Pause research";
				button.setAttribute("aria-label", stopLabel);
				button.title = stopLabel;
			} else {
				button.type = "submit";
				button.removeAttribute("data-ai-stop");
				button.setAttribute(
					"aria-label",
					button.closest("[data-ai-follow-form]")
						? reviseFollowActive()
							? "Revise report"
							: "Ask follow-up"
						: researchPaneOn()
							? "Research"
							: "Ask",
				);
				button.title = sendHint;
			}
		});
	}

	async function refreshResearchJobVersionIndex(jobId: string): Promise<void> {
		const id = (jobId || "").trim();
		if (!id) return;
		const data = await fetchResearchJob(id);
		if (!data.ok || !data.job) return;
		let changed = false;
		const turn = turns.find((item) => item.researchJobId === id);
		if (turn && mergeResearchJobVersionMetadata(turn, data.job)) {
			changed = true;
			if (!turn.pending && !turn.error) persistSessionFromTurn(turn);
		}
		const prior = sessionEntries.find((item) => item.researchJobId === id);
		if (prior) {
			const entry = { ...prior };
			if (mergeResearchJobVersionMetadata(entry, data.job)) {
				sessionEntries = upsertAiAskSessionEntry(sessionEntries, entry);
				writeAiAskSession(sessionEntries);
				changed = true;
			}
		}
		if (changed) syncLayout();
	}

	async function fetchResearchJob(
		jobId: string,
	): Promise<{
		ok: boolean;
		status: number;
		job?: ResearchJobPublic;
		error?: string;
		code?: string;
	}> {
		try {
			const { response, data } = await fetchAiJson<{
				job?: ResearchJobPublic;
				error?: string;
				code?: string;
				researchQuota?: ResearchQuotaView;
			}>(researchJobApiPath(jobId));
			if (data.researchQuota) applyQuota(quota, data.researchQuota);
			return {
				ok: response.ok,
				status: response.status,
				job: data.job,
				error: data.error,
				code: data.code,
			};
		} catch (error) {
			if (isAiTimeoutError(error)) {
				return {
					ok: false,
					status: 0,
					code: "timeout",
					error: AI_SERVER_TIMEOUT_MESSAGE,
				};
			}
			return {
				ok: false,
				status: 0,
				code: "route_miss",
				error: researchApiFailureMessage({ status: 0, code: "route_miss" }),
			};
		}
	}

	async function pollResearchTurn(turn: AiAskTurn): Promise<void> {
		const token = researchPollToken;
		if (!turn.researchJobId) return;
		const pollStartedAt = Date.now();
		let stallKey = "";
		let stallSince = Date.now();
		// Remember the body the reader was revising from — not necessarily head.
		const reviseBase =
			revisePendingSource?.report ||
			(turn.research ? (turn.report || "").trim() : "");
		const reviseBaseN = revisePendingSource?.n ?? null;
		while (turn.pending && turn.researchJobId && token === researchPollToken) {
			const still = await waitForResearchPollWindow(
				researchPollDelayMs(Date.now() - pollStartedAt),
				token,
			);
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
					turn.error = researchApiFailureMessage({
						status: data.status,
						code: data.code,
						error: data.error,
						fallback: "Could not load research.",
					});
					break;
				}
				if (token !== researchPollToken) return;
				if (researchJobWouldReviveAfterLocalCancel(turn, data.job)) {
					continue;
				}
				const key = `${data.job.status}\0${data.job.progressNote || ""}\0${(data.job.processNotes || []).join("|")}`;
				if (key !== stallKey) {
					stallKey = key;
					stallSince = Date.now();
				}
				applyResearchJobToTurn(turn, data.job);
				if (data.job.pending && data.job.reviseClarify) {
					// The planner paused on its questions. Stop polling — nothing
					// moves until the reader answers — and bring the card up.
					// The turn stays pending so the revise chrome (Stop, the
					// “v11” label, the pinned base body) holds.
					syncLayout();
					revealReviseClarifyCard();
					return;
				}
				if (
					!data.job.pending &&
					data.job.error &&
					(turn.report || "").trim()
				) {
					setStatus(data.job.error);
				}
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
					scrollAskProcessToLatest(
						thread.querySelector(".ai-turn:last-child .ai-process"),
					);
					continue;
				}
				settleReviseVersionState(turn);
				closeVersionsDrawer();
				if (!turn.error) {
					stampReviseDiffBase(turn, reviseBase, reviseBaseN);
				}
				syncLayout();
				scrollAskProcessToLatest(
					thread.querySelector(".ai-turn:last-child .ai-process"),
					{ focus: true },
				);
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
			// Revise retries use the follow-up composer; keep the Ask meter.
			restoreReviseInstructionToComposer();
		}
		if (!turn.pending && !turn.error) {
			clearReviseInstructionDraft();
			clearPendingResearchSubmitAttachments();
			clearResearchCompositionDraftStorage();
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

	/**
	 * Send the reader's answers and resume the paused revision. No new credit
	 * is spent; the server folds the answers into the same cycle.
	 */
	async function answerReviseClarify(): Promise<void> {
		const turn = turns[turns.length - 1];
		if (!turn || !isReviseClarifyingTurn(turn) || !turn.reviseClarify || busy) return;
		if (!turn.researchJobId) return;
		const clarify = turn.reviseClarify;
		const answers = answersFromClarifyState(clarify.answers);
		if (!canStartResearchClarify(clarify.questions, answers)) return;
		busy = true;
		root.classList.add("is-busy");
		// Optimistic: the card gives way to the live hop straight away.
		turn.reviseClarify = undefined;
		turn.progressNote = RESEARCH_REVISE_CONSIDERING_NOTE;
		setStatus("");
		syncLayout();
		revealReviseProgress();
		try {
			const { response, data } = await fetchAiJson<{
				success?: boolean;
				job?: ResearchJobPublic;
				code?: string;
				error?: string;
			}>(RESEARCH_REVISE_API_PATH, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "answer",
					jobId: turn.researchJobId,
					clarifyId: clarify.id,
					answers,
				}),
			});
			if (data.job) {
				applyResearchJobToTurn(turn, data.job);
				syncLayout();
				if (data.job.pending) {
					await pollResearchTurn(turn);
					if (turn.error) setStatus(turn.error);
					else if (!turn.pending) setStatus("");
				} else {
					settleReviseVersionState(turn);
					if (data.job.error) setStatus(data.job.error);
				}
				return;
			}
			if (response.status === 401) {
				window.location.assign(askAuthPageHref("/signin", null, currentReturnTo()));
				return;
			}
			// The questions were stale or the pause expired: re-read the job so
			// the turn shows whatever the server settled on.
			const live = await fetchResearchJob(turn.researchJobId);
			if (live.job) applyResearchJobToTurn(turn, live.job);
			else {
				turn.pending = false;
				turn.phase = "done";
			}
			if (!turn.pending) settleReviseVersionState(turn);
			setStatus(
				researchApiFailureMessage({
					status: response.status,
					code: data.code,
					error: data.error,
					fallback: "Could not continue the revision.",
				}),
			);
			if (turn.pending && live.job?.reviseClarify) {
				syncLayout();
				revealReviseClarifyCard();
			} else if (turn.pending) {
				syncLayout();
				await pollResearchTurn(turn);
			}
		} catch {
			// Restore the card so the answers are not lost on a flaky network.
			turn.reviseClarify = clarify;
			setStatus("Network error. Try again.");
		} finally {
			busy = false;
			root.classList.remove("is-busy");
			syncLayout();
		}
	}

	function revealReviseClarifyCard(): void {
		const card = thread.querySelector<HTMLElement>(
			".ai-turn:last-child [data-ai-revise-clarify]",
		);
		if (!card) return;
		try {
			card.scrollIntoView({ block: "center", behavior: "smooth" });
		} catch {
			card.scrollIntoView();
		}
	}

	/** Scroll the report block a clarify choice names into view and pulse it. */
	function revealReportBlock(blockId: string): void {
		const body = lastReportElement()?.querySelector<HTMLElement>(".ai-answer-body");
		if (!body) return;
		const el = findReportBlockElement(body, blockId);
		if (!el) return;
		try {
			el.scrollIntoView({ block: "center", behavior: "smooth" });
		} catch {
			el.scrollIntoView();
		}
		body
			.querySelectorAll<HTMLElement>(".is-clarify-target")
			.forEach((node) => node.classList.remove("is-clarify-target"));
		el.classList.add("is-clarify-target");
		window.setTimeout(() => el.classList.remove("is-clarify-target"), 2200);
	}

	let cancelInFlight = false;

	async function cancelActiveResearch(): Promise<void> {
		if (cancelInFlight) return;
		const turn = [...turns]
			.reverse()
			.find((item) => item.pending && item.researchJobId);
		if (!turn?.researchJobId) return;
		cancelInFlight = true;
		const revising = isReviseInProgress(turn) || Boolean(revisePendingSource);
		turn.researchLocalCancelToken = ++researchLocalCancelToken;
		stopResearchPoll();
		followComposerPinnedOpen = false;
		followComposerHoldCompact = true;
		const hadReviseClarify = Boolean(turn.reviseClarify);
		if (hadReviseClarify) {
			turn.reviseClarify = undefined;
		}
		turn.pending = false;
		turn.phase = "done";
		turn.progressNote = "";
		turn.error = revising ? "Revision stopped." : "Research stopped.";
		busy = true;
		root.classList.add("is-busy");
		syncLayout();
		try {
			const { data } = await fetchAiJson<{
				job?: ResearchJobPublic;
				researchQuota?: ResearchQuotaView;
			}>(researchJobApiPath(turn.researchJobId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "cancel" }),
			});
			if (data.researchQuota) applyQuota(quota, data.researchQuota);
			if (data.job && !researchJobWouldReviveAfterLocalCancel(turn, data.job)) {
				applyResearchJobToTurn(turn, data.job);
			} else if (!data.job) {
				turn.pending = false;
				turn.phase = "done";
				turn.error = revising ? "Revision stopped." : "Research stopped.";
				turn.reviseClarify = undefined;
			}
		} catch {
			turn.pending = false;
			turn.phase = "done";
			turn.error = revising ? "Revision stopped." : "Research stopped.";
			turn.reviseClarify = undefined;
		}
		if (isReviseInProgress(turn) || revisePendingSource) {
			restoreReviseFailureView();
			restoreReviseInstructionToComposer();
		} else {
			clearReviseVersionState();
		}
		if (turn.research && (turn.report || "").trim() && !turn.pending) {
			persistSessionFromTurn(turn);
		}
		void refreshQuota();
		if (turn.research && !turn.report) {
			setResearchChipOn(true);
			restorePendingResearchAttachmentsToComposer();
		}
		busy = false;
		root.classList.remove("is-busy", "is-research-busy", "is-revise-busy");
		syncLayout();
		cancelInFlight = false;
	}

	/**
	 * Auto-resend for failed/incomplete research: refill an empty composer with
	 * the previous attempt's attachments (pending submit → live turn bytes →
	 * history row → IndexedDB) so "Research again" reuses notes/images without
	 * re-pasting. Never overwrites attachments the reader already added.
	 */
	async function preloadReplacementAttachments(
		turn: AiAskTurn,
	): Promise<boolean> {
		if (!turn.research || turn.fromShare) return false;
		if (compositionImages.length > 0 || compositionContexts.length > 0) {
			return false;
		}
		const jobId = (turn.researchJobId || "").trim();
		let images = sanitizeResearchContextImages(
			pendingResearchSubmitImages || turn.attachedImages || [],
		);
		let clips = [...(pendingResearchSubmitContexts || [])];
		if (jobId && (clips.length === 0 || images.length === 0)) {
			const remembered = sessionEntries.find(
				(item) => item.researchJobId === jobId,
			);
			if (
				remembered &&
				images.length === 0 &&
				remembered.attachedImages?.length
			) {
				images = sanitizeResearchContextImages(remembered.attachedImages);
			}
			if (clips.length === 0 || images.length === 0) {
				try {
					const stored = await loadResearchAttachments(jobId);
					if (stored) {
						if (clips.length === 0 && stored.contextFull.trim()) {
							clips = [stored.contextFull];
						}
						if (images.length === 0 && stored.images.length > 0) {
							images = [...stored.images];
						}
					}
				} catch {
					/* attachment store is best-effort */
				}
			}
		}
		let restored = false;
		if (images.length > 0) {
			compositionImages = [...images];
			restored = true;
		}
		if (clips.length > 0 && restoreCompositionContextsToComposer(clips)) {
			restored = true;
		} else if (restored) {
			syncCompositionTray();
			persistResearchCompositionDraft();
		}
		if (restored) {
			const parts: string[] = [];
			if (images.length > 0) {
				parts.push(
					`${images.length} image${images.length === 1 ? "" : "s"}`,
				);
			}
			if (clips.length > 0) parts.push("attached notes");
			setStatus(`Re-attached ${parts.join(" + ")} from the previous attempt.`);
		}
		return restored;
	}

	/** The turn once carried attachments (labels, counts, or bytes). */
	function hadAttachmentIndicators(turn: AiAskTurn): boolean {
		if (
			turn.attachedImages?.length ||
			turn.contextAttachmentLabel ||
			turn.contextPreview ||
			turn.imageCount
		) {
			return true;
		}
		const jobId = (turn.researchJobId || "").trim();
		if (!jobId) return false;
		const remembered = sessionEntries.find(
			(item) => item.researchJobId === jobId,
		);
		return Boolean(
			remembered &&
				(remembered.attachedImages?.length ||
					remembered.contextAttachmentLabel ||
					remembered.contextPreview ||
					remembered.imageCount),
		);
	}

	async function retryIncompleteResearchTurn(
		turnIndex: number,
		question?: string,
		explicit?: {
			context: string;
			images: readonly ResearchContextImage[];
			touched: boolean;
		},
	): Promise<void> {
		const turn = turns[turnIndex];
		if (!turn || busy || turn.fromShare) return;
		const next = clipAiQuestion(question ?? turn.question);
		if (!next) return;
		// Rehydrate confirmation chips first: turns rebuilt from the server
		// job carry no attachment fields until the history row / store fills them.
		try {
			if (await backfillTurnAttachmentsFromStore(turn)) {
				if (turns[turnIndex] === turn) syncLayout();
			}
		} catch {
			/* attachment store is best-effort */
		}
		// Unchanged re-runs reuse the server job (and its credit); edited
		// questions or changed attachments start a new job carrying them.
		const resendChanged =
			explicit?.touched === true || !sameResearchRetryQuestion(next, turn);
		if (turn.researchJobId && !resendChanged) {
			await restartResearchJobTurn(turn, turnIndex);
			return;
		}
		setResearchChipOn(true);
		if (explicit && (explicit.context.trim() || explicit.images.length > 0)) {
			void ask(next, null, {
				replaceTurnIndex: turnIndex,
				forceResearch: true,
				attachments: { context: explicit.context, images: explicit.images },
			});
			return;
		}
		const restored = await preloadReplacementAttachments(turn);
		if (!restored && hadAttachmentIndicators(turn)) {
			setStatus(
				"Previous attachments couldn't be restored — re-attach them to include them in this research.",
			);
		}
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
			const { response, data } = await fetchAiJson<{
				job?: ResearchJobPublic;
				error?: string;
				code?: string;
				researchQuota?: ResearchQuotaView;
			}>(researchJobApiPath(jobId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "retry" }),
			});
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
			await preloadReplacementAttachments(turn);
			void ask(turn.question, null, {
				replaceTurnIndex: turnIndex,
				forceResearch: true,
			});
		}
	}

	/**
	 * Copy attachment confirmation metadata (and bytes when present) from a
	 * history row onto a turn rebuilt from the server job, which carries none.
	 * Only fills gaps — never overwrites live turn data.
	 */
	function applyStoredAttachmentMetadata(
		turn: AiAskTurn,
		entry: AiAskSessionEntry | null | undefined,
	): void {
		if (!entry) return;
		if (!turn.contextPreview && entry.contextPreview) {
			turn.contextPreview = entry.contextPreview;
		}
		if (
			typeof turn.contextWordCount !== "number" &&
			typeof entry.contextWordCount === "number"
		) {
			turn.contextWordCount = entry.contextWordCount;
		}
		if (!turn.contextAttachmentLabel && entry.contextAttachmentLabel) {
			turn.contextAttachmentLabel = entry.contextAttachmentLabel;
		}
		if (
			typeof turn.imageCount !== "number" &&
			typeof entry.imageCount === "number"
		) {
			turn.imageCount = entry.imageCount;
		}
		if (
			(!turn.attachedImages || turn.attachedImages.length === 0) &&
			entry.attachedImages?.length
		) {
			turn.attachedImages = sanitizeResearchContextImages(
				entry.attachedImages,
			);
		}
	}

	/**
	 * Backfill full attachment bytes from the same-browser store for turns
	 * that only carry count/label metadata (e.g. quota-stripped history rows
	 * or server-hydrated jobs). Returns true when the turn gained data.
	 */
	async function backfillTurnAttachmentsFromStore(
		turn: AiAskTurn,
	): Promise<boolean> {
		const jobId = (turn.researchJobId || "").trim();
		if (!jobId) return false;
		if (turn.attachedImages?.length) return false;
		let stored = null;
		try {
			stored = await loadResearchAttachments(jobId);
		} catch {
			return false;
		}
		if (!stored) return false;
		let changed = false;
		if (stored.images.length > 0) {
			turn.attachedImages = [...stored.images];
			changed = true;
		}
		if (!turn.contextPreview && stored.contextPreview) {
			turn.contextPreview = stored.contextPreview;
			changed = true;
		}
		if (
			typeof turn.contextWordCount !== "number" &&
			typeof stored.contextWordCount === "number"
		) {
			turn.contextWordCount = stored.contextWordCount;
			changed = true;
		}
		if (!turn.contextAttachmentLabel && stored.contextAttachmentLabel) {
			turn.contextAttachmentLabel = stored.contextAttachmentLabel;
			changed = true;
		}
		if (
			typeof turn.imageCount !== "number" &&
			typeof stored.imageCount === "number"
		) {
			turn.imageCount = stored.imageCount;
			changed = true;
		}
		return changed;
	}

	async function restoreResearchJob(
		jobId: string,
		fromHistory?: AiAskSessionEntry,
	): Promise<boolean> {
		let keepRestoring = false;
		try {
			if (isResearchJobDeleted(jobId)) {
				setStatus("That report was deleted.");
				syncAskSurfaceUrl({ jobId: null, open: null, sample: null });
				if (turns.length === 0) renderHistory();
				else syncLayout();
				return false;
			}
			const data = await fetchResearchJob(jobId);
			if (data.status === 401) {
				keepRestoring = true;
				window.location.assign(askAuthPageHref("/signin", null, currentReturnTo()));
				return true;
			}
			if (data.status === 404) {
				// Hard-deleted job — remember it so hydrate/sync never re-add it.
				markResearchJobDeleted(jobId);
				sessionEntries = removeAskHistoryEntriesByJobIds(sessionEntries, [
					jobId,
				]);
				writeAiAskSession(sessionEntries);
				setStatus("That report was deleted.");
				syncAskSurfaceUrl({ jobId: null, open: null, sample: null });
				if (turns.length === 0) renderHistory();
				else syncLayout();
				return false;
			}
			if (!data.ok || !data.job) {
				setStatus(
					researchApiFailureMessage({
						status: data.status,
						code: data.code,
						error: data.error,
						fallback: "Could not load research.",
					}),
				);
				return false;
			}
			const job = data.job;
			if (isResearchJobDeleted(job.id)) {
				setStatus("That report was deleted.");
				syncAskSurfaceUrl({ jobId: null, open: null, sample: null });
				if (turns.length === 0) renderHistory();
				else syncLayout();
				return false;
			}
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
			// The public job omits attachment fields — rehydrate confirmation
			// chips from the history row, then full bytes from the local store.
			applyStoredAttachmentMetadata(turn, history);
			const priorTurns = askHistoryEntriesForRestore(history)
				.filter((item) => item.researchJobId !== job.id)
				.map((item) => sessionEntryToTurn(item));
			turns = [...priorTurns, turn];
			void backfillTurnAttachmentsFromStore(turn).then((changed) => {
				if (changed && turns[turns.length - 1] === turn) syncLayout();
			});
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
				maybeApplyResearchCompositionDraft();
			}
			syncLayoutAndReveal();
			setRestoringResearch(false);
			if (!turn.pending) {
				if (!turn.error) persistSessionFromTurn(turn);
				restoreStoredPreviewVersion(turn);
				restoreReviseComposerDraft();
				maybeApplyResearchCompositionDraft();
				return true;
			}
			busy = true;
			root.classList.add("is-busy");
			syncLayout();
			await pollResearchTurn(turn);
			busy = false;
			root.classList.remove("is-busy", "is-research-busy");
			syncLayout();
			maybeApplyResearchCompositionDraft();
			return true;
		} catch (error) {
			setStatus(
				isAiTimeoutError(error)
					? AI_SERVER_TIMEOUT_MESSAGE
					: "Could not load research.",
			);
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
		restorePendingResearchAttachmentsToComposer();
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
			const { response, data } = await fetchAiJson<{
				success?: boolean;
				error?: string;
				code?: string;
				declined?: boolean;
				decline?: { kind?: string; message?: string };
				job?: ResearchJobPublic;
				researchQuota?: ResearchQuotaView;
			}>(RESEARCH_API_PATH, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clarifyId: turn.researchClarify.id,
					answers,
				}),
			});
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
			const clarifyReading = (turn.researchClarify?.interpretation || "").trim();
			if (clarifyReading) turn.researchInterpretation = clarifyReading;
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
			/**
			 * Explicit re-send attachments (Edit-box working set, retry
			 * preload). Merged explicit-first with the live composer state.
			 */
			attachments?: {
				context?: string;
				images?: readonly ResearchContextImage[];
			};
		},
	): Promise<void> {
		if (busy) return;
		stopListening();

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
			chipOn: researchPaneOn() && turns.length === 0 && !replacing,
			followUp: replacing || turns.length > 0,
			lastTurnResearch:
				lastTurnIsResearch() || Boolean(replacingTurn?.research),
			retryIncompleteResearch:
				options?.forceAsk !== true &&
				(options?.forceResearch === true ||
					Boolean(replacingTurn && isIncompleteResearchTurn(replacingTurn))),
			forceAsk: options?.forceAsk === true,
		});

		if (
			!useResearch &&
			!replacing &&
			options?.forceAsk !== true &&
			lastFinishedReportTurn()
		) {
			return;
		}

		const askLimit = maxAskQuestionChars(Boolean(quota?.signedIn));
		const rawQuestion = stripCompositionChipMarkers(question);
		const submitResolved = resolveResearchSubmitAttachments({
			globalImages: compositionImages,
			globalContexts: compositionContexts,
			overrideImages: options?.attachments?.images,
			overrideContext: options?.attachments?.context,
		});
		const submitImages = submitResolved.images;
		const submitContext = submitResolved.context;
		const composedQuestion = useResearch
			? rawQuestion
			: buildAskSubmitQuestion(rawQuestion, submitContext);
		const q = clipAiQuestion(composedQuestion, askLimit);

		if (
			!hasResearchCompositionContent({
				question: q,
				context: useResearch ? submitContext : "",
				images: useResearch ? submitImages : [],
			})
		) {
			return;
		}

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
		const researchAttachments = useResearch
			? {
					context: submitContext,
					images: submitImages,
					contextPreview: submitContext.trim()
						? researchContextPreview(submitContext)
						: undefined,
					contextWordCount: submitContext.trim()
						? countContextWords(submitContext)
						: undefined,
					contextAttachmentLabel: submitContext.trim()
						? formatContextChipLabel(submitContext)
						: undefined,
					imageCount:
						submitImages.length > 0 ? submitImages.length : undefined,
				}
			: null;
		if (useResearch) {
			snapshotResearchSubmitImages(submitImages);
			snapshotResearchSubmitContexts(submitResolved.contexts);
			clearCompositionAttachments({ clearDraft: true });
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
			...(researchAttachments?.contextPreview
				? { contextPreview: researchAttachments.contextPreview }
				: {}),
			...(typeof researchAttachments?.contextWordCount === "number"
				? { contextWordCount: researchAttachments.contextWordCount }
				: {}),
			...(researchAttachments?.contextAttachmentLabel
				? { contextAttachmentLabel: researchAttachments.contextAttachmentLabel }
				: {}),
			...(typeof researchAttachments?.imageCount === "number"
				? { imageCount: researchAttachments.imageCount }
				: {}),
			...(submitImages.length > 0 ? { attachedImages: submitImages } : {}),
		};
		turns.push(turn);
		if (!useResearch && compositionContexts.length > 0) {
			clearCompositionAttachments({ clearDraft: false });
		}
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
		if (useResearch && researchAttachments) {
			try {
				const { response, data } = await fetchAiJson<{
					success?: boolean;
					error?: string;
					code?: string;
					clarifyId?: string;
					inScope?: boolean;
					decline?: { kind?: string; message?: string };
					questions?: ResearchClarifyQuestion[];
				}>(RESEARCH_CLARIFY_API_PATH, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						question: q,
						history: buildAskFollowUpHistory(turns.slice(0, -1)),
						context: researchAttachments.context,
						images: researchAttachments.images,
					}),
				});
				if (!response.ok || !data.success) {
					turn.pending = false;
					turn.phase = "done";
					if (data.code === "research_auth") {
						abortReplace();
						if (target) {
							target.value = q;
							fitTextarea(target);
						}
						restorePendingResearchAttachmentsToComposer();
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
						restorePendingResearchAttachmentsToComposer();
						syncLayout();
						setStatus(data.error || "Could not prepare those questions.");
						return;
					}
					turn.error = data.error || "Could not prepare those questions.";
					restorePendingResearchAttachmentsToComposer();
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
					restorePendingResearchAttachmentsToComposer();
					syncLayoutAndReveal();
					return;
				}
				turn.researchClarify = {
					id: data.clarifyId || "",
					questions: data.questions || [],
					answers: suggestedClarifyAnswers(data.questions || []),
					...(typeof data.interpretation === "string" &&
					data.interpretation.trim()
						? { interpretation: data.interpretation.trim() }
						: {}),
				};
				syncLayoutAndReveal();
			} catch {
				turn.pending = false;
				turn.phase = "done";
				if (restoreOnFail) {
					abortReplace();
					restorePendingResearchAttachmentsToComposer();
					setStatus("Network error. Try again.");
				} else {
					turn.error = "Network error. Try again.";
					restorePendingResearchAttachmentsToComposer();
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
					// Server refunds quota on pre-answer errors; keep the
					// meter in sync with the refunded view.
					if (event.quota) applyQuota(event.quota);
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
		setStatus("Listening… tap the mic when you're done, then press Send.", {
			showInCompactDock: true,
		});
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
		const shared = turns[turns.length - 1];
		if (shared?.research && (shared.report || "").trim()) {
			restoreStoredPreviewVersion(shared);
		}
	}

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		if (root.classList.contains("is-research-gated")) {
			openQuotaDialog("signin", input.value);
			return;
		}
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
		if (reviseFollowActive() || lastFinishedReportTurn()) {
			if (followInput) void reviseReport(followInput.value);
			return;
		}
		if (followInput) void ask(followInput.value, followInput);
	});

	input.addEventListener("input", () => {
		fitTextarea(input);
		persistResearchCompositionDraft();
	});
	followInput?.addEventListener("input", () => {
		reviseEditDraft = {
			...reviseEditDraft,
			draftInstruction: followInput.value,
		};
		clipFollowInputValue();
		fitTextarea(followInput);
		syncStatusPresentation();
		if (compositionMutating) return;
		const hasChipMarkers =
			compositionMarkerIndices(followInput.value).length > 0 ||
			compositionContexts.length > 0;
		if (hasChipMarkers) {
			scheduleSyncInlineContextChip(followInput);
			return;
		}
		syncFollowComposerMode();
	});
	for (const button of compositionContextClears) {
		button.addEventListener("click", () => {
			clearCompositionContext();
		});
	}
	for (const button of compositionImageAttachButtons) {
		button.addEventListener("click", () => {
			if (!compositionImagesEnabled()) return;
			syncCompositionImageInput();
			compositionImageInput?.click();
		});
	}
	compositionImageInput?.addEventListener("change", () => {
		const files = compositionImageInput.files
			? [...compositionImageInput.files]
			: [];
		compositionImageInput.value = "";
		void handleCompositionImageFiles(files);
	});
	const compositionDropTargets = [
		form.querySelector(".ai-box"),
		followForm?.querySelector(".ai-box"),
		followForm,
	].filter((el): el is HTMLElement => el instanceof HTMLElement);
	for (const box of compositionDropTargets) {
		if (box.dataset.aiCompositionPaste === "1") continue;
		box.dataset.aiCompositionPaste = "1";
		box.addEventListener(
			"paste",
			(event) => {
				if (event instanceof ClipboardEvent) handleCompositionPaste(event);
			},
			true,
		);
		box.addEventListener("dragenter", (event) => {
			if (!compositionDropEnabled()) return;
			event.preventDefault();
		});
		box.addEventListener("dragover", (event) => {
			if (!compositionDropEnabled()) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
		});
		box.addEventListener("drop", (event) => {
			if (event instanceof DragEvent) handleCompositionDrop(event);
		});
	}
	for (const textarea of [input, followInput]) {
		if (!textarea) continue;
		textarea.addEventListener("dragover", (event) => {
			if (!compositionDropEnabled()) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
		});
		textarea.addEventListener("drop", (event) => {
			if (event instanceof DragEvent) handleCompositionDrop(event);
		});
	}
	window.addEventListener("resize", () => {
		if (!root.classList.contains("is-report-dock")) {
			scheduleSyncInlineContextChip();
		}
	});
	ensureCompositionMirrorHost(input);
	if (followInput) ensureCompositionMirrorHost(followInput);
	const followComposerBody = followForm?.querySelector<HTMLElement>(
		".ai-composer-body",
	);
	followComposerBody?.addEventListener(
		"scroll",
		() => {
			if (compositionContextTextarea) {
				repositionInlineContextChips(compositionContextTextarea);
			}
		},
		{ passive: true },
	);
	syncCompositionTray();
	scheduleSyncInlineContextChipAfterLayout();
	followForm?.addEventListener("focusin", () => {
		syncFollowComposerMode();
	});
	followForm?.addEventListener("focusout", (event) => {
		const next = event.relatedTarget;
		if (next instanceof Node && followForm.contains(next)) return;
		followComposerPinnedOpen = false;
		syncFollowComposerMode();
	});
	root.addEventListener(
		"pointerdown",
		(event) => {
			if (!root.classList.contains("is-report-dock")) return;
			if (!followForm || followForm.hidden) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			if (followForm.contains(target)) return;
			if (target.closest("[data-ai-revise-float], [data-ai-clarify-bar]")) return;
			followComposerPinnedOpen = false;
			syncFollowComposerMode();
		},
		true,
	);
	followForm?.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest(".ai-send[data-ai-stop], .ai-send-stop")) {
			if (!researchStopActive()) {
				syncStopButtons(false);
				if (reviseFollowActive() || lastFinishedReportTurn()) {
					if (followInput) void reviseReport(followInput.value);
				} else if (followInput) {
					void ask(followInput.value, followInput);
				}
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			void cancelActiveResearch();
			return;
		}
		if (!root.classList.contains("is-report-dock")) return;
		if (root.classList.contains("is-follow-expanded")) return;
		if (!followComposerClickShouldExpand(target)) return;
		followComposerHoldCompact = false;
		followComposerPinnedOpen = true;
		if (followInput && !followInput.disabled) followInput.focus();
		syncFollowComposerMode();
	});
	root.addEventListener(
		"click",
		(event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const stop = target.closest<HTMLButtonElement>(".ai-send[data-ai-stop]");
			if (!stop) return;
			if (!researchStopActive()) {
				syncStopButtons(false);
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			void cancelActiveResearch();
		},
		true,
	);

	const sendHint = askSendShortcutLabel();
	allSendButtons().forEach((button) => {
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
			if (reviseFollowActive() || lastFinishedReportTurn()) {
				void reviseReport(followInput.value);
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

	reviseClearBtn?.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		clearReviseScope();
	});
	askWithoutEditingBtn?.addEventListener("click", () => {
		if (!lastFinishedReportTurn()) return;
		window.location.assign(searchResearchHref());
	});
	reviseFloat?.addEventListener("click", () => {
		const scope = scopeFromLiveSelection();
		if (!scope) return;
		hideSelectionRevise();
		applyRevisePin(scope);
		openReviseComposer();
	});
	versionsDrawer?.querySelector("[data-ai-versions-close]")?.addEventListener(
		"click",
		() => closeVersionsDrawer(),
	);
	versionsDrawer?.addEventListener("click", (event) => {
		if (event.target === versionsDrawer) closeVersionsDrawer();
	});
	versionsReviseBtn?.addEventListener("click", () => {
		closeVersionsDrawer();
		openReviseComposer();
	});
	versionsRestoreBtn?.addEventListener("click", () => {
		void reviseReport("", "restore");
	});
	document.addEventListener("selectionchange", () => {
		updateSelectionRevise();
	});
	document.addEventListener("pointerdown", (event) => {
		if ((event.target as HTMLElement | null)?.closest("[data-ai-revise-float]")) {
			return;
		}
		selectionPointerDown = true;
	});
	const endSelectionPointer = () => {
		if (!selectionPointerDown) return;
		selectionPointerDown = false;
		// Let the browser settle the final range before measuring it.
		window.setTimeout(updateSelectionRevise, 0);
	};
	document.addEventListener("pointerup", endSelectionPointer);
	document.addEventListener("pointercancel", endSelectionPointer);

	clarifyCancelBtn?.addEventListener("click", () => {
		if (isReviseClarifyingTurn(turns[turns.length - 1])) {
			void cancelActiveResearch();
			return;
		}
		cancelResearchClarify();
	});
	clarifyStartBtn?.addEventListener("click", () => {
		if (isReviseClarifyingTurn(turns[turns.length - 1])) {
			void answerReviseClarify();
			return;
		}
		void startResearchFromClarify();
	});
	root.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
		const last = turns[turns.length - 1];
		const revise = isReviseClarifyingTurn(last);
		if (!revise && !isClarifyingTurn(last)) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest?.(".ai-clarify-other")) return;
		if (target?.closest?.("textarea")) return;
		event.preventDefault();
		if (revise) void answerReviseClarify();
		else void startResearchFromClarify();
	});

	const samplesReady = loadAskSamples();

	root.querySelectorAll<HTMLButtonElement>("[data-ai-new]").forEach((button) => {
		button.addEventListener("click", () => {
			if (shareMode) {
				window.location.assign(
					turns.some((item) => item.research)
						? RESEARCH_HOME_HREF
						: ASK_HOME_HREF,
				);
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

	thread.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const preview = target.closest("[data-ai-image-preview]");
		if (!(preview instanceof HTMLElement) || !thread.contains(preview)) return;
		const turnEl = preview.closest(".ai-turn");
		if (!turnEl) return;
		const turnNodes = thread.querySelectorAll(".ai-turn");
		const turnIndex = Array.from(turnNodes).indexOf(turnEl);
		if (turnIndex < 0) return;
		const turn = turns[turnIndex];
		const imageIndex = Number(preview.getAttribute("data-ai-image-index"));
		const image = turn?.attachedImages?.[imageIndex];
		if (!image) return;
		openResearchImageOverlay(image, {
			filename: researchContextImageFilename(image, imageIndex),
			alt: `Attached image ${imageIndex + 1}`,
		});
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
			return;
		}
		if (versionsDrawer && !versionsDrawer.hidden) {
			event.preventDefault();
			closeVersionsDrawer();
			return;
		}
		if (
			root.classList.contains("is-follow-expanded") &&
			followForm &&
			!followForm.hidden
		) {
			event.preventDefault();
			followComposerPinnedOpen = false;
			followInput?.blur();
			syncFollowComposerMode();
			return;
		}
		// Defocus composers on Escape: main Ask composer, Research composer
		// (same textarea, mode-dependent placeholder), and follow-up.
		const active = document.activeElement as HTMLElement | null;
		if (active && (active === input || active === followInput)) {
			event.preventDefault();
			active.blur();
			if (active === followInput) {
				followComposerPinnedOpen = false;
				syncFollowComposerMode();
			}
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
	restoreResearchCompositionDraft();

	// Navbar auth (page-state + local cache) resolves faster than /api/ai/quota.
	// Re-sync the Research composer as soon as it confirms sign-in so the
	// empty state doesn't linger on "Sign in to start research".
	void loadPageUserState()
		.then((state) => {
			if (state?.signedIn) syncResearchChip();
		})
		.catch(() => {
			/* quota refresh still corrects the composer */
		});

	window.addEventListener("pagehide", () => {
		persistResearchCompositionDraft();
		persistReviseComposerDraft();
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
	window.visualViewport?.addEventListener("resize", scheduleFollowDockFrost);
	window.visualViewport?.addEventListener("scroll", scheduleFollowDockFrost, {
		passive: true,
	});

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
		syncLayout();
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
		void ensureQuotaRefresh();
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

	syncComposerMaxLength();
	renderHistory();
	syncResearchChip();
	syncLayout();
	maybeApplyResearchCompositionDraft();
	watchPendingResearchHistory();
	void loadModels();
	if (!restoreResearchId) {
		void ensureQuotaRefresh().then(() => {
			maybeApplyResearchCompositionDraft();
		});
	}
	const historySync = syncHistoryFromServer();
	void historySync.then(() => {
		void hydrateOpenResearchJobs();
		if (turns.length > 0) restoreReviseComposerDraft();
		else finishReviseComposerHydration();
	});
	if (openQuestion && turns.length === 0) {
		void historySync.then(() => {
			if (turns.length === 0 && openFromHistory(openQuestion)) {
				input.value = "";
				fitTextarea(input);
			}
		});
	}
	scheduleFollowDockFrost();
	void ensureQuotaRefresh().then(() => {
		const pending = takePendingRevise();
		if (!pending || !quota?.signedIn) return;
		reviseEditDraft = {
			committed: pending.committed,
			draftScope: pending.draftScope,
			draftInstruction: pending.instruction,
		};
		reviseFromVersion = pending.fromVersion;
		if (followInput && pending.instruction) {
			followInput.value = pending.instruction;
			fitTextarea(followInput);
		}
		syncReviseScope();
		if (lastFinishedReportTurn() && canSubmitReviseEdits(buildSubmittableReviseEdits(reviseEditDraft))) {
			void reviseReport(pending.instruction);
		}
	});
}
