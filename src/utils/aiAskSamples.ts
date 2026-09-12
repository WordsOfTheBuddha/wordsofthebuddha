import { normalizeAskQuestionKey } from "./aiAskSession";
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
	if (
		slug.length >= ASK_SAMPLE_SLUG_MIN &&
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
	) {
		return slug;
	}
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

/** Chip click hydrates a stored sample. Ask chips ignore research samples. */
export function findAskSampleForExample(
	samples: readonly AiAskSamplePublic[],
	question: string,
	options?: { research?: boolean; researchChipOn?: boolean },
): AiAskSamplePublic | null {
	const research = options?.research === true || options?.researchChipOn === true;
	const sample = findAskSample(samples, question);
	if (!sample) return null;
	const isResearch = sample.research === true || Boolean((sample.report || "").trim());
	if (research) return isResearch ? sample : null;
	return isResearch ? null : sample;
}

export function upsertAskSampleLocal(
	samples: readonly AiAskSamplePublic[],
	next: AiAskSamplePublic,
): AiAskSamplePublic[] {
	const without = samples.filter(
		(sample) => sample.questionKey !== next.questionKey,
	);
	return [next, ...without];
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
	const slug =
		slugRaw &&
		slugRaw.length >= ASK_SAMPLE_SLUG_MIN &&
		slugRaw.length <= ASK_SAMPLE_SLUG_MAX &&
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugRaw)
			? slugRaw
			: deriveAskSampleSlug(turn.question);
	const updatedAt =
		typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
			? Math.max(0, Math.round(record.updatedAt))
			: Date.now();
	return {
		...turn,
		slug,
		questionKey,
		updatedAt,
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
