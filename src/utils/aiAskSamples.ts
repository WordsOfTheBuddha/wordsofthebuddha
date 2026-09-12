import { clipResearchProcessNotes } from "./aiAskResearchJob";
import { isAskSampleSlug } from "./aiAskHref";
import {
	AI_ASK_SESSION_LIMIT,
	normalizeAskQuestionKey,
	type AiAskSessionEntry,
} from "./aiAskSession";
import {
	sanitizeAskShareTurn,
	type AiAskShareTurn,
} from "./aiAskShare";

export const ASK_SAMPLE_COLLECTION = "askSamples";
export const ASK_SAMPLE_SLUG_MIN = 8;
export const ASK_SAMPLE_SLUG_MAX = 80;
export const ASK_SAMPLE_NOTE =
	"This is an illustrative response from a prior ask. Edit the question for a fresh ask.";
export const RESEARCH_SAMPLE_NOTE =
	"This is an illustration from a prior research run. It does not use your Research credits.";
export const RESEARCH_SAMPLE_KICKER = "Illustration — not your run";
export const ASK_SAMPLE_MENU_LABEL = "Sample";
export const ASK_SAMPLE_SAVE_LABEL = "Use as sample";
export const ASK_SAMPLE_SAVE_LABEL_SHORT = "Sample";
export const ASK_SAMPLE_REMOVE_LABEL = "Remove as Sample";
export const ASK_SAMPLE_REMOVE_LABEL_SHORT = "Remove";
export const ASK_SAMPLE_HIDE_TITLE = "Hide this sample from your list?";
export const ASK_SAMPLE_HIDE_CONFIRM =
	"It stays available for others.";
export const ASK_SAMPLE_REMOVE_TITLE = "Remove this sample for everyone?";
/** Samples fill Recent until the reader has this many of their own in the lane. */
export const ASK_SAMPLE_SHOW_UNTIL_OWN = 17;
export const HIDDEN_ASK_SAMPLES_KEY = "ai-ask-hidden-samples-v1";

export { isAskSampleSlug };

export type AskSamplePlaybackPhase = "rewrite" | "search" | "rerank" | "done";

/** Short staged wait so a chip click still shows the usual Ask process. */
export const ASK_SAMPLE_PLAYBACK: readonly {
	atMs: number;
	phase: AskSamplePlaybackPhase;
}[] = [
	{ atMs: 0, phase: "rewrite" },
	{ atMs: 800, phase: "search" },
	{ atMs: 1800, phase: "rerank" },
	{ atMs: 3000, phase: "done" },
];

export function askSamplePlaybackPatch(
	sample: AiAskSamplePublic,
	phase: AskSamplePlaybackPhase,
): {
	pending: boolean;
	phase: "rewrite" | "search" | "rerank" | "done";
	lookingFor: string;
	queries: string[];
	fallbackQueries: string[];
	summary: string;
	results: AiAskSamplePublic["results"];
	rerankCandidateCount?: number;
	rerankShowCount?: number;
	report?: string;
	research?: boolean;
} {
	const done = phase === "done";
	const afterRewrite = phase !== "rewrite";
	const pool =
		typeof sample.candidateCount === "number" && sample.candidateCount > 0
			? sample.candidateCount
			: 0;
	return {
		pending: !done,
		phase: done ? "done" : phase,
		lookingFor: afterRewrite ? sample.lookingFor : "",
		queries: afterRewrite ? sample.queries : [],
		fallbackQueries: afterRewrite ? sample.fallbackQueries : [],
		summary: done ? sample.summary : "",
		results: done ? sample.results : [],
		...(done && sample.report
			? { report: sample.report, research: true as const }
			: {}),
		...(afterRewrite && pool > 0
			? {
					rerankCandidateCount: pool,
					rerankShowCount: sample.results.length,
				}
			: {}),
	};
}

/** Public curated example (no admin email). */
export interface AiAskSamplePublic extends AiAskShareTurn {
	slug: string;
	questionKey: string;
	updatedAt: number;
	processNotes?: string[];
}

export function deriveAskSampleSlug(question: string): string {
	const slug = question
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, ASK_SAMPLE_SLUG_MAX)
		.replace(/-+$/g, "");
	if (isAskSampleSlug(slug)) return slug;
	return `ask-${askSampleKeyFingerprint(normalizeAskQuestionKey(question))}`;
}

export function askSampleKeyFingerprint(questionKey: string): string {
	const key = questionKey.replace(/\s+/g, " ").trim();
	let hash = 2166136261;
	for (let i = 0; i < key.length; i++) {
		hash ^= key.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

export function askSampleMatchesQuestion(
	sample: Pick<AiAskSamplePublic, "questionKey" | "question">,
	question: string,
): boolean {
	const key = normalizeAskQuestionKey(question);
	if (!key) return false;
	return (
		sample.questionKey === key ||
		normalizeAskQuestionKey(sample.question) === key
	);
}

export function findAskSample(
	samples: readonly AiAskSamplePublic[],
	question: string,
): AiAskSamplePublic | null {
	const key = normalizeAskQuestionKey(question);
	if (!key) return null;
	return (
		samples.find((sample) => askSampleMatchesQuestion(sample, question)) ||
		null
	);
}

/** Hydrate a stored sample for this lane. Ask ignores research samples. */
export function findAskSampleForExample(
	samples: readonly AiAskSamplePublic[],
	question: string,
	options?: { research?: boolean; researchChipOn?: boolean },
): AiAskSamplePublic | null {
	const research = options?.research === true || options?.researchChipOn === true;
	const lane = research ? researchAskSamples(samples) : askPaneSamples(samples);
	return findAskSample(lane, question);
}

/** Published example for this open turn (slug wins, else question + lane). */
export function publishedAskSample(
	samples: readonly AiAskSamplePublic[],
	input: {
		question: string;
		originalQuestion?: string;
		sampleSlug?: string;
		research?: boolean;
	},
): AiAskSamplePublic | null {
	const slug = (input.sampleSlug || "").trim().toLowerCase();
	if (slug) {
		const bySlug = samples.find((sample) => sample.slug === slug);
		if (bySlug) return bySlug;
	}
	const research = input.research === true;
	return (
		findAskSampleForExample(samples, input.question, { research }) ||
		(input.originalQuestion
			? findAskSampleForExample(samples, input.originalQuestion, { research })
			: null)
	);
}

export function upsertAskSampleLocal(
	samples: readonly AiAskSamplePublic[],
	next: AiAskSamplePublic,
): AiAskSamplePublic[] {
	const research = isResearchAskSample(next);
	const without = samples.filter(
		(sample) =>
			!(
				sample.questionKey === next.questionKey &&
				isResearchAskSample(sample) === research
			),
	);
	return [next, ...without];
}

export function removeAskSampleLocal(
	samples: readonly AiAskSamplePublic[],
	slug: string,
): AiAskSamplePublic[] {
	const id = slug.trim().toLowerCase();
	if (!id) return [...samples];
	return samples.filter((sample) => sample.slug !== id);
}

export function sanitizeAskSamplePublic(raw: unknown): AiAskSamplePublic | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const turn = sanitizeAskShareTurn(record);
	if (!turn) return null;
	const questionKey = normalizeAskQuestionKey(
		typeof record.questionKey === "string" && record.questionKey.trim()
			? record.questionKey
			: turn.question,
	);
	if (!questionKey) return null;
	const slugRaw =
		typeof record.slug === "string" ? record.slug.trim().toLowerCase() : "";
	const slug = isAskSampleSlug(slugRaw)
		? slugRaw
		: deriveAskSampleSlug(turn.question);
	const updatedAt =
		typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
			? Math.max(0, Math.round(record.updatedAt))
			: Date.now();
	const processNotes = clipResearchProcessNotes(record.processNotes);
	return {
		...turn,
		slug,
		questionKey,
		updatedAt,
		...(processNotes.length > 0 ? { processNotes } : {}),
	};
}

export function canMarkAskAsSample(input: {
	isAdmin: boolean;
	pending?: boolean;
	error?: string;
	offTopic?: boolean;
	resultCount: number;
	fromShare?: boolean;
	fromSample?: boolean;
	research?: boolean;
	hasReport?: boolean;
}): boolean {
	if (
		!input.isAdmin ||
		input.pending ||
		input.error ||
		input.offTopic === true ||
		input.fromShare === true ||
		input.fromSample === true
	) {
		return false;
	}
	if (input.research) {
		return Boolean(input.hasReport) && input.resultCount > 0;
	}
	return input.resultCount > 0;
}

export function canRemoveAskSample(input: {
	isAdmin: boolean;
	pending?: boolean;
	fromShare?: boolean;
	hasSample: boolean;
}): boolean {
	return Boolean(
		input.isAdmin &&
			!input.pending &&
			input.fromShare !== true &&
			input.hasSample,
	);
}

/** One admin control: remove replaces save when this question is already an example. */
export function askSampleAdminAction(input: {
	canSave: boolean;
	canRemove: boolean;
}): "save" | "remove" | null {
	if (input.canRemove) return "remove";
	if (input.canSave) return "save";
	return null;
}

export function askSampleRemoveConfirmMessage(options?: {
	research?: boolean;
}): string {
	if (options?.research) {
		return "Readers will no longer see this illustration. Their own reports are unchanged.";
	}
	return "Readers will no longer see this illustration. Their own Asks are unchanged.";
}

export function askSampleConfirmMessage(
	replacing: boolean,
	options?: { research?: boolean },
): string {
	if (options?.research) {
		if (replacing) {
			return "Replace the current research example for this question? Readers will see this report instead. It does not use their Research credits.";
		}
		return "Use this report as the example for this question? Readers will see it when they tap this sample. It does not use their Research credits.";
	}
	if (replacing) {
		return "Replace the current example for this question? Readers will see this run instead. It does not use their Ask credits.";
	}
	return "Use this run as the example for this question? Readers will see it when they tap this sample. It does not use their Ask credits.";
}

export function isResearchAskSample(
	sample: Pick<AiAskSamplePublic, "research" | "report">,
): boolean {
	return sample.research === true || Boolean((sample.report || "").trim());
}

export function researchAskSamples(
	samples: readonly AiAskSamplePublic[],
): AiAskSamplePublic[] {
	return samples.filter((sample) => isResearchAskSample(sample) && sample.question);
}

export function askPaneSamples(
	samples: readonly AiAskSamplePublic[],
): AiAskSamplePublic[] {
	return samples.filter((sample) => !isResearchAskSample(sample) && sample.question);
}

export function askSampleHideKey(
	sample: Pick<AiAskSamplePublic, "questionKey">,
	research: boolean,
): string {
	return `${research ? "r" : "a"}:${sample.questionKey}`;
}

export function readHiddenAskSampleKeys(
	storage?: Pick<Storage, "getItem"> | null,
): Set<string> {
	try {
		const raw = storage?.getItem(HIDDEN_ASK_SAMPLES_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return new Set();
		return new Set(
			parsed.filter(
				(item): item is string =>
					typeof item === "string" && Boolean(item.trim()),
			),
		);
	} catch {
		return new Set();
	}
}

export function hideAskSampleKey(
	key: string,
	storage?: Pick<Storage, "getItem" | "setItem"> | null,
): Set<string> {
	const next = readHiddenAskSampleKeys(storage);
	const trimmed = key.replace(/\s+/g, " ").trim();
	if (trimmed) next.add(trimmed);
	try {
		storage?.setItem(HIDDEN_ASK_SAMPLES_KEY, JSON.stringify([...next]));
	} catch {
		/* ignore quota / private mode */
	}
	return next;
}

export function visibleHistorySamples(input: {
	samples: readonly AiAskSamplePublic[];
	research: boolean;
	ownCount: number;
	ownQuestionKeys: ReadonlySet<string>;
	hiddenKeys?: ReadonlySet<string>;
}): AiAskSamplePublic[] {
	if (input.ownCount > ASK_SAMPLE_SHOW_UNTIL_OWN) return [];
	const slots = Math.max(0, AI_ASK_SESSION_LIMIT - input.ownCount);
	const lane = input.research
		? researchAskSamples(input.samples)
		: askPaneSamples(input.samples);
	const hidden = input.hiddenKeys || new Set<string>();
	return lane
		.filter((sample) => {
			if (input.ownQuestionKeys.has(sample.questionKey)) return false;
			if (hidden.has(askSampleHideKey(sample, input.research))) return false;
			return true;
		})
		.slice(0, slots);
}

export function sampleToHistoryEntry(
	sample: AiAskSamplePublic,
): AiAskSessionEntry {
	return {
		question: sample.question,
		lookingFor: sample.lookingFor,
		queries: sample.queries,
		fallbackQueries: sample.fallbackQueries,
		offTopic: false,
		results: sample.results,
		model: sample.model,
		reasoning: "",
		summary: sample.summary,
		at: sample.updatedAt,
		...(sample.requestId ? { requestId: sample.requestId } : {}),
		...(typeof sample.candidateCount === "number" && sample.candidateCount > 0
			? { candidateCount: sample.candidateCount }
			: {}),
		...(isResearchAskSample(sample) ? { research: true } : {}),
		...(sample.report ? { report: sample.report } : {}),
		...(sample.processNotes && sample.processNotes.length > 0
			? { processNotes: sample.processNotes }
			: {}),
	};
}

export function sampleToShareTurn(sample: AiAskSamplePublic): AiAskShareTurn {
	return {
		question: sample.question,
		lookingFor: sample.lookingFor,
		queries: sample.queries,
		fallbackQueries: sample.fallbackQueries,
		summary: sample.summary,
		results: sample.results,
		model: sample.model,
		...(sample.requestId ? { requestId: sample.requestId } : {}),
		...(typeof sample.candidateCount === "number"
			? { candidateCount: sample.candidateCount }
			: {}),
		...(isResearchAskSample(sample) ? { research: true } : {}),
		...(sample.report ? { report: sample.report } : {}),
	};
}
